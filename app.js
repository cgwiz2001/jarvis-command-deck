// Jarvis Command Deck — data link + UI. No secrets live in this file.
import { ROSTER, ROUTER, POLL_MS, WRITE_AGENT, VERSION } from "./config.js?v=251";
import { lockNow, changePin, getIdleMinutes, setIdleMinutes, resetDeck, hasPin, bumpActivity } from "./lock.js?v=251";

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
  return { base: pick(own.base, h.sbBase).replace(/\/+$/, ""), set: pick(own.set, h.sbSet), inbox: pick(own.inbox, h.sbInbox), status: pick(own.status, h.sbStatus), hist: pick(own.hist, h.sbHist), style: pick(own.style, h.sbStyle),
    fromHud: !own.base && !!h.sbBase };
}
function token() { return LS.get("jcd.tok") || LS.get("jarvis.sbtok") || ""; }
function tokenSource() { return LS.get("jcd.tok") ? "deck" : (LS.get("jarvis.sbtok") ? "hud" : ""); }
const okBase = b => /^https:\/\/[^\s/]+\/.+/.test(b);

function hookCfg() { return { url: (LS.get("jcd.hookUrl") || "").trim(), key: (LS.get("jcd.hookKey") || "").trim() }; }
function hookReady() { const h = hookCfg(); return /^https:\/\//i.test(h.url) && !!h.key; }
function hookStatus() {
  const el = $("hookState"); if (!el) return; const h = hookCfg();
  if (hookReady()) el.textContent = "Instant routing is on. The key is saved on this device (hidden).";
  else if (h.url || h.key) el.textContent = "Saved on this device, but both the URL and the key are needed.";
  else el.textContent = "Not set. Paste the routine's webhook URL and sender key to pass jobs to the crew at once.";
}
async function pingRouter(item) {
  if (S.suspended) return { instant: "unset" };
  if (!hookReady()) return { instant: "unset" };
  const h = hookCfg(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(h.url, { method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + h.key },
      body: JSON.stringify({ event: "inbox-new", id: item && item.id, routedTo: (item && item.routedTo) || null }) });
    if (r.ok) return { instant: "ok" };
    return { instant: "failed", error: "HTTP " + r.status };
  } catch (e) {
    const msg = e && e.name === "AbortError" ? "timed out" : ((e && e.message) || "Failed to fetch");
    return { instant: "failed", error: msg };
  } finally { clearTimeout(to); }
}
function instantLine(name, instant, confirmed) {
  if (confirmed === false) return (name ? ("I queued that for " + name + ", ") : "It's queued, ") + "but I couldn't confirm it in the Inbox yet.";
  if (instant === "ok") return name ? (name + " has it now.") : "It's being routed now.";
  if (instant === "failed") return name ? (name + " is queued.") : "It's queued.";
  return "queued; add the instant link in Settings.";
}
function routeChip(m) {
  const r = m.route; if (!r) return "";
  const who = r.i > 0 ? "→ " + chip(r.i) + " " : "";
  let label = "not queued";
  if (r.ok) {
    if (r.instant === "ok") label = r.i > 0 ? "sent to " + ROSTER[r.i].name + " now" : "sent now";
    else if (r.instant === "failed") label = "queued (instant link blocked by browser)";
    else label = "queued, instant link not set";
  }
  const tip = r.hookErr ? ` title="${esc(r.hookErr)}"` : "";
  const jq = r.ok && r.id ? `<div class="jq ${r.confirmed ? "ok" : "warn"}">Jobs queued · ${r.confirmed ? "in Inbox" : "not in Inbox yet"}</div>` : "";
  return `<div class="rt"${tip}><div class="rt-row">${who}<span>${label}</span></div>${jq}</div>`;
}


