// All sound in Solara Bay is synthesized live with WebAudio: no audio files.
// Engine hum, skids, gunshots, punches, a two-tone police siren, and a looping
// synthwave pad + bass groove in A minor. Nothing starts until the player
// presses a button (the browser's autoplay rule), so createAudio is safe to
// build before the first gesture. The pad stays in A minor so the engine hum
// of a sunset cruise in the Vanta GT never clashes with the music.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicOn = true;
  let musicTimer = null;
  let stepIndex = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45; // headroom: siren + engine + music stack up
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 25;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: one triangle that alternates 700 / 950 Hz.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function noiseBurst(duration, filterFreq, volume, type = 'bandpass') {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  // Chord pad + bass + hat groove, 8 steps a bar at 112 BPM, A minor.
  const CHORDS = [
    [220.0, 261.6, 329.6], [174.6, 220.0, 261.6],
    [196.0, 246.9, 293.7], [164.8, 196.0, 246.9],
  ];
  const BASS = [55.0, 43.7, 49.0, 41.2];
  function musicStep() {
    if (!ctx || !musicOn) return;
    const bar = Math.floor(stepIndex / 8) % 4;
    const beat = stepIndex % 8;
    if (beat === 0) {
      for (const f of CHORDS[bar]) tone(f, 1.7, 'sawtooth', 0.045);
      tone(CHORDS[bar][0] / 2, 1.7, 'triangle', 0.06);
    }
    if (beat % 2 === 0) tone(BASS[bar], 0.4, 'square', 0.09);
    if (beat % 2 === 1) noiseBurst(0.03, 8000, 0.05, 'highpass');
    stepIndex += 1;
  }

  function startMusic() {
    if (musicTimer || !ctx) return;
    musicTimer = window.setInterval(musicStep, 268); // 8th note at ~112 BPM
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    get ready() { return !!ctx; },
    toggleMusic() {
      musicOn = !musicOn;
      if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
      if (musicOn) startMusic();
      return musicOn;
    },
    setEngine(speed01, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + speed01 * 0.11 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      const freq = 46 + speed01 * 150;
      engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.06);
      engineOsc2.frequency.setTargetAtTime(freq * 0.5, ctx.currentTime, 0.06);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime(
        (Math.floor(ctx.currentTime * 2) % 2 === 0) ? 700 : 950, ctx.currentTime, 0.05);
    },
    skid() { noiseBurst(0.18, 900, 0.12); },
    shot() { noiseBurst(0.12, 1800, 0.5); tone(160, 0.1, 'sine', 0.4, 60); },
    distantShot() { noiseBurst(0.1, 900, 0.12); },
    punch() { noiseBurst(0.08, 300, 0.4, 'lowpass'); tone(90, 0.08, 'sine', 0.3, 50); },
    explosion() { noiseBurst(0.7, 220, 0.7, 'lowpass'); tone(70, 0.6, 'sine', 0.5, 30); },
    click() { tone(1200, 0.05, 'square', 0.08); },
    cash() { tone(880, 0.09, 'sine', 0.15); setTimeout(() => tone(1320, 0.14, 'sine', 0.15), 90); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.16), i * 110)); },
    missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.1), i * 140)); },
    busted() { tone(220, 0.5, 'sawtooth', 0.15, 110); },
    doorSlam() { noiseBurst(0.09, 400, 0.35, 'lowpass'); },
    steal() { tone(660, 0.08, 'square', 0.1); setTimeout(() => tone(880, 0.1, 'square', 0.1), 90); },
  };
}
