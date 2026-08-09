'use strict';

/**
 * Lightweight language detection: Telegram gives us `language_code` from
 * the user's client settings, which we trust as the primary signal. We
 * also do a cheap keyword sniff on free-text so a Spanish-speaking user
 * with an English client still gets Spanish replies if they type Spanish.
 */

const SUPPORTED = ['en', 'es', 'tl'];

const KEYWORD_HINTS = {
  es: ['hola', 'que es', 'qué es', 'cómo', 'como', 'gracias', 'billetera', 'depósito', 'deposito'],
  tl: ['kumusta', 'ano ang', 'paano', 'salamat', 'wallet', 'pera', 'padala'],
};

function detectFromTelegramCode(code) {
  if (!code) return null;
  const base = code.split('-')[0].toLowerCase();
  return SUPPORTED.includes(base) ? base : null;
}

function detectFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [lang, keywords] of Object.entries(KEYWORD_HINTS)) {
    if (keywords.some((k) => lower.includes(k))) return lang;
  }
  return null;
}

/**
 * Resolve the language to use: explicit text hint > telegram client code >
 * existing session language > default 'en'.
 */
function resolveLanguage({ telegramCode, text, currentLang } = {}) {
  return (
    detectFromText(text) ||
    detectFromTelegramCode(telegramCode) ||
    currentLang ||
    'en'
  );
}

module.exports = { SUPPORTED, detectFromTelegramCode, detectFromText, resolveLanguage };
