/* viriditas.js -- the lamp: text coloured by the tone a voice would give it, in one file.
   Written by repo.make.js on 2026-10-29 from the ecouter workshop; do not edit here.

   Viriditas tints; its sister ecouter.js speaks. This file has no throat: it holds the 41
   phoneme codes of NRL Report 7948, the Report's 355 letter-to-sound rules (public domain,
   1985), the Lexillogue that reads text by them, the phrasing and the tune that make a score,
   and the lamp that turns the score into a hue and a vividity for every character. The hue
   is known at the score, one millisecond after the rules read the text; no sound is made.

     <script src="viriditas.js"></script>
     VIRIDITAS.tint("Right? Right!")          // one {ch, f0, voice, hue, sat, css, back, from, to} per character
     VIRIDITAS.html("Right? Right!", { mode: "vivificat", room: "normal", words: true })
     VIRIDITAS.codes("Right? Right!")         // "rAYt ? rAYt ! "
   Options of tint and html: mode (omnia, the default; viriditas; vivificat; none), room (close, normal,
   royal), auto, mix, full, floor, ceiling, knee, lean, drag, inflect, white, hue, step, roomLift.
   Under node or QuickJS: var V = require("./viriditas.js"). */
(function (global, outer) {
  var root = {}, module, exports;

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

// ======== bell-orthoes/bell.js ========
/* bell.js -- Bell's Visible Speech, in threes, as a
   tongue Ecouter notices and reads.

   THE OFFICIAL HOME (user1, 28 x 2026): this file,
   ecouter\bell-orthoes\bell.js in the workshop,
   because the slicer makes the painted diagram the data.
   repo.make.js reads it from here; ecouter\bell.js only
   points here. The two sheets are also shown at the very
   foot of vespers.js, as pictures, by bela.make.js.

   28 x 2026: the front-voiced family is written with a
   bar, (|) y, (|} ZH, [|], [|}, so that (i) and [i] in
   English are English; 'i' is no longer one of Bell's
   stems. The back open (.. says kHH, a hard loch.

   Alexander Melville Bell drew Visible Speech (1867)
   as pictures of the mouth, so that a sound could be
   read without having been heard. User1, 10 x 2026,
   found an economical set of three-character glyphs
   for it from what a keyboard already has, painted
   the two tables as pictures (colorburst shadows and
   all), and asked that the pictures be the source.
   They are: the sheets below are the tables, and the
   slicer reads them back at load. A glyph on a sheet
   with no code after it is a sound Bell wrote and
   this voice cannot yet say; it stays grey on the
   sheet and is reported, not dropped, when met.

     BELL.notice("..] 'x| [^] .")   -> true: this is Bell
     BELL.codes("..] x|' [^] .")    -> { codes: "pIHt . ", unread: [] }

   A consonant glyph: an opening bracket for the part
   of the mouth ( lip . front ( point [ back { ...),
   a stem for the manner, a closing bracket. A vowel
   glyph: a part (< back, > front, x mixed), a stem
   (| unrounded, + round) and a height mark. Only
   the sheets know the whole of it; read them.

   notice() asks whether a text is Bell: split on
   blanks, and if a clear majority of the tokens that
   are not punctuation are threes made of Bell's
   marks, it is. English never produces such runs,
   and the NRL codes are letters, so the test cannot
   mistake either for Bell. No regular expressions,
   as the house has it. QuickJS, a browser, or node. */
(function (root) {
  var CONSONANTS = `
CONSONANTS⠀IN⠀THREES  
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀lip⠀⠀⠀⠀⠀⠀front⠀⠀⠀⠀point⠀⠀⠀⠀back  
open⠀⠀⠀⠀⠀⠀..)⠀f⠀⠀⠀⠀(_)⠀⠀⠀⠀⠀⠀(^)⠀TH⠀⠀⠀(..⠀kHH  
⠀voiced⠀⠀⠀.-)⠀v⠀⠀⠀⠀(|)⠀y⠀⠀⠀⠀(')⠀DH⠀⠀⠀(-.  
mixed⠀⠀⠀⠀⠀{.)⠀WH⠀⠀⠀(_}⠀SH⠀⠀⠀(^}⠀s⠀⠀⠀⠀(.}  
⠀voiced⠀⠀⠀{-)⠀w⠀⠀⠀⠀(|}⠀ZH⠀⠀⠀('}⠀z⠀⠀⠀⠀(-}  
shut⠀⠀⠀⠀⠀⠀..]⠀p⠀⠀⠀⠀[_]⠀⠀⠀⠀⠀⠀[^]⠀t⠀⠀⠀⠀[..⠀k  
⠀voiced⠀⠀⠀.-]⠀b⠀⠀⠀⠀[|]⠀⠀⠀⠀⠀⠀[']⠀d⠀⠀⠀⠀[-.⠀g  
nasal⠀⠀⠀⠀⠀{.]⠀⠀⠀⠀⠀⠀[_}⠀⠀⠀⠀⠀⠀[^}⠀⠀⠀⠀⠀⠀[.}  
⠀voiced⠀⠀⠀{-]⠀m⠀⠀⠀⠀[|}⠀⠀⠀⠀⠀⠀['}⠀n⠀⠀⠀⠀[-}⠀NG  
divided⠀⠀⠀(:)⠀l⠀⠀⠀turned⠀⠀(r)⠀r⠀⠀breath⠀⠀(o)⠀HH  
⠀⠀..̜.̭.̰̰.̰̰.̰̩.̞.̰̥.̬̠.̦̰.̗̟.̰̥.̝.̰̥.̬̠.̦̰.̰̤.̗̟.̰̥.̬̠.̦̰.̰̥.̭.̰̬.̞.̰̥.̬̠.̦̰.̣.̰̥.̬̠.̦̰.̝.̰̥.̬̠.̦̰.̰̤.̗̟.̰̥.̭.̰̩.̞.̰̥.̬̠.̦̰.̰̤.̣.̰̥.̬̠.̦̰.̰̤.̝.̰̥.̬̠.̦̰.̗̟.̰̥.̭.̰̬.̞.̰̥.̬̠.̦̰.̣.̰̥.̬̠.̦̰.̰̤.̝.̰̥.̬̠.̦̰.̗̟.̰̥  
⠀⠀.̭.̰̦.̞.̰̥.̬̠.̦̰.̗̟.̰̥.̝.̰̥.̬̠.̦̰.̗̣.̰̥.̬̠.̦̰.̭.̰̬.̞.̰̥.̬̠.̦̰.̗̟.̰̥.̝.̰̥.̬̠.̦̰.̗̣.̰̥.̬̠.̦̰.̭.̰̩.̗̟.̰̰.̰̦.̭.̰̬.̞.̰̥.̬̠.̦̰.̗̟.̰̥.̝.̰̥.̬̠.̦̰.̗̣.̰̥.̬̠.̦̰.̰̤.̭.̰̭.̟.̰̥.̬̠.̦̰.̭.̰̬.̝.̰̥.̬̠.̦̰.̭.̰̬.̗̖.̰̥.̬̠.̦̰.̰̤
`;
  var VOWELS = `
VOWEL⠀STEMS  
⠀⠀⠀⠀⠀⠀⠀⠀unrounded⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀round  
⠀⠀⠀⠀⠀⠀⠀⠀back⠀⠀⠀⠀front⠀⠀⠀mixed⠀⠀⠀⠀⠀back⠀⠀⠀⠀front⠀⠀⠀mixed  
high⠀⠀⠀⠀<|'⠀⠀⠀⠀⠀>|'⠀IY⠀⠀x|'⠀IH⠀⠀⠀⠀<+'⠀UW⠀⠀>+'⠀IY⠀⠀x+'⠀UW  
⠀wide⠀⠀⠀<|"⠀⠀⠀⠀⠀>|"⠀IH⠀⠀x|"⠀IH⠀⠀⠀⠀<+"⠀UH⠀⠀>+"⠀IH⠀⠀x+"⠀UH  
mid⠀⠀⠀⠀⠀<|:⠀AH⠀⠀>|:⠀EY⠀⠀x|:⠀AX⠀⠀⠀⠀<+:⠀OW⠀⠀>+:⠀EY⠀⠀x+:  
⠀wide⠀⠀⠀<|;⠀AH⠀⠀>|;⠀EH⠀⠀x|;⠀AX⠀⠀⠀⠀<+;⠀AO⠀⠀>+;⠀EH⠀⠀x+;  
low⠀⠀⠀⠀⠀<|.⠀AA⠀⠀>|.⠀AE⠀⠀x|.⠀AA⠀⠀⠀⠀<+.⠀AO⠀⠀>+.⠀⠀⠀⠀⠀x+.  
⠀wide⠀⠀⠀<|,⠀AA⠀⠀>|,⠀AE⠀⠀x|,⠀AA⠀⠀⠀⠀<+,⠀AO⠀⠀>+,⠀⠀⠀⠀⠀x+,  
⠀⠀..̜.̭.̰̰.̰̰.̰̰.̰̰.̰̰.̰̬.̗̟.̰̥.̩.̰̥.̬̠.̦̰.̰̤.̗̥.̰̥.̬̠.̦̰.̰̤.̗̠.̰̥.̬̠.̦̰.̰̤.̩.̰̥.̬̠.̦̰.̰̤.̗̥.̰̥.̬̠.̦̰.̰̤.̭.̰̦.̗̟.̰̥.̩.̰̥.̬̠.̦̰.̰̤.̗̥.̰̥.̬̠.̦̰.̰̤.̗̠.̰̥.̬̠.̦̰.̰̤.̩.̰̥.̬̠.̦̰.̰̤.̗̥.̰̥.̬̠.̦̰.̰̤.̭.̰̥.̗̠.̰̥.̬̠.̦̰.̰̤.̩.̰̥.̬̠.̦̰  
⠀⠀.̰̤.̗̥.̰̥.̬̠.̦̰.̰̤.̗̠.̰̥.̬̠.̦̰.̰̤.̩.̰̥.̬̠.̦̰.̰̤.̗̟.̰̥.̭.̰̦.̗̠.̰̥.̬̠.̦̰.̰̤.̩.̰̥.̬̠.̦̰.̰̤.̗̥.̰̥.̬̠.̦̰.̰̤.̗̠.̰̥.̬̠.̦̰.̰̤.̩.̰̥.̬̠.̦̰.̰̤.̗̟.̰̥.̭.̰̥.̗̠.̰̥.̬̠.̦̰.̰̤.̩.̰̥.̬̠.̦̰.̰̤.̗̥.̰̥.̬̠.̦̰.̰̤.̗̠.̰̥.̬̠.̦̰.̰̤.̗̟.̰̬.̭.̰̦.̗̠.̰̥.̬̠  
⠀⠀.̦̰.̰̤.̩.̰̥.̬̠.̦̰.̰̤.̗̥.̰̥.̬̠.̦̰.̰̤.̗̠.̰̥.̬̠.̦̰.̰̤.̗̟.̰̬
`;
  var MARKS = '()[]{}|+<>x', STEMS = '.-\'^_:or"; ,', BLANK = String.fromCharCode(0x2800);

  // the ratcheting lineslicer: lines in; glyph -> code out, and the glyphs that stood with no code
  function slice(sheet, into, grey) {
    var lines = sheet.split('\n'), n, i;
    for (n = 0; n < lines.length; n++) {
      var line = lines[n], skip = false, flat = '';
      for (i = 0; i < line.length; i++) {
        var c = line.charCodeAt(i);
        if (c >= 0x300 && c <= 0x36F) { skip = true; break; }   // a shadow: the picture's colour, not its text
        flat += c === 0x2800 ? ' ' : line.charAt(i);
      }
      if (skip) continue;
      var t = flat.split(' '), k = [], j;
      for (j = 0; j < t.length; j++) if (t[j] !== '') k.push(t[j]);
      for (j = 0; j < k.length; j++) {
        if (k[j].length !== 3 || !isGlyph(k[j])) continue;
        if (j + 1 < k.length && isCode(k[j + 1])) { into[k[j]] = k[j + 1]; j++; }
        else if (grey) grey.push(k[j]);                            // a sound Bell wrote and the voice cannot yet say
      }
    }
    return into;
  }
  function isCode(t) {
    var i, c;
    for (i = 0; i < t.length; i++) {
      c = t.charCodeAt(i);
      if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122))) return false;
    }
    return t.length > 0;
  }
  function isGlyph(g) {
    var i;
    for (i = 0; i < g.length; i++) if (MARKS.indexOf(g.charAt(i)) >= 0) return true;
    return false;
  }
  function isBellToken(t) {                                          // three characters, every one a mark or a stem, at least one mark
    var i, c, marks = 0;
    if (t.length !== 3) return false;
    if ((t.charAt(0) === ':' || t.charAt(0) === ';') && t.charAt(1) === '-' && t.charAt(2) === ')') return false;   // a face in a chat is not a glyph
    for (i = 0; i < 3; i++) {
      c = t.charAt(i);
      if (MARKS.indexOf(c) >= 0) marks++;
      else if (STEMS.indexOf(c) < 0) return false;
    }
    return marks > 0;
  }
  var GREY = [];
  var B = slice(VOWELS, slice(CONSONANTS, {}, GREY), GREY);

  // straighten what a chat curled
  function straight(s) {
    return String(s).split('‘').join("'").split('’').join("'")
      .split('“').join('"').split('”').join('"').split(BLANK).join(' ');
  }
  function isMark(p) { return p === '.' || p === '!' || p === '?' || p === ','; }

  // NOTICE: is this text Bell? a clear majority of its tokens, marks aside, are Bell threes
  function notice(text) {
    var parts = straight(text).split('\n').join(' ').split(' '), k, p, bell = 0, other = 0;
    for (k = 0; k < parts.length; k++) {
      p = parts[k];
      if (p === '' || isMark(p)) continue;
      if (isBellToken(p)) bell++; else other++;
    }
    return bell >= 2 && bell > 2 * other;
  }
  // HAS: is there any Bell in it at all? (a chat selection may carry a sentence of English and a word of Bell)
  function has(text) {
    var lines = straight(text).split('\n'), parts, k, m;
    for (m = 0; m < lines.length; m++) {
      if (isCodesLine(lines[m])) return true;
      parts = lines[m].split(' ');
      for (k = 0; k < parts.length; k++) if (isBellToken(parts[k])) return true;
    }
    return false;
  }
  // the 41 codes of NRL Report 7948: on the sheets they stand beside the glyphs as guiding-words, and a reader is
  // invited to voice them; met next to a glyph, a code is said as the sound it names
  var CODES = {}; 'IY IH EY EH AE AA AO OW UH UW ER AX AH AY AW OY p b t d k g f v TH DH s z SH ZH HH h m n NG l w y r CH j WH'.split(' ').forEach(function (c) { CODES[c] = true; });   // h: english.c writes the h of How as 'h', not 'HH', and phones.js takes both
  // THE THIRD ORTHOGRAPHY (user1, 10 x 2026, reading a line of codes back and hearing "Mur. WAAtsaxn, caam hieur"):
  // a line the Lexillogue wrote -- "wAAtsAXn , kAHm hIYr ." -- is codes, not English, and is said as codes. A token
  // is a codes-token when it parses whole as a run of the 41 (two capitals, then one small letter) and holds at
  // least one capital pair, since every said syllable has a vowel and the vowels are the capitals: "dry" and "try"
  // are English, "drAY" is codes. A line is a codes line when most of its tokens, marks aside, are codes-tokens;
  // then every token on it is codes, "mr" and all.
  function parsesAsCodes(t) {                                       // every character a code: "mr" too, which has no vowel
    var i = 0, c;
    if (t.length === 0) return false;
    while (i < t.length) {
      c = t.charAt(i);
      if (c >= 'A' && c <= 'Z') { if (CODES[t.slice(i, i + 2)] !== true) return false; i += 2; }
      else if (CODES[c] === true) i++;
      else return false;
    }
    return true;
  }
  function isCodesToken(t) {
    var i = 0, caps = 0;
    if (!parsesAsCodes(t)) return false;
    for (i = 0; i < t.length; i++) if (t.charAt(i) >= 'A' && t.charAt(i) <= 'Z') caps++;
    return caps > 0;
  }
  function isCodesLine(line) {
    var parts = line.split(' '), k, yes = 0, no = 0;
    for (k = 0; k < parts.length; k++) {
      if (parts[k] === '' || isMark(parts[k])) continue;
      if (isBellToken(parts[k])) return false;                        // a glyph on the line: it is Bell's, and IY beside it is a guiding-word
      if (isCodesToken(parts[k])) yes++; else no++;
    }
    return yes >= 1 && yes > no;
  }

  // READ, MIXED (user1, 10 x 2026: "selecting a range of text including trichar Bell orthoes in our chat, and clicking
  // Play ... to hear its voice pronounce them"): the text is walked token by token with its positions kept; runs of
  // Bell -- glyphs, the marks after them, and the guiding-words beside them -- are read by the sheets, and the
  // English between is handed to the Lexillogue, its trail shifted to where it stood. Within a run, glyphs one
  // space apart make a word, two spaces or a mark end it. The trail is the lamp's: each glyph owns its three
  // characters, so a Bell line tints and its word-head runs true.
  function read(text, trail) {
    var L = root.LEXILLOGUE, s = straight(text), n = s.length, toks = [], i = 0, j;
    var lineAt = 0, codesLines = {};                                  // which lines, by their start, are the third orthography
    s.split('\n').forEach(function (ln) { if (isCodesLine(ln)) codesLines[lineAt] = true; lineAt += ln.length + 1; });
    while (i < n) {                                                   // the tokens, with where they stand; a newline is a mark of its own
      var c = s.charAt(i);
      if (c === '\n') { toks.push({ t: '\n', at: i, nl: true }); i++; continue; }
      if (c === ' ') { toks.push({ t: '', at: i, gap: true }); i++; continue; }
      for (j = i; j < n && s.charAt(j) !== ' ' && s.charAt(j) !== '\n'; j++) {}
      toks.push({ t: s.slice(i, j), at: i }); i = j;
    }
    var k, prev, next, bellish = [], line0 = 0, onCodes = false;
    for (k = 0; k < toks.length; k++) {                               // which tokens belong to Bell, and which lines are codes
      var tk = toks[k];
      if (tk.nl) { bellish.push(false); line0 = tk.at + 1; onCodes = false; continue; }
      if (tk.at === line0 || (k === 0)) onCodes = !!codesLines[line0];
      if (onCodes && !tk.gap) { tk.codes = true; bellish.push(true); continue; }
      if (tk.gap) { bellish.push(false); continue; }
      if (isBellToken(tk.t)) { bellish.push(true); continue; }
      prev = null; next = null;
      for (j = k - 1; j >= 0; j--) if (!toks[j].gap) { prev = toks[j]; break; }
      for (j = k + 1; j < toks.length; j++) if (!toks[j].gap) { next = toks[j]; break; }
      var near = (prev && !prev.nl && isBellToken(prev.t)) || (next && !next.nl && isBellToken(next.t));
      bellish.push(near && (isMark(tk.t) || CODES[tk.t] === true));
    }
    var out = '', bad = [], w = '', engFrom = -1, engTo = -1;
    function endWord() { if (w) { out += w + ' '; w = ''; } }
    function flushEnglish() {
      if (engFrom < 0) return;
      var sub = s.slice(engFrom, engTo), codes = L.say(sub);
      if (trail) { var tr = L.trace(sub), e; for (e = 0; e < tr.length; e++) { if (tr[e].pos !== undefined) tr[e].pos += engFrom; trail.push(tr[e]); } }
      out += codes + (codes.charAt(codes.length - 1) === ' ' ? '' : ' '); engFrom = -1;
    }
    for (k = 0; k < toks.length; k++) {
      var tk = toks[k];
      if (!bellish[k]) {
        if (tk.gap && engFrom >= 0) { engTo = tk.at + 1; continue; }                 // a space inside English: carried
        if (tk.gap) { endWord(); continue; }                                           // a space inside Bell: a word boundary when doubled, a glyph gap when single
        endWord(); if (engFrom < 0) engFrom = tk.at; engTo = tk.at + tk.t.length; continue;
      }
      flushEnglish();
      if (isMark(tk.t)) { endWord(); out += tk.t + ' '; if (trail) trail.push({ word: tk.t, pos: tk.at, mark: tk.t }); continue; }
      if (tk.codes) {                                                               // the third orthography: as it stands
        endWord();
        if (!parsesAsCodes(tk.t)) { if (trail) { trail.push({ word: tk.t, pos: tk.at }); trail.push({ word: tk.t, rule: null }); } continue; }   // an arrow or a word on a codes line: silent, as a mark no rule knows (it broke the bluebox once: "not a phoneme code: ->")
        out += tk.t + ' '; if (trail) { trail.push({ word: tk.t, pos: tk.at }); trail.push({ rule: 'codes', out: tk.t, at: 1, text: tk.t }); } continue;
      }
      if (CODES[tk.t] === true && !isBellToken(tk.t)) {                              // a guiding-word: the sound it names
        w += tk.t; if (trail) { trail.push({ word: tk.t, pos: tk.at }); trail.push({ rule: 'bell', out: tk.t, at: 1, text: tk.t, label: true }); } continue;
      }
      if (B[tk.t] === undefined) { bad.push(tk.t); if (trail) { trail.push({ word: tk.t, pos: tk.at }); trail.push({ word: tk.t, rule: null }); } continue; }
      w += B[tk.t]; if (trail) { trail.push({ word: tk.t, pos: tk.at }); trail.push({ rule: 'bell', out: B[tk.t], at: 1, text: tk.t }); }
      // a single space after a glyph joins; the gap token that follows is handled above: a lone gap ends nothing
      if (k + 1 < toks.length && toks[k + 1].gap && !(k + 2 < toks.length && toks[k + 2].gap)) k++;   // one space: the same word goes on
    }
    endWord(); flushEnglish();
    if (bad.length && BELL.report) BELL.report(bad);
    while (out.indexOf('  ') >= 0) out = out.split('  ').join(' ');
    read.unread = bad;
    return out;
  }
  function trace(text) { var t = []; read(text, t); return t; }

  // Bell in threes -> Ecouter phone codes, the whole text taken as Bell. The glyphs of a word run together; a blank
  // ends a word; the marks . ! ? , stand as words of their own, for the tune, as the Lexillogue leaves them.
  function codes(text) {
    var parts = straight(text).split('\n').join(' . ').split(' '), words = [], w = '', bad = [], k, p;
    for (k = 0; k < parts.length; k++) {
      p = parts[k];
      if (p === '') { if (w) { words.push(w); w = ''; } continue; }
      if (isMark(p)) { if (w) { words.push(w); w = ''; } words.push(p); continue; }
      if (B[p] === undefined) { bad.push(p); continue; }
      w += B[p];
    }
    if (w) words.push(w);
    if (bad.length && BELL.report) BELL.report(bad);
    return { codes: words.join(' ') + (words.length ? ' ' : ''), unread: bad };
  }
  // the quiet report: a glyph met that the sheets do not know, or know in grey. Surfaced, not vanished.
  function report(bad) {
    var msg = 'bell: ' + bad.length + ' glyph' + (bad.length === 1 ? '' : 's') + ' this voice cannot yet say: ' + bad.join(' ');
    if (typeof console !== 'undefined' && console.warn) console.warn(msg);
    else if (typeof print === 'function') print(msg);
  }
  var BELL = { table: B, grey: GREY, slice: slice, notice: notice, has: has, read: read, trace: trace, codes: codes, straight: straight, report: report, CODES: CODES, isCodesLine: isCodesLine,
    CONSONANTS: CONSONANTS, VOWELS: VOWELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = BELL;
  else root.BELL = BELL;
})(root);

