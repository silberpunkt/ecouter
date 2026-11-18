# How it works

```
text ─▶ rules ─▶ phoneme codes ─▶ tune ─▶ frames ─┬─▶ throat ─▶ gust ─▶ sound      (Ecouter)
                                                  └─▶ lamp ─────────────▶ colour     (Viriditas)
```

Both libraries share everything up to the frames. Ecouter sings the frames, and Viriditas reads the colours straight off them. That's why the colour is the pitch of the sound: they come from the same score.

## 1. Rules

English spelling goes to sound by the 355 rules of NRL Report 7948. Each rule says: *this run of letters, between these neighbours, makes these sounds*. The matcher walks the word from left to right and takes the first rule that fits.

```js
ECOUTER.codes("Put the book back.")   // "pUHt DHAX bUHk bAEk . "
ECOUTER.trace("book")                 // which rule read which letters
```

Every rule remembers the letters it read. Keep that in mind; it's the trick in step 5.

## 2. Phonemes

The Report's 41 codes (`IY`, `AE`, `DH`, `p`, …) each have a place in the mouth (three formant frequencies), a length, and a manner: voiced, breathy, hissed, stopped or nasal.

## 3. Tune

The codes are grouped into phrases and sentences, and given a pitch contour. The voice rests at 118 Hz. Stressed syllables rise a little, a question lifts at its end, and an exclamation falls.

## 4. Frames

The result is a list of frames, each a few milliseconds long: `{ ms, f0, f: [F1, F2, F3], voice, breath, hiss }`. Each frame also remembers which code made it.

```js
ECOUTER.frames("Is it you?")
```

## 5. The lamp (Viriditas)

The rules know which letters made which codes, and the frames know which code made them. So each letter owns some milliseconds of the score, and with them a pitch. There's no listening and no alignment: the pitch is the score's own, the same pitch the throat will sing.

For each letter:

```
octaves = log2(f0 / 118)
hue     = 120° + 360° × octaves          one turn of the wheel per octave; 118 Hz is green
sat     = min(1, |octaves| / 0.125)      an eighth of an octave up or down is full colour
colour  = hue mixed into medium-white by up to ¾ × sat
```

A letter's pitch is the voiced milliseconds of its own sound, with a short tail of what came before (40 ms) and a shorter lead-in of what comes next (15 ms). Without that, short sounds would flicker. Spaces and silent letters take their neighbour's.

That's Viriditas, the quiet reading mode. **Omnia**, the default, spreads the voice's own range over the whole wheel:

```
hue     = 120° + 180° × clamp(octaves / 0.125, −1, 1)      half a turn each way; up and down meet in magenta
colour  = hue mixed into medium-white by up to all of sat
```

**Vivificat** goes 62% of the way from Viriditas to Omnia, in hue and in mix. A *room* can tint the background by the slower tone of the last 150, 400 or 1200 ms.

## 6. Throat (Ecouter)

A cascade of five formant resonators after Klatt (1980), driven by a glottal pulse with small, living irregularities. A second source makes hisses and bursts, and a nasal branch adds its zero. A governor keeps anything above 5.5 kHz in check.

## 7. Gust (Ecouter)

The sung sound is turned into a spectrogram, blurred a little in time and frequency, and turned back into sound with Griffin-Lim. That softens the buzz into the house voice. It's the only slow step, so `{ turns: 8 }` gives a quick draft. Under Node the results are kept in `temp-cache/` (see the README).

## 8. Playing what Ecouter makes

Ecouter plays nothing. It hands you samples (`Float32Array`, 16 kHz, `ECOUTER.SR`) and the playing is yours. The three example pages play them the simplest way. Here is what we have learned about doing it well, most of it the hard way, in Obelus and Homburg.

**Make one audio context, on a click, and guard it.** A browser will not start sound until the person has pressed something, so make the `AudioContext` inside the click and keep it for the life of the page. Two things can go wrong, and each wants a catch. A box with no sound device may refuse to make a context at all (Servo does). One that makes it may refuse to wake it, with a rejected promise (WebKit says so aloud). Draw your pictures and write your files anyway; only the hearing is lost.

```js
if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
if (ctx.state === "suspended" && ctx.resume) ctx.resume().catch(function () {});
```

**A whole sound never pops.** Put the samples in a buffer, give the buffer to a source, start it. The browser plays it on its own audio thread and nothing your page does can make it stutter.

```js
var b = ctx.createBuffer(1, pcm.length, ECOUTER.SR); b.getChannelData(0).set(pcm);
var s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start();
```

**Several at once is no trouble.** Each sound is its own source, all into the one context, and the browser mixes them. A voice over a tone over a click needs no second context and no threads of yours. To stop one, stop its source.

**Make the sound somewhere else.** The slow part is making, not playing. `examples/say.html` makes each sentence in a worker, so the page stays alive and the first sentence is heard while the second is still being sung.

