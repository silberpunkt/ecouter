// smoke.js -- does the one file load and speak?  qjs --std test/smoke.js  |  node test/smoke.js
// under plain QuickJS there is no require: the file is loaded as a script and leaves ECOUTER on the global
var FILE = (typeof scriptArgs !== 'undefined' ? scriptArgs[1] : process.argv[2]) === 'min' ? 'ecouter.min.js' : 'ecouter.js';   // `min` checks the small file
if (typeof require !== 'function') std.loadScript(scriptArgs[0].split('/').slice(0, -2).concat([FILE]).join('/') || FILE);
var E = typeof require === 'function' ? require('../' + FILE) : ECOUTER, ok = 0, bad = 0;
print('checking ' + FILE);
function t(name, c, info) { if (c) ok++; else bad++; print((c ? 'PASS ' : 'FAIL ') + name + (info ? '  [' + info + ']' : '')); }
function print(s) { if (typeof console !== 'undefined') console.log(s); else std.out.puts(s + '\n'); }
t('the file loads', !!E && typeof E.say === 'function');
var codes = E.codes('Put the book back.');
t('the rules read', codes.trim() === 'pUHt DHAX bUHk bAEk .', codes);   // the full stop stays, for the tune
var pcm = E.say('Put the book back.', { turns: 2 });
t('the throat speaks', pcm.length > 8000 && pcm.length < 40000, (pcm.length / E.SR).toFixed(2) + ' s');
var peak = 0, i; for (i = 0; i < pcm.length; i++) { var a = pcm[i] < 0 ? -pcm[i] : pcm[i]; if (a > peak) peak = a; }
t('and is heard', peak > 0.5, peak.toFixed(2));
t('a wav comes out', E.wav('hello', { turns: 1 }).length > 44);
var bell = ".-] >|' ..] ! .-] >|' ..] !";
t('bell is noticed', E.notice(bell) && !E.notice('Beep! Beep!') && !E.notice(E.codes('Beep! Beep!')));
t('and read as English is', E.codes(bell) === E.codes('Beep! Beep!'), E.codes(bell));   // three orthographies, one mouth
t('a grey glyph is reported, not dropped', E.bell('..] [_]').unread.length === 1 && E.bell('..] [_]').codes.trim() === 'p');
var mixed = "say mama: {-] <|. {-] <|. ! and then \n>|' IY";
t('a chat selection, English and Bell mixed, reads in place', E.codes(mixed).indexOf('mAEmAX') > 0 && E.codes(mixed).indexOf('AEnd') > 0 && E.codes(mixed).indexOf('IYIY') > 0, E.codes(mixed));
var tt2 = E.tint(mixed, { mode: 'vivificat' });
E.LEXILLOGUE.beeps = true; var bp = E.codes('f(x) and a_b');
t('beepages, on: brackets and the underbar sound', bp.indexOf(' ( ') >= 0 && bp.indexOf(' ) ') >= 0 && bp.indexOf(' _ ') >= 0, bp);
var bf = E.frames(null, { codes: bp }), beeps = bf.filter(function (f) { return f.beep; });
t('as notes below home and back', beeps.length === 5 && beeps[0].f0 < beeps[1].f0 && beeps[2].f0 > beeps[3].f0, beeps.map(function (f) { return Math.round(f.f0); }).join(' '));
E.LEXILLOGUE.beeps = false; t('and off, they are silent as the C left them', E.codes('f(x) and a_b').indexOf('(') < 0);
t('and the lamp tints a Bell line by what it says', tt2.length === mixed.length && tt2[10].voice > 0 && tt2[mixed.length - 1].label === true && tt2[mixed.length - 1].hue === 212, tt2[mixed.length - 1].css);
var VFILE = FILE === 'ecouter.min.js' ? 'viriditas.min.js' : 'viriditas.js';
if (typeof require !== 'function') std.loadScript(scriptArgs[0].split('/').slice(0, -2).concat([VFILE]).join('/') || VFILE);
var V = typeof require === 'function' ? require('../' + VFILE) : VIRIDITAS;
t('viriditas loads without a throat', !!V && typeof V.tint === 'function' && !V.VOICEBOX);
var tt = V.tint('Right? Right!');
t('and tints', tt.length === 13 && tt[4].hue > 0 && tt[4].css.indexOf('rgb(') === 0, tt[4].css);
var to = V.tint('Right? Right!', { mode: 'omnia' });
t('asked for nothing, it tints in Omnia', tt.every(function (x, i) { return x.css === to[i].css; }));
var SFILE = FILE === 'ecouter.min.js' ? 'ecouter-speech.min.js' : 'ecouter-speech.js';
if (typeof require !== 'function') { var E0 = ECOUTER; std.loadScript(scriptArgs[0].split('/').slice(0, -2).concat([SFILE]).join('/') || SFILE); }
var S = typeof require === 'function' ? require('../' + SFILE) : ECOUTER;
t('ecouter-speech loads, with no sheets and no lamp', !!S && typeof S.say === 'function' && !S.BELL && !S.LAMP);
t('and reads as the whole library reads', S.codes('Put the book back.') === E.codes('Put the book back.'), S.codes('Put the book back.'));
var sp = S.say('Put the book back.', { turns: 2 });
t('and speaks the same length', sp.length === pcm.length, (sp.length / S.SR).toFixed(2) + ' s');
var RFILE = FILE === 'ecouter.min.js' ? 'ecouter-score.min.js' : 'ecouter-score.js';   // the score ring: a file beside the library, hung on whichever library is loaded
if (typeof require !== 'function') std.loadScript(scriptArgs[0].split('/').slice(0, -2).concat([RFILE]).join('/') || RFILE); else require('../' + RFILE)(E);   // in node it is hung on the library under test, by hand
var RL = typeof require === 'function' ? E : S, R = RL.SCORE;
t('the score ring loads beside the library', !!R && typeof R.fit === 'function' && typeof R.sing === 'function');
var sc0 = R.read(['Is', 'it', 'you'], ['', '', '?']), sc = R.sing(R.fit(R.tone(sc0, 1.03), [200, 200, 500]), 0.5), lasts = 0;
sc.frames.forEach(function (f) { lasts += f.ms; });
t('a score read, toned, fitted and sung lasts what it was fitted to', Math.abs(lasts - 900) < 1e-6 && sc0.frames !== sc.frames, lasts.toFixed(3) + ' ms');
var rp = R.say(sc, { turns: 2 });
t('and the throat sings it', rp.length > 12000 && rp.length < 20000, (rp.length / RL.SR).toFixed(2) + ' s');
t('the voices are eight, by name, and Phillippe is the stock voice', R.VOICES.names.length === 8 && R.VOICES.get('phillippe').arc === null && JSON.stringify(R.arc(sc0, 'phillippe').frames) === JSON.stringify(sc0.frames), R.VOICES.names.join(' '));
t('a score from the sounds themselves is the score read from the words', JSON.stringify(R.fromCodes(RL.codes('Is it you?')).frames) === JSON.stringify(sc0.frames), RL.codes('Is it you?'));
var la = R.as(sc0, 'lauren'), lp = R.say(la, { turns: 2 });
t('a score carried in a voice is sung, and says how fast its tape should run', la.voice.name === 'lauren' && la.voice.speed === 0.96 && la.voice.steady === 0.65 && lp.length > 8000, (lp.length / RL.SR).toFixed(2) + ' s');
var PFILE = FILE === 'ecouter.min.js' ? 'ecouter-player.min.js' : 'ecouter-player.js';   // the player ring: another file beside the library
if (typeof require !== 'function') std.loadScript(scriptArgs[0].split('/').slice(0, -2).concat([PFILE]).join('/') || PFILE); else require('../' + PFILE)(E);
var PL = RL.PLAYER;
t('the player ring loads beside the library', !!PL && typeof PL.open === 'function' && typeof PL.dub === 'function' && PL.SR === RL.SR);
var slow = PL.dub(PL.tape([lp], RL.SR), { speed: la.voice.speed }), whole = PL.dub(PL.tape([lp], RL.SR)), wd = 0, wi;
for (wi = 0; wi < lp.length - 1; wi++) wd = Math.max(wd, Math.abs(whole[wi] - lp[wi]));
t('a tape dubbed at the spoken pace is the sound that went in, and at her pace it is as much longer', whole.length === lp.length && wd < 1e-6 && slow.length === Math.round(lp.length / 0.96), (slow.length / RL.SR).toFixed(2) + ' s at 0.96');
var hd = null; try { new Function('registerProcessor', 'AudioWorkletProcessor', 'currentTime', 'sampleRate', PL.HEAD_SRC)(function (n) { hd = n; }, function () {}, 0, 48000); } catch (e) { hd = String(e); }
t('the head, written out for the audio thread, reads as a program', hd === 'ecouter-head', hd);
var silent = PL.open();
t('and where there is no sound a player is there, silent, and does not throw', silent.silent === true && silent.load(lp).play(0.96).stop() === silent);
print(ok + ' passed, ' + bad + ' failed');
if (typeof process !== 'undefined') process.exitCode = bad ? 1 : 0;
