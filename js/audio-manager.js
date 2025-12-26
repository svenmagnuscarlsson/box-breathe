/**
 * AudioManager.js
 * 
 * Ansvarar för ljudupplevelsen. 
 * Använder Web Audio API för att generera mjuka toner (syntetisering) 
 * istället för att ladda tunga mp3-filer. Detta ger en mer "organisk" känsla.
 */

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.isEnabled = true; // Användaren kan stänga av ljud
        this.masterGain = null;
    }

    /**
     * Initierar ljudmotorn. Måste kallas efter en användarinteraktion (klick)
     * eftersom webbläsare blockerar autospelande ljud.
     */
    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Skapa en Master Gain Node för att kontrollera volym globalt
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5; // 50% volym
            this.masterGain.connect(this.ctx.destination);
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    /**
     * Spelar upp en mjuk "Gong" eller ton vid fasbyte.
     * @param {string} type - 'high' (Inhale start) eller 'low' (Exhale/Hold)
     */
    playPhaseCue(type) {
        if (!this.isEnabled || !this.ctx) return;

        // Skapa oscillatorer för ett fylligare ljud
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Koppla: Osc -> Filter -> Gain -> Master
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Konfigurera ljudet för en mjuk "Ambient Bell" karaktär
        // Använd sinusvåg för mjukhet
        osc.type = 'sine';

        // Frekvens baserat på typ av cue
        // Inhale = lite ljusare, Exhale = djupare
        const freq = type === 'inhale' ? 220 : 146.83; // A3 vs D3
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Liten pitch-drop för att ge ljudet karaktär ("bloomp")
        osc.frequency.exponentialRampToValueAtTime(freq * 0.98, this.ctx.currentTime + 1.5);

        // Low-pass filter för att ta bort vasshet
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        // Envelope (Volymkurva): Attack -> Decay
        const now = this.ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1); // Mjuk attack (100ms)
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2.0); // Lång svans (2s)

        osc.start(now);
        osc.stop(now + 2.5); // Städa upp oscillatorn efter ljudet
    }

    toggleSound(enabled) {
        this.isEnabled = enabled;
    }
}