**A sound you can drag must be fed from the audio thread.** If the voice has to follow a hand, forward or back, at any speed, a whole buffer will not do: something must be asked for the next few milliseconds, again and again. Ask it on the audio thread, with an `AudioWorklet`. The older `ScriptProcessor` is answered on the thread that paints the page, and a frame that runs long is heard as a pop. Obelus measured it, one evening, on four engines:

| Engine | Head on the painting thread | Head on the audio thread |
|---|---|---|
| Chromium (Edge, Brave), by ear | static pops, four to six a second | plays cleanly |
| Chromium, headless, counted over 16 s | 130 clicks, the largest a jump of 1.22 of full scale | 0 clicks, largest jump 0.07 |
| Gecko (LibreWolf), by ear | no pops: it waits for a late answer | no pops |
| Servo 0.8.0 | the only head it has | it has no AudioWorklet |

So keep the old head as a fallback for an engine with no worklet, and use the new one wherever there is one.

**Or let the player ring do it.** `ecouter-player.js` is that head, ready made, with its fallback and its guards: a file beside the library that hangs itself on as `ECOUTER.PLAYER`. The sound is a tape, measured in seconds at the pace it was spoken; the head reads it at a place and a pace. `examples/tape.html` is the whole of it in one page.

```js
var p = ECOUTER.PLAYER.open();        // on a click
p.load(pcm).play(0.83);               // p.stop(), p.seek(seconds), p.play(-1)
p.drag(seconds); p.drop();            // a hand has the tape
```

Three things about that head are worth knowing, whoever writes it. It **never jumps in loudness**: starting, stopping and being lifted to another place are each a ramp of four thousandths of a second, so there is no click even in the middle of a wave. It is **told, not asked**: the page sends it words (play, stop, seek, follow) and it carries on by itself between them, so a page that is busy, or hidden, does not stop the voice. And when it **follows a hand** it runs at the pace the hand was moving and is only nudged toward the hand's place, by three in the hundred, because a pace that is corrected sharply is heard as a wobble in the pitch.

**Never cancel a curve that is running.** If you steer pitch or loudness with `setValueCurveAtTime` and then need to change your mind, do not cancel it. Browsers disagree about what that means, and one has no way to cancel and hold at all; in Homburg that left a sound playing after Stop. Make a new source with its new curves, fade the old one out with a gain of its own, and let it go. Put one plain gain before the loudspeaker, with no curve on it, and let Stop be that gain coming down.

**A room belongs after the head.** Ecouter's own `mellow` lays a little room into the sound, which is right for a sound played whole. A sound that is dragged or run backward drags whatever is on it, and a room played backward is heard as one. So for a voice that is scrubbed, put the room after the head, as filters in the page: it is then the air about the machine, and stays still. The player ring's Resound is such a room: a peak of 3 dB at 170 Hz, a shelf of 2 dB down above 4.2 kHz, and a scattered return that begins 12 ms after the voice, is gone in a quarter of a second, and lies 11.8 dB under it.

**Leave the room its room.** What Ecouter makes stands at nine tenths of full scale. A lift and a return added after it raise the peak: measured over four voices, by as much as a third, which at full volume is clipped at the loudspeaker. The player opens at a volume of 0.8 for that reason, and the peak then stood at 0.96.

**What was tried, 18 November 2026.** The three example pages, each opened and pressed:

| Engine | What happened |
|---|---|
| Chromium 152, headless, the sound tapped where it leaves | all three speak; no gaps in the sound; no errors |
| Chromium 152, made to refuse a context | all three carry on without error; `say.html` says that nothing can be heard |
| Firefox 159 and WebKit 27.2, headless, with no sound device | all three open and answer the press without error; the context stays suspended, so nothing is heard |

Not tried that day: Servo, and any of them by a person's ear.

`examples/tape.html`, the same day:

| Engine | What happened |
|---|---|
| Chromium 152, headless, the sound tapped where it leaves | played whole at 0.83; dragged forward, held still, dragged backward; the pace swept through nought to backward; turned back at the end of the tape at twice the pace. No gaps and no clicks: the largest step between two samples was 0.06 of full scale, and 0.12 at twice the pace. Peak 0.96. Silence after Stop |
| Chromium 152, the head kept on the painting thread | speaks, with no gaps, in a page this light |
| Chromium 152, made to refuse a context | carries on without error, draws the tape, and says that nothing can be heard |
| Firefox 159 and WebKit 27.2, headless, with no sound device | the page opens and answers the press and the drag without error; the head loads on the audio thread; the context stays suspended, so nothing is heard. Run off line in each engine's own worklet, the head speaks forward and backward and falls silent at the end of the tape |

Not tried: Servo, and any of them by a person's ear.

## Where the source lives

The files here are written by a build script from a workshop of separate modules, with about two hundred checks: `voicebox`, `gust`, `chain`, `phones`, `rules`, `lexillogue`, `bell`, `lamp`. Each module is a section of `ecouter.js`, marked `// ======== name.js ========`, so you can read them in order.
