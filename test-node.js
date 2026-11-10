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
// A radius-2 circle is 1,3,5,3,1 pixels wide. Rounding the half-width up made
// it 1,5,5,5,1 — a plus sign, not a circle.
(function () {
  const P = Art.palette(["#000000", "#ffffff"]);
  const e = Art.canvas(5, 5, P, 0);
  e.ellipse(2, 2, 2, 2, 1, true);
  const widths = [0, 1, 2, 3, 4].map((y) => [0, 1, 2, 3, 4].filter((x) => e.get(x, y) === 1).length);
  ok("canvas: a radius-2 filled ellipse is 1,3,5,3,1 wide", widths.join(",") === "1,3,5,3,1", widths.join(","));
})();
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

/* ---- tilemap ---- */
var tm = Art.tilemap({ w: 4, h: 3, tileW: 16, tileH: 16 });
ok("tilemap: a new map is all -1, so tile 0 stays a real tile",
  tm.get(0, 0) === -1 && tm.get(3, 2) === -1);
ok("tilemap: get off the map is -1", tm.get(-1, 0) === -1 && tm.get(4, 0) === -1);
ok("tilemap: set off the map answers false instead of growing", tm.set(4, 0, 1) === false);
ok("tilemap: set + get round-trip", tm.set(1, 1, 0) === true && tm.get(1, 1) === 0);
ok("tilemap: tile 0 is distinguishable from empty", tm.get(1, 1) === 0 && tm.get(0, 0) === -1);
ok("tilemap: pixel -> tile uses floor, so x=-1 is off the map", tm.at(-1, 5).tx === -1);
ok("tilemap: pixel -> tile maps 16px to tile 1", tm.at(16, 17).tx === 1 && tm.at(16, 17).ty === 1);
ok("tilemap: fillRect counts the tiles it wrote", tm.fillRect(1, 1, 2, 2, 5) === 4);
ok("tilemap: fillRect clips at the edge", tm.fillRect(3, 2, 5, 5, 7) === 1);

var room = Art.tilemap({ w: 5, h: 5, tileW: 8, tileH: 8 });
ok("tilemap: floodFill paints an empty map (and stops at its own edges)",
  room.floodFill(0, 0, 1) === 25);
ok("tilemap: floodFill with the same id does nothing", room.floodFill(0, 0, 1) === 0);
var split = Art.tilemap({ w: 3, h: 1, tileW: 8, tileH: 8 });
split.set(1, 0, 9);
ok("tilemap: floodFill stops at a different tile", split.floodFill(0, 0, 2) === 1 && split.get(1, 0) === 9);
ok("tilemap: floodFill honours its cap instead of filling everything",
  Art.tilemap({ w: 10, h: 10, tileW: 8, tileH: 8 }).floodFill(0, 0, 3, { max: 7 }) === 7);
ok("tilemap: floodFill from off the map is 0, not a crash", room.floodFill(-1, 0, 2) === 0);

var solid = Art.tilemap({ w: 3, h: 3, tileW: 8, tileH: 8 });
solid.fillRect(0, 0, 3, 3, 4);
var masks = solid.autotile();
ok("tilemap: autotile gives the centre of a 3x3 block mask 15", masks[4] === 15);
ok("tilemap: autotile gives a corner only E and S", masks[0] === 2 + 4);
ok("tilemap: autotile gives an edge E, S and W", masks[1] === 2 + 4 + 8);
var holey = Art.tilemap({ w: 3, h: 3, tileW: 8, tileH: 8 });
holey.fillRect(0, 0, 3, 3, 4); holey.set(1, 0, 6);
ok("tilemap: autotile does not count a different tile as a neighbour", holey.autotile()[4] === 2 + 4 + 8);
ok("tilemap: autotile reports an empty tile as -1",
  Art.tilemap({ w: 2, h: 2, tileW: 8, tileH: 8 }).autotile()[0] === -1);

var tileA = Art.canvas(8, 8, Art.palette("000000 ff0000"), 1);
var tileB = Art.canvas(8, 8, Art.palette("000000 ff0000"), 0);
var composed = Art.tilemap({ w: 2, h: 1, tileW: 8, tileH: 8 });
composed.set(0, 0, 0); composed.set(1, 0, 1);
var drawnMap = composed.toCanvas([tileA, tileB]);
ok("tilemap: toCanvas sizes the canvas to the grid", drawnMap.w === 16 && drawnMap.h === 8);
ok("tilemap: toCanvas places each tile in its cell",
  drawnMap.data[0] === 1 && drawnMap.data[8] === 0);

