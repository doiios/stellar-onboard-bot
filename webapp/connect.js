// Runs entirely in the user's browser. Never sends a secret key or seed
// phrase anywhere — signing happens inside the Freighter extension, which
// only returns a *signed transaction envelope*, not the key itself.

(function () {
  const qs = new URLSearchParams(window.location.search);
  const homeDomain = qs.get('home_domain');
  const account = qs.get('account');
  const assetCode = qs.get('asset_code');
  const lang = qs.get('lang') || 'en';

  const statusEl = document.getElementById('status');
  const contextEl = document.getElementById('context');
  const btn = document.getElementById('connectBtn');

  const COPY = {
    en: {
      missing: 'Missing link parameters — please restart from the Telegram bot.',
      ctx: (d, a) => `Anchor: ${d}\nAsset: ${a}\nWe'll ask your wallet to sign a login challenge (SEP-10). No funds move during this step.`,
      noFreighter: 'Freighter wallet extension not found. Install it, then reopen this link.',
      connecting: 'Requesting SEP-10 challenge from anchor…',
      signing: 'Waiting for you to approve the signature in Freighter…',
      submitting: 'Submitting signed challenge, opening deposit flow…',
      error: 'Something went wrong: ',
    },
    es: {
      missing: 'Faltan parámetros del enlace — reinicia desde el bot de Telegram.',
      ctx: (d, a) => `Anchor: ${d}\nActivo: ${a}\nLe pediremos a tu wallet que firme un desafío de inicio de sesión (SEP-10). No se mueven fondos en este paso.`,
      noFreighter: 'No se encontró la extensión Freighter. Instálala y vuelve a abrir este enlace.',
      connecting: 'Solicitando desafío SEP-10 al anchor…',
      signing: 'Esperando tu aprobación de la firma en Freighter…',
      submitting: 'Enviando el desafío firmado, abriendo el flujo de depósito…',
      error: 'Algo salió mal: ',
    },
    tl: {
      missing: 'Kulang ang mga parameter ng link — mag-restart mula sa Telegram bot.',
      ctx: (d, a) => `Anchor: ${d}\nAsset: ${a}\nHihilingin naming pirmahan ng wallet mo ang login challenge (SEP-10). Walang gagalaw na pera sa hakbang na ito.`,
      noFreighter: 'Hindi nahanap ang Freighter wallet extension. I-install ito, pagkatapos buksan ulit ang link na ito.',
      connecting: 'Humihiling ng SEP-10 challenge mula sa anchor…',
      signing: 'Hinihintay ang iyong pag-apruba ng pirma sa Freighter…',
      submitting: 'Isinusumite ang napirmahang challenge, binubuksan ang deposit flow…',
      error: 'May nangyaring mali: ',
    },
  };

  const t = COPY[lang] || COPY.en;

  if (!homeDomain || !account || !assetCode) {
    statusEl.textContent = t.missing;
    return;
  }

  contextEl.textContent = t.ctx(homeDomain, assetCode);

  async function resolveToml(domain) {
    const res = await fetch(`https://${domain}/.well-known/stellar.toml`);
    const text = await res.text();
    const get = (key) => {
      const m = text.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
      return m ? m[1] : null;
    };
    return {
      webAuthEndpoint: get('WEB_AUTH_ENDPOINT'),
      transferServer: get('TRANSFER_SERVER_SEP0024'),
      signingKey: get('SIGNING_KEY'),
    };
  }

  async function run() {
    try {
      if (!window.freighterApi) {
        statusEl.textContent = t.noFreighter;
        const link = document.createElement('a');
        link.href = 'https://www.freighter.app/';
        link.textContent = 'freighter.app';
        link.target = '_blank';
        statusEl.appendChild(document.createElement('br'));
        statusEl.appendChild(link);
        return;
      }

      btn.disabled = true;
      statusEl.textContent = t.connecting;
      const { webAuthEndpoint, transferServer } = await resolveToml(homeDomain);
      if (!webAuthEndpoint || !transferServer) {
        throw new Error('Anchor does not advertise SEP-10/SEP-24 endpoints');
      }

      // SEP-10 step 1: get a challenge transaction (XDR) from the anchor.
      const challengeRes = await fetch(
        `${webAuthEndpoint}?account=${encodeURIComponent(account)}&home_domain=${encodeURIComponent(homeDomain)}`
      );
      const { transaction } = await challengeRes.json();

      // SEP-10 step 2: ask the user's own wallet extension to sign it.
      // freighterApi.signTransaction never exposes the secret key to this
      // page — it opens the extension's own approval UI.
      statusEl.textContent = t.signing;
      const signedXDR = await window.freighterApi.signTransaction(transaction, {
        networkPassphrase: await window.freighterApi.getNetworkDetails().then((d) => d.networkPassphrase),
        accountToSign: account,
      });

      // SEP-10 step 3: submit the signed challenge to get a JWT.
      statusEl.textContent = t.submitting;
      const tokenRes = await fetch(webAuthEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: signedXDR }),
      });
      const { token } = await tokenRes.json();

      // SEP-24: kick off the interactive deposit using the JWT. This
      // returns a `url` + `id`; we redirect the browser straight there.
      // The anchor's own hosted page collects KYC, not us.
      const depositRes = await fetch(`${transferServer}/transactions/deposit/interactive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${token}`,
        },
        body: new URLSearchParams({ asset_code: assetCode, account }),
      });
      const deposit = await depositRes.json();

      if (deposit.url) {
        window.location.href = deposit.url;
      } else {
        throw new Error('Anchor did not return an interactive URL');
      }
    } catch (err) {
      statusEl.textContent = t.error + (err && err.message ? err.message : String(err));
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', run);
  btn.disabled = false;
  btn.textContent = 'Connect Freighter & Continue';
})();
