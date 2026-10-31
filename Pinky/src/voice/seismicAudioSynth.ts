// ============================================================================
// WebAudio P-Wave / S-Wave Seismic Rumble & Lift Lockout Siren Synthesizer
// Zero external audio files required — 100% procedural WebAudio API
// ============================================================================

export class SeismicAudioSynth {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Synthesizes a two-stage seismic waveform:
   * - 0.0s - 1.2s: Compressional P-wave (sharp 48Hz thump + rattle)
   * - 1.2s - duration: Shear S-wave (deep 24Hz-36Hz sub-bass rumble + structural creak)
   */
  public playSeismicRumble(magnitudeMw = 6.8, durationSec = 3.5): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const intensity = Math.min(1.0, Math.max(0.25, (magnitudeMw - 5.0) / 3.0));

    // Sub-bass oscillator (P-wave -> S-wave frequency drop)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sawtooth";
    subOsc.frequency.setValueAtTime(52, now);
    subOsc.frequency.exponentialRampToValueAtTime(26, now + 1.1);
    subOsc.frequency.setValueAtTime(31, now + 1.2);
    subOsc.frequency.exponentialRampToValueAtTime(19, now + durationSec);

    // Low-pass filter for visceral room shake
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(110, now);
    filter.Q.setValueAtTime(3.5, now);

    subGain.gain.setValueAtTime(0.01, now);
    subGain.gain.linearRampToValueAtTime(0.35 * intensity, now + 0.15);
    subGain.gain.setValueAtTime(0.22 * intensity, now + 1.0);
    // S-wave arrival peak
    subGain.gain.linearRampToValueAtTime(0.55 * intensity, now + 1.35);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    subOsc.connect(filter);
    filter.connect(subGain);
    subGain.connect(ctx.destination);

    subOsc.start(now);
    subOsc.stop(now + durationSec);
  }

  /**
   * Synthesizes an ISO-style dual-tone Lift Lockout / Evacuation Klaxon
   */
  public playLiftLockoutSiren(durationSec = 1.6): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(880, now + 0.25);
    osc.frequency.setValueAtTime(660, now + 0.5);
    osc.frequency.setValueAtTime(880, now + 0.75);
    osc.frequency.setValueAtTime(660, now + 1.0);
    osc.frequency.setValueAtTime(880, now + 1.25);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec);
  }
}

export const seismicAudio = new SeismicAudioSynth();
