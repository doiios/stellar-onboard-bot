'use strict';

/**
 * Registry of known SEP-24 anchors.
 *
 * `homeDomain` is used for SEP-1 (stellar.toml) discovery, which yields the
 * anchor's SEP-10 auth endpoint and SEP-24 transfer server. We never
 * hardcode anchor endpoints beyond the home domain — always resolve fresh
 * from stellar.toml, since anchors can rotate infrastructure.
 *
 * network: 'TESTNET' | 'PUBLIC' — the MVP is tested end-to-end against the
 * official Stellar reference anchor on testnet before any mainnet anchor
 * is enabled by default.
 */
const ANCHORS = [
  {
    id: 'testanchor',
    name: 'Stellar Test Anchor (reference implementation)',
    homeDomain: 'testanchor.stellar.org',
    network: 'TESTNET',
    assetCode: 'SRT',
    description: {
      en: 'Official Stellar reference anchor used for testing SEP-24 deposits and withdrawals. Good for trying the flow risk-free.',
      es: 'Anchor de referencia oficial de Stellar usado para probar depósitos y retiros SEP-24. Ideal para probar el flujo sin riesgo.',
      tl: 'Opisyal na reference anchor ng Stellar para sa pagsubok ng SEP-24 deposits at withdrawals. Maganda para subukan nang walang risk.',
    },
  },
  // Additional PUBLIC-network anchors (e.g. MoneyGram Access, Vibrant,
  // Settle Network, Cowrie) belong here once the testnet flow above has
  // been verified end-to-end. See README "Adding a new anchor".
];

function listAnchors(network = 'TESTNET') {
  return ANCHORS.filter((a) => a.network === network);
}

function getAnchorById(id) {
  return ANCHORS.find((a) => a.id === id) || null;
}

module.exports = { ANCHORS, listAnchors, getAnchorById };
