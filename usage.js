// Grok Bot weekly usage copy for the Command Deck HUD gauge.
import { TZ, formatClock, formatDate, ago } from "./readout.js";

export function parseUsage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const weekly = Number(raw.weeklyPercentUsed);
  if (!isFinite(weekly)) return null;
  const num = k => { const v = Number(raw[k]); return isFinite(v) ? v : null; };
  const str = k => { const v = raw[k]; return v ? String(v) : ""; };
  return {
    weeklyPercentUsed: weekly,
    weeklyResetsAt: str("weeklyResetsAt"),
    onDemandUsed: num("onDemandUsed"),
    onDemandLimit: num("onDemandLimit"),
    onDemandResetsAt: str("onDemandResetsAt"),
    checkedAt: str("checkedAt")
  };
}

export function usageTone(percent) {
  const p = Number(percent);
  if (!isFinite(p)) return "unknown";
  if (p > 85) return "high";
  if (p >= 60) return "warn";
  return "ok";
}

export function usagePercentLabel(percent) {
  const p = Number(percent);
  if (!isFinite(p)) return "";
  return String(Math.round(p));
}

export function usageRingOffset(percent) {
  const p = Math.max(0, Math.min(100, Number(percent)));
  if (!isFinite(p)) return 100;
  return 100 - p;
}

export function formatMoneyUSD(n) {
  const x = Number(n);
  if (!isFinite(x)) return "";
  const sign = x < 0 ? "-" : "";
  const abs = Math.abs(x);
  if (Math.round(abs * 100) % 100 === 0) return sign + "$" + String(Math.round(abs));
  return sign + "$" + abs.toFixed(2);
}

function londonDay(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d)) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function sameLondonDay(a, b) {
  const da = londonDay(a), db = londonDay(b);
  return !!da && da === db;
}

export function formatWeekdayWhen(iso, { withYear = false } = {}) {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d)) return "";
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" }).format(d);
  const date = formatDate(d, { withYear });
  const clock = formatClock(d);
  if (!date || !clock) return "";
  return weekday + " " + date + " at " + clock;
}

export function isUsageStale(iso, now = new Date(), ms = 2 * 60 * 60 * 1000) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const n = now instanceof Date ? now.getTime() : Number(now);
  if (!isFinite(t) || !isFinite(n)) return false;
  return (n - t) > ms;
}

export function usageHeadline(u) {
  if (!u) return "";
  const pct = usagePercentLabel(u.weeklyPercentUsed);
  return pct ? "Usage " + pct + "%" : "Usage";
}

export function usageDetailText(u, now = new Date()) {
  if (!u) return "";
  const parts = [];
  const pct = usagePercentLabel(u.weeklyPercentUsed);
  if (pct) parts.push(pct + " percent of this week's usage used.");
  if (u.weeklyResetsAt) {
    const when = formatWeekdayWhen(u.weeklyResetsAt, { withYear: false });
    if (when) parts.push("Resets " + when + ".");
  }
  const used = u.onDemandUsed != null ? formatMoneyUSD(u.onDemandUsed) : "";
  const limit = u.onDemandLimit != null ? formatMoneyUSD(u.onDemandLimit) : "";
  if (used && limit) parts.push(used + " of " + limit + " on-demand used this month.");
  else if (used) parts.push(used + " on-demand used this month.");
  if (u.checkedAt) {
    const when = sameLondonDay(u.checkedAt, now)
      ? formatClock(u.checkedAt)
      : formatWeekdayWhen(u.checkedAt, { withYear: false });
    if (when) {
      const age = ago(u.checkedAt, now);
      if (age && age !== "just now") parts.push("Checked " + when + ", " + age + ".");
      else parts.push("Checked " + when + ".");
    }
  }
  return parts.join(" ");
}
