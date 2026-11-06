## [1.1.0]

The three capabilities the kit's spec named and 1.0.0 did not have: **tilemaps**, a
**timeline**, and a **seeded procedural sprite generator**. Everything else is
unchanged, and the 31 assertions that were already here still pass.

### Added
- **`Art.tilemap({w, h, tileW, tileH})`** — a grid of tile ids in an `Int16Array`,
  because `-1` is "no tile" and tile `0` has to stay a legal tile or the first tile of
  every map is invisible. `get`/`set` (`-1` / `false` off the map), `at(px, py)` by
  **floor**, `fillRect`, `floodFill` (iterative, capped, and it *will* fill empty
  space — laying a floor on an empty map is the first thing anyone does), `autotile`
  4-bit neighbour masks (N=1, E=2, S=4, W=8), and `toCanvas(tiles)` to compose the
  grid out of tile canvases, leaving empty cells alone so a background shows through.
- **`Art.anim(frames, {fps, loop, pingpong})`** — a timeline. `at(t)` is a pure
  function of time, so an animation never depends on how many times it was drawn;
  `pingpong` does **not** repeat the endpoints (`0,1,2,1,0,…`), because repeating them
  makes the pause at each end twice as long as every frame in the middle; `fps 0`
  freezes at frame 0 instead of returning `NaN`; an empty timeline answers `-1`.
- **`Art.generate({seed, w, h, density, palette, shape})`**, `Art.generateSet(seed, n)`,
  `Art.rng(seed)` (mulberry32), `Art.isSymmetric(canvas)` — a sprite generator that is
  deterministic, **mirror-symmetric by construction** (only the left half is drawn and
  copied, so an odd width cannot drift by a column), never empty, and shaped like a
  body (probability fading out towards the ellipse) rather than like static in a
  square. `shape: "fill"` is the flat per-pixel chance, for tiles and textures.

### Fixed
- **`VERSION` said `1.0.0` while `Art.version` said `0.1.0`** — two answers to one
  question. Both are `1.1.0` now, and a test reads the `VERSION` file and fails when
  the two disagree, so the drift cannot come back quietly.

### Tests
31 → **86 assertions**, 0 failing. The new code was mutation-tested ten ways and all
ten mutations are caught: `at` truncating instead of flooring, a flood fill that
re-fills a region it already owns, swapped east/west autotile bits, `toCanvas`
painting every cell with tile 0, pingpong repeating its endpoints, rounded instead of
floored time, mirroring only on even widths, dropping the non-empty guarantee,
ignoring the body shape, and `Art.version` drifting from `VERSION`.
