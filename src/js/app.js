import Alpine from "alpinejs";
import './utilities';

document.addEventListener('alpine:init', () => {
    Alpine.data('game', () => ({
        loading: true,
        scene: 'loading',
        socket: null,
        gameState: {
            player: {},
            map: {},
        },
        requestInterval: null,
        canPlayAudio: false,
        audioEngine: {
            bgmMain: new Audio('/static/mp3/bgm.mp3'),
        },
        async init() {
            // INITIALIZE SOCKET CONNECTION
            this.socket = io()

            // SOCKET ON CONNECT
            this.socket.on('connect', async () => {
                console.log('Socket connected')

                // CHECK PLAYER STATUS

                // SET ANY POLLING INTERVALS

                // INITIALIZE AUDIO
                window.addEventListener('mouseover', async () => {
                    if (this.canPlayAudio === false) {
                        this.canPlayAudio = true;
                        await(1000);
                        this.playSound('bgmMain', true, 0.75)
                    }
                })

                // CHANGE SCENE
                this.setCurrentScene('home')
            })

            // SOCKET GAME EVENTS
            this.socket.on('update-game-state', (json) => {
                this.updateGameState(json);
            })
        },
        // SOCKET EMITTING GAME FUNCTIONS
        createNewPlayer() {
            // GET PLAYER NAME

            // EMIT SOCKET CONNECTION

            // GO TO SOCKET EVENT AND SAVE LOCALLY
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