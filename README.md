<div align="center">

# art-kit

**The art primitives Forge was missing.** Zero dependencies, one file, no assets.

palette · pixel canvas · draw ops · undo · dithering · median-cut · sprite sheets · isometric · sketch loop

</div>

---

## The two halves

- **STATIC pixel art** — an indexed palette, a pixel canvas that scales with **nearest-neighbour** (smoothing off by default — the classic trap), draw ops, a delta undo stack, dithering, median-cut quantisation, sprite sheets, and the isometric mapping.
- **LIVE generative visuals** — a frame loop (`Art.sketch`) you can run on its own or drive from `game-kit`'s fixed timestep, so a sketch is reproducible from a fixed step.

Both, from one kit.

## What's in it

| | |
|---|---|
| `palette` | an indexed palette from a Lospec-style list, with `swap`, `cycle` and `nearest` |
| `canvas` | an indexed pixel buffer: `set`, `line`, `rect`, `ellipse`, `fill`, `mirror` |
| `scale` | nearest-neighbour upscaling (never smooths) |
| `history` | a bounded undo/redo stack that stores **deltas, not whole frames** |
| `dither` | ordered (Bayer) and Floyd–Steinberg |
| `quantize` | median-cut to N colours, so a photo becomes pixel art |
| `spriteSheet` / `sliceSprite` | a sheet + JSON atlas, with a slicing round-trip |
| `iso` | the cartesian ↔ isometric coordinate mapping |
| `sketch` | a setup-once / draw-every-frame loop |

## Usage

```js
var Art = require("./art-kit.js");        // Node; in a browser it is window.Art

var pal = Art.palette("1a1c2c 5d275d b13e53 ef7d57");   // a Lospec-style list
var c = Art.canvas(32, 32, pal);
c.rect(4, 4, 24, 24, 2, true).ellipse(16, 16, 10, 10, 3, true);

var big = Art.scale(c, 8);                 // nearest-neighbour, crisp
var hist = Art.history(c, { limit: 100 }); // undo/redo over deltas
hist.begin(); c.set(0, 0, 1); hist.commit();
hist.undo();

var pal2 = Art.palette(Art.quantize(pixels, 16));       // median-cut a photo
var sheet = Art.spriteSheet([frame0, frame1]);          // sheet + atlas
```

## Licence position (read this)

Everything here is **reimplemented from published technique**; permissive reference projects are named only in comments, and **no code is copied**. In the survey behind this kit: Aseprite is not open source (learn, never copy); Data-Pixels and pixel8 carry **no licence**; six tools are copyleft — none of their code is used. The permissive references (piskel, Pixelorama, PixelCraft, poxi, and the isometric mapping from isometric-contributions) are cited as ideas.

## Tests

```
node test-node.js
31 passed, 0 failed
```

Covers the spec's required cases — a **nearest-neighbour scaling** case, a **dithering pattern** case, a **median-cut** case with a known input, and a **sprite-sheet export round-trip** — plus the palette, every draw op, the bounded delta undo stack, the isometric mapping and the sketch loop. All headless.

## License

MIT — see [LICENSE](LICENSE). © 2026 Dr Sohil Momin.
