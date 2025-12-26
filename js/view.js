import { BREATH_PHASES } from './model.js';

/**
 * View.js
 * 
 * Ansvarar för det visuella. Får state från Model och uppdaterar DOM.
 * Sköter animationer och text på svenska.
 */
export class BoxView {
    constructor() {
        // Cacha DOM-element för prestanda
        this.els = {
            timerDisplay: document.getElementById('timer-display'),
            instructionText: document.getElementById('instruction-text'),
            subInstruction: document.getElementById('sub-instruction-text'),
            breathingBox: document.getElementById('breathing-box'),
            progressTrack: document.getElementById('progress-track'),
            sessionProgressBar: document.getElementById('session-progress-bar'),
            sessionTimeLeft: document.getElementById('session-time-left'),
            glowEffect: document.getElementById('glow-effect'),
            phaseTextContainer: document.getElementById('phase-text-container'),

            // Knappar
            btnPlayPause: document.getElementById('btn-play-pause'),
            btnStop: document.getElementById('btn-stop'),
            btnHaptics: document.getElementById('btn-haptics'),

            // Ikoner
            iconPlayPause: document.getElementById('btn-play-pause').querySelector('span'),
            iconHaptics: document.getElementById('btn-haptics').querySelector('span'),
        };

        // Textkonfiguration på SVENSKA
        this.texts = {
            [BREATH_PHASES.INHALE]: {
                main: "Andas in",
                sub: "Fyll magen med luft",
                scale: 1.5 // Boxen växer
            },
            [BREATH_PHASES.HOLD_IN]: {
                main: "Håll andan",
                sub: "Slappna av i axlarna",
                scale: 1.5 // Boxen stannar stor
            },
            [BREATH_PHASES.EXHALE]: {
                main: "Andas ut",
                sub: "Töm lungorna helt",
                scale: 1.0 // Boxen krymper
            },
            [BREATH_PHASES.HOLD_OUT]: {
                main: "Vila",
                sub: "Vänta...",
                scale: 1.0 // Boxen stannar liten
            }
        };

        this.hapticsEnabled = true;
    }

    /**
     * Uppdaterar UI baserat på modellens state.
     * Denna funktion kallas 60 gånger per sekund via animationsloopen.
     */
    render(state) {
        if (!state.isActive) {
            this._renderIdle(state);
            return;
        }

        // 1. Uppdatera timer-text (sekunder kvar i fasen)
        // Visa heltal, avrunda uppåt så vi inte visar 0 för tidigt
        this.els.timerDisplay.textContent = Math.ceil(state.phaseTimeRemaining);

        // 2. Uppdatera instruktionstexter om fasen ändrats
        const config = this.texts[state.currentPhase];
        this.els.instructionText.textContent = config.main;
        this.els.subInstruction.textContent = config.sub;

        // 3. Uppdatera "ormen" (SVG Stroke Animation)
        // En box har omkrets ca 376px (4 * 94). Varje sida är 25% (0.25).
        // Vi vill animera stroke-dashoffset baserat på progress.
        // För att göra det snyggt måste vi veta VILKEN sida vi är på.

        // Förenklad animation: Låt en punkt åka runt hela varvet på 16 sekunder?
        // Nej, Box Breathing är distinkt: Upp, Höger, Ner, Vänster.
        // Faserna matchar sidorna.

        let sideOffset = 0; // 0 = Upp, 1 = Höger, 2 = Ner, 3 = Vänster (men roterat -90deg i CSS)
        // I CSS är roterat -90deg, så Top är start.
        // Inhale (Upp? Eller expansion). Låt oss visualisera "Fyller boxen".

        // Vi kör en enklare visuell representation för MVP:
        // Hela ramen lyses upp baserat på fasen.
        // Men för "orm"-effekten:
        const perimeter = 376; // Cirkus (94 * 4)
        const segmentLength = perimeter / 4;

        // Räkna ut vilken offset vi ska ha
        let phaseIndex = 0;
        switch (state.currentPhase) {
            case BREATH_PHASES.INHALE: phaseIndex = 0; break;
            case BREATH_PHASES.HOLD_IN: phaseIndex = 1; break;
            case BREATH_PHASES.EXHALE: phaseIndex = 2; break;
            case BREATH_PHASES.HOLD_OUT: phaseIndex = 3; break;
        }

        // Animera linjen
        // stroke-dasharray = "segmentLength totalLength"
        // Vi vill att linjen växer från 0 till segmentLength under fasen.
        const currentLength = segmentLength * state.cycleProgress;

        // Vi ritar bara ETT segment som rör sig? Eller fyller vi på?
        // Låt oss ge en "progress bar" effekt längs kanten.
        // Dasharray: [visible, gap]
        // Offset flyttar startpunkten.

        const totalOffset = phaseIndex * segmentLength;

        // Sätt dasharray så att bara "currentLen" syns, resten är gap.
        // Men vi vill att den ska fylla sidan.
        this.els.progressTrack.style.strokeDasharray = `${currentLength} ${perimeter}`;
        // Flytta startpunkten till rätt hörn minus hur mycket vi ritat (dashoffset funkar baklänges ibland)
        this.els.progressTrack.style.strokeDashoffset = -totalOffset;

        // 4. Andas-animation (Skala upp/ner)
        // Vi lerpar (interpolerar) skalan snyggt.
        // Inhale: 1.0 -> 1.5
        // Hold In: 1.5 -> 1.5
        // Exhale: 1.5 -> 1.0
        // Hold Out: 1.0 -> 1.0

        let targetScale = 1.0;
        let startScale = 1.0;

        if (state.currentPhase === BREATH_PHASES.INHALE) {
            startScale = 1.0; targetScale = 1.5;
        } else if (state.currentPhase === BREATH_PHASES.HOLD_IN) {
            startScale = 1.5; targetScale = 1.5;
        } else if (state.currentPhase === BREATH_PHASES.EXHALE) {
            startScale = 1.5; targetScale = 1.0;
        } else if (state.currentPhase === BREATH_PHASES.HOLD_OUT) {
            startScale = 1.0; targetScale = 1.0;
        }

        // Beräkna nuvarande skala baserat på cycleProgress
        const currentScale = startScale + (targetScale - startScale) * this._easeInOut(state.cycleProgress);
        this.els.breathingBox.style.transform = `scale(${currentScale})`;

        // 5. Total Session Progress
        const sessionProgressPct = ((state.settings.totalSessionSeconds - state.sessionTimeRemaining) / state.settings.totalSessionSeconds) * 100;
        this.els.sessionProgressBar.style.width = `${sessionProgressPct}%`;

        // Uppdatera tidssiffra i footer
        const mins = Math.floor(state.sessionTimeRemaining / 60);
        const secs = Math.floor(state.sessionTimeRemaining % 60);
        this.els.sessionTimeLeft.textContent = `${mins}:${secs.toString().padStart(2, '0')} kvar`;

        // 6. Glow effekt puls
        // Om Inhale -> Öka opacity/blur? Låt CSS sköta pulsen, men vi kan färga den?
        // (Redan hanterat via CSS animation 'pulse')
    }

