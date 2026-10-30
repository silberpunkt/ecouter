/* ecouter-speech.js -- the voice of ecouter.js alone: no Bell sheets, no lamp. A featherlight,
   instrumented text-to-speech library in one file.
   Written by repo.make.js on 2026-10-29 from the ecouter workshop; do not edit here.

   What it is: a formant throat after Klatt (1980), five formants, a glottal
   source with life (wobble, waver, flutter, air), a second vent for hisses
   and bursts, a nasal zero, a lips' ceiling and a governor; a spectrogram
   gust (Griffin-Lim); a chain of settings (the house voice: Worn, 79,
   stockinged, entoned); a phoneme table for the 41 codes of NRL Report
   7948; the Report's 355 letter-to-sound rules, copied from the public
   domain C of 1985 by program; and the Lexillogue, the matcher of that C.

   In a page:
     <script src="ecouter.js"></script>
     var pcm = ECOUTER.say("Put the book back.");        // Float32Array, 16 kHz
     var wav = ECOUTER.wav("Put the book back.");        // Uint8Array, a .wav
     ECOUTER.codes("Put the book back.")                 // "pUHt DHAX bUHk bAEk . "
   In node or QuickJS:
     var E = require("./ecouter.js"); E.say(...)
   Everything under the hood is there too: E.VOICEBOX, E.GUST, E.CHAIN,
   E.PHONES, E.RULES, E.LEXILLOGUE. The chain is the only slow part: its
   gust is forty turns of Griffin-Lim; pass { turns: 8 } for a quick draft.

   The NRL rules are public domain (John A. Wasser, 1985: "this is all
   public domain and I make no copyright claims on it"). The rest is the
   ecouter workshop's, 2026. */
(function (global, outer) {                             // outer: the CommonJS module, judged outside, before the inner var module hoists over it
  var root = {}, module, exports;                       // the modules below see no module, and attach to root

// ======== aiu.score.js ========
/* aiu.score.js -- the first score: a, i, u, each sounded and let fall,
   each at its own pitch, glides between. Shared by the test and the table.
   Formants are Peterson and Barney's men, 1952. */
(function (root) {
  'use strict';
  var A = [730, 1090, 2440], I = [270, 2290, 3010], U = [300, 870, 2240];
  var score = [
    { ms: 40,  f0: 120, f: A, voice: 0 },
    { ms: 60,  f0: 120, f: A, voice: 1 },               // a arrives
    { ms: 300, f0: 120, f: A, voice: 0.8 },             // a, at 120, easing as a held sound does
    { ms: 120, f0: 165, f: I, voice: 0.95 },            // glide up, and a little push
    { ms: 300, f0: 165, f: I, voice: 0.75 },            // i, at 165
    { ms: 120, f0: 98,  f: U, voice: 0.9 },             // glide down
    { ms: 300, f0: 98,  f: U, voice: 0.6 },             // u, at 98, dying away
    { ms: 80,  f0: 90,  f: U, voice: 0 }
  ];
  function at(ms) { return Math.round(ms * 16); }       // samples at 16 kHz
  var AIU = { score: score, mids: { a: at(250), i: at(670), u: at(1090) }, want: { a: 120, i: 165, u: 98 }, A: A, I: I, U: U };
  if (typeof module !== 'undefined' && module.exports) module.exports = AIU;
  else root.AIU = AIU;
})(root);

// ======== voicebox.js ========
/* voicebox.js -- ecouter, brick one: a throat and nothing else.
   No letters, no words, no rules: a source and three resonators, driven by
   a score of frames. Each frame says how long, what pitch, which three
   formants, how much voice and how much breath. Between frames every value
   glides. The pitch you ask for is the pitch that comes out, and the test
   beside this file measures that on the samples, not on the score.

   The design is Klatt's cascade (1980), cut to the bone: a glottal pulse,
   three formant resonators in series, and a first difference for the lips.
   Works in a page or in node.

     var pcm = VOICEBOX.sing(frames, 16000);      // Float32Array, -1..1
     var dry = VOICEBOX.sing(frames, 16000, { life: 0 });   // the ruler
     var soft = VOICEBOX.mellow(pcm, 16000);      // the same, as through a kind microphone
     var wav = VOICEBOX.wav(soft, 16000);         // Uint8Array, a .wav file

   quiet + plur. */
(function (root) {
  'use strict';

  // one two-pole resonator: centre f, bandwidth bw, at sample rate sr.
  // Coefficients are set per sample, so a formant can glide.
  function Reso() { this.y1 = 0; this.y2 = 0; }
  Reso.prototype.step = function (x, f, bw, sr) {
    var r = Math.exp(-Math.PI * bw / sr);
    var c = -r * r, b = 2 * r * Math.cos(2 * Math.PI * f / sr), a = 1 - b - c;
    var y = a * x + b * this.y1 + c * this.y2;
    this.y2 = this.y1; this.y1 = y;
    return y;
  };

  // THE NASAL ZERO (10 x 2026, for n, m and ng; user1: "move onto k, g, p, n"). A nasal is a hum through the nose
  // with the mouth shut, and the shut mouth takes a band OUT of the sound: an antiresonance, near 1 kHz for m,
  // 1.6 kHz for n, higher for ng. Klatt's antiresonator: the resonator's coefficients turned inside out, run on
  // the input's past instead of the output's. A frame asks for it with `nasal` (0 to 1) and `zero: [centre, bw]`.
  function Anti() { this.x1 = 0; this.x2 = 0; }
  Anti.prototype.step = function (x, f, bw, sr) {
    var r = Math.exp(-Math.PI * bw / sr);
    var c = -r * r, b = 2 * r * Math.cos(2 * Math.PI * f / sr), a = 1 - b - c;
    var y = x / a - (b / a) * this.x1 - (c / a) * this.x2;
    this.x2 = this.x1; this.x1 = x;
    return y;
  };

  // a small seeded noise, so the same score always makes the same breath
  function Noise(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var x = Math.imul(t ^ (t >>> 15), t | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 2147483648 - 1;
    };
  }

  var BW = [90, 100, 160];                               // bandwidths of F1, F2, F3. F1's was 60, and an open a rang. F2 and F3 were narrowed to 80 and 130 on 6 x 2026 for ring; with the fourth and fifth they rang together, "a flanger ... it drills" (user1, 10 x), and are back
  // THE FOURTH AND FIFTH (user1, 6 x 2026, on take 04: the first phrase "continues to sound a little AM radio /
  // underwater / low-frequency-range connection ... it is precisely frequency range and response which can clarify
  // him"). Klatt's cascade has five formants; this one was cut to three, and above 3 kHz there was nothing but what
  // leaked. A man's fourth and fifth sit near 3.3 and 3.7 kHz and hardly move with the vowel; they are the presence
  // of a voice, and breath and tone alike pass through them. Fixed, as Klatt has them.
  var F45 = [[3300, 350], [3750, 400]];   // 250 and 300 at first; with them the i stands 5.2 dB over the u, and widening them to 450 does not move that

  // THE SECOND VENT (5 x 2026, for "for the voice reading test"). An h is breath through the whole mouth, and
  // it goes through the formants. An s, an f, a th and the burst of a t are made in FRONT of the formants, at
  // the teeth and lips, and the mouth behind them hardly colours the sound. So a frame may ask for `hiss`
  // (0 to 1) and say where, `at: [centre, bandwidth]`: white noise through one resonator of its own, added
  // after the throat and before the lips. Places, rounded from Klatt (1980) and a look at spectrograms:
  // user1, on first hearing (5 x 2026): "hard hissing on the voiSSS readinkg teSSSt ... Look at that bloom on the
  // spectrograms! No speech does that. That's an inverted bell, a hot zone explosion." The s was a narrow ring at
  // 5.5 kHz, and the lips brighten it again. Now it is broad: an s is a rush, not a bell.
  var HISS = { s: [4600, 1600], sh: [3000, 2000], f: [1500, 3500], th: [4000, 3500], t: [4000, 2500], gain: 0.024, dull: 0.6 };   // gain up a half: the dulling takes some
  // the s: 5500/1800 at first (a bell), 5600/3000 (a rush, and user1 still heard every s as sss through a stocking);
  // now lower and narrower, 4600/1600, the place taken down rather than the level   // the gain was 0.22 at first, and the s stood eight times over the vowel

  // frames: [{ ms, f0, f: [F1, F2, F3], voice: 0..1, breath: 0..1 }, ...]
  // A frame's values are reached at its END; the glide starts from the frame
  // before it. The first frame starts from itself.
  //
  // LIFE. A ruler is not a voice. Four things a throat does that a ruler does
  // not, each small, each seeded so the same score makes the same sound:
  //   wobble   no two periods quite the same length
  //   waver    no two pulses quite the same height
  //   flutter  the pitch never sits still: three slow waves under it (Klatt, 1990)
  //   air      breath in every voiced sound, most while the cords stand open:
  //            the white rush between the tones
  // opt.life scales all four: 1 as set here, 0 for the ruler, which the tests
  // use to check that the pitch asked for is the pitch sung.
  var LIFE = { wobble: 0.016, waver: 0.06, flutter: 0.005, air: 0.035, open: 0.6 };

  function sing(frames, sr, opt) {
    sr = sr || 16000;
    var life = opt && opt.life !== undefined ? opt.life : 1;
    var total = 0, i;
    for (i = 0; i < frames.length; i++) total += Math.round(frames[i].ms * sr / 1000);
    var out = new Float32Array(total), n = 0;
    var r1 = new Reso(), r2 = new Reso(), r3 = new Reso(), r4 = new Reso(), r5 = new Reso(), anti = new Anti(), np = new Reso();
    var noise = Noise(1904), dice = Noise(1850), phase = 0, last = 0, peak = 0, longer = 1, taller = 1, hush = 0;
    var vent = new Reso(), hissNoise = Noise(1777), dullHiss = 0;   // the second vent, with its own noise
    // THE LIPS' CEILING (user1, 10 x 2026: noise blocks "are natural" where they blend with the structure; "when they
    // elevate to the height of the sampling frequency, they become distorted, unvoiceable"). A mouth radiates almost
    // nothing above 5 or 6 kHz. The vent's hiss and the h's breath are held under a ceiling near 5.5 kHz here, in the
    // throat, so no block of noise can stand up to 8 kHz in any variant. Two poles.
    var CEIL = Math.exp(-2 * Math.PI * 5500 / sr), CEIL_S = Math.exp(-2 * Math.PI * 7000 / sr), c1 = 0, c2 = 0, c3 = 0, c4 = 0;   // the s has its own ceiling: under 5.5 kHz it was an sh (user1, 10 x: "shuushing")
    var from = frames[0];
    for (i = 0; i < frames.length; i++) {
      var to = frames[i], len = Math.round(to.ms * sr / 1000), k;
      for (k = 0; k < len; k++) {
        var t = (k + 1) / len;
        var f0 = from.f0 + (to.f0 - from.f0) * t;
        var v  = from.voice + (to.voice - from.voice) * t;
        var br = (from.breath || 0) + ((to.breath || 0) - (from.breath || 0)) * t;
        var F1 = from.f[0] + (to.f[0] - from.f[0]) * t;
        var F2 = from.f[1] + (to.f[1] - from.f[1]) * t;
        var F3 = from.f[2] + (to.f[2] - from.f[2]) * t;
        var sec = n / sr;
        var flut = 1 + life * LIFE.flutter * (Math.sin(2 * Math.PI * 12.7 * sec) + Math.sin(2 * Math.PI * 7.1 * sec) + Math.sin(2 * Math.PI * 4.7 * sec));
        phase += f0 * flut * longer / sr;
        if (phase >= 1) {                                // a new period: its own length, its own height
          phase -= 1;
          longer = 1 + life * LIFE.wobble * dice();
          taller = 1 + life * LIFE.waver * dice();
        }
        // the cords: not a click but a breath of flow. They open, the flow swells
        // and is cut off sharply as they close (Klatt's KLGLOTT88 shape), then
        // they stay shut for the rest of the period.
        var isOpen = phase < LIFE.open, flow = 0;
        if (isOpen) { var g = phase / LIFE.open; flow = 6.75 * (g * g - g * g * g); }
        // An open mouth is a loud mouth: as first laid, a stood 9 dB over i.
        // Ease the cords as F1 opens, so a is still the fuller vowel but no longer shouts.
        var ease = F1 > 350 ? Math.pow(350 / F1, 0.4) : 1;
        var white = noise(), rush = white * (isOpen ? 1 : 0.3);   // breath passes mostly while they stand open
        // H. Asked-for breath (a frame's `breath`) is the sound of h. As first laid it came out as the ch of
        // Bach (user1, 4 x 2026: "a Russian with a lapel microphone problem"). Three causes, three cures:
        //   it was white, and the lips brighten: now it is dulled first (one pole, about 1.1 kHz)
        //   it pulsed at the pitch even with no voice, a rattle: now it pulses only as far as there is voice
        //   it rang in a closed throat's narrow formants: with the cords apart the mouth is damped, so the
        //   bandwidths open with the breath. A ringing rush is a fricative; a dull wide one is an h.
        hush += 0.35 * (white - hush);
        var puff = hush * (isOpen ? 1 : 1 - 0.7 * v), wide = 1 + 6 * br;
        c3 = c3 * CEIL + puff * (1 - CEIL); c4 = c4 * CEIL + c3 * (1 - CEIL); puff = c4;   // the breath too, under the ceiling
        var src = flow * v * ease * taller + puff * br * 0.5 + rush * life * LIFE.air * v;
        var y = r3.step(r2.step(r1.step(src, F1, BW[0] * wide, sr), F2, BW[1] * wide, sr), F3, BW[2] * wide, sr);
        var nz = (from.nasal || 0) + ((to.nasal || 0) - (from.nasal || 0)) * t;
        if (nz > 0) {                                    // the nose: the mouth's band taken out, as much as asked
          var zp = to.zero || from.zero || [1600, 300];   // a zero alone rises above its notch (the resonator inside
          var ny = np.step(anti.step(y, zp[0], zp[1], sr), 270, 100, sr);   // out), so Klatt pairs it with the nose's
          y = (1 - nz) * y + nz * ny;                     // own pole near 270 Hz: a hum, dull above the notch
        }
        y = r5.step(r4.step(y, F45[0][0], F45[0][1] * wide, sr), F45[1][0], F45[1][1] * wide, sr);
        // THE AIR-LENS (user1, 6 x 2026, on hearing the vent as "maracas": "The human larynx creates a lens of sound
        // while air is passing through it ... As air and the fact of its white noise is conducted through the
        // 'air-lens', it coheres"). Two things, as cheaply as they can be done. The vent's noise is dulled before
        // its resonator (one pole, about 2.5 kHz), so a consonant is not the same white sandpaper every time. And
        // in a voiced frame the glottal flow gates it: the hiss of a v or a th comes in puffs at the pitch, as
        // breath does through cords that are moving, and is a buzz, not a scratch. With no voice the gate is open.
        var hs = (from.hiss || 0) + ((to.hiss || 0) - (from.hiss || 0)) * t;
        if (hs > 0) {
          var place = to.at || from.at || HISS.s;
          dullHiss += HISS.dull * (hissNoise() - dullHiss);
          var gate = 1 - v + v * (isOpen ? 0.1 + flow * 0.9 : 0.02);   // open cords let it through, swelling with the flow; shut ones stop it (user1: a z "cannot be voiced without a tone")
          var hv = vent.step(dullHiss, place[0], place[1], sr) * hs * HISS.gain * gate;
          var ce = place[0] >= 4500 ? CEIL_S : CEIL;        // a score hands in its own table of places, so the s is known by its height, not its name
          c1 = c1 * ce + hv * (1 - ce); c2 = c2 * ce + c1 * (1 - ce);   // under the ceiling
          y += c2;
        }
        var lip = y - last; last = y;                    // radiation at the lips
        out[n++] = lip;
        if (lip > peak) peak = lip; else if (-lip > peak) peak = -lip;
      }
      from = to;
    }
    govern(out, sr);
    peak = 0; for (i = 0; i < total; i++) { var ab = out[i] < 0 ? -out[i] : out[i]; if (ab > peak) peak = ab; }
    if (peak > 0) for (i = 0; i < total; i++) out[i] = out[i] / peak * 0.9;
    return out;
  }

  // THE GOVERNOR (user1, 10 x 2026: "If a segment is generated, and extends past the upper range of frequency, it
  // must be scaled down perhaps by gamma, and joined with its neighbors, else face clicks. We should not be
  // generating and playing impossible tones. A 'governor' could serve this, as a spinning steam-release on a
  // boiler."). The throat's last stage, after the lips. What lies above 6 kHz is followed against the whole, and
  // where it stands over its share it is pressed back, by a power of the excess (the gamma), with a hand that
  // takes 4 ms to close and 40 ms to open: no step, so no click, and a join with its neighbours by the same hand.
  // A vowel never touches it; an s under its own ceiling barely; a block of noise standing up to the sampling
  // frequency cannot pass. In place, on the samples given.
  var GOV = { hz: 5500, share: 0.3, gamma: 1.2, close: 0.004, open: 0.040 };   // measured by rms, 10 x: above 5.5 kHz a vowel has 0.003 of its level, a t's burst 0.16, an f 0.24, white noise 0.51, the s 0.69
  // The split is a short symmetric FIR low-pass (21 taps, a windowed sinc), so the two halves add back to the
  // whole exactly, a half-millisecond late; a recursive low-pass lags its own input and the halves would fight.
  function taps(f, sr) {
    var N = 21, M = 10, h = [], n, w = 2 * Math.PI * f / sr, sum = 0, k;
    for (n = 0; n < N; n++) {
      k = n - M; h[n] = (k === 0 ? w / Math.PI : Math.sin(w * k) / (Math.PI * k)) * (0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1)));
      sum += h[n];
    }
    for (n = 0; n < N; n++) h[n] /= sum;
    return h;
  }
  function govern(x, sr) {
    var n = x.length, h = taps(GOV.hz, sr), N = h.length, M = (N - 1) / 2, lo, hi, i, j, a, e, ea = 0, et = 0, g = 1, want, xd;
    var kc = Math.exp(-1 / (GOV.close * sr)), ko = Math.exp(-1 / (GOV.open * sr)), src = x.slice();
    for (i = 0; i < n; i++) {
      lo = 0; for (j = 0; j < N; j++) { var at = i - j; if (at >= 0) lo += h[j] * src[at]; }
      xd = i - M >= 0 ? src[i - M] : 0; hi = xd - lo;        // the whole, half a millisecond late, and what lies above the ceiling
      a = hi < 0 ? -hi : hi; e = xd < 0 ? -xd : xd;
      ea = a > ea ? ea * kc + a * (1 - kc) : ea * ko + a * (1 - ko);   // the high band's level
      et = e > et ? et * kc + e * (1 - kc) : et * ko + e * (1 - ko);   // and the whole's
      want = ea > GOV.share * et && ea > 1e-6 ? Math.pow(GOV.share * et / ea, GOV.gamma) : 1;
      g = want < g ? g * kc + want * (1 - kc) : g * ko + want * (1 - ko);   // the hand, never a step
      x[i] = lo + hi * g;
    }
    return x;
  }

  // 16-bit mono .wav, header and all
  function wav(pcm, sr) {
    var n = pcm.length, b = new Uint8Array(44 + n * 2), d = new DataView(b.buffer), i;
    function tag(at, s) { for (var j = 0; j < 4; j++) b[at + j] = s.charCodeAt(j); }
    tag(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); tag(8, 'WAVE'); tag(12, 'fmt ');
    d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
    d.setUint32(24, sr, true); d.setUint32(28, sr * 2, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
    tag(36, 'data'); d.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.round(pcm[i] * 32767))), true);
    return b;
  }

  // mellow: what one gives a hot microphone, after the fact. user1's suggestion:
  // "softness ... the smallest reverberation so as to confirm their pitch ...
  // only soften the highs and give the depths a lift". Three small things:
  //   highs   a shelf down above about 2 kHz (two gentle stages, about 6 dB)
  //   depths  a small lift below about 250 Hz (about 2.5 dB)
  //   room    two early echoes and one short decaying one; 120 ms of tail
  // No levelling here. The a that shouted was 9 dB hot in the throat itself,
  // and it is eased there, where the cause was. (A second soft stage on the
  // cords was tried and taken out: it dulled i until its F2 was lost.)
  function mellow(pcm, sr) {
    sr = sr || 16000;
    var n = pcm.length, tail = Math.round(0.12 * sr), out = new Float32Array(n + tail), i;
    var kh = Math.exp(-2 * Math.PI * 2200 / sr), kl = Math.exp(-2 * Math.PI * 250 / sr), h1 = 0, h2 = 0, ll = 0;
    var d1 = Math.round(0.011 * sr), d2 = Math.round(0.023 * sr), d3 = Math.round(0.037 * sr), wet = new Float32Array(n + tail);
    for (i = 0; i < n + tail; i++) {
      var x = i < n ? pcm[i] : 0;
      h1 = h1 * kh + x * (1 - kh); h2 = h2 * kh + h1 * (1 - kh);   // what lies below ~2 kHz, twice over
      ll = ll * kl + x * (1 - kl);                                 // what lies below ~250 Hz
      var dry = 0.4 * x + 0.6 * h2 + 0.3 * ll;
      wet[i] = dry + (i >= d3 ? 0.18 * wet[i - d3] : 0);
      out[i] = dry + (i >= d1 ? 0.10 * wet[i - d1] : 0) + (i >= d2 ? 0.07 * wet[i - d2] : 0) + (i >= d3 ? 0.05 * wet[i - d3] : 0);
    }
    var peak = 0; for (i = 0; i < out.length; i++) { var a = out[i] < 0 ? -out[i] : out[i]; if (a > peak) peak = a; }
    if (peak > 0) for (i = 0; i < out.length; i++) out[i] = out[i] / peak * 0.8;
    return out;
  }

  var VOICEBOX = { sing: sing, mellow: mellow, wav: wav, govern: govern, HISS: HISS, GOV: GOV };
  if (typeof module !== 'undefined' && module.exports) module.exports = VOICEBOX;
  else root.VOICEBOX = VOICEBOX;
})(root);

