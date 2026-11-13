// Jarvis Command Deck — PIN lock. Only a salted PBKDF2 hash is stored locally. No PIN lives in source.
const ITER = 150000;
const PREFIX = "jcd.lock.";
const IDLE_OPTS = [0, 1, 5, 15, 30];
const DEFAULT_IDLE_MIN = 5;

const $ = id => document.getElementById(id);
const LS = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: k => { try { localStorage.removeItem(k); } catch {} }
};
const lkGet = k => LS.get(PREFIX + k);
const lkSet = (k, v) => LS.set(PREFIX + k, v);
const lkDel = k => LS.del(PREFIX + k);

const hex = buf => Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, "0")).join("");
const unhex = h => new Uint8Array((h || "").match(/../g).map(x => parseInt(x, 16)));

async function derive(pin, saltHex, iter) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: unhex(saltHex), iterations: iter, hash: "SHA-256" }, key, 256));
}

async function setPin(pin) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  lkSet("salt", salt);
  lkSet("iter", String(ITER));
  lkSet("hash", await derive(pin, salt, ITER));
  lkSet("len", String(pin.length));
}

async function checkPin(pin) {
  const salt = lkGet("salt"), hash = lkGet("hash");
  if (!salt || !hash) return false;
  const iter = Math.max(ITER, +(lkGet("iter") || ITER) || ITER);
  return (await derive(pin, salt, iter)) === hash;
}

export const hasPin = () => !!lkGet("hash");
export const isLocked = () => locked;
export function getIdleMinutes() {
  const v = lkGet("after");
  if (v == null || v === "") return DEFAULT_IDLE_MIN;
  const n = +v;
  return IDLE_OPTS.includes(n) ? n : DEFAULT_IDLE_MIN;
}
export function setIdleMinutes(n) {
  const v = +n;
  lkSet("after", String(IDLE_OPTS.includes(v) ? v : DEFAULT_IDLE_MIN));
}

let buf = "";
let pending = "";
let mode = "unlock"; // set | confirm | unlock
let locked = true;
let busy = false;
let lastActive = Date.now();
let hiddenAt = 0;
let started = false;
let coolTimer = 0;
let app = null;
let unlockWaiters = [];

const valid = p => /^\d{4,8}$/.test(p);

function el(id) { return $(id); }

function until() { return +(lkGet("until") || 0); }

function setMsg(text, kind) {
  const m = el("lockMsg");
  if (!m) return;
  m.textContent = text || "";
  m.dataset.kind = kind || "";
}

function renderDots() {
  const n = Math.max(4, buf.length);
  el("lockDots").innerHTML = Array.from({ length: n }, (_, i) => `<i${i < buf.length ? ' class="f"' : ""}></i>`).join("");
  const hidden = el("lockPin");
  if (hidden && hidden.value !== buf) hidden.value = buf;
}

function shake() {
  const d = el("lockDots");
  d.classList.remove("sh");
  void d.offsetWidth;
  d.classList.add("sh");
  try { navigator.vibrate && navigator.vibrate(150); } catch {}
}

function paint() {
  const heading = el("lockHeading");
  const hint = el("lockHint");
  const forgot = el("lockForgot");
  const actions = el("lockActions");
  if (mode === "set") {
    heading.textContent = "Set your PIN";
    hint.textContent = "Choose a 4 to 8 digit PIN for this device. You'll enter it twice.";
    forgot.hidden = true;
    actions.hidden = true;
  } else if (mode === "confirm") {
    heading.textContent = "Confirm your PIN";
    hint.textContent = "Enter the same PIN again.";
    forgot.hidden = true;
    actions.hidden = true;
  } else {
    heading.textContent = "Enter your PIN";
    hint.textContent = "Unlock to open the Command Deck on this device.";
    forgot.hidden = false;
    actions.hidden = false;
  }
  renderDots();
  cool();
}

function cool() {
  clearInterval(coolTimer);
  const pad = el("lockPad");
  const tick = () => {
    const remain = Math.ceil((until() - Date.now()) / 1000);
    const blocked = remain > 0;
    if (pad) pad.querySelectorAll("button").forEach(b => { b.disabled = blocked; });
    if (blocked) setMsg("Too many tries. Wait " + remain + " s", "wait");
    else {
      if (/Wait/.test(el("lockMsg")?.textContent || "")) setMsg("");
      clearInterval(coolTimer);
    }
  };
  tick();
  coolTimer = setInterval(tick, 250);
}

function showGate() {
  locked = true;
  buf = "";
  pending = "";
  document.body.classList.remove("unlocked");
  document.body.classList.add("locked");
  const root = el("lock");
  root.hidden = false;
  try { document.activeElement && document.activeElement.blur(); } catch {}
  paint();
  focusHidden();
}

