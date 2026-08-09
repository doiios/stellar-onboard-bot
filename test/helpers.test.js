'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { balanceIncreased } = require('../src/horizon');
const { resolveLanguage, detectFromTelegramCode, detectFromText } = require('../src/i18n/detect');
const { parseMinimalToml } = require('../src/anchors/sep24');

test('balanceIncreased detects a new higher balance', () => {
  const before = [{ assetCode: 'XLM', balance: '10.0000000' }];
  const after = [{ assetCode: 'XLM', balance: '15.0000000' }];
  assert.equal(balanceIncreased(before, after), true);
});

test('balanceIncreased is false when nothing changed', () => {
  const before = [{ assetCode: 'XLM', balance: '10.0000000' }];
  const after = [{ assetCode: 'XLM', balance: '10.0000000' }];
  assert.equal(balanceIncreased(before, after), false);
});

test('balanceIncreased detects a brand new asset line appearing', () => {
  const before = [{ assetCode: 'XLM', balance: '10.0000000' }];
  const after = [
    { assetCode: 'XLM', balance: '10.0000000' },
    { assetCode: 'SRT', balance: '5.0000000' },
  ];
  assert.equal(balanceIncreased(before, after), true);
});

test('detectFromTelegramCode maps supported client codes', () => {
  assert.equal(detectFromTelegramCode('es-ES'), 'es');
  assert.equal(detectFromTelegramCode('tl'), 'tl');
  assert.equal(detectFromTelegramCode('fr'), null);
  assert.equal(detectFromTelegramCode(null), null);
});

test('detectFromText picks up Spanish and Tagalog keywords', () => {
  assert.equal(detectFromText('Hola, que es una wallet?'), 'es');
  assert.equal(detectFromText('Kumusta, ano ang wallet?'), 'tl');
  assert.equal(detectFromText('hello there'), null);
});

test('resolveLanguage prioritizes text hints over telegram client code', () => {
  const lang = resolveLanguage({ telegramCode: 'en', text: 'hola amigo', currentLang: 'en' });
  assert.equal(lang, 'es');
});

test('resolveLanguage falls back to currentLang then default en', () => {
  assert.equal(resolveLanguage({ currentLang: 'tl' }), 'tl');
  assert.equal(resolveLanguage({}), 'en');
});

test('parseMinimalToml extracts SEP endpoints from a toml snippet', () => {
  const toml = `
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
    WEB_AUTH_ENDPOINT="https://testanchor.stellar.org/auth"
    TRANSFER_SERVER_SEP0024="https://testanchor.stellar.org/sep24"
  `;
  const parsed = parseMinimalToml(toml);
  assert.equal(parsed.WEB_AUTH_ENDPOINT, 'https://testanchor.stellar.org/auth');
  assert.equal(parsed.TRANSFER_SERVER_SEP0024, 'https://testanchor.stellar.org/sep24');
});
