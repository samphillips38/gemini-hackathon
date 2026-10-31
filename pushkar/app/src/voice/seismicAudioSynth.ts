"use client";

/**
 * WebAudio P-Wave / S-Wave Seismic Synthesizer & Emergency Alert Sound Engine
 * Zero external audio assets required — 100% deterministic browser WebAudio synthesis.
 */

export interface SeismicWaveTelemetry {
  pWaveFreqHz: number;
  sWaveFreqHz: number;
  pgaG: number;
  durationS: number;
}

class SeismicAudioEngine {
  private ctx: AudioContext | null = null;
  private activeNodes: AudioNode[] = [];
  private activeTimers: number[] = [];

  private getContext(): AudioContext | null {
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

  public stopAll(): void {
    for (const timer of this.activeTimers) {
      window.clearTimeout(timer);
    }
    this.activeTimers = [];

    for (const node of this.activeNodes) {
      try {
        if ("stop" in node && typeof (node as AudioScheduledSourceNode).stop === "function") {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    }
    this.activeNodes = [];
  }

  /**
   * Synthesizes a realistic 2-stage seismic waveform:
   * - Stage 1 (0.0s -> 1.1s): P-wave compressional arrival (sharp 55-80Hz thud + high-frequency rattle)
   * - Stage 2 (1.1s -> durationS): S-wave shear arrival (deep 24-42Hz structural bass rumble + filtered noise + glass/frame clatter)
   */
  public playSeismicPAndSWave(pgaG = 0.42, durationS = 3.2): SeismicWaveTelemetry {
    const ctx = this.getContext();
    const telemetry: SeismicWaveTelemetry = {
      pWaveFreqHz: 68,
      sWaveFreqHz: 31,
      pgaG,
      durationS,
    };
    if (!ctx) return telemetry;

    this.stopAll();
    const now = ctx.currentTime;
    const intensity = Math.min(1.0, Math.max(0.25, pgaG / 0.6));

    // Master compressor & gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.01, now);
    masterGain.gain.linearRampToValueAtTime(0.45 * intensity, now + 0.08);
    masterGain.gain.setValueAtTime(0.32 * intensity, now + 0.9);
    // S-wave surge at t = 1.05s
    masterGain.gain.linearRampToValueAtTime(0.85 * intensity, now + 1.25);
    masterGain.gain.exponentialRampToValueAtTime(0.008, now + durationS);
    masterGain.connect(ctx.destination);
    this.activeNodes.push(masterGain);

    // 1. P-Wave Compressional Oscillator (68Hz -> 46Hz)
    const pOsc = ctx.createOscillator();
    const pGain = ctx.createGain();
    pOsc.type = "triangle";
    pOsc.frequency.setValueAtTime(68, now);
    pOsc.frequency.exponentialRampToValueAtTime(44, now + 1.0);

    pGain.gain.setValueAtTime(0.6, now);
    pGain.gain.exponentialRampToValueAtTime(0.05, now + 1.05);

    pOsc.connect(pGain);
    pGain.connect(masterGain);
    pOsc.start(now);
    pOsc.stop(now + 1.1);
    this.activeNodes.push(pOsc, pGain);

    // 2. S-Wave Shear Sub-Bass Oscillator (31Hz -> 24Hz with FM wobble)
    const sOsc = ctx.createOscillator();
    const sLfo = ctx.createOscillator();
    const sLfoGain = ctx.createGain();
    const sGain = ctx.createGain();

    sOsc.type = "sawtooth";
    sOsc.frequency.setValueAtTime(31, now + 1.0);
    sOsc.frequency.linearRampToValueAtTime(25, now + durationS);

    sLfo.type = "sine";
    sLfo.frequency.setValueAtTime(6.5, now + 1.0);
    sLfoGain.gain.setValueAtTime(9, now + 1.0);

    sGain.gain.setValueAtTime(0.001, now);
    sGain.gain.setValueAtTime(0.01, now + 0.95);
    sGain.gain.linearRampToValueAtTime(0.75, now + 1.25);
    sGain.gain.exponentialRampToValueAtTime(0.01, now + durationS);

    sLfo.connect(sLfoGain);
    sLfoGain.connect(sOsc.frequency);
    sOsc.connect(sGain);
    sGain.connect(masterGain);

    sLfo.start(now + 0.95);
    sOsc.start(now + 0.95);
    sLfo.stop(now + durationS);
    sOsc.stop(now + durationS);
    this.activeNodes.push(sOsc, sLfo, sLfoGain, sGain);

    // 3. Filtered Brown/Pink Noise Buffer for Structural Rattle & Overturning Debris
    const bufferSize = Math.floor(ctx.sampleRate * durationS);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.04 * white) / 1.04;
      lastOut = output[i];
      output[i] *= 2.8;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(95, now);
    bandpass.frequency.linearRampToValueAtTime(62, now + 1.2);
    bandpass.Q.setValueAtTime(1.4, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, now);
    noiseGain.gain.linearRampToValueAtTime(0.65, now + 1.3);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + durationS);

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSource.start(now);
    noiseSource.stop(now + durationS);
    this.activeNodes.push(noiseSource, bandpass, noiseGain);

    return telemetry;
  }

  /**
   * Plays a sharp deterministic Lift Lockout Override klaxon (two-tone warning siren)
   */
  public playLiftLockoutSiren(durationS = 1.4): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    // Alternating urgent 880Hz / 620Hz klaxon
    const steps = 6;
    const stepDur = durationS / steps;
    for (let i = 0; i < steps; i++) {
      osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 620, now + i * stepDur);
    }

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + durationS);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationS);
    this.activeNodes.push(osc, gain);
  }

  /**
   * Plays a clean verification chime when remediation / safe route passes
   */
  public playVerificationPassChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now + idx * 0.09);
      gain.gain.setValueAtTime(0.14, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.46);
      this.activeNodes.push(osc, gain);
    });
  }
}

export const seismicAudio = new SeismicAudioEngine();
