# art-kit — API reference

**Version 1.1.0.** <div align="center">

Generated from the source in this repository: every name, argument and
note below is read out of the kit file, so it cannot describe a function
that is not there.

```js
<script src="art-kit.js"></script>
Art.palette(...)
// or: const Art = require('./art-kit.js')
```

## The surface (17 entries)

| Name | Arguments | What it does |
|---|---|---|
| `Art.palette` | `(input)` | — |
| `Art.canvas` | `(w, h, palette, fill)` | — |
| `Art.scale` | `(canvas, factor)` | nearest-neighbour scaling — the classic trap is smoothing it; we never do |
| `Art.toRGBA` | `(canvas)` | expand an index canvas to RGBA bytes, for a canvas/ImageData |
| `Art.history` | `(canvas, opts)` | — |
| `Art.dither` | `()` | — |
| `Art.quantize` | `(pixels, n)` | --------------------------------------------------------- quantise Median-cut to N colours, so a photo becomes pixel art. |
| `Art.spriteSheet` | `(frames)` | ------------------------------------------------------- sprite sheet Frames as one sheet + a JSON atlas, with a slice that round-trips. |
| `Art.sliceSprite` | `(sheet, frame)` | — |
| `Art.tilemap` | `(opts)` | — |
| `Art.anim` | `(frames, opts)` | — |
| `Art.rng` | `(seed)` | — |
| `Art.generate` | `(opts)` | — |
| `Art.generateSet` | `(seed, n, opts)` | — |
| `Art.isSymmetric` | `(canvas)` | "Symmetric" is a claim; this makes it a check the caller can run. |
| `Art.iso` | `()` | — |
| `Art.sketch` | `(opts)` | — |

## Notes

- Zero dependencies, one file, no build step: it works from `file://`, from a
  `<script>` tag and from Node.
- The version above is the `VERSION` file in this repository; a pinned copy is
  what an app vendors.
