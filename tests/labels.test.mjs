// node tests/labels.test.mjs  — checks bot label collision avoidance
import { resolveLabels, smoothLabels, countOverlaps, rectsOverlap } from "../labels.js";

let fail = 0, pass = 0;
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log("FAIL", label); } };
const inside = (r, b) => r.x >= b.left - 1e-6 && r.y >= b.top - 1e-6 && r.x + r.w <= b.right + 1e-6 && r.y + r.h <= b.bottom + 1e-6;
const desk = { left: 8, top: 18, right: 1272, bottom: 704 }, phone = { left: 8, top: 70, right: 382, bottom: 708 };

// 1. Non-overlapping labels stay exactly where they are
const apart = [{ id: 0, x: 100, y: 100, w: 90, h: 40 }, { id: 1, x: 400, y: 300, w: 90, h: 40 }, { id: 2, x: 800, y: 120, w: 120, h: 44 }];
const r1 = resolveLabels(apart, desk);
ok(r1.every((r, i) => r.x === apart[i].x && r.y === apart[i].y && r.moved === 0), "non-overlapping labels do not move");

// 2. Two labels on top of each other get separated, with a small move
const pair = [{ id: 0, x: 300, y: 300, w: 100, h: 40 }, { id: 1, x: 310, y: 305, w: 100, h: 40 }];
const r2 = resolveLabels(pair, desk);
ok(countOverlaps(r2, 6) === 0, "a stacked pair is pulled apart with the gap kept");
ok(r2.every(r => inside(r, desk)), "pair stays inside the screen");
ok(r2[0].moved + r2[1].moved < 60, "pair moves only about one label height");

// 3. Eleven labels all piled on one point, on desktop and on a phone
for (const [b, name, W, H] of [[desk, "desktop", 110, 46], [phone, "phone", 76, 30]]) {
  const pile = Array.from({ length: 11 }, (_, i) => ({ id: i, x: (b.left + b.right) / 2 - W / 2 + i, y: (b.top + b.bottom) / 2 - H / 2 + i, w: W, h: H, priority: i === 0 ? 1000 : 0 }));
  const r = resolveLabels(pile, b);
  ok(countOverlaps(r, 0) === 0, "11 piled labels never overlap on " + name);
  ok(r.every(x => inside(x, b)), "11 piled labels stay inside the " + name + " screen");
  ok(r[0].moved === 0, "the Jarvis core label keeps its spot on " + name);
}

// 4. Labels pushed against the screen edge are clamped in and still separated
const edge = [{ id: 0, x: -40, y: 5, w: 100, h: 40 }, { id: 1, x: -30, y: 10, w: 100, h: 40 }, { id: 2, x: 1250, y: 690, w: 100, h: 40 }, { id: 3, x: 1240, y: 700, w: 100, h: 40 }];
const r4 = resolveLabels(edge, desk);
ok(countOverlaps(r4, 0) === 0 && r4.every(x => inside(x, desk)), "edge labels clamped inside and not overlapping");

// 5. Random crowded scenes: never overlap, always inside
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let bad = 0, outside = 0;
for (let t = 0; t < 300; t++) {
  const b = t % 2 ? desk : phone, W = t % 2 ? 110 : 76, H = t % 2 ? 46 : 30;
  const its = Array.from({ length: 11 }, (_, i) => ({ id: i, x: b.left + rnd() * (b.right - b.left - W) * .6 + 40, y: b.top + rnd() * (b.bottom - b.top - H) * .5 + 60, w: W * (.8 + rnd() * .4), h: H, ax: 0, ay: 0, priority: rnd() * 30 }));
  its.forEach(i => { i.ax = i.x + i.w / 2; i.ay = i.y + i.h; });
  const r = resolveLabels(its, b);
  if (countOverlaps(r, 0)) bad++; if (!r.every(x => inside(x, b))) outside++;
}
ok(bad === 0, "300 random crowded scenes have no overlaps (" + bad + " bad)");
ok(outside === 0, "300 random crowded scenes stay inside the screen");

// 6. Last frame's spot is kept when it is still clear (no flip-flopping)
const prevHeld = resolveLabels([{ id: 0, x: 300, y: 300, w: 100, h: 40, priority: 10 }, { id: 1, x: 305, y: 300, w: 100, h: 40, prevX: 305, prevY: 346 }], desk);
ok(prevHeld[1].y === 346, "a displaced label stays on the same side as last frame");

// 7. Smoothing eases but never lets labels overlap
const targets = [{ x: 100, y: 100, w: 100, h: 40 }, { x: 100, y: 146, w: 100, h: 40 }];
const s1 = smoothLabels([{ x: 100, y: 100 }, { x: 100, y: 200 }], targets, .25);
ok(Math.abs(s1[1].y - 186.5) < 1e-6, "smoothing eases a quarter of the way");
const s2 = smoothLabels([{ x: 100, y: 146 }, { x: 100, y: 60 }], targets, .25);
ok(countOverlaps(s2, 0) === 0, "smoothing snaps to target rather than overlap");
const s3 = smoothLabels([null, null], targets, .1);
ok(s3[0].y === 100 && s3[1].y === 146, "new labels appear straight at their target");
const s4 = smoothLabels([{ x: -300, y: 900 }, null], [{ x: 20, y: 600, w: 100, h: 40 }, { x: 200, y: 100, w: 100, h: 40 }], .1, 2, phone);
ok(s4.every(r => inside(r, phone)), "a label easing in from off screen is kept on screen");
ok(!rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 }), "touching edges are not an overlap");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
