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

  var Art = { version: "0.1.0" };

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
