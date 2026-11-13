// Jarvis Command Deck — data link + UI. No secrets live in this file.
import { ROSTER, ROUTER, POLL_MS, WRITE_AGENT, VERSION } from "./config.js";

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LS = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }, del: k => { try { localStorage.removeItem(k); } catch {} } };
const qs = new URLSearchParams(location.search);
const mobileQ = matchMedia("(max-width:820px)");

// ---------- connection (token + note ids are entered at runtime, stored only in this browser) ----------
// The Jarvis HUD is served from the same origin, so if it is already linked on this device we reuse its link.
function hudCfg() { try { return JSON.parse(LS.get("jarvis.ucfg") || "{}") || {}; } catch { return {}; } }
function conn() {
  let own = {}; try { own = JSON.parse(LS.get("jcd.conn") || "{}") || {}; } catch {}
  const h = hudCfg();
  const pick = (a, b) => (a && String(a).trim()) || (b && String(b).trim()) || "";
  return { base: pick(own.base, h.sbBase).replace(/\/+$/, ""), set: pick(own.set, h.sbSet), inbox: pick(own.inbox, h.sbInbox), status: pick(own.status, h.sbStatus),
    fromHud: !own.base && !!h.sbBase };
}
function token() { return LS.get("jcd.tok") || LS.get("jarvis.sbtok") || ""; }
function tokenSource() { return LS.get("jcd.tok") ? "deck" : (LS.get("jarvis.sbtok") ? "hud" : ""); }
const okBase = b => /^https:\/\/[^\s/]+\/.+/.test(b);

function noteUrl(id) { const c = conn(); return `${c.base}/context-sets/${encodeURIComponent(c.set)}/notes/${encodeURIComponent(id)}`; }
async function sbGet(id) {
  const t = token(), c = conn(); if (!t) throw new Error("no token"); if (!okBase(c.base) || !c.set || !id) throw new Error("connection details missing");
  const r = await fetch(noteUrl(id), { headers: { Authorization: "Bearer " + t }, cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status); const d = await r.json(); const n = d.note || d; return { n, etag: r.headers.get("ETag") };
}
function sbJson(md) { const m = /```json\s*([\s\S]*?)```/.exec(md || ""); return JSON.parse(m ? m[1] : md); }
function sbMd(md, obj) { const j = "```json\n" + JSON.stringify(obj, null, 2) + "\n```"; return /```json[\s\S]*?```/.test(md) ? md.replace(/```json[\s\S]*?```/, () => j) : md + "\n\n" + j + "\n"; }
async function sbAppend(text) {
  const t = token(), c = conn(); if (!t) throw new Error("no token");
  for (let i = 0; i < 4; i++) {
    const { n, etag } = await sbGet(c.inbox); if (!etag) throw new Error("no ETag from Second Brain"); const o = sbJson(n.markdown); o.requests = Array.isArray(o.requests) ? o.requests : [];
    const item = { id: "r" + Date.now().toString(36), createdAt: new Date().toISOString(), text, status: "new", routedTo: null, reply: null, repliedAt: null };
    o.requests.push(item);
    const r = await fetch(noteUrl(c.inbox), { method: "PATCH", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json", "If-Match": etag, "X-Second-Brain-Agent": WRITE_AGENT },
      body: JSON.stringify({ title: n.title, summary: n.summary || "", markdown: sbMd(n.markdown, o) }) });
    if (r.status === 409 || r.status === 412) { await new Promise(z => setTimeout(z, 350 + i * 400)); continue; }
    if (!r.ok) throw new Error("HTTP " + r.status); return item;
  }
  throw new Error("inbox busy, try again");
}

// ---------- roster matching ----------
const firstWord = s => String(s || "").toLowerCase().split(/[\s·\-–—:,(]+/).filter(Boolean)[0] || "";
function botIndex(nameOrRole, role) {
  const fw = firstWord(nameOrRole), full = String(nameOrRole || "").toLowerCase().trim(), rl = String(role || "").toLowerCase().trim();
  let i = ROSTER.findIndex(b => b.match.includes(fw)); if (i >= 0) return i;
  i = ROSTER.findIndex(b => b.match.includes(full)); if (i >= 0) return i;
  if (rl) { i = ROSTER.findIndex(b => b.match.includes(rl)); if (i >= 0) return i; }
  return -1;
}
const stateOf = s => ({ online: "working", working: "working", busy: "working", waiting: "waiting", blocked: "waiting", idle: "idle" })[String(s || "").toLowerCase()] || "unknown";
const stateLabel = s => ({ working: "Working", waiting: "Waiting", idle: "Idle", unknown: "No signal" })[s];

// ---------- time ----------
const TZ = ROUTER.tz;
const fmtTime = iso => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return ""; return d.toLocaleString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }); };
function ago(iso) { const s = (Date.now() - new Date(iso)) / 1000; if (!isFinite(s)) return ""; if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + "m ago"; if (s < 86400) return Math.round(s / 3600) + "h ago"; return Math.round(s / 86400) + "d ago"; }
function wall(d) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(d).map(x => [x.type, x.value]));
  return { ms: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute), dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) }; }
