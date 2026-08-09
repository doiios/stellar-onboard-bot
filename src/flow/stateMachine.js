'use strict';

/**
 * Pure, side-effect-free conversation state machine.
 *
 * Steps:
 *   START            -> user has not begun onboarding
 *   WALLET_INTRO      -> explaining what a Stellar wallet is / linking to Freighter
 *   AWAITING_PUBKEY   -> waiting for the user to paste their PUBLIC key (G... address only)
 *   ANCHOR_INTRO      -> explaining what an anchor is / listing SEP-24 anchors
 *   AWAITING_ANCHOR   -> waiting for the user to pick an anchor from the list
 *   DEPOSIT_LINK_SENT -> interactive deposit URL has been sent, waiting on the anchor
 *   POLLING_BALANCE   -> bot is polling Horizon for the deposit to land
 *   COMPLETE          -> deposit confirmed
 *
 * This module holds NO secrets. The only Stellar data it ever stores is a
 * PUBLIC key (G...address), which is safe to store and display by design.
 */

const STEPS = Object.freeze({
  START: 'START',
  WALLET_INTRO: 'WALLET_INTRO',
  AWAITING_PUBKEY: 'AWAITING_PUBKEY',
  ANCHOR_INTRO: 'ANCHOR_INTRO',
  AWAITING_ANCHOR: 'AWAITING_ANCHOR',
  DEPOSIT_LINK_SENT: 'DEPOSIT_LINK_SENT',
  POLLING_BALANCE: 'POLLING_BALANCE',
  COMPLETE: 'COMPLETE',
});

const ORDER = [
  STEPS.START,
  STEPS.WALLET_INTRO,
  STEPS.AWAITING_PUBKEY,
  STEPS.ANCHOR_INTRO,
  STEPS.AWAITING_ANCHOR,
  STEPS.DEPOSIT_LINK_SENT,
  STEPS.POLLING_BALANCE,
  STEPS.COMPLETE,
];

function createSession(overrides = {}) {
  return {
    step: STEPS.START,
    lang: 'en',
    publicKey: null,
    selectedAnchorId: null,
    depositId: null,
    startBalance: null,
    ...overrides,
  };
}

/** A stellar PUBLIC key only — G..., 56 chars, base32. We never accept S... (secret) keys. */
const PUBLIC_KEY_RE = /^G[A-Z2-7]{55}$/;
const SECRET_KEY_RE = /^S[A-Z2-7]{55}$/;

function looksLikeSecretKey(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (SECRET_KEY_RE.test(trimmed)) return true;
  // heuristic catch for seed phrases: 12/24 space separated lowercase words
  const words = trimmed.split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    return words.every((w) => /^[a-z]+$/.test(w));
  }
  return false;
}

function isValidPublicKey(text) {
  return !!text && PUBLIC_KEY_RE.test(text.trim());
}

/**
 * Advance the state machine given the current session and an incoming event.
 * Returns { session, action } — action describes what the caller (bot layer)
 * should do (send a message, call an anchor, poll horizon, etc). This
 * function performs no I/O itself, which is what makes it unit-testable.
 *
 * event = { type: 'START' | 'TEXT' | 'ANCHOR_SELECTED' | 'DEPOSIT_OBSERVED', payload }
 */
function reduce(session, event) {
  const s = { ...session };

  switch (event.type) {
    case 'SECRET_DETECTED':
      // Applies regardless of step: refuse and do not store anything.
      return { session: s, action: { type: 'REFUSE_SECRET' } };

    case 'START':
      s.step = STEPS.WALLET_INTRO;
      return { session: s, action: { type: 'SEND_WALLET_INTRO' } };

    case 'WALLET_ACK':
      if (s.step !== STEPS.WALLET_INTRO) {
        return { session: s, action: { type: 'NOOP' } };
      }
      s.step = STEPS.AWAITING_PUBKEY;
      return { session: s, action: { type: 'ASK_FOR_PUBKEY' } };

    case 'PUBKEY_SUBMITTED': {
      if (s.step !== STEPS.AWAITING_PUBKEY) {
        return { session: s, action: { type: 'NOOP' } };
      }
      const text = event.payload;
      if (looksLikeSecretKey(text)) {
        return { session: s, action: { type: 'REFUSE_SECRET' } };
      }
      if (!isValidPublicKey(text)) {
        return { session: s, action: { type: 'INVALID_PUBKEY' } };
      }
      s.publicKey = text.trim();
      s.step = STEPS.ANCHOR_INTRO;
      return { session: s, action: { type: 'SEND_ANCHOR_INTRO' } };
    }

    case 'ANCHOR_INTRO_ACK':
      if (s.step !== STEPS.ANCHOR_INTRO) {
        return { session: s, action: { type: 'NOOP' } };
      }
      s.step = STEPS.AWAITING_ANCHOR;
      return { session: s, action: { type: 'LIST_ANCHORS' } };

    case 'ANCHOR_SELECTED': {
      if (s.step !== STEPS.AWAITING_ANCHOR) {
        return { session: s, action: { type: 'NOOP' } };
      }
      s.selectedAnchorId = event.payload.anchorId;
      s.step = STEPS.DEPOSIT_LINK_SENT;
      return {
        session: s,
        action: { type: 'INITIATE_SEP24_DEPOSIT', anchorId: s.selectedAnchorId },
      };
    }

    case 'DEPOSIT_INITIATED':
      if (s.step !== STEPS.DEPOSIT_LINK_SENT) {
        return { session: s, action: { type: 'NOOP' } };
      }
      s.depositId = event.payload.depositId;
      s.startBalance = event.payload.startBalance;
      s.step = STEPS.POLLING_BALANCE;
      return { session: s, action: { type: 'SEND_DEPOSIT_LINK', url: event.payload.url } };

    case 'START_POLLING':
      if (s.step !== STEPS.POLLING_BALANCE) {
        return { session: s, action: { type: 'NOOP' } };
      }
      return { session: s, action: { type: 'POLL_HORIZON' } };

    case 'BALANCE_CHANGED':
      if (s.step !== STEPS.POLLING_BALANCE) {
        return { session: s, action: { type: 'NOOP' } };
      }
      s.step = STEPS.COMPLETE;
      return { session: s, action: { type: 'SEND_DEPOSIT_CONFIRMED' } };

    case 'BALANCE_UNCHANGED':
      if (s.step !== STEPS.POLLING_BALANCE) {
        return { session: s, action: { type: 'NOOP' } };
      }
      return { session: s, action: { type: 'KEEP_POLLING' } };

    case 'RESET':
      return { session: createSession({ lang: s.lang }), action: { type: 'SEND_WALLET_INTRO' } };

    default:
      // Unknown event types never mutate state.
      return { session: s, action: { type: 'NOOP' } };
  }
}

/** Is free-text at this step "in-flow" input, or should it be routed to the LLM Q&A helper? */
function expectsStructuredInput(step) {
  return step === STEPS.AWAITING_PUBKEY || step === STEPS.AWAITING_ANCHOR;
}

module.exports = {
  STEPS,
  ORDER,
  createSession,
  reduce,
  isValidPublicKey,
  looksLikeSecretKey,
  expectsStructuredInput,
};
