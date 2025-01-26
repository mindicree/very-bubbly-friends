import logging.handlers
from flask import Flask, request , render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_htpasswd import HtPasswdAuth
from engineio.payload import Payload
import random
from datetime import datetime, timedelta
from time import sleep
import yaml
import json
import os
import copy
import jsonpickle
import secrets
import traceback
from pprint import pprint
import requests

import logging

from utilities import *
# from models import *

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
Payload.max_decode_packets = 512

# file logging
if (not os.path.isdir('logs')):
    os.makedirs('logs')
formatter = logging.Formatter('%(asctime)s : %(msecs)d %(name)s %(levelname)s %(lineno)d %(message)s')
handler = logging.handlers.TimedRotatingFileHandler(os.path.join('logs', 'log'), when="midnight", backupCount=10)
handler.setFormatter(formatter)
handler.suffix = "%Y-%m-%d.log"
logger = logging.getLogger()
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)

# DATABASE CONFIGURATION
# Base.metadata.create_all(engine)
# def createsession():
#     return Session(engine)

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
    removePlayer()
    removePlayer()

@socketio.on('create-new-game')
def event_create_new_game(json):
    try:
        # VALIDATE CURRENT DATA
        json['name'] = json['name'] if len(str(json['name'])) <= 32 else str(json['name'])[0:32]
        if len(json['name']) < 1:
            json['name'] = getID(3)
        json['password'] = json.get('password')
        json['rounds'] = min(max(1, int(json['rounds'])), 10)

        # CREATE APPROPRIATE GAME DATA
        json['id'] = getID()
        json['players'] = []
        json['started'] = False
        json['current_round'] = 0
        json['creator_sid'] = request.sid
        json['round_start'] = False
        json['questions'] = {}
        json['timer'] = 0

        # ADD TO GAME LIST
        games[json['id']] = json

        # ADD CREATOR TO NEW ROOM
        join_room(json['id'])

        # CONFIRM GAME STATUS AND SEND TO LOBBY
        emit('game-creation-successful', json, to=request.sid)
    except Exception as e:
        logger.exception(e)
        emit('game-creation-failed', {'message': e}, to=request.sid)

@socketio.on('create-new-player')
def event_create_new_player(json):
    try:
        if len(str(json['name'])) <= 0:
            res = requests.get('https://randomuser.me/api/')
            if res.ok:
                try:
                    result = res.json()['results'][0]['name']
                    json['name'] = result['first'] + ' ' + result['last']
                except Exception as e:
                    logger.exception(e)
                    json['name'] = getID()
            else:
                json['name'] = getID()
        json['id'] = getID()
        json['score'] = 0
        json['previous_score'] = 0
        json['sid'] = request.sid
        json['color'] = f'#{str(hex(random.randrange(0, 2**24))[2:])}'

        players[json['id']] = json

        emit('player-creation-successful', json, to=request.sid)
    except Exception as e:
        logger.exception(e)
        emit('player-creation-failed', {'message': e}, to=request.sid)

@socketio.on('request-game-list')
def event_request_game_list():
    emit('update-game-list', getSanitizedGames(), to=request.sid)

@socketio.on('request-game-join')
def event_request_game_join(json):
    game_id = json['game_id']
    player_id = json['player_id']

    # TODO check if password locked and if so, check password

    if not isGameStarted(game_id):
        addPlayerToGame(game_id, player_id)
    
    join_room(game_id)

    emit('joined-game-successfully', games[game_id], to=request.sid)

@socketio.on('request-game-lobby')
def event_request_game_lobby(json):
    game_id = json['game_id']

    try:
        emit('update-game-lobby', getGameState(game_id), to=game_id)
    except Exception as e:
        # TODO implement functionality to remove game info
        emit('game-not-found', {
            'game_id': game_id
        }, to=game_id)

@socketio.on('request-game-start')
def event_request_game_start(json):
    game_id = json['game_id']

    sleep(random.random() * 1)

    if isGameStarted(game_id) or not isPlayerCountSufficient(game_id):
        return
    
    games[game_id]['started'] = True

    emit('update-game-list', getSanitizedGames(), broadcast=True)

    emit('game-started', getGameState(game_id), to=game_id)

@socketio.on('player-tap')
def event_request_player_tap(json):
    emit('player-tapped', json, to=json['game_id'])

@socketio.on('player-pop-question')
def event_request_player_pop_question(json):
    emit('player-receive-question', json, to=json['game_id'])

@socketio.on('player-answer-question')
def event_request_player_answer_question(json):
    emit('player-answered-question', json, to=json['game_id'])

@socketio.on('request-end-round')
def event_request_end_round(json):
    emit('end-round', to=json['game_id'])

# HELPFUL GAME FUNCTIONS
def isGamePasswordLocked(game_id):
    try:
        return games[game_id]['password'] != None
    except Exception as e:
        logger.exception(e)
        return None

def isGameStarted(game_id):
    return games[game_id]['started']
    
def addPlayerToGame(game_id, player_id):
    games[game_id]['players'].append(player_id)

def getGameState(game_id):
    return {
        'game_state': games[game_id],
        'players': [player for player in players.values() if player['id'] in games[game_id]['players']]
    }

def getPlayersInGame(game_id):
    return [player for player in players.values() if player in games[game_id]['players']]

def removePlayer(player_id=None, player_sid=None):
    pass

def isPlayerCountSufficient(game_id):
    return len(games[game_id]['players']) > 1

def getSanitizedGames():
    sanitized_games = [game for game in games.values() if game['started'] == False]
    for game in sanitized_games:
        pw = game.get('password')
        game['password'] = pw != None and pw != False
        game['creator_sid'] = None

    return sanitized_games

# RUN
if __name__ == "__main__":
    socketio.run(app, host=config['FLASK_HOST'], port=config['FLASK_PORT'], debug=config['FLASK_DEBUG'])