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
            round_duration: 120,
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

        audioEngine: {
            bgmMain: new Audio('/static/mp3/bgm.mp3'),
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
                        console.log('making a bubble')

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
                window.addEventListener('mouseover', async () => {
                    if (this.canPlayAudio === false) {
                        this.canPlayAudio = true;
                        await(1000);
                        // this.playSound('bgmMain', true, 0.75)
                    }
                })

                await sleep(1000);

                // CHANGE SCENE
                this.loading = false;
                this.setCurrentScene('home');
            })

            this.socket.on('disconnect', () => {
                // TODO remove player
                // TODO alert
                // TODO return to home
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
            this.roundText = this.gameState['current_round'] == this.gameState['rounds'] ? 'Final Round' : `Round ${pad(this.gameState['current_round'], 2)}`
        
            // TODO get questions

            // COUNTDOWN TIMER
            // TODO play sounds
            await sleep(3000);
            this.roundText = '3';
            await sleep(1000);
            this.roundText = '2';
            await sleep(1000);
            this.roundText = '1';
            await sleep(1000);

            // START ROUND
            this.gameState['timer'] = this.gameState['round_duration'];
            this.gameState['round_start'] = true;
            this.bubbleCreationInterval = setInterval(() => {
                this.createQuestionBubble({ difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)] })
                // TODO make bubble creation rate 
            }, 1000);
            this.bubbleMovementInterval = setInterval(() => {
                this.bubbleMovementIterations++;
                Array.from(document.getElementsByClassName('question-bubble-container')).forEach(el => {
                    // move the bubble
                    let velX = el.getAttribute('data-velocity-x');
                    let velY = el.getAttribute('data-velocity-y');
                    let initIteration = Number.parseInt(el.getAttribute('data-init-iteration'))
                    el.style.transform = `translate(${Math.floor(velX * (this.bubbleMovementIterations - initIteration))}px, ${Math.floor(velY * (this.bubbleMovementIterations - initIteration))}px)`
                
                    // if out of bounds, remove
                    let rect = el.getBoundingClientRect();
                    if 
                    (
                        rect.x < 0 - rect.width * 1.5 ||
                        rect.y < 0 - rect.height * 1.5 ||
                        rect.x > window.innerWidth + rect.width * 1.5 ||
                        rect.y > window.innerHeight + rect.width * 1.5
                    ) {
                        el.classList.add('slow-fade');
                        setTimeout(() => {
                            el.remove();
                        }, 2000);
                    }
                })
            }, 200)
            while(this.gameState['timer'] != 0) {
                await sleep(1000);
                this.gameState['timer']--;

                if (this.gameState['timer'] % 5 === 0) {
                    // TODO get more questions
                }
            }

            // STOP ROUND
            this.gameState['round_start'] = false;
            Array.from(document.getElementsByClassName('question-bubble-container')).forEach(el => el.remove());
            this.bubbleMovementInterval = null;
            this.bubbleCreationInterval = null;
            this.bubbleMovementInterval = null;
            this.bubbleMovementIterations = 0;
            
            // TODO play sound
            // TODO make this text random from an array of options
            this.roundText = 'Great job, bubble friends!';

            await sleep(1000);

            // TODO make this text random from an array of options
            this.roundText = "Let's see the scores!";

            await sleep(1000);

            // IF FINAL ROUND, FINAL ROUND SCREEN
            // SHOW POINTS AND WINNER
            // EMIT TO ALL CONNECTED DEVICES TO DISCONNECT AND REMOVE GAME

            // ELSE SHOW POINTS (DISPLAY )
            // list player current scores
            // update the scores
            // resort in fancy animation
            // modal who is in the lead, unless 
            // reexecute round
            this.executeRound();
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
        createQuestionBubble(question) {
            if (!this.gameState['round_start']) {
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