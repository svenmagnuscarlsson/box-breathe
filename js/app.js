import { BoxModel } from './model.js';
import { BoxView } from './view.js';
import { AudioManager } from './audio-manager.js';

/**
 * App.js
 * 
 * Huvudkontroller. Binder ihop Model, View och Audio.
 * Hanterar även Wake Lock API för att hålla skärmen tänd.
 */

class App {
    constructor() {
        this.model = new BoxModel();
        this.view = new BoxView();
        this.audio = new AudioManager();

        this.wakeLock = null;
        this.animationFrameId = null;

        this._initEventListeners();

        // Initial rendrering - använd hjälpmetod för att inkludera settings
        this.view.render(this._getViewState());
    }

    /**
     * Skapar ett kombinerat objekt med både state och settings för vyn.
     * Vyn behöver båda för att kunna visa korrekt information.
     */
    _getViewState() {
        return {
            ...this.model.state,
            settings: this.model.settings
        };
    }

    _initEventListeners() {
        // Play/Pause knapp
        this.view.els.btnPlayPause.addEventListener('click', () => {
            this.togglePlayPause();
        });

        // Stopp knapp
        this.view.els.btnStop.addEventListener('click', () => {
            this.stopSession();
        });

        // Haptik toggle
        this.view.els.btnHaptics.addEventListener('click', () => {
            const newState = !this.view.hapticsEnabled;
            this.view.toggleHaptics(newState);
        });

        // Inställningar (Placeholder för nu)
        document.getElementById('btn-settings').addEventListener('click', () => {
            alert("Inställningar kommer i nästa version! Här kan du ändra andningstider.");
        });

        // Hantera visibilitet (om användaren byter flik)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.model.state.isActive) {
                this._requestWakeLock();
            }
        });
    }

    /**
     * Växla mellan Play och Pause
     * Hanterar även Audio Context och Wake Lock.
     */
    async togglePlayPause() {
        // Vi måste initiera ljudet vid första klicket
        this.audio.init();

        if (this.model.state.isActive) {
            // PAUSA
            this.model.pause();
            this.view.setPlaying(false);
            this._releaseWakeLock();
        } else {
            // STARTA / FORTSÄTT
            this.model.start();
            this.view.setPlaying(true);
            await this._requestWakeLock();

            // Starta loopen
            this._loop();
        }

        this.view.render(this._getViewState());
    }

    stopSession() {
        this.model.stop();
        this.view.setPlaying(false);
        this._releaseWakeLock();
        this.view.render(this._getViewState());

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    /**
     * Den magiska loopen. Körs varje skärmuppdatering (ca 60fps).
     */
    _loop() {
        if (!this.model.state.isActive) return;

        const now = Date.now();

        // Spara gammal fas för att upptäcka byten
        const previousPhase = this.model.state.currentPhase;
        const previousSeconds = Math.ceil(this.model.state.phaseTimeRemaining); // Heltal

        // Uppdatera logiken
        const shouldRender = this.model.update(now);

        // Kolla om fasen byttes
        if (this.model.state.currentPhase !== previousPhase) {
            // Fasbyte! 
            this.view.triggerHaptic('phase');

            // Spela passande ljud
            if (this.model.state.currentPhase === 'inhale') {
                this.audio.playPhaseCue('inhale');
            } else {
                this.audio.playPhaseCue('exhale'); // Använd samma för exhale/hold för enkelhetens skull, eller variera
            }
        }
        // Kolla om en sekund passerade (för mildare tick-haptik)
        else {
            const currentSeconds = Math.ceil(this.model.state.phaseTimeRemaining);
            if (currentSeconds !== previousSeconds) {
                this.view.triggerHaptic('tick');
            }
        }

        // Rendera bara om det behövs (Model säger till)
        if (shouldRender) {
            this.view.render(this._getViewState());
        }

        // Fortsätt loopen om vi fortfarande är aktiva
        if (this.model.state.isActive) {
            this.animationFrameId = requestAnimationFrame(() => this._loop());
        } else {
            // Om modellen säger att vi är klara (tid slut)
            if (this.model.state.sessionTimeRemaining <= 0) {
                this.view.setPlaying(false);
                this._releaseWakeLock();
                // Kanske visa en "Klar!" dialog här?
                alert("Bra jobbat! Sessionen är klar.");
            }
        }
    }

    /**
     * Begär att skärmen ska hållas tänd.
     */
    async _requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock active');
            } catch (err) {
                console.error(`Wake Lock failed: ${err.name}, ${err.message}`);
            }
        }
    }

    _releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
            console.log('Wake Lock released');
        }
    }
}

// Starta appen när DOM är redo
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();

    // Registrera Service Worker för PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker registrerad'))
            .catch(err => console.log('Service Worker fel:', err));
    }
});
