# Jarvis Command Deck

A standalone 3D command centre for a crew of Grok Bots. You talk only to **Jarvis** (Chief of Staff); Jarvis routes each request to the right specialist.

- Static site: plain HTML + ES modules, Three.js r170 from a pinned CDN, no build step.
- Live data comes from Second Brain: the Jarvis HUD **Inbox** note (requests) and **Bot Status** note (status lines), polled every 45 s.
- Sending a message appends a `{id, createdAt, text, status:"new", routedTo:null, reply:null, repliedAt:null}` item to the Inbox note with ETag / If-Match (retries on 409/412).
- After a request is appended to the Inbox note, Second Brain triggers instant routing server-side so the job is handed to the right bot at once. The deck shows the result: an outbound beam when a request is routed, an inbound beam and the reply when it's answered.
- Installable as a home-screen app (PWA): Add to Home Screen on iPhone (Safari → Share) or Install app in Chrome on Android. Updates are fetched network-first so a new build is never stuck behind a stale cache.
- A PIN lock (set on first use on a device) gates the deck until you unlock it. Only a salted hash is stored in the browser; the PIN itself is never kept or shipped in this repo. A forgotten PIN can reset the locally saved keys and settings (this does not change notes in Second Brain).
- The access token and note ids are entered in **Settings** at runtime and stored only in the browser (they may be reused from the Jarvis HUD on the same origin). Nothing secret is in this repo.
- Edit the crew in `config.js` (`ROSTER`).

## v2: live voice loop + Grok-Bot-style avatars
- **Talk mode** (TALK button, or hold the mic): Web Speech recognition (en-GB) → auto-send → Jarvis replies instantly via xAI → spoken with the browser's speech synthesis (British male preferred; picker in Settings) → listens again. Tap the mic while Jarvis speaks to interrupt.
- Jarvis's reply returns `{reply, route}`; when `route` names a crew member the request is appended to the Inbox note for that bot and an outbound beam fires straight away.
- The xAI key is entered at runtime (shared `jarvis.key` with the Jarvis HUD on this origin). The persona comes from the Voice & Style note when its id is set.
- Each exchange is appended to the History note in the HUD's entry format (If-Match).
- Crew nodes are 3D bot avatars (body shape from each bot's avatar where set, dark visor, glowing eyes, antenna, role badge).
- Status, times, amounts and quantities are read out in natural spoken English, both on screen and through the voice link (v2.6.3).
- Opening a bot's info panel lists every message from that bot, with the request and full reply, in a list that scrolls inside the panel (v2.6.4).
- Handoffs such as advise, ask, or tell a named crew member always queue an Inbox item, and History labels the user Peter (v2.6.5).
- Crew labels show each bot's current name and role from Second Brain (falling back to the roster), and on-screen dates and times use forms such as 14 November 2026 and 12:25 pm (v2.6.6).
- The mic button asks Chrome for microphone access first, so the installed app shows a real allow prompt and clear guidance if access is blocked (v2.6.7).
- Crew labels use the renamed bots (Dashboard Bot, Finance Bot, Marketing Bot, Email Bot, Data and Files Bot, Business Bot, PC Health Bot), even when a status line still carries an old name (v2.6.8).
- Fixed stale caches so label updates always load after a release (v2.6.9).
- Dates, times and numbers that bots write in their own status lines and replies are shown naturally, such as "Saturday 14 November at around 6:25 am" and "9:57 pm", with GMT/UTC converted to London time and the zone label dropped. Version numbers, IDs, references, money, mileage and HTTP codes stay as written on screen and are read aloud naturally by the voice (v2.6.10). Test: `node tests/naturalize-text.test.mjs`.
