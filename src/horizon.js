'use strict';

/**
 * Polls a PUBLIC Stellar account's balances via Horizon. Only ever reads
 * public ledger data — no authentication, no keys, nothing sensitive.
 */

const HORIZON_URLS = {
  TESTNET: 'https://horizon-testnet.stellar.org',
  PUBLIC: 'https://horizon.stellar.org',
};

async function getBalances(publicKey, network = 'TESTNET', fetchImpl = fetch) {
  const base = HORIZON_URLS[network];
  const res = await fetchImpl(`${base}/accounts/${publicKey}`);
  if (res.status === 404) {
    // Unfunded account — valid state, just means no balances yet.
    return [];
  }
  if (!res.ok) {
    throw new Error(`Horizon error ${res.status} for ${publicKey}`);
  }
  const data = await res.json();
  return (data.balances || []).map((b) => ({
    assetCode: b.asset_code || (b.asset_type === 'native' ? 'XLM' : b.asset_type),
    balance: b.balance,
  }));
}

/** Diff two balance snapshots; returns true if anything increased. */
function balanceIncreased(before, after) {
  const beforeMap = new Map(before.map((b) => [b.assetCode, parseFloat(b.balance)]));
  for (const b of after) {
    const prev = beforeMap.get(b.assetCode) ?? 0;
    if (parseFloat(b.balance) > prev) return true;
  }
  return false;
}

/**
 * Poll until balance increases or timeout. Caller supplies `sleep` and
 * `now` so this is testable without real timers.
 */
async function pollForDeposit({
  publicKey,
  network = 'TESTNET',
  startBalance,
  intervalMs = 15000,
  timeoutMs = 30 * 60 * 1000,
  fetchImpl = fetch,
  sleepImpl = (ms) => new Promise((r) => setTimeout(r, ms)),
  nowImpl = () => Date.now(),
  onTick,
}) {
  const deadline = nowImpl() + timeoutMs;
  while (nowImpl() < deadline) {
    const current = await getBalances(publicKey, network, fetchImpl);
    if (balanceIncreased(startBalance, current)) {
      return { deposited: true, balances: current };
    }
    if (onTick) onTick(current);
    await sleepImpl(intervalMs);
  }
  return { deposited: false, balances: null };
}

module.exports = { getBalances, balanceIncreased, pollForDeposit, HORIZON_URLS };
