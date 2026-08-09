# Setup

This guide assumes you're working entirely through the browser — no local
Node install, no `npm install` on your machine. Everything here can be done
from github.dev, the GitHub web UI, and web dashboards.

## 1. Get the code into a repo

- Create a new GitHub repo called `stellar-onboard-bot` (or fork/import this
  one).
- If you're building this file-by-file through the GitHub web UI or
  github.dev, the file tree in this project (`src/`, `webapp/`, `test/`,
  `.github/workflows/`, plus `package.json`, `README.md`, `LICENSE`) is the
  full layout — create each file at its path shown in the tree and paste in
  its contents.

## 2. Get a Telegram bot token

- Open Telegram, message [@BotFather](https://t.me/BotFather), send
  `/newbot`, and follow the prompts.
- BotFather gives you a token like `123456:ABC-DEF...`. Keep this private —
  it's the credential for controlling the *bot*, not any Stellar wallet.

## 3. (Optional) Get an Anthropic API key

- Free-text Q&A during onboarding uses the Anthropic API. If you skip this,
  the bot still runs the full deposit flow — free-text questions just get a
  short static fallback message instead of an LLM answer.
- Get a key from the [Anthropic Console](https://console.anthropic.com/) if
  you want the LLM Q&A enabled.

## 4. Host the companion web app (`/webapp`)

SEP-10 signing has to happen in the user's own browser via their wallet
extension, so `/webapp` needs to be reachable at a public HTTPS URL. The
easiest browser-only option:

- **GitHub Pages**: in your repo, go to **Settings → Pages**, set the source
  to the `main` branch and `/webapp` (or root, if you configure Pages to
  serve `webapp/` as a project) — no build step needed since it's plain
  HTML/JS. Note the resulting URL (e.g.
  `https://your-username.github.io/stellar-onboard-bot/webapp/`).

## 5. Deploy the bot process

The bot itself (`src/index.js`) needs to run continuously as a long-lived
Node process — this isn't something GitHub Pages can host, since it's a
server, not a static site. From a browser, the simplest options are:

- **Railway** or **Render**: connect your GitHub repo through their web
  dashboard, set the start command to `npm start`, and add the environment
  variables below in their dashboard's "Environment" tab. Both platforms
  build and run entirely on their infrastructure — nothing local required.
- Either platform will run `npm install` automatically as part of their
  build step, so you never need `npm install` on your own machine.

### Environment variables to set on your host

Copy from [`.env.example`](./.env.example):

| Variable | Required | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | yes | from BotFather |
| `ANTHROPIC_API_KEY` | no | enables LLM free-text Q&A |
| `WEBAPP_BASE_URL` | yes | your GitHub Pages URL from step 4 |
| `STELLAR_NETWORK` | no | `TESTNET` (default) or `PUBLIC` |
| `POLL_INTERVAL_MS` | no | default `15000` |
| `POLL_TIMEOUT_MS` | no | default `1800000` (30 min) |

## 6. Testing against a real anchor on testnet

The bot ships pre-configured with the official Stellar reference anchor
(`testanchor.stellar.org`) on testnet — this is a real, live SEP-24
implementation, not a mock. To test the full flow:

1. Install [Freighter](https://www.freighter.app/) in your browser and
   switch it to **Testnet** in its settings.
2. Create a testnet account and fund it via
   [Friendbot](https://friendbot.stellar.org/) (search "Stellar friendbot"
   if the link changes — it funds a testnet account with test XLM for free).
3. Message your bot on Telegram, send `/start`, and follow the flow through
   to pasting your testnet public key.
4. Pick the test anchor when prompted, tap through the companion web app to
   connect Freighter and approve the SEP-10 login.
5. Complete the anchor's own interactive deposit form (it's a test UI —
   any values work).
6. Wait for the bot to report the deposit landed — it's polling Horizon
   testnet in the background.

## 7. CI

`.github/workflows/ci.yml` runs automatically on every push/PR — no setup
needed beyond having the workflow file in the repo. It runs the state
machine + helper unit tests on Node 18.x and 20.x, and a basic grep check
against accidentally committed secret-key-shaped strings.

## Adding a new anchor

Add an entry to `ANCHORS` in `src/anchors/anchors.js` with the anchor's
`homeDomain` and an `assetCode`/description per supported language. The bot
resolves the rest (`WEB_AUTH_ENDPOINT`, `TRANSFER_SERVER_SEP0024`) live from
the anchor's `stellar.toml`, so no endpoint URLs need to be hardcoded.