function hideGate() {
  locked = false;
  buf = "";
  pending = "";
  document.body.classList.remove("locked");
  document.body.classList.add("unlocked");
  el("lock").hidden = true;
  setMsg("");
  const hidden = el("lockPin");
  if (hidden) hidden.value = "";
}

function focusHidden() {
  const hidden = el("lockPin");
  if (!hidden || !locked) return;
  // Avoid popping the on-screen keyboard over the keypad on phones.
  const coarse = matchMedia("(pointer:coarse)").matches || matchMedia("(max-width:820px)").matches;
  if (coarse) return;
  try { hidden.focus({ preventScroll: true }); } catch { try { hidden.focus(); } catch {} }
}

function markFail() {
  const f = (+(lkGet("fails") || 0)) + 1;
  lkSet("fails", String(f));
  const left = 5 - ((f - 1) % 5) - 1;
  if (f % 5 === 0) {
    const level = (+(lkGet("level") || 0)) + 1;
    lkSet("level", String(level));
    lkSet("until", String(Date.now() + 30000 * Math.pow(2, level - 1)));
    cool();
  } else {
    setMsg(left ? ("Wrong PIN · " + f + " of 5") : "Wrong PIN", "err");
  }
}

function clearFails() {
  lkSet("fails", "0");
  lkSet("level", "0");
  lkDel("until");
}

async function accept() {
  hideGate();
  lastActive = Date.now();
  clearFails();
  unlockWaiters.splice(0).forEach(fn => fn());
  if (!started) {
    started = true;
    app = await import("./app.js?v=260");
    await app.boot();
  } else if (app && app.resumeDeck) {
    app.resumeDeck();
  }
}

export function lockNow() {
  if (!hasPin()) return false;
  if (app && app.suspendDeck) app.suspendDeck();
  mode = "unlock";
  showGate();
  return true;
}

export async function changePin(current, next) {
  if (!valid(next)) return { ok: false, error: "PIN must be 4 to 8 digits." };
  if (!hasPin() || !(await checkPin(current))) return { ok: false, error: "Current PIN is wrong." };
  await setPin(next);
  clearFails();
  return { ok: true };
}

function wipeLocal() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("jcd.") || k === "jarvis.key")) keys.push(k);
    }
  } catch {}
  keys.forEach(k => LS.del(k));
}

export function resetDeck() {
  wipeLocal();
  location.reload();
}

export function bumpActivity() {
  if (!locked) lastActive = Date.now();
}

async function submit() {
  if (busy || Date.now() < until()) return;
  if (mode === "set") {
    if (!valid(buf)) { setMsg(buf.length ? "PIN must be 4 to 8 digits." : "Enter a 4 to 8 digit PIN.", "err"); shake(); return; }
    pending = buf; buf = ""; mode = "confirm"; setMsg(""); paint(); return;
  }
  if (mode === "confirm") {
    if (buf !== pending) {
      shake();
      setMsg("PINs don't match. Try again.", "err");
      pending = ""; buf = ""; mode = "set"; paint();
      return;
    }
    busy = true;
    try { await setPin(buf); }
    finally { busy = false; }
    setIdleMinutes(getIdleMinutes());
    await accept();
    return;
  }
  if (buf.length < 4) { setMsg("Enter your PIN.", "err"); return; }
  busy = true;
  let ok = false;
  try { ok = await checkPin(buf); }
  finally { busy = false; }
  if (ok) { await accept(); return; }
  buf = ""; renderDots(); shake(); markFail();
}

async function key(k) {
  if (busy || Date.now() < until()) return;
  if (k === "⌫") { buf = buf.slice(0, -1); setMsg(""); renderDots(); return; }
  if (k === "OK") { await submit(); return; }
  if (!/^\d$/.test(k) || buf.length >= 8) return;
  buf += k; setMsg(""); renderDots();
  if (mode === "unlock" && buf.length === +(lkGet("len") || 0)) await submit();
}

function cloneLogo() {
  const host = el("lockLogo");
  const src = document.querySelector("#boot .logo");
  if (!host || !src || host.dataset.ready) return;
  const copy = src.cloneNode(true);
  copy.classList.add("logo-lock");
  copy.querySelectorAll("[id]").forEach(n => { n.id = "jlock-" + n.id.replace(/^jboot-/, ""); });
  copy.querySelectorAll("[filter], [fill], [stroke]").forEach(n => {
    for (const a of ["filter", "fill", "stroke"]) {
      const v = n.getAttribute(a);
      if (v && v.includes("jboot-")) n.setAttribute(a, v.replaceAll("jboot-", "jlock-"));
    }
  });
  // url() in attributes / style
  copy.querySelectorAll("*").forEach(n => {
    for (const a of Array.from(n.attributes || [])) {
      if (a.value && a.value.includes("jboot-")) n.setAttribute(a.name, a.value.replaceAll("jboot-", "jlock-"));
    }
  });
  host.appendChild(copy);
  host.dataset.ready = "1";
}

