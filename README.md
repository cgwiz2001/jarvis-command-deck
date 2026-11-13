# Jarvis Command Deck

A standalone 3D command centre for a crew of Grok Bots. You talk only to **Jarvis** (Chief of Staff); Jarvis routes each request to the right specialist.

- Static site: plain HTML + ES modules, Three.js r170 from a pinned CDN, no build step.
- Live data comes from Second Brain: the Jarvis HUD **Inbox** note (requests) and **Bot Status** note (status lines), polled every 45 s.
- Sending a message appends a `{id, createdAt, text, status:"new", routedTo:null, reply:null, repliedAt:null}` item to the Inbox note with ETag / If-Match (retries on 409/412).
- Routing is done by Jarvis's inbox router (4× each weekday) or immediately when Jarvis is spoken to directly. The deck shows the result: an outbound beam when a request is routed, an inbound beam and the reply when it's answered.
- The access token and note ids are entered in **Settings** at runtime and stored only in the browser (or reused from the Jarvis HUD on the same origin). Nothing secret is in this repo.
- Edit the crew in `config.js` (`ROSTER`).

## v2: live voice loop + Grok-Bot-style avatars
- **Talk mode** (TALK button, or hold the mic): Web Speech recognition (en-GB) → auto-send → Jarvis replies instantly via xAI → spoken with the browser's speech synthesis (British male preferred; picker in Settings) → listens again. Tap the mic while Jarvis speaks to interrupt.
- Jarvis's reply returns `{reply, route}`; when `route` names a crew member the request is appended to the Inbox note for that bot and an outbound beam fires straight away.
- The xAI key is entered at runtime (shared `jarvis.key` with the Jarvis HUD on this origin). The persona comes from the Voice & Style note when its id is set.
- Each exchange is appended to the History note in the HUD's entry format (If-Match).
- Crew nodes are 3D bot avatars (body shape from each bot's avatar where set, dark visor, glowing eyes, antenna, role badge).
