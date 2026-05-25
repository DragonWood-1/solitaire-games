/* SolitaireRealm - Progression System */
'use strict';

class ProgressionSystem {
  constructor() {
    this.level = 1;
    this.xp = 0;
    this.unlockedAchievements = new Set();
    this.streak = 0;
    this.lastPlayDate = null;
    this.longestStreak = 0;
    this.gamesPlayed = 0;
    this.gamesWon = 0;
    this.totalMoves = 0;
    this.totalTime = 0;
    this.bestTime = null;
    this.bestScore = 0;
    this.dailiesCompleted = new Set();

    this.RANKS = [
      { minLevel: 1, name: 'Bronze I' },
      { minLevel: 3, name: 'Bronze II' },
      { minLevel: 6, name: 'Bronze III' },
      { minLevel: 10, name: 'Silver I' },
      { minLevel: 15, name: 'Silver II' },
      { minLevel: 21, name: 'Silver III' },
      { minLevel: 28, name: 'Gold I' },
      { minLevel: 36, name: 'Gold II' },
      { minLevel: 45, name: 'Gold III' },
      { minLevel: 55, name: 'Platinum' },
      { minLevel: 70, name: 'Diamond' },
    ];

    this.ACHIEVEMENTS = [
      { id: 'first_win',          name: 'First Win',         desc: 'Win your first game',                   icon: '🏆', xp: 50 },
      { id: 'speed_demon',        name: 'Speed Demon',       desc: 'Win in under 2 minutes',                icon: '⚡', xp: 100 },
      { id: 'perfectionist',      name: 'Perfectionist',     desc: 'Win without using any hints',           icon: '✨', xp: 75 },
      { id: 'comeback_kid',       name: 'Comeback Kid',      desc: 'Win after using 5+ undos',             icon: '↩', xp: 80 },
      { id: 'lucky_streak',       name: 'Lucky Streak',      desc: 'Win 3 games in a row',                  icon: '🎯', xp: 100 },
      { id: 'daily_devotee',      name: 'Daily Devotee',     desc: 'Play 7 days in a row',                  icon: '📅', xp: 150 },
      { id: 'century_club',       name: 'Century Club',      desc: 'Play 100 games',                        icon: '💯', xp: 200 },
      { id: 'efficient',          name: 'Efficient',         desc: 'Win in under 100 moves',                icon: '🎯', xp: 100 },
      { id: 'no_undo',            name: 'No Undo',           desc: 'Win without using undo',                icon: '🔒', xp: 75 },
      { id: 'foundation_first',   name: 'Foundation First',  desc: 'Move 10 cards to foundations in one game', icon: '🏛', xp: 60 },
      { id: 'high_scorer',        name: 'High Scorer',       desc: 'Achieve a score of 500 or more',        icon: '⭐', xp: 100 },
      { id: 'quick_draw',         name: 'Quick Draw',        desc: 'Win in under 1 minute',                 icon: '🚀', xp: 200 },
      { id: 'week_warrior',       name: 'Week Warrior',      desc: 'Play 7 days straight',                  icon: '🗡', xp: 175 },
      { id: 'veteran',            name: 'Veteran',           desc: 'Play 50 games',                         icon: '🎖', xp: 125 },
      { id: 'grandmaster',        name: 'Grandmaster',       desc: 'Reach level 20',                        icon: '👑', xp: 300 },
      { id: 'ten_wins',           name: 'Winning Ways',      desc: 'Win 10 games total',                    icon: '🥇', xp: 100 },
      { id: 'daily_challenge',    name: 'Daily Hero',        desc: 'Complete a daily challenge',            icon: '📆', xp: 75 },
      { id: 'half_century',       name: 'Half Century',      desc: 'Win 50 games total',                    icon: '🌟', xp: 250 },
      { id: 'low_score_win',      name: 'Humble Victor',     desc: 'Win with fewer than 60 moves',          icon: '🎲', xp: 120 },
      { id: 'patience',           name: 'Patience',          desc: 'Play a game longer than 10 minutes',   icon: '⌛', xp: 50 },
      { id: 'theme_explorer',     name: 'Theme Explorer',    desc: 'Try 5 different themes',                icon: '🎨', xp: 50 },
      { id: 'triple_streak',      name: 'On Fire',           desc: 'Win 5 games in a row',                  icon: '🔥', xp: 150 },
    ];

    this._winStreak = 0;
    this._themesUsed = new Set();
  }