    _renderIdle(state) {
        // Ensure settings exist before accessing (bug fix)
        const inhaleTime = state.settings ? state.settings.inhale : 4;

        this.els.timerDisplay.textContent = inhaleTime;
        this.els.instructionText.textContent = state.isPaused ? "Pausad" : "Redo?";
        this.els.subInstruction.textContent = state.isPaused ? "Tryck play för att fortsätta" : "Tryck på play för att börja";
        this.els.breathingBox.style.transform = 'scale(1.0)';
        this.els.sessionProgressBar.style.width = state.isPaused ? this.els.sessionProgressBar.style.width : '0%';

        // Visa play-ikonen
        this.els.iconPlayPause.textContent = "play_arrow";

        // Dimma stop-knappen om vi är helt stoppade
        if (!state.isPaused && !state.isActive) {
            this.els.btnStop.classList.add('opacity-50', 'pointer-events-none');
        } else {
            this.els.btnStop.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    setPlaying(isPlaying) {
        this.els.iconPlayPause.textContent = isPlaying ? "pause" : "play_arrow";
        // Aktivera stop-knappen visuellt
        if (isPlaying) {
            this.els.btnStop.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    triggerHaptic(type) {
        if (!this.hapticsEnabled || !navigator.vibrate) return;

        if (type === 'tick') {
            // Mjukt tick varje sekund
            navigator.vibrate(5);
        } else if (type === 'phase') {
            // Kraftigare vibration vid fasbyte
            navigator.vibrate([30, 30, 30]);
        }
    }

    toggleHaptics(enabled) {
        this.hapticsEnabled = enabled;
        this.els.btnHaptics.classList.toggle('text-slate-600', !enabled); // Grå om av
        this.els.btnHaptics.classList.toggle('text-primary', enabled);   // Blå om på

        // Ikon-byte valfritt, men färgbyte räcker ofta.
        // Vi kan stryka över ikonen om avstängd
        this.els.iconHaptics.textContent = enabled ? "vibration" : "smartphone";
    }

    // Easing funktion för mjukare animation (Sigmoid-ish)
    _easeInOut(t) {
        return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
}
