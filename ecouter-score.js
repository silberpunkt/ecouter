/* ecouter-score.js -- the score ring of Ecouter: things done to a score before it is sung.
   Written by repo.make.js on 2026-11-19 from the ecouter workshop; do not edit here.

   A file beside the library, not part of it. Load ecouter.js or ecouter-speech.js first:
     <script src="ecouter-speech.js"></script>
     <script src="ecouter-score.js"></script>
     var s = ECOUTER.SCORE.read(["Is", "it", "you"], ["", "", "?"]);   // { codes, word, frames }
     s = ECOUTER.SCORE.tone(s, 1.03);                  // pitch and throat together, by one factor
     s = ECOUTER.SCORE.fit(s, [180, 150, 420]);        // each word made to last so many milliseconds
     s = ECOUTER.SCORE.sing(s, 0.5);                   // half way from speech to song
     var pcm = ECOUTER.SCORE.say(s);                   // and then it is sung: Float32Array, 16 kHz
     s = ECOUTER.SCORE.fromCodes(ECOUTER.codes(text)); // or a score from the sounds themselves: whatever ECOUTER.codes can read, Bell's Visible Speech too
   And the voices, by name:
     ECOUTER.SCORE.VOICES.names                        // phillippe nuage miria lauren arthur obelus rudolf blando
     s = ECOUTER.SCORE.as(ECOUTER.SCORE.read(["Is", "it", "you"], ["", "", "?"]), "lauren");   // her arc, her tone, her song
     var pcm = ECOUTER.SCORE.say(s);                   // sung as steady as she is; s.voice.speed is the tape speed, for whoever plays it
   In node:  var E = require("./ecouter.js"); require("./ecouter-score.js"); E.SCORE.read(...)
   and to hang it on another library:  require("./ecouter-score.js")(require("./ecouter-speech.js"))

   Every function takes a score and gives back a new one. These came home from Obelus, where they were one
   function that fitted each word of a sentence to the width of that word on a line of type. SING is
   Audenare's. The voices grew in Nuage and were tuned in Obelus. The ecouter workshop, 2026. */
