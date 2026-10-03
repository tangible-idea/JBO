// Synthesizes the whole Tidymark soundtrack in JavaScript — no samples.
// A 120 BPM bouncy bed (marimba, bass, drums) plus sound effects placed on the
// exact animation hits of each frame. Writes assets/audio/soundtrack.wav.
//
// Frame starts (seconds) come from the assembled timeline:
//   01 0 · 02 4.6 · 03 7.2 · 04 10.8 · 05 16.2 · 06 20.4 · 07 30.4 · 08 34.8 · 09 38.4 · end 42.6
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const LENGTH = 42.6;
const N = Math.ceil(LENGTH * SR);
const music = [new Float32Array(N), new Float32Array(N)];
const sfx = [new Float32Array(N), new Float32Array(N)];
const F = { f1: 0, f2: 4.6, f3: 7.2, f4: 10.8, f5: 16.2, f6: 20.4, f7: 30.4, f8: 34.8, f9: 38.4 };

// deterministic noise
let seed = 1234567;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;

function add(bus, t0, dur, pan, fn) {
  const start = Math.max(0, Math.floor(t0 * SR));
  const end = Math.min(N, Math.floor((t0 + dur) * SR));
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = start; i < end; i++) {
    const v = fn((i - start) / SR);
    bus[0][i] += v * l;
    bus[1][i] += v * r;
  }
}

// ---------- instruments ----------
const marimba = (bus, t, f, amp = 0.25, pan = 0) =>
  add(bus, t, 0.6, pan, (x) => amp * Math.exp(-x * 9) * (Math.sin(TAU * f * x) + 0.25 * Math.sin(TAU * f * 4 * x) * Math.exp(-x * 30)));
const pluck = (bus, t, f, amp = 0.3, pan = 0) =>
  add(bus, t, 0.45, pan, (x) => amp * Math.exp(-x * 11) * (Math.sin(TAU * f * (1 + 0.02 * Math.exp(-x * 40)) * x) + 0.4 * Math.sin(TAU * f * 2 * x) * Math.exp(-x * 20)));
const bass = (bus, t, f, dur, amp = 0.32) =>
  add(bus, t, dur, 0, (x) => {
    const tri = 2 * Math.abs(2 * ((f * x) % 1) - 1) - 1;
    return amp * tri * Math.min(1, x * 80) * Math.exp(-x * 2.2);
  });
const kick = (bus, t, amp = 0.75) =>
  add(bus, t, 0.32, 0, (x) => {
    const f = 45 + 95 * Math.exp(-x * 28);
    return amp * Math.sin(TAU * (45 * x + (95 / 28) * (1 - Math.exp(-x * 28)))) * Math.exp(-x * 9) + 0 * f;
  });
const clap = (bus, t, amp = 0.32) => {
  let lp = 0;
  add(bus, t, 0.22, 0.1, (x) => {
    const n = rnd();
    lp += 0.45 * (n - lp);
    const bursts = x < 0.03 ? (Math.floor(x / 0.01) % 2 ? 0.6 : 1) : 1;
    return amp * (n - lp) * Math.exp(-x * 18) * bursts;
  });
};
const hat = (bus, t, amp = 0.1, pan = 0.3) => {
  let prev = 0;
  add(bus, t, 0.06, pan, (x) => { const n = rnd(); const hp = n - prev; prev = n; return amp * hp * Math.exp(-x * 70); });
};
const pad = (bus, t, notes, dur, amp = 0.05) =>
  add(bus, t, dur, 0, (x) => {
    const env = Math.min(1, x / 0.4) * Math.min(1, (dur - x) / 0.5);
    return amp * env * notes.reduce((s, m) => s + Math.sin(TAU * midi(m) * x) + 0.3 * Math.sin(TAU * midi(m) * 1.003 * 2 * x), 0);
  });

