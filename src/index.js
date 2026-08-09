'use strict';

require('dotenv').config();
const { Telegraf } = require('telegraf');

const { STEPS, reduce, expectsStructuredInput } = require('./flow/stateMachine');
const { SessionStore } = require('./session');
const { listAnchors, getAnchorById } = require('./anchors/anchors');
const { resolveAnchorEndpoints, buildDepositHandoffUrl } = require('./anchors/sep24');
const { getBalances, pollForDeposit } = require('./horizon');
const { resolveLanguage } = require('./i18n/detect');
const { t } = require('./i18n/strings');
const { answerFreeText } = require('./llm/assistant');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_BASE_URL = process.env.WEBAPP_BASE_URL || 'https://example.github.io/stellar-onboard-bot';
const NETWORK = process.env.STELLAR_NETWORK || 'TESTNET';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 15000);
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS || 30 * 60 * 1000);

if (!BOT_TOKEN) {
  // eslint-disable-next-line no-console
  console.error('TELEGRAM_BOT_TOKEN is not set. See SETUP.md.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const store = new SessionStore();

function updateLang(session, ctx, text) {
  const lang = resolveLanguage({
    telegramCode: ctx.from && ctx.from.language_code,
    text,
    currentLang: session.lang,
  });
  session.lang = lang;
  return lang;
}

async function sendAnchorList(ctx, lang) {
  const anchors = listAnchors(NETWORK);
  const lines = anchors.map((a, i) => {
    const desc = a.description[lang] || a.description.en;
    return `${i + 1}. *${a.name}*\n   ${desc}`;
  });
  await ctx.replyWithMarkdown(`${t(lang, 'listAnchorsHeader')}\n\n${lines.join('\n\n')}`);
  // Simple numbered-reply UX: user replies "1", "2", etc. Real UX would use
  // inline keyboard buttons -- see ISSUES.md.
}

async function handleAction(ctx, session, action) {
  const lang = session.lang;

  switch (action.type) {
    case 'SEND_WALLET_INTRO':
      await ctx.reply(t(lang, 'welcome'));
      return reduce(session, { type: 'WALLET_ACK' });

    case 'ASK_FOR_PUBKEY':
      await ctx.reply(t(lang, 'askPubkey'));
      return null;

    case 'REFUSE_SECRET':
      await ctx.reply(t(lang, 'refuseSecret'));
      return null;

    case 'INVALID_PUBKEY':
      await ctx.reply(t(lang, 'invalidPubkey'));
      return null;

    case 'SEND_ANCHOR_INTRO':
      await ctx.reply(t(lang, 'anchorIntro'));
      return reduce(session, { type: 'ANCHOR_INTRO_ACK' });

    case 'LIST_ANCHORS':
      await sendAnchorList(ctx, lang);
      return null;

    case 'INITIATE_SEP24_DEPOSIT': {
      const anchor = getAnchorById(action.anchorId);
      if (!anchor) {
        await ctx.reply(t(lang, 'invalidPubkey')); // reuse generic "invalid" copy
        return null;
      }
      try {
        // Discovery only -- resolving stellar.toml is public data, no signing.
        await resolveAnchorEndpoints(anchor.homeDomain);
        const startBalance = await getBalances(session.publicKey, NETWORK);
        const url = buildDepositHandoffUrl({
          webAppBaseUrl: WEBAPP_BASE_URL,
          homeDomain: anchor.homeDomain,
          publicKey: session.publicKey,
          assetCode: anchor.assetCode,
          lang,
        });
        return reduce(session, {
          type: 'DEPOSIT_INITIATED',
          payload: { depositId: `${anchor.id}-${Date.now()}`, startBalance, url },
        });
      } catch (err) {
        await ctx.reply(`${anchor.name}: ${err.message}`);
        return null;
      }
    }

    case 'SEND_DEPOSIT_LINK': {
      await ctx.reply(t(lang, 'depositLinkSent', { url: action.url }));
      await ctx.reply(t(lang, 'pollingStarted'));
      startPolling(ctx.chat.id, session);
      return null;
    }

    case 'SEND_DEPOSIT_CONFIRMED':
      await ctx.reply(t(lang, 'depositConfirmed'));
      return null;

    case 'KEEP_POLLING':
    case 'NOOP':
    default:
      return null;
  }
}

async function drive(ctx, session, initialEvent) {
  let { session: next, action } = reduce(session, initialEvent);
  store.set(ctx.chat.id, next);
  let guard = 0;
  while (action && action.type !== 'NOOP' && guard < 10) {
    const followUp = await handleAction(ctx, next, action);
    guard += 1;
    if (!followUp) break;
    next = followUp.session;
    action = followUp.action;
    store.set(ctx.chat.id, next);
  }
}

function startPolling(chatId, session) {
  // Fire-and-forget background poll; updates the session and messages the
  // chat once a deposit is observed. Kept intentionally simple (single
  // in-process interval) for the MVP -- see ISSUES.md for a durable-queue
  // follow-up once this is validated against a real anchor.
  pollForDeposit({
    publicKey: session.publicKey,
    network: NETWORK,
    startBalance: session.startBalance,
    intervalMs: POLL_INTERVAL_MS,
    timeoutMs: POLL_TIMEOUT_MS,
  })
    .then(async (result) => {
      const current = store.get(chatId);
      if (current.step !== STEPS.POLLING_BALANCE) return; // user moved on / reset
      if (result.deposited) {
        const { session: next } = reduce(current, { type: 'BALANCE_CHANGED' });
        store.set(chatId, next);
        await bot.telegram.sendMessage(chatId, t(next.lang, 'depositConfirmed'));
      }
      // On timeout we simply stop polling silently; the state machine stays
      // in POLLING_BALANCE so a manual /status check (future issue) could
      // resume it.
    })
    .catch(() => {
      /* swallow -- background poll failures shouldn't crash the bot */
    });
}

bot.start(async (ctx) => {
  const session = store.get(ctx.chat.id);
  updateLang(session, ctx, null);
  store.set(ctx.chat.id, session);
  await drive(ctx, session, { type: 'RESET' });
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return; // let other command handlers deal with it

  const session = store.get(ctx.chat.id);
  const lang = updateLang(session, ctx, text);
  session.lang = lang;
  store.set(ctx.chat.id, session);

  if (session.step === STEPS.AWAITING_PUBKEY) {
    await drive(ctx, session, { type: 'PUBKEY_SUBMITTED', payload: text });
    return;
  }

  if (session.step === STEPS.AWAITING_ANCHOR) {
    const anchors = listAnchors(NETWORK);
    const idx = parseInt(text, 10) - 1;
    const chosen = anchors[idx];
    if (chosen) {
      await drive(ctx, session, { type: 'ANCHOR_SELECTED', payload: { anchorId: chosen.id } });
      return;
    }
    // fall through to LLM if it's not a valid selection -- e.g. "what does anchor 1 mean?"
  }

  // Anything else is a free-text question: route to the LLM helper with
  // flow context so the answer reflects where the user currently is.
  void expectsStructuredInput; // kept for potential future gating; currently always LLM fallback
  const answer = await answerFreeText({ userText: text, step: session.step, lang });
  await ctx.reply(answer);
});

bot.launch();
// eslint-disable-next-line no-console
console.log('stellar-onboard-bot is running');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { bot };