(function (hang) {
  if (typeof ECOUTER !== 'undefined') hang(ECOUTER);                       // a page, or QuickJS: the library is on the global
  else if (typeof module !== 'undefined' && module.exports) { module.exports = hang; hang(require('./ecouter.js')); }   // node: hung on the whole library, and handed out to be hung on another
  else throw new Error('ecouter-score.js: load ecouter.js or ecouter-speech.js first');
})(function (E) {
  var root = { PHONES: E.PHONES, LEXILLOGUE: E.LEXILLOGUE }, module, exports;   // the module below sees no module, and attaches to root

// ======== score.js ========
/* score.js -- the score ring: things done to a score before it is sung.

   A score is the list of frames a sentence is sung from. Everything here
   is done to the score, before any sound exists, and so costs nothing in
   the singing. Each function takes a score and gives back a new one; the
   one it was handed is never changed.

   These came home from Obelus (its IOU 2, 15 xi 2026), where they were one
   function, lay, that fitted each word of a sentence to the width of that
   word on a line of type. Obelus now owes nothing here but thanks.

     var s = SCORE.read(['Is', 'it', 'you'], ['', '', '?']);   // { codes, word, frames }
     s = SCORE.tone(s, 1.03);                    // pitch and throat together, by one factor
     s = SCORE.fit(s, [180, 150, 420], [0, 0, 120]);   // each word made to last so many ms
     s = SCORE.lift(s, [false, false, true]);    // these words a little higher, as inside quotation marks
     s = SCORE.sing(s, 0.5);                     // half way from speech to song
     ECOUTER.make({ frames: s.frames, ... })     // and then it is sung

   A score here is { codes, word, frames }: the phoneme codes, the number of
   the word each code belongs to, and the frames, each of which remembers
   the code that made it (frame.ci). fit, lift and sing need the words;
   tone needs only the frames.

   SING is Audenare's (user1's, of this house): "the difference between
   saying and singing is a quantiser, and the amount of it can be put on an
   axis." */
(function (root) {
  'use strict';
  var L = root.LEXILLOGUE || require('./lexillogue.js');
  var P = root.PHONES || require('./phones.js');

  function sounded(c) { return /[A-Za-z]/.test(c); }       // a phoneme code, as against a space or a stop
  function copy(f) { var o = {}, k; for (k in f) o[k] = f[k]; return o; }
  function again(score, frames) { return { codes: score.codes, word: score.word, frames: frames }; }

  /* FROM CODES: a score from the sounds themselves, written as ECOUTER.codes writes them ("lEHt DHEHr bIY lAYt ."),
     whatever they were read from: English by the rules, or Bell's Visible Speech by its glyphs. Words are parted by
     blanks, and a mark stands by itself after the word it follows. The same score as READ makes from the same sounds. */
  function fromCodes(text, o) {
    var codes = [], word = [], bits = String(text).split(' '), j = -1, i, k, c;
    o = o || {};
    for (i = 0; i < bits.length; i++) {
      if (!bits[i]) continue;
      if (!sounded(bits[i])) { if (j >= 0) { codes.push(bits[i]); word.push(j); codes.push(' '); word.push(j); } continue; }   // a mark: it belongs to the word before it
      c = []; try { c = P.split(bits[i]).filter(sounded); } catch (e) {}
      if (!c.length) continue;
      j++; for (k = 0; k < c.length; k++) { codes.push(c[k]); word.push(j); }
      codes.push(' '); word.push(j);
    }
    return { codes: codes, word: word, frames: P.frames(codes, { f0: o.f0 || 118, tune: o.tune }) };
  }

  /* READ: words to a score. punct[j] is what follows word j: '.', '?', '!', ',' or nothing. A whole sentence is read
     at once, so that its words run together and it has its tune: a fall at a full stop, a lift at a question. */
  function read(words, punct, o) {
    var codes = [], word = [], j, i, c;
    punct = punct || []; o = o || {};
    for (j = 0; j < words.length; j++) {
      c = [];
      try { c = P.split(L.say(words[j]).trim().replace(/ /g, '')).filter(sounded); } catch (e) {}
      for (i = 0; i < c.length; i++) { codes.push(c[i]); word.push(j); }
      codes.push(' '); word.push(j);
      if (punct[j]) { codes.push(punct[j]); word.push(j); codes.push(' '); word.push(j); }
    }
    return { codes: codes, word: word, frames: P.frames(codes, { f0: o.f0 || 118, tune: o.tune }) };   // o.tune: 'conduction' unless said; 'apology' is the voice without its tune
  }

  /* TONE (user1: "Tone and Speed controls would be ideal... little or no impact on the engine"). The tape itself
     transposed: pitch and throat moved together, by one factor. Speed is not here: speed is how fast a tape is run. */
  function tone(score, k) {
    if (!k || k === 1) return again(score, score.frames.map(copy));
    return again(score, score.frames.map(function (f) {
      var o = copy(f);
      if (o.f0) o.f0 *= k;
      if (o.f) o.f = o.f.map(function (h) { return h * k; });
      if (o.at) o.at = [o.at[0] * k, o.at[1] * k];
      return o;
    }));
  }

  /* FIT: each word made to last exactly as long as its place. slots[j] is the whole place of word j in ms, and
     gaps[j] is how much of that place is a breath after it that is not the word's to fill (after a full stop, say).
     The sounded part of a word is stretched or eased, between 0.6 and 1.7 of itself, toward 92 in the hundred of
     its own room; the pause after it takes up the slack. If there is no room for a pause, the word takes the whole
     of its place. */
  function fit(score, slots, gaps) {
    var codes = score.codes, word = score.word, fr = score.frames, W = slots.length, j, i, f;
    var phon = new Float64Array(W), paus = new Float64Array(W), kp = [], kq = [];
    gaps = gaps || [];
    for (i = 0; i < fr.length; i++) { f = fr[i]; j = word[f.ci]; if (j === undefined) continue; if (sounded(codes[f.ci])) phon[j] += f.ms; else paus[j] += f.ms; }
    for (j = 0; j < W; j++) {
      var slot = slots[j], own = slot - (gaps[j] || 0);
      var k = phon[j] ? Math.max(0.6, Math.min(1.7, own * 0.92 / phon[j])) : 1, rest = slot - k * phon[j];
      if (!paus[j] || rest < 2) { rest = paus[j] ? 2 : 0; k = phon[j] ? Math.max(0.05, (slot - rest) / phon[j]) : 1; }
      kp[j] = k; kq[j] = paus[j] ? rest / paus[j] : 1;
    }
    return again(score, fr.map(function (f) {
      var j = word[f.ci], o = copy(f);
      if (j !== undefined) o.ms = Math.max(0.5, f.ms * (sounded(codes[f.ci]) ? kp[j] : kq[j]));
      return o;
    }));
  }

  /* LIFT: the words flagged are pitched a little higher, as a line is lifted inside quotation marks. */
  function lift(score, flags, k) {
    k = k || 1.13;
    return again(score, score.frames.map(function (f) {
      var j = score.word[f.ci], o = copy(f);
      if (j !== undefined && flags[j] && o.f0) o.f0 *= k;
      return o;
    }));
  }

  /* SING (user1, 13 xi 2026: "I want a slider between normal speech and song"). The method is Audenare's. Nothing is
     changed but pitch. Each syllable is given ONE held pitch, a terrace, snapped to a gapped set with no semitone in
     it (0 2 4 7 above a tonic, and the same again an octave up), and the voice's own pitch is blended toward that
     terrace, in the log domain, by amount (0 is speech, 1 is song). One thing is added to Audenare, and said here
     because it is a second variable: the careful reader moves through barely two and a half semitones, which snaps to
     two notes and is a chant, not a song. So as amount rises the sentence's own tune is also widened, to three times
     at the top, and each vowel's own height is let in: the close vowels (ee, oo) sit a little above the open ones
     (ah). The melody is drawn from the sentence's tune and its words' vowels, and from nothing else.
     tonic: the note the scale stands on, 113.3 Hz unless said. It goes with the voice: multiply it by whatever the
     voice's pitch and tone have been multiplied by, since the grammar is a claim about intervals. */
  var DEGREES = [0, 2, 4, 7, 12, 14, 16, 19];
  var HEIGHT = { IY: 1, UW: 1, IH: 0.7, UH: 0.7, EY: 0.3, OW: 0.3, AE: -0.3, AA: -0.6, AY: -0.3, AW: -0.3 };
  function vowel(c) { return /^(IY|IH|EY|EH|AE|AA|AO|OW|UH|UW|ER|AX|AH|AY|AW|OY)$/.test(c); }
  function sing(score, amount, tonic) {
    var codes = score.codes, word = score.word, out = score.frames.map(copy), sg = amount, TON = tonic || 113.3;
    if (!(sg > 0)) return again(score, out);
    var syl = [], a, b, i, q, vs, f, v, e;
    for (i = 0; i < codes.length; i++) syl.push(-1);
    for (a = 0; a < codes.length;) {                       // one word: each sound joins the vowel that follows it, or the last vowel
      b = a; while (b < codes.length && word[b] === word[a]) b++;
      vs = []; for (i = a; i < b; i++) if (vowel(codes[i])) vs.push(i);
      for (i = a, q = 0; i < b; i++) { if (!sounded(codes[i])) continue; while (q < vs.length && vs[q] < i) q++; syl[i] = vs.length ? vs[Math.min(q, vs.length - 1)] : -1; }
      a = b;
    }
    var sum = {}, held = {};
    for (i = 0; i < out.length; i++) {
      f = out[i]; v = syl[f.ci];
      if (v === undefined || v < 0 || !f.f0 || !(f.voice > 0.03)) continue;
      e = sum[v] || (sum[v] = [0, 0]); e[0] += Math.log(f.f0) * f.ms; e[1] += f.ms;
    }
    for (v in sum) {
      e = sum[v];
      var st = 12 * Math.log2(Math.exp(e[0] / e[1]) / TON) * (1 + 2 * sg) + (HEIGHT[codes[v]] || 0) * 3 * sg, best = DEGREES[0], d;
      for (d = 0; d < DEGREES.length; d++) if (Math.abs(DEGREES[d] - st) < Math.abs(best - st)) best = DEGREES[d];
      held[v] = TON * Math.pow(2, best / 12);
    }
    for (i = 0; i < out.length; i++) { f = out[i]; var h = held[syl[f.ci]]; if (h && f.f0) f.f0 = Math.exp((1 - sg) * Math.log(f.f0) + sg * Math.log(h)); }
    return again(score, out);
  }

  var SCORE = { read: read, fromCodes: fromCodes, tone: tone, fit: fit, lift: lift, sing: sing, DEGREES: DEGREES, HEIGHT: HEIGHT };
  if (typeof module !== 'undefined' && module.exports) module.exports = SCORE;
  else root.SCORE = SCORE;
})(root);

// ======== voices.js ========
/* voices.js -- the voices: all Ecouter, differently carried.

   A voice is an operation on the frames of a sentence before they are
   sung, and stock Ecouter is what you get when the operation does nothing
   (user1, 5 xi 2026: "All expressions are described as operations upon
   Ecouter"). The operation is an ARC: one curve over the span of the
   sentence that moves pace and pitch together, with a size of throat and
   a share of breath and hiss. Every voice also carries DIALS, kept with
   it: tone, speed, song and steady.

   The arcs grew in Nuage in a day, and came here by her note of 5 xi 2026,
   "Voices upon Ecouter". The dials were found in Obelus (its IOU 3, 15 xi
   2026). Each voice is a personage, and may be asked for by name.

   THE SONG of each voice here is user1's ruling of 18 xi 2026, for a voice
   heard anywhere but on Obelus's line: "it belongs, though less musically
   than in Obelus." There a line of type is being sung; here a sentence is
   being said. So most of the numbers below are lower than Obelus's own,
   which it keeps for itself. He says of them: "In truth these are guesses
   and I need my ears too."

     VOICES.names                       // ['phillippe', 'nuage', 'miria', ...]
     VOICES.get('lauren')               // { name, kin, arc, tone, speed, song, steady, says }
     VOICES.arc(frames, 'lauren')       // new frames, her arc laid over them
     VOICES.on(score, 'lauren')         // the same, for a score of the score ring
     VOICES.as(score, 'lauren')         // a score carried in her voice entire: arc, tone and song

   PHILLIPPE is the stock voice, and has no arc at all. Every other voice
   was made by slowing, lowering or rounding him. */
(function (root) {
  'use strict';
  var S = root.SCORE || require('./score.js');

  /* THE ARCS. time: her share of his time; rateArc and pitchArc: how far pace and pitch swing across the sentence,
     on the one curve; pitch: lifted by so much; dot: a small accumulation in each swell; tract: the size of the
     throat; breath and hiss: by these factors; flat and even (Blando only): pitch drawn toward its mean, and each
     frame's length toward the even. */
  var NUAGE  = { time: 0.86, rateArc: 0.22, pitch: 1.5, pitchArc: 0.07, dot: 0.025, tract: 1.13, breath: 1, hiss: 1 };
  var MIRIA  = { time: 0.78, rateArc: 0.36, pitch: 1.72, pitchArc: 0.13, dot: 0.05, tract: 1.19, breath: 0.35, hiss: 1.25 };
  var BLANDO = { time: 1.12, rateArc: 0, pitch: 0.87, pitchArc: 0, dot: 0, tract: 0.97, breath: 0.45, hiss: 1.1, flat: 0.72, even: 0.45 };
  var ARTHUR = { time: 1 / 1.08, rateArc: -0.08, pitch: 1.0595, pitchArc: -0.03, dot: -0.01, tract: 0.95, breath: 1.15, hiss: 0.9 };
  var LAUREN = { time: 0.86, rateArc: 0.22, pitch: 1.5, pitchArc: 0.04, dot: 0.025, tract: 1.13, breath: 1.5, hiss: 0.9 };   // Nuage's arc, with more breath, a gentler rise and a softer hiss

  /* THE CAST. kin is how a menu may group them. A voice with no dials of its own speaks at tone 1 and speed 1, with the
     house's share of song (0.34), and as steady as the house (0.79). Song is given to each by name, his words beside it. speed is the speed of a tape: it lowers the pitch and slows the pace
     together, and so it is a player's to apply, not the score's. */
  var CAST = [
    { name: 'phillippe', kin: 'Men', arc: null, song: 0.34,   // "Phillippe will do just fine on the .34"
      says: 'Stock Ecouter, with nothing done to him. Quick, high and earnest: he is five, and trying hard.' },
    { name: 'nuage', kin: 'Women', arc: NUAGE, song: 0.34,
      says: 'The small cloud. She begins slower and lower, ends faster and higher, and is done in 86 parts of his hundred.' },
    { name: 'miria', kin: 'Women', arc: MIRIA, tone: 1.03, speed: 1.04, song: 0.63, steady: 0.87,   // "She sings a lot and should, but one needs a coloratura to set foot to earth sometimes" (0.79 on Obelus's line)
      says: 'All that Nuage is, nearly crackingly too much: too clear, too singing, too tight.' },
    { name: 'lauren', kin: 'Women', arc: LAUREN, tone: 0.86, speed: 0.96, song: 0.34, steady: 0.65,   // 0.43 on Obelus's line
      says: 'Nuage with more breath and a gentler rise, tuned low.' },
    { name: 'arthur', kin: 'Men', arc: ARTHUR, song: 0.53,   // "He is a fine tenor and should properly sing at 0.53"
      says: 'The very slightest inverse of Nuage, reservedly: a Manner of Ecouter, where she is a Grace of it.' },
    { name: 'obelus', kin: 'Men', arc: ARTHUR, tone: 1.03, speed: 0.83, song: 0.53,   // as on Obelus's own line, so that he sounds everywhere like "the one known in the application"
      says: 'Arthur with the tape run at about four fifths: a warm, slow, fuller voice, found by throwing the line a little slow.' },
    { name: 'rudolf', kin: 'Men', arc: ARTHUR, tone: 0.96, speed: 0.98, song: 0.61,   // "musicality is crucial to him... He is correctly set"
      says: 'Arthur, tuned a little lower and more sung.' },
    { name: 'blando', kin: 'Men', arc: BLANDO, song: 0.28,   // "0.28 will set his jaw correctly"
      says: 'The human, as a jest, voiced as a computer: most of the tone and most of the time taken out, and only most.' }
  ];
  var PLAIN = { tone: 1, speed: 1, song: 0.34, steady: 0.79 };
  function get(name) {
    var i, v, k, out;
    for (i = 0; i < CAST.length; i++) if (CAST[i].name === name) {
      v = CAST[i]; out = {};
      for (k in PLAIN) out[k] = PLAIN[k];
      for (k in v) out[k] = v[k];
      return out;
    }
    return null;
  }

  /* THE OPERATION, as it stands in Nuage, and not retyped. u runs 0 to 1 across the frames' time. The swell is the
     yinyang: -cos(pi u), a black swell at the left and a white at the right, with a dot of accumulation in each. Pace
     and pitch ride the same swell, which is the point: she does not merely rise, she rises as she quickens. Over the
     last part of the span the swell eases to rest, a little below level, and the pace eases with it: the recalm
     (user1: "a kerb cut back to steady flight"). Then the whole is scaled to the voice's share of the time. */
  function arc(fr, V) {
    if (typeof V === 'string') { var g0 = get(V); V = g0 ? g0.arc : null; }
    if (!V) return fr.map(function (f) { var o = {}, k; for (k in f) o[k] = f[k]; return o; });
    var sum = 0, i, out = [], acc = 0, raw = 0; for (i = 0; i < fr.length; i++) sum += fr[i].ms;
    var dots = function (u) { return V.dot * (Math.exp(-Math.pow((u - 0.75) / 0.09, 2)) - Math.exp(-Math.pow((u - 0.25) / 0.09, 2))); };
    var TAIL = V.tail === undefined ? 0.3 : V.tail, REST = V.rest === undefined ? -0.6 : V.rest;
    for (i = 0; i < fr.length; i++) { var f = fr[i], u = sum ? (acc + f.ms / 2) / sum : 0.5, late = TAIL && u > 1 - TAIL ? (u - (1 - TAIL)) / TAIL : 0, ease = late * late * (3 - 2 * late), swell = (-Math.cos(Math.PI * u) + (V.dot ? dots(u) / Math.abs(V.dot) * 0.5 : 0)) * (1 - ease) + REST * ease; acc += f.ms;
      var g = {}; for (var k in f) g[k] = f[k];
      g.ms = f.ms * (1 - V.rateArc * swell) * (1 + 0.2 * late * late); raw += g.ms;
      if (f.f0) g.f0 = f.f0 * V.pitch * (1 + V.pitchArc * swell + dots(u));
      if (f.f) g.f = f.f.map(function (hz) { return hz * V.tract; });
      if (f.at) g.at = [f.at[0] * V.tract, f.at[1] * V.tract];
      if (f.breath) g.breath = f.breath * V.breath; if (f.hiss) g.hiss = Math.min(1, f.hiss * V.hiss);
      out.push(g); }
    if (V.flat || V.even) {
      var n0 = 0, f0m = 0, msm = 0; for (i = 0; i < out.length; i++) { msm += out[i].ms; if (out[i].f0 && out[i].voice > 0.2) { f0m += out[i].f0; n0++; } } f0m = n0 ? f0m / n0 : 0; msm = out.length ? msm / out.length : 0;
      for (i = 0; i < out.length; i++) { if (V.flat && out[i].f0 && f0m) out[i].f0 = out[i].f0 + (f0m - out[i].f0) * V.flat; if (V.even) out[i].ms = out[i].ms + (msm - out[i].ms) * V.even; } raw = 0; for (i = 0; i < out.length; i++) raw += out[i].ms; }
    var k2 = raw ? sum * V.time / raw : 1; for (i = 0; i < out.length; i++) out[i].ms = out[i].ms * k2;
    return out;
  }

  /* ON A SCORE. on lays a voice's arc over a score of the score ring. as carries a score in a voice entire, in the
     order Obelus found: the arc, then the tone, then (if places are given) each word fitted to its place, then (if
     flags are given) the lifted words, then the song, whose tonic goes with the voice. o may override the voice's
     own dials: o.tone, o.song, o.speed, o.steady. What cannot be done to a score is left written on it for whoever
     plays it: score.voice = { name, speed, steady }. speed is the speed of a tape; steady is taken by SCORE.say. */
  function on(score, name) { return { codes: score.codes, word: score.word, frames: arc(score.frames, name) }; }
  function as(score, name, o) {
    o = o || {};
    var v = get(name) || get('phillippe'), tn = o.tone === undefined ? v.tone : o.tone, sg = o.song === undefined ? v.song : o.song;
    var s = S.tone(on(score, v.arc), tn);
    if (o.slots) s = S.fit(s, o.slots, o.gaps);
    if (o.lift) s = S.lift(s, o.lift);
    s = S.sing(s, sg, 113.3 * (v.arc ? v.arc.pitch : 1) * tn);
    s.voice = { name: v.name, speed: o.speed === undefined ? v.speed : o.speed, steady: o.steady === undefined ? v.steady : o.steady };
    return s;
  }

  var VOICES = { names: CAST.map(function (v) { return v.name; }), get: get, arc: arc, on: on, as: as, PLAIN: PLAIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = VOICES;
  else root.VOICES = VOICES;
})(root);

  // SAY: a score, sung. o.voice: a chain of settings, the house finish unless said; o.turns: as in ECOUTER.say.
  // o.steady, or the steadiness a voice left written on the score, sets how much of the ruler is mixed in (the wear).
  root.SCORE.say = function (score, o) {
    o = o || {}; var st = E.CHAIN.settings(o.voice || E.CHAIN.PRESETS[E.CHAIN.HOUSE_NAME]);
    var sd = o.steady !== undefined ? o.steady : (score.voice ? score.voice.steady : undefined);
    if (sd !== undefined) st.wear = Math.round(sd * 100);
    st.frames = score.frames; return E.CHAIN.make(st, o.turns).pcm;
  };
  root.SCORE.VOICES = root.VOICES; root.SCORE.arc = root.VOICES.on; root.SCORE.as = root.VOICES.as;   // the voices, on a score
  E.SCORE = root.SCORE; return root.SCORE;
});