// ---------- effects ----------
const whoosh = (t, dur, amp = 0.35, rising = false, pan = 0) => {
  let lp = 0;
  add(sfx, t, dur, pan, (x) => {
    const p = x / dur;
    const cut = rising ? 0.02 + 0.35 * p * p : 0.02 + 0.35 * Math.sin(Math.PI * p);
    lp += cut * (rnd() - lp);
    return amp * 3 * lp * Math.sin(Math.PI * p) ** 1.5;
  });
};
const click = (t, amp = 0.35, pan = 0.2) =>
  add(sfx, t, 0.03, pan, (x) => amp * (Math.sin(TAU * 2200 * x) * 0.6 + rnd() * 0.4) * Math.exp(-x * 220));
const pop = (t, f = 600, amp = 0.35, pan = 0) =>
  add(sfx, t, 0.12, pan, (x) => amp * Math.sin(TAU * f * (1 + 1.5 * Math.exp(-x * 60)) * x) * Math.exp(-x * 30));
const boing = (t, f = 300, amp = 0.3, pan = 0) =>
  add(sfx, t, 0.45, pan, (x) => amp * Math.sin(TAU * (f * x + 18 * Math.sin(TAU * 9 * x) / (TAU * 9))) * Math.exp(-x * 6));
const thud = (t, amp = 0.55, pan = 0) =>
  add(sfx, t, 0.22, pan, (x) => amp * (Math.sin(TAU * (55 * x + 3 * (1 - Math.exp(-x * 25)))) + 0.15 * rnd()) * Math.exp(-x * 16));
const bell = (t, f, amp = 0.22, dur = 1.2, pan = 0) =>
  add(sfx, t, dur, pan, (x) => amp * Math.exp(-x * 4) * (Math.sin(TAU * f * x) + 0.4 * Math.sin(TAU * f * 2.76 * x) * Math.exp(-x * 6) + 0.2 * Math.sin(TAU * f * 5.4 * x) * Math.exp(-x * 10)));
const chime = (t, notes, amp = 0.2) => notes.forEach((m, k) => bell(t + k * 0.09, midi(m), amp, 1.2, k % 2 ? 0.3 : -0.3));
const sparkle = (t, count = 8, amp = 0.12) => { for (let k = 0; k < count; k++) bell(t + k * 0.045, midi(84 + ((k * 5) % 12)), amp, 0.4, ((k % 5) - 2) / 3); };
const blip = (t, from, to, amp = 0.28) =>
  add(sfx, t, 0.16, 0.2, (x) => amp * Math.sin(TAU * (from + (to - from) * Math.min(1, x / 0.12)) * x) * Math.exp(-x * 12));
const crumple = (t, amp = 0.3) => {
  let lp = 0;
  add(sfx, t, 0.25, -0.2, (x) => { lp += 0.3 * (rnd() - lp); const grit = Math.sin(TAU * 37 * x) > 0.6 ? 1 : 0.4; return amp * 3 * lp * grit * Math.exp(-x * 12); });
};
const crackle = (t, dur, amp = 0.18) => { for (let k = 0; k < 26; k++) pop(t + (k * 0.618 % 1) * dur, 900 + (k * 137) % 1400, amp * (0.5 + (k % 3) / 3), ((k % 7) - 3) / 3.5); };
const stab = (t, notes, amp = 0.16, dur = 0.5) => notes.forEach((m) => add(sfx, t, dur, 0, (x) => amp * Math.exp(-x * 5) * (Math.sin(TAU * midi(m) * x) + 0.5 * Math.sin(TAU * midi(m) * 2 * x) * Math.exp(-x * 12))));

