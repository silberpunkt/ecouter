// index.worker.js -- one sentence, sung in a voice. Ecouter's front page makes each sentence in a worker of its own
// with this; and loads the same file as a plain script, so that where a worker cannot start the page can do the same
// work itself. d: { n, words, punct, quote, voice, tone, song, steady, chain }. Back comes the sound, and the score's
// own account of itself, a frame at a time: how long, what pitch, how voiced, which word.
if (typeof importScripts === 'function') importScripts('ecouter.js', 'ecouter-score.js');
function ecouterSing(d) {
  var E = ECOUTER, S = E.SCORE, i, f;
  var read = S.read(d.words, d.punct, { tune: d.chain.conduction === false ? 'apology' : 'conduction' });
  var sc = S.as(read, d.voice, { tone: d.tone, song: d.song, steady: d.steady, lift: d.quote });
  var pcm = S.say(sc, { voice: d.chain }), n = sc.frames.length;
  var ms = new Float32Array(n), f0 = new Float32Array(n), vo = new Float32Array(n), w = new Int16Array(n);
  for (i = 0; i < n; i++) { f = sc.frames[i]; ms[i] = f.ms; f0[i] = f.f0 || 0; vo[i] = f.voice || 0; w[i] = sc.word[f.ci] === undefined ? -1 : sc.word[f.ci]; }
  return { n: d.n, pcm: pcm, ms: ms, f0: f0, vo: vo, w: w };
}
if (typeof document === 'undefined' && typeof postMessage === 'function') onmessage = function (e) { var r = ecouterSing(e.data); postMessage(r, [r.pcm.buffer]); };