function noteUrl(id) { const c = conn(); return `${c.base}/context-sets/${encodeURIComponent(c.set)}/notes/${encodeURIComponent(id)}`; }
async function sbGet(id) {
  if (S.suspended) throw new Error("locked");
  const t = token(), c = conn(); if (!t) throw new Error("no token"); if (!okBase(c.base) || !c.set || !id) throw new Error("connection details missing");
  const r = await fetch(noteUrl(id), { headers: { Authorization: "Bearer " + t }, cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status); const d = await r.json(); const n = d.note || d; return { n, etag: r.headers.get("ETag") };
}
function sbJson(md) { const m = /```json\s*([\s\S]*?)```/.exec(md || ""); return JSON.parse(m ? m[1] : md); }
function sbMd(md, obj) { const j = "```json\n" + JSON.stringify(obj, null, 2) + "\n```"; return /```json[\s\S]*?```/.test(md) ? md.replace(/```json[\s\S]*?```/, () => j) : md + "\n\n" + j + "\n"; }
async function sbAppend(text, routedTo = null) {
  if (S.suspended) throw new Error("locked");
  const t = token(), c = conn(); if (!t) throw new Error("no token");
  for (let i = 0; i < 4; i++) {
    const { n, etag } = await sbGet(c.inbox); if (!etag) throw new Error("no ETag from Second Brain"); const o = sbJson(n.markdown); o.requests = Array.isArray(o.requests) ? o.requests : [];
    const item = { id: "r" + Date.now().toString(36), createdAt: new Date().toISOString(), text, status: "new", routedTo, reply: null, repliedAt: null };
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

// ---------- state ----------
const S = { inbox: [], bots: [], botByIdx: {}, at: 0, err: null, polling: false, selected: null, firstPoll: true, freshIds: new Set(), suspended: false };
let deck = null;
let seen = {}; try { seen = JSON.parse(LS.get("jcd.seen") || "{}") || {}; } catch {}

// ---------- toasts ----------
function toast(html, ms = 4200) { const t = document.createElement("div"); t.className = "toast glass"; t.innerHTML = html; $("toasts").appendChild(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 520); }, ms); }

// ---------- polling ----------
let pollTimer = null, backoff = 0, pollChain = Promise.resolve();
async function poll() {
  if (S.suspended) return;
  const p = pollChain.then(pollOnce, pollOnce);
  pollChain = p.catch(() => {});
  return p;
}
async function pollOnce() {
  if (S.suspended) return;
  const c = conn();
  S.polling = true;
  try {
    const [a, b] = await Promise.all([sbGet(c.status), sbGet(c.inbox)]);
    const st = sbJson(a.n.markdown), ib = sbJson(b.n.markdown);
    S.bots = Array.isArray(st.bots) ? st.bots : []; S.inbox = Array.isArray(ib.requests) ? ib.requests : []; S.at = Date.now(); S.err = null; backoff = 0;
    ingest();
  } catch (e) { S.err = e.message; backoff = Math.min(backoff + 1, 4); }
  S.polling = false; renderAll();
  clearTimeout(pollTimer); if (!S.suspended) pollTimer = setTimeout(() => { poll(); }, POLL_MS * (1 + backoff));
}
async function confirmQueued(id) {
  if (!id || !token()) return false;
  try { await poll(); return S.inbox.some(r => r && r.id === id); }
  catch { return false; }
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
  el.innerHTML = list.map(r => { const bi = botIndex(r.routedTo), c = bi >= 0 ? ROSTER[bi].color : "#5fd4e8";
    return `<div class="card ${S.freshIds.has(r.id) ? "fresh" : ""}" style="--c:${c}"><div class="t">${esc(r.text)}</div>${stepper(r.status)}
      <div class="meta"><span>${esc(ago(r.createdAt))}</span>${bi >= 0 ? "<span>→</span>" + chip(bi) : r.routedTo ? "<span>→ " + esc(r.routedTo) + "</span>" : ""}</div>
      ${r.reply ? `<div class="reply">${esc(r.reply)}</div>` : ""}</div>`; }).join("");
}
function renderCrew() {
  $("crew").innerHTML = ROSTER.map((b, i) => { const s = S.botByIdx[i], st = s ? stateOf(s.state) : "unknown";
    return `<div class="crow ${S.selected === i ? "sel" : ""}" data-sel="${i}" style="--c:${b.color}"><div class="orb"></div><div><div class="nm">${esc(b.name)}</div><div class="rl">${esc(b.title)}</div></div><span class="st stt ${st}">${stateLabel(st)}</span></div>`; }).join("");
}
function renderRouter() {
  $("routerInfo").innerHTML = hookReady()
    ? "INSTANT ROUTING · jobs go to the crew as soon as they're queued"
    : `INSTANT ROUTING · not set · <a href="#" data-open="settings">add the instant link in Settings</a>`;
}
function renderDossier() {
  const i = S.selected, el = $("dossier"), panel = $("right");
  if (i == null) { panel.classList.remove("open"); return; }
  const b = ROSTER[i], s = S.botByIdx[i], st = s ? stateOf(s.state) : "unknown";
  const reqs = S.inbox.filter(r => botIndex(r.routedTo) === i).slice().reverse().slice(0, 5);
  el.innerHTML = `<div class="dh" style="--c:${b.color}"><div class="orb"></div><div><h3>${esc(b.name.toUpperCase())}</h3><p>${esc(b.title)}</p></div></div>
    <span class="stt ${st}">${stateLabel(st)}</span>
    <div class="dbox"><h5>Live status line</h5><div class="ln">${s ? esc(s.note || "—") : (token() ? "No status line for this bot in Second Brain yet." : "Link Second Brain in Settings to see live status.")}</div>${s && s.updatedAt ? `<div class="sm">Updated ${esc(fmtTime(s.updatedAt))}</div>` : ""}</div>
    ${i === 0 ? `<div class="dbox"><h5>Routing</h5><div class="ln">Every message you send here lands in Jarvis's inbox. With the instant link in Settings, it's passed to the right bot straight away. Without it, the request is queued until the link is added.</div></div>`
      : `<div class="dbox"><h5>Recent requests via Jarvis</h5>${reqs.length ? reqs.map(r => `<div class="mini">${esc(r.text)}<div class="sm">${esc(r.status)} · ${esc(ago(r.createdAt))}</div></div>`).join("") : `<div class="ln muted">None yet.</div>`}</div>`}
    <button class="btn dact" id="briefBtn">${i === 0 ? "Brief Jarvis" : "Ask Jarvis to brief " + esc(b.name)}</button>`;
  panel.classList.add("open");
  $("briefBtn").onclick = () => { const inp = $("cmdIn"); inp.value = i === 0 ? "" : `For ${b.name}: `; inp.focus(); if (mobileQ.matches) closeLeft(); };
}
function renderAll() { renderLink(); renderFeed(); renderCrew(); renderRouter(); renderDossier(); shift(); if (typeof renderNote === "function" && !D.mode) renderNote(); }

// ---------- selection & panels ----------
function select(i) { S.selected = i; if (deck) deck.select(i, true); if (i != null && mobileQ.matches) closeLeft(); renderCrew(); renderDossier(); shift(); }
function shift() { if (!deck) return; const L = $("left").classList.contains("open"), R = $("right").classList.contains("open"); deck.setShift(mobileQ.matches ? 0 : (L ? 130 : 0) - (R ? 130 : 0)); }
function openLeft(tab) { $("left").classList.add("open"); document.body.classList.add("leftopen"); setTab(tab || "talk"); setTimeout(shift); if (mobileQ.matches && S.selected != null) select(null); renderCaption(); }
function closeLeft() { setTimeout(shift); $("left").classList.remove("open"); document.body.classList.remove("leftopen"); for (const k in TABS) $(TABS[k]).classList.remove("on"); renderCaption(); }
const TABS = { talk: "talkTabBtn", feed: "feedBtn", crew: "crewBtn" };
function setTab(t) { document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.tab === t)); for (const k in TABS) { $("tab-" + k).hidden = t !== k; $(TABS[k]).classList.toggle("on", $("left").classList.contains("open") && t === k); } if (t === "talk") scrollDialog(); }
document.addEventListener("click", e => {
  const s = e.target.closest("[data-sel]"); if (s) { select(+s.dataset.sel); return; }
  const o = e.target.closest("[data-open]"); if (o) openSettings();
});
document.querySelectorAll(".tab").forEach(b => b.onclick = () => setTab(b.dataset.tab));
const toggleLeft = tab => { const L = $("left"); if (L.classList.contains("open") && !$("tab-" + tab).hidden) closeLeft(); else openLeft(tab); };
$("feedBtn").onclick = () => toggleLeft("feed"); $("crewBtn").onclick = () => toggleLeft("crew"); $("talkTabBtn").onclick = () => toggleLeft("talk");
$("leftClose").onclick = closeLeft; $("dossClose").onclick = () => select(null);
$("linkPill").onclick = () => token() ? poll() : openSettings();

