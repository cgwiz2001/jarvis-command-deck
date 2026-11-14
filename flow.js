// Decide the direction of Command Deck data-flow beams from real events.
// "out" is Jarvis sending a task to a bot; "in" is a bot sending something back.

export function seenSnapshot(r) {
  if (!r) return { status: "", reply: "", repliedAt: "" };
  return {
    status: r.status || "",
    reply: r.reply == null ? "" : String(r.reply),
    repliedAt: r.repliedAt || ""
  };
}

function normalizeSeen(prev) {
  if (prev == null || prev === "") return undefined;
  if (typeof prev === "string") return { status: prev, reply: "", repliedAt: "", legacy: true };
  return {
    status: prev.status || "",
    reply: prev.reply == null ? "" : String(prev.reply),
    repliedAt: prev.repliedAt || "",
    legacy: !!prev.legacy
  };
}

function hasNewReply(prev, cur) {
  if (!cur) return false;
  const pr = prev && prev.reply != null ? String(prev.reply) : "";
  const cr = cur.reply == null ? "" : String(cur.reply);
  const pa = (prev && prev.repliedAt) || "";
  const ca = cur.repliedAt || "";
  return (!!cr && cr !== pr) || (!!ca && ca !== pa);
}

// prev: previously stored snapshot or a legacy status string.
// cur: the live inbox item. bi: roster index (0 = Jarvis, <1 = no crew bot).
// Returns [{ dir: "out"|"in"|"core", delay, reason }].
export function inboxFlowEvents(prev, cur, bi) {
  const events = [];
  if (!cur) return events;
  const p = normalizeSeen(prev);
  const prevStatus = p && p.status;
  const curStatus = cur.status || "";
  const hasBot = bi > 0;
  const becameRouted = curStatus === "routed" && prevStatus !== "routed";
  const becameAnswered = curStatus === "answered" && prevStatus !== "answered";
  const replyArrived = curStatus === "answered" && !p?.legacy && hasNewReply(p, cur);

  if (becameRouted && hasBot) events.push({ dir: "out", delay: 0, reason: "routed" });

  if (becameAnswered && hasBot) {
    const missedRoute = prevStatus !== "routed";
    if (missedRoute) events.push({ dir: "out", delay: 0, reason: "routed" });
    events.push({ dir: "in", delay: missedRoute ? 2400 : 0, reason: "answered" });
  } else if (replyArrived && hasBot) {
    events.push({ dir: "in", delay: 0, reason: "reply" });
  }

  if ((becameAnswered || replyArrived) && !hasBot) events.push({ dir: "core", delay: 0, reason: "answered-core" });
  return events;
}

export function botStatusSig(bot) {
  if (!bot) return "";
  return [bot.updatedAt || "", bot.state || "", bot.note || ""].join("\n");
}

// prevSig: last stored signature for this bot, or null if it has never been seen.
export function statusFlowEvents(prevSig, curSig, bi) {
  if (!(bi > 0)) return [];
  if (prevSig == null || prevSig === "") return [];
  if (prevSig === curSig) return [];
  return [{ dir: "in", delay: 0, reason: "status" }];
}
