'use strict';

/**
 * SEP-24 helper: stellar.toml discovery + building the deep link that hands
 * off to the companion web app (see /webapp) where SEP-10 signing happens.
 *
 * IMPORTANT — the safety boundary:
 *   This module NEVER asks for, receives, or stores a private key or seed
 *   phrase. SEP-10 authentication requires signing a challenge transaction,
 *   and that signing must happen with the user's own wallet (Freighter,
 *   Albedo, xBull, etc). We do not implement, and will not accept a PR that
 *   implements, server-side signing of any kind.
 *
 * Flow:
 *   1. Resolve the anchor's stellar.toml (SEP-1) to find:
 *        - WEB_AUTH_ENDPOINT       (SEP-10)
 *        - TRANSFER_SERVER_SEP0024 (SEP-24)
 *   2. Build a URL to the companion web app, passing only PUBLIC data
 *      (home domain, public key, asset code). The web app performs SEP-10
 *      signing client-side via the user's wallet extension, calls the
 *      anchor's /transactions/deposit/interactive, and redirects the
 *      browser into the anchor's hosted interactive KYC/deposit UI.
 */

const TOML_CACHE_TTL_MS = 5 * 60 * 1000;
const tomlCache = new Map(); // homeDomain -> { toml, fetchedAt }

async function fetchStellarToml(homeDomain, fetchImpl = fetch) {
  const cached = tomlCache.get(homeDomain);
  if (cached && Date.now() - cached.fetchedAt < TOML_CACHE_TTL_MS) {
    return cached.toml;
  }

  const url = `https://${homeDomain}/.well-known/stellar.toml`;
  const res = await fetchImpl(url, { headers: { Accept: 'text/plain' } });
  if (!res.ok) {
    throw new Error(`Failed to fetch stellar.toml for ${homeDomain}: HTTP ${res.status}`);
  }
  const text = await res.text();
  const toml = parseMinimalToml(text);
  tomlCache.set(homeDomain, { toml, fetchedAt: Date.now() });
  return toml;
}

/**
 * Minimal TOML key extraction — we only need a handful of top-level
 * string keys out of stellar.toml, so we avoid pulling in a full TOML
 * parser dependency (keeps the dependency surface small, which matters
 * since this project is built/tested entirely through CI, not locally).
 */
function parseMinimalToml(text) {
  const out = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$/);
    if (m) {
      out[m[1]] = m[2];
    }
  }
  return out;
}

async function resolveAnchorEndpoints(homeDomain, fetchImpl = fetch) {
  const toml = await fetchStellarToml(homeDomain, fetchImpl);
  const webAuthEndpoint = toml.WEB_AUTH_ENDPOINT;
  const transferServerSep24 = toml.TRANSFER_SERVER_SEP0024;
  if (!webAuthEndpoint || !transferServerSep24) {
    throw new Error(
      `${homeDomain} does not advertise SEP-10/SEP-24 endpoints in stellar.toml`
    );
  }
  return { webAuthEndpoint, transferServerSep24 };
}

/**
 * Build the hand-off URL to the companion web app. The web app repo lives
 * in /webapp and is meant to be hosted statically (e.g. GitHub Pages),
 * which fits a browser-only publishing workflow (no build step required
 * beyond what GitHub Pages runs itself).
 */
function buildDepositHandoffUrl({ webAppBaseUrl, homeDomain, publicKey, assetCode, lang }) {
  const params = new URLSearchParams({
    home_domain: homeDomain,
    account: publicKey,
    asset_code: assetCode,
    lang: lang || 'en',
  });
  return `${webAppBaseUrl}/?${params.toString()}`;
}

module.exports = {
  fetchStellarToml,
  resolveAnchorEndpoints,
  buildDepositHandoffUrl,
  parseMinimalToml,
};
