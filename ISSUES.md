# Scoped issues

These are meant to be copy-pasted into GitHub Issues individually. Each is
scoped to be independently doable once the Telegram + testnet-anchor flow in
this MVP is confirmed working.

---

### 1. Add a fourth supported language

Add a new locale (e.g. Hindi or Vietnamese — pick another remittance
corridor not yet covered) alongside `en`/`es`/`tl`:
- Add translated strings in `src/i18n/strings.js`.
- Add keyword hints for free-text detection in `src/i18n/detect.js`.
- Add the language to `SUPPORTED` and to anchor `description` objects in
  `src/anchors/anchors.js`.
- Add a locale block to `LANG_NAMES` in `src/llm/assistant.js` so the LLM
  helper replies in it too.
- Extend `test/helpers.test.js` with detection tests for the new language.

**Acceptance**: `/start` in the new language produces fully translated
onboarding copy, and free-text questions in that language get answered in
kind.

---

### 2. Add a withdrawal flow (not just deposit)

Currently the bot only walks users through SEP-24 **deposit** (local
currency → Stellar asset). Add the reverse: SEP-24 **withdraw**
(`/transactions/withdraw/interactive`), so a user can cash out back to local
currency.
- Extend the state machine (`src/flow/stateMachine.js`) with a parallel set
  of steps, or a `direction: 'deposit' | 'withdraw'` field on the session
  chosen at the anchor-selection step.
- Extend `webapp/connect.js` to call the withdraw endpoint when directed.
- Extend `src/horizon.js` polling to watch for a balance **decrease** plus a
  matching outgoing payment operation, rather than an increase.

**Acceptance**: a user can complete a full withdraw cycle against
`testanchor.stellar.org` and get a confirmation message.

---

### 3. Add WhatsApp Business API support alongside Telegram

Extract the channel-agnostic logic (already mostly isolated in
`src/flow/stateMachine.js`, `src/i18n/`, `src/llm/assistant.js`,
`src/anchors/`, `src/horizon.js`) behind a thin channel adapter interface, and
add a WhatsApp Business API adapter alongside the existing Telegraf one in
`src/index.js`.
- Define a minimal adapter interface: `sendMessage(userId, text)`,
  `onMessage(handler)`.
- Move the current Telegraf-specific code in `src/index.js` behind that
  interface as the reference adapter.
- Add a new `src/channels/whatsapp.js` adapter using the WhatsApp Business
  Cloud API.

**Acceptance**: the exact same onboarding flow (wallet → anchor → deposit →
confirmation) works over WhatsApp, driven by the same state machine and
locale files, with no duplicated business logic.

---

### 4. Add anchor reputation/review display

Right now `src/anchors/anchors.js` is a hand-maintained list with no signal
about anchor reliability. Add a lightweight reputation layer:
- A `reputation` field per anchor (e.g. sourced from
  [stellar.expert](https://stellar.expert) anchor directory data, or a
  manually curated `{ uptime_note, known_since, review_url }` block).
- Surface this in the `LIST_ANCHORS` step's message so users see it before
  choosing.

**Acceptance**: the anchor list shown to users includes a one-line
reputation/trust signal per anchor, sourced from a documented, checkable
source (not an unsourced claim).

---

### 5. Add voice-note support for low-literacy users

Many remittance-corridor users are more comfortable with voice than text.
Add support for Telegram voice notes as input and (optionally) voice replies
as output:
- Transcribe incoming voice notes (e.g. via a speech-to-text API) before
  passing the text into the existing flow/LLM handling in `src/index.js`.
- Optionally synthesize the bot's key onboarding messages
  (`welcome`, `askPubkey`, `anchorIntro`, `depositConfirmed`) as short audio
  clips per supported language.

**Acceptance**: a user can complete onboarding using only voice messages for
free-text questions, and can optionally receive the core flow messages as
audio.

---

### 6. Move session storage out of memory

`src/session.js` is intentionally in-memory for the MVP, which means a
process restart loses all in-flight onboarding sessions (safe to lose, since
no secrets are ever stored, but a bad UX). Swap it for a small persistent
store:
- SQLite (fits a single small deployment, still simple) or Redis (fits a
  multi-instance deployment).
- Session shape is unchanged (`step`, `lang`, `publicKey`, `selectedAnchorId`,
  `depositId`, `startBalance`) — this is a storage-backend swap, not a schema
  change.

**Acceptance**: a bot process restart mid-flow doesn't lose the user's
progress; `SessionStore`'s public interface (`get`/`set`) stays the same so
`src/index.js` doesn't need to change.
