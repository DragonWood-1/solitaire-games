/* SolitaireRealm - Storage Manager */
'use strict';

class StorageManager {
  constructor() {
    this._prefix = 'solitaire_realm_';
    this._available = this._checkAvailable();
  }

  _checkAvailable() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  _key(name) {
    return this._prefix + name;
  }

  _get(name) {
    if (!this._available) return null;
    try {
      const val = localStorage.getItem(this._key(name));
      if (val === null) return null;
      return JSON.parse(val);
    } catch (e) {
      return null;
    }
  }

  _set(name, value) {
    if (!this._available) return false;
    try {
      localStorage.setItem(this._key(name), JSON.stringify(value));
      return true;
    } catch (e) {
      // Storage may be full
      if (e.name === 'QuotaExceededError') {
        // Try to clear old data
        try {
          this._clearNonEssential();
          localStorage.setItem(this._key(name), JSON.stringify(value));
          return true;
        } catch (e2) {
          return false;
        }
      }
      return false;
    }
  }

  _remove(name) {
    if (!this._available) return;
    try { localStorage.removeItem(this._key(name)); } catch (e) {}
  }

  _clearNonEssential() {
    // Remove saved game to free space, keep progression/stats
    this._remove('saved_game');
  }

  // ==========================================
  // Game Save/Load
  // ==========================================
  saveGame(gameState) {
    try {
      const data = gameState.toJSON();
      return this._set('saved_game', data);
    } catch (e) {
      return false;
    }
  }

  loadGame() {
    return this._get('saved_game');
  }

  clearSavedGame() {
    this._remove('saved_game');
  }

  hasSavedGame() {
    const data = this._get('saved_game');
    return data !== null && !data.gameOver;
  }

  // ==========================================
  // Stats
  // ==========================================
  saveStats(stats) {
    return this._set('stats', stats);
  }

  loadStats() {
    const defaults = {
      gamesPlayed: 0,
      gamesWon: 0,
      totalTime: 0,
      totalMoves: 0,
      bestTime: null,
      bestScore: 0,
    };
    const saved = this._get('stats');
    return saved ? { ...defaults, ...saved } : defaults;
  }

  // ==========================================
  // Settings
  // ==========================================
  saveSettings(settings) {
    return this._set('settings', settings);
  }

  loadSettings() {
    const defaults = {
      drawMode: 1,
      scoringMode: 'standard',
      autoFlip: true,
      leftHanded: false,
      animationSpeed: 'normal',
      soundEnabled: true,
      volume: 0.7,
      ambientSound: 'none',
      theme: 'cyberpunk',
    };
    const saved = this._get('settings');
    return saved ? { ...defaults, ...saved } : defaults;
  }

  // ==========================================
  // Progression
  // ==========================================
  saveProgression(progression) {
    try {
      const data = progression.toJSON();
      return this._set('progression', data);
    } catch (e) {
      return false;
    }
  }

  loadProgression() {
    return this._get('progression');
  }

  // ==========================================
  // Daily Challenge
  // ==========================================
  saveDailyResult(dateStr, result) {
    const key = `daily_${dateStr}`;
    return this._set(key, result);
  }

  loadDailyResult(dateStr) {
    return this._get(`daily_${dateStr}`);
  }

  hasDailyBeenPlayed(dateStr) {
    return this._get(`daily_${dateStr}`) !== null;
  }

  // ==========================================
  // Clear All
  // ==========================================
  clearAll() {
    if (!this._available) return;
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this._prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }
}

window.StorageManager = StorageManager;