// ======== gust.js ========
/* gust.js -- the Inversing Spectrogram, with the Furious Double-Twist.
   user1: "transform it to a true image. Then blur that ... Then flip it back
   into audiospace ... to let a gust of true air between all our carefully
   set up cups."

   So: the sound is turned into its picture (how loud, at each pitch, at each
   moment; nothing else is kept), the picture is blurred as a picture, and a
   sound is then found whose picture is the blurred one. The picture holds
   no phases, so the way back is a search (Griffin and Lim, 1984): guess,
   take the guess's picture, put the wanted loudness on the guess's phases,
   and again.

     var G = require('./gust.js');
     var out = G.gust(pcm, 16000);                 // the house gust: 50 ms, 26 Hz
     var out = G.gust(pcm, 16000, { ms: 12, hz: 30, mix: 1 });

     ms    how far the picture is smeared along time
     hz    how far it is smeared along pitch
     mix   1 = only the blurred sound; 0.3 = mostly the plain one, with
           the blur let in as air

   What the blur does, measured in gust.test.js on a voice near 128 Hz:
     along time, even 100 ms: the voice stays a voice
     along pitch, 30 Hz: pitch kept, air let in (18 dB -> 15)
     along pitch, 45 Hz: as breathy as a person speaking, and breaking up
     along pitch, 60 Hz and over: the pitch dissolves into breath
   A voice's picture is stripes along pitch, one per harmonic. Smear across
   the stripes and it is the voice itself that goes. That is the instrument
   doing what was asked, not a fault.

   quiet + plur. */
