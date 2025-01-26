import Alpine from "alpinejs";
import './utilities';

document.addEventListener('alpine:init', () => {
    Alpine.data('game', () => ({
        loading: true,
        scene: 'loading',
        socket: null,
        canPlayAudio: false,

        gameState: null,
        player: {
            name: '',
        },
        players: {},
        newGame: {
            name: '',
            rounds: 3,
            round_duration: 60,
            max_players: 20,
            bubble_speed: 200,
            bubble_summon: 1000,
        },
        newGameErrorMessage: '',
        gameCreator: false,
        
        gameList: [],
        gameListFetchInterval: null,
        gamePassword: '',

        inLobby: false,
        lobbyFetchInterval: null,

        roundText: '',
        bubbleCreationInterval: null,
        bubbleMovementInterval: null,
        bubbleMovementIterations: 0,

        prevRoundScores: [],
        // TODO consider making scoring a game setting
        scoring: {
            easy: 1,
            medium: 2,
            hard: 3,
        },
        roundOverPhrases: [
            'That was bubbly!',
            'Great work, bubblers!'
        ],

        selectedQuestion: null,

        clickLocked: false,

        audioEngine: {
            bgmMain: new Audio('/static/mp3/bgm-title.mp3'),
        },
        async init() {
            // TODO load last used name and game settings into game

            // INITIALIZE SOCKET CONNECTION
            this.socket = io()

            // SOCKET ON CONNECT
            this.socket.on('connect', async () => {
                console.log('Socket connected')

                // SET ANY POLLING INTERVALS
                this.gameListFetchInterval = setInterval(() => {
                    this.socket.emit('request-game-list');
                }, 3000);

                setInterval(() => {
                    if(Math.random() < 0.25 && !['gameDisplay', 'gameController'].includes(this.scene)) {
                        let newBubbleContainer = document.createElement('div')
                        let newBubble = document.createElement('div')

                        newBubble.classList.add('bubble', 'pulse-small');
                        let size = Math.floor(window.innerWidth / 15 * Math.random())
                        newBubble.style.width=`${size}px`;
                        newBubble.style.height=`${size}px`;

                        let newBubbleFloatTime = Math.random() * 10 + 10;
                        newBubbleContainer.style.animationDuration = `${newBubbleFloatTime}s`;
                        newBubbleContainer.classList.add('absolute', 'bottom-0');
                        let xPos = Math.floor(Math.random() * window.innerWidth)
                        newBubbleContainer.style.left = `${xPos}px`

                        newBubbleContainer.appendChild(newBubble)
                        this.$refs.bubbleBackgroundContainer.appendChild(newBubbleContainer);
                        newBubbleContainer.classList.add('floating-bubble');

                        setTimeout(() => {
                            newBubbleContainer.remove();
                        }, newBubbleFloatTime * 1000 + 3000);
                    }
                }, 100);

                // INITIALIZE AUDIO
                window.addEventListener('click', async () => {
                    if (this.canPlayAudio === false) {
                        this.canPlayAudio = true;
                        await sleep(500);
                        this.playSound('bgmMain', true, 0.75)
                    }
                })

                await sleep(1000);

                // CHANGE SCENE
                this.loading = false;
                this.setCurrentScene('home');
            })

            this.socket.on('disconnect', () => {
                alert('You have been disconnected');
                this.player = {};
                this.gameState = null;
                this.setCurrentScene('home');
            })

            //////////////////////
            // SOCKET GAME EVENTS
            /////////////////////
            // GAME CREATION
            this.socket.on('game-creation-successful', json => {
                this.gameState = json;
                this.gameCreator = true;
                console.log('Game creation successful');
                this.$refs.modalCreateGame.close();
                this.setCurrentScene('lobby');
                this.loading = false;
            });
            this.socket.on('game-creation-failed', json => {
                this.newGameErrorMessage = json.message;
                this.loading = false;
                console.log('Game creation failed');
            });
            this.socket.on('update-game-list', json => {
                this.gameList = json;
            });
            this.socket.on('joined-game-successfully', json => {
                console.log('Joined games successfully');
                console.log(json);
                this.gameState = json;
                this.setCurrentScene('lobby');
                this.inLobby = true;
                this.lobbyFetchInterval = setInterval(() => {
                    if(this.inLobby) {
                        this.socket.emit('request-game-lobby', {
                            game_id: this.gameState['id']
                        });
                    }
                }, 1000)
            });
            this.socket.on('update-game-lobby', json => {
                this.gameState = json['game_state']
                this.gameState['players'] = json['players'];
            });
            // PLAYER CREATION
            this.socket.on('player-creation-successful', json => {
                this.player = json;
                console.log('Player creation successful');
                this.socket.emit('request-game-list');
                this.$refs.modalJoinGame.close();
                this.setCurrentScene('gameList');
                this.loading = false;
            });
            this.socket.on('player-creation-failed', json => {
                console.error(json);
            });
            // GAME FUNCTIONALITY
            this.socket.on('game-started', json => {
                this.inLobby = false;
                this.gameState = json['game_state'];
                this.players = json['players'];
                if (this.gameCreator) {
                    this.setCurrentScene('gameDisplay');
                    this.executeRound();
                } else {
                    this.setCurrentScene('gameController');
                }  
            });
            this.socket.on('player-tapped', json => {
                if (!this.gameCreator) {
                    return;
                }

                // TODO make pointer size a game setting
                let pingSize = 64;
                let pingX = (json['xRatio'] * window.innerWidth) - (pingSize/2);
                let pingY = (json['yRatio'] * window.innerHeight) - (pingSize/2);
                let ping = document.createElement('div')
                ping.classList.add('absolute', 'rounded-full', 'border-2', 'ping');
                ping.style.width = `${pingSize}px`;
                ping.style.height = `${pingSize}px`;
                ping.style.left = `${pingX}px`;
                ping.style.top = `${pingY}px`;
                ping.style.backgroundColor = json['player_color'];
                ping.style.color = json['player_color'];
                ping.style.borderColor = json['player_color'];

                this.$refs.questionBubbleScreen.appendChild(ping);

                Array.from(document.getElementsByClassName('question-bubble-container')).every(el => {
                    let rect = el.getBoundingClientRect();
                    if
                    (
                        pingX + pingSize > rect.x &&
                        pingX - pingSize < rect.x + rect.width &&
                        pingY + pingSize > rect.y &&
                        pingY - pingSize < rect.y + rect.height &&
                        !el.classList.contains('bubble-burst')
                    ) {
                        let question_id = el.getAttribute('data-question-id')
                        // console.log('Collision detected for ' + el.getAttribute('data-question-id'));

                        el.classList.add('bubble-burst');
                        setTimeout(() => {
                            el.remove()
                        }, 300);

                        this.socket.emit('player-pop-question', {
                            game_id: this.gameState['id'],
                            player_id: json["player_id"],
                            question: this.gameState['questions'][question_id],
                        });

                        return false;
                    }
                    return true;
                });

                // REMOVE PING
                ping.classList.add('bubble-burst');
                setTimeout(() => {
                    ping.remove();
                }, 300);
            })
            this.socket.on('player-receive-question', json => {
                if (this.gameCreator || this.player['id'] != json['player_id']) {
                    return
                }
                json['question']['is_answered'] = false;
                console.log(json);
                this.selectedQuestion = json['question'];
                this.$refs.modalQuestion.showModal();
            })
            this.socket.on('player-answered-question', json => {
                if (!this.gameCreator) {
                    return;
                }
                let player_id = json['player_id'];
                console.log(this.players);
                console.log(this.players[player_id])
                if (json['question']['is_correct']) {
                    this.players[this.players.findIndex(el => el['id'] == player_id)]['score'] += this.scoring[json['question']['difficulty']];
                } else {
                    this.players[this.players.findIndex(el => el['id'] == player_id)]['score']--;
                }
            })
            this.socket.on('end-round', json => {
                // TODO make sure anything else that needs to happen on round end happens
                this.$refs.modalQuestion.close();
            })
        },
        // SOCKET EMITTING GAME FUNCTIONS
        createNewPlayer() {
            this.loading = true;
            this.socket.emit('create-new-player', this.player);
        },
        createNewGame() {
            // TODO validate game
            this.loading = true;
            this.socket.emit('create-new-game', this.newGame);
        },
        joinGame(game, password=false) {
            if (game.password && !password) {
                this.$refs.modalGamePassword.showModal();
                return;
            }

            let data = {
                game_id: this.game.id,
                player_id: this.player.id,
                password: this.gamePassword
            }

            this.socket.emit('request-game-join', data);
        },
        startGame() {
            this.socket.emit('request-game-start', {
                game_id: this.gameState['id'],
            })
        },
        async executeRound() {
            // INCREMENT ROUND
            // TODO play round sound
            this.gameState['current_round']++;
            this.players.forEach(el => el.previous_score = el.score);
            let finalRound = this.gameState['current_round'] == this.gameState['rounds'];
            this.roundText = finalRound ? 'Final Round' : `Round ${pad(this.gameState['current_round'], 2)}`
        
            // TODO get questions
            let attempts = 0;
            while(true) {
                await sleep(1000)
                fetchResult = await fetch('https://opentdb.com/api.php?amount=50&type=boolean');
                if (!fetchResult.ok) {
                    attempts++;
                    console.log(`Failed ${attempts} in first loop.`)
                    await sleep(1000);
                    if (attempts == 3) {
                        alert("Something went wrong with the trivia. I'm sorry.")
                    }
                    continue;
                }
                let results = await fetchResult.json();

                if(!results.hasOwnProperty('results')) {
                    console.log('No results');
                    continue;
                }

                results['results'].forEach(el => {
                    let newId = getID();
                    el['locked'] = false;
                    el['id'] = newId;
                    this.gameState['questions'][newId] = el;
                });

                break;
            }
            attempts = 0;
            while(true) {
                await sleep(1000);
                fetchResult = await fetch('https://opentdb.com/api.php?amount=50&type=boolean');
                if (!fetchResult.ok) {
                    attempts++;
                    console.log(`Failed ${attempts} in second loop.`)
                    await sleep(1000);
                    if (attempts == 3) {
                        alert("Something went wrong with the trivia. I'm sorry.")
                    }
                    continue;
                }
                let results = await fetchResult.json();

                if(!results.hasOwnProperty('results')) {
                    continue;
                }

                results['results'].forEach(el => {
                    let newId = getID();
                    el['locked'] = false;
                    el['id'] = newId;
                    this.gameState['questions'][newId] = el;
                });

                break;
            }
            
            // COUNTDOWN TIMER
            // TODO play sounds
            await sleep(1000);
            this.roundText = '3';
            await sleep(1000);
            this.roundText = '2';
            await sleep(1000);
            this.roundText = '1';
            await sleep(1000);

            // START ROUND
            this.gameState['timer'] = this.gameState['round_duration'];
            this.gameState['round_start'] = true;
            let questionValues = Object.values(this.gameState['questions']);
            this.bubbleCreationInterval = setInterval(() => {
                this.createQuestionBubble(questionValues[Math.floor(Math.random() * questionValues.length)])
                // TODO make bubble creation rate 
            }, 1000);
            this.bubbleMovementInterval = setInterval(() => {
                this.bubbleMovementIterations++;
                Array.from(document.getElementsByClassName('question-bubble-container')).forEach(el => {
                    // move the bubble
                    let velX = el.getAttribute('data-velocity-x');
                    let velY = el.getAttribute('data-velocity-y');
                    let initIteration = Number.parseInt(el.getAttribute('data-init-iteration'))
                    el.style.transform = `translate(${velX * (this.bubbleMovementIterations - initIteration)}px, ${velY * (this.bubbleMovementIterations - initIteration)}px)`
                
                    // if out of bounds, remove
                    let rect = el.getBoundingClientRect();
                    if 
                    (
                        rect.x < 0 - rect.width * 1.25 ||
                        rect.y < 0 - rect.height * 1.25 ||
                        rect.x > window.innerWidth + rect.width * 1.25 ||
                        rect.y > window.innerHeight + rect.width * 1.25
                    ) {
                        el.classList.add('slow-fade');
                        setTimeout(() => {
                            el.remove();
                        }, 2000);
                    }
                })
            }, 100)
            while(this.gameState['timer'] != 0) {
                await sleep(1000);
                this.gameState['timer']--;

                if (this.gameState['timer'] % 5 === 0) {
                    // TODO get more questions
                }
            }

            // STOP ROUND
            this.gameState['round_start'] = false;
            Array.from(document.getElementsByClassName('question-bubble-container')).forEach(async (el) => {
                await sleep(200)
                el.classList.add('bubble-burst');
                setTimeout(() => {
                    el.remove()
                }, 300);
            });
            this.bubbleMovementInterval = null;
            this.bubbleCreationInterval = null;
            this.bubbleMovementInterval = null;
            this.bubbleMovementIterations = 0;
            this.socket.emit('request-end-round', {
                game_id: this.gameState['id'],
            });
            console.log(this.players);


            // TODO play sound
            // TODO make this text random from an array of options
            this.roundText = finalRound ? 'Game Over!' : this.roundOverPhrases[Math.floor(Math.random() * this.roundOverPhrases.length)];

            await sleep(3000);
            
            // IF FINAL ROUND, FINAL ROUND SCREEN
            // SHOW POINTS AND WINNER
            // EMIT TO ALL CONNECTED DEVICES TO DISCONNECT AND REMOVE GAME
            if (finalRound) {
                this.roundText = 'And the bubbliest friend of them all is...';

                await sleep(3000);

                // TODO plays sound

                let winner = this.players.sort((a, b) => b.score - a.score)[0]

                this.roundText = `${winner.name}!!!`

                this.socket.emit('complete-game', {
                    game_id: this.gameState['id'],
                })

                await sleep(3000);

                this.$refs.modalScores.showModal();

                await sleep(10000);

                this.$refs.modalScores.close();

                await sleep(1000);

                this.roundText = `Congratulations, ${winner.name}! You're the bubbliest!`;

                await sleep(3000);

                this.gameState['finished'] = true;

                return;
            }

            // ELSE SHOW POINTS (DISPLAY )
            // list player current scores
            // update the scores
            // resort in fancy animation
            // modal who is in the lead, unless 
            // reexecute round

            // SHOW SCORES
            this.$refs.modalScores.showModal();

            await sleep(5000);

            this.$refs.modalScores.close();

            await sleep(1000);

            this.executeRound();
        },
        answerQuestion(ans) {
            this.selectedQuestion['given_answer'] = ans;
            this.selectedQuestion['is_answered'] = true;
            this.selectedQuestion['is_correct'] = this.selectedQuestion['given_answer'] == this.selectedQuestion['correct_answer'];
            let cooldown = this.selectedQuestion['is_correct'] ? 500 : 3000;
            this.socket.emit('player-answer-question', {
                game_id: this.gameState['id'],
                player_id: this.player['id'],
                question: this.selectedQuestion,
            });
            let r = this.$refs;
            setTimeout(() => {
                r.modalQuestion.close();
            }, cooldown);
        },
        async resetGame() {
            this.loading = true;
            this.setCurrentScene('loading')
            this.gameState = null,
            this.player = {
                name: '',
            }
            this.players = {}
            this.newGame = {
                name: '',
                rounds: 3,
                round_duration: 60,
                max_players: 20,
                bubble_speed: 200,
                bubble_summon: 1000,
            },

            this.gameCreator = false
        
            this.gameListFetchInterval = null
            this.gamePassword = ''

            this.inLobby = false
            this.lobbyFetchInterval = null

            this.bubbleCreationInterval = null
            this.bubbleMovementInterval = null
            this.bubbleMovementIterations = 0

            await sleep(1000)

            this.setCurrentScene('home');
        },
        // LOCAL STATE GAME FUNCTIONS
        // SCENE FUNCTIONS
        setCurrentScene(name) {
            this.scene = name;
            console.log('Current screen: ' + this.getCurrentScene());
            localStorage.setItem('currentScreen', name);
        },
        getCurrentScene() {
            return this.scene;
        },
        isCurrentScene(name) {
            return name === this.scene;
        },
        isCurrentSceneAny(names) {
            return names.includes(this.scene);
        },
        sendClick(event) {
            let xRatio = event.clientX / window.innerWidth;
            let yRatio = event.clientY / window.innerHeight;

            this.socket.emit('player-tap', {
                game_id: this.gameState['id'],
                player_id: this.player['id'],
                player_color: this.player['color'],
                xRatio: xRatio,
                yRatio: yRatio,
            })
        },
        createQuestionBubble(question) {
            // Check if game state exists and round has started
            if (!this.gameState || !this.gameState['round_start']) {
                return
            }
            // Check if there are too many bubbles
            if (Array.from(document.getElementsByClassName('question-bubble-container')) > 40) {
                return
            }
            let newBubbleContainer = document.createElement('div')
            let newBubble = document.createElement('div')

            newBubble.classList.add('bubble', 'pulse-small', 'question-bubble');

            let divisor;
            switch(question['difficulty']) {
                case 'easy':
                    divisor = 32;
                    break;
                case 'medium':
                    divisor = 16;
                    break;
                case 'hard':
                    divisor = 8;
                    break;
                default:
                    console.error('Question does not have difficulty for divisor in createQuestionBubble')
                    divisor = 16;
            }

            let size = Math.floor(window.innerWidth / divisor * Math.max(0.75, Math.random()))
            newBubble.style.width=`${size}px`;
            newBubble.style.height=`${size}px`;

            // TODO make velocity scaling a game setting
            let velocityScale = 10;
            let velocityX = (Math.random() - 0.5) * velocityScale;
            let velocityY = (Math.random() - 0.5) * velocityScale;
            let spawnX = (Math.random() * (window.innerWidth * 0.95));
            let spawnY = (Math.random() * (window.innerHeight * 0.95));

            newBubbleContainer.classList.add('absolute', 'opacity-0', 'question-bubble-container', 'transition', 'duration-100');
            newBubbleContainer.setAttribute('data-velocity-x', velocityX);
            newBubbleContainer.setAttribute('data-velocity-y', velocityY);
            newBubbleContainer.setAttribute('data-init-iteration', this.bubbleMovementIterations);
            newBubbleContainer.setAttribute('data-question-id', question['id']);
            newBubbleContainer.style.left = `${spawnX}px`;
            newBubbleContainer.style.top = `${spawnY}px`;

            newBubbleContainer.style.opacity = '0';
            newBubbleContainer.appendChild(newBubble);
            this.$refs.questionBubbleScreen.appendChild(newBubbleContainer);
            newBubbleContainer.classList.add('slow-reveal');
        },
        // SOUND FUNCTIONS
        playSound(sound, loop=false, volume=1.0) {
            if (!this.canPlayAudio) {
                return
            }
            if (!this.audioEngine[sound].paused) {
                this.audioEngine[sound].pause()
            }
            try {
                this.audioEngine[sound].loop = loop
                this.audioEngine[sound].volume = volume
                this.audioEngine[sound].currentTime = 0
                let playing = false;
                while (!this.audioEngine[sound].paused) {

                }
                this.audioEngine[sound].play()
            } catch(err) {
                console.log(err)
            }
        },
        stopAllSound() {
            for (sound of Object.values(this.audioEngine)) {
                sound.pause()
                sound.currentTime = 0
            }
        },
    }))
})

Alpine.start();