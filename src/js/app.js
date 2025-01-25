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
        newGame: {
            name: '',
            rounds: 3,
            round_duration: 120,
            max_players: 20,
        },
        newGameErrorMessage: '',
        gameCreator: false,
        
        gameList: [],
        gameListFetchInterval: null,
        gamePassword: '',

        inLobby: false,
        lobbyFetchInterval: null,

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

                // CHECK PLAYER STATUS

                // SET ANY POLLING INTERVALS
                this.gameListFetchInterval = setInterval(() => {
                    this.socket.emit('request-game-list');
                }, 3000);

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
                this.setCurrentScene('home')
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
            })
            this.socket.on('game-creation-failed', json => {
                this.newGameErrorMessage = json.message;
                this.loading = false;
                console.log('Game creation failed');
            })
            this.socket.on('update-game-list', json => {
                this.gameList = json;
            })
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
            })
            this.socket.on('update-game-lobby', json => {
                this.gameState = json['game_state']
                this.gameState['players'] = json['players'];
                console.log(json)
            })
            // PLAYER CREATION
            // GAME CREATION
            this.socket.on('player-creation-successful', json => {
                this.player = json;
                console.log('Player creation successful');
                this.socket.emit('request-game-list');
                this.$refs.modalJoinGame.close();
                this.setCurrentScene('gameList');
                this.loading = false;
            })
            this.socket.on('game-creation-failed', json => {
                this.newPlayerErrorMessage = json.message;
                this.loading = false;
                console.log('Game creation failed');
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