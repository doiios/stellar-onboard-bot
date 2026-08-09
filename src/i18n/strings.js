'use strict';

const STRINGS = {
  en: {
    welcome:
      "Welcome! I'll help you get set up to use the Stellar network for fast, low-cost transfers.\n\nStep 1: a Stellar wallet.\n\nA wallet is an app that holds your Stellar address and lets you approve transactions. I will never ask you for your seed phrase or private key -- only your wallet app ever sees those.\n\nWe recommend Freighter (browser extension): https://www.freighter.app/\n\nInstall it, create a wallet, and reply with anything once you're ready.",
    askPubkey:
      "Great. Now paste your PUBLIC key -- it starts with the letter G and is 56 characters long. You can find it in Freighter under your account name.\n\nWARNING: Never paste a secret key (starts with S) or a 12/24-word recovery phrase here. I will refuse it and it should never leave your wallet app.",
    invalidPubkey:
      "That doesn't look like a valid Stellar public key. It should start with 'G' and be 56 characters. Please copy it again from your wallet.",
    refuseSecret:
      "WARNING: That looks like a secret key or recovery phrase. Please don't paste it anywhere, including here -- I will never ask for it and I don't store it. If you already sent it to me, treat that wallet as compromised and create a new one in Freighter.",
    anchorIntro:
      "Step 2: anchors.\n\nAn anchor is a regulated on/off-ramp that lets you deposit local currency (like USD, EUR, or PHP) and receive a matching digital asset on Stellar, or the reverse. Anchors handle identity verification (KYC) directly -- I never see or store your documents, I only send you to their official hosted page.",
    listAnchorsHeader: 'Known SEP-24 anchors:',
    depositLinkSent:
      "Opening the connect page -- it will ask your wallet to approve a login, then hand you off to the anchor's official deposit page. Complete any KYC steps directly with them; I'm not involved in that part.\n\n{url}",
    pollingStarted:
      "I'll keep an eye on your Stellar account and let you know the moment the deposit lands. This can take a few minutes depending on the anchor.",
    depositConfirmed:
      "Deposit confirmed! Your balance just increased on-chain. You're fully onboarded to Stellar. Type /start anytime to onboard another anchor.",
    reset: "Let's start fresh.",
  },
  es: {
    welcome:
      "Bienvenido/a! Te ayudare a configurar todo para usar la red Stellar y hacer transferencias rapidas y de bajo costo.\n\nPaso 1: una wallet de Stellar.\n\nUna wallet es una app que guarda tu direccion de Stellar y te permite aprobar transacciones. Nunca te pedire tu frase semilla ni tu clave privada -- solo tu wallet debe verlas.\n\nRecomendamos Freighter (extension de navegador): https://www.freighter.app/\n\nInstalala, crea una wallet, y responde cualquier cosa cuando estes listo/a.",
    askPubkey:
      "Perfecto. Ahora pega tu clave PUBLICA -- empieza con la letra G y tiene 56 caracteres. La encuentras en Freighter bajo el nombre de tu cuenta.\n\nAVISO: Nunca pegues aqui una clave secreta (empieza con S) ni una frase de recuperacion de 12/24 palabras. La voy a rechazar y nunca deberia salir de tu wallet.",
    invalidPubkey:
      "Eso no parece una clave publica valida de Stellar. Debe empezar con 'G' y tener 56 caracteres. Copiala de nuevo desde tu wallet.",
    refuseSecret:
      "AVISO: Eso parece una clave secreta o frase de recuperacion. Por favor no la pegues en ningun lugar, ni aqui -- nunca la voy a pedir ni la almaceno. Si ya me la enviaste, considera esa wallet comprometida y crea una nueva en Freighter.",
    anchorIntro:
      "Paso 2: anchors.\n\nUn anchor es una entidad regulada que te permite depositar moneda local (como USD, EUR o PHP) y recibir un activo digital equivalente en Stellar, o viceversa. Los anchors manejan la verificacion de identidad (KYC) directamente -- yo nunca veo ni guardo tus documentos, solo te envio a su pagina oficial.",
    listAnchorsHeader: 'Anchors SEP-24 conocidos:',
    depositLinkSent:
      "Abriendo la pagina de conexion -- le pedira a tu wallet que apruebe un inicio de sesion, y luego te llevara a la pagina oficial de deposito del anchor. Completa los pasos de KYC directamente con ellos; yo no participo en esa parte.\n\n{url}",
    pollingStarted:
      "Estare pendiente de tu cuenta de Stellar y te avisare en cuanto llegue el deposito. Puede tardar unos minutos segun el anchor.",
    depositConfirmed:
      "Deposito confirmado! Tu saldo acaba de aumentar on-chain. Ya estas completamente integrado a Stellar. Escribe /start cuando quieras usar otro anchor.",
    reset: 'Empecemos de nuevo.',
  },
  tl: {
    welcome:
      "Maligayang pagdating! Tutulungan kita mag-set up para gamitin ang Stellar network para sa mabilis at mura na padala ng pera.\n\nHakbang 1: Stellar wallet.\n\nAng wallet ay isang app na nag-iimbak ng iyong Stellar address at nagpapahintulot sa iyong aprubahan ang mga transaksyon. Hinding-hindi kita hihingan ng seed phrase o private key -- ang wallet app mo lang dapat may makakakita niyan.\n\nInirerekomenda namin ang Freighter (browser extension): https://www.freighter.app/\n\nI-install ito, gumawa ng wallet, at mag-reply kapag handa ka na.",
    askPubkey:
      "Ayos. Ngayon i-paste ang iyong PUBLIC key -- nagsisimula ito sa letrang G at 56 characters ang haba. Makikita mo ito sa Freighter sa ilalim ng pangalan ng account mo.\n\nBABALA: Huwag kailanman i-paste ang secret key (nagsisimula sa S) o 12/24-word recovery phrase dito. Tatanggihan ko ito at hindi dapat ito lumabas sa wallet app mo.",
    invalidPubkey:
      "Mukhang hindi valid na Stellar public key iyan. Dapat magsimula ito sa 'G' at 56 characters ang haba. Paki-copy ulit mula sa wallet mo.",
    refuseSecret:
      "BABALA: Mukhang secret key o recovery phrase iyan. Pakiusap huwag i-paste kahit saan, kasama na dito -- hindi ko ito hihingin at hindi ko ito iniimbak. Kung naipadala mo na sa akin, ituring mong nakompromiso na ang wallet na iyon at gumawa ng bago sa Freighter.",
    anchorIntro:
      "Hakbang 2: mga anchor.\n\nAng anchor ay isang regulated na on/off-ramp na nagpapahintulot sa iyong mag-deposit ng local currency (tulad ng USD, EUR, o PHP) at makatanggap ng katumbas na digital asset sa Stellar, o kabaliktaran. Ang mga anchor mismo ang humahawak ng identity verification (KYC) -- hindi ko nakikita o iniimbak ang mga dokumento mo, ipapadala lang kita sa opisyal nilang page.",
    listAnchorsHeader: 'Mga kilalang SEP-24 anchor:',
    depositLinkSent:
      "Binubuksan ang connect page -- hihingin nito sa wallet mo na aprubahan ang login, pagkatapos ay dadalhin ka sa opisyal na deposit page ng anchor. Kumpletuhin ang anumang hakbang ng KYC direkta sa kanila; wala akong kinalaman doon.\n\n{url}",
    pollingStarted:
      "Susubaybayan ko ang Stellar account mo at aabisuhan kita agad kapag dumating na ang deposit. Maaaring tumagal ito ng ilang minuto depende sa anchor.",
    depositConfirmed:
      "Nakumpirma na ang deposit! Tumaas na lang ang balanse mo on-chain. Kumpleto ka nang naka-onboard sa Stellar. I-type ang /start anumang oras para mag-onboard sa ibang anchor.",
    reset: 'Magsimula tayo ulit.',
  },
};

function t(lang, key, vars = {}) {
  const table = STRINGS[lang] || STRINGS.en;
  let str = table[key] || STRINGS.en[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

module.exports = { STRINGS, t };