(function (root) {
  'use strict';
  var N = 512, HOP = 128;                               // 32 ms windows, a quarter apart, at 16 kHz

  function fft(re, im, inverse) {                       // in place, radix 2
    var n = re.length, i, j = 0, k, len, t;
    for (i = 1; i < n; i++) { k = n >> 1; while (j & k) { j ^= k; k >>= 1; } j ^= k; if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (len = 2; len <= n; len <<= 1) {
      var ang = 2 * Math.PI / len * (inverse ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
    if (inverse) for (i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  var WIN = new Float32Array(N); (function () { for (var i = 0; i < N; i++) WIN[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); })();
  // the same transform with its twiddles looked up, not recurred, and no allocation: for the search below, which
  // runs it eighty times over every frame (user1, 11 x 2026: "1. Depolarization, 2. Kept buffers. Yes to both.")
  var TWR = new Float32Array(N / 2), TWI = new Float32Array(N / 2);
  (function () { for (var k = 0; k < N / 2; k++) { TWR[k] = Math.cos(2 * Math.PI * k / N); TWI[k] = Math.sin(2 * Math.PI * k / N); } })();
  var REV = new Int32Array(N); (function () { var i, j = 0, k; for (i = 1; i < N; i++) { k = N >> 1; while (j & k) { j ^= k; k >>= 1; } j ^= k; REV[i] = j; } })();
  function fftN(re, im, inverse) {                      // in place, length N only
    var i, j, k, len, t, step, a, b, xr, xi, cr, ci;
    for (i = 1; i < N; i++) { j = REV[i]; if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (len = 2; len <= N; len <<= 1) {
      step = N / len;
      for (i = 0; i < N; i += len) {
        for (k = 0; k < len / 2; k++) {
          cr = TWR[k * step]; ci = inverse ? TWI[k * step] : -TWI[k * step];
          a = i + k; b = a + len / 2; xr = re[b] * cr - im[b] * ci; xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
    if (inverse) for (i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }

  // sound -> picture and phases. Frames are columns; each holds N/2+1 heights.
  function picture(x) {
    var frames = Math.max(1, Math.ceil((x.length + N) / HOP)), mag = [], pha = [], f, i;
    for (f = 0; f < frames; f++) {
      var re = new Float32Array(N), im = new Float32Array(N), s = f * HOP - N + HOP;
      for (i = 0; i < N; i++) { var k = s + i; re[i] = (k >= 0 && k < x.length ? x[k] : 0) * WIN[i]; }
      fft(re, im, false);
      var m = new Float32Array(N / 2 + 1), p = new Float32Array(N / 2 + 1);
      for (i = 0; i <= N / 2; i++) { m[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]); p[i] = Math.atan2(im[i], re[i]); }
      mag.push(m); pha.push(p);
    }
    return { mag: mag, pha: pha, length: x.length };
  }
  // picture and phases -> sound
  function sound(mag, pha, length) {
    var out = new Float32Array(length), wsum = new Float32Array(length), f, i;
    for (f = 0; f < mag.length; f++) {
      var re = new Float32Array(N), im = new Float32Array(N), s = f * HOP - N + HOP;
      for (i = 0; i <= N / 2; i++) { re[i] = mag[f][i] * Math.cos(pha[f][i]); im[i] = mag[f][i] * Math.sin(pha[f][i]); if (i > 0 && i < N / 2) { re[N - i] = re[i]; im[N - i] = -im[i]; } }
      fft(re, im, true);
      for (i = 0; i < N; i++) { var k = s + i; if (k >= 0 && k < length) { out[k] += re[i] * WIN[i]; wsum[k] += WIN[i] * WIN[i]; } }
    }
    for (i = 0; i < length; i++) if (wsum[i] > 1e-6) out[i] /= wsum[i];
    return out;
  }

  // blur the picture: a bell-shaped smear along time (columns) and along pitch
  // (rows). The widths may be fractions of a column or a row: along pitch a
  // voice's picture is fine stripes, one per harmonic, about four rows apart,
  // and a smear of even one whole row begins to melt them.
  function blur(mag, cols, rows) {
    var F = mag.length, B = mag[0].length, f, b, a = mag.map(function (m) { return Float32Array.from(m); });
    function bell(sigma) {
      if (!(sigma > 0.05)) return null;
      var r = Math.max(1, Math.ceil(3 * sigma)), k = [], sum = 0, i;
      for (i = -r; i <= r; i++) { k.push(Math.exp(-i * i / (2 * sigma * sigma))); sum += k[k.length - 1]; }
      return { r: r, k: k.map(function (v) { return v / sum; }) };
    }
    function smear(get, set, len, kn) {
      var tmp = new Float32Array(len), i, j, s, w;
      for (i = 0; i < len; i++) { s = 0; w = 0; for (j = -kn.r; j <= kn.r; j++) if (i + j >= 0 && i + j < len) { s += get(i + j) * kn.k[j + kn.r]; w += kn.k[j + kn.r]; } tmp[i] = s / w; }
      for (i = 0; i < len; i++) set(i, tmp[i]);
    }
    var kc = bell(cols), kr = bell(rows);
    if (kc) for (b = 0; b < B; b++) smear(function (i) { return a[i][b]; }, function (i, v) { a[i][b] = v; }, F, kc);
    if (kr) for (f = 0; f < F; f++) smear(function (i) { return a[f][i]; }, function (i, v) { a[f][i] = v; }, B, kr);
    return a;
  }

  // a sound whose picture is this one: the search by phases, as first written, kept for the check beside it
  function fromPictureByPhases(mag, length, seedPha, turns) {
    var pha = seedPha, x = sound(mag, pha, length), i;
    for (i = 0; i < (turns === undefined ? 40 : turns); i++) { pha = picture(x).pha; x = sound(mag, pha, length); }
    return x;
  }
  // THE SEARCH, DEPOLARIZED (11 x 2026). Griffin and Lim's turn is: take the sound's picture, keep its phases, put
  // the wanted heights under them, make a sound. As first written that went to magnitude and angle with atan2 and
  // back with cos and sin, eight million trigonometric calls for a six-second sentence, and was 97% of the cost of
  // saying anything. The same turn in complex form: scale each bin by the wanted height over its own; one square
  // root and a divide. Flat buffers for every frame, made once and kept. The sound is the same to within rounding.
  // TWO FRAMES IN ONE TRANSFORM. Measured in a browser (11 x 2026) the trigonometry was never the cost there; the
  // transform itself is, near a JIT's floor. So there are half as many: two real frames ride one complex transform
  // (one as its real part, one as its imaginary) and are parted afterwards by the symmetry of a real signal's
  // spectrum; and two spectra are joined before one inverse transform and come out as its two parts. Exact.
  // FAST (Perraudin, Balazs and Sondergaard, 2013): each turn is pushed on by most of the step it just took, and
  // forty turns' worth is reached in about ten. It is not the same sound; a button, for ears to judge.
  var B = N / 2 + 1, bre = new Float32Array(N), bim = new Float32Array(N);
  function fromPicture(mag, length, seedPha, turns, fast) {
    turns = turns === undefined ? 40 : turns;
    var F = mag.length, M = new Float32Array(F * B), XR = new Float32Array(F * B), XI = new Float32Array(F * B), f, i, k, s, n, o;
    var x = new Float32Array(length), wsum = new Float32Array(length), CR, CI, PR, PI, alpha = 0.99;
    for (f = 0; f < F; f++) for (i = 0; i < B; i++) { o = f * B + i; M[o] = mag[f][i]; XR[o] = M[o] * Math.cos(seedPha[f][i]); XI[o] = M[o] * Math.sin(seedPha[f][i]); }
    for (f = 0; f < F; f++) { s = f * HOP - N + HOP; for (i = 0; i < N; i++) { k = s + i; if (k >= 0 && k < length) wsum[k] += WIN[i] * WIN[i]; } }
    for (i = 0; i < length; i++) wsum[i] = wsum[i] > 1e-6 ? 1 / wsum[i] : 0;
    function toSound() {                                // X -> x, two frames an inverse transform, overlap-added, the window's sum divided out
      var o2, s2, ar, ai, br2, bi2, two;
      for (i = 0; i < length; i++) x[i] = 0;
      for (f = 0; f < F; f += 2) {
        two = f + 1 < F; s = f * HOP - N + HOP; s2 = s + HOP; o = f * B; o2 = o + B;
        for (i = 0; i < N; i++) {                        // z = A + iB over the whole circle; above N/2 by symmetry
          if (i <= N / 2) { ar = XR[o + i]; ai = XI[o + i]; br2 = two ? XR[o2 + i] : 0; bi2 = two ? XI[o2 + i] : 0; }
          else { ar = XR[o + N - i]; ai = -XI[o + N - i]; br2 = two ? XR[o2 + N - i] : 0; bi2 = two ? -XI[o2 + N - i] : 0; }
          bre[i] = ar - bi2; bim[i] = ai + br2;
        }
        fftN(bre, bim, true);
        for (i = 0; i < N; i++) {
          k = s + i; if (k >= 0 && k < length) x[k] += bre[i] * WIN[i];
          if (two) { k = s2 + i; if (k >= 0 && k < length) x[k] += bim[i] * WIN[i]; }
        }
      }
      for (i = 0; i < length; i++) x[i] *= wsum[i];
    }
    function toPicture() {                              // x -> X, two frames a transform, then each bin scaled to the wanted height
      var r, m, g, zr, zi, wr, wi, o2, s2, two, j;
      for (f = 0; f < F; f += 2) {
        two = f + 1 < F; s = f * HOP - N + HOP; s2 = s + HOP; o = f * B; o2 = o + B;
        for (i = 0; i < N; i++) { k = s + i; bre[i] = (k >= 0 && k < length ? x[k] : 0) * WIN[i]; k = s2 + i; bim[i] = two && k >= 0 && k < length ? x[k] * WIN[i] : 0; }
        fftN(bre, bim, false);
        for (i = 0; i < B; i++) {
          j = i === 0 ? 0 : N - i; zr = bre[i]; zi = bim[i]; wr = bre[j]; wi = -bim[j];   // Z[k] and conj Z[N-k]
          r = (zr + wr) / 2; m = (zi + wi) / 2; g = Math.sqrt(r * r + m * m);            // the first frame's bin
          if (g > 1e-12) { g = M[o + i] / g; XR[o + i] = r * g; XI[o + i] = m * g; } else { XR[o + i] = M[o + i]; XI[o + i] = 0; }   // as atan2(0, 0) was
          if (two) {
            r = (zi - wi) / 2; m = (wr - zr) / 2; g = Math.sqrt(r * r + m * m);          // the second frame's bin
            if (g > 1e-12) { g = M[o2 + i] / g; XR[o2 + i] = r * g; XI[o2 + i] = m * g; } else { XR[o2 + i] = M[o2 + i]; XI[o2 + i] = 0; }
          }
        }
      }
    }
    if (fast) { CR = new Float32Array(F * B); CI = new Float32Array(F * B); PR = new Float32Array(F * B); PI = new Float32Array(F * B); }
    toSound();
    for (n = 0; n < turns; n++) {
      toPicture();
      if (fast) {                                       // c = this projection; the next start is c pushed on by (c - last c)
        for (i = 0; i < F * B; i++) { CR[i] = XR[i]; CI[i] = XI[i]; }
        if (n > 0) for (i = 0; i < F * B; i++) { XR[i] = CR[i] + alpha * (CR[i] - PR[i]); XI[i] = CI[i] + alpha * (CI[i] - PI[i]); }
        for (i = 0; i < F * B; i++) { PR[i] = CR[i]; PI[i] = CI[i]; }
        if (n === turns - 1) for (i = 0; i < F * B; i++) { XR[i] = CR[i]; XI[i] = CI[i]; }   // the last sound is of the projection itself
      }
      toSound();
    }
    return x;
  }

  function gust(pcm, sr, opt) {
    opt = opt || {};
    // the house gust, chosen by ear (user1, 3 x 2026): "a half-effect of both" the light
    // blur and the blur along time. 50 ms, and 26 Hz, which lets in half the air light did.
    var ms = opt.ms === undefined ? 50 : opt.ms, hz = opt.hz === undefined ? 26 : opt.hz, mix = opt.mix === undefined ? 1 : opt.mix;
    var p = picture(pcm);
    var cols = ms / 1000 * sr / HOP / 2, rows = hz / (sr / N) / 2;   // the bell's width: half the reach asked for
    var soft = blur(p.mag, cols, rows);
    var wet = fromPicture(soft, pcm.length, p.pha, opt.turns, opt.fast), out = new Float32Array(pcm.length), i, ew = 0, ed = 0;
    for (i = 0; i < pcm.length; i++) { ew += wet[i] * wet[i]; ed += pcm[i] * pcm[i]; }
    var g = ew > 0 ? Math.sqrt(ed / ew) : 1, peak = 0;    // the blurred sound, brought to the plain one's loudness
    for (i = 0; i < pcm.length; i++) { out[i] = (1 - mix) * pcm[i] + mix * g * wet[i]; var a = out[i] < 0 ? -out[i] : out[i]; if (a > peak) peak = a; }
    if (peak > 0.95) for (i = 0; i < out.length; i++) out[i] = out[i] / peak * 0.9;
    return out;
  }

  // THE DIAL. A blur melts the stripes and everything near them. This reaches
  // for the stripes alone. Take one column of the picture, in decibels, and
  // transform it once more along pitch: the slow part of the answer is the
  // mouth's shape (the formants); everything faster is the stripes (the
  // harmonics; a voice at 128 Hz puts them 128 Hz apart, and they gather at one
  // place in this second picture, the reciprocal). Scale only the fast part:
  //     k = -1   no stripes at all: the mouth, whispering
  //     k =  0   as it was
  //     k = +1   stripes twice as deep, in decibels: less between the
  //              harmonics, a cleaner and more ringing note
  // The mouth's shape, the timing and the loudness of each moment are kept.
  function dialPicture(mag, k, sr) {
    var cut = Math.round(sr / 500), out = [], f, i;       // slower than this is the mouth; a voice's pitch lies beyond it
    var loud = 0; for (f = 0; f < mag.length; f++) { var e0 = 0; for (i = 0; i <= N / 2; i++) e0 += mag[f][i] * mag[f][i]; if (e0 > loud) loud = e0; }
    for (f = 0; f < mag.length; f++) {
      var re = new Float32Array(N), im = new Float32Array(N), m = mag[f], e1 = 0, e2 = 0;
      for (i = 0; i <= N / 2; i++) e1 += m[i] * m[i];
      if (e1 < loud * 1e-5) { out.push(Float32Array.from(m)); continue; }   // near silence: leave it be
      for (i = 0; i <= N / 2; i++) { re[i] = Math.log(m[i] + 1e-7); if (i > 0 && i < N / 2) re[N - i] = re[i]; }
      fft(re, im, false);
      for (i = cut; i <= N - cut; i++) { re[i] *= (1 + k); im[i] *= (1 + k); }
      fft(re, im, true);
      var o = new Float32Array(N / 2 + 1);
      for (i = 0; i <= N / 2; i++) { var d = re[i] - Math.log(m[i] + 1e-7); if (d > 3) d = 3; else if (d < -3) d = -3; o[i] = m[i] * Math.exp(d); e2 += o[i] * o[i]; }
      var g = e2 > 0 ? Math.sqrt(e1 / e2) : 1;             // each moment keeps its own loudness
      for (i = 0; i <= N / 2; i++) o[i] *= g;
      out.push(o);
    }
    return out;
  }
  function dial(pcm, sr, k, opt) {
    var p = picture(pcm), x = fromPicture(dialPicture(p.mag, k, sr), pcm.length, p.pha, opt && opt.turns, opt && opt.fast), i, peak = 0;
    for (i = 0; i < x.length; i++) { var a = x[i] < 0 ? -x[i] : x[i]; if (a > peak) peak = a; }
    if (peak > 0) for (i = 0; i < x.length; i++) x[i] = x[i] / peak * 0.9;
    return x;
  }
  // two sounds of one length, in proportion: 0.78 of the first, 0.22 of the second
  function blend(a, b, share) {
    var n = Math.min(a.length, b.length), out = new Float32Array(n), i, peak = 0;
    for (i = 0; i < n; i++) { out[i] = share * a[i] + (1 - share) * b[i]; var v = out[i] < 0 ? -out[i] : out[i]; if (v > peak) peak = v; }
    if (peak > 0) for (i = 0; i < n; i++) out[i] = out[i] / peak * 0.9;
    return out;
  }

  // THE SECOND PICTURE. The picture, in decibels, is itself transformed, both ways. What repeats in the picture
  // becomes a place in this one:
  //   up      how closely stripes are stacked along pitch, as its reciprocal, a time. Harmonics 125 Hz apart
  //           make one spot at 1/125 s = 8 ms. The pitch, as a place.
  //   across  how fast the picture changes along time, in beats per second. Syllables sit near 4.
  //           Left and right of the middle are the two senses of a glide: stripes rising, stripes falling.
  // (user1 asked for it: "change over change over time".) Returns rows q = 0..Q, each T wide; column r is rate
  // r * perStep for r <= T/2, and the negative rates after that.
  function second(mag, sr) {
    var F = mag.length, B = N / 2, T = 1, f, k, q, top = 1e-9, mean = 0;
    while (T < F) T <<= 1;
    for (f = 0; f < F; f++) for (k = 0; k < B; k++) if (mag[f][k] > top) top = mag[f][k];
    var db = [];
    for (f = 0; f < F; f++) { var d = new Float32Array(B); for (k = 0; k < B; k++) { d[k] = Math.max(-60, 20 * Math.log(mag[f][k] / top + 1e-9) / Math.LN10); mean += d[k]; } db.push(d); }
    mean /= F * B;
    var RE = [], IM = [];
    for (f = 0; f < T; f++) {                           // along pitch, one column at a time
      var re = new Float32Array(B), im = new Float32Array(B);
      if (f < F) { var wf = 0.5 - 0.5 * Math.cos(2 * Math.PI * (f + 0.5) / F); for (k = 0; k < B; k++) re[k] = (db[f][k] - mean) * wf * (0.5 - 0.5 * Math.cos(2 * Math.PI * (k + 0.5) / B)); }
      fft(re, im, false); RE.push(re); IM.push(im);
    }
    var out = [];
    for (q = 0; q <= B / 2; q++) {                      // then along time, one row at a time
      var r2 = new Float32Array(T), i2 = new Float32Array(T), m = new Float32Array(T);
      for (f = 0; f < T; f++) { r2[f] = RE[f][q]; i2[f] = IM[f][q]; }
      fft(r2, i2, false);
      for (f = 0; f < T; f++) m[f] = Math.sqrt(r2[f] * r2[f] + i2[f] * i2[f]);
      out.push(m);
    }
    return { mag: out, T: T, Q: B / 2, perStep: (sr || 16000) / HOP / T, msPerRow: 2000 / (sr || 16000) };
  }

  var GUST = { second: second, gust: gust, dial: dial, blend: blend, picture: picture, sound: sound, blur: blur, dialPicture: dialPicture, fromPicture: fromPicture, fromPictureByPhases: fromPictureByPhases, N: N, HOP: HOP };
  if (typeof module !== 'undefined' && module.exports) module.exports = GUST;
  else root.GUST = GUST;
})(root);

// ======== chain.js ========
/* chain.js -- ecouter's bench, as one function. The page and the test both
   call this, so the test tests what the page plays.

     settings -> sound, in this order:
       1 the throat sings the score, with so much LIFE
       2 THE DIAL turns the stripes down toward a whisper or up toward a ring
       3 THE GUST blurs the picture a little, along time and along pitch
       4 WEAR blends in the ruler: 78 means 78% ruler, 22% what steps 1-3 made
       5 MELLOW, the kind microphone, last

   quiet + plur. */
(function (root) {
  'use strict';
  var V = root.VOICEBOX || require('./voicebox.js');
  var G = root.GUST || require('./gust.js');
  var S = root.AIU || require('./aiu.score.js');
  var SR = 16000;

  // PLAIN is the living voice with nothing done to it; every preset is PLAIN and a few changes.
  var PLAIN = { a: 120, i: 165, u: 98, life: 1, dial: 0, gust: false, gustMs: 50, gustHz: 26, wear: 0, mellow: false, stocking: false, ess: false, entone: false, govern: true, conduction: true, fgl: false };   // fgl: the fast search, ten turns with momentum, for ears to judge (11 x 2026)   // govern: the throat's governor (11 x 2026), off only to hear what it does; conduction: the Lexillogue's tune (false is the apology), read by phones.frames through whoever calls it
  var PRESETS = {
    'The Ruler':        { life: 0 },
    'Alive':            { },
    'House Gust':       { gust: true },
    'Worn, 78 and 22':  { gust: true, wear: 78 },
    'Worn, 79, stockinged': { gust: true, wear: 79, stocking: true },   // the house voice from 6 x 2026: user1 chose it over its siblings in four takes running, "the best map to DECtalk's sound"
    'Worn, 79, stockinged, entoned': { gust: true, wear: 79, stocking: true, entone: true, fgl: true, ess: true, mellow: true },   // ess and mellow from 11 x 2026 (user1: "The bright esses brushed my ear wrongly ... Mellow subdued that"); fgl from 11 x 2026: user1 "cannot detect the difference of 4xFGL. If anything it enflows better ... a welcome default to leave on"   // the house from 9 x 2026: "That entone, Worn's latest, has joined my heart. I do commend it to the house."
    'The Old Sailor':   { dial: -0.5 },   // was "A Person's Breath": it matched a person's air and had twice a person's roughness. Named by ear.
    'The Young Tenor':  { dial: 0.5 },
    'A Whisper':        { dial: -1 }
  };
  function settings(over) { var s = {}, k; for (k in PLAIN) s[k] = PLAIN[k]; for (k in (over || {})) s[k] = over[k]; return s; }
  // the house voice, chosen by ear (user1, 3 x 2026): "Worn is my house voice of choice."
  var HOUSE_NAME = 'Worn, 79, stockinged, entoned';   // 'Worn, 78 and 22' from 3 x 2026; 'Worn, 79, stockinged' from 6 x
  function house() { return settings(PRESETS[HOUSE_NAME]); }

  function score(s) {                                   // the a-i-u, at the pitches asked for
    var hz = [s.a, s.a, s.a, s.i, s.i, s.u, s.u, s.u * 90 / 98];   // the last frame falls as the first score's did, 98 to 90
    return S.score.map(function (f, n) { return { ms: f.ms, f0: hz[n], f: f.f, voice: f.voice }; });
  }

  // THE STOCKING (user1, 6 x 2026, on the second phrase: it "needs an ess filter or a nylon stocking or whatever
  // tubecasters do"). What a stocking over the capsule does, after the fact: a shelf down above about 4 kHz (two
  // gentle stages, about 6 dB), and a low-pass near 6 kHz. It touches the s most and the vowels hardly at all.
  function stocking(pcm, sr) {
    var n = pcm.length, out = new Float32Array(n), i, x, a, b;
    var ks = Math.exp(-2 * Math.PI * 4000 / sr), kl = Math.exp(-2 * Math.PI * 6000 / sr), s1 = 0, s2 = 0, l1 = 0, l2 = 0;
    for (i = 0; i < n; i++) {
      x = pcm[i];
      s1 = s1 * ks + x * (1 - ks); s2 = s2 * ks + s1 * (1 - ks);   // what lies below 4 kHz, twice over
      a = 0.5 * x + 0.5 * s2;                                     // the shelf: half of what is above it
      l1 = l1 * kl + a * (1 - kl); l2 = l2 * kl + l1 * (1 - kl);   // and the low-pass
      out[i] = l2;
    }
    var peak = 0; for (i = 0; i < n; i++) { b = out[i] < 0 ? -out[i] : out[i]; if (b > peak) peak = b; }
    if (peak > 0) for (i = 0; i < n; i++) out[i] = out[i] / peak * 0.9;
    return out;
  }
  // THE ESS FILTER (user1, 6 x 2026: "an ess filter or a nylon stocking"; the stocking dulled the t's burst with the
  // s, and the machines lost "test"). A de-esser: the band above 4 kHz is followed with a slow attack, about 25 ms,
  // and pressed down by up to 9 dB when it has stood above its threshold that long. A t's burst of 12 ms passes
  // whole; an s of 60 ms is pressed. The vowels, with little above 4 kHz, are not touched.
  function ess(pcm, sr) {
    var n = pcm.length, out = new Float32Array(n), i, x, lo, hi, e = 0, g, ka = Math.exp(-1 / (0.025 * sr)), kr = Math.exp(-1 / (0.040 * sr));
    var k = Math.exp(-2 * Math.PI * 4000 / sr), l1 = 0, l2 = 0, thr = 0.03, floor = 0.35;
    for (i = 0; i < n; i++) {
      x = pcm[i];
      l1 = l1 * k + x * (1 - k); l2 = l2 * k + l1 * (1 - k);   // below 4 kHz
      lo = l2; hi = x - l2;                                    // and above it
      var a = hi < 0 ? -hi : hi;
      e = a > e ? e * ka + a * (1 - ka) : e * kr + a * (1 - kr);   // the band's level, slow to rise, slower to fall
      g = e > thr ? Math.max(floor, thr / e) : 1;             // press it back toward the threshold, to the floor
      out[i] = lo + hi * g;
    }
    return out;
  }
  // ENTONE (user1's word, 7 x 2026; the idea his, 6 x: "a layer on top of the audio processing stack ... a 'harmonizer'
  // might do it on the cheap"). A comb locked to the score's own pitch: each sample is added to the sample one
  // period earlier, a little, so the harmonics the throat is singing are reinforced and what lies between them,
  // the noise, is pressed. The score knows f0 at every moment, so the comb follows the note exactly; and it is
  // gated by the score's voice, so an s, a burst and a breath pass it untouched. The lens, as a post-stage.
  function entone(pcm, sr, frames, amount) {
    var n = pcm.length, out = new Float32Array(n), i, k, len, t, f0, v, from = frames[0], at = 0, P, j, fl, fr, back;
    amount = amount === undefined ? 0.45 : amount;
    for (i = 0; i < frames.length; i++) {
      var to = frames[i]; len = Math.round(to.ms * sr / 1000);
      for (k = 0; k < len && at < n; k++, at++) {
        t = (k + 1) / len; f0 = from.f0 + (to.f0 - from.f0) * t; v = from.voice + (to.voice - from.voice) * t;
        P = sr / Math.max(40, f0); j = at - P; fl = Math.floor(j); fr = j - fl;
        back = fl >= 1 ? out[fl] * (1 - fr) + out[fl + 1] * fr : 0;
        out[at] = pcm[at] + amount * v * v * back;   // the voice squared: a tail at a quarter voice gets a sixteenth of comb (user1, 10 x: "you-oo")
      }
      from = to;
    }
    for (; at < n; at++) out[at] = pcm[at];
    var peak = 0; for (i = 0; i < n; i++) { var a = out[i] < 0 ? -out[i] : out[i]; if (a > peak) peak = a; }
    if (peak > 0) for (i = 0; i < n; i++) out[i] = out[i] / peak * 0.9;
    return out;
  }
  // THE LARDER (10 x 2026; user1: a suite "which cannot complete itself in 21 minutes on an i10K"). The throat
  // sings two seconds in a fifth of a second on QuickJS; the gust's forty turns take thirty-six seconds, and the
  // checks sang the same sound through the same gust every run. Under QuickJS a gusted or dialled sound is kept
  // on disk in temp-cache\, named by a hash of the sound and the settings, and served from there while nothing has
  // changed. A page has no disk and none of this; the sound is the same either way. (It was the larder until
  // 28 x 2026, when user1 asked that a temp cache be called one, "or devs will triple-think it". Set
  // CHAIN.cache to another folder, or to null to keep nothing on disk.)
  var fs = typeof require === 'function' && typeof window === 'undefined' ? require('fs') : null;
  function hash(x, tag) {                                 // FNV-1a over the samples and the tag
    var h = 0x811c9dc5, i, v;
    for (i = 0; i < x.length; i++) { v = Math.round(x[i] * 32767) & 0xffff; h ^= v; h = Math.imul(h, 0x01000193); }
    for (i = 0; i < tag.length; i++) { h ^= tag.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16);
  }
  function kept(x, tag, cook) {
    var dir = CHAIN.cache;
    if (!fs || !dir) return cook();
    var name = dir + '/' + hash(x, tag) + '.f32', b, out, i;
    if (fs.existsSync(name)) { b = fs.readFileSync(name); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4).slice(); }
    out = cook(); try { fs.mkdirSync(dir); } catch (e) {}
    b = new Uint8Array(out.buffer, out.byteOffset, out.byteLength); fs.writeFileSync(name, b);
    return out;
  }
  function make(s, turns) {
    var sc = s.frames || score(s), steps = [], share = V.GOV.share, x;   // s.frames: any other score, such as hello.score.js
    if (s.govern === false) V.GOV.share = 10;                                  // the governor stood down: nothing stands over ten times the whole
    try { x = V.sing(sc, SR, { life: s.life }); } finally { V.GOV.share = share; }
    steps.push('sung, life ' + s.life + (s.govern === false ? ', ungoverned' : ''));
    var fast = s.fgl === true, tn = fast ? (turns === undefined ? 10 : turns) : turns, tag = ' ' + tn + (fast ? ' fast' : '');
    if (s.dial) { x = kept(x, 'dial ' + s.dial + tag, function () { return G.dial(x, SR, s.dial, { turns: tn, fast: fast }); }); steps.push('dial ' + (s.dial > 0 ? '+' : '') + s.dial); }
    if (s.gust) { x = kept(x, 'gust ' + s.gustMs + ' ' + s.gustHz + tag, function () { return G.gust(x, SR, { ms: s.gustMs, hz: s.gustHz, turns: tn, fast: fast }); }); steps.push('gust ' + s.gustMs + ' ms, ' + s.gustHz + ' Hz' + (fast ? ', fast' : '')); }
    if (s.wear > 0) { x = G.blend(V.sing(sc, SR, { life: 0 }), x, s.wear / 100); steps.push(s.wear + '% ruler'); }
    if (s.mellow) { x = V.mellow(x, SR); steps.push('mellow'); }
    if (s.entone) { x = entone(x, SR, sc, s.entone === true ? undefined : s.entone); steps.push('entone'); }
    if (s.stocking) { x = stocking(x, SR); steps.push('stocking'); }
    if (s.ess) { x = ess(x, SR); steps.push('ess'); }
    return { pcm: x, sr: SR, steps: steps };
  }

  var CHAIN = { make: make, settings: settings, house: house, score: score, PLAIN: PLAIN, HOUSE_NAME: HOUSE_NAME, PRESETS: PRESETS, SR: SR, cache: 'temp-cache' };
  if (typeof module !== 'undefined' && module.exports) module.exports = CHAIN;
  else root.ECOUTER = CHAIN;
})(root);

// ======== phones.js ========
/* phones.js -- the Lexillogue's first brick: every
   phoneme code of NRL Report 7948 (as english.c
   lists them), and what the throat does for each.
   Then a builder: a string of those codes becomes a
   score of frames that voicebox.js can sing.

     var fr = PHONES.frames('pUHt');     // "put"
     var fr = PHONES.frames('hEHlOW', { f0: 120 });

   The codes: IY bEEt, IH bIt, EY gAte, EH gEt, AE
   fAt, AA fAther, AO lAWn, OW lOne, UH fUll, UW
   fOOl, ER mURdER, AX About, AH bUt, AY hIde, AW
   hOW, OY tOY; p b t d k g f v TH DH s z SH ZH HH m
   n NG l w y r CH j WH. A space is a pause.

   Places: Peterson and Barney's men (1952) for the
   vowels, Klatt (1980) for the rest, rounded, and
   what the three scores taught (hello, reading,
   question). A fricative's mouth is the vowel
   beside it. A stop is a closure, a burst, and for
   p t k a breath after. A nasal is a hum with the
   nose's zero (voicebox: nasal, zero). Each phone
   has a length in ms, for a careful reader at a
   test; the tune rules will bend these later.

   Values are reached at a frame's END (voicebox);
   so each phone is two frames: an approach, where
   the glide from the last sound arrives, and a
   hold. That is the smoothed join: the throat's own
   glide, given a moment. */
(function (root) {
  'use strict';
  // the vent's places, as voicebox.js has them; kept here too so the Lexillogue and the lamp can stand without a
  // throat (Viriditas tints, Ecouter speaks: two libraries from one workshop, 12 x 2026)
  var VENT = { s: [4600, 1600], sh: [3000, 2000], f: [1500, 3500], th: [4000, 3500], t: [4000, 2500] };
  // (28 x 2026, user1: "voicebox.js is only the throat. Why isn't it found?") In the workshop it sits beside this
  // file; in a published library it is folded inside ecouter.js, and viriditas.js has no throat at all, so under
  // node a bare require found nothing and threw. Ask for it, and if it isn't there, the vent's own places serve.
  var HISS = root.VOICEBOX ? root.VOICEBOX.HISS : (function () {
    if (typeof require !== 'function') return VENT;
    try { return require('./voicebox.js').HISS || VENT; } catch (e) { return VENT; }
  })();
  var F = {                      // F1 F2 F3
    IY: [270, 2290, 3010], IH: [390, 1990, 2550],
    EH: [530, 1840, 2480], AE: [660, 1720, 2410],
    AA: [730, 1090, 2440], AO: [570, 840, 2410],
    UH: [440, 1020, 2240], UW: [300, 870, 2240],
    ER: [490, 1350, 1690], AX: [500, 1500, 2500],
    AH: [640, 1190, 2390],
    l: [310, 1050, 2880], r: [460, 1300, 1700],
    w: [300, 870, 2240], y: [280, 2200, 3000],
    m: [280, 1000, 2200], n: [280, 1700, 2600],
    NG: [300, 1200, 2300],
    lips: [250, 900, 2300],      // shut at the lips: p b
    teeth: [300, 1700, 2600],    // shut at the teeth: t d
    velum: [300, 2000, 2300],    // shut at the back: k g
    sh: [300, 1800, 2400]        // the mouth of SH ZH CH j
  };
  // bursts, beside the vent's places in voicebox
  var AT = {
    s: HISS.s, sh: HISS.sh, f: HISS.f, th: HISS.th,
    t: HISS.t,
    k: [1900, 900],              // compact, at the back; before a front vowel the burst rises (kFront)
    kFront: [2900, 900],         // every listener heard the k at 2.3 kHz as a p (take 15)
    p: [1200, 3000]              // diffuse, at the lips
  };
  // the table. kind: v vowel, d diphthong (from, to),
  // g glide, n nasal, f fricative, s stop, h breath.
  // voice 0..1, hiss 0..1 at a place, zero for nasals.
  var T = {
    IY: { kind: 'v', f: F.IY, ms: 130 },
    IH: { kind: 'v', f: F.IH, ms: 90 },
    EH: { kind: 'v', f: F.EH, ms: 110 },
    AE: { kind: 'v', f: F.AE, ms: 140 },
    AA: { kind: 'v', f: F.AA, ms: 140 },
    AO: { kind: 'v', f: F.AO, ms: 140 },
    UH: { kind: 'v', f: F.UH, ms: 90 },
    UW: { kind: 'v', f: F.UW, ms: 130 },
    ER: { kind: 'v', f: F.ER, ms: 130 },
    AX: { kind: 'v', f: F.AX, ms: 70 },
    AH: { kind: 'v', f: F.AH, ms: 100 },
    EY: { kind: 'd', f: F.EH, to: F.IH, ms: 160 },
    OW: { kind: 'd', f: F.AO, to: F.UH, ms: 160 },
    AY: { kind: 'd', f: F.AA, to: F.IH, ms: 170 },
    AW: { kind: 'd', f: F.AA, to: F.UH, ms: 170 },
    OY: { kind: 'd', f: F.AO, to: F.IH, ms: 170 },
    l: { kind: 'g', f: F.l, ms: 60, voice: 0.7 },
    r: { kind: 'g', f: F.r, ms: 70, voice: 0.7 },
    w: { kind: 'g', f: F.w, ms: 60, voice: 0.7 },
    y: { kind: 'g', f: F.y, ms: 60, voice: 0.7 },
    WH: { kind: 'g', f: F.w, ms: 70, voice: 0.5,
      breath: 0.3 },
    m: { kind: 'n', f: F.m, ms: 70, zero: [1000, 300] },
    n: { kind: 'n', f: F.n, ms: 70, zero: [1600, 300] },
    NG: { kind: 'n', f: F.NG, ms: 80, zero: [2600, 400] },
    f: { kind: 'f', at: AT.f, ms: 90, hiss: 0.55 },
    v: { kind: 'f', at: AT.f, ms: 60, hiss: 0.55,
      voice: 0.5 },
    TH: { kind: 'f', at: AT.th, ms: 90, hiss: 0.6 },
    DH: { kind: 'f', at: AT.th, ms: 50, hiss: 0.6,
      voice: 0.45 },
    s: { kind: 'f', at: AT.s, ms: 110, hiss: 0.35 },
    z: { kind: 'f', at: AT.s, ms: 80, hiss: 0.35,
      voice: 0.5 },
    SH: { kind: 'f', at: AT.sh, ms: 120, hiss: 0.5,
      f: F.sh },
    ZH: { kind: 'f', at: AT.sh, ms: 80, hiss: 0.5,
      f: F.sh, voice: 0.5 },
    // stops: shut this long, burst this long at this
    // place and strength, then breath this long
    p: { kind: 's', f: F.lips, shut: 60, burst: 10,
      at: AT.p, pop: 0.3, air: 40 },
    b: { kind: 's', f: F.lips, shut: 50, burst: 12,
      at: AT.f, pop: 0.35, hum: 0.4 },
    t: { kind: 's', f: F.teeth, shut: 50, burst: 14,
      at: AT.t, pop: 0.9, air: 30 },
    d: { kind: 's', f: F.teeth, shut: 50, burst: 12,
      at: AT.t, pop: 0.5, hum: 0.3 },
    k: { kind: 's', f: F.velum, shut: 60, burst: 20,   // 24 was "a little long, but not incorrectly so" (user1, 11 x)
      at: AT.k, pop: 0.8, air: 45 },
    g: { kind: 's', f: F.velum, shut: 50, burst: 14,
      at: AT.k, pop: 0.5, hum: 0.3 },
    CH: { kind: 's', f: F.sh, shut: 50, burst: 80,
      at: AT.sh, pop: 0.5 },
    j: { kind: 's', f: F.sh, shut: 40, burst: 60,
      at: AT.sh, pop: 0.5, hum: 0.3, jv: 0.5 },
    HH: { kind: 'h', ms: 60, breath: 0.5, voice: 0.08 }
  };
  T.h = T.HH;                    // english.c writes the h of How as 'h', not 'HH'
  // the marks of punctuation, as the Lexillogue keeps them: pauses, and where a sentence ends and how
  // user1, 11 x 2026: "A semicolon is between comma and period - so among those, then, semi's period of rest must
  // be found. This is nearly the same as indash. Colon has its own life: it must pentively present a momentary
  // conclusion, then explain it ... the tentative raise of the Question mark! For while that curves, !exclam is
  // Extremely Vertical!" Each mark is a rest, and says how the stretch before it ends (see TUNE).
  T[','] = { kind: 'p', ms: 120 };
  T[';'] = { kind: 'p', ms: 170, end: 'half' };
  T['-'] = { kind: 'p', ms: 170, end: 'half' };
  T[':'] = { kind: 'p', ms: 180, end: 'hold' };
  T['.'] = { kind: 'p', ms: 220, end: 'fall' };
  T['!'] = { kind: 'p', ms: 220, end: 'exclaim' };
  T['?'] = { kind: 'p', ms: 220, end: 'rise' };
  // BEEPAGES (user1, 10 x 2026, after Engelbart's bips: "with perhaps two correct notes, suggest that a parenthesis
  // had opened? Then after its enclosure has been sounded, those two notes in temporal inversion"): characters
  // that sound rather than say. An opening bracket is deep-beep, a note below home and then home; its close is
  // beep-deep, the same two notes reversed in time, so the ear hears the second as the answer to the first. The
  // family is told by the interval: a third for the round, a fourth for the square, a fifth for the curly; the
  // underbar a single low bip. Imitable by a person, teachable to a child, ten times faster than "open
  // parenthesis". The Lexillogue hands them through only when its beeps are on; the voice hums them on a closed
  // mouth at the note, and the lamp tints them by it like anything else.
  var HUM = [300, 800, 2400];
  T['('] = { kind: 'b', ms: 100, f: HUM, notes: [-4, 0] };  T[')'] = { kind: 'b', ms: 100, f: HUM, notes: [0, -4] };
  T['['] = { kind: 'b', ms: 100, f: HUM, notes: [-5, 0] };  T[']'] = { kind: 'b', ms: 100, f: HUM, notes: [0, -5] };
  T['{'] = { kind: 'b', ms: 100, f: HUM, notes: [-7, 0] };  T['}'] = { kind: 'b', ms: 100, f: HUM, notes: [0, -7] };
  T['_'] = { kind: 'b', ms: 70, f: HUM, notes: [-7] };
  var BEEPS = '()[]{}_';
  // the cable, by the mark that ends the stretch: the pitch at its start, its middle and its end, as shares of
  // the voice's own. fall: back to level. half: not quite back, more is coming. hold: up, presenting what the
  // next stretch explains. rise: the question's lift is added at the end. exclaim: higher throughout, and the
  // last 150 ms drop hard, the vertical.
  var TUNE = { fall: [1.06, 0.96, 1.06], half: [1.06, 0.96, 1.02], hold: [1.06, 0.98, 1.09], rise: [1.06, 0.96, 1.06], exclaim: [1.10, 1.00, 1.12] };
  var CODES = Object.keys(T);
  // 'pUHt' -> ['p', 'UH', 't']; a space stays a space
  function split(s) {
    var out = [], i = 0, two;
    while (i < s.length) {
      if (s.charAt(i) === ' ') { if (out.length && out[out.length - 1] !== ' ') out.push(' '); i++; continue; }   // one pause between codes, none at the start
      two = s.substr(i, 2);
      if (T[two]) { out.push(two); i += 2; continue; }
      if (T[s.charAt(i)]) { out.push(s.charAt(i)); i++; continue; }
      throw new Error('not a phoneme code: ' + s.substr(i));
    }
    return out;
  }
  // the mouth a mouthless phone borrows: the vowel
  // or glide after it, else the one before, else AX
  function mouth(codes, i) {
    var j, p;
    for (j = i + 1; j < codes.length; j++) {
      p = T[codes[j]]; if (!p || p.kind === 'p') break; if (p.f) return p.f; }
    for (j = i - 1; j >= 0; j--) {
      p = T[codes[j]]; if (!p || p.kind === 'p') break;
      if (p.f) return p.to || p.f; }
    return F.AX;
  }
  function isFront(c) { return c === 'IY' || c === 'IH' || c === 'EY' || c === 'EH' || c === 'AE' || c === 'y'; }
  // THE CONDUCTION (user1, 11 x 2026). As first laid, each string
  // lost a fifth of its pitch from first phone to last: "an apology
  // (one's energy starts high and exhausts, sadly, tonelessly,
  // carelessly, as if to model spiritual defeat)". Asked for instead:
  // "a conduction (one's energy begins high, dips a little, then
  // returns to level, as the cable between two telephone poles)".
  // So, per sentence: the pitch starts six hundredths above the
  // voice's own, sags to four below at the middle, and is back at
  // six above at the full stop. A question keeps the sag and lifts
  // a quarter over its last third, as the question score did, but
  // over no more than its last 2.1 seconds however long it runs.
  function lenOf(p, pause, scale) {
    if (!p) return pause;
    if (p.kind === 's') return p.shut + p.burst + (p.air || 0);
    if (p.kind === 'v' || p.kind === 'd') return vowelMs(p, scale || 1);
    return p.ms;
  }
  function vowelMs(p, scale) {          // a vowel's length as phrased: its parts rounded as the frames are
    var a = Math.round(p.ms * scale);
    return p.kind === 'd' ? Math.round(a * 0.3) + Math.round(a * 0.25) + Math.round(a * 0.45) : Math.round(a * 0.35) + Math.round(a * 0.65);
  }
  function sentences(codes, pause, scale) {    // -> [{ from, to (ms), end }] one per sentence
    var out = [], start = 0, at = 0, i, p;
    for (i = 0; i < codes.length; i++) {
      p = T[codes[i]];
      if (p && p.kind === 'p' && p.end) { out.push({ from: start, to: at, end: p.end }); at += p.ms; start = at; continue; }
      at += lenOf(p, pause, scale ? scale[i] : 1);
    }
    if (at > start) out.push({ from: start, to: at, end: 'fall' });
    return out;
  }
  // PHRASING (user1, 11 x 2026). As first laid, every phone had its
  // table length, every vowel the same weight, and every space an 80
  // ms hole: "PULSED RO BOTIC ALLY ACROSSE THE SYLL ABLES instead of
  // enflow into clumpwords." Two tendencies, in his words: "We wish
  // to be German. Words want to roll together as if in stretchy
  // bags, to seek one another and imply interphase"; and "We wish to
  // be Jazzmen. There is a lumpity-dumpity to natural phrasing, a
  // backbeat-rhythm. Pa-dum, pa-dum." So:
  //   the German: a space is 40 ms, and where voiced sounds stand on
  //   both sides of it the voice leans across at a third instead of
  //   stopping; glides and nasals keep more of their voice.
  //   the Jazzmen: a word of the small closed class (the, a, of, to,
  //   and, is, it, you ...) is weak: its vowels seven tenths long, a
  //   little quieter and lower. Any other word carries its stress on
  //   its first vowel: three tenths longer, full voice, five
  //   hundredths higher; its later vowels a little shorter. The last
  //   stressed vowel before a mark is lengthened again, as a sentence
  //   settles. A dictionary would place stress better; this is the
  //   rule a reader without one would use.
  var WEAK = {};
  ['DHAX', 'DHIY', 'AX', 'AE', 'EY', 'AEn', 'tUW', 'AXv', 'IHn', 'AEnd', 'IHz', 'IHt', 'AY', 'yUW', 'wIY', 'hIY', 'SHIY', 'AEt', 'AAn',
    'fAOr', 'AEz', 'wIHTH', 'DHAEt', 'DHIHs', 'bAHt', 'AOr', 'bAY', 'mAY', 'wAAz', 'AAr', 'bIY', 'hAEz', 'hAEd', 'wIHl', 'DHEY',
    'DHEHm', 'hIHz', 'hER', 'AHs', 'sOW', 'IHf', 'nAAt', 'dUW', 'dIHd', 'AXm', 'AYm', 'AYv', 'wAHz', 'frAAm', 'AEz', 'DHAEn', 'DHAEt']
    .forEach(function (w) { WEAK[w] = true; });
  function isVowelCode(c) { var p = T[c]; return !!p && (p.kind === 'v' || p.kind === 'd'); }
  function voicedCode(c) { var p = T[c]; return !!p && (p.kind === 'v' || p.kind === 'd' || p.kind === 'g' || p.kind === 'n' || (p.kind === 'f' && p.voice > 0) || (p.kind === 's' && p.hum > 0)); }
  // -> per code: the length scale, the voice, the pitch bump
  function phrase(codes) {
    var scale = [], voice = [], bump = [], i, j, k, word, vowels, weak, strong, lastStrong = -1;
    for (i = 0; i < codes.length; i++) { scale[i] = 1; voice[i] = 1; bump[i] = 1; }
    for (i = 0; i < codes.length; i++) {
      if (codes[i] === ' ' || (T[codes[i]] && T[codes[i]].kind === 'p')) continue;
      for (j = i; j < codes.length && codes[j] !== ' ' && !(T[codes[j]] && T[codes[j]].kind === 'p'); j++) {}
      word = codes.slice(i, j); vowels = []; for (k = i; k < j; k++) if (isVowelCode(codes[k])) vowels.push(k);
      weak = WEAK[word.join('')] === true; strong = weak || !vowels.length ? -1 : vowels[0];
      for (k = 0; k < vowels.length; k++) {
        if (weak) { scale[vowels[k]] = 0.7; voice[vowels[k]] = 0.8; bump[vowels[k]] = 0.98; }
        else if (vowels[k] === strong) { scale[vowels[k]] = 1.3; voice[vowels[k]] = 1; bump[vowels[k]] = 1.05; lastStrong = vowels[k]; }
        else { scale[vowels[k]] = 0.85; voice[vowels[k]] = 0.9; }
      }
      i = j - 1;
      // a mark after this word: the sentence settles on its last stressed vowel; an exclamation leans on it harder
      if (j < codes.length && T[codes[j]] && T[codes[j]].kind === 'p' && T[codes[j]].end && lastStrong >= 0) { scale[lastStrong] *= T[codes[j]].end === 'exclaim' ? 1.35 : 1.2; lastStrong = -1; }
    }
    return { scale: scale, voice: voice, bump: bump };
  }
  // frames(codes, { f0, pause, tune }) -> frames
  // f0: the voice's own pitch (118); pause: ms for a
  // space (40; 140 was "too much space between words",
  // user1 on take 15, and 80 still pulsed); tune:
  // 'conduction' (the default) or 'apology' (the
  // first form, a fifth lost across the whole)
  function frames(s, o) {
    o = o || {};
    var codes = typeof s === 'string' ? split(s) : s;
    var f0 = o.f0 || 118, tune = o.tune || 'conduction';
    var pause = o.pause || 40, out = [], total = 0, i, c, p, m, at = 0, ph = phrase(codes), bumpNow = 1;
    for (i = 0; i < codes.length; i++) total += lenOf(T[codes[i]], pause, ph.scale[i]);
    var sents = sentences(codes, pause, ph.scale);
    function hz() {
      if (tune === 'apology') return f0 * (1 - 0.2 * at / total);
      var k, sn = null, u, f;
      for (k = 0; k < sents.length; k++) if (at <= sents[k].to) { sn = sents[k]; break; }
      if (!sn) sn = sents[sents.length - 1];
      u = sn.to > sn.from ? Math.max(0, Math.min(1, (at - sn.from) / (sn.to - sn.from))) : 0;
      var tn = TUNE[sn.end] || TUNE.fall, s0 = tn[0], s1 = tn[1], s2 = tn[2];
      f = f0 * (s0 + (s2 - s0) * u + (s1 - (s0 + s2) / 2) * 4 * u * (1 - u));   // through the three: the cable, high at both poles, a sag between
      if (sn.end === 'exclaim') { var left = sn.to - at; if (left < 150) f *= 1 - 0.18 * (1 - left / 150); }   // the vertical: the last 150 ms fall hard
      if (sn.end === 'rise') {                                            // the question's lift: the last third, but never more than 2.1 s of it
        var span = Math.min((sn.to - sn.from) / 3, 2100), w = (at - (sn.to - span)) / span;   // (user1: "must always be reserved for the end. It cannot persist for many seconds")
        if (w > 0) f *= 1 + 0.25 * Math.pow(w, 1.5);
      }
      return f * bumpNow;
    }
    function fr(ms, f, voice, breath, hiss, place, nasal, zero) {
      at += ms;
      var x = { ms: ms, f0: hz(), f: f, voice: voice, breath: breath || 0,
        hiss: hiss || 0, ci: i };                             // ci: which code made this frame, for the lamp
      if (place) x.at = place;
      if (nasal) { x.nasal = nasal; x.zero = zero; }
      out.push(x);
    }
    for (i = 0; i < codes.length; i++) {
      c = codes[i]; p = T[c];
      bumpNow = ph.bump[i];
      if (!p) {                                                   // a space: the German. Voiced on both sides, the voice leans across
        var lean = i > 0 && i < codes.length - 1 && voicedCode(codes[i - 1]) && voicedCode(codes[i + 1]) ? 0.33 : 0;
        fr(Math.round(pause * 0.3), mouth(codes, i), lean); fr(Math.round(pause * 0.7), mouth(codes, i), lean); continue;
      }
      m = p.f || mouth(codes, i);
      var vms = p.kind === 'v' || p.kind === 'd' ? Math.round(p.ms * ph.scale[i]) : 0, vv = ph.voice[i];
      switch (p.kind) {
      case 'p':                                                 // a mark: silence, the mouth where it was
        fr(Math.round(p.ms * 0.3), m, 0); fr(Math.round(p.ms * 0.7), m, 0); break;
      case 'b': {                                               // a beepage: its notes, each a hum at a fixed interval from home, the tune set aside
        var nb = p.notes.length, q, each = Math.round(p.ms / nb);
        for (q = 0; q < nb; q++) { fr(each, p.f, 0.9); out[out.length - 1].f0 = f0 * Math.pow(2, p.notes[q] / 12); out[out.length - 1].beep = true; }
        break; }
      case 'v':                                                 // the Jazzmen: length, voice and height as phrased
        fr(Math.round(vms * 0.35), m, 0.95 * vv); fr(Math.round(vms * 0.65), m, 0.95 * vv); break;
      case 'd':
        fr(Math.round(vms * 0.3), m, 0.95 * vv); fr(Math.round(vms * 0.25), m, 0.95 * vv);
        fr(Math.round(vms * 0.45), p.to, 0.85 * vv); break;
      case 'g':
        fr(Math.round(p.ms * 0.5), m, Math.min(1, p.voice + 0.1), p.breath); fr(Math.round(p.ms * 0.5), m, Math.min(1, p.voice + 0.1), p.breath); break;
      case 'n':
        fr(Math.round(p.ms * 0.4), m, 0.75, 0, 0, null, 1, p.zero);
        fr(Math.round(p.ms * 0.6), m, 0.7, 0, 0, null, 1, p.zero); break;
      case 'f':
        fr(Math.round(p.ms * 0.35), m, p.voice || 0, 0, p.hiss * 0.85, p.at);
        fr(Math.round(p.ms * 0.45), m, p.voice || 0, 0, p.hiss, p.at);
        fr(Math.round(p.ms * 0.2), m, p.voice || 0, 0, p.hiss * 0.6, p.at); break;
      case 'h':
        fr(Math.round(p.ms * 0.4), m, p.voice, p.breath); fr(Math.round(p.ms * 0.6), m, p.voice, p.breath); break;
      case 's':
        // the closure: a voiced stop hums behind it a moment, then shuts; then silence
        if (p.hum) { fr(Math.round(p.shut * 0.4), m, p.hum); fr(Math.round(p.shut * 0.2), m, 0); fr(Math.round(p.shut * 0.4), m, 0); }
        else { fr(Math.round(p.shut * 0.4), m, 0); fr(Math.round(p.shut * 0.6), m, 0); }
        // the burst, at its own place; a j's is voiced. A k's rises before a front vowel; a final stop is lighter
        var last = i === codes.length - 1 || !T[codes[i + 1]] || T[codes[i + 1]].kind === 'p', place = p.at, pop = last ? p.pop * 0.6 : p.pop;
        if ((c === 'k' || c === 'g') && !last && isFront(codes[i + 1])) place = AT.kFront;
        fr(p.burst, m, p.jv || (p.hum ? 0.3 : 0), 0, pop, place);
        // the breath after p t k: through the mouth of what follows (0.45 at first: "rough and bright")
        if (p.air) fr(last ? Math.round(p.air * 0.6) : p.air, mouth(codes, i), 0.1, 0.3);
        break;
      }
    }
    return out;
  }
  var PHONES = { table: T, places: F, at: AT, codes: CODES, split: split, frames: frames, phrase: phrase, BEEPS: BEEPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = PHONES;
  else root.PHONES = PHONES;
})(root);

// ======== rules.js ========
// rules.js -- written by rules.make.js from english.c (NRL Report 7948, as John A. Wasser kept it, 1985);
// do not edit here. 355 rules in 27 groups. Public domain, as the source says.
(function (root) {
  var RULES = {
    " ": [[""," ",""," "],["","-","",""],[".","'S","","z"],["#:.E","'S","","z"],["#","'S","","z"],["","'","",""],["",",",""," "],["",".",""," "],["","?",""," "],["","!",""," "]],
    "A": [["","A"," ","AX"],[" ","ARE"," ","AAr"],[" ","AR","O","AXr"],["","AR","#","EHr"],["^","AS","#","EYs"],["","A","WA","AX"],["","AW","","AO"],[" :","ANY","","EHnIY"],["","A","^+#","EY"],["#:","ALLY","","AXlIY"],[" ","AL","#","AXl"],["","AGAIN","","AXgEHn"],["#:","AG","E","IHj"],["","A","^+:#","AE"],[" :","A","^+ ","EY"],["","A","^%","EY"],[" ","ARR","","AXr"],["","ARR","","AEr"],[" :","AR"," ","AAr"],["","AR"," ","ER"],["","AR","","AAr"],["","AIR","","EHr"],["","AI","","EY"],["","AY","","EY"],["","AU","","AO"],["#:","AL"," ","AXl"],["#:","ALS"," ","AXlz"],["","ALK","","AOk"],["","AL","^","AOl"],[" :","ABLE","","EYbAXl"],["","ABLE","","AXbAXl"],["","ANG","+","EYnj"],["","A","","AE"]],
    "B": [[" ","BE","^#","bIH"],["","BEING","","bIYIHNG"],[" ","BOTH"," ","bOWTH"],[" ","BUS","#","bIHz"],["","BUIL","","bIHl"],["","B","","b"]],
    "C": [[" ","CH","^","k"],["^E","CH","","k"],["","CH","","CH"],[" S","CI","#","sAY"],["","CI","A","SH"],["","CI","O","SH"],["","CI","EN","SH"],["","C","+","s"],["","CK","","k"],["","COM","%","kAHm"],["","C","","k"]],
    "D": [["#:","DED"," ","dIHd"],[".E","D"," ","d"],["#:^E","D"," ","t"],[" ","DE","^#","dIH"],[" ","DO"," ","dUW"],[" ","DOES","","dAHz"],[" ","DOING","","dUWIHNG"],[" ","DOW","","dAW"],["","DU","A","jUW"],["","D","","d"]],
    "E": [["#:","E"," ",""],["':^","E"," ",""],[" :","E"," ","IY"],["#","ED"," ","d"],["#:","E","D ",""],["","EV","ER","EHv"],["","E","^%","IY"],["","ERI","#","IYrIY"],["","ERI","","EHrIH"],["#:","ER","#","ER"],["","ER","#","EHr"],["","ER","","ER"],[" ","EVEN","","IYvEHn"],["#:","E","W",""],["T","EW","","UW"],["S","EW","","UW"],["R","EW","","UW"],["D","EW","","UW"],["L","EW","","UW"],["Z","EW","","UW"],["N","EW","","UW"],["J","EW","","UW"],["TH","EW","","UW"],["CH","EW","","UW"],["SH","EW","","UW"],["","EW","","yUW"],["","E","O","IY"],["#:S","ES"," ","IHz"],["#:C","ES"," ","IHz"],["#:G","ES"," ","IHz"],["#:Z","ES"," ","IHz"],["#:X","ES"," ","IHz"],["#:J","ES"," ","IHz"],["#:CH","ES"," ","IHz"],["#:SH","ES"," ","IHz"],["#:","E","S ",""],["#:","ELY"," ","lIY"],["#:","EMENT","","mEHnt"],["","EFUL","","fUHl"],["","EE","","IY"],["","EARN","","ERn"],[" ","EAR","^","ER"],["","EAD","","EHd"],["#:","EA"," ","IYAX"],["","EA","SU","EH"],["","EA","","IY"],["","EIGH","","EY"],["","EI","","IY"],[" ","EYE","","AY"],["","EY","","IY"],["","EU","","yUW"],["","E","","EH"]],
    "F": [["","FUL","","fUHl"],["","F","","f"]],
    "G": [["","GIV","","gIHv"],[" ","G","I^","g"],["","GE","T","gEH"],["SU","GGES","","gjEHs"],["","GG","","g"],[" B#","G","","g"],["","G","+","j"],["","GREAT","","grEYt"],["#","GH","",""],["","G","","g"]],
    "H": [[" ","HAV","","hAEv"],[" ","HERE","","hIYr"],[" ","HOUR","","AWER"],["","HOW","","hAW"],["","H","#","h"],["","H","",""]],
    "I": [[" ","IN","","IHn"],[" ","I"," ","AY"],["","IN","D","AYn"],["","IER","","IYER"],["#:R","IED","","IYd"],["","IED"," ","AYd"],["","IEN","","IYEHn"],["","IE","T","AYEH"],[" :","I","%","AY"],["","I","%","IY"],["","IE","","IY"],["","I","^+:#","IH"],["","IR","#","AYr"],["","IZ","%","AYz"],["","IS","%","AYz"],["","I","D%","AY"],["+^","I","^+","IH"],["","I","T%","AY"],["#:^","I","^+","IH"],["","I","^+","AY"],["","IR","","ER"],["","IGH","","AY"],["","ILD","","AYld"],["","IGN"," ","AYn"],["","IGN","^","AYn"],["","IGN","%","AYn"],["","IQUE","","IYk"],["","I","","IH"]],
    "J": [["","J","","j"]],
    "K": [[" ","K","N",""],["","K","","k"]],
    "L": [["","LO","C#","lOW"],["L","L","",""],["#:^","L","%","AXl"],["","LEAD","","lIYd"],["","L","","l"]],
    "M": [["","MOV","","mUWv"],["","M","","m"]],
    "N": [["E","NG","+","nj"],["","NG","R","NGg"],["","NG","#","NGg"],["","NGL","%","NGgAXl"],["","NG","","NG"],["","NK","","NGk"],[" ","NOW"," ","nAW"],["","N","","n"]],
    "O": [["","OF"," ","AXv"],["","OROUGH","","EROW"],["#:","OR"," ","ER"],["#:","ORS"," ","ERz"],["","OR","","AOr"],[" ","ONE","","wAHn"],["","OW","","OW"],[" ","OVER","","OWvER"],["","OV","","AHv"],["","O","^%","OW"],["","O","^EN","OW"],["","O","^I#","OW"],["","OL","D","OWl"],["","OUGHT","","AOt"],["","OUGH","","AHf"],[" ","OU","","AW"],["H","OU","S#","AW"],["","OUS","","AXs"],["","OUR","","AOr"],["","OULD","","UHd"],["^","OU","^L","AH"],["","OUP","","UWp"],["","OU","","AW"],["","OY","","OY"],["","OING","","OWIHNG"],["","OI","","OY"],["","OOR","","AOr"],["","OOK","","UHk"],["","OOD","","UHd"],["","OO","","UW"],["","O","E","OW"],["","O"," ","OW"],["","OA","","OW"],[" ","ONLY","","OWnlIY"],[" ","ONCE","","wAHns"],["","ON'T","","OWnt"],["C","O","N","AA"],["","O","NG","AO"],[" :^","O","N","AH"],["I","ON","","AXn"],["#:","ON"," ","AXn"],["#^","ON","","AXn"],["","O","ST ","OW"],["","OF","^","AOf"],["","OTHER","","AHDHER"],["","OSS"," ","AOs"],["#:^","OM","","AHm"],["","O","","AA"]],
    "P": [["","PH","","f"],["","PEOP","","pIYp"],["","POW","","pAW"],["","PUT"," ","pUHt"],["","P","","p"]],
    "Q": [["","QUAR","","kwAOr"],["","QU","","kw"],["","Q","","k"]],
    "R": [[" ","RE","^#","rIY"],["","R","","r"]],
    "S": [["","SH","","SH"],["#","SION","","ZHAXn"],["","SOME","","sAHm"],["#","SUR","#","ZHER"],["","SUR","#","SHER"],["#","SU","#","ZHUW"],["#","SSU","#","SHUW"],["#","SED"," ","zd"],["#","S","#","z"],["","SAID","","sEHd"],["^","SION","","SHAXn"],["","S","S",""],[".","S"," ","z"],["#:.E","S"," ","z"],["#:^##","S"," ","z"],["#:^#","S"," ","s"],["U","S"," ","s"],[" :#","S"," ","z"],[" ","SCH","","sk"],["","S","C+",""],["#","SM","","zm"],["#","SN","'","zAXn"],["","S","","s"]],
    "T": [[" ","THE"," ","DHAX"],["","TO"," ","tUW"],["","THAT"," ","DHAEt"],[" ","THIS"," ","DHIHs"],[" ","THEY","","DHEY"],[" ","THERE","","DHEHr"],["","THER","","DHER"],["","THEIR","","DHEHr"],[" ","THAN"," ","DHAEn"],[" ","THEM"," ","DHEHm"],["","THESE"," ","DHIYz"],[" ","THEN","","DHEHn"],["","THROUGH","","THrUW"],["","THOSE","","DHOWz"],["","THOUGH"," ","DHOW"],[" ","THUS","","DHAHs"],["","TH","","TH"],["#:","TED"," ","tIHd"],["S","TI","#N","CH"],["","TI","O","SH"],["","TI","A","SH"],["","TIEN","","SHAXn"],["","TUR","#","CHER"],["","TU","A","CHUW"],[" ","TWO","","tUW"],["","T","","t"]],
    "U": [[" ","UN","I","yUWn"],[" ","UN","","AHn"],[" ","UPON","","AXpAOn"],["T","UR","#","UHr"],["S","UR","#","UHr"],["R","UR","#","UHr"],["D","UR","#","UHr"],["L","UR","#","UHr"],["Z","UR","#","UHr"],["N","UR","#","UHr"],["J","UR","#","UHr"],["TH","UR","#","UHr"],["CH","UR","#","UHr"],["SH","UR","#","UHr"],["","UR","#","yUHr"],["","UR","","ER"],["","U","^ ","AH"],["","U","^^","AH"],["","UY","","AY"],[" G","U","#",""],["G","U","%",""],["G","U","#","w"],["#N","U","","yUW"],["T","U","","UW"],["S","U","","UW"],["R","U","","UW"],["D","U","","UW"],["L","U","","UW"],["Z","U","","UW"],["N","U","","UW"],["J","U","","UW"],["TH","U","","UW"],["CH","U","","UW"],["SH","U","","UW"],["","U","","yUW"]],
    "V": [["","VIEW","","vyUW"],["","V","","v"]],
    "W": [[" ","WERE","","wER"],["","WA","S","wAA"],["","WA","T","wAA"],["","WHERE","","WHEHr"],["","WHAT","","WHAAt"],["","WHOL","","hOWl"],["","WHO","","hUW"],["","WH","","WH"],["","WAR","","wAOr"],["","WOR","^","wER"],["","WR","","r"],["","W","","w"]],
    "X": [["","X","","ks"]],
    "Y": [["","YOUNG","","yAHNG"],[" ","YOU","","yUW"],[" ","YES","","yEHs"],[" ","Y","","y"],["#:^","Y"," ","IY"],["#:^","Y","I","IY"],[" :","Y"," ","AY"],[" :","Y","#","AY"],[" :","Y","^+:#","IH"],[" :","Y","^#","AY"],["","Y","","IH"]],
    "Z": [["","Z","","z"]]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RULES; else root.NRL_RULES = RULES;
})(root);

// ======== lexillogue.js ========
/* lexillogue.js -- the Lexillogue: letters to phonemes,
   by the rules of NRL Report 7948 (Elovitz, Johnson,
   McHugh and Shore, 1976), as John A. Wasser kept
   them in C in 1985. The rules are in rules.js,
   copied out of english.c by program; the matcher
   here is phoneme.c, followed line for line, in the
   order and with the quirks of the C.

     LEXILLOGUE.say('Put the book back.')
       -> 'pUHt DHAX bUHk bAEk . '
     LEXILLOGUE.trace('put')
       -> [{ at: 1, text: 'P', rule: [...], out: 'p' }, ...]

   How a word is read (phoneme.c): the word is upper
   case with a space on each side. From the left,
   for each letter not yet matched, the rules of that
   letter's group are tried in order; the first whose
   text matches here, and whose left and right
   contexts match around it, gives its phonemes and
   the reading moves past the text it matched. If no
   rule matches, the letter is skipped (the C printed
   "Can't find rule"). Context symbols:
     #  one or more vowels      :  zero or more consonants
     ^  one consonant           .  B D V G J L M N R W Z
     +  E, I or Y               %  ER E ES ED ING ELY
                                   (a suffix; right only)
   A vowel is A E I O U; a consonant is any other
   capital letter. Note the C's reading of %: "EL"
   not followed by Y matches only the E; "I" must be
   "ING" or the match fails.

   Outside the C (parse.c was not kept): the text is
   cut into runs of letters and apostrophes, each a
   word, and whatever lies between goes through the
   punctuation group a character at a time; a digit
   is said by its name, which is mine, not NRL's. */
(function (root) {
  'use strict';
  var RULES = root.NRL_RULES || require('./rules.js');
  var DIGITS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
  function isvowel(c) { return c === 'A' || c === 'E' || c === 'I' || c === 'O' || c === 'U'; }
  function isupper(c) { return c >= 'A' && c <= 'Z'; }
  function isconsonant(c) { return isupper(c) && !isvowel(c); }
  function isalpha(c) { return isupper(c) || (c >= 'a' && c <= 'z'); }
  function isvoiced(c) { return 'BDVGJLMNRWZ'.indexOf(c) >= 0 && c !== ''; }
  function isfront(c) { return c === 'E' || c === 'I' || c === 'Y'; }
  // the C walks a char array; off its ends it would read what lay in memory. Here it reads nothing.
  function at(word, i) { return i >= 0 && i < word.length ? word.charAt(i) : ''; }
  // leftmatch(pattern, context): the pattern read from its END, the text from `i` leftward
  function leftmatch(pat, word, i) {
    var p = pat.length - 1, c;
    for (; p >= 0; p--) {
      c = pat.charAt(p);
      if (isalpha(c) || c === "'" || c === ' ') { if (c !== at(word, i)) return false; i--; continue; }
      switch (c) {
      case '#': if (!isvowel(at(word, i))) return false; i--; while (isvowel(at(word, i))) i--; break;
      case ':': while (isconsonant(at(word, i))) i--; break;
      case '^': if (!isconsonant(at(word, i))) return false; i--; break;
      case '.': if (!isvoiced(at(word, i))) return false; i--; break;
      case '+': if (!isfront(at(word, i))) return false; i--; break;
      default: return false;                              // '%' and anything else: "Bad char in left rule"
      }
    }
    return true;
  }
  // rightmatch(pattern, context): the pattern and the text both read rightward from `i`
  function rightmatch(pat, word, i) {
    var p, c;
    for (p = 0; p < pat.length; p++) {
      c = pat.charAt(p);
      if (isalpha(c) || c === "'" || c === ' ') { if (c !== at(word, i)) return false; i++; continue; }
      switch (c) {
      case '#': if (!isvowel(at(word, i))) return false; i++; while (isvowel(at(word, i))) i++; break;
      case ':': while (isconsonant(at(word, i))) i++; break;
      case '^': if (!isconsonant(at(word, i))) return false; i++; break;
      case '.': if (!isvoiced(at(word, i))) return false; i++; break;
      case '+': if (!isfront(at(word, i))) return false; i++; break;
      case '%':                                            // ER, E, ES, ED, ING, ELY: exactly as the C reads them
        if (at(word, i) === 'E') {
          i++;
          if (at(word, i) === 'L') { i++; if (at(word, i) === 'Y') { i++; break; } else { i--; break; } }   // "Don't gobble L"
          else if (at(word, i) === 'R' || at(word, i) === 'S' || at(word, i) === 'D') i++;
          break;
        } else if (at(word, i) === 'I') {
          i++; if (at(word, i) === 'N') { i++; if (at(word, i) === 'G') { i++; break; } }
          return false;
        } else return false;
      default: return false;
      }
    }
    return true;
  }
  // find_rule: the first rule of the group that matches at `index`; -> { out, next, rule } or null
  function findRule(word, index, rules) {
    var r, k, m, rem, rule;
    for (r = 0; r < rules.length; r++) {
      rule = rules[r]; m = rule[1];
      for (k = 0, rem = index; k < m.length; k++, rem++) if (m.charAt(k) !== at(word, rem)) break;
      if (k < m.length) continue;
      if (!leftmatch(rule[0], word, index - 1)) continue;
      if (!rightmatch(rule[2], word, rem)) continue;
      return { out: rule[3], next: rem, rule: rule };
    }
    return null;
  }
  // xlate_word: a word with its spaces -> its phonemes, and the trail of rules used
  function xlateWord(word, trail) {
    var index = 1, out = '', c, group, hit;
    while (index < word.length && at(word, index) !== '') {
      c = at(word, index); group = RULES[isupper(c) ? c : ' '];
      hit = group ? findRule(word, index, group) : null;
      if (!hit) { if (trail) trail.push({ at: index, text: c, rule: null, out: '' }); index++; continue; }   // "Can't find rule": skip it
      out += hit.out;
      if (trail) trail.push({ at: index, text: word.slice(index, hit.next), rule: hit.rule, out: hit.out });
      index = hit.next;
      if (index >= word.length - 1) break;                  // the closing space
    }
    return out;
  }
  // the text, cut into words; each word read; the rest a character at a time through the punctuation group
  // an accented Latin letter is read as its plain one (Chaucer's "viságe", 12 x 2026); the rules know A to Z alone,
  // and without this the word would be cut in two. One character stays one character, so the lamp's places hold.
  var ACCENTED = '\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d9\u00da\u00db\u00dc\u00dd';
  var PLAIN = 'AAAAAACEEEEIIIINOOOOOUUUUY';
  function fold(s) {
    var out = '', i, k;
    for (i = 0; i < s.length; i++) { k = ACCENTED.indexOf(s.charAt(i)); out += k >= 0 ? PLAIN.charAt(k) : s.charAt(i); }
    return out;
  }
  function read(text, trail) {
    var s = fold(String(text).toUpperCase()), out = '', i = 0, j, run, c, hit, w;
    while (i < s.length) {
      c = s.charAt(i);
      if (isupper(c) || c === "'") {
        for (j = i; j < s.length && (isupper(s.charAt(j)) || s.charAt(j) === "'"); j++) {}
        run = s.slice(i, j); w = ' ' + run + ' ';
        if (trail) trail.push({ word: run, pos: i });   // pos: where the word stands in the text, for the lamp
        out += xlateWord(w, trail) + ' ';
        i = j; continue;
      }
      if (c >= '0' && c <= '9') { if (trail) trail.push({ word: c, pos: i, said: DIGITS[c.charCodeAt(0) - 48] }); out += xlateWord(' ' + DIGITS[c.charCodeAt(0) - 48] + ' ', trail) + ' '; i++; continue; }
      // the marks the C had no rule for, kept for the tune (user1, 11 x 2026): a semicolon, a colon, and a dash
      // standing between spaces ("apples - pears"); a hyphen inside a word stays silent, as the C has it
      if (c === ';' || c === ':' || (c === '-' && s.charAt(i - 1) === ' ' && s.charAt(i + 1) === ' ')) { out += ' ' + c + ' '; if (trail) trail.push({ word: c, pos: i, mark: c }); i++; continue; }
      // BEEPAGES: with LEXILLOGUE.beeps on, the brackets and the underbar are handed through as characters that sound
      // (phones.js knows their notes); off, they are silent as the C left them
      if (LEXILLOGUE.beeps && BEEPS.indexOf(c) >= 0) { out += ' ' + c + ' '; if (trail) trail.push({ word: c, pos: i, mark: c }); i++; continue; }
      w = ' ' + c + ' '; hit = findRule(w, 1, RULES[' ']);
      if (hit && hit.out === ' ' && c !== ' ') { out += ' ' + c + ' '; if (trail) trail.push({ word: c, pos: i, mark: c }); }   // , . ? ! : kept as marks, so the tune knows where a sentence ends and how
      if (!hit && trail && c !== ' ') trail.push({ word: c, rule: null });
      i++;
    }
    while (out.indexOf('  ') >= 0) out = out.split('  ').join(' ');   // one space between codes; the marks carry the pauses
    return out;
  }
  function say(text) { return read(text, null); }
  function trace(text) { var t = []; read(text, t); return t; }
  var BEEPS = '()[]{}_';
  var LEXILLOGUE = { say: say, trace: trace, rules: RULES, xlateWord: xlateWord, leftmatch: leftmatch, rightmatch: rightmatch, beeps: false };
  if (typeof module !== 'undefined' && module.exports) module.exports = LEXILLOGUE;
  else root.LEXILLOGUE = LEXILLOGUE;
})(root);

  // ======== the library ========
  // READING (user1, 10 x 2026): three orthographies, one mouth. English goes to the Lexillogue; Bell's Visible
  // Speech in threes is noticed first and read by the sheets; phoneme codes ready-made are taken as they are.
  function read(text) { return root.BELL && root.BELL.has(text) ? root.BELL.read(text) : root.LEXILLOGUE.say(text); }   // ecouter-speech.js carries no sheets
  function frames(text, o) {
    o = o || {}; var v = o.voice || {}, tune = o.tune || (v.conduction === false ? 'apology' : 'conduction');
    return root.PHONES.frames(o.codes || read(text), { tune: tune, f0: o.f0, pause: o.pause });   // o.codes: phoneme codes ready-made
  }
  function say(text, o) {
    o = o || {};
    var s = root.ECOUTER.settings(o.voice || root.ECOUTER.PRESETS[root.ECOUTER.HOUSE_NAME]);
    s.frames = frames(text, o);
    return root.ECOUTER.make(s, o.turns).pcm;
  }
  function wav(text, o) { return root.VOICEBOX.wav(say(text, o), root.ECOUTER.SR); }
  // THE LEAD (user1, 11 x 2026): on Windows and its kin the first half-second of a played sound is garbled while
  // the drivers work each other out; so a third of a second of silence goes before the FIRST sound of a chain,
  // and only the first, since after it the drivers are hot and aligned. lead(pcm) -> the same with the lead on.
  function lead(pcm, seconds) { var n = Math.round((seconds === undefined ? 0.333 : seconds) * root.ECOUTER.SR), out = new Float32Array(n + pcm.length); out.set(pcm, n); return out; }
  var LIB = {
    say: say, wav: wav, lead: lead, frames: frames, codes: read, trace: root.LEXILLOGUE.trace, SR: root.ECOUTER.SR,
    bell: root.BELL && root.BELL.codes, notice: root.BELL && root.BELL.notice, has: root.BELL && root.BELL.has, BELL: root.BELL,
    tint: root.LAMP && root.LAMP.tint, html: root.LAMP && root.LAMP.html, LAMP: root.LAMP,
    VOICEBOX: root.VOICEBOX, GUST: root.GUST, CHAIN: root.ECOUTER, PHONES: root.PHONES, RULES: root.NRL_RULES, LEXILLOGUE: root.LEXILLOGUE
  };
  if (outer) outer.exports = LIB; else global.ECOUTER = LIB;
})(typeof window !== 'undefined' ? window : this, typeof module !== 'undefined' && module.exports ? module : null);
