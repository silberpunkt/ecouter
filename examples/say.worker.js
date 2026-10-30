// say.worker.js -- one sentence, made in a worker of its own. Loads the library, scores the codes it is sent,
// sings them through the voice it is sent, and hands the samples back without a copy.
importScripts('../ecouter.js');
onmessage = function (e) {
  var d = e.data, E = ECOUTER, fr = E.PHONES.frames(d.codes, { tune: d.voice.conduction === false ? "apology" : "conduction" });
  var s = E.CHAIN.settings(d.voice); s.frames = fr;
  var pcm = E.CHAIN.make(s).pcm;
  postMessage({ n: d.n, pcm: pcm }, [pcm.buffer]);
};