/* ---- animation ---- */
var an = Art.anim(3, { fps: 4, loop: true });
ok("anim: at(0) is frame 0", an.at(0) === 0);
ok("anim: one frame per 1/fps", an.at(0.25) === 1 && an.at(0.5) === 2);
ok("anim: turns the frame over at 1/fps, not halfway through it", an.at(0.2) === 0 && an.at(0.3) === 1);
ok("anim: wraps when it loops", an.at(0.75) === 0);
ok("anim: duration is count/fps", an.duration() === 0.75);
ok("anim: clamps at the last frame when it does not loop", Art.anim(3, { fps: 4, loop: false }).at(10) === 2);
ok("anim: negative time is frame 0, not a negative index", an.at(-1) === 0);
var pp = Art.anim(3, { fps: 1, pingpong: true });
ok("anim: pingpong does not repeat the endpoints", [0, 1, 2, 3, 4].map(function (t) { return pp.at(t); }).join() === "0,1,2,1,0");
ok("anim: pingpong duration is 2n-2 frames", pp.duration() === 4);
ok("anim: fps 0 freezes at frame 0 instead of returning NaN", Art.anim(3, { fps: 0 }).at(5) === 0);
ok("anim: an empty timeline answers -1", Art.anim(0, {}).at(1) === -1);
var threeFrames = [tileA, tileB, tileA];
ok("anim: frame(t) returns the frame itself, not just its index",
  Art.anim(threeFrames, { fps: 2 }).frame(0.5) === threeFrames[1]);
ok("anim: sequence() lists the whole loop", an.sequence().join() === "0,1,2");

/* ---- generate ---- */
var pal5 = Art.palette("1a1c2c 5d275d b13e53 ef7d57 ffd166");
var g1 = Art.generate({ seed: 42, w: 16, h: 16, density: 0.6, palette: pal5 });
var g2 = Art.generate({ seed: 42, w: 16, h: 16, density: 0.6, palette: pal5 });
var g3 = Art.generate({ seed: 43, w: 16, h: 16, density: 0.6, palette: pal5 });
ok("generate: the same seed rebuilds the same sprite", g1.data.join() === g2.data.join());
ok("generate: a different seed gives a different sprite", g1.data.join() !== g3.data.join());
ok("generate: returns a canvas the rest of the kit can use", g1.w === 16 && g1.palette === pal5);
ok("generate: is mirror-symmetric", Art.isSymmetric(g1));
ok("generate: stays symmetric on an odd width", Art.isSymmetric(Art.generate({ seed: 7, w: 15, h: 9, density: 0.7 })));
ok("generate: index 0 is empty by convention", g1.data[0] === 0);
ok("generate: every painted pixel is a real palette index",
  Array.prototype.every.call(g1.data, function (v) { return v >= 0 && v < pal5.size; }));
ok("generate: never returns an empty sprite",
  Array.prototype.some.call(Art.generate({ seed: 3, w: 8, h: 8, density: 0, palette: pal5 }).data, function (v) { return v !== 0; }));
ok("generate: a body sprite leaves the corners empty",
  Art.generate({ seed: 5, w: 16, h: 16, density: 1, palette: pal5 }).get(0, 0) === 0);
ok("generate: a fill sprite may reach the corner",
  Art.generate({ seed: 5, w: 16, h: 16, density: 1, palette: pal5, shape: "fill" }).get(0, 0) !== 0);
var set1 = Art.generateSet(9, 4, { w: 8, h: 8, palette: pal5 });
var set2 = Art.generateSet(9, 4, { w: 8, h: 8, palette: pal5 });
ok("generateSet: returns the requested count", set1.length === 4);
ok("generateSet: is reproducible", set1.map(function (c) { return c.data.join(); }).join("|") ===
  set2.map(function (c) { return c.data.join(); }).join("|"));
ok("generateSet: its sprites differ from each other",
  new Set(set1.map(function (c) { return c.data.join(); })).size === 4);
ok("isSymmetric: says no to an asymmetric canvas", (function () {
  var m = Art.canvas(4, 4, pal5); m.set(0, 0, 3); return Art.isSymmetric(m) === false;
})());
ok("rng: is a seeded stream, not Math.random", (function () {
  var a = Art.rng(5), b = Art.rng(5);
  return a.next() === b.next() && a.int(100) === b.int(100);
})());
ok("rng: next stays in [0,1)", (function () {
  var r = Art.rng(11), good = true;
  for (var i = 0; i < 500; i++) { var v = r.next(); if (!(v >= 0 && v < 1)) good = false; }
  return good;
})());

/* ---- the pieces compose ---- */
var gen = Art.generate({ seed: 2026, w: 12, h: 12, density: 0.8, palette: pal5 });
var big = Art.scale(gen, 4);
ok("compose: a generated sprite scales nearest-neighbour", big.w === 48 && big.h === 48);
ok("compose: scaling keeps the sprite symmetric", Art.isSymmetric(big));
var pair = Art.spriteSheet([gen, Art.generate({ seed: 77, w: 12, h: 12, palette: pal5 })]);
ok("compose: two generated sprites sheet and slice back",
  Art.sliceSprite(pair.sheet, pair.atlas.frames[1]).data.join() ===
  Art.generate({ seed: 77, w: 12, h: 12, palette: pal5 }).data.join());
var timeline = Art.anim([gen, gen], { fps: 8 });
ok("compose: an animation over generated frames has a duration", timeline.duration() === 0.25);

/* ---- version drift ---- */
var fs = require("fs");
var versionFile = fs.readFileSync(require("path").join(__dirname, "VERSION"), "utf8").trim();
ok("version: VERSION and Art.version agree", versionFile === Art.version, versionFile + " vs " + Art.version);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
