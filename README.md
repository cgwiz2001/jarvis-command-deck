# Jarvis Command Deck

A standalone 3D command centre for a crew of Grok Bots. You talk only to **Jarvis** (Chief of Staff); Jarvis routes each request to the right specialist.

- Static site: plain HTML + ES modules, Three.js r170 from a pinned CDN, no build step.
- Live data comes from Second Brain: the Jarvis HUD **Inbox** note (requests) and **Bot Status** note (status lines), polled every 45 s.
- Sending a message appends a `{id, createdAt, text, status:"new", routedTo:null, reply:null, repliedAt:null}` item to the Inbox note with ETag / If-Match (retries on 409/412).
- Routing is done by Jarvis's inbox router (4× each weekday) or immediately when Jarvis is spoken to directly. The deck shows the result: an outbound beam when a request is routed, an inbound beam and the reply when it's answered.
- The access token and note ids are entered in **Settings** at runtime and stored only in the browser (or reused from the Jarvis HUD on the same origin). Nothing secret is in this repo.
- Edit the crew in `config.js` (`ROSTER`).
