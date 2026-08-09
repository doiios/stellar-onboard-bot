'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STEPS,
  createSession,
  reduce,
  isValidPublicKey,
  looksLikeSecretKey,
} = require('../src/flow/stateMachine');

const VALID_PUBKEY = 'G' + 'A'.repeat(55); // 56 chars total, valid base32 alphabet
const VALID_SECRET = 'S' + 'A'.repeat(55); // 56 chars total, valid base32 alphabet

test('starts at START and moves to WALLET_INTRO on START event', () => {
  const session = createSession();
  const { session: next, action } = reduce(session, { type: 'START' });
  assert.equal(next.step, STEPS.WALLET_INTRO);
  assert.equal(action.type, 'SEND_WALLET_INTRO');
});

test('full happy path drives through every step in order', () => {
  let session = createSession();
  ({ session } = reduce(session, { type: 'START' }));
  assert.equal(session.step, STEPS.WALLET_INTRO);

  ({ session } = reduce(session, { type: 'WALLET_ACK' }));
  assert.equal(session.step, STEPS.AWAITING_PUBKEY);

  let result = reduce(session, { type: 'PUBKEY_SUBMITTED', payload: VALID_PUBKEY });
  session = result.session;
  assert.equal(session.step, STEPS.ANCHOR_INTRO);
  assert.equal(session.publicKey, VALID_PUBKEY);

  ({ session } = reduce(session, { type: 'ANCHOR_INTRO_ACK' }));
  assert.equal(session.step, STEPS.AWAITING_ANCHOR);

  result = reduce(session, { type: 'ANCHOR_SELECTED', payload: { anchorId: 'testanchor' } });
  session = result.session;
  assert.equal(session.step, STEPS.DEPOSIT_LINK_SENT);
  assert.equal(result.action.type, 'INITIATE_SEP24_DEPOSIT');

  result = reduce(session, {
    type: 'DEPOSIT_INITIATED',
    payload: { depositId: 'x', startBalance: [], url: 'https://example.com' },
  });
  session = result.session;
  assert.equal(session.step, STEPS.POLLING_BALANCE);

  result = reduce(session, { type: 'BALANCE_CHANGED' });
  assert.equal(result.session.step, STEPS.COMPLETE);
  assert.equal(result.action.type, 'SEND_DEPOSIT_CONFIRMED');
});

test('rejects a secret key at the pubkey step and never stores it', () => {
  let session = createSession({ step: STEPS.AWAITING_PUBKEY });
  const { session: next, action } = reduce(session, {
    type: 'PUBKEY_SUBMITTED',
    payload: VALID_SECRET,
  });
  assert.equal(action.type, 'REFUSE_SECRET');
  assert.equal(next.publicKey, null);
});

test('rejects a 12-word seed phrase at the pubkey step', () => {
  const seed = 'apple banana cherry delta egret finch grape hotel igloo jelly kiwi lemon';
  let session = createSession({ step: STEPS.AWAITING_PUBKEY });
  const { session: next, action } = reduce(session, {
    type: 'PUBKEY_SUBMITTED',
    payload: seed,
  });
  assert.equal(action.type, 'REFUSE_SECRET');
  assert.equal(next.publicKey, null);
});

test('SECRET_DETECTED refuses regardless of current step', () => {
  for (const step of Object.values(STEPS)) {
    const session = createSession({ step });
    const { action } = reduce(session, { type: 'SECRET_DETECTED' });
    assert.equal(action.type, 'REFUSE_SECRET');
  }
});

test('rejects malformed public keys with INVALID_PUBKEY', () => {
  let session = createSession({ step: STEPS.AWAITING_PUBKEY });
  const { action } = reduce(session, { type: 'PUBKEY_SUBMITTED', payload: 'not-a-key' });
  assert.equal(action.type, 'INVALID_PUBKEY');
});

test('events for the wrong step are ignored (NOOP) and do not mutate step', () => {
  const session = createSession({ step: STEPS.START });
  const { session: next, action } = reduce(session, {
    type: 'PUBKEY_SUBMITTED',
    payload: VALID_PUBKEY,
  });
  assert.equal(action.type, 'NOOP');
  assert.equal(next.step, STEPS.START);
});

test('RESET returns to a fresh session but keeps language', () => {
  const session = createSession({ step: STEPS.COMPLETE, lang: 'es', publicKey: VALID_PUBKEY });
  const { session: next, action } = reduce(session, { type: 'RESET' });
  assert.equal(next.step, STEPS.START);
  assert.equal(next.lang, 'es');
  assert.equal(next.publicKey, null);
  assert.equal(action.type, 'SEND_WALLET_INTRO');
});

test('isValidPublicKey / looksLikeSecretKey helpers', () => {
  assert.equal(isValidPublicKey(VALID_PUBKEY), true);
  assert.equal(isValidPublicKey('GTOO_SHORT'), false);
  assert.equal(looksLikeSecretKey(VALID_SECRET), true);
  assert.equal(looksLikeSecretKey(VALID_PUBKEY), false);
});