function nextRouter() {
  const now = wall(new Date()); const day0 = now.ms - (now.ms % 86400000);
  for (let d = 0; d < 9; d++) { const dow = (now.dow + d) % 7; if (!ROUTER.days.includes(dow)) continue;
    for (const h of ROUTER.hours) { const ms = day0 + d * 86400000 + h * 3600000; if (ms > now.ms) { const mins = Math.round((ms - now.ms) / 60000);
      const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow]; return { mins, label: (d === 0 ? "today" : d === 1 ? "tomorrow" : dn) + " " + String(h).padStart(2, "0") + ":00" }; } } }
  return null;
}
const dur = m => m < 60 ? m + "m" : Math.floor(m / 60) + "h " + String(m % 60).padStart(2, "0") + "m";

// ---------- state ----------
const S = { inbox: [], bots: [], botByIdx: {}, at: 0, err: null, polling: false, selected: null, firstPoll: true, freshIds: new Set() };
let deck = null;
let seen = {}; try { seen = JSON.parse(LS.get("jcd.seen") || "{}") || {}; } catch {}

// ---------- toasts ----------
function toast(html, ms = 4200) { const t = document.createElement("div"); t.className = "toast glass"; t.innerHTML = html; $("toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 520); }, ms); }

// ---------- polling ----------
let pollTimer = null, backoff = 0;
async function poll() {
  if (S.polling) return; S.polling = true; const c = conn();
  try {
    const [a, b] = await Promise.all([sbGet(c.status), sbGet(c.inbox)]);
    const st = sbJson(a.n.markdown), ib = sbJson(b.n.markdown);
    S.bots = Array.isArray(st.bots) ? st.bots : []; S.inbox = Array.isArray(ib.requests) ? ib.requests : []; S.at = Date.now(); S.err = null; backoff = 0;
    ingest();
  } catch (e) { S.err = e.message; backoff = Math.min(backoff + 1, 4); }
  S.polling = false; renderAll();
  clearTimeout(pollTimer); pollTimer = setTimeout(poll, POLL_MS * (1 + backoff));
}
function ingest() {
  S.botByIdx = {}; const states = {};
  for (const b of S.bots) { const i = botIndex(b.name, b.role); if (i < 0) continue; if (!S.botByIdx[i] || new Date(b.updatedAt || 0) > new Date(S.botByIdx[i].updatedAt || 0)) { S.botByIdx[i] = b; states[i] = stateOf(b.state); } }
  if (deck) deck.setStates(states);
  // beams from status transitions since last seen on this device
  const first = !Object.keys(seen).length, fresh = new Set();
  for (const r of S.inbox) {
    if (!r || !r.id) continue; const prev = seen[r.id], cur = r.status, bi = botIndex(r.routedTo);
    if (!first && prev !== cur) {
      fresh.add(r.id);
      if (cur === "routed" && bi > 0) { deck && deck.fire(bi, "out"); toast(`Jarvis routed a request to <b>${esc(ROSTER[bi].name)}</b>.`); }
      if (cur === "answered") { if (bi > 0) { if (prev !== "routed") deck && deck.fire(bi, "out"); setTimeout(() => deck && deck.fire(bi, "in"), prev !== "routed" ? 2400 : 0); }
        else deck && deck.flareCore(1); toast(`<b>${esc(bi >= 0 ? ROSTER[bi].name : "Jarvis")}</b> answered: ${esc(String(r.reply || "").slice(0, 120))}${String(r.reply || "").length > 120 ? "…" : ""}`, 6500); }
      if (cur === "new" && prev === undefined && !S.justSent?.has(r.id)) deck && deck.intake();
    }
    seen[r.id] = cur;
  }
  S.freshIds = fresh; LS.set("jcd.seen", JSON.stringify(seen));
  if (deck) deck.setLinks(S.inbox.filter(r => r.status === "routed").map(r => ({ i: botIndex(r.routedTo) })).filter(x => x.i > 0));
}

// ---------- rendering ----------
function renderLink() {
  const p = $("linkPill"), t = $("linkTxt"); p.classList.remove("live", "err");
  if (!token()) { t.textContent = "Not linked"; return; }
  if (S.err) { p.classList.add("err"); t.textContent = S.err === "no token" ? "Not linked" : "Link error"; p.title = "Second Brain: " + S.err; return; }
  if (S.at) { p.classList.add("live"); t.textContent = "Live · " + new Date(S.at).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }); p.title = "Second Brain linked. Checks every " + Math.round(POLL_MS / 1000) + "s."; }
  else t.textContent = "Linking…";
}
function stepper(status) {
  const k = { new: 0, routed: 1, answered: 2 }[status] ?? 0;
  return `<div class="steps">${[0, 1, 2].map(i => `<i class="${i <= k ? "on" : ""} ${i === k && k < 2 ? "cur" : ""}"></i>`).join("")}</div>
  <div class="slabels">${["Queued", "Routed", "Answered"].map((l, i) => `<span class="${i <= k ? "on" : ""}">${l}</span>`).join("")}</div>`;
}
function chip(i) { if (i < 0) return ""; const b = ROSTER[i]; return `<span class="chip" data-sel="${i}" style="--c:${b.color}">${esc(b.name)}</span>`; }
function renderFeed() {
  const el = $("feed");
  if (!token() || (S.err && !S.inbox.length)) {
    el.innerHTML = `<div class="empty"><b>${!token() ? "UPLINK OFFLINE" : "LINK ERROR"}</b>${!token() ? "Add your Second Brain token in Settings to see Jarvis's inbox and the crew's live status." : "Can't reach Second Brain right now (" + esc(S.err) + "). Retrying automatically."}<div style="margin-top:14px"><button class="btn" data-open="settings">Open settings</button></div></div>`; return;
  }
  const list = S.inbox.slice().reverse().slice(0, 30);
  if (!list.length) { el.innerHTML = `<div class="empty"><b>STANDING BY</b>No requests yet. Brief Jarvis below, Commander.</div>`; return; }
  el.innerHTML = list.map(r => { const bi = botIndex(r.routedTo), c = bi >= 0 ? ROSTER[bi].color : "#6366f1";
    return `<div class="card ${S.freshIds.has(r.id) ? "fresh" : ""}" style="--c:${c}"><div class="t">${esc(r.text)}</div>${stepper(r.status)}
      <div class="meta"><span>${esc(ago(r.createdAt))}</span>${bi >= 0 ? "<span>→</span>" + chip(bi) : r.routedTo ? "<span>→ " + esc(r.routedTo) + "</span>" : ""}</div>
      ${r.reply ? `<div class="reply">${esc(r.reply)}</div>` : ""}</div>`; }).join("");
}
function renderCrew() {
  $("crew").innerHTML = ROSTER.map((b, i) => { const s = S.botByIdx[i], st = s ? stateOf(s.state) : "unknown";
    return `<div class="crow ${S.selected === i ? "sel" : ""}" data-sel="${i}" style="--c:${b.color}"><div class="orb"></div><div><div class="nm">${esc(b.name)}</div><div class="rl">${esc(b.title)}</div></div><span class="st stt ${st}">${stateLabel(st)}</span></div>`; }).join("");
}
function renderRouter() {
  const n = nextRouter();
  $("routerInfo").innerHTML = `ROUTER · 4× weekdays${n ? ` · next pass <b>${esc(n.label)}</b> (in ${dur(n.mins)})` : ""}<br>Direct chat with Jarvis routes straight away.`;
}
function renderDossier() {
  const i = S.selected, el = $("dossier"), panel = $("right");
  if (i == null) { panel.classList.remove("open"); return; }
  const b = ROSTER[i], s = S.botByIdx[i], st = s ? stateOf(s.state) : "unknown";
  const reqs = S.inbox.filter(r => botIndex(r.routedTo) === i).slice().reverse().slice(0, 5);
  const n = nextRouter();
  el.innerHTML = `<div class="dh" style="--c:${b.color}"><div class="orb"></div><div><h3>${esc(b.name.toUpperCase())}</h3><p>${esc(b.title)}</p></div></div>
    <span class="stt ${st}">${stateLabel(st)}</span>
    <div class="dbox"><h5>Live status line</h5><div class="ln">${s ? esc(s.note || "—") : (token() ? "No status line for this bot in Second Brain yet." : "Link Second Brain in Settings to see live status.")}</div>${s && s.updatedAt ? `<div class="sm">Updated ${esc(fmtTime(s.updatedAt))}</div>` : ""}</div>
    ${i === 0 ? `<div class="dbox"><h5>Routing</h5><div class="ln">Every message you send here lands in Jarvis's inbox. The router hands it to the right bot 4× each weekday${n ? `; next pass ${esc(n.label)} (in ${dur(n.mins)})` : ""}. Talking to Jarvis directly routes it straight away.</div></div>`
      : `<div class="dbox"><h5>Recent requests via Jarvis</h5>${reqs.length ? reqs.map(r => `<div class="mini">${esc(r.text)}<div class="sm">${esc(r.status)} · ${esc(ago(r.createdAt))}</div></div>`).join("") : `<div class="ln muted">None yet.</div>`}</div>`}
    <button class="btn dact" id="briefBtn">${i === 0 ? "Brief Jarvis" : "Ask Jarvis to brief " + esc(b.name)}</button>`;
  panel.classList.add("open");
  $("briefBtn").onclick = () => { const inp = $("cmdIn"); inp.value = i === 0 ? "" : `For ${b.name}: `; inp.focus(); if (mobileQ.matches) closeLeft(); };
}
function renderAll() { renderLink(); renderFeed(); renderCrew(); renderRouter(); renderDossier(); shift(); }

// ---------- selection & panels ----------
function select(i) { S.selected = i; if (deck) deck.select(i, true); if (i != null && mobileQ.matches) closeLeft(); renderCrew(); renderDossier(); shift(); }
function shift() { if (!deck) return; const L = $("left").classList.contains("open"), R = $("right").classList.contains("open"); deck.setShift(mobileQ.matches ? 0 : (L ? 130 : 0) - (R ? 130 : 0)); }
function openLeft(tab) { $("left").classList.add("open"); setTab(tab || "feed"); setTimeout(shift); $("feedBtn").classList.toggle("on", tab !== "crew"); $("crewBtn").classList.toggle("on", tab === "crew"); if (mobileQ.matches && S.selected != null) select(null); }
function closeLeft() { setTimeout(shift); $("left").classList.remove("open"); $("feedBtn").classList.remove("on"); $("crewBtn").classList.remove("on"); }
function setTab(t) { document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === t)); $("tab-feed").hidden = t !== "feed"; $("tab-crew").hidden = t !== "crew"; }
document.addEventListener("click", e => {
  const s = e.target.closest("[data-sel]"); if (s) { select(+s.dataset.sel); return; }
  const o = e.target.closest("[data-open]"); if (o) openSettings();
});
document.querySelectorAll(".tab").forEach(b => b.onclick = () => { setTab(b.dataset.tab); $("feedBtn").classList.toggle("on", b.dataset.tab === "feed"); $("crewBtn").classList.toggle("on", b.dataset.tab === "crew"); });
const toggleLeft = tab => { const L = $("left"); if (L.classList.contains("open") && !$("tab-" + tab).hidden) closeLeft(); else openLeft(tab); };
$("feedBtn").onclick = () => toggleLeft("feed"); $("crewBtn").onclick = () => toggleLeft("crew");
$("leftClose").onclick = closeLeft; $("dossClose").onclick = () => select(null);
$("linkPill").onclick = () => token() ? poll() : openSettings();

// ---------- command bar ----------
S.justSent = new Set();
$("cmd").addEventListener("submit", async e => {
  e.preventDefault(); const inp = $("cmdIn"), v = inp.value.trim(); if (!v) return;
  if (!token()) { toast("Link Second Brain in <b>Settings</b> first, Commander."); openSettings(); return; }
  $("sendBtn").disabled = true; deck && deck.intake();
  try { const item = await sbAppend(v); S.justSent.add(item.id); seen[item.id] = "new"; LS.set("jcd.seen", JSON.stringify(seen)); inp.value = "";
    const n = nextRouter(); toast(`Queued for Jarvis.${n ? ` Next router pass <b>${esc(n.label)}</b>` : ""}, or straight away if you talk to Jarvis directly.`, 6000);
    await poll(); if (!mobileQ.matches) openLeft("feed");
  } catch (err) { toast("Couldn't reach Jarvis's inbox: " + esc(err.message), 6000); }
  $("sendBtn").disabled = false;
});
// real speech-to-text where the browser supports it (Chrome / Android Chrome)
(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  const btn = $("micBtn"); btn.hidden = false; let rec = null, base = "";
  btn.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = "en-GB"; rec.interimResults = true; rec.continuous = false; base = $("cmdIn").value ? $("cmdIn").value.trim() + " " : "";
    rec.onresult = ev => { let s = ""; for (const r of ev.results) s += r[0].transcript; $("cmdIn").value = base + s; };
    rec.onerror = ev => { if (ev.error !== "aborted" && ev.error !== "no-speech") toast("Mic: " + esc(ev.error)); };
    rec.onend = () => { btn.classList.remove("rec"); rec = null; $("cmdIn").focus(); };
    try { rec.start(); btn.classList.add("rec"); } catch (e) { rec = null; toast("Mic unavailable: " + esc(e.message)); }
  };
})();

// ---------- settings ----------
function openSettings() {
  const c = conn(), src = tokenSource();
  $("tokState").textContent = src === "deck" ? "A token is saved on this device (hidden)." : src === "hud" ? "Using the Jarvis HUD's token on this device (hidden). Save one here to override." : "No token saved. Paste your Second Brain token to link the deck.";
  $("tokIn").value = ""; $("cBase").value = c.base; $("cSet").value = c.set; $("cInbox").value = c.inbox; $("cStatus").value = c.status;
  $("connState").textContent = c.fromHud ? "Filled in from the Jarvis HUD on this device." : (c.base ? "Saved on this device." : "Enter the API base, context set and the two note ids.");
  $("connDet").open = !c.base; $("qSel").value = LS.get("jcd.quality") || "auto"; $("motionChk").checked = LS.get("jcd.reduced") === "1";
  $("verTag").textContent = "Command Deck v" + VERSION + (deck ? " · render tier " + deck.tierName : "");
  $("settings").hidden = false;
}
$("setBtn").onclick = openSettings; $("setClose").onclick = () => $("settings").hidden = true;
$("settings").addEventListener("click", e => { if (e.target.id === "settings") $("settings").hidden = true; });
$("tokSave").onclick = () => { const v = $("tokIn").value.trim(); if (!v) return; LS.set("jcd.tok", v); $("tokIn").value = ""; $("tokState").textContent = "Token saved on this device (hidden)."; S.err = null; poll(); };
$("tokForget").onclick = () => { LS.del("jcd.tok"); $("tokState").textContent = tokenSource() === "hud" ? "Deck token forgotten. The HUD's token on this device is still used." : "Token forgotten."; S.inbox = []; S.bots = []; S.at = 0; ingest(); renderAll(); if (token()) poll(); };
$("connSave").onclick = () => { const o = { base: $("cBase").value.trim(), set: $("cSet").value.trim(), inbox: $("cInbox").value.trim(), status: $("cStatus").value.trim() };
  if (o.base && !okBase(o.base)) { $("connState").textContent = "API base must be an https:// URL."; return; } LS.set("jcd.conn", JSON.stringify(o)); $("connState").textContent = "Saved on this device."; poll(); };
$("connTest").onclick = async () => { $("connState").textContent = "Testing…"; try { const c = conn(); await sbGet(c.status); await sbGet(c.inbox); $("connState").textContent = "Link OK: both notes readable."; } catch (e) { $("connState").textContent = "Link failed: " + e.message; } };
$("qSel").onchange = e => { LS.set("jcd.quality", e.target.value); toast("Reloading with new visual quality…", 1500); setTimeout(() => location.reload(), 700); };
$("motionChk").onchange = e => { LS.set("jcd.reduced", e.target.checked ? "1" : "0"); setTimeout(() => location.reload(), 300); };
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("settings").hidden) $("settings").hidden = true; else if (S.selected != null) select(null); else closeLeft(); } if (e.key === "/" && document.activeElement !== $("cmdIn") && $("settings").hidden) { e.preventDefault(); $("cmdIn").focus(); } });

// ---------- boot ----------
async function boot() {
  const line = $("bootLine");
  const gl = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  if (gl) {
    try {
      line.textContent = "Spinning up the core…";
      const { Deck } = await import("./scene.js");
      const reduced = LS.get("jcd.reduced") === "1" || matchMedia("(prefers-reduced-motion:reduce)").matches;
      deck = new Deck($("gl"), $("labels"), ROSTER, { quality: qs.get("quality") || LS.get("jcd.quality") || "auto", reduced, onSelect: i => select(i) });
      window.__deck = deck;
    } catch (e) { console.warn("3D init failed", e); $("nogl").hidden = false; }
  } else $("nogl").hidden = false;
  line.textContent = "Linking Second Brain…";
  renderAll(); if (!mobileQ.matches) openLeft("feed");
  setTimeout(() => { $("boot").classList.add("gone"); document.body.classList.add("ready"); }, 500);
  if (token()) poll(); else renderAll();
  setInterval(renderRouter, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && token() && Date.now() - S.at > 15000) poll(); });
}
boot();
