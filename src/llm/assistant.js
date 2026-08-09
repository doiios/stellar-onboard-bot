'use strict';

/**
 * Free-text Q&A assistant. Called whenever the user's message doesn't match
 * the structured input the state machine expects at the current step (e.g.
 * they ask "why do I need a wallet?" instead of pasting a key).
 *
 * Uses the Anthropic Messages API directly via fetch, so it has no extra
 * SDK dependency. Requires ANTHROPIC_API_KEY in the environment.
 */

const { STEPS } = require('../flow/stateMachine');

const STEP_CONTEXT = {
  [STEPS.START]: 'The user has not started onboarding yet.',
  [STEPS.WALLET_INTRO]: 'The user is being introduced to Stellar wallets and pointed to Freighter.',
  [STEPS.AWAITING_PUBKEY]: 'The bot is waiting for the user to paste their Stellar PUBLIC key (starts with G, 56 chars).',
  [STEPS.ANCHOR_INTRO]: 'The user is being introduced to the concept of a SEP-24 anchor.',
  [STEPS.AWAITING_ANCHOR]: 'The bot is waiting for the user to pick an anchor from a shown list.',
  [STEPS.DEPOSIT_LINK_SENT]: 'The bot just sent a link to a companion web page that will connect their wallet and hand them off to the anchor.',
  [STEPS.POLLING_BALANCE]: 'The bot is polling Horizon in the background waiting for the deposit to land on-chain.',
  [STEPS.COMPLETE]: 'The user has completed a deposit and is fully onboarded.',
};

const LANG_NAMES = { en: 'English', es: 'Spanish', tl: 'Filipino/Tagalog' };

function buildSystemPrompt({ step, lang }) {
  const stepDesc = STEP_CONTEXT[step] || 'Unknown step.';
  const langName = LANG_NAMES[lang] || 'English';
  return [
    'You are the in-chat helper for "stellar-onboard-bot", a Telegram bot that walks first-time users through onboarding to the Stellar network for remittances and everyday payments.',
    `Current step in the onboarding flow: ${stepDesc}`,
    `Reply in ${langName}. Keep answers short (2-4 sentences), plain-language, and friendly -- assume the user may be new to crypto entirely.`,
    'Hard rules, no exceptions:',
    '- NEVER ask the user for a seed phrase, recovery phrase, or private/secret key. If they offer one, tell them to stop and never share it with anyone, including you.',
    '- NEVER ask for or request KYC documents (ID photos, proof of address, selfies) -- that happens only on the anchor\'s own official page.',
    '- NEVER claim you can move funds, sign transactions, or access their wallet. You only explain and link to official resources.',
    '- If asked something outside Stellar/wallet/anchor onboarding, answer briefly if you can, but steer back to the onboarding flow.',
    '- If unsure or the question implies a security risk, err toward caution and suggest they check the official Stellar or Freighter documentation.',
  ].join('\n');
}

async function answerFreeText({ userText, step, lang, apiKey = process.env.ANTHROPIC_API_KEY, fetchImpl = fetch }) {
  if (!apiKey) {
    return FALLBACK_ANSWERS[lang] || FALLBACK_ANSWERS.en;
  }

  const system = buildSystemPrompt({ step, lang });

  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  });

  if (!res.ok) {
    return FALLBACK_ANSWERS[lang] || FALLBACK_ANSWERS.en;
  }

  const data = await res.json();
  const textBlock = (data.content || []).find((b) => b.type === 'text');
  return textBlock ? textBlock.text : FALLBACK_ANSWERS[lang] || FALLBACK_ANSWERS.en;
}

const FALLBACK_ANSWERS = {
  en: "I couldn't reach the help assistant right now, but I'm still here to guide you through the onboarding steps directly.",
  es: 'No pude contactar al asistente de ayuda en este momento, pero sigo aqui para guiarte en los pasos de configuracion.',
  tl: 'Hindi ko maabot ang assistant ngayon, pero nandito pa rin ako para gabayan ka sa mga hakbang ng onboarding.',
};

module.exports = { answerFreeText, buildSystemPrompt, STEP_CONTEXT };
