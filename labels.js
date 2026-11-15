// Label collision avoidance for the Command Deck (v2.6.16).
// Pure functions, no DOM: scene.js projects each bot to the screen, then asks
// resolveLabels() where every label should sit so none of them overlap, and
// smoothLabels() eases them there between frames without ever letting two
// labels touch on screen.

const overlaps = (a, b, gap) =>
  a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;

export function rectsOverlap(a, b, gap = 0) { return overlaps(a, b, gap); }

export function countOverlaps(rects, gap = 0) {
  let n = 0;
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (overlaps(rects[i], rects[j], gap)) n++;
  return n;
}

const clampX = (x, w, b) => Math.max(b.left, Math.min(b.right - w, x));
const clampY = (y, h, b) => Math.max(b.top, Math.min(b.bottom - h, y));

/**
 * Place labels so none overlap.
 * items: [{ id, x, y, w, h, priority?, prevX?, prevY?, ax?, ay? }]
 *   x, y  = where the label wants to be (top-left, already centred over its bot)
 *   prevX, prevY = where it was last frame (optional, keeps choices steady)
 *   ax, ay = the bot's anchor point on screen (other labels try not to cover it)
 *   priority = higher is placed first and moves least (core, selected, nearest)
 * bounds: { left, top, right, bottom }
 * Returns [{ id, x, y, w, h, moved }] in the same order as items.
 */
export function resolveLabels(items, bounds, opts = {}) {
  const gap = opts.gap ?? 6, wx = opts.weightX ?? 1.6, wy = opts.weightY ?? 1, hold = opts.hold ?? .35, anchorCost = opts.anchorCost ?? 60;
  const order = items.map((it, i) => i).sort((a, b) => (items[b].priority || 0) - (items[a].priority || 0) || items[a].y - items[b].y || a - b);
  const out = new Array(items.length), placed = [];
  for (const i of order) {
    const it = items[i], w = it.w, h = it.h;
    const x0 = clampX(it.x, w, bounds), y0 = clampY(it.y, h, bounds);
    const xs = [x0], ys = [y0];
    if (Number.isFinite(it.prevX) && Number.isFinite(it.prevY)) { xs.push(clampX(it.prevX, w, bounds)); ys.push(clampY(it.prevY, h, bounds)); }
    for (const p of placed) {
      ys.push(clampY(p.y - h - gap, h, bounds), clampY(p.y + p.h + gap, h, bounds));
      xs.push(clampX(p.x - w - gap, w, bounds), clampX(p.x + p.w + gap, w, bounds));
    }
    let best = null, bestCost = Infinity, fallback = null, fallbackCost = Infinity;
    for (const cx of xs) for (const cy of ys) {
      const c = { x: cx, y: cy, w, h };
      let cost = wx * Math.abs(cx - it.x) + wy * Math.abs(cy - it.y);
      if (Number.isFinite(it.prevX) && Number.isFinite(it.prevY)) cost += hold * (Math.abs(cx - it.prevX) + Math.abs(cy - it.prevY));
      for (const o of items) if (o !== it && Number.isFinite(o.ax) && o.ax >= cx - 4 && o.ax <= cx + w + 4 && o.ay >= cy - 4 && o.ay <= cy + h + 4) cost += anchorCost;
      let hits = 0; for (const p of placed) if (overlaps(c, p, gap)) hits++;
      if (!hits) { if (cost < bestCost) { bestCost = cost; best = c; } }
      else { const fc = hits * 1e6 + cost; if (fc < fallbackCost) { fallbackCost = fc; fallback = c; } }
    }
    const pick = best || fallback || { x: x0, y: y0, w, h };
    const r = { id: it.id, x: pick.x, y: pick.y, w, h, moved: Math.hypot(pick.x - it.x, pick.y - it.y) };
    placed.push(r); out[i] = r;
  }
  return out;
}

/**
 * Ease each label from where it is shown now (cur) towards its resolved target,
 * then snap back to the target any label whose eased spot would touch another.
 * Targets never overlap, so the result never overlaps either.
 * cur, targets: arrays of {x, y, w, h} in the same order (cur entries may be null).
 * k: blend 0..1 for this frame (1 = jump straight to the target).
 * bounds: optional { left, top, right, bottom }; eased spots are kept on screen.
 */
export function smoothLabels(cur, targets, k, gap = 0, bounds = null) {
  const res = targets.map((t, i) => {
    const c = cur[i];
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y) || Math.hypot(c.x - t.x, c.y - t.y) > 400) return { ...t, snapped: true };
    let x = c.x + (t.x - c.x) * k, y = c.y + (t.y - c.y) * k;
    if (bounds) { x = clampX(x, t.w, bounds); y = clampY(y, t.h, bounds); }
    return { ...t, x, y, snapped: false };
  });
  for (let pass = 0; pass <= res.length; pass++) {
    let changed = false;
    for (let i = 0; i < res.length; i++) for (let j = i + 1; j < res.length; j++) {
      if (!overlaps(res[i], res[j], gap)) continue;
      for (const m of [i, j]) if (!res[m].snapped) { res[m].x = targets[m].x; res[m].y = targets[m].y; res[m].snapped = true; changed = true; }
    }
    if (!changed) break;
  }
  return res;
}