  // ==========================================
  // XP & Levels
  // ==========================================
  xpForLevel(n) {
    // Cumulative XP needed to reach level n
    let total = 0;
    for (let i = 1; i < n; i++) {
      total += Math.round(100 * i * 1.5);
    }
    return total;
  }

  xpToNextLevel() {
    return Math.round(100 * this.level * 1.5);
  }

  xpInCurrentLevel() {
    return this.xp - this.xpForLevel(this.level);
  }

  xpProgressPercent() {
    const needed = this.xpToNextLevel();
    const current = this.xpInCurrentLevel();
    return Math.min(100, Math.round((current / needed) * 100));
  }

  addXP(amount) {
    this.xp += amount;
    let leveled = false;
    let newLevel = this.level;

    while (this.xp >= this.xpForLevel(this.level + 1)) {
      this.level++;
      newLevel = this.level;
      leveled = true;
    }

    return { newLevel, leveled, xpAdded: amount };
  }

  calculateGameXP(score, timeMs, moves) {
    let xp = 50; // base

    // Score bonus
    xp += Math.floor(score / 10);

    // Speed bonus: faster = more XP
    const minutes = timeMs / 60000;
    if (minutes < 1) xp += 100;
    else if (minutes < 2) xp += 60;
    else if (minutes < 5) xp += 30;
    else if (minutes < 10) xp += 10;

    // Efficiency bonus: fewer moves = more XP
    if (moves < 60) xp += 50;
    else if (moves < 100) xp += 25;
    else if (moves < 150) xp += 10;

    return Math.max(10, xp);
  }

  getRank(level) {
    let rank = this.RANKS[0].name;
    for (const r of this.RANKS) {
      if (level >= r.minLevel) rank = r.name;
    }
    return rank;
  }

  getCurrentRank() {
    return this.getRank(this.level);
  }

  // ==========================================
  // Streak
  // ==========================================
  updateStreak(dateStr) {
    const today = dateStr || this._todayStr();

    if (!this.lastPlayDate) {
      this.streak = 1;
    } else if (this.lastPlayDate === today) {
      // Already played today - no change
    } else {
      const last = new Date(this.lastPlayDate);
      const now = new Date(today);
      const diff = Math.round((now - last) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        this.streak++;
      } else {
        this.streak = 1;
      }
    }

    if (this.streak > this.longestStreak) {
      this.longestStreak = this.streak;
    }

    this.lastPlayDate = today;
  }

  _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ==========================================
  // Achievements
  // ==========================================
  recordGame(won, stats) {
    // stats: { score, timeMs, moves, hintsUsed, undosUsed, foundationMoves, isDaily, dateStr }
    this.gamesPlayed++;
    if (won) {
      this.gamesWon++;
      this._winStreak++;
    } else {
      this._winStreak = 0;
    }
    if (stats.moves) this.totalMoves += stats.moves;
    if (stats.timeMs) this.totalTime += stats.timeMs;
    if (won && (this.bestTime === null || stats.timeMs < this.bestTime)) {
      this.bestTime = stats.timeMs;
    }
    if (won && stats.score > this.bestScore) {
      this.bestScore = stats.score;
    }
    if (stats.isDaily && stats.dateStr) {
      this.dailiesCompleted.add(stats.dateStr);
    }
    this.updateStreak(stats.dateStr);
  }

  recordThemeUsed(themeId) {
    this._themesUsed.add(themeId);
  }

