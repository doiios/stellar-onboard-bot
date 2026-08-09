# stellar-onboard-bot

A Telegram bot that walks first-time users through onboarding to the
[Stellar](https://stellar.org) network: what a wallet is, what an anchor is,
and how to complete a real SEP-24 deposit — in plain language, in more than
one language, with an LLM on hand to answer free-text questions at every step.

## Why this exists

Stellar's anchor network exists to move value between local currency and the
chain cheaply — which matters most for people sending or receiving
remittances, often in corridors where banking fees eat a large share of every
transfer. The technical on-ramp (install a wallet, understand what an anchor
is, find a trustworthy one, complete KYC, wait for a deposit) is exactly the
kind of multi-step, jargon-heavy process that keeps people who'd benefit most
from cheaper transfers from ever using them. This bot's only job is to make
that on-ramp walkable for someone who has never touched crypto before,
in their own language, from a chat app they already have installed.

It is an MVP built for the [Drips Wave Stellar Program](https://drips.network/wave/stellar):
a working Telegram flow, tested end to end against a real SEP-24 testnet
anchor, meant to be extended (see [`ISSUES.md`](./ISSUES.md)) rather than
treated as finished.

## Safety boundary: what this bot will never do

**This bot never asks for, receives, or stores a private key, seed phrase, or
KYC document — and it never will.** That is a hard design boundary, not a
feature flag:

- **Keys**: the state machine only ever accepts a Stellar **public** key
  (`G...`, 56 characters). If a user pastes a secret key (`S...`) or
  something that looks like a 12/24-word recovery phrase, the bot refuses it
  outright and tells the user to treat that wallet as compromised. See
  `looksLikeSecretKey` / `SECRET_DETECTED` in
  [`src/flow/stateMachine.js`](./src/flow/stateMachine.js).
- **Signing**: SEP-10 authentication (which requires signing a challenge
  transaction) happens entirely in the user's own browser, using their own
  wallet extension (Freighter), on a small companion static page in
  [`/webapp`](./webapp). The bot server calls no signing API and holds no
  private key material at any point — see the comments at the top of
  [`src/anchors/sep24.js`](./src/anchors/sep24.js) and
  [`webapp/connect.js`](./webapp/connect.js).
- **KYC**: identity verification happens on the anchor's own hosted
  interactive page, per the SEP-24 spec. The bot deep-links the user there
  and stops — it never collects a document, a selfie, or personal identity
  data of any kind.
- **The LLM helper is bound by the same rule**: the system prompt in
  [`src/llm/assistant.js`](./src/llm/assistant.js) explicitly instructs the
  model to never ask for a key, seed phrase, or KYC document, and to refuse
  and warn the user if one is offered anyway.

If you're reviewing this repo for a grant, bounty, or security audit, those
four files are the ones to check first.

## How the flow works

1. **Wallet intro** — explains what a Stellar wallet is, recommends
   [Freighter](https://www.freighter.app/), and waits for the user to
   confirm they've installed one and pastes their **public** address.
2. **Anchor intro** — explains what a SEP-24 anchor is and lists known
   anchors (currently the official Stellar test anchor; see
   [`src/anchors/anchors.js`](./src/anchors/anchors.js) for how to add more).
3. **SEP-24 deposit initiation** — resolves the anchor's `stellar.toml`
   (SEP-1), then hands the user off to the companion web app, which performs
   SEP-10 login via the user's wallet extension and opens the anchor's
   official hosted interactive deposit page. The bot never touches this
   step's signing.
4. **Balance confirmation** — polls the user's **public** Horizon account
   balance in the background and messages the user the moment the deposit
   lands on-chain.

At every step, anything the user types that isn't the expected structured
input (a key, a menu number) is routed to an LLM helper that knows which step
the user is on and answers in their detected language.

## Languages

English, Spanish, and Filipino/Tagalog are supported out of the box —
three languages that between them cover several of the largest remittance
corridors into Stellar-anchor markets. Language is detected from the
Telegram client's locale and refined by keyword-sniffing free text (see
[`src/i18n/detect.js`](./src/i18n/detect.js)). Adding a fourth language is a
scoped, well-isolated task — see `ISSUES.md`.

## Project layout

```
src/
  flow/stateMachine.js   pure conversation state machine (fully unit tested, no I/O)
  anchors/anchors.js     registry of known SEP-24 anchors
  anchors/sep24.js       SEP-1 discovery + deposit hand-off URL builder (no signing)
  horizon.js             public Horizon balance polling
  i18n/                  language detection + onboarding copy (en/es/tl)
  llm/assistant.js       free-text Q&A, flow-aware, language-aware
  session.js             in-memory per-chat session store (public key only)
  index.js               Telegraf bot wiring
webapp/                  companion static page: SEP-10 signing via the user's own wallet
test/                    state machine + helper unit tests (see CI)
```

## Setup

See [`SETUP.md`](./SETUP.md) — written for a browser-only workflow (no local
Node install required to get this running; deployment and testing happen via
GitHub Actions and a hosting provider's web dashboard).

## Contributing

Issues are scoped and labeled for the Drips Wave Stellar Program — see
[`ISSUES.md`](./ISSUES.md) for the current list. The Telegram + testnet
anchor flow is meant to be solid before scope expands (more channels, more
languages, withdrawal flow, etc).

## License

MIT — see [`LICENSE`](./LICENSE).
