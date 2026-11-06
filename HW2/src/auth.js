import { randomToken } from './security.js';

export class SessionStore {
  constructor(ttlMs = 8 * 60 * 60 * 1000) {
    this.ttlMs = ttlMs;
    this.sessions = new Map();
  }

  create(userId) {
    const token = randomToken();
    this.sessions.set(token, { userId, expiresAt: Date.now() + this.ttlMs });
    if (this.sessions.size > 5000) {
      for (const [key, value] of this.sessions) {
        if (value.expiresAt <= Date.now()) this.sessions.delete(key);
      }
    }
    return token;
  }

  get(token) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }
    return session.userId;
  }

  destroy(token) {
    this.sessions.delete(token);
  }

  destroyUser(userId) {
    for (const [token, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(token);
    }
  }
}
