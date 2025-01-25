from flask import Flask, request , render_template
from flask_socketio import SocketIO, emit
from flask_htpasswd import HtPasswdAuth
import random
from datetime import datetime, timedelta, time
import yaml
import json
import os
import copy
import jsonpickle
import secrets
import pprint
import traceback

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
gameState = {}

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
@socketio.on('request-game-state')
def event_request_game_state(json):
    pprint.pprint(json)
    emit('update-game-state', gameState, to=request.sid)

@socketio.on('create-new-player')
def event_create_new_player(json):
    # DATABASE METHOD
    try:
        session = createsession()
        new_player = session.query(User).filter(User.discord_id == str(message.author.id)).one_or_none()
        if new_player == None:
            new_player = User(
                name=json['name']
            )
            session.add(new_player)
            session.commit()
    except Exception:
        traceback.print_exc()
    finally:
        session.close()

    # GAMESTATE METHOD
    rand_id = getID()
    new_player = {
        'id': rand_id,
        'sid': request.sid,
        'name': json['name'],
        'score': 0,
    }
    gameState['players'][rand_id] = new_player

    emit('event_new_player_added_successfully', new_player, to=request.sid)

# RUN
if __name__ == "__main__":
    socketio.run(app)