// ---------- music: C–Am–F–G at 120 BPM (one bar = 2 s) ----------
const CHORDS = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62]];
const BAR = 2, BEAT = 0.5;
for (let bar = 0; bar * BAR < LENGTH; bar++) {
  const t0 = bar * BAR;
  const [root, ...tones] = CHORDS[bar % 4];
  // "Now where is it?": the band drops out (5.2–7.2), then everything kicks in with the star (8.4).
  const inBreak = t0 + BAR > 5.2 && t0 < 8.4;
  const full = t0 >= 8.4 - 0.01 && t0 < 40.0;
  const intro = t0 < 5.2;
  for (let s = 0; s < 8; s++) {
    const t = t0 + s * 0.25;
    if (t >= LENGTH - 0.3) break;
    if (inBreak && t >= 5.2 && t < 8.4) continue;
    const arp = [...tones, tones[1] + 12][s % 4] + (s >= 4 ? 12 : 0);
    if (full || intro) marimba(music, t, midi(arp), intro ? 0.12 : 0.15, s % 2 ? 0.35 : -0.35);
    if (full) hat(music, t, s % 2 ? 0.07 : 0.11);
  }
  for (let b = 0; b < 4; b++) {
    const t = t0 + b * BEAT;
    if (t >= LENGTH - 0.3 || (t >= 5.2 && t < 8.4)) continue;
    if (full || intro) bass(music, t, midi(root - 12 + (b === 3 ? 7 : 0)), 0.45, intro ? 0.18 : 0.28);
    if (full) {
      if (b % 2 === 0) kick(music, t);
      else clap(music, t);
    }
  }
  if (!inBreak && t0 < 40) pad(music, t0, tones, BAR, intro ? 0.025 : 0.035);
}
// "where is it?" break: a sneaky walking bass, then a riser into the reveal
[52, 50, 48, 47, 45, 43].forEach((m, k) => bass(music, 5.3 + k * 0.32, midi(m - 12), 0.3, 0.22));
whoosh(7.25, 1.1, 0.25, true);
// final resolution: C major, held and faded under the logo
pad(music, 40.0, [48, 55, 60, 64, 67, 72], 2.6, 0.06);
[60, 64, 67, 72, 76].forEach((m, k) => marimba(music, 40.0 + k * 0.08, midi(m), 0.16, (k - 2) / 3));
kick(music, 40.0, 0.8);

