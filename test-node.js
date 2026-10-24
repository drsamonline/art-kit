/* Tests for art-kit. Run: node test-node.js */
"use strict";
var Art = require("./art-kit.js");
var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log("PASS  " + name); } else { fail++; console.log("FAIL  " + name); } }

/* ---- palette ---- */
var pal = Art.palette("000000 ffffff ff0000");
ok("palette: parses a Lospec-style list", pal.size === 3 && pal.hex(0) === "000000" && pal.hex(2) === "ff0000");
ok("palette: parses 3-digit hex", Art.palette(["#fff"]).hex(0) === "ffffff");
ok("palette: nearest finds the closest colour", pal.nearest(250, 10, 10) === 2);
pal.swap(0, 1);
ok("palette: swap exchanges two colours", pal.hex(0) === "ffffff");
pal.cycle(1);
ok("palette: cycle rotates the list", pal.hex(0) === "000000" && pal.hex(2) === "ffffff");

/* ---- canvas + draw ops ---- */
var bw = Art.palette("000000 ffffff");
var c = Art.canvas(8, 8, bw);
c.set(1, 1, 1);
ok("canvas: set + get", c.get(1, 1) === 1 && c.get(0, 0) === 0);
c.line(0, 0, 3, 3, 1);
ok("canvas: line draws a diagonal", c.get(0, 0) === 1 && c.get(3, 3) === 1 && c.get(2, 2) === 1);
var c2 = Art.canvas(8, 8, bw);
c2.rect(1, 1, 3, 3, 1, true);
ok("canvas: filled rect", c2.get(1, 1) === 1 && c2.get(3, 3) === 1 && c2.get(0, 0) === 0);
var c3 = Art.canvas(8, 8, bw);
c3.rect(0, 0, 4, 4, 1, false);
ok("canvas: rect outline leaves the middle empty", c3.get(0, 0) === 1 && c3.get(2, 2) === 0);
var c4 = Art.canvas(9, 9, bw);
c4.ellipse(4, 4, 4, 4, 1, true);
ok("canvas: filled ellipse has a centre and no corners", c4.get(4, 4) === 1 && c4.get(0, 0) === 0);
var c5 = Art.canvas(8, 8, bw);
c5.rect(0, 0, 8, 8, 0, true);
c5.rect(2, 2, 4, 4, 1, true);
c5.fill(3, 3, 0);
ok("canvas: flood fill spreads through the region", c5.get(3, 3) === 0 && c5.get(2, 2) === 0 && c5.get(0, 0) === 0);
var c6 = Art.canvas(4, 4, bw);
c6.set(0, 0, 1);
c6.mirror("x");
ok("canvas: mirror copies the half across", c6.get(3, 0) === 1);

/* ---- nearest-neighbour scaling ---- */
var small = Art.canvas(2, 2, bw);
small.set(0, 0, 1);
small.set(1, 0, 0);
small.set(0, 1, 0);
small.set(1, 1, 1);
var big = Art.scale(small, 3);
ok("scale: dimensions multiply", big.w === 6 && big.h === 6);
ok("scale: each pixel becomes a solid block (nearest-neighbour, no smoothing)",
   big.get(0, 0) === 1 && big.get(1, 0) === 1 && big.get(2, 0) === 1 && big.get(3, 0) === 0);
ok("scale: no blended indices are invented", big.data.every(function (v) { return v === 0 || v === 1; }));

/* ---- undo stack (deltas) ---- */
var hc = Art.canvas(8, 8, bw);
var hist = Art.history(hc, { limit: 2 });
hist.begin(); hc.set(0, 0, 1); hist.commit();
ok("history: a commit records a change", hist.depth() === 1);
hist.undo();
ok("history: undo restores the pixel", hc.get(0, 0) === 0 && hist.depth() === 0);
hist.redo();
ok("history: redo re-applies it", hc.get(0, 0) === 1);
hist.begin(); hc.set(1, 1, 1); hist.commit();
hist.begin(); hc.set(2, 2, 1); hist.commit();
hist.begin(); hc.set(3, 3, 1); hist.commit();
ok("history: the stack is bounded", hist.depth() === 2);

/* ---- dithering ---- */
var gray = new Uint8Array(16).fill(128);
var dith = Art.dither.ordered(gray, 4, 4, bw);
var light = 0;
for (var i = 0; i < 16; i++) if (dith.data[i] === 1) light++;
ok("dither: ordered on a mid-grey makes half light, half dark", light === 8);
ok("dither: the Bayer pattern is deterministic (a low-threshold cell is light, the highest is dark)",
   dith.get(0, 0) === 1 && dith.get(0, 3) === 0);
var big_gray = new Uint8Array(64).fill(128);
var fl = Art.dither.floyd(big_gray, 8, 8, bw);
var sum = 0;
for (var j = 0; j < 64; j++) sum += fl.data[j] ? 255 : 0;
ok("dither: Floyd-Steinberg preserves the average tone", Math.abs(sum / 64 - 128) < 20);

/* ---- median-cut quantisation ---- */
var pixels = [];
for (var k = 0; k < 4; k++) pixels.push({ r: 0, g: 0, b: 0 });
for (var k2 = 0; k2 < 4; k2++) pixels.push({ r: 255, g: 255, b: 255 });
var q = Art.quantize(pixels, 2);
ok("quantise: median-cut returns N colours", q.length === 2);
ok("quantise: the two clusters land on black and white",
   q.some(function (c) { return c.r < 10; }) && q.some(function (c) { return c.r > 245; }));

/* ---- sprite sheet round-trip ---- */
var f1 = Art.canvas(4, 4, bw); f1.rect(0, 0, 4, 4, 1, true);
var f2 = Art.canvas(4, 4, bw); f2.set(1, 1, 1); f2.set(2, 2, 1);
var sheet = Art.spriteSheet([f1, f2]);
ok("sprite sheet: the atlas has a rect per frame", sheet.atlas.frames.length === 2);
var back1 = Art.sliceSprite(sheet.sheet, sheet.atlas.frames[0]);
var back2 = Art.sliceSprite(sheet.sheet, sheet.atlas.frames[1]);
ok("sprite sheet: frame 1 round-trips", back1.data.join() === f1.data.join());
ok("sprite sheet: frame 2 round-trips", back2.data.join() === f2.data.join());

/* ---- isometric ---- */
var iso = Art.iso.to(3, 5), un = Art.iso.from(iso.x, iso.y);
ok("isometric: the mapping round-trips", Math.abs(un.x - 3) < 1e-9 && Math.abs(un.y - 5) < 1e-9);

/* ---- sketch loop (the live half) ---- */
var drawn = 0;
var sk = Art.sketch({ update: function () {}, draw: function () { drawn++; } });
sk.tick(1 / 60); sk.tick(1 / 60);
ok("sketch: tick advances time and frames", sk.frames() === 2 && Math.abs(sk.time() - 2 / 60) < 1e-9);
ok("sketch: draw runs each frame", drawn === 2);

/* ---- toRGBA ---- */
var rgba = Art.toRGBA(Art.canvas(1, 1, Art.palette(["ff0000"]), 0));
ok("toRGBA: expands a pixel to bytes", rgba[0] === 255 && rgba[1] === 0 && rgba[3] === 255);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
