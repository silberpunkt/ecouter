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

## Where the source lives

The files here are written by a build script from a workshop of separate modules, with about two hundred checks: `voicebox`, `gust`, `chain`, `phones`, `rules`, `lexillogue`, `bell`, `lamp`. Each module is a section of `ecouter.js`, marked `// ======== name.js ========`, so you can read them in order.
