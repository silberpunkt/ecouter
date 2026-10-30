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
print(ok + ' passed, ' + bad + ' failed');
if (typeof process !== 'undefined') process.exitCode = bad ? 1 : 0;