function wire() {
  cloneLogo();
  const pad = el("lockPad");
  pad.innerHTML = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"].map(k =>
    `<button type="button" data-k="${k}" aria-label="${k === "⌫" ? "Delete" : k === "OK" ? "Confirm" : k}">${k === "⌫" ? "DEL" : k}</button>`
  ).join("");
  pad.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b) key(b.dataset.k);
  });

  const hidden = el("lockPin");
  hidden.addEventListener("input", () => {
    if (!locked || busy) return;
    const next = (hidden.value || "").replace(/\D/g, "").slice(0, 8);
    buf = next; renderDots();
    if (mode === "unlock" && buf.length === +(lkGet("len") || 0)) submit();
  });
  hidden.addEventListener("keydown", e => {
    if (!locked) return;
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  });

  ["pointerdown", "pointerup", "click", "keydown", "touchstart", "wheel"].forEach(ev => {
    document.addEventListener(ev, e => {
      if (locked) {
        if (ev === "keydown") {
          const inHidden = e.target === hidden;
          if (/^\d$/.test(e.key)) { if (!inHidden) { e.preventDefault(); key(e.key); } }
          else if (e.key === "Backspace") { if (!inHidden) { e.preventDefault(); key("⌫"); } }
          else if (e.key === "Enter") { e.preventDefault(); key("OK"); }
          else if (e.key === "Escape") e.preventDefault();
          else if (!inHidden) e.preventDefault();
        } else if (!el("lock").contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      lastActive = Date.now();
    }, { capture: true, passive: false });
  });

  document.addEventListener("visibilitychange", () => {
    if (!hasPin() || !started) return;
    const mins = getIdleMinutes();
    if (document.hidden) {
      hiddenAt = Date.now();
    } else if (hiddenAt) {
      if (mins > 0 && Date.now() - hiddenAt >= mins * 60 * 1000) lockNow();
      hiddenAt = 0;
    }
  });
  function maybeIdleLock() {
    if (locked || !hasPin() || !started) return;
    const mins = getIdleMinutes();
    if (mins > 0 && Date.now() - lastActive >= mins * 60 * 1000) lockNow();
  }
  setInterval(maybeIdleLock, 1000);
  window.__deckLock = {
    lockNow, hasPin, isLocked: () => locked, started: () => started,
    setIdleMinutes, getIdleMinutes,
    idle(ms) { lastActive = Date.now() - ms; maybeIdleLock(); },
    hide(ms) { hiddenAt = Date.now() - ms; }
  };

  el("lockForgot").addEventListener("click", () => askReset());
  el("lockResetCancel").addEventListener("click", () => showReset(false));
  el("lockResetConfirm").addEventListener("click", () => resetDeck());
  el("lock").addEventListener("click", () => focusHidden());
}

function showReset(on) {
  el("lockReset").hidden = !on;
  el("lockMain").hidden = !!on;
}

function askReset() {
  showReset(true);
}

function pwaToast(msg, onTap) {
  const host = document.getElementById("toasts");
  if (!host) return;
  const t = document.createElement("div");
  t.className = "toast glass";
  t.textContent = msg;
  t.style.cursor = "pointer";
  t.addEventListener("click", () => { t.remove(); if (onTap) onTap(); });
  host.appendChild(t);
}

function registerPwa() {
  if (!("serviceWorker" in navigator)) return;
  const ready = () => navigator.serviceWorker.register("./sw.js").then(reg => {
    const prompt = worker => {
      pwaToast("Update available, tap to reload", () => {
        if (worker && worker.state !== "redundant") {
          try { worker.postMessage({ type: "SKIP_WAITING" }); } catch {}
        }
        location.reload();
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) prompt(nw);
      });
    });
  }).catch(() => {});
  ready();
}

function start() {
  registerPwa();
  wire();
  if (!hasPin()) {
    mode = "set";
    showGate();
  } else {
    mode = "unlock";
    showGate();
  }
}

export const __test = {
  lockNow,
  hasPin,
  isLocked: () => locked,
  idle(ms) { lastActive = Date.now() - ms; },
  hide(ms) { hiddenAt = Date.now() - ms; },
  started: () => started
};

start();
