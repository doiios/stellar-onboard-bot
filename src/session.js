'use strict';

const { createSession } = require('../flow/stateMachine');

/**
 * In-memory session store, keyed by Telegram chat id.
 *
 * MVP scope note: this resets on process restart. That's an acceptable
 * trade-off for the hackathon MVP since the only state held is a PUBLIC
 * key + flow position, never anything secret. Swapping this for Redis or
 * SQLite is a good "second wave" issue (see ISSUES.md) once the flow
 * itself is proven against a real anchor.
 */
class SessionStore {
  constructor() {
    this.sessions = new Map();
  }

  get(chatId) {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, createSession());
    }
    return this.sessions.get(chatId);
  }

  set(chatId, session) {
    this.sessions.set(chatId, session);
    return session;
  }
}

module.exports = { SessionStore };
