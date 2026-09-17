/** Browser-only Storytime reader. Web Speech + tiny Web Audio SFX. No cloud. */

import { type NarrationCue, type SfxKind, type VoiceRole, voiceHint } from "./narrate";

let ctx: AudioContext | null = null;
let stopped = false;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(ac: AudioContext, seconds: number): AudioBufferSourceNode {
  const n = Math.max(1, Math.floor(ac.sampleRate * seconds));
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

export function playSfx(kind: SfxKind, gain = 0.22): Promise<void> {
  const ac = audio();
  if (!ac) return Promise.resolve();
  const master = ac.createGain();
  master.gain.value = gain;
  master.connect(ac.destination);
  const now = ac.currentTime;

  if (kind === "rain" || kind === "wind" || kind === "crowd" || kind === "water") {
    const src = noise(ac, kind === "rain" ? 1.4 : 1.1);
    const f = ac.createBiquadFilter();
    f.type = kind === "water" ? "lowpass" : "bandpass";
    f.frequency.value = kind === "rain" ? 1800 : kind === "wind" ? 700 : kind === "water" ? 400 : 900;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(kind === "crowd" ? 0.18 : 0.28, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "rain" ? 1.4 : 1.1));
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(now);
    src.stop(now + 1.5);
  } else if (kind === "thunder" || kind === "boom") {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(kind === "boom" ? 90 : 70, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.6);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.4, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.72);
    const n = noise(ac, 0.5);
    const nf = ac.createBiquadFilter();
    nf.type = "lowpass";
    nf.frequency.value = 200;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.25, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(master);
    n.start(now);
    n.stop(now + 0.52);
  } else if (kind === "steel" || kind === "slap") {
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(kind === "slap" ? 220 : 1400, now);
    osc.frequency.exponentialRampToValueAtTime(kind === "slap" ? 80 : 400, now + 0.12);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (kind === "steps" || kind === "door") {
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(kind === "door" ? 90 : 140, now);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (kind === "fire") {
    const src = noise(ac, 0.9);
    const f = ac.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 800;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(now);
    src.stop(now + 0.92);
  } else if (kind === "moan" || kind === "kiss" || kind === "scream") {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(kind === "scream" ? 620 : kind === "kiss" ? 380 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(kind === "scream" ? 880 : 180, now + 0.35);
    const g = ac.createGain();
    g.gain.setValueAtTime(kind === "scream" ? 0.16 : 0.1, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  return new Promise((res) => setTimeout(res, kind === "rain" || kind === "wind" ? 420 : 220));
}

export function pickVoice(
  role: VoiceRole,
  voices: SpeechSynthesisVoice[],
  narratorURI?: string,
): SpeechSynthesisVoice | undefined {
  const hint = voiceHint(role);
  if (role === "narrator" && narratorURI) {
    const named = voices.find((v) => v.voiceURI === narratorURI);
    if (named) return named;
  }
  const prefer = voices.filter((v) => hint.prefer.test(`${v.name} ${v.voiceURI}`));
  const pool = prefer.length ? prefer : voices;
  if (role === "female") return pool[0] || voices[0];
  if (role === "male") return pool[pool.length - 1] || voices[0];
  if (role === "creature") return pool[pool.length - 1] || voices[0];
  return pool[0] || voices[0];
}

export function stopNarration() {
  stopped = true;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export function speakCue(
  cue: NarrationCue,
  voices: SpeechSynthesisVoice[],
  narratorURI?: string,
): Promise<void> {
  if (cue.kind !== "speak" || typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  const hint = voiceHint(cue.role);
  const voice = pickVoice(cue.role, voices, narratorURI);
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(cue.text);
    if (voice) u.voice = voice;
    u.rate = hint.rate;
    u.pitch = hint.pitch;
    u.volume = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export async function playNarration(
  cues: NarrationCue[],
  opts: {
    voices: SpeechSynthesisVoice[];
    narratorURI?: string;
    onCue?: (c: NarrationCue, i: number) => void;
  },
): Promise<void> {
  stopped = false;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
  for (let i = 0; i < cues.length; i++) {
    if (stopped) return;
    const c = cues[i]!;
    opts.onCue?.(c, i);
    if (c.kind === "sfx" && c.sfx) {
      await playSfx(c.sfx);
    } else {
      await speakCue(c, opts.voices, opts.narratorURI);
    }
  }
}
