/* art-kit — the art primitives Forge was missing. Zero dependencies.
 *
 * Indexed palettes, a pixel canvas with nearest-neighbour scaling, draw ops, a
 * delta undo stack, dithering, median-cut quantisation, sprite-sheet export, an
 * isometric mapping and a minimal sketch loop. No image assets, no framework.
 *
 * Two halves: STATIC pixel art (palette, canvas, dither, sprites, isometric) and
 * LIVE generative visuals (the sketch loop). Everything here is reimplemented from
 * published technique; permissive reference projects are named in comments only.
 *
 * PolyForm Noncommercial 1.0.0. (c) 2026 Dr Sohil Momin.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Art = factory();
}(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var Art = { version: "1.1.0" };

  function parseHex(s) {
    s = String(s).trim().replace(/^#/, "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    if (isNaN(n) || s.length !== 6) return { r: 0, g: 0, b: 0 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function toHex(c) {
    function h(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }
    return h(c.r) + h(c.g) + h(c.b);
  }

  /* ------------------------------------------------------------ palette */
  /* An indexed palette. Accepts a Lospec-style list ("1a1c2c 5d275d ...") or an
     array of hex strings. Indexed colour is what makes swap/cycling cheap. */
  Art.palette = function (input) {
    var colors = [];
    if (typeof input === "string") colors = input.split(/[\s,]+/).filter(Boolean).map(parseHex);
    else colors = (input || []).map(function (c) { return typeof c === "string" ? parseHex(c) : { r: c.r, g: c.g, b: c.b }; });
    if (!colors.length) colors = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];
    var api = {
      colors: colors,
      size: colors.length,
      hex: function (i) { return toHex(colors[i] || { r: 0, g: 0, b: 0 }); },
      swap: function (a, b) { var t = colors[a]; colors[a] = colors[b]; colors[b] = t; return api; },
      cycle: function (n) {
        n = ((n || 1) % colors.length + colors.length) % colors.length;
        if (n) api.colors = colors = colors.slice(n).concat(colors.slice(0, n));
        return api;
      },
      nearest: function (r, g, b) {
        var best = 0, bd = Infinity;
        for (var i = 0; i < colors.length; i++) {
          var c = colors[i], dr = c.r - r, dg = c.g - g, db = c.b - b, d = dr * dr + dg * dg + db * db;
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      }
    };
    return api;
  };

  /* ------------------------------------------------------------- canvas */
  /* An indexed pixel canvas: data is one palette index per pixel. Draw ops go
     through paint(), which fires canvas.onPaint first, so an undo stack can see
     every change without the ops knowing about it. */
  Art.canvas = function (w, h, palette, fill) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    palette = palette || Art.palette(["000000", "ffffff"]);
    var data = new Uint8Array(w * h);
    if (fill) data.fill(fill);
    var api = { w: w, h: h, palette: palette, data: data, onPaint: null };

    function paint(x, y, i) {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      if (api.onPaint) api.onPaint(x, y);
      data[y * w + x] = i;
    }
    api.set = paint;
    api.get = function (x, y) { return (x >= 0 && y >= 0 && x < w && y < h) ? data[y * w + x] : -1; };
    api.clear = function (i) { if (api.onPaint) for (var k = 0; k < data.length; k++) api.onPaint(k % w, Math.floor(k / w)); data.fill(i || 0); return api; };

    api.line = function (x0, y0, x1, y1, i) {
      x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
      var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
      for (;;) {
        paint(x0, y0, i);
        if (x0 === x1 && y0 === y1) break;
        var e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return api;
    };
    api.rect = function (x, y, rw, rh, i, filled) {
      if (filled) { for (var yy = 0; yy < rh; yy++) for (var xx = 0; xx < rw; xx++) paint(x + xx, y + yy, i); }
      else {
        api.line(x, y, x + rw - 1, y, i);
        api.line(x, y + rh - 1, x + rw - 1, y + rh - 1, i);
        api.line(x, y, x, y + rh - 1, i);
        api.line(x + rw - 1, y, x + rw - 1, y + rh - 1, i);
      }
      return api;
    };
    api.ellipse = function (cx, cy, rx, ry, i, filled) {
      for (var y = -ry; y <= ry; y++) {
        var dx = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
        if (filled) { for (var x = -dx; x <= dx; x++) paint(cx + x, cy + y, i); }
        else { paint(cx - dx, cy + y, i); paint(cx + dx, cy + y, i); }
      }
      if (!filled) for (var xx = -rx; xx <= rx; xx++) {
        var dy = Math.round(ry * Math.sqrt(Math.max(0, 1 - (xx * xx) / (rx * rx))));
        paint(cx + xx, cy - dy, i); paint(cx + xx, cy + dy, i);
      }
      return api;
    };
    api.fill = function (x, y, i) {
      var target = api.get(x, y);
      if (target < 0 || target === i) return api;
      var stack = [[x, y]];
      while (stack.length) {
        var p = stack.pop(), px = p[0], py = p[1];
        if (px < 0 || py < 0 || px >= w || py >= h || data[py * w + px] !== target) continue;
        paint(px, py, i);
        stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
      }
      return api;
    };
    /* mirror the first half onto the second, for symmetry drawing */
    api.mirror = function (axis) {
      if (axis === "y") { for (var y = 0; y < Math.ceil(h / 2); y++) for (var x = 0; x < w; x++) paint(x, h - 1 - y, data[y * w + x]); }
      else { for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < Math.ceil(w / 2); xx++) paint(w - 1 - xx, yy, data[yy * w + xx]); }
      return api;
    };
    return api;
  };

  /* nearest-neighbour scaling — the classic trap is smoothing it; we never do */
  Art.scale = function (canvas, factor) {
    factor = Math.max(1, factor | 0);
    var nw = canvas.w * factor, nh = canvas.h * factor;
    var out = Art.canvas(nw, nh, canvas.palette);
    for (var y = 0; y < nh; y++) {
      var sy = Math.floor(y / factor);
      for (var x = 0; x < nw; x++) out.data[y * nw + x] = canvas.data[sy * canvas.w + Math.floor(x / factor)];
    }
    return out;
  };

  /* expand an index canvas to RGBA bytes, for a canvas/ImageData */
  Art.toRGBA = function (canvas) {
    var out = new Uint8ClampedArray(canvas.w * canvas.h * 4), cols = canvas.palette.colors;
    for (var i = 0; i < canvas.data.length; i++) {
      var c = cols[canvas.data[i]] || { r: 0, g: 0, b: 0 };
      out[i * 4] = c.r; out[i * 4 + 1] = c.g; out[i * 4 + 2] = c.b; out[i * 4 + 3] = 255;
    }
    return out;
  };

  /* ---------------------------------------------------------- undo stack */
  /* Deltas, not whole frames: each commit stores only the pixels that changed,
     with their prior value. A bounded stack keeps memory flat. */
  Art.history = function (canvas, opts) {
    var limit = (opts && opts.limit) || 100;
    var undoStack = [], redoStack = [], pending = null;
    function touch(x, y) {
      if (!pending) return;
      var k = y * canvas.w + x;
      if (!(k in pending)) pending[k] = canvas.data[k];
    }
    canvas.onPaint = touch;
    return {
      begin: function () { pending = {}; return this; },
      commit: function () {
        if (!pending) return false;
        var changed = false;
        for (var k in pending) { if (canvas.data[k] !== pending[k]) { changed = true; break; } }
        if (!changed) { pending = null; return false; }
        undoStack.push(pending);
        if (undoStack.length > limit) undoStack.shift();
        redoStack.length = 0; pending = null;
        return true;
      },
      undo: function () {
        var d = undoStack.pop();
        if (!d) return false;
        var redo = {};
        for (var k in d) { redo[k] = canvas.data[k]; canvas.data[k] = d[k]; }
        redoStack.push(redo);
        return true;
      },
      redo: function () {
        var d = redoStack.pop();
        if (!d) return false;
        var undo = {};
        for (var k in d) { undo[k] = canvas.data[k]; canvas.data[k] = d[k]; }
        undoStack.push(undo);
        return true;
      },
      depth: function () { return undoStack.length; },
      dispose: function () { canvas.onPaint = null; }
    };
  };

  /* ------------------------------------------------------------ dither */
  var BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  Art.dither = {
    bayer: BAYER4,
    /* ordered (Bayer) dither of a luminance field to a two-tone palette
       (index 0 dark, index size-1 light) */
    ordered: function (gray, w, h, palette, opts) {
      var m = (opts && opts.matrix) || BAYER4, n = m.length, size = n * n;
      var out = Art.canvas(w, h, palette), dark = 0, light = palette.size - 1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var thr = (m[y % n][x % n] + 0.5) / size * 255;
        out.data[y * w + x] = gray[y * w + x] > thr ? light : dark;
      }
      return out;
    },
    /* Floyd-Steinberg error diffusion — preserves the average tone */
    floyd: function (gray, w, h, palette) {
      var buf = Float32Array.from(gray);
      var out = Art.canvas(w, h, palette), dark = 0, light = palette.size - 1;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var old = buf[y * w + x];
        var nv = old < 128 ? 0 : 255;
        out.data[y * w + x] = old < 128 ? dark : light;
        var err = old - nv;
        if (x + 1 < w) buf[y * w + x + 1] += err * 7 / 16;
        if (y + 1 < h) {
          if (x > 0) buf[(y + 1) * w + x - 1] += err * 3 / 16;
          buf[(y + 1) * w + x] += err * 5 / 16;
          if (x + 1 < w) buf[(y + 1) * w + x + 1] += err * 1 / 16;
        }
      }
      return out;
    }
  };

  /* --------------------------------------------------------- quantise */
  /* Median-cut to N colours, so a photo becomes pixel art. */
  Art.quantize = function (pixels, n) {
    n = Math.max(1, n | 0);
    function range(box) {
      var lo = [255, 255, 255], hi = [0, 0, 0], ch = 0, max = -1;
      box.forEach(function (p) {
        var v = [p.r, p.g, p.b];
        for (var c = 0; c < 3; c++) { if (v[c] < lo[c]) lo[c] = v[c]; if (v[c] > hi[c]) hi[c] = v[c]; }
      });
      for (var c = 0; c < 3; c++) { var d = hi[c] - lo[c]; if (d > max) { max = d; ch = c; } }
      return { channel: ["r", "g", "b"][ch], max: max };
    }
    function average(box) {
      var s = { r: 0, g: 0, b: 0 };
      box.forEach(function (p) { s.r += p.r; s.g += p.g; s.b += p.b; });
      return { r: Math.round(s.r / box.length), g: Math.round(s.g / box.length), b: Math.round(s.b / box.length) };
    }
    var boxes = [pixels.slice()];
    while (boxes.length < n) {
      var bi = -1, br = 0;
      boxes.forEach(function (b, i) {
        if (b.length < 2) return;
        var r = range(b);
        if (r.max > br) { br = r.max; bi = i; }
      });
      if (bi < 0 || br <= 0) break;
      var box = boxes[bi], r = range(box), ch = r.channel;
      box.sort(function (a, b) { return a[ch] - b[ch]; });
      var mid = box.length >> 1;
      boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
    }
    return boxes.filter(function (b) { return b.length; }).map(average);
  };

  /* ------------------------------------------------------- sprite sheet */
  /* Frames as one sheet + a JSON atlas, with a slice that round-trips. */
  Art.spriteSheet = function (frames) {
    var w = frames[0].w, h = frames[0].h, n = frames.length;
    var cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
    var sheet = Art.canvas(cols * w, rows * h, frames[0].palette);
    var atlas = { width: cols * w, height: rows * h, frames: [] };
    frames.forEach(function (f, i) {
      var cx = (i % cols) * w, cy = Math.floor(i / cols) * h;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) sheet.data[(cy + y) * sheet.w + (cx + x)] = f.data[y * w + x];
      atlas.frames.push({ x: cx, y: cy, w: w, h: h });
    });
    return { sheet: sheet, atlas: atlas };
  };
  Art.sliceSprite = function (sheet, frame) {
    var out = Art.canvas(frame.w, frame.h, sheet.palette);
    for (var y = 0; y < frame.h; y++) for (var x = 0; x < frame.w; x++) out.data[y * frame.w + x] = sheet.data[(frame.y + y) * sheet.w + (frame.x + x)];
    return out;
  };

  /* ------------------------------------------------------------ tilemap */
  /* A grid of tile ids. Int16Array, not Uint8Array: -1 is "no tile" and tile 0
     has to stay a legal tile, or every map's first tile is invisible.
     `toCanvas(tiles)` composes the grid out of tile canvases; an empty tile
     leaves the destination alone so a background layer shows through. */
  Art.tilemap = function (opts) {
    opts = opts || {};
    var w = Math.max(0, opts.w | 0), h = Math.max(0, opts.h | 0);
    var data = new Int16Array(w * h);
    data.fill(-1);
    if (opts.data && opts.data.length === data.length) data.set(opts.data);
    var api = {
      w: w, h: h,
      tileW: Math.max(1, opts.tileW | 0 || 16),
      tileH: Math.max(1, opts.tileH | 0 || 16),
      data: data,
      get: function (tx, ty) {
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) return -1;
        return data[(ty | 0) * w + (tx | 0)];
      },
      /* false off the map: a brush at the edge stops at the edge, it does not
         resize the map under the artist */
      set: function (tx, ty, v) {
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
        data[(ty | 0) * w + (tx | 0)] = v | 0;
        return true;
      },
      /* pixel -> tile by FLOOR. Truncation puts a click at x = -1 into column 0,
         which is the bug that makes a cursor paint the wrong cell at the edge. */
      at: function (px, py) { return { tx: Math.floor(px / api.tileW), ty: Math.floor(py / api.tileH) }; },
      fillRect: function (tx, ty, tw, th, v) {
        var n = 0;
        for (var y = ty; y < ty + th; y++) for (var x = tx; x < tx + tw; x++) if (api.set(x, y, v)) n++;
        return n;
      },
      /* Iterative, and capped. A recursive fill on an empty 512x512 map is a
         stack overflow in the tab; the cap returns a partial fill and a count
         instead of a dead page. Empty space (-1) IS fillable — laying a floor
         on an empty map is the first thing anyone does. */
      floodFill: function (tx, ty, v, o) {
        var cap = (o && o.max) || 1e6;
        if (tx < 0 || ty < 0 || tx >= w || ty >= h) return 0;
        var from = api.get(tx, ty);
        if (from === v) return 0;
        var stack = [[tx, ty]], n = 0;
        while (stack.length && n < cap) {
          var p = stack.pop(), x = p[0], y = p[1];
          /* bounds first: off the map answers -1, which IS the empty tile, so a
             fill without this walks outside the map forever */
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          if (api.get(x, y) !== from) continue;
          if (!api.set(x, y, v)) continue;
          n++;
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        return n;
      },
      /* 4-bit neighbour mask per tile: N=1, E=2, S=4, W=8, so a tile id can be
         chosen from the mask. An empty tile reports -1. */
      autotile: function (o) {
        var match = (o && o.match) || function (a, b) { return a === b && a >= 0; };
        var out = new Array(w * h);
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            var v = api.get(x, y);
            if (v < 0) { out[y * w + x] = -1; continue; }
            var mask = 0;
            if (match(v, api.get(x, y - 1))) mask |= 1;
            if (match(v, api.get(x + 1, y))) mask |= 2;
            if (match(v, api.get(x, y + 1))) mask |= 4;
            if (match(v, api.get(x - 1, y))) mask |= 8;
            out[y * w + x] = mask;
          }
        }
        return out;
      },
      toCanvas: function (tiles, target) {
        var out = target || Art.canvas(w * api.tileW, h * api.tileH,
          (tiles[0] && tiles[0].palette) || Art.palette(["000000"]));
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            var id = api.get(x, y), t = id >= 0 ? tiles[id] : null;
            if (!t) continue;
            for (var ty = 0; ty < api.tileH; ty++) {
              for (var tx = 0; tx < api.tileW; tx++) {
                var v = t.data[ty * t.w + tx];
                out.data[(y * api.tileH + ty) * out.w + (x * api.tileW + tx)] = v;
              }
            }
          }
        }
        return out;
      }
    };
    return api;
  };

  /* ------------------------------------------------------------ animation */
  /* A timeline over frames. at(t) is a PURE function of time, so an animation
     never depends on how many times it was drawn — the bug that makes a
     background tab come back mid-swing.
     pingpong does not repeat the endpoints (0,1,2,1,0,…): repeating them makes
     the pause at each end twice as long as every frame in the middle. */
  Art.anim = function (frames, opts) {
    opts = opts || {};
    var count = typeof frames === "number" ? frames : (frames || []).length;
    var fps = opts.fps == null ? 8 : opts.fps;
    var loop = opts.loop !== false, ping = !!opts.pingpong;
    var period = ping ? Math.max(1, count * 2 - 2) : count;
    var api = {
      count: count, fps: fps, loop: loop, pingpong: ping,
      duration: function () { return fps > 0 ? period / fps : Infinity; },
      at: function (t) {
        if (!count) return -1;
        if (!(fps > 0)) return 0;                 /* a frozen timeline, not NaN */
        if (!(t > 0)) return 0;                   /* negative time is frame 0 */
        var step = Math.floor(t * fps);
        if (!loop) return step >= count ? count - 1 : step;
        var i = step % period;
        return ping && i >= count ? period - i : i;
      },
      frame: function (t) { return typeof frames === "number" ? api.at(t) : frames[api.at(t)]; },
      /* the first n frame indexes, which is what a test or a GIF export wants */
      sequence: function (n) {
        var out = [];
        for (var k = 0; k < (n == null ? period : n); k++) out.push(api.at(k / (fps || 1)));
        return out;
      }
    };
    return api;
  };

  /* ------------------------------------------------------------ generate */
  /* mulberry32: 32 bits of state, the same sequence everywhere. A sprite that
     changes on every reload is not a seed. */
  Art.rng = function (seed) {
    var s = (seed | 0) || 1;
    var api = {
      next: function () {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        var t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      int: function (n) { return Math.floor(api.next() * n); },
      pick: function (arr) { return arr[api.int(arr.length)]; },
      chance: function (p) { return api.next() < p; }
    };
    return api;
  };

  /* A seeded, mirrored sprite on an indexed canvas. Only the left half is
     generated and then copied, so symmetry is a property of the construction
     and not a post-pass that drifts by a column on an odd width.
     Index 0 is EMPTY by convention (the canvas has no alpha); painted pixels
     come from 1..size-1 unless opts.lo/opts.hi say otherwise. */
  Art.generate = function (opts) {
    opts = opts || {};
    var w = Math.max(2, opts.w | 0 || 16), h = Math.max(1, opts.h | 0 || 16);
    var pal = opts.palette || Art.palette("1a1c2c 5d275d b13e53 ef7d57 ffd166");
    var r = Art.rng(opts.seed == null ? 1 : opts.seed);
    var density = opts.density == null ? 0.45 : opts.density;
    var empty = opts.empty == null ? 0 : opts.empty | 0;
    var lo = Math.max(0, opts.lo == null ? 0 : opts.lo | 0);
    var hi = opts.hi == null ? pal.size - 1 : opts.hi | 0;
    if (hi <= lo) hi = Math.min(pal.size - 1, lo + 1);
    var body = opts.shape !== "fill";
    var cx0 = (w - 1) / 2, cy0 = (h - 1) / 2, rx = Math.max(0.5, w / 2), ry = Math.max(0.5, h / 2);
    var img = Art.canvas(w, h, pal, empty);
    var half = Math.ceil(w / 2), painted = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < half; x++) {
        var p = density;
        if (body) {
          /* fade the chance out towards the ellipse: a sprite that reads as a
             creature rather than as static inside a square */
          var dx = (x - cx0) / rx, dy = (y - cy0) / ry, rad = Math.sqrt(dx * dx + dy * dy);
          if (rad > 1) continue;
          p = density * (1.25 - 0.75 * rad);
        }
        if (!r.chance(p)) continue;
        var v = lo + r.int(hi - lo + 1);
        img.data[y * w + x] = v; painted++;
        var mx = w - 1 - x;
        if (mx !== x) img.data[y * w + mx] = v;
      }
    }
    /* A generator that can return an empty sprite makes every caller handle
       "nothing was drawn"; one guaranteed pixel is cheaper than that branch. */
    if (!painted) {
      var cx = (w / 2) | 0, cyy = (h / 2) | 0;
      img.data[cyy * w + cx] = hi;
      if (w - 1 - cx !== cx) img.data[cyy * w + (w - 1 - cx)] = hi;
    }
    return img;
  };

  /* The nth sprite of a seed is the same nth sprite always, so an app can
     rebuild its whole asset folder from one number. */
  Art.generateSet = function (seed, n, opts) {
    var out = [], o = {}, k;
    for (k in (opts || {})) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    for (var i = 0; i < (n | 0); i++) {
      o.seed = ((seed | 0) * 2654435761 + i * 40503) | 0;
      out.push(Art.generate(o));
    }
    return out;
  };

  /* "Symmetric" is a claim; this makes it a check the caller can run. */
  Art.isSymmetric = function (canvas) {
    for (var y = 0; y < canvas.h; y++) {
      for (var x = 0; x < canvas.w; x++) {
        if (canvas.data[y * canvas.w + x] !== canvas.data[y * canvas.w + (canvas.w - 1 - x)]) return false;
      }
    }
    return true;
  };

  /* ---------------------------------------------------------- isometric */
  /* The cartesian <-> isometric mapping, so a grid can be drawn isometric and an
     isometric game laid out. (Reference: jasonlong/isometric-contributions, MIT.) */
  Art.iso = {
    to: function (x, y, tw, th) { tw = tw || 2; th = th || 1; return { x: (x - y) * tw, y: (x + y) * th }; },
    from: function (sx, sy, tw, th) { tw = tw || 2; th = th || 1; return { x: (sx / tw + sy / th) / 2, y: (sy / th - sx / tw) / 2 }; }
  };

  /* --------------------------------------------------------- sketch loop */
  /* The live half's frame loop: setup once, draw every frame, and tick(dt) so it
     can be driven headlessly or by game-kit's fixed-timestep loop. */
  Art.sketch = function (opts) {
    opts = opts || {};
    var t = 0, frames = 0, raf = null, running = false;
    function tick(dt) {
      dt = dt || 1 / 60; t += dt; frames++;
      if (opts.update) opts.update(dt, t);
      if (opts.draw) opts.draw(t, frames);
      return t;
    }
    function frame(ts) {
      if (!running) return;
      tick();
      raf = root.requestAnimationFrame ? root.requestAnimationFrame(frame) : null;
    }
    var api = {
      tick: tick,
      time: function () { return t; },
      frames: function () { return frames; },
      start: function () { running = true; if (opts.setup) opts.setup(); if (root.requestAnimationFrame) raf = root.requestAnimationFrame(frame); return api; },
      stop: function () { running = false; if (raf && root.cancelAnimationFrame) root.cancelAnimationFrame(raf); raf = null; return api; }
    };
    return api;
  };

  return Art;
}));