  checkAchievements(gameStats) {
    // gameStats: { won, score, timeMs, moves, hintsUsed, undosUsed, foundationMoves, isDaily, dateStr }
    const newlyUnlocked = [];

    const check = (id, condition) => {
      if (condition && !this.unlockedAchievements.has(id)) {
        this.unlockedAchievements.add(id);
        const ach = this.ACHIEVEMENTS.find(a => a.id === id);
        if (ach) {
          newlyUnlocked.push(ach);
          this.addXP(ach.xp);
        }
      }
    };

    const won = gameStats.won;
    const { score, timeMs, moves, hintsUsed, undosUsed, foundationMoves, isDaily } = gameStats;

    // Win-based
    check('first_win', won);
    check('speed_demon', won && timeMs < 120000);
    check('quick_draw', won && timeMs < 60000);
    check('perfectionist', won && hintsUsed === 0);
    check('comeback_kid', won && undosUsed >= 5);
    check('efficient', won && moves < 100);
    check('low_score_win', won && moves < 60);
    check('no_undo', won && undosUsed === 0);
    check('high_scorer', won && score >= 500);

    // Foundation moves
    check('foundation_first', foundationMoves >= 10);

    // Games played count
    check('veteran', this.gamesPlayed >= 50);
    check('century_club', this.gamesPlayed >= 100);

    // Wins count
    check('ten_wins', this.gamesWon >= 10);
    check('half_century', this.gamesWon >= 50);

    // Streak
    check('lucky_streak', this._winStreak >= 3);
    check('triple_streak', this._winStreak >= 5);
    check('daily_devotee', this.streak >= 7);
    check('week_warrior', this.streak >= 7);

    // Level
    check('grandmaster', this.level >= 20);

    // Daily
    check('daily_challenge', isDaily && won);

    // Long game
    check('patience', timeMs >= 600000);

    // Themes
    check('theme_explorer', this._themesUsed.size >= 5);

    return newlyUnlocked;
  }

  getAchievementStatus(id) {
    return this.unlockedAchievements.has(id);
  }

  getAllAchievements() {
    return this.ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: this.unlockedAchievements.has(a.id)
    }));
  }

  getStats() {
    return {
      gamesPlayed: this.gamesPlayed,
      gamesWon: this.gamesWon,
      winRate: this.gamesPlayed > 0 ? Math.round((this.gamesWon / this.gamesPlayed) * 100) : 0,
      avgTime: this.gamesWon > 0 ? Math.round(this.totalTime / this.gamesWon) : 0,
      bestTime: this.bestTime,
      bestScore: this.bestScore,
      currentStreak: this.streak,
      longestStreak: this.longestStreak,
      level: this.level,
      xp: this.xp,
      rank: this.getCurrentRank(),
      totalMoves: this.totalMoves,
      dailiesCompleted: this.dailiesCompleted.size,
    };
  }

  toJSON() {
    return {
      level: this.level,
      xp: this.xp,
      unlockedAchievements: [...this.unlockedAchievements],
      streak: this.streak,
      longestStreak: this.longestStreak,
      lastPlayDate: this.lastPlayDate,
      gamesPlayed: this.gamesPlayed,
      gamesWon: this.gamesWon,
      totalMoves: this.totalMoves,
      totalTime: this.totalTime,
      bestTime: this.bestTime,
      bestScore: this.bestScore,
      dailiesCompleted: [...this.dailiesCompleted],
      themesUsed: [...this._themesUsed],
      winStreak: this._winStreak,
    };
  }

  fromJSON(data) {
    this.level = data.level || 1;
    this.xp = data.xp || 0;
    this.unlockedAchievements = new Set(data.unlockedAchievements || []);
    this.streak = data.streak || 0;
    this.longestStreak = data.longestStreak || 0;
    this.lastPlayDate = data.lastPlayDate || null;
    this.gamesPlayed = data.gamesPlayed || 0;
    this.gamesWon = data.gamesWon || 0;
    this.totalMoves = data.totalMoves || 0;
    this.totalTime = data.totalTime || 0;
    this.bestTime = data.bestTime || null;
    this.bestScore = data.bestScore || 0;
    this.dailiesCompleted = new Set(data.dailiesCompleted || []);
    this._themesUsed = new Set(data.themesUsed || []);
    this._winStreak = data.winStreak || 0;
  }
}

window.ProgressionSystem = ProgressionSystem;