// ---------- effects on the animation hits ----------
// 01 the pile: each chip lands (bounce.out hits ≈ 31% into its 0.85 s drop), pitch climbs a pentatonic
const PENTA = [0, 2, 4, 7, 9];
for (let i = 0; i < 20; i++) {
  const t = F.f1 + 0.1 + i * 0.11 + 0.31;
  pluck(sfx, t, midi(67 + PENTA[i % 5] + 12 * Math.floor(i / 10)), 0.2, ((i * 7) % 9 - 4) / 5);
}
pop(F.f1 + 2.5, 520, 0.3);
boing(F.f1 + 2.95, 340, 0.32);
// 02 where is it?
[0.5, 0.92, 1.34].forEach((d, k) => blip(F.f2 + d + 0.1, 500 + k * 60, 760 + k * 80));
thud(F.f2 + 0.78, 0.6);
boing(F.f2 + 1.0, 180, 0.25);
// 03 the star: big sweep, burst, landing sparkle, chord on the wordmark
whoosh(F.f3 + 0.1, 0.9, 0.5, false, -0.3);
crackle(F.f3 + 0.45, 0.5, 0.1);
thud(F.f3 + 1.18, 0.7);
whoosh(F.f3 + 1.2, 0.6, 0.25, true, 0.2);
sparkle(F.f3 + 1.75, 10);
stab(F.f3 + 1.9, [60, 64, 67, 72], 0.14, 0.8);
pop(F.f3 + 2.3, 700, 0.25);
// 04 one click
whoosh(F.f4, 0.45, 0.25, false, 0.4);
click(F.f4 + 0.88);
blip(F.f4 + 0.95, 400, 900, 0.22);
bell(F.f4 + 1.8, midi(79), 0.18, 0.6, 0.4);
boing(F.f4 + 2.05, 360, 0.25, -0.3);
click(F.f4 + 3.1);
whoosh(F.f4 + 3.3, 0.8, 0.3, false, -0.3);
thud(F.f4 + 4.12, 0.55, -0.4);
chime(F.f4 + 4.25, [72, 76, 79], 0.2);
// 05 no forced fits
whoosh(F.f5, 0.45, 0.22, false, 0.4);
blip(F.f5 + 0.4, 520, 440, 0.18);
blip(F.f5 + 0.58, 520, 420, 0.18);
click(F.f5 + 1.75);
pop(F.f5 + 1.98, 420, 0.4, -0.4);
sparkle(F.f5 + 2.2, 8, 0.11);
whoosh(F.f5 + 2.95, 0.7, 0.28, false, -0.2);
thud(F.f5 + 3.64, 0.5, -0.4);
// 06 four ways: four card drops, then a coloured tone each time the spotlight moves
[0.07, 0.13, 0.19, 0.25].forEach((d, k) => add(sfx, F.f6 + d, 0.12, (k % 2) * 0.6 - 0.3, (x) => 0.35 * Math.sin(TAU * (180 + k * 40) * x) * Math.exp(-x * 30)));
[[0.3, 72], [2.5, 76], [4.7, 79], [6.9, 84]].forEach(([d, m], k) => { click(F.f6 + d, 0.2, (k % 2) * 0.6 - 0.3); bell(F.f6 + d + 0.02, midi(m), 0.16, 0.9, (k % 2) * 0.6 - 0.3); });
// 07 checkup
whoosh(F.f7, 0.45, 0.22, false, 0.4);
click(F.f7 + 0.88, 0.25, 0.4);
click(F.f7 + 1.12, 0.25, 0.5);
pop(F.f7 + 1.45, 300, 0.35, -0.4);
blip(F.f7 + 1.88, 300, 520, 0.2);
[2.0, 2.35].forEach((d) => { whoosh(F.f7 + d + 0.15, 0.5, 0.22, false, -0.2); crumple(F.f7 + d + 0.7, 0.32); });
thud(F.f7 + 3.22, 0.45, -0.4);
chime(F.f7 + 3.4, [76, 79], 0.18);
// 08 apply → undo
click(F.f8 + 0.88);
whoosh(F.f8 + 1.0, 0.55, 0.3, false, 0.4);
[1.42, 1.5, 1.58].forEach((d, k) => thud(F.f8 + d, 0.35, 0.5 + k * 0.1));
click(F.f8 + 2.1);
whoosh(F.f8 + 2.18, 0.55, 0.32, true, -0.3);
[2.62, 2.69, 2.76].forEach((d, k) => pop(F.f8 + d, 500 + k * 90, 0.22, -0.3));
// 09 close
boing(F.f9 + 0.33, 260, 0.35);
boing(F.f9 + 0.58, 300, 0.2);
crackle(F.f9 + 0.55, 0.9, 0.16);
pop(F.f9 + 1.5, 520, 0.3, -0.2);
pop(F.f9 + 1.65, 640, 0.3, 0.2);
sparkle(F.f9 + 2.4, 6, 0.1);

// ---------- mix: music bed under effects, gentle limiter, fades ----------
const out = Buffer.alloc(44 + N * 4);
let peak = 0;
const mixed = [new Float32Array(N), new Float32Array(N)];
for (let c = 0; c < 2; c++) {
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const fadeIn = Math.min(1, t / 0.05), fadeOut = Math.min(1, (LENGTH - t) / 1.2);
    const v = Math.tanh((music[c][i] * 0.55 + sfx[c][i] * 0.9) * 1.1) * fadeIn * fadeOut;
    mixed[c][i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
}
const gain = 0.89 / peak; // ≈ −1 dBFS
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 4, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write("data", 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixed[0][i] * gain)) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixed[1][i] * gain)) * 32767), 46 + i * 4);
}
mkdirSync("assets/audio", { recursive: true });
writeFileSync("assets/audio/soundtrack.wav", out);
console.log(`soundtrack.wav ${LENGTH}s, peak ${peak.toFixed(2)} → normalized`);