S.justSent = new Set();
// ---------- settings ----------
function openSettings() {
  const c = conn(), src = tokenSource();
  $("tokState").textContent = src === "deck" ? "A token is saved on this device (hidden)." : src === "hud" ? "Using the Jarvis HUD's token on this device (hidden). Save one here to override." : "No token saved. Paste your Second Brain token to link the deck.";
  $("tokIn").value = ""; $("cBase").value = c.base; $("cSet").value = c.set; $("cInbox").value = c.inbox; $("cStatus").value = c.status; $("cHist").value = c.hist; $("cStyle").value = c.style; settingsVoice();
  $("connState").textContent = c.fromHud ? "Filled in from the Jarvis HUD on this device." : (c.base ? "Saved on this device." : "Enter the API base, context set and the two note ids.");
  $("connDet").open = !c.base; $("qSel").value = LS.get("jcd.quality") || "auto"; $("motionChk").checked = LS.get("jcd.reduced") === "1";
  $("hookUrl").value = hookCfg().url; $("hookKey").value = ""; hookStatus();
  $("verTag").textContent = "Command Deck v" + VERSION + (deck ? " · render tier " + deck.tierName : "");
  $("lockAfter").value = String(getIdleMinutes());
  $("lockSetState").textContent = hasPin() ? "A PIN is set on this device. Auto-lock uses the interval below." : "No PIN is set yet.";
  $("lockChangeForm").hidden = true; $("lockCur").value = ""; $("lockN1").value = ""; $("lockN2").value = ""; $("lockChangeState").textContent = "";
  $("settings").hidden = false;
}
$("setBtn").onclick = openSettings; $("setClose").onclick = () => $("settings").hidden = true;
$("settings").addEventListener("click", e => { if (e.target.id === "settings") $("settings").hidden = true; });
$("tokSave").onclick = () => { const v = $("tokIn").value.trim(); if (!v) return; LS.set("jcd.tok", v); $("tokIn").value = ""; $("tokState").textContent = "Token saved on this device (hidden)."; S.err = null; poll(); };
$("tokForget").onclick = () => { LS.del("jcd.tok"); $("tokState").textContent = tokenSource() === "hud" ? "Deck token forgotten. The HUD's token on this device is still used." : "Token forgotten."; S.inbox = []; S.bots = []; S.at = 0; ingest(); renderAll(); if (token()) poll(); };
$("connSave").onclick = () => { const o = { base: $("cBase").value.trim(), set: $("cSet").value.trim(), inbox: $("cInbox").value.trim(), status: $("cStatus").value.trim(), hist: $("cHist").value.trim(), style: $("cStyle").value.trim() }; D.style = null;
  if (o.base && !okBase(o.base)) { $("connState").textContent = "API base must be an https:// URL."; return; } LS.set("jcd.conn", JSON.stringify(o)); $("connState").textContent = "Saved on this device."; poll(); };
