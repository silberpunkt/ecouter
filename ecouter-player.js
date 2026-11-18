/* ecouter-player.js -- the player ring of Ecouter: a tape, and a head that does not pop.
   Written by repo.make.js on 2026-11-18 from the ecouter workshop; do not edit here.

   A file beside the library, not part of it. Load it after ecouter.js or ecouter-speech.js:
     <script src="ecouter-speech.js"></script>
     <script src="ecouter-player.js"></script>
     var p = ECOUTER.PLAYER.open();                    // one audio context, guarded; the head on the audio thread
     p.load(ECOUTER.say("Is it you?"));                // the sound, as a tape
     p.play(0.83);                                     // at four fifths of the spoken pace, and as much lower
     p.stop(); p.seek(1.5); p.play(-1);                // rest; lift the head and set it down; backward
     p.drag(seconds); p.drop();                        // a hand has the tape; the hand lets go
     p.resound(true);                                  // the air about the machine, after the head
   With the score ring, a voice by name at the speed of its own tape:
     var s = ECOUTER.SCORE.as(ECOUTER.SCORE.read(["Is", "it", "you"], ["", "", "?"]), "obelus");
     p.load(ECOUTER.SCORE.say(s)).play(s.voice.speed);
   Without a browser:  ECOUTER.PLAYER.dub(ECOUTER.PLAYER.tape([pcm]), { speed: 0.83 })   // Float32Array
   In node:  var E = require("./ecouter.js"); require("./ecouter-player.js"); E.PLAYER.dub(...)

   The head, its ramps and Resound were found in Obelus. The ecouter workshop, 2026. */