// ======== lamp.js ========
/* lamp.js -- the lamp: the brick it was all for.
   user1, 3 x 2026: "Each inked letter is one lamp of
   a spectrogram. When the voice bends away from
   flat, the letter's hue tilts with it. One turn of
   the wheel to the octave, anchored on the voice's
   own resting pitch." And 11 x: "Take the sound of
   the text. Derive a spectrogram. Assign a full
   color wheel to one octave. Reapply the wheel up
   and down. Take the hue and vividity for hue and
   saturation of the typographic character. Apply
   that in mixture to medium-white, because we do
   not wish to read a rainbow, but be tilted by
   tone." The aim: "Syntax highlight any text from
   Chaucer to Chat output."

   How a letter knows its pitch: the Lexillogue's
   trail says which letters each rule read and which
   codes it gave; phones.js tags every frame with the
   code that made it; so each letter owns some
   frames, and the frames carry f0 and voice. No
   alignment, no listening. The pitch is the score's,
   not measured from the sound: the voice sings what
   the score says (voicebox.test.js proves it), and
   the score is exact where a measurement wobbles.

     LAMP.tint('Right? ... Right!')
       -> [{ ch, f0, voice, hue, sat, css }, ...]
          one per character of the text

   hue: the wheel turns once an octave from the
   voice's own pitch; flat is the home hue, green
   unless asked, and the hue climbs with the pitch:
   up is a blueshift, down a redshift. sat: the vividity, how far from
   flat, an eighth of an octave up or down being full.
   css: the hue mixed into medium-white by three
   quarters of sat at most, so a
   flat voice reads as text and a bent one tilts. */
