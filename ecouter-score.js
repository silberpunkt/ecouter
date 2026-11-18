/* ecouter-score.js -- the score ring of Ecouter: things done to a score before it is sung.
   Written by repo.make.js on 2026-11-18 from the ecouter workshop; do not edit here.

   A file beside the library, not part of it. Load ecouter.js or ecouter-speech.js first:
     <script src="ecouter-speech.js"></script>
     <script src="ecouter-score.js"></script>
     var s = ECOUTER.SCORE.read(["Is", "it", "you"], ["", "", "?"]);   // { codes, word, frames }
     s = ECOUTER.SCORE.tone(s, 1.03);                  // pitch and throat together, by one factor
     s = ECOUTER.SCORE.fit(s, [180, 150, 420]);        // each word made to last so many milliseconds
     s = ECOUTER.SCORE.sing(s, 0.5);                   // half way from speech to song
     var pcm = ECOUTER.SCORE.say(s);                   // and then it is sung: Float32Array, 16 kHz
   In node:  var E = require("./ecouter.js"); require("./ecouter-score.js"); E.SCORE.read(...)
   and to hang it on another library:  require("./ecouter-score.js")(require("./ecouter-speech.js"))

   Every function takes a score and gives back a new one. These came home from Obelus, where they were one
   function that fitted each word of a sentence to the width of that word on a line of type. SING is
   Audenare's. The ecouter workshop, 2026. */
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
    return { codes: codes, word: word, frames: P.frames(codes, { f0: o.f0 || 118 }) };
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

  var SCORE = { read: read, tone: tone, fit: fit, lift: lift, sing: sing, DEGREES: DEGREES, HEIGHT: HEIGHT };
  if (typeof module !== 'undefined' && module.exports) module.exports = SCORE;
  else root.SCORE = SCORE;
})(root);

  // SAY: a score, sung. o.voice: a chain of settings, the house voice unless said; o.turns: as in ECOUTER.say.
  root.SCORE.say = function (score, o) {
    o = o || {}; var st = E.CHAIN.settings(o.voice || E.CHAIN.PRESETS[E.CHAIN.HOUSE_NAME]);
    st.frames = score.frames; return E.CHAIN.make(st, o.turns).pcm;
  };
  E.SCORE = root.SCORE; return root.SCORE;
});