(function (hang) {
  if (typeof ECOUTER !== 'undefined') hang(ECOUTER);                       // a page, or QuickJS: the library is on the global
  else if (typeof module !== 'undefined' && module.exports) { module.exports = hang; hang(require('./ecouter.js')); }   // node: hung on the whole library, and handed out to be hung on another
  else (typeof window !== 'undefined' ? window : this).PLAYER = hang({});   // a page with no library: the player stands alone
})(function (E) {
  var root = {}, module, exports;   // the module below sees no module, and attaches to root

// ======== player.js ========
/* player.js -- the player: a tape, and a head that does not pop.

   Ecouter gives a sentence back as finished sound, and plays nothing. This
   ring plays it, the way Obelus learned to (its IOUs 1 and 4, 15 xi 2026):
   the sound is a TAPE, and a HEAD reads the tape at a place and a pace.
   The pace may be anything, either way: 1 is the pace it was spoken at,
   0.83 is Obelus's own, -1 is backward. Pitch goes with pace, as on a
   tape. The head can be set running, or given to a hand that drags it.

     var p = PLAYER.open();                  // one audio context, guarded; the head on the audio thread
     p.load(pcm, 16000);                     // a tape from one sound (or from several, end to end)
     p.play(0.83);                           // run it; p.stop() rests the head where it is
     p.seek(1.5);                            // lift the head and set it down, in seconds of tape
     p.drag(1.2);                            // a hand has the tape: say where, as often as it moves
     p.drop();                               // the hand lets go
     p.resound(true);                        // the air about the machine, after the head
     p.where()                               // where the head is now, in seconds of tape

   Without a browser there is no head to hear, but the same head can run a
   tape into a buffer:  PLAYER.dub(PLAYER.tape([pcm], 16000), { speed: 0.83 }).

   Three things were learned the hard way, and are kept here.
   THE AUDIO THREAD. A head asked for its next few milliseconds on the thread
     that paints the page is late whenever a frame runs long, and in Chromium a
     late head is a pop. So the head is an AudioWorklet. Where an engine has
     none (Servo), the same head runs as a ScriptProcessor, and nothing else
     changes.
   NO POP. The head never jumps in loudness: starting, stopping and being
     lifted are each a ramp of four thousandths of a second.
   THE ROOM AFTER THE HEAD. A room laid into the sound is dragged with it, and
     a room played backward is heard as one. RESOUND is after the head: the air
     about the machine, which stays still. */
(function (root) {
  'use strict';

  /* THE TAPE. Stretches of sound end to end, each with its place on the tape in seconds at the spoken pace. A stretch
     may be null: not yet laid, and silent until it is. bounds may be given, when a stretch is to last other than its
     own length (Obelus fits each sentence to a width of line); else each lasts as long as it is. */
  function tape(parts, sr, bounds) {
    var i, b;
    parts = parts ? Array.prototype.slice.call(parts) : []; sr = sr || 16000;
    if (bounds) b = new Float64Array(bounds);
    else { b = new Float64Array(parts.length + 1); for (i = 0; i < parts.length; i++) b[i + 1] = b[i] + (parts[i] ? parts[i].length / sr : 0); }
    return { parts: parts, sr: sr, bounds: b, seconds: b.length ? b[b.length - 1] - b[0] : 0 };
  }

  /* THE HEAD. One plain record, and two functions that are complete in themselves, because they are also written out
     as text and sent to the audio thread: TAKE hears a word from the page, RUN fills the next block of sound.
       at      where the head is, in seconds of tape          g      its loudness now, which only ever ramps
       on      is it sounding                                 pace   the pace it runs at, when it runs by itself
       follow  a hand has it: P, base and t are where the hand said the tape was, how fast it was moving, and when
       seek    a place it has been told to go to, once it has fallen silent
       end     at the end of the tape: 'stop', 'through' (round again) or 'reflect' (turn back) */
  function head() { return { parts: [], b: null, at: 0, g: 0, on: false, pace: 1, vol: 1, follow: false, P: 0, base: 0, t: 0, seek: null, end: 'stop', ended: false }; }
  function take(h, d, now) {
    var k = d.k, end = h.b && h.b.length ? h.b[h.b.length - 1] : 0;
    if (k === 'tape') { h.parts = d.parts; h.b = d.bounds; h.at = d.bounds && d.bounds.length ? d.bounds[0] : 0; h.on = false; h.follow = false; h.seek = null; h.ended = false; }
    else if (k === 'part') h.parts[d.i] = d.pcm;
    else if (k === 'play') {     // told to play with no tape left before it, it begins from the far end
      var lo = h.b && h.b.length ? h.b[0] : 0, at = h.seek !== null ? h.seek : h.at;
      if (d.pace !== undefined) h.pace = d.pace;
      if (h.ended || (h.end === 'stop' && ((h.pace < 0 && at <= lo) || (h.pace > 0 && at >= end)))) h.seek = h.pace < 0 ? end : lo;
      h.follow = false; h.on = true; h.ended = false;
    }
    else if (k === 'stop') { h.on = false; h.follow = false; }
    else if (k === 'seek') { h.seek = d.at; h.ended = false; }
    else if (k === 'follow') { h.follow = true; h.on = true; h.ended = false; h.P = d.P; h.base = d.base; h.t = now; }
    else if (k === 'set') { if (d.pace !== undefined) h.pace = d.pace; if (d.vol !== undefined) h.vol = d.vol; if (d.end !== undefined) h.end = d.end; }
  }
  /* RUN is Obelus's head, with the line taken out of it: the tape is measured in seconds where his was in the
     picture elements of a line of type. Followed, it runs at the pace the hand was moving, nudged by three in the
     hundred at most toward the place the hand said (twelve, if it has fallen a second behind), and lifted outright if
     it is five seconds away; a hand that is still is silence. If no word has come for a quarter of a second it runs on
     as it was. Past three times the spoken pace it is faded, and by eight it is gone. */
  function run(h, out, now, rate) {
    var n = out.length, b = h.b, last = b ? b.length - 1 : 0, t;
    if (!b || last < 1) { for (t = 0; t < n; t++) out[t] = 0; h.g = 0; return; }
    var lo0 = b[0], end = b[last], pace = h.pace, sounding = h.on, still = false, est = 0;
    if (h.follow) {
      var stale = now - h.t > 0.25; est = stale ? h.at : h.P + h.base * (now - h.t);
      if (Math.abs(est - h.at) > 5 && h.seek === null) h.seek = est;
      if (Math.abs(h.base) < 1 / 150) { pace = 0; sounding = false; still = true; }
      else { var err = est - h.at, lim = (Math.abs(err) > 1 ? 0.12 : 0.03) * Math.abs(h.base); pace = h.base + Math.max(-lim, Math.min(lim, err * 0.8)); }
    }
    if (pace === 0) sounding = false;     // a tape that is not moving says nothing
    var rel = Math.abs(pace), tg = sounding ? h.vol * (rel <= 3 ? 1 : Math.max(0, 1 - (rel - 3) / 5)) : 0;
    var step = pace / rate, dg = 1 / (0.004 * rate), p = h.at, g = h.g, p0 = 1, p1 = 0, pcm = null, v, x, a, lo, hi, m, want;
    for (t = 0; t < n; t++) {
      if (h.seek !== null && g <= 0) { p = h.seek; h.seek = null; p0 = 1; p1 = 0; }
      want = h.seek !== null ? 0 : tg;
      g += Math.max(-dg, Math.min(dg, want - g));
      if (!h.follow && h.on) {
        if (p >= end && step > 0) { if (h.end === 'through') p = lo0 + (p - end); else if (h.end === 'reflect') { h.pace = pace = -pace; step = -step; p = end; } else { h.on = false; h.ended = true; tg = 0; p = end; } }
        else if (p <= lo0 && step < 0) { if (h.end === 'through') p = end - (lo0 - p); else if (h.end === 'reflect') { h.pace = pace = -pace; step = -step; p = lo0; } else { h.on = false; h.ended = true; tg = 0; p = lo0; } }
      }
      if (p < p0 || p >= p1) {
        if (p < lo0) { p0 = -1e15; p1 = lo0; pcm = null; }
        else if (p >= end) { p0 = end; p1 = 1e15; pcm = null; }
        else { lo = 0; hi = last; while (hi - lo > 1) { m = (lo + hi) >> 1; if (b[m] <= p) lo = m; else hi = m; } p0 = b[lo]; p1 = b[lo + 1]; pcm = h.parts[lo] || null; }
      }
      v = 0;
      if (pcm && g > 0) { x = (p - p0) / (p1 - p0) * pcm.length; a = Math.floor(x); if (a >= 0 && a < pcm.length - 1) v = pcm[a] + (pcm[a + 1] - pcm[a]) * (x - a); else if (a === pcm.length - 1) v = pcm[a] * (1 - (x - a)); }
      out[t] = v * g;
      if (h.follow || h.on || g > 0) p += step;
    }
    if (still && g <= 0 && h.seek === null) p = est;
    h.at = Math.max(lo0 - 7, Math.min(end + 7, p)); h.g = g;
  }
  /* The head, as it is sent to the audio thread: the two functions above, as they stand, and a small frame about
     them. Every 2048 samples it says where it is. */
  var HEAD_SRC = 'var take = ' + take.toString() + ';\nvar run = ' + run.toString() + ';\nvar head = ' + head.toString() + ';\n' +
    'registerProcessor(\'ecouter-head\', class extends AudioWorkletProcessor {\n' +
    '  constructor() { super(); var h = this.h = head(); this.n = 0; this.port.onmessage = function (e) { take(h, e.data, currentTime); }; }\n' +
    '  process(inputs, outputs) { var h = this.h, o = outputs[0][0]; run(h, o, currentTime, sampleRate);\n' +
    '    if ((this.n += o.length) >= 2048) { this.n = 0; this.port.postMessage({ at: h.at, on: h.on, ended: h.ended, pace: h.follow ? 0 : h.pace, t: currentTime }); }\n' +
    '    return true; } });\n';

  /* DUB: the head run over a tape into a buffer, with no browser. o.speed: the pace (1); o.rate: the sample rate of
     what comes out (the tape's own); o.from: where to begin, in seconds. It ends where the tape does. */
  function dub(tp, o) {
    o = o || {};
    var rate = o.rate || tp.sr, speed = o.speed === undefined ? 1 : o.speed, h = head(), blocks = [], n = 0, now = 0, i, at = 0;
    if (!speed || !tp.seconds) return new Float32Array(0);
    take(h, { k: 'tape', parts: tp.parts, bounds: tp.bounds }, 0);
    h.at = o.from !== undefined ? o.from : (speed < 0 ? tp.bounds[tp.bounds.length - 1] : tp.bounds[0]); h.g = 1;   // a dub begins at full loudness: nothing was sounding before it
    take(h, { k: 'play', pace: speed }, 0);
    var most = Math.ceil(tp.seconds / Math.abs(speed) * rate) + 2 * 128;
    while (h.on && n < most) { var blk = new Float32Array(128); run(h, blk, now, rate); blocks.push(blk); n += 128; now += 128 / rate; }
    var len = Math.min(n, Math.round(tp.seconds / Math.abs(speed) * rate)), out = new Float32Array(len);
    for (i = 0; i < blocks.length && at < len; i++) { out.set(at + 128 <= len ? blocks[i] : blocks[i].subarray(0, len - at), at); at += 128; }
    return out;
  }

  /* RESOUND (user1, 13 xi 2026: "TTS voices are rarely given their presence: treble-, bass+, slight bright reverb as if
     listening to a friend in a wooden sunlit room. That's all they need."). Three things, all after the head: a lift
     at the chest of the voice; a little taken from the top; and a return that begins a hundredth of a second after
     the voice, is scattered and not regular, has lost a little of its brightness, and is gone in a quarter of a
     second ("much shorter and fall off rapidly, as empty canopied air absorbs sound"). It lies 11.8 dB under the
     voice. It took three tries: the first was "a metal elevator", the second "a floorway of the Death Star". */
  var RESOUND = { chest: { hz: 170, db: 3, q: 0.8 }, top: { hz: 4200, db: -2 }, room: { after: 0.012, lasts: 0.26, gone: 0.2, gain: 0.85 } };
  function room(rate) {     // the return, as one sound: what a single click comes back as. The same numbers every time
    var R = RESOUND.room, len = Math.round(R.lasts * rate), d = new Float32Array(len), seed = 12345, lp = 0, i, t, hit;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    for (i = Math.round(R.after * rate); i < len; i++) {
      t = i / rate - R.after; hit = rnd() < 0.03 + 0.05 * Math.min(1, t / 0.08) ? (rnd() * 2 - 1) : 0;
      lp += (hit * 3 - lp) * 0.3; d[i] = lp * Math.exp(-6.9 * t / R.gone);
    }
    return d;
  }

  /* HEADROOM. What Ecouter makes stands at nine tenths of full scale. Resound lifts the chest of the voice and adds a
     return, and the two together were measured (18 xi 2026, four voices) to raise the peak by as much as a third: at
     full volume that is clipped at the loudspeaker. So a player opens at Obelus's volume, 0.8, which leaves the room
     its room. p.volume(v) changes it. */
  var VOLUME = 0.8;

  /* OPEN: a player, in a page. It never throws. A box with no sound device may refuse to make a context at all (Servo),
     and one that makes it may refuse to wake it (WebKit says so aloud): then the player is there, does nothing, and
     says so: p.silent is true. o.context: a context of your own; o.resound: begin with the room (true);
     o.end: 'stop', 'through' or 'reflect'; o.volume: 0.8 unless said; o.worklet: false to keep the head off the audio thread (only to hear why
     not). p.output is the last node before the loudspeaker, for whoever would draw the sound. */
  function open(o) {
    o = o || {};
    var G = typeof window !== 'undefined' ? window : {}, AC = G.AudioContext || G.webkitAudioContext, ctx = null, node = null, local = null, queue = [], ready = false;
    var p = { silent: false, context: null, output: null, tape: null, speed: 1, on: false, ended: false, thread: 'none', onend: null, onstate: null };
    var seen = { at: 0, pace: 0, t: 0 }, wasOn = false, warm, shelf, wet, resounding = o.resound !== false, hand = { at: 0, t: 0, v: 0, timer: 0, held: false };
    function heard(d) {     // a word from the head: where it is
      seen.at = d.at; seen.pace = d.on ? d.pace : 0; seen.t = d.t; p.on = d.on; p.ended = d.ended;
      if (d.ended && wasOn && p.onend) { wasOn = false; p.onend(); } if (d.on) wasOn = true;
      if (p.onstate) p.onstate(d);
    }
    function send(d) {
      if (p.silent) return;
      if (!ready) { queue.push(d); return; }
      if (node) node.port.postMessage(d); else if (local) take(local, d, ctx.currentTime);
    }
    function begin() { ready = true; var q = queue; queue = []; q.forEach(send); }
    function old() {       // the head on the painting thread: where there is no worklet
      local = head(); var sp = ctx.createScriptProcessor(1024, 0, 1), cnt = 0;
      sp.onaudioprocess = function (ev) { var out = ev.outputBuffer.getChannelData(0); run(local, out, ctx.currentTime, ctx.sampleRate);
        if ((cnt += out.length) >= 2048) { cnt = 0; heard({ at: local.at, on: local.on, ended: local.ended, pace: local.follow ? 0 : local.pace, t: ctx.currentTime }); } };
      sp.connect(warm); p.thread = 'page'; p._sp = sp; begin();
    }
    try { ctx = o.context || new AC(); } catch (e) { p.silent = true; }
    if (!p.silent) {
      p.context = ctx;
      try {
        var R = RESOUND, rate = ctx.sampleRate, ir = ctx.createBuffer(1, Math.round(R.room.lasts * rate), rate), conv = ctx.createConvolver(), mix = ctx.createGain();
        ir.getChannelData(0).set(room(rate)); conv.normalize = true; conv.buffer = ir;
        warm = ctx.createBiquadFilter(); warm.type = 'peaking'; warm.frequency.value = R.chest.hz; warm.Q.value = R.chest.q; warm.gain.value = resounding ? R.chest.db : 0;
        shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = R.top.hz; shelf.gain.value = resounding ? R.top.db : 0;
        wet = ctx.createGain(); wet.gain.value = resounding ? R.room.gain : 0;
        warm.connect(shelf); shelf.connect(mix); shelf.connect(conv); conv.connect(wet); wet.connect(mix); mix.connect(ctx.destination); p.output = mix;
        var can = o.worklet !== false && ctx.audioWorklet && typeof G.AudioWorkletNode !== 'undefined', url = null;
        if (can) { try { url = URL.createObjectURL(new Blob([HEAD_SRC], { type: 'text/javascript' })); } catch (e) { can = false; } }
        if (can) ctx.audioWorklet.addModule(url).then(function () {
          node = new G.AudioWorkletNode(ctx, 'ecouter-head', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
          node.port.onmessage = function (e) { heard(e.data); }; node.connect(warm); p.thread = 'audio'; begin();
        }).catch(function () { try { old(); } catch (e) { p.silent = true; } });
        else old();
      } catch (e) { p.silent = true; }
    }
    if (o.end) send({ k: 'set', end: o.end });
    send({ k: 'set', vol: o.volume === undefined ? VOLUME : o.volume });
    var offline = !!(ctx && G.OfflineAudioContext && ctx instanceof G.OfflineAudioContext);     // a context that renders to a buffer is not asleep, it is waiting to be asked
    function wake() { if (ctx && !offline && ctx.state === 'suspended' && ctx.resume) { try { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} } }
    p.wake = wake;
    /* load: a tape made here from one sound or a list of them, or a tape already made by PLAYER.tape. */
    p.load = function (pcm, sr, bounds) {
      var tp = pcm && pcm.bounds ? pcm : tape(pcm && pcm.length !== undefined && typeof pcm[0] === 'number' ? [pcm] : pcm, sr, bounds);
      p.tape = tp; seen.at = tp.bounds.length ? tp.bounds[0] : 0; seen.pace = 0; p.on = false; p.ended = false; wasOn = false;
      send({ k: 'tape', parts: tp.parts.map(function (x) { return x ? new Float32Array(x) : null; }), bounds: new Float64Array(tp.bounds) });
      return p;
    };
    p.lay = function (i, pcm) { if (p.tape) { p.tape.parts[i] = pcm; send({ k: 'part', i: i, pcm: new Float32Array(pcm) }); } return p; };   // a stretch that was not yet made, now made
    p.play = function (speed) { if (speed !== undefined) p.speed = speed; wake(); hand.held = false; send({ k: 'play', pace: p.speed }); p.on = true; wasOn = true; return p; };
    p.stop = function () { hand.held = false; send({ k: 'stop' }); p.on = false; seen.pace = 0; return p; };
    p.seek = function (at) { send({ k: 'seek', at: at }); seen.at = at; seen.t = ctx ? ctx.currentTime : 0; return p; };
    p.pace = function (speed) { p.speed = speed; send({ k: 'set', pace: speed }); return p; };     // the speed changed while it runs
    p.volume = function (v) { send({ k: 'set', vol: v }); return p; };
    p.ends = function (how) { send({ k: 'set', end: how }); return p; };
    /* drag: the hand has the tape, and says where it is each time it moves. The pace is measured between one saying
       and the next. A hand that says nothing for a fifteenth of a second is holding still, and the head is told so. */
    p.drag = function (at) {
      if (p.silent) return p;
      var now = G.performance ? G.performance.now() / 1000 : Date.now() / 1000, dt = now - hand.t, v = hand.held && dt > 0.001 && dt < 0.25 ? (at - hand.at) / dt : 0;
      wake(); if (!hand.held) send({ k: 'seek', at: at });     // the hand comes down wherever it likes: the head is lifted to it
      hand.v = hand.held ? 0.5 * hand.v + 0.5 * Math.max(-8, Math.min(8, v)) : 0; hand.at = at; hand.t = now; hand.held = true;
      send({ k: 'follow', P: at, base: hand.v }); seen.at = at; seen.pace = 0;
      if (hand.timer) clearTimeout(hand.timer);
      hand.timer = setTimeout(function () { hand.timer = 0; if (hand.held) { hand.v = 0; send({ k: 'follow', P: hand.at, base: 0 }); } }, 66);
      return p;
    };
    p.drop = function (thenPlay) { if (hand.timer) { clearTimeout(hand.timer); hand.timer = 0; } hand.held = false; if (thenPlay) p.play(); else p.stop(); return p; };
    p.resound = function (yes) {
      resounding = !!yes; if (wet) { wet.gain.value = resounding ? RESOUND.room.gain : 0; warm.gain.value = resounding ? RESOUND.chest.db : 0; shelf.gain.value = resounding ? RESOUND.top.db : 0; }
      return p;
    };
    p.resounding = function () { return resounding; };
    /* where: the head's place now, in seconds of tape. The head says where it is some twenty times a second; between
       its sayings the place is carried on at the pace it was running. */
    p.where = function () {
      if (!ctx || !p.tape) return 0;
      var b = p.tape.bounds, at = seen.at + seen.pace * Math.max(0, Math.min(0.25, ctx.currentTime - seen.t));
      return Math.max(b[0], Math.min(b[b.length - 1], at));
    };
    p.close = function () { try { if (node) node.disconnect(); if (p._sp) { p._sp.onaudioprocess = null; p._sp.disconnect(); } if (!o.context && ctx && ctx.close) ctx.close(); } catch (e) {} p.silent = true; };
    return p;
  }

  var PLAYER = { tape: tape, head: head, take: take, run: run, dub: dub, room: room, open: open, RESOUND: RESOUND, VOLUME: VOLUME, HEAD_SRC: HEAD_SRC };
  if (typeof module !== 'undefined' && module.exports) module.exports = PLAYER;
  else root.PLAYER = PLAYER;
})(root);

  root.PLAYER.SR = E.SR || 16000;   // the rate of what Ecouter makes, and of a tape that is not told otherwise
  E.PLAYER = root.PLAYER; return root.PLAYER;
});