(function (root) {
  'use strict';
  var L = root.LEXILLOGUE || require('./lexillogue.js');
  var P = root.PHONES || require('./phones.js');
  function tint(text, o) {
    o = o || {};
    var home = o.f0 || 118, homeHue = o.hue === undefined ? 120 : o.hue, full = o.full || 0.125;   // an eighth of an octave: the voice's own range, found by user1's eye (11 x: "each character now scintillates gently")   // flat is green (user1, 11 x: "green carries midband spectral power ... fast tendencies would experience blueshift, and slower ones experience redshift"); up the wheel is toward blue, down toward red
    var white = o.white || [232, 232, 232], mix = o.mix === undefined ? 0.75 : o.mix, floor = o.floor === undefined ? 0.6 : o.floor, knee = o.knee === undefined ? 0.67 : o.knee;
    var ceiling = o.ceiling, step = o.step || 360;    // ceiling: for a light ground, where the ink is dark and a colour must not go too light; step: degrees of hue an octave (Noct: the golden angle)
    // THE TRAIL: the Lexillogue's, or, where the text carries Bell's threes, Bell's own, with the English between
    // handed to the Lexillogue in place (user1, 10 x 2026): a Bell line tints by what it says, and its head runs true
    var BELL = root.BELL, trail = (BELL && BELL.has(text)) ? BELL.trace(text) : L.trace(text), codes = [], owner = [], label = [], out = [], i, j, k, e, n, pos = -1, one = false, chars = [];
    // the codes in order, each knowing the span of text that made it, with the pauses as the Lexillogue gives them
    for (i = 0; i < trail.length; i++) {
      e = trail[i];
      if (e.word !== undefined) {
        pos = e.pos; one = !!e.said;                    // a digit: its name's rules all point at the one character
        if (e.mark) { codes.push(' '); owner.push(null); label.push(false); codes.push(e.mark); owner.push([pos, pos + 1]); label.push(false); codes.push(' '); owner.push(null); label.push(false); }
        else { codes.push(' '); owner.push(null); label.push(false); }
        continue;
      }
      if (!e.rule) continue;                            // a letter no rule read: silent
      n = P.split(e.out.split(' ').join(''));          // one rule's codes
      for (k = 0; k < n.length; k++) { codes.push(n[k]); owner.push(one ? [pos, pos + 1] : [pos + e.at - 1, pos + e.at - 1 + e.text.length]); label.push(!!e.label); }
    }
    // the space between words
    var seq = [];
    for (i = 0; i < codes.length; i++) { if (codes[i] === ' ' && (i === 0 || seq[seq.length - 1] === ' ')) continue; seq.push(codes[i]); }
    var frames = P.frames(seq, { f0: home, tune: o.tune }), ci;
    // frames back to codes: seq and codes differ only by dropped doubled spaces, so walk them together
    var map = [], s2 = 0;
    for (i = 0; i < codes.length; i++) { if (codes[i] === ' ' && (i === 0 || codes[i - 1] === ' ')) { map.push(-1); continue; } map.push(s2++); }
    var back = []; for (i = 0; i < map.length; i++) if (map[i] >= 0) back[map[i]] = i;
    // THE SUNG LINE, a millisecond at a time: the pitch and the voice as the throat glides them (a frame's values
    // are reached at its end), and which code owns each millisecond. So the glide is in the colour as it is in
    // the air. user1, 11 x 2026: "Each letter must be bright and of its moment"; and two small windows: a postfix
    // DRAG, the tail of what came before, and a smaller anticipatory INFLECT, the start of what comes next,
    // "the postfix drag must be small in terms of its temporal expanse, and any anticipatory inflect still
    // smaller ... Otherwise we would muddy all."
    var drag = o.drag === undefined ? 40 : o.drag, inflect = o.inflect === undefined ? 15 : o.inflect;
    var total = 0; for (i = 0; i < frames.length; i++) total += frames[i].ms;
    var lineF = new Float32Array(total), lineV = new Float32Array(total), lineA = new Float32Array(total), lineC = new Int32Array(total), at = 0, from = frames[0], to, k, t;
    for (i = 0; i < frames.length; i++) {
      to = frames[i]; ci = back[to.ci]; if (ci === undefined) ci = -1;
      for (k = 0; k < to.ms; k++) {
        t = (k + 1) / to.ms; lineF[at] = from.f0 + (to.f0 - from.f0) * t; lineV[at] = from.voice + (to.voice - from.voice) * t;
        lineA[at] = (from.breath || 0) + ((to.breath || 0) - (from.breath || 0)) * t + (from.hiss || 0) + ((to.hiss || 0) - (from.hiss || 0)) * t;   // the air: breath and hiss
        lineC[at] = ci; at++;
      }
      from = to;
    }
    var first = [], last = [];                          // each code's span on the line, in ms
    for (i = 0; i < total; i++) { ci = lineC[i]; if (ci < 0) continue; if (first[ci] === undefined) first[ci] = i; last[ci] = i + 1; }
    // each character: its letters' codes give it a span; the drag reaches back, the inflect forward; the mean
    // of the sung pitch over the voiced milliseconds in that window, weighted by the voice. A silent character
    // takes its left neighbour's.
    // THE ROOM (user1, 11 x 2026: "we tint a transparent background with the room"; "let it be complementary, where
    // that is true. Some letters conring with their situations, and some clang out brightly against it"). The
    // background carries the slow tone: the trailing mean of the tune over the room's memory, the drag made long,
    // and its light is the voice's ring against its air over the same span (a breathy passage sits in a dim room,
    // a ringing one in a lit room). A letter whose moment agrees with the room sits on its own hue and is quiet; one
    // that departs sits on the hue it left, and at a half turn they are true complements and it clangs. Agreement
    // is quiet by construction, departure loud by construction. Rooms: close (a small intimate room, a shul for
    // whispers: 150 ms, faint), normal (400 ms), royal (the stone hall of Elizabeth R: 1200 ms, bright).
    var ROOMS = { close: [150, 0.10], normal: [400, 0.18], royal: [1200, 0.30] }, room = ROOMS[o.room] || null;   // memory in ms, and the light's strength
    for (i = 0; i < text.length; i++) chars.push({ ch: text.charAt(i), f0: 0, voice: 0, ms: 0, a: -1, b: -1 });
    for (i = 0; i < codes.length; i++) {
      if (!owner[i] || first[i] === undefined) continue;
      for (j = owner[i][0]; j < owner[i][1] && j < text.length; j++) { if (chars[j].a < 0 || first[i] < chars[j].a) chars[j].a = first[i]; if (last[i] > chars[j].b) chars[j].b = last[i]; if (label[i]) chars[j].label = true; }
    }
    var lastF = home, lastV = 0, pitchHome = home;
    for (i = 0; i < chars.length; i++) {
      var c = chars[i], wf = 0, wv = 0, w = 0, own = 0, ownV = 0;
      if (c.a >= 0) {
        // every voiced millisecond of the letter's own alike (a stop's breath carries the tune's end as the vowel
        // does); the dragged and inflected milliseconds at a third, so a short sound is tinted by its neighbours
        // and not drowned by them
        for (k = Math.max(0, c.a - drag); k < Math.min(total, c.b + inflect); k++) { if (lineV[k] <= 0) continue; var wk = k >= c.a && k < c.b ? 1 : 0.33; wf += lineF[k] * wk; w += wk; }
        for (k = c.a; k < c.b; k++) { ownV += lineV[k]; own++; }
      }
      if (room && c.a >= 0) {                              // the room at this letter: the tune's mean over its memory, and the ring in it
        var rf = 0, rn = 0, rv = 0, ra = 0;
        for (k = Math.max(0, c.b - room[0]); k < c.b; k++) { if (lineV[k] > 0) { rf += lineF[k]; rn++; } rv += lineV[k]; ra += lineA[k]; }
        c.roomF = rn ? rf / rn : 0; c.ring = rv + ra > 0 ? rv / (rv + ra) : 0;
      }
      c.from = c.a; c.to = c.b; delete c.a; delete c.b;   // where the letter sits in the sung line, ms, for a playback head
      if (w > 0) { c.f0 = wf / w; c.voice = own ? ownV / own : 0; lastF = c.f0; lastV = c.voice; } else { c.f0 = lastF; c.voice = c.ch === ' ' ? 0 : lastV; }
    }
    // THE SMART SATURATE (user1, 11 x 2026, from photographic restoration: "crop in to the saturation and hue
    // spectra, wherever it placed its bell ... after aligning the spectra to cohere ... 'oh, I see Worn's vocal
    // range. He did not much tonate himself. Yet we know monotone is unacceptable, so we shall boost him
    // coherently.'"). With o.auto: ALIGN, the passage's own median pitch becomes flat, so the wheel is anchored on
    // what the voice did here; CROP, full-at becomes the passage's widest tilt but one in twenty, so its own range
    // fills the colour, the knee catching the top. The absolute is traded for the relative, as levels always trade
    // it; a monotone passage is held to a floor of a twentieth of an octave so its grain is not blown up into noise.
    if (o.auto) {
      var fs = [], devs = [];
      for (i = 0; i < chars.length; i++) if (chars[i].voice > 0) fs.push(chars[i].f0);
      if (fs.length) {
        fs.sort(function (p, q) { return p - q; }); pitchHome = fs[Math.floor(fs.length / 2)];
        for (i = 0; i < fs.length; i++) devs.push(Math.abs(Math.log(fs[i] / pitchHome) / Math.LN2));
        devs.sort(function (p, q) { return p - q; }); full = Math.max(0.05, devs[Math.min(devs.length - 1, Math.floor(devs.length * 0.95))]);
      }
    }
    for (i = 0; i < chars.length; i++) {
      var c = chars[i];
      var oct = Math.log(c.f0 / pitchHome) / Math.LN2;   // octaves from home; the wheel turns once each
      c.sat = Math.min(1, Math.abs(oct) / full) * (c.voice > 0 ? 1 : 0) * (o.vivid === undefined ? 1 : o.vivid);   // vivid: a dial on the whole (user1, 12 x: on a screen "the colors run away with the show")
      // OMNIA (user1, 11 x: Viriditas omnia vivificat; for "the hordes of people saying GREEN GREEN ITS ALL GREEN I
      // WANT MY RAINBOW": the same structure, "only how we represent its vividity"). A full tilt reaches half a
      // turn each way instead of an eighth, and the mix goes all the way to colour; the floor and the knee stay.
      // and VIVIFICAT (user1: "a blend of both, favoring neither"; then "my eye wishes to push it toward Omnia, because
      // life is lively there ... Allow it to go to 62%"): 62 hundredths of the way from the one to the other, in hue and in mix. Three modes,
      // one at a time: o.mode is 'omnia' (the default), 'viriditas' or 'vivificat'; o.omnia true is 'omnia'.
      // OMNIA BECAME THE DEFAULT (user1, 28 x 2026: "It's defensible, it's described, and it's a knockout"): asked for
      // nothing, the lamp shows the whole wheel, so no one takes it for a greenifier. Viriditas is a word away.
      var mode = o.mode || 'omnia', turn = step * oct, whole = 180 * Math.max(-1, Math.min(1, oct / full));
      if (mode === 'none') { c.hue = ((homeHue + turn) % 360 + 360) % 360; c.css = css(c.hue, 0, white); }   // NONE, first of the modes: the text as it is, to compare in place (user1)
      else if (mode === 'omnia') { c.hue = ((homeHue + whole) % 360 + 360) % 360; c.css = css(c.hue, c.sat, white, floor, knee, ceiling); }
      else if (mode === 'vivificat') { var lean = o.lean === undefined ? 0.62 : o.lean; c.hue = ((homeHue + turn + (whole - turn) * lean) % 360 + 360) % 360; c.css = css(c.hue, c.sat * (mix + (1 - mix) * lean), white, floor, knee, ceiling); }
      else { c.hue = ((homeHue + turn) % 360 + 360) % 360; c.css = css(c.hue, c.sat * mix, white, floor, knee, ceiling); }
      // THE GUIDING-WORDS (user1, 10 x 2026): a code standing beside a Bell glyph on a sheet, IY, IH and their kin, is
      // said as the sound it names and wears "a less vivid and no less bright bluegray", the same every time, since
      // the reader is invited to voice them and must know them at a glance
      if (c.label && mode !== 'none') { c.hue = 212; c.sat = 0.28 * (o.vivid === undefined ? 1 : o.vivid); c.css = css(c.hue, c.sat, white, floor, knee, ceiling); }
      if (room && c.roomF > 0 && mode !== 'none') {        // the room's own hue by the same gearing, laid on as a transparent tint
        var roct = Math.log(c.roomF / pitchHome) / Math.LN2, rturn = step * roct, rwhole = 180 * Math.max(-1, Math.min(1, roct / full)), roff;
        roff = mode === 'omnia' ? rwhole : mode === 'vivificat' ? rturn + (rwhole - rturn) * (o.lean === undefined ? 0.62 : o.lean) : rturn;
        c.roomHue = ((homeHue + roff) % 360 + 360) % 360;
        c.roomSat = Math.min(1, Math.abs(roct) / full) * c.ring;
        c.back = rgba(c.roomHue, room[1] * (0.3 + 0.7 * c.roomSat) * c.ring, o.roomLift);   // a room is lit by the ring even at flat; a departure lights it more
      } else c.back = '';
      delete c.ms;
    }
    return chars;
  }
  // THE LUMA FLOOR (user1, 11 x 2026, on "blue" at mix 1: the ue "appears not only blue, but physically smaller
  // than the bl it follows ... our bluest character cannot be so dark, neither our reddest ... lifting luma will
  // dismiss saturation. That is acceptable and even desirable"). The mix into white is linear in luma, so where
  // the hue is darker than the floor the mix is stopped at the amount that lands on the floor. Green is never
  // stopped; blue is held to about a third, red to under a half.
  // THE KNEE (user1, 11 x: a clamp "loses information, in order to not give an undesirable value", a scale "avoids
  // undesirable values by a prior-restraint"; the third way, "real information with minimal distortion and a strong
  // push of sense behind it"). Below the knee, two thirds of what the floor allows, the mix is as asked. Above it
  // the rest of the way to the wall is folded into the last third, on a curve that meets the floor exactly at
  // full: no two tilts collide, and small ones are untouched. What a limiter does to loudness.
  // THE ROOM ON A DARK GROUND (user1, 11 x 2026: on Night "the tinting is difficult to detect in white on black
  // until it is turned up"). A tint on white darkens it by alpha times what the hue lacks in brightness, so every
  // hue shows at once; on black it raises it by alpha times the hue's own brightness, and blue has a fourteenth of
  // green's, red a fifth, and a monitor crushes the result to black. So on a dark ground the hue is lifted toward
  // white by `lift` before it is laid on: a blue hall is then a visible blue.
  function rgba(hue, alpha, lift) {                    // the hue at full, lifted toward white by lift, as a transparent tint of this strength
    var h = hue / 60, x = 1 - Math.abs(h % 2 - 1), r, g, b, L = lift || 0;
    if (h < 1) { r = 1; g = x; b = 0; } else if (h < 2) { r = x; g = 1; b = 0; } else if (h < 3) { r = 0; g = 1; b = x; }
    else if (h < 4) { r = 0; g = x; b = 1; } else if (h < 5) { r = x; g = 0; b = 1; } else { r = 1; g = 0; b = x; }
    r += (1 - r) * L; g += (1 - g) * L; b += (1 - b) * L;
    return 'rgba(' + Math.round(255 * r) + ',' + Math.round(255 * g) + ',' + Math.round(255 * b) + ',' + alpha.toFixed(3) + ')';
  }
  function css(hue, amount, white, floor, knee, ceiling) {   // the hue at full, mixed into the base by amount, held above the floor or below the ceiling
    var h = hue / 60, x = 1 - Math.abs(h % 2 - 1), r, g, b;
    if (h < 1) { r = 1; g = x; b = 0; } else if (h < 2) { r = x; g = 1; b = 0; } else if (h < 3) { r = 0; g = 1; b = x; }
    else if (h < 4) { r = 0; g = x; b = 1; } else if (h < 5) { r = x; g = 0; b = 1; } else { r = 1; g = 0; b = x; }
    if (floor !== undefined) {
      var lw = (0.2126 * white[0] + 0.7152 * white[1] + 0.0722 * white[2]) / 255, lc = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lc < floor && lw > floor) {
        var most = (lw - floor) / (lw - lc), k = (knee === undefined ? 0.67 : knee) * most;   // most: the amount that lands on the floor
        if (most < 1 && amount > k) { var u = Math.min(1, (amount - k) / (1 - k)); amount = k + (most - k) * u * (2 - u); }
      }
    }
    if (ceiling !== undefined) {                          // the same, upside down, for a dark ink on a light ground
      var lw2 = (0.2126 * white[0] + 0.7152 * white[1] + 0.0722 * white[2]) / 255, lc2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lc2 > ceiling && lw2 < ceiling) {
        var most2 = (ceiling - lw2) / (lc2 - lw2), k2 = (knee === undefined ? 0.67 : knee) * most2;
        if (most2 < 1 && amount > k2) { var u2 = Math.min(1, (amount - k2) / (1 - k2)); amount = k2 + (most2 - k2) * u2 * (2 - u2); }
      }
    }
    function m(w, c) { return Math.round(w * (1 - amount) + 255 * c * amount); }
    return 'rgb(' + m(white[0], r) + ',' + m(white[1], g) + ',' + m(white[2], b) + ')';
  }
  // the text as HTML: each character wrapped in its colour, runs of one colour kept together; with o.words, each
  // word (a run without spaces) wrapped too, class "w", carrying data-end: the millisecond its sound ends, for
  // a playback head to follow
  function html(text, o) {
    var t = tint(text, o), out = '', i, run = '', last = null, words = o && o.words, inWord = false, wend = 0;
    function esc(s) { return s.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;'); }
    // a room goes on as two variables, --room (r g b) and --ra (alpha), so a page may scale the glow in its style
    // sheet, background: rgb(var(--room) / calc(var(--ra) * var(--glow))), without re-rendering a span
    function roomVars(back) { var n = back.slice(5, -1).split(','); return ';--room:' + n[0] + ' ' + n[1] + ' ' + n[2] + ';--ra:' + n[3]; }
    function flush() { if (run) { var parts = last.split('|'); out += '<span style="color:' + parts[0] + (parts[1] ? roomVars(parts[1]) : '') + '">' + esc(run) + '</span>'; run = ''; } }
    function isSpace(ch) { return ch === ' ' || ch === String.fromCharCode(10) || ch === String.fromCharCode(9); }
    for (i = 0; i < t.length; i++) {
      var sp = isSpace(t[i].ch);
      if (words && !sp && !inWord) { flush(); wend = 0; var j = i; while (j < t.length && !isSpace(t[j].ch)) { if (t[j].to > wend) wend = t[j].to; j++; } out += '<span class="w" data-end="' + wend + '">'; inWord = true; }
      if (words && sp && inWord) { flush(); out += '</span>'; inWord = false; }
      var key = t[i].css + '|' + (t[i].back || '');
      if (key !== last && run) flush();
      run += t[i].ch; last = key;
    }
    flush(); if (inWord) out += '</span>';
    return out;
  }
  var LAMP = { tint: tint, html: html, css: css };
  if (typeof module !== 'undefined' && module.exports) module.exports = LAMP;
  else root.LAMP = LAMP;
})(root);

  // ======== the library ========
  var LIB = {
    tint: root.LAMP.tint, html: root.LAMP.html, css: root.LAMP.css, codes: root.LEXILLOGUE.say, trace: root.LEXILLOGUE.trace,
    frames: function (text, o) { o = o || {}; return root.PHONES.frames(o.codes || root.LEXILLOGUE.say(text), o); },
    PHONES: root.PHONES, RULES: root.NRL_RULES, LEXILLOGUE: root.LEXILLOGUE, LAMP: root.LAMP
  };
  if (outer) outer.exports = LIB; else global.VIRIDITAS = LIB;
})(typeof window !== 'undefined' ? window : this, typeof module !== 'undefined' && module.exports ? module : null);
