from flask import Flask, request , render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_htpasswd import HtPasswdAuth
import random
from datetime import datetime, timedelta
from time import sleep
import yaml
import json
import os
import copy
import jsonpickle
import secrets
from pprint import pprint
import traceback
import requests

from utilities import *
from models import *

# CONFIGURATION LOAD
try:
    with open('config.yaml', 'r') as file:
        config = yaml.safe_load(file)
except Exception as e:
    print('Could not load config file. Using Default values')
    config = {
        'FLASK_HOST': '127.0.0.1',
        'FLASK_PORT': '5000',
        'FLASK_DEBUG': True,
        'FLASK_SECRET': 's3cr3t!'
    }

# APP CONFIGURATION
app = Flask(__name__)
app.config['FLASK_HTPASSWD_PATH'] = './.htpasswd'
app.config['SECRET_KEY'] = config['FLASK_SECRET']
app.config['TEMPLATES_AUTO_RELOAD'] = True
socketio = SocketIO(app)
htpasswd = HtPasswdAuth(app)

# DATABASE CONFIGURATION
Base.metadata.create_all(engine)
def createsession():
    return Session(engine)

# GAME DATA
games = {}
players = {}

### ROUTES ###
# Main Route: for the main game
@app.route('/', methods=['GET'])
def route_home():
    return render_template('index.html')

# Controller route: an example of a route protected by htpasswd
@app.route("/controller")
@htpasswd.required
def route_controller(user):
    return render_template('controller.html')

### SOCKETS ###
@socketio.on('disconnect')
def event_disconnect():
    # TODO remove from rooms, games, and player lists
    leave_room()

@socketio.on('create-new-game')
def event_create_new_game(json):
    pprint(json)
    try:
        # VALIDATE CURRENT DATA
        json['name'] = json['name'] if len(str(json['name'])) <= 32 else str(json['name'])[0:32]
        if len(json['name']) < 1:
            json['name'] = getID(3)
        json['password'] = json.get('password')
        json['rounds'] = min(max(1, json['rounds']), 10)

        # CREATE APPROPRIATE GAME DATA
        json['id'] = getID()
        json['players'] = []
        json['started'] = False
        json['current_round'] = 0
        json['creator_sid'] = request.sid

        # ADD TO GAME LIST
        pprint(json)
        games[json['id']] = json

        # ADD CREATOR TO NEW ROOM
        join_room(json['id'])

        # CONFIRM GAME STATUS AND SEND TO LOBBY
        emit('game-creation-successful', json, to=request.sid)
    except Exception as e:
        pprint(traceback.format_exc(e))
        emit('game-creation-failed', {'message': e}, to=request.sid)

@socketio.on('create-new-player')
def event_create_new_player(json):
    pprint(json)
    try:
        if len(str(json['name'])) <= 0:
            res = requests.get('https://randomuser.me/api/')
            if res.ok:
                try:
                    result = res.json()['results'][0]['name']
                    json['name'] = result['first'] + ' ' + result['last']
                except Exception as e:
                    pprint(traceback.format_exc(e))
                    json['name'] = getID()
            else:
                json['name'] = getID()
        json['id'] = getID()
        json['score'] = 0
        json['sid'] = request.sid

        players[json['id']] = json

        emit('player-creation-successful', json, to=request.sid)
    except Exception as e:
        pprint(traceback.format_exc(e))
        emit('player-creation-failed', {'message': e}, to=request.sid)

@socketio.on('request-game-list')
def event_request_game_list():
    sanitized_games = [game for game in games.values() if game['started'] == False]
    for game in sanitized_games:
        pw = game.get('password')
        game['password'] = pw != None and pw != False
        game['creator_sid'] = None
    
    emit('update-game-list', sanitized_games, to=request.sid)

@socketio.on('request-game-join')
def event_request_game_join(json):
    game_id = json['game_id']
    player_id = json['player_id']

    # TODO check if password locked and if so, check password

    addPlayerToGame(game_id, player_id)
    join_room(game_id)

    emit('joined-game-successfully', games[game_id], to=request.sid)

    pprint(game_id)
    pprint(games[game_id])

@socketio.on('request-game-lobby')
def event_request_game_lobby(json):
    game_id = json['game_id']

    pprint(players)

    emit('update-game-lobby', {
        'game_state': games[game_id],
        'players': [player for player in players.values() if player['id'] in games[game_id]['players']]
    }, to=game_id)

    pprint(game_id)
    pprint(games[game_id])



# HELPFUL GAME FUNCTIONS
def isGamePasswordLocked(game_id):
    try:
        return games[game_id]['password'] != None
    except Exception as e:
        pprint(traceback.format_exc(e))
        return None
    
def addPlayerToGame(game_id, player_id):
    games[game_id]['players'].append(player_id)

def getPlayersInGame(game_id):
    return [player for player in players.values() if player in games[game_id]['players']]


# RUN
if __name__ == "__main__":
    socketio.run(app, host=config['FLASK_HOST'], port=config['FLASK_PORT'], debug=config['FLASK_DEBUG'])