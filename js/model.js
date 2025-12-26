/**
 * Model.js
 * 
 * Ansvarar för applikationens tillstånd (state) och logik.
 * Håller reda på timer, vilken fas vi befinner oss i, och sessionens totala tid.
 * Använder "Delta Time" för att garantera att tiden stämmer även om skärmen laggar.
 */

export const BREATH_PHASES = {
    INHALE: 'inhale',     // Andas in
    HOLD_IN: 'hold-in',   // Håll andan (inne)
    EXHALE: 'exhale',     // Andas ut
    HOLD_OUT: 'hold-out', // Vila (ute)
};

export class BoxModel {
    constructor() {
        // Grundinställningar (4-4-4-4 sekunder är standard för Box Breathing)
        this.settings = {
            inhale: 4,
            holdIn: 4,
            exhale: 4,
            holdOut: 4,
            totalSessionSeconds: 300 // 5 minuter
        };

        // Applikationens nuvarande tillstånd
        this.state = {
            isActive: false,        // Är sessionen igång?
            isPaused: false,        // Är sessionen pausad?
            currentPhase: BREATH_PHASES.INHALE,
            sessionTimeRemaining: 300, 
            phaseTimeRemaining: 4,
            totalProgress: 0,       // 0 till 1 (0% till 100% av hela sessionen)
            cycleProgress: 0        // 0 till 1 (hur långt in i nuvarande fas vi är)
        };

        // Interna variabler för klockslag (High Precision Timing)
        this._lastFrameTime = 0;
        this._phaseStartTime = 0;
        this._elapsedInPhase = 0;
    }

    /**
     * Startar sessionen.
     * Återställer tider om det är en ny session.
     */
    start() {
        if (!this.state.isPaused) {
            this._resetSession();
        }
        this.state.isActive = true;
        this.state.isPaused = false;
        this._lastFrameTime = Date.now();
    }

    /**
     * Pausar sessionen.
     */
    pause() {
        this.state.isActive = false;
        this.state.isPaused = true;
    }

    /**
     * Stoppar och nollställer sessionen helt.
     */
    stop() {
        this.state.isActive = false;
        this.state.isPaused = false;
        this._resetSession();
    }

    /**
     * Huvudloopen som uppdaterar state baserat på hur mycket tid som gått.
     * @param {number} currentTime - Nuvarande timestamp (Date.now())
     * @returns {boolean} - Returnerar true om något ändrades (dirty flag)
     */
    update(currentTime) {
        if (!this.state.isActive) return false;

        // Beräkna "delta" (hur många sekunder som gått sedan förra framen)
        const deltaTime = (currentTime - this._lastFrameTime) / 1000;
        this._lastFrameTime = currentTime;

        // Minska total tid
        this.state.sessionTimeRemaining = Math.max(0, this.state.sessionTimeRemaining - deltaTime);
        
        // Uppdatera fas-tid
        this._elapsedInPhase += deltaTime;
        
        // Hämta längden på nuvarande fas
        const currentPhaseDuration = this.getPhaseDuration(this.state.currentPhase);
        
        // Beräkna hur mycket tid som är kvar i denna fas
        this.state.phaseTimeRemaining = Math.max(0, currentPhaseDuration - this._elapsedInPhase);

        // Beräkna progress (0.0 till 1.0) för animationer
        this.state.cycleProgress = Math.min(1, this._elapsedInPhase / currentPhaseDuration);

        // Har tiden gått ut för denna fas? Byt isåfall till nästa.
        if (this._elapsedInPhase >= currentPhaseDuration) {
            this._advancePhase();
        }

        // Har sessionen tagit slut?
        if (this.state.sessionTimeRemaining <= 0) {
            this.stop();
            return true; // Returnera true för att trigga en "Session Complete" vy
        }

        return true;
    }

    /**
     * Byter till nästa fas i cykeln: In -> Hold -> Out -> Hold -> Repeat
     */
    _advancePhase() {
        this._elapsedInPhase = 0; // Nollställ tid i fasen
        
        switch (this.state.currentPhase) {
            case BREATH_PHASES.INHALE:
                this.state.currentPhase = BREATH_PHASES.HOLD_IN;
                break;
            case BREATH_PHASES.HOLD_IN:
                this.state.currentPhase = BREATH_PHASES.EXHALE;
                break;
            case BREATH_PHASES.EXHALE:
                this.state.currentPhase = BREATH_PHASES.HOLD_OUT;
                break;
            case BREATH_PHASES.HOLD_OUT:
                this.state.currentPhase = BREATH_PHASES.INHALE;
                break;
        }
    }

    _resetSession() {
        this.state.sessionTimeRemaining = this.settings.totalSessionSeconds;
        this.state.currentPhase = BREATH_PHASES.INHALE;
        this.state.phaseTimeRemaining = this.settings.inhale;
        this._elapsedInPhase = 0;
        this.state.cycleProgress = 0;
    }

    getPhaseDuration(phase) {
        switch (phase) {
            case BREATH_PHASES.INHALE: return this.settings.inhale;
            case BREATH_PHASES.HOLD_IN: return this.settings.holdIn;
            case BREATH_PHASES.EXHALE: return this.settings.exhale;
            case BREATH_PHASES.HOLD_OUT: return this.settings.holdOut;
            default: return 4;
        }
    }
}