$("connTest").onclick = async () => { $("connState").textContent = "Testing…"; try { const c = conn(); await sbGet(c.status); await sbGet(c.inbox); $("connState").textContent = "Link OK: both notes readable."; } catch (e) { $("connState").textContent = "Link failed: " + e.message; } };
$("hookSave").onclick = () => {
  const url = $("hookUrl").value.trim(), key = $("hookKey").value.trim();
  if (url && !/^https:\/\//i.test(url)) { $("hookState").textContent = "Webhook URL must be an https:// URL."; return; }
  if (url) LS.set("jcd.hookUrl", url); else LS.del("jcd.hookUrl");
  if (key) { LS.set("jcd.hookKey", key); $("hookKey").value = ""; }
  hookStatus(); renderRouter(); renderDossier(); renderNote();
  if (hookCfg().url || hookCfg().key) {
    toast("Instant link saved on this device");
    const st = $("hookState");
    st.classList.remove("flash");
    void st.offsetWidth;
    st.classList.add("flash");
    setTimeout(() => st.classList.remove("flash"), 1600);
  }
};
$("hookForget").onclick = () => { LS.del("jcd.hookUrl"); LS.del("jcd.hookKey"); $("hookUrl").value = ""; $("hookKey").value = ""; hookStatus(); renderRouter(); renderDossier(); renderNote(); };
$("qSel").onchange = e => { LS.set("jcd.quality", e.target.value); toast("Reloading with new visual quality…", 1500); setTimeout(() => location.reload(), 700); };
$("motionChk").onchange = e => { LS.set("jcd.reduced", e.target.checked ? "1" : "0"); setTimeout(() => location.reload(), 300); };

$("lockAfter").onchange = e => setIdleMinutes(e.target.value);
$("lockNowBtn").onclick = () => { $("settings").hidden = true; lockNow(); };
$("lockChangeBtn").onclick = () => { $("lockChangeForm").hidden = !$("lockChangeForm").hidden; $("lockChangeState").textContent = ""; };
$("lockChangeSave").onclick = async () => {
  const cur = $("lockCur").value, a = $("lockN1").value, b = $("lockN2").value;
  if (a !== b) { $("lockChangeState").textContent = "New PINs don't match."; return; }
  const r = await changePin(cur, a);
  if (!r.ok) { $("lockChangeState").textContent = r.error; return; }
  $("lockCur").value = ""; $("lockN1").value = ""; $("lockN2").value = "";
  $("lockChangeForm").hidden = true;
  $("lockChangeState").textContent = "PIN changed on this device.";
  $("lockSetState").textContent = "PIN changed. Auto-lock uses the interval below.";
};
$("lockResetBtn").onclick = () => {
  if (confirm("Reset this deck? This clears every key and setting saved on this device, including the Second Brain token, the instant-routing link, and the xAI key. Then you'll set a new PIN. Notes in Second Brain are not changed.")) resetDeck();
};
document.addEventListener("keydown", e => { if (e.key === "Escape") { if (!$("settings").hidden) $("settings").hidden = true; else if (S.selected != null) select(null); else closeLeft(); } if (e.key === "/" && document.activeElement !== $("cmdIn") && $("settings").hidden) { e.preventDefault(); $("cmdIn").focus(); } });

// ---------- v2: live conversational voice loop ----------
// Instant replies use xAI with the key the Jarvis HUD already stores on this origin ("jarvis.key").
const XAI_URL = "https://api.x.ai/v1/responses";
const DEFAULT_MODEL = "grok-4.20-0309-non-reasoning";
const xkey = () => LS.get("jarvis.key") || "";
const xmodel = () => LS.get("jcd.model") || LS.get("jarvis.chatmodel8") || DEFAULT_MODEL;
const pref = (k, d) => { const v = LS.get("jcd." + k); return v == null ? d : v === "1"; };
const keyish = x => /xai-[A-Za-z0-9]{10,}|Bearer\s+\S{10,}|AIza[0-9A-Za-z_\-]{20,}|gh[opsu]_[A-Za-z0-9]{20,}/.test(x);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isAndroid = /Android/i.test(navigator.userAgent);
const DEV = LS.get("jcd.dev") || (() => { const d = (mobileQ.matches ? "Phone-" : "Desktop-") + Math.random().toString(36).slice(2, 6); LS.set("jcd.dev", d); return d; })();
const D = { log: [], hist: [], mode: null, talk: false, interim: "", style: null, styleAt: 0, thinking: false, quietMisses: 0 };
try { D.log = JSON.parse(LS.get("jcd.dialog") || "[]") || []; } catch {}
function saveLog() { D.log = D.log.slice(-60); LS.set("jcd.dialog", JSON.stringify(D.log)); }
function addMsg(who, text, extra) { const m = Object.assign({ id: rid(), who, text: String(text || ""), at: new Date().toISOString() }, extra || {}); D.log.push(m); saveLog(); renderDialog(); return m; }

// ----- dialogue rendering -----
function bubble(m) {
  if (m.who === "sys") return `<div class="bub sys">${esc(m.text)}</div>`;
  const me = m.who === "me", rt = routeChip(m);
  return `<div class="bub ${me ? "me" : "jv"}"><span class="who">${me ? "Commander" : "Jarvis"}</span>${esc(m.text)}${rt}</div>`;
}
const liveBubbles = () => (D.interim ? `<div class="bub me interim"><span class="who">Commander · live</span>${esc(D.interim)}</div>` : "") +
  (D.thinking ? `<div class="bub jv thinking"><span class="who">Jarvis</span><span class="dots"><i></i><i></i><i></i></span></div>` : "");
function scrollDialog() { const b = $("tab-talk"); if (b) b.scrollTop = b.scrollHeight; }
function renderDialog() {
  const el = $("dialog"); if (!el) return;
  const items = D.log.slice(-40);
  el.innerHTML = (items.length || D.interim || D.thinking) ? items.map(bubble).join("") + liveBubbles()
    : `<div class="empty"><b>VOICE LINK READY</b>${SRc ? "Tap the mic to speak, hold it (or press TALK) for a hands-free conversation." : "Type below to talk to Jarvis. (Voice input isn't supported in this browser.)"}${xkey() ? "" : `<div style="margin-top:10px">Instant replies need an xAI key. <button class="btn" data-open="settings" style="margin-top:10px">Add key in Settings</button></div>`}</div>`;
  scrollDialog(); renderCaption();
}
let capTimer = null;
function renderCaption() {
  const el = $("caption"); if (!el) return; clearTimeout(capTimer);
  if ($("left").classList.contains("open")) { el.innerHTML = ""; return; }
  const last = D.log.slice(-2).filter(m => m.who !== "sys"), fresh = last.length && Date.now() - new Date(last[last.length - 1].at) < 14000;
  let html = "";
  if (D.mode || D.interim || D.thinking || fresh) {
    const tail = D.interim || D.thinking ? last.slice(-1).filter(m => m.who === "jv") : last;
    html = tail.map(bubble).join("") + liveBubbles();
  }
  el.innerHTML = html; if (html && !D.mode) capTimer = setTimeout(renderCaption, 14500);
}

// ----- mood (core reacts) -----
function renderNote() {
  const n = $("cmdNote"); n.classList.remove("mood");
  const lbl = { listening: "● Listening…", thinking: "◆ Jarvis is thinking…", speaking: "◉ Jarvis is speaking · tap mic to interrupt" }[D.mode];
  if (lbl) { n.classList.add("mood"); n.textContent = lbl + (D.talk ? "  ·  Talk mode on" : ""); return; }
  n.innerHTML = xkey()
    ? `Jarvis replies instantly.<span class="long"> Jobs for the crew go to Jarvis's inbox and are passed on at once if the instant link is set in Settings.</span><span class="short"> Crew jobs: passed on instantly if the link is set.</span>`
    : `<b>No xAI key</b>: messages go to Jarvis's inbox; add the instant link in Settings so they're passed on at once. <a href="#" data-open="settings" style="color:#5fd4e8">Add a key</a> for instant replies.`;
}
function setMode(m) {
  D.mode = m || null; ["listening", "thinking", "speaking"].forEach(k => document.body.classList.toggle("m-" + k, D.mode === k));
  if (deck) deck.setMood(D.mode); renderNote(); renderCaption();
}

// ----- persona: Jarvis Voice & Style note (if its id is set), cached 10 min -----
async function loadStyle() {
  const c = conn(); if (!c.style || !token()) return null;
  if (D.style && Date.now() - D.styleAt < 600000) return D.style;
  try { const { n } = await sbGet(c.style); D.style = String(n.markdown || "").slice(0, 5000); D.styleAt = Date.now(); } catch { }
  return D.style;
}
function crewBrief() {
  return ROSTER.slice(1).map((b, k) => { const s = S.botByIdx[k + 1]; return `- ${b.name}: ${b.title}${s ? ` · ${stateLabel(stateOf(s.state))}: ${String(s.note || "").slice(0, 90)}` : ""}`; }).join("\n");
}
async function systemPrompt() {
  const style = await loadStyle();
  const now = new Date().toLocaleString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
  return (style ? "Your own Voice & Style notes (follow them):\n" + style + "\n\n" : "You are Jarvis, the user's chief of staff: calm, British, short and precise, with a little dry humour.\n\n") +
`You are speaking through the Jarvis Command Deck, a live voice link. It is a HUD surface, so use the user's name only when it adds something.
Reply in one to three short spoken sentences: plain natural speech with contractions, no markdown, lists, symbols, emoji or URLs.
You cannot act on accounts or message bots directly from here. When a request is a job for one specialist on the crew below, set route to a non-null object with that bot's exact crew name and a short task brief; the deck then adds it to your Second Brain inbox addressed to that bot. Answer chat, quick questions and anything you can handle yourself with route null. Never claim a job is done or started. Never say "route sent", "passed on", "queued", "I've passed", "I'll pass", "sent to", "routed" or similar yourself — the deck appends the real outcome line after it actually queues the job. In the spoken reply, just say briefly what that bot will be asked to do, without claiming it has already been sent. Do not say when the bot will pick it up.
Crew (name: role · live status snapshot, may be out of date):
${crewBrief()}
Current date and time: ${now} (Europe/London).
Respond with ONLY a JSON object and nothing else:
{"reply": "<what you say aloud>", "route": {"bot": "<exact crew name>", "task": "<one-line brief for that bot with the needed detail>"} }
or {"reply": "...", "route": null}`;
}
function firstJsonObject(t) {
  const a = String(t || "").indexOf("{"); if (a < 0) return null;
  let d = 0, str = false, esc = false;
  for (let i = a; i < t.length; i++) {
    const c = t[i];
    if (str) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') { str = true; continue; }
    if (c === "{") d++;
    else if (c === "}") { d--; if (d === 0) return t.slice(a, i + 1); }
  }
  return null;
}
function routeName(o) {
  if (o == null) return "";
  if (typeof o === "string") return o;
  if (typeof o === "object") return o.bot || o.routedTo || o.to || o.name || "";
  return "";
}
function routeFrom(o) {
  if (!o || o.route === null) return null;
  const name = routeName(o.route) || routeName({ bot: o.bot, routedTo: o.routedTo, to: o.to });
  const task = (o.route && typeof o.route === "object" && (o.route.task || o.route.text)) || o.task || "";
  const i = botIndex(name); return i > 0 ? { i, task: String(task || "").trim() } : null;
}
function claimingHandoff(text) {
  const t = String(text || "");
  if (/\b(?:route sent|passed on|i(?:'ve| have) passed|i(?:'ll| will) pass|sent to|queued|routed)\b/i.test(t)) return true;
  return /\b(?:pass(?:ing|ed)?|rout(?:e|ed|ing)|send(?:ing)?|sent|hand(?:ing|ed)?)\b[\s\S]{0,100}?\bto\s+[A-Za-z]/i.test(t);
}
function mentionedCrew(text) {
  const names = ROSTER.slice(1).map(b => b.name).sort((a, b) => b.length - a.length);
  const re = new RegExp("\\b(" + names.join("|") + ")\\b", "gi");
  const found = []; let m;
  while ((m = re.exec(String(text || "")))) {
    const i = botIndex(m[1]);
    if (i > 0 && !found.some(f => f.i === i)) found.push({ i, name: ROSTER[i].name, at: m.index });
  }
  return found;
}
function inferHandoff(reply, userText) {
  const t = String(reply || ""), task = String(userText || "").trim();
  const names = mentionedCrew(t);
  if (names.length) {
    const cue = /\b(?:was |is |has been |have been |will be |will |'s |’s )?(?:handl(?:e|es|ed|ing)|check(?:s|ed|ing)?(?:\s+(?:in\s+)?with)?|ask(?:s|ed|ing)?)\b/i;
    const pass = /\b(?:pass(?:ing|ed)?|rout(?:e|ed|ing)|send(?:ing)?|sent|hand(?:ing|ed)?(?:\s+over)?|queue(?:d|ing)?)\b/i;
    for (const n of names) {
      const win = t.slice(Math.max(0, n.at - 90), n.at + n.name.length + 90);
      if (cue.test(win) || pass.test(win) || /\bto\s+$/i.test(t.slice(Math.max(0, n.at - 16), n.at))) return { i: n.i, task };
    }
    if (/\broute sent\b|\bqueued\b|\bpassed on\b|\brouted\b|\bsent to\b/i.test(t)) return { i: names[0].i, task };
  }
  if (!claimingHandoff(t)) return null;
  const re = /\bto\s+([A-Za-z][A-Za-z ·-]{0,40})/gi; let m;
  while ((m = re.exec(t))) { const i = botIndex(m[1]); if (i > 0) return { i, task }; }
  return null;
}
function stripRouteClaims(reply) {
  let t = String(reply || "");
  t = t.replace(/\broute sent\b/gi, "");
  t = t.replace(/\bi(?:'ve| have) (?:already )?(?:passed(?: it| that| this)?(?: on)?(?: to [^.?!,]*)?|routed(?: it| that| this)?(?: to [^.?!,]*)?|queued(?: it| that| this)?(?: for [^.?!,]*)?|sent(?: it| that| this)?(?: on)?(?: to [^.?!,]*)?)\b/gi, "");
  t = t.replace(/\bi(?:'ll| will) (?:pass(?: that| it| this)?(?: on)?|route|queue|send)(?:\s+(?:that|it|this))?(?:\s+on)?(?:\s+to [^.?!,]*)?/gi, "");
  t = t.replace(/\b(?:i(?:'ve| have) )?sent(?: it| that| this)? to [A-Za-z][A-Za-z ·-]*\b/gi, "");
  t = t.replace(/\b(?:it(?:'s| is| has been| was)? )?(?:being )?(?:queued|routed(?: to [A-Za-z][A-Za-z ·-]*)?)\b/gi, "");
  t = t.replace(/\bpassed on\b/gi, "");
  t = t.replace(/\brouted\b/gi, "");
  t = t.replace(/[ \t]+/g, " ").replace(/ +([,;:!?])/g, "$1").replace(/\s*\.\s*(?=\.)/g, "").replace(/(?:^|[.!?])\s*[.,;:]+/g, m => /^[.!?]/.test(m) ? m.charAt(0) : "");
  return t.replace(/^[,;.\s]+/, "").replace(/\s+/g, " ").trim();
}
function withoutHandoffClaim(reply) {
  const t = stripRouteClaims(reply);
  if (t) return t;
  if (claimingHandoff(reply)) return "I haven't sent that to a crew member yet. Please say it again and I'll make sure it goes through.";
  return reply;
}
function userHasTask(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  const deckTalk = /\b(instant link|webhook|command deck|this deck|settings webhook)\b/i.test(t)
    || (/^\s*(why|how|what)\b/i.test(t) && /\b(link|route|routing|queue|queued|webhook|fail|failing|blocked)\b/i.test(t));
  const hasAction = /\b(please|can you|could you|would you|i need|i want you to|ask |tell |check |get |fetch |send |draft |write |make |fix |look(?:ing)? at|review |handle |prepare |pull |find |schedule |book |remind |update |create )\b/i.test(t)
    || /^(check|get|fetch|send|draft|write|make|fix|review|handle|prepare|find|schedule|book|remind|update|create|add)\b/i.test(t);
  if (deckTalk && !hasAction) return false;
  if (deckTalk && !/\b(ask |tell |pass |route |send (?:this|that|it) to)\b/i.test(t) && !mentionedCrew(t).length) return false;
  if (hasAction) return true;
  if (/^(ok|okay|thanks|thank you|cheers|right|yes|no|yep|nope|got it|and|what|why|how)[.!?]*$/i.test(t)) return false;
  return false;
}
function parseReply(raw, userText) {
  let t = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const js = firstJsonObject(t);
  let reply = "", route = null;
  if (js) { try { const o = JSON.parse(js); reply = String(o.reply || "").trim(); route = routeFrom(o); } catch { } }
  if (!reply) reply = t.replace(/[{}"]/g, "").trim();
  if (!route) route = inferHandoff(reply, userText) || inferHandoff(t, userText);
  if (route && !userHasTask(userText)) route = null;
  return { reply, route };
}
async function askJarvis(text) {
  if (S.suspended) throw new Error("locked");
  const input = [{ role: "system", content: await systemPrompt() }, ...D.hist.slice(-8), { role: "user", content: text }];
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch(XAI_URL, { method: "POST", signal: ctl.signal, headers: { Authorization: "Bearer " + xkey(), "Content-Type": "application/json" },
      body: JSON.stringify({ model: xmodel(), input, max_output_tokens: 400, store: false }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((d.error && (d.error.message || d.error)) || ("HTTP " + r.status));
    const out = d.output_text || (d.output || []).filter(o => o.type === "message").flatMap(o => o.content || []).filter(x => x.type === "output_text").map(x => x.text).join(" ");
    return parseReply(out, text);
  } finally { clearTimeout(to); }
}

// ----- one exchange: Commander -> Jarvis (-> optional route to a bot) -----
let convBusy = false;
async function converse(text, spoken) {
  text = String(text || "").trim(); if (!text || convBusy || S.suspended) return;
  if (keyish(text)) { toast("That looks like a key or token, so I haven't sent it anywhere."); return; }
  convBusy = true; $("sendBtn").disabled = true; addMsg("me", text);
  const speakIt = spoken || pref("speakTyped", true);
  try {
    if (!xkey()) { // fallback: queue in the inbox (and ping instant routing if set)
      let reply, route = null;
      if (!token()) reply = "I can't reply instantly without an xAI key, and Second Brain isn't linked either. Add both in Settings.";
      else { try { const item = await sbAppend(text); markSent(item); deck && deck.intake();
          const ping = await pingRouter(item); const confirmed = await confirmQueued(item.id);
          route = { i: -1, ok: true, instant: ping.instant, hookErr: ping.error, id: item.id, confirmed };
          reply = "No instant replies without an xAI key, so I've added that to my inbox. " + instantLine(null, ping.instant, confirmed); }
        catch (e) { reply = "I couldn't add that to my inbox just now (" + e.message + ")."; } }
      addMsg("jv", reply, route ? { route } : null); if (speakIt) speak(reply); else setMode(null); return;
    }
    D.thinking = true; setMode("thinking"); renderDialog();
    let res; try { res = await askJarvis(text); }
    catch (e) { D.thinking = false; renderDialog(); const msg = e.name === "AbortError" ? "timed out" : e.message;
      addMsg("sys", "Jarvis couldn't reply (" + msg + ")."); if (speakIt) speak("Sorry, I couldn't reach my reply service just then."); else setMode(null); return; }
    D.thinking = false;
    let reply = res.reply || "Understood.", route = null;
    if (res.route) {
      const i = res.route.i, name = ROSTER[i].name; deck && deck.fire(i, "out"); route = { i, ok: false };
      if (!token()) reply = [withoutHandoffClaim(reply), "Second Brain isn't linked on this device, so " + name + " hasn't got it yet."].filter(Boolean).join(" ");
      else try { const item = await sbAppend(res.route.task || text, name); markSent(item); route.ok = true; route.id = item.id;
          const ping = await pingRouter(item); route.instant = ping.instant; route.hookErr = ping.error;
          route.confirmed = await confirmQueued(item.id);
          reply = [withoutHandoffClaim(reply), instantLine(name, route.instant, route.confirmed)].filter(Boolean).join(" "); }
        catch (e) { reply = [withoutHandoffClaim(reply), "I couldn't add it to my inbox just now, so " + name + " hasn't got it yet."].filter(Boolean).join(" "); }
    } else reply = withoutHandoffClaim(reply);
    D.hist.push({ role: "user", content: text }, { role: "assistant", content: reply }); D.hist = D.hist.slice(-12);
    addMsg("jv", reply, route ? { route } : null);
    logHistory(text, reply);
    if (speakIt) speak(reply); else setMode(null);
  } finally { convBusy = false; $("sendBtn").disabled = false; D.thinking = false; }
}
function markSent(item) { S.justSent.add(item.id); seen[item.id] = "new"; LS.set("jcd.seen", JSON.stringify(seen)); }

// ----- History note logging (same entry format as the HUD) -----
const hEsc = x => String(x || "").replace(/\s+/g, " ").trim().replace(/[\\`*_#<>\[\]|~]/g, "\\$&").replace(/^([-+=]|\d+\.)/, "\\$1");
const hWhen = t => { const p = {}; new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(new Date(t)).forEach(x => p[x.type] = x.value); return `${p.weekday} ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} ${p.timeZoneName}`; };
const histQ = [];
async function logHistory(q, a) {
  if (!pref("hist", true) || keyish(q + " " + a)) return;
  histQ.push({ id: "d" + rid(), at: new Date().toISOString(), q, a }); flushHistory();
}
let histBusy = false;
async function flushHistory() {
  if (S.suspended) return;
  const c = conn(); if (histBusy || !histQ.length || !token() || !c.hist) return; histBusy = true;
  try {
    for (let i = 0; i < 4 && histQ.length; i++) {
      const { n, etag } = await sbGet(c.hist); if (!etag) throw new Error("no ETag");
      const who = hEsc(hudCfg().name || "You"), entries = histQ.map(e => `## ${hWhen(e.at)} · Command Deck\n<!-- id:${e.id} at:${e.at} dev:${DEV.replace(/[^\w-]/g, "")} -->\n\n**${who}:** ${hEsc(e.q)}\n\n**Jarvis:** ${hEsc(e.a)}\n`).join("\n---\n\n");
      let md = String(n.markdown || "").replace(/\s+$/, ""); md += (/^## /m.test(md) ? "\n\n---\n\n" : "\n\n") + entries;
      while (md.length > 190000) { const a = md.search(/^## /m), b = md.indexOf("\n## ", a + 3); if (a < 0 || b < 0) break; md = md.slice(0, a) + md.slice(b + 1); }
      const r = await fetch(noteUrl(c.hist), { method: "PATCH", headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json", "If-Match": etag, "X-Second-Brain-Agent": WRITE_AGENT },
        body: JSON.stringify({ title: n.title, summary: n.summary || "", markdown: md }) });
      if (r.status === 409 || r.status === 412) continue; if (!r.ok) throw new Error("HTTP " + r.status);
      histQ.length = 0;
    }
  } catch (e) { console.warn("history log failed:", e.message); }
  histBusy = false;
}

// ----- text-to-speech (browser voices, British male preferred) -----
const TTS = { gen: 0, timer: null, lastB: 0, safety: null };
const synth = window.speechSynthesis || null;
function voices() { try { return synth ? synth.getVoices() : []; } catch { return []; } }
function pickVoice() {
  const vs = voices(), want = LS.get("jcd.voice"); if (want) { const v = vs.find(x => x.voiceURI === want || x.name === want); if (v) return v; }
  const gb = vs.filter(v => /en[-_]GB/i.test(v.lang));
  return gb.find(v => /\b(male|daniel|george|arthur|oliver|ryan|thomas|harry|james|brian)\b/i.test(v.name)) || gb.find(v => /Google UK English Male/i.test(v.name)) || gb[0] || vs.find(v => /^en/i.test(v.lang)) || null;
}
function chunks(t) { const out = []; String(t).replace(/\s+/g, " ").match(/[^.!?]+[.!?]*\s*/g)?.forEach(sn => { sn = sn.trim(); if (!sn) return; while (sn.length > 190) { let k = sn.lastIndexOf(",", 190); if (k < 60) k = sn.lastIndexOf(" ", 190); if (k < 1) k = 190; out.push(sn.slice(0, k + 1)); sn = sn.slice(k + 1).trim(); } if (sn) out.push(sn); }); return out.length ? out : [String(t)]; }
function speak(text, onDone) {
  const done = () => { clearInterval(TTS.timer); clearTimeout(TTS.safety); setMode(null); afterSpeak(); onDone && onDone(); };
  if (!synth || !text) { done(); return; }
  stopSpeaking(true); const g = ++TTS.gen, parts = chunks(text), v = pickVoice(), rate = +(LS.get("jcd.rate") || 1);
  setMode("speaking");
  parts.forEach((p, idx) => { const u = new SpeechSynthesisUtterance(p); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-GB"; u.rate = rate; u.pitch = .95;
    u.onboundary = () => { TTS.lastB = performance.now(); deck && deck.setLevel(.75 + Math.random() * .25); };
    u.onend = () => { if (g === TTS.gen && idx === parts.length - 1) done(); };
    u.onerror = ev => { if (g === TTS.gen && idx === parts.length - 1 && ev.error !== "interrupted" && ev.error !== "canceled") done(); };
    synth.speak(u); });
  // amplitude envelope: real word-boundary events where the browser fires them, a speech-like envelope otherwise
  TTS.timer = setInterval(() => { if (g !== TTS.gen) return; if (performance.now() - TTS.lastB > 260) deck && deck.setLevel(.3 + Math.random() * .45); }, 120);
  TTS.safety = setTimeout(() => { if (g === TTS.gen && D.mode === "speaking") { synth.cancel(); done(); } }, 4000 + text.length * 110 / rate);
}
function stopSpeaking(silent) { TTS.gen++; clearInterval(TTS.timer); clearTimeout(TTS.safety); try { synth && synth.cancel(); } catch { } if (!silent && D.mode === "speaking") setMode(null); }
function afterSpeak() { if (D.talk && SRc && pref("relisten", true)) setTimeout(() => { if (D.talk && !rec && !D.mode) listen(); }, 380); }
if (synth) { synth.onvoiceschanged = () => { if (!$("settings").hidden) settingsVoice(); }; voices(); }

// ----- speech recognition (Web Speech API, en-GB) + mic level meter -----
const SRc = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let rec = null, meter = null;
async function startMeter() {
  if (isAndroid || !navigator.mediaDevices || !window.AudioContext) return; // Android: avoid fighting the recogniser for the mic
  try { const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (!rec) { st.getTracks().forEach(t => t.stop()); return; }
    const ac = new AudioContext(), an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(st).connect(an); const buf = new Uint8Array(an.fftSize);
    meter = { st, ac, raf: 0 }; const tick = () => { an.getByteTimeDomainData(buf); let s = 0; for (const x of buf) { const d = (x - 128) / 128; s += d * d; } deck && deck.setLevel(Math.min(1, Math.sqrt(s / buf.length) * 5.5)); meter.raf = requestAnimationFrame(tick); }; tick();
  } catch { }
}
function stopMeter() { if (!meter) return; cancelAnimationFrame(meter.raf); meter.st.getTracks().forEach(t => t.stop()); meter.ac.close().catch(() => { }); meter = null; }
function listen() {
  if (!SRc || rec || convBusy) return; stopSpeaking(true);
  const r = rec = new SRc(); r.lang = "en-GB"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let fin = "", err = ""; D.interim = "";
  r.onstart = () => { setMode("listening"); $("micBtn").classList.add("rec"); startMeter(); };
  r.onsoundstart = () => deck && deck.setLevel(.4);
  r.onresult = ev => { let f = "", it = ""; for (let i = 0; i < ev.results.length; i++) { const x = ev.results[i]; if (x.isFinal) f += x[0].transcript; else it += x[0].transcript; } fin = f; D.interim = (f + " " + it).trim(); if (!meter) deck && deck.setLevel(.55 + Math.random() * .35); renderDialog(); };
  r.onerror = ev => { err = ev.error; if (!["aborted", "no-speech"].includes(ev.error)) toast("Mic: " + esc(ev.error === "not-allowed" ? "microphone permission is blocked" : ev.error)); };
  r.onend = () => { const txt = (fin || D.interim).trim(); rec = null; $("micBtn").classList.remove("rec"); stopMeter(); D.interim = ""; setMode(null); renderDialog();
    if (txt) { D.quietMisses = 0; converse(txt, true); return; }
    if (D.talk && err === "no-speech" && ++D.quietMisses < 3) { setTimeout(() => D.talk && !rec && !D.mode && listen(), 300); return; }
    if (D.talk && (err === "no-speech" || err === "not-allowed" || err === "audio-capture")) { setTalk(false); addMsg("sys", err === "no-speech" ? "Talk mode paused: I didn't hear anything." : "Talk mode stopped: the microphone isn't available."); }
  };
  try { r.start(); } catch (e) { rec = null; toast("Mic unavailable: " + esc(e.message)); }
}
function stopListening(abort) { if (!rec) return; try { abort ? rec.abort() : rec.stop(); } catch { } }
function setTalk(on) {
  D.talk = !!on; D.quietMisses = 0; const b = $("talkBtn"); b.classList.toggle("on", D.talk); b.setAttribute("aria-pressed", String(D.talk));
  if (D.talk) { if (mobileQ.matches) closeLeft(); toast("Talk mode on. Speak naturally; tap the mic to interrupt Jarvis.", 3000); if (!D.mode) listen(); }
  else { stopListening(true); stopSpeaking(); } renderNote();
}
(() => {
  const mic = $("micBtn"), tb = $("talkBtn");
  if (!SRc) { tb.hidden = true; return; }
  mic.hidden = false; let t0 = 0, lp = null, long = false;
  mic.addEventListener("contextmenu", e => e.preventDefault());
  mic.addEventListener("pointerdown", e => { t0 = Date.now(); long = false; clearTimeout(lp); lp = setTimeout(() => { long = true; if (navigator.vibrate) navigator.vibrate(18); setTalk(!D.talk); }, 550); });
  const up = () => { clearTimeout(lp); if (long || !t0) { t0 = 0; return; } t0 = 0;
    if (D.mode === "speaking") { stopSpeaking(); listen(); return; }            // barge-in
    if (rec) { stopListening(false); return; }
    listen(); };
  mic.addEventListener("pointerup", up); mic.addEventListener("pointercancel", () => { clearTimeout(lp); t0 = 0; });
  mic.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); t0 = Date.now(); up(); } });
  tb.onclick = () => setTalk(!D.talk);
})();
$("cmd").addEventListener("submit", e => { e.preventDefault(); const inp = $("cmdIn"), v = inp.value.trim(); if (!v || convBusy) return; inp.value = ""; if (D.mode === "speaking") stopSpeaking(); converse(v, D.talk); });

// ----- settings: voice & key -----
function settingsVoice() {
  $("xkState").textContent = xkey() ? "An xAI key is saved on this device (hidden; shared with the Jarvis HUD on this site)." : "No xAI key yet. Without one, messages are queued in Jarvis's inbox instead of answered instantly.";
  $("xkIn").value = ""; $("xModel").value = xmodel();
  const sel = $("vSel"), vs = voices(), cur = LS.get("jcd.voice") || "";
  const gb = vs.filter(v => /en[-_]GB/i.test(v.lang)), other = vs.filter(v => !/en[-_]GB/i.test(v.lang) && /^en/i.test(v.lang));
  const auto = pickVoice();
  sel.innerHTML = `<option value="">Auto · British male if available${auto ? " (" + esc(auto.name) + ")" : ""}</option>` +
    (gb.length ? `<optgroup label="British English">${gb.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)}</option>`).join("")}</optgroup>` : "") +
    (other.length ? `<optgroup label="Other English">${other.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`).join("")}</optgroup>` : "") +
    (!vs.length ? `<option disabled>${synth ? "Voices are still loading…" : "Speech output isn't supported in this browser"}</option>` : "");
  sel.value = cur; const rt = LS.get("jcd.rate") || "1"; $("vRate").value = rt; $("vRateV").textContent = (+rt).toFixed(2) + "×";
  $("relistenChk").checked = pref("relisten", true); $("speakTypedChk").checked = pref("speakTyped", true); $("histChk").checked = pref("hist", true);
}
$("xkSave").onclick = () => { const v = $("xkIn").value.trim(); if (!v) return; LS.set("jarvis.key", v); $("xkIn").value = ""; settingsVoice(); renderNote(); renderDialog(); };
$("xkForget").onclick = () => { LS.del("jarvis.key"); settingsVoice(); $("xkState").textContent = "Key forgotten on this device (this also removes it from the Jarvis HUD here)."; renderNote(); renderDialog(); };
$("xModel").onchange = e => { const v = e.target.value.trim(); if (v) LS.set("jcd.model", v); else LS.del("jcd.model"); };
$("vSel").onchange = e => { if (e.target.value) LS.set("jcd.voice", e.target.value); else LS.del("jcd.voice"); };
$("vRate").oninput = e => { LS.set("jcd.rate", e.target.value); $("vRateV").textContent = (+e.target.value).toFixed(2) + "×"; };
$("vTest").onclick = e => { e.preventDefault(); speak("Command Deck voice link online. Standing by."); };
$("relistenChk").onchange = e => LS.set("jcd.relisten", e.target.checked ? "1" : "0");
$("speakTypedChk").onchange = e => LS.set("jcd.speakTyped", e.target.checked ? "1" : "0");
$("histChk").onchange = e => LS.set("jcd.hist", e.target.checked ? "1" : "0");
setInterval(() => { if (!S.suspended && histQ.length) flushHistory(); }, 30000);
window.__talk = { converse, parseReply, inferHandoff, withoutHandoffClaim, stripRouteClaims, userHasTask, confirmQueued, setMode, speak, D };

// ---------- boot (called by the PIN lock after unlock; not on page load) ----------
export async function boot() {
  const line = $("bootLine");
  const gl = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  if (gl) {
    try {
      line.textContent = "Spinning up the core…";
      const { Deck } = await import("./scene.js?v=251");
      const reduced = LS.get("jcd.reduced") === "1" || matchMedia("(prefers-reduced-motion:reduce)").matches;
      deck = new Deck($("gl"), $("labels"), ROSTER, { quality: qs.get("quality") || LS.get("jcd.quality") || "auto", reduced, onSelect: i => select(i) });
      window.__deck = deck;
    } catch (e) { console.warn("3D init failed", e); $("nogl").hidden = false; }
  } else $("nogl").hidden = false;
  line.textContent = "Linking Second Brain…";
  renderAll(); renderDialog(); setMode(null); if (!mobileQ.matches) openLeft("talk");
  setTimeout(() => { $("boot").classList.add("gone"); document.body.classList.add("ready"); }, 500);
  if (token()) poll(); else renderAll();
  setInterval(renderRouter, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !S.suspended && token() && Date.now() - S.at > 15000) poll(); });
}

export function suspendDeck() {
  S.suspended = true;
  try { setTalk(false); } catch {}
  try { stopListening(true); } catch {}
  try { stopSpeaking(true); } catch {}
  try { stopMeter(); } catch {}
  clearTimeout(pollTimer); pollTimer = null;
  if (deck && deck.controls) deck.controls.enabled = false;
  const gl = $("gl"); if (gl) gl.style.pointerEvents = "none";
  const set = $("settings"); if (set) set.hidden = true;
}

export function resumeDeck() {
  S.suspended = false;
  if (deck && deck.controls) deck.controls.enabled = true;
  const gl = $("gl"); if (gl) gl.style.pointerEvents = "";
  bumpActivity();
  if (token()) poll();
}
