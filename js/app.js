/* SolitaireRealm - Main Application Controller */
'use strict';

class App {
  constructor() {
    this.game = new GameState();
    this.renderer = new Renderer(this.game);
    this.audio = new AudioEngine();
    this.themes = new ThemeManager();
    this.progression = new ProgressionSystem();
    this.storage = new StorageManager();
    this.keyboard = new KeyboardManager();
    this.drag = null;

    this._settings = null;
    this._selectedCardInfo = null; // {pileType, pileIndex, cardIndex}
    this._statsInterval = null;
    this._autoCompleteRunning = false;
    this._coachInterval = null;
    this._coachIdleTime = 0;
    this._isDaily = false;
    this._loadingProgress = 0;
    this._comboCount = 0;
  }

  // ==========================================
  // Initialization
  // ==========================================
  async init() {
    // Show loading
    this._updateLoadingBar(10);
    await this._delay(100);

    // Load settings and progression
    this._settings = this.storage.loadSettings();
    this._updateLoadingBar(25);
    await this._delay(80);

    const progData = this.storage.loadProgression();
    if (progData) {
      this.progression.fromJSON(progData);
    }
    this._updateLoadingBar(40);
    await this._delay(80);

    // Apply settings
    this._applySettings(this._settings);

    // Init theme system
    this.themes.init('ambient-canvas');
    const savedTheme = this._settings.theme || 'cyberpunk';
    this.themes.setTheme(savedTheme);
    this.progression.recordThemeUsed(savedTheme);
    this._updateLoadingBar(60);
    await this._delay(80);

    // Setup UI
    this._setupEventListeners();
    this._buildThemeGrid();
    this._updateSidebar();
    this._updateHeaderXP();
    this._checkDailyBadge();
    this._updateLoadingBar(80);
    await this._delay(80);

    // Try to resume saved game or start new
    const savedGame = this.storage.hasSavedGame() ? this.storage.loadGame() : null;
    if (savedGame && !savedGame.gameOver) {
      this.game.fromJSON(savedGame);
      this.game.onUpdate = (g) => this._onGameUpdate(g);
      this.game.onWin = (g) => this._onGameWin(g);
      this.game.onDraw = () => this.audio.playDraw();
    } else {
      this._startNewGame(false);
    }

    this._updateLoadingBar(95);
    await this._delay(100);

    // Setup drag manager
    this.drag = new DragManager(
      this.game,
      this.renderer,
      (fromPile, cardIndex, toPile) => this._handleDrop(fromPile, cardIndex, toPile)
    );
    this.drag.onDoubleClick = (pileType, pileIndex, cardIndex) =>
      this._handleDoubleClick(pileType, pileIndex, cardIndex);

    // Initial render
    this.renderer.renderAll();
    this._startStatsTimer();
    this._startAICoach();
    this._updateActionBar();

    this._updateLoadingBar(100);
    await this._delay(200);

    // Register service worker
    this._registerSW();

    // Hide loading screen
    await this._hideLoading();
  }

  _updateLoadingBar(pct) {
    const bar = document.getElementById('loading-bar');
    if (bar) bar.style.width = `${pct}%`;
  }

  async _hideLoading() {
    const screen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    if (!screen) return;
    screen.style.transition = 'opacity 0.4s ease';
    screen.style.opacity = '0';
    app.style.display = 'flex';
    await this._delay(400);
    screen.style.display = 'none';
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================
  // Settings Application
  // ==========================================
  _applySettings(settings) {
    this.game.drawMode = settings.drawMode || 1;
    this.game.scoringMode = settings.scoringMode || 'standard';
    this.game.autoFlip = settings.autoFlip !== false;
    this.audio.setEnabled(settings.soundEnabled !== false);
    this.audio.setVolume(settings.volume || 0.7);
    this.renderer.setAnimationSpeed(settings.animationSpeed || 'normal');

    if (settings.leftHanded) {
      document.body.classList.add('left-handed');
    } else {
      document.body.classList.remove('left-handed');
    }

    // Sync UI toggles
    const autoflipEl = document.getElementById('autoflip-toggle');
    if (autoflipEl) autoflipEl.checked = this.game.autoFlip;

    const leftEl = document.getElementById('lefthanded-toggle');
    if (leftEl) leftEl.checked = !!settings.leftHanded;

    const soundEl = document.getElementById('sound-toggle');
    if (soundEl) soundEl.checked = settings.soundEnabled !== false;

    const volEl = document.getElementById('volume-slider');
    if (volEl) volEl.value = Math.round((settings.volume || 0.7) * 100);

    // Draw mode buttons
    document.querySelectorAll('[id^="draw-mode-"]').forEach(b => b.classList.remove('active'));
    const drawBtn = document.getElementById(`draw-mode-${settings.drawMode || 1}`);
    if (drawBtn) drawBtn.classList.add('active');

    // Scoring buttons
    document.querySelectorAll('[id^="scoring-"]').forEach(b => b.classList.remove('active'));
    const scoringBtn = document.getElementById(`scoring-${settings.scoringMode || 'standard'}`);
    if (scoringBtn) scoringBtn.classList.add('active');

    // Animation speed buttons
    document.querySelectorAll('[id^="anim-"]').forEach(b => b.classList.remove('active'));
    const animBtn = document.getElementById(`anim-${settings.animationSpeed || 'normal'}`);
    if (animBtn) animBtn.classList.add('active');

    // Ambient sound buttons
    document.querySelectorAll('[id^="ambient-"]').forEach(b => b.classList.remove('active'));
    const ambientBtn = document.getElementById(`ambient-${settings.ambientSound || 'none'}`);
    if (ambientBtn) ambientBtn.classList.add('active');

    // Sound icon
    this._updateSoundIcon();
  }

  _saveSettings() {
    this.storage.saveSettings(this._settings);
  }

  // ==========================================
  // Event Listeners
  // ==========================================
  _setupEventListeners() {
    // Sidebar
    document.getElementById('menu-btn')?.addEventListener('click', () => this._openSidebar());
    document.getElementById('sidebar-close')?.addEventListener('click', () => this._closeSidebar());
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => this._closeSidebar());

    // Sidebar nav
    document.getElementById('nav-play')?.addEventListener('click', () => {
      this._closeSidebar();
      this._setActiveNav('nav-play');
    });
    document.getElementById('nav-daily')?.addEventListener('click', () => {
      this._closeSidebar();
      this._openDailyModal();
    });
    document.getElementById('nav-achievements')?.addEventListener('click', () => {
      this._closeSidebar();
      this._openAchievementsModal();
    });
    document.getElementById('nav-stats')?.addEventListener('click', () => {
      this._closeSidebar();
      this._openStatsModal();
    });
    document.getElementById('nav-games')?.addEventListener('click', () => {
      this._closeSidebar();
      this._openModal('games-modal');
    });

    // Header buttons
    document.getElementById('theme-btn')?.addEventListener('click', () => this._openThemeModal());
    document.getElementById('settings-btn')?.addEventListener('click', () => this._openSettingsModal());
    document.getElementById('help-btn')?.addEventListener('click', () => this._openKeyboardModal());

    // Action bar
    document.getElementById('btn-new-game')?.addEventListener('click', () => this._startNewGame(true));
    document.getElementById('btn-undo')?.addEventListener('click', () => this._undo());
    document.getElementById('btn-hint')?.addEventListener('click', () => this._showHint());
    document.getElementById('btn-auto-complete')?.addEventListener('click', () => this._autoComplete());
    document.getElementById('btn-sound')?.addEventListener('click', () => this._toggleSound());

    // AI Coach toggle
    document.getElementById('ai-coach-toggle')?.addEventListener('click', () => this._toggleAICoach());

    // Game board pile clicks
    document.getElementById('pile-stock')?.addEventListener('click', (e) => this._onStockClick(e));
    document.getElementById('pile-waste')?.addEventListener('click', (e) => this._onWasteClick(e));

    // Foundation clicks
    for (let i = 0; i < 4; i++) {
      document.getElementById(`pile-foundation-${i}`)?.addEventListener('click', (e) => this._onFoundationClick(e, i));
    }

    // Tableau clicks
    for (let i = 0; i < 7; i++) {
      document.getElementById(`pile-tableau-${i}`)?.addEventListener('click', (e) => this._onTableauClick(e, i));
    }

    // Win modal
    document.getElementById('win-play-again')?.addEventListener('click', () => {
      this._closeModal('win-modal');
      this.renderer.stopWinAnimation();
      this._startNewGame(true);
    });
    document.getElementById('win-share')?.addEventListener('click', () => this._shareResult());

    // Settings toggles
    document.getElementById('autoflip-toggle')?.addEventListener('change', (e) => {
      this._settings.autoFlip = e.target.checked;
      this.game.autoFlip = this._settings.autoFlip;
      this._saveSettings();
    });

    document.getElementById('lefthanded-toggle')?.addEventListener('change', (e) => {
      this._settings.leftHanded = e.target.checked;
      if (e.target.checked) document.body.classList.add('left-handed');
      else document.body.classList.remove('left-handed');
      this._saveSettings();
    });

    document.getElementById('sound-toggle')?.addEventListener('change', (e) => {
      this._settings.soundEnabled = e.target.checked;
      this.audio.setEnabled(e.target.checked);
      this._updateSoundIcon();
      this._saveSettings();
    });

    document.getElementById('volume-slider')?.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value) / 100;
      this._settings.volume = vol;
      this.audio.setVolume(vol);
      this._saveSettings();
    });

    document.getElementById('clear-data-btn')?.addEventListener('click', () => {
      if (confirm('Clear all data? This cannot be undone.')) {
        this.storage.clearAll();
        location.reload();
      }
    });

    // Draw mode buttons
    document.getElementById('draw-mode-1')?.addEventListener('click', () => {
      this._settings.drawMode = 1;
      this.game.drawMode = 1;
      this._setActiveGroup('draw-mode-1', ['draw-mode-1', 'draw-mode-3']);
      this._saveSettings();
    });
    document.getElementById('draw-mode-3')?.addEventListener('click', () => {
      this._settings.drawMode = 3;
      this.game.drawMode = 3;
      this._setActiveGroup('draw-mode-3', ['draw-mode-1', 'draw-mode-3']);
      this._saveSettings();
    });

    // Scoring buttons
    document.getElementById('scoring-standard')?.addEventListener('click', () => {
      this._settings.scoringMode = 'standard';
      this.game.scoringMode = 'standard';
      this._setActiveGroup('scoring-standard', ['scoring-standard', 'scoring-vegas']);
      this._saveSettings();
    });
    document.getElementById('scoring-vegas')?.addEventListener('click', () => {
      this._settings.scoringMode = 'vegas';
      this.game.scoringMode = 'vegas';
      this._setActiveGroup('scoring-vegas', ['scoring-standard', 'scoring-vegas']);
      this._saveSettings();
    });

    // Animation speed buttons
    ['slow', 'normal', 'fast', 'none'].forEach(speed => {
      document.getElementById(`anim-${speed}`)?.addEventListener('click', () => {
        this._settings.animationSpeed = speed;
        this.renderer.setAnimationSpeed(speed);
        this._setActiveGroup(`anim-${speed}`, ['anim-slow', 'anim-normal', 'anim-fast', 'anim-none']);
        this._saveSettings();
      });
    });

    // Ambient sound buttons
    ['none', 'rain', 'fire', 'lofi'].forEach(type => {
      document.getElementById(`ambient-${type}`)?.addEventListener('click', () => {
        this._settings.ambientSound = type;
        this.audio.startAmbient(type);
        this._setActiveGroup(`ambient-${type}`, ['ambient-none', 'ambient-rain', 'ambient-fire', 'ambient-lofi']);
        this._saveSettings();
      });
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal;
        if (modalId) this._closeModal(modalId);
      });
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this._closeModal(overlay.id);
        }
      });
    });

    // Daily play button
    document.getElementById('btn-daily-play')?.addEventListener('click', () => {
      this._closeModal('daily-modal');
      this._startDailyChallenge();
    });

    // Keyboard shortcuts
    this.keyboard.onNewGame = () => this._startNewGame(true);
    this.keyboard.onUndo = () => this._undo();
    this.keyboard.onRedo = () => this._redo();
    this.keyboard.onHint = () => this._showHint();
    this.keyboard.onAutoComplete = () => this._autoComplete();
    this.keyboard.onToggleSound = () => this._toggleSound();
    this.keyboard.onCycleTheme = () => this._cycleTheme();
    this.keyboard.onCloseModal = () => this._closeTopModal();
    this.keyboard.onDrawStock = () => this._onStockClick(null);
    this.keyboard.onShowHelp = () => this._openKeyboardModal();
    this.keyboard.onSelectPile = (idx) => this._selectTableauPile(idx);
    this.keyboard.onAutoMove = () => this._autoMoveSelected();
    this.keyboard.onNavigatePile = (dir) => this._navigatePile(dir);
  }

  _setActiveGroup(activeId, allIds) {
    allIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', id === activeId);
    });
  }

  // ==========================================
  // Game Flow
  // ==========================================
  _startNewGame(showConfirm) {
    if (showConfirm && !this.game.gameOver && this.game.moves > 5) {
      if (!confirm('Start a new game? Current progress will be lost.')) return;
    }

    this._autoCompleteRunning = false;
    this._selectedCardInfo = null;
    this._comboCount = 0;
    this.renderer.clearHints();
    this.renderer.clearDropHighlights();

    this._isDaily = false;
    this.game.isDaily = false;
    this.game.onUpdate = (g) => this._onGameUpdate(g);
    this.game.onWin = (g) => this._onGameWin(g);
    this.game.onDraw = () => this.audio.playDraw();
    this.game.deal();

    this.renderer.renderAll();
    this._updateActionBar();
    this._startStatsTimer();

    // Record game start
    this.progression.updateStreak();
    this.storage.saveProgression(this.progression);
    this._updateSidebar();
  }

  _startDailyChallenge() {
    this._autoCompleteRunning = false;
    this._selectedCardInfo = null;
    this._isDaily = true;

    const today = this._todayStr();

    // Check if already completed
    const existing = this.storage.loadDailyResult(today);
    if (existing && existing.won) {
      alert(`You already completed today's challenge! Score: ${existing.score}`);
      return;
    }

    this.game.onUpdate = (g) => this._onGameUpdate(g);
    this.game.onWin = (g) => this._onGameWin(g);
    this.game.onDraw = () => this.audio.playDraw();
    this.game.dealDaily(today);

    this.renderer.renderAll();
    this._updateActionBar();
    this._startStatsTimer();
    this._updateSidebar();
  }

  _onGameUpdate(game) {
    this.storage.saveGame(game);
    this._updateActionBar();
    this.renderer.renderWithAnimation();
    this.audio.playCardPlace();
    this._resetAICoachTimer();
  }

  _onGameWin(game) {
    this.renderer.renderAll();
    this._stopStatsTimer();

    const timeMs = game.getElapsed();
    const score = game.getScore();
    const moves = game.moves;

    // XP calculation
    const xpEarned = this.progression.calculateGameXP(score, timeMs, moves);
    const { newLevel, leveled } = this.progression.addXP(xpEarned);

    // Record game
    const today = this._todayStr();
    const gameStats = {
      won: true,
      score,
      timeMs,
      moves,
      hintsUsed: game.hintsUsed,
      undosUsed: game.undosUsed,
      foundationMoves: game.foundationMoves,
      isDaily: game.isDaily,
      dateStr: today,
    };

    this.progression.recordGame(true, gameStats);

    // Check achievements
    const newAchievements = this.progression.checkAchievements(gameStats);

    // Save daily if applicable
    if (game.isDaily) {
      this.storage.saveDailyResult(today, { won: true, score, timeMs, moves });
      this._checkDailyBadge();
    }

    // Save progression
    this.storage.saveProgression(this.progression);
    this.storage.clearSavedGame();

    // Show achievements (queue them)
    newAchievements.forEach((ach, i) => {
      setTimeout(() => this._showAchievementToast(ach), i * 3500 + 500);
    });

    // Update UI
    this._updateSidebar();
    this._updateHeaderXP();

    // Show win modal
    setTimeout(() => {
      this._showWinModal(score, timeMs, moves, xpEarned, leveled, newLevel);
      this.renderer.animateWin();
      this.audio.playWin();
    }, 500);
  }

  _showWinModal(score, timeMs, moves, xpEarned, leveled, newLevel) {
    const fmt = (ms) => {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      return `${m}:${String(s % 60).padStart(2, '0')}`;
    };

    document.getElementById('win-score').textContent = score;
    document.getElementById('win-time').textContent = fmt(timeMs);
    document.getElementById('win-moves').textContent = moves;
    document.getElementById('win-xp').textContent = `+${xpEarned}`;

    const levelUpEl = document.getElementById('win-level-up');
    if (leveled && levelUpEl) {
      levelUpEl.hidden = false;
      document.getElementById('win-new-level').textContent = `Level ${newLevel}!`;
    } else if (levelUpEl) {
      levelUpEl.hidden = true;
    }

    this._openModal('win-modal');
  }

  // ==========================================
  // Pile Click Handlers
  // ==========================================
  _onStockClick(e) {
    if (this.game.gameOver) return;
    this._clearSelection();
    if (this.game.drawCard()) {
      this.renderer.renderWithAnimation();
      this._updateActionBar();
    }
  }

  _onWasteClick(e) {
    if (this.game.gameOver) return;
    if (this.game.waste.length === 0) return;

    const card = this.game.waste[this.game.waste.length - 1];
    if (!card.faceUp) return;

    // If a card is selected, try to move to waste (unusual, ignore)
    if (this._selectedCardInfo) {
      this._clearSelection();
      return;
    }

    // Select the waste top card for keyboard moves
    this._setSelectedCard({ pileType: 'waste', pileIndex: 0, cardIndex: this.game.waste.length - 1 });

    // Try auto-move to foundation
    const fi = this.game.canMoveToAnyFoundation(card);
    if (fi >= 0) {
      this._moveCard({ type: 'waste' }, this.game.waste.length - 1, { type: 'foundation', index: fi });
    }
  }

  _onFoundationClick(e, index) {
    if (this.game.gameOver) return;

    // If something selected, try to move to this foundation
    if (this._selectedCardInfo) {
      const info = this._selectedCardInfo;
      const moved = this._moveCard(
        { type: info.pileType, index: info.pileIndex },
        info.cardIndex,
        { type: 'foundation', index }
      );
      if (moved) {
        this._clearSelection();
        return;
      }
    }

    // Otherwise try to select foundation card
    const pile = this.game.foundations[index];
    if (pile.length > 0) {
      this._setSelectedCard({ pileType: 'foundation', pileIndex: index, cardIndex: pile.length - 1 });
    }
  }

  _onTableauClick(e, index) {
    if (this.game.gameOver) return;

    // Find which card was clicked
    let target = e ? e.target : null;
    let cardEl = null;
    while (target && target !== document.body) {
      if (target.classList && target.classList.contains('card')) {
        cardEl = target;
        break;
      }
      target = target.parentElement;
    }

    const col = this.game.tableau[index];

    if (!cardEl) {
      // Clicked empty pile or background
      if (this._selectedCardInfo) {
        // Try to move selected card here
        const info = this._selectedCardInfo;
        const moved = this._moveCard(
          { type: info.pileType, index: info.pileIndex },
          info.cardIndex,
          { type: 'tableau', index }
        );
        if (moved) this._clearSelection();
        else this._clearSelection();
      }
      return;
    }

    const cardIndex = parseInt(cardEl.dataset.cardIndex) || 0;
    const card = col[cardIndex];
    if (!card) return;

    // Face-down card - try to flip (handled by autoFlip in moveCards, but click should flip top face-down)
    if (!card.faceUp) {
      if (cardIndex === col.length - 1) {
        // Top face-down card - can't manually flip, autoFlip handles it
        this.audio.playError();
      }
      this._clearSelection();
      return;
    }

    // Face-up card
    if (this._selectedCardInfo) {
      const info = this._selectedCardInfo;

      // If same pile and same card, deselect
      if (info.pileType === 'tableau' && info.pileIndex === index && info.cardIndex === cardIndex) {
        this._clearSelection();
        return;
      }

      // Try to move selected card(s) to this tableau pile
      const moved = this._moveCard(
        { type: info.pileType, index: info.pileIndex },
        info.cardIndex,
        { type: 'tableau', index }
      );

      if (moved) {
        this._clearSelection();
      } else {
        // Select new card instead
        this._setSelectedCard({ pileType: 'tableau', pileIndex: index, cardIndex });
      }
    } else {
      // Select this card
      this._setSelectedCard({ pileType: 'tableau', pileIndex: index, cardIndex });
    }
  }

  _moveCard(fromPile, cardIndex, toPile) {
    const scoreBefore = this.game.getScore();
    const moved = this.game.moveCards(fromPile, cardIndex, toPile);
    if (moved) {
      this.audio.playCardPlace();
      this.renderer.renderWithAnimation();
      this._updateActionBar();

      // Arcade: score popup
      const scoreAfter = this.game.getScore();
      const delta = scoreAfter - scoreBefore;
      if (delta !== 0) {
        this._spawnScorePopup(delta);
      }

      // Arcade: combo counter
      this._comboCount = (this._comboCount || 0) + 1;
      if (this._comboCount === 3) this._showComboBanner('TRIPLE! 🔥');
      else if (this._comboCount === 5) this._showComboBanner('COMBO x5! ⚡');
      else if (this._comboCount === 10) this._showComboBanner('ON FIRE! 🔥🔥🔥');

      // Flash the card just placed
      setTimeout(() => {
        const destPileId = toPile.type === 'foundation'
          ? `pile-foundation-${toPile.index}`
          : toPile.type === 'tableau' ? `pile-tableau-${toPile.index}` : null;
        if (destPileId) {
          const pileEl = document.getElementById(destPileId);
          const lastCard = pileEl?.querySelector('.card:last-of-type');
          if (lastCard) {
            lastCard.classList.add('card-just-placed');
            lastCard.addEventListener('animationend', () => lastCard.classList.remove('card-just-placed'), { once: true });
          }
        }
      }, 50);
    } else {
      this.audio.playError();
      this._comboCount = 0;
    }
    return moved;
  }

  _spawnScorePopup(delta) {
    const popup = document.createElement('div');
    popup.className = `score-popup ${delta > 0 ? (delta >= 15 ? 'bonus' : 'positive') : 'negative'}`;
    popup.textContent = delta > 0 ? `+${delta}` : String(delta);

    // Position near the last moved card or center of board
    const boardEl = document.getElementById('game-board') || document.getElementById('game-container');
    const rect = boardEl ? boardEl.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2 };
    popup.style.left = `${rect.left + rect.width * 0.35 + Math.random() * rect.width * 0.3}px`;
    popup.style.top  = `${rect.top  + rect.height * 0.3  + Math.random() * rect.height * 0.2}px`;

    document.body.appendChild(popup);
    popup.addEventListener('animationend', () => popup.remove(), { once: true });
  }

  _showComboBanner(text) {
    const banner = document.createElement('div');
    banner.className = 'combo-banner';
    banner.textContent = text;
    document.body.appendChild(banner);
    banner.addEventListener('animationend', () => banner.remove(), { once: true });
  }

  // ==========================================
  // Selection
  // ==========================================
  _setSelectedCard(info) {
    this._clearSelection();
    this._selectedCardInfo = info;
    this._highlightSelected();
    this.renderer.highlightValidDropTargets(this._getSelectedCard());
  }

  _getSelectedCard() {
    if (!this._selectedCardInfo) return null;
    const { pileType, pileIndex, cardIndex } = this._selectedCardInfo;
    if (pileType === 'waste') return this.game.waste[cardIndex];
    if (pileType === 'foundation') return this.game.foundations[pileIndex][cardIndex];
    if (pileType === 'tableau') return this.game.tableau[pileIndex][cardIndex];
    return null;
  }

  _highlightSelected() {
    if (!this._selectedCardInfo) return;
    const { pileType, pileIndex, cardIndex } = this._selectedCardInfo;
    let pileEl;
    if (pileType === 'waste') pileEl = document.getElementById('pile-waste');
    else if (pileType === 'foundation') pileEl = document.getElementById(`pile-foundation-${pileIndex}`);
    else pileEl = document.getElementById(`pile-tableau-${pileIndex}`);

    if (!pileEl) return;
    const cards = pileEl.querySelectorAll('.card');
    for (let i = cardIndex; i < cards.length; i++) {
      cards[i]?.classList.add('selected');
    }
  }

  _clearSelection() {
    document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
    this._selectedCardInfo = null;
    this.renderer.clearDropHighlights();
  }

  // ==========================================
  // Double Click - Auto Move
  // ==========================================
  _handleDoubleClick(pileType, pileIndex, cardIndex) {
    if (this.game.gameOver) return;

    let card = null;
    let fromPile = { type: pileType, index: pileIndex };

    if (pileType === 'waste') {
      if (this.game.waste.length === 0) return;
      card = this.game.waste[this.game.waste.length - 1];
      cardIndex = this.game.waste.length - 1;
    } else if (pileType === 'tableau') {
      const col = this.game.tableau[pileIndex];
      if (cardIndex >= col.length) return;
      card = col[cardIndex];
      if (!card.faceUp) return;
    } else if (pileType === 'foundation') {
      return; // don't auto-move from foundation on dblclick
    }

    if (!card) return;

    // Try foundation first
    const fi = this.game.canMoveToAnyFoundation(card);
    if (fi >= 0) {
      this._moveCard(fromPile, cardIndex, { type: 'foundation', index: fi });
      this._clearSelection();
      return;
    }

    // Try tableau
    for (let ti = 0; ti < 7; ti++) {
      if (pileType === 'tableau' && ti === pileIndex) continue;
      if (this.game.canMoveToTableau(card, ti)) {
        this._moveCard(fromPile, cardIndex, { type: 'tableau', index: ti });
        this._clearSelection();
        return;
      }
    }
  }

  _autoMoveSelected() {
    if (!this._selectedCardInfo) return;
    const { pileType, pileIndex, cardIndex } = this._selectedCardInfo;
    this._handleDoubleClick(pileType, pileIndex, cardIndex);
    this._clearSelection();
  }

  // ==========================================
  // Drag Drop
  // ==========================================
  _handleDrop(fromPile, cardIndex, toPile) {
    const moved = this._moveCard(fromPile, cardIndex, toPile);
    if (!moved) {
      this.audio.playError();
    }
    this._clearSelection();
    return moved;
  }

  // ==========================================
  // Game Actions
  // ==========================================
  _undo() {
    if (!this.game.canUndo()) return;
    this.game.undo();
    this.renderer.renderWithAnimation();
    this._updateActionBar();
    this._clearSelection();
    this.audio.playCardFlip();
  }

  _redo() {
    if (!this.game.canRedo()) return;
    this.game.redo();
    this.renderer.renderWithAnimation();
    this._updateActionBar();
    this._clearSelection();
  }

  _showHint() {
    const hints = this.game.getHints();
    if (hints.length === 0) {
      this.audio.playError();
      this._setAIMessage('No available moves found! Try drawing from stock or undoing.');
      return;
    }

    const hint = hints[0];
    this.game.hintsUsed++;

    if (hint.action === 'draw') {
      const stockEl = document.getElementById('pile-stock');
      if (stockEl) {
        stockEl.classList.add('hint-target');
        setTimeout(() => stockEl.classList.remove('hint-target'), 2000);
      }
      this._setAIMessage('Draw from the stock pile to reveal more options.');
      return;
    }

    this.renderer.showHint(
      { type: hint.from.type, index: hint.from.index },
      hint.from.cardIndex || 0,
      { type: hint.to.type, index: hint.to.index }
    );

    if (hint.card) {
      this._setAIMessage(`Move the ${hint.card.rankDisplay}${hint.card.symbol} to ${hint.to.type === 'foundation' ? 'foundation' : `column ${(hint.to.index || 0) + 1}`}.`);
    }

    this.audio.playCardFlip();
  }

  _autoComplete() {
    if (!this.game.canAutoComplete() || this._autoCompleteRunning) return;
    this._autoCompleteRunning = true;
    this._clearSelection();
    this._runAutoCompleteLoop();
  }

  _runAutoCompleteLoop() {
    if (!this._autoCompleteRunning) return;
    if (this.game.checkWin()) {
      this._autoCompleteRunning = false;
      return;
    }

    const moved = this.game.autoCompleteStep();
    if (!moved) {
      this._autoCompleteRunning = false;
      return;
    }

    // Speed of auto-complete
    const delay = this._settings.animationSpeed === 'none' ? 0 : 150;
    setTimeout(() => this._runAutoCompleteLoop(), delay);
  }

  _toggleSound() {
    const enabled = !this.audio.getEnabled();
    this.audio.setEnabled(enabled);
    this._settings.soundEnabled = enabled;
    this._saveSettings();
    this._updateSoundIcon();

    const toggle = document.getElementById('sound-toggle');
    if (toggle) toggle.checked = enabled;
  }

  _updateSoundIcon() {
    const icon = document.getElementById('sound-icon');
    if (icon) icon.textContent = this.audio.getEnabled() ? '🔊' : '🔇';
  }

  // ==========================================
  // Keyboard Navigation
  // ==========================================
  _selectTableauPile(index) {
    const col = this.game.tableau[index];
    if (col.length === 0) {
      if (this._selectedCardInfo) {
        // Try moving selected card to empty pile
        const info = this._selectedCardInfo;
        this._moveCard(
          { type: info.pileType, index: info.pileIndex },
          info.cardIndex,
          { type: 'tableau', index }
        );
        this._clearSelection();
      }
      return;
    }

    // Select top face-up card in column
    const topFaceUp = col.map((c, i) => ({ c, i })).filter(x => x.c.faceUp);
    if (topFaceUp.length === 0) return;

    const firstFaceUp = topFaceUp[0];
    if (this._selectedCardInfo) {
      const info = this._selectedCardInfo;
      const moved = this._moveCard(
        { type: info.pileType, index: info.pileIndex },
        info.cardIndex,
        { type: 'tableau', index }
      );
      if (moved) this._clearSelection();
      else this._setSelectedCard({ pileType: 'tableau', pileIndex: index, cardIndex: firstFaceUp.i });
    } else {
      this._setSelectedCard({ pileType: 'tableau', pileIndex: index, cardIndex: firstFaceUp.i });
    }
  }

  _navigatePile(direction) {
    if (!this._selectedCardInfo) return;
    const { pileType, pileIndex } = this._selectedCardInfo;

    if (pileType === 'tableau') {
      if (direction === 'left' && pileIndex > 0) {
        this._selectTableauPile(pileIndex - 1);
      } else if (direction === 'right' && pileIndex < 6) {
        this._selectTableauPile(pileIndex + 1);
      } else if (direction === 'up') {
        // Move up in column (select card above)
        const col = this.game.tableau[pileIndex];
        const info = this._selectedCardInfo;
        if (info.cardIndex > 0 && col[info.cardIndex - 1].faceUp) {
          this._setSelectedCard({ pileType: 'tableau', pileIndex, cardIndex: info.cardIndex - 1 });
        }
      } else if (direction === 'down') {
        const col = this.game.tableau[pileIndex];
        const info = this._selectedCardInfo;
        if (info.cardIndex < col.length - 1) {
          this._setSelectedCard({ pileType: 'tableau', pileIndex, cardIndex: info.cardIndex + 1 });
        }
      }
    }
  }

  _cycleTheme() {
    const theme = this.themes.nextTheme();
    this._settings.theme = theme.id;
    this._saveSettings();
    this.progression.recordThemeUsed(theme.id);
    this.storage.saveProgression(this.progression);
    this._syncThemeModal();
    this.progression.checkAchievements({
      won: false, score: 0, timeMs: 0, moves: 0, hintsUsed: 0, undosUsed: 0, foundationMoves: 0
    });
  }

  // ==========================================
  // Stats Timer
  // ==========================================
  _startStatsTimer() {
    this._stopStatsTimer();
    this._statsInterval = setInterval(() => {
      if (!this.game.gameOver) {
        this.game.checkScoreDecay();
        const elapsed = this.game.getElapsed();
        this.renderer.updateStats(this.game.getScore(), elapsed, this.game.moves);
        this._updateAutoCompleteButton();
      }
    }, 500);
  }

  _stopStatsTimer() {
    if (this._statsInterval) {
      clearInterval(this._statsInterval);
      this._statsInterval = null;
    }
  }

  _updateActionBar() {
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.disabled = !this.game.canUndo();

    const autoBtn = document.getElementById('btn-auto-complete');
    if (autoBtn) autoBtn.disabled = !this.game.canAutoComplete();

    this.renderer.updateStats(this.game.getScore(), this.game.getElapsed(), this.game.moves);
  }

  _updateAutoCompleteButton() {
    const autoBtn = document.getElementById('btn-auto-complete');
    if (autoBtn) {
      const canAuto = this.game.canAutoComplete();
      autoBtn.disabled = !canAuto || this._autoCompleteRunning;
      if (canAuto) {
        autoBtn.classList.add('btn-primary');
        autoBtn.classList.remove('btn-secondary');
      } else {
        autoBtn.classList.remove('btn-primary');
        autoBtn.classList.add('btn-secondary');
      }
    }
  }

  // ==========================================
  // AI Coach
  // ==========================================
  _startAICoach() {
    this._coachInterval = setInterval(() => {
      this._coachIdleTime += 30;
      if (this._coachIdleTime >= 30 && !this.game.gameOver) {
        const analysis = this.game.analyzePosition();
        this._updateAICoach(analysis);
      }
    }, 30000);
  }

  _resetAICoachTimer() {
    this._coachIdleTime = 0;
  }

  _updateAICoach(analysis) {
    const msgEl = document.getElementById('ai-message');
    if (msgEl) {
      msgEl.innerHTML = `<p>${analysis.suggestion}</p>`;
    }

    const effFill = document.getElementById('ai-efficiency-fill');
    if (effFill) effFill.style.width = `${analysis.efficiency}%`;

    const effVal = document.getElementById('ai-efficiency-val');
    if (effVal) effVal.textContent = `${analysis.efficiency}%`;

    const deadlockEl = document.getElementById('ai-deadlock-warning');
    if (deadlockEl) deadlockEl.hidden = !analysis.deadlocked;
  }

  _setAIMessage(msg) {
    const msgEl = document.getElementById('ai-message');
    if (msgEl) msgEl.innerHTML = `<p>${msg}</p>`;
  }

  _toggleAICoach() {
    const toggle = document.getElementById('ai-coach-toggle');
    const body = document.getElementById('ai-coach-body');
    if (!toggle || !body) return;

    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isExpanded));
    body.hidden = isExpanded;
  }

  // ==========================================
  // Modals
  // ==========================================
  _openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  _closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  _closeTopModal() {
    const modals = ['win-modal', 'theme-modal', 'settings-modal', 'achievements-modal',
                    'stats-modal', 'daily-modal', 'keyboard-modal'];
    for (const id of modals) {
      const el = document.getElementById(id);
      if (el && !el.hidden) {
        this._closeModal(id);
        return;
      }
    }
    this._closeSidebar();
    this._clearSelection();
  }

  _openThemeModal() {
    this._syncThemeModal();
    this._openModal('theme-modal');
  }

  _openSettingsModal() {
    this._openModal('settings-modal');
  }

  _openKeyboardModal() {
    this._openModal('keyboard-modal');
  }

  _openAchievementsModal() {
    this._buildAchievementsList();
    this._openModal('achievements-modal');
  }

  _openStatsModal() {
    this._buildStatsGrid();
    this._openModal('stats-modal');
  }

  _openDailyModal() {
    const today = this._todayStr();
    const dateEl = document.getElementById('daily-date');
    const statusEl = document.getElementById('daily-status');
    const playBtn = document.getElementById('btn-daily-play');

    if (dateEl) {
      const d = new Date();
      dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    const result = this.storage.loadDailyResult(today);
    if (result && result.won) {
      if (statusEl) statusEl.textContent = `✅ Completed! Score: ${result.score}`;
      if (playBtn) playBtn.textContent = 'Play Again (No Rewards)';
    } else {
      if (statusEl) statusEl.textContent = "Today's challenge is waiting for you!";
      if (playBtn) playBtn.textContent = "Play Today's Challenge";
    }

    this._openModal('daily-modal');
  }

  // ==========================================
  // Theme Grid
  // ==========================================
  _buildThemeGrid() {
    const grid = document.getElementById('theme-grid');
    if (!grid) return;
    grid.innerHTML = '';

    this.themes.getAvailableThemes().forEach(theme => {
      const card = document.createElement('div');
      card.className = `theme-card${this.themes.getCurrentTheme() === theme.id ? ' active' : ''}`;
      card.dataset.theme = theme.id;
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(this.themes.getCurrentTheme() === theme.id));
      card.setAttribute('tabindex', '0');

      card.innerHTML = `
        <div class="theme-card-emoji">${theme.emoji}</div>
        <div class="theme-card-name">${theme.name}</div>
        <div class="theme-card-desc">${theme.description}</div>
      `;

      card.addEventListener('click', () => {
        this._settings.theme = theme.id;
        this.themes.setTheme(theme.id);
        this.progression.recordThemeUsed(theme.id);
        this.storage.saveProgression(this.progression);
        this._saveSettings();
        this._syncThemeModal();
        this._closeModal('theme-modal');

        // Check theme achievement
        const newAchs = this.progression.checkAchievements({
          won: false, score: 0, timeMs: 0, moves: 0, hintsUsed: 0, undosUsed: 0, foundationMoves: 0
        });
        newAchs.forEach((ach, i) => {
          setTimeout(() => this._showAchievementToast(ach), i * 3500);
        });
      });

      grid.appendChild(card);
    });
  }

  _syncThemeModal() {
    const current = this.themes.getCurrentTheme();
    document.querySelectorAll('.theme-card').forEach(card => {
      const isActive = card.dataset.theme === current;
      card.classList.toggle('active', isActive);
      card.setAttribute('aria-selected', String(isActive));
    });
  }

  // ==========================================
  // Achievements List
  // ==========================================
  _buildAchievementsList() {
    const list = document.getElementById('achievements-list');
    if (!list) return;
    list.innerHTML = '';

    const achievements = this.progression.getAllAchievements();
    const unlocked = achievements.filter(a => a.unlocked);
    const locked = achievements.filter(a => !a.unlocked);

    const allSorted = [...unlocked, ...locked];

    allSorted.forEach(ach => {
      const item = document.createElement('div');
      item.className = `achievement-item${ach.unlocked ? ' unlocked' : ''}`;

      if (ach.unlocked) {
        item.innerHTML = `
          <div class="achievement-icon">${ach.icon}</div>
          <div class="achievement-info">
            <div class="achievement-name">${ach.name}</div>
            <div class="achievement-desc">${ach.desc}</div>
          </div>
          <div class="achievement-xp">+${ach.xp} XP</div>
        `;
      } else {
        item.innerHTML = `
          <div class="achievement-locked-icon">🔒</div>
          <div class="achievement-info">
            <div class="achievement-name" style="opacity:0.5">${ach.name}</div>
            <div class="achievement-desc">${ach.desc}</div>
          </div>
          <div class="achievement-xp" style="opacity:0.3">+${ach.xp} XP</div>
        `;
      }

      list.appendChild(item);
    });
  }

  // ==========================================
  // Stats Grid
  // ==========================================
  _buildStatsGrid() {
    const grid = document.getElementById('stats-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const stats = this.progression.getStats();

    const fmt = (ms) => {
      if (!ms) return '-';
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      return `${m}:${String(s % 60).padStart(2, '0')}`;
    };

    const items = [
      { label: 'Games Played', value: stats.gamesPlayed },
      { label: 'Games Won', value: stats.gamesWon },
      { label: 'Win Rate', value: `${stats.winRate}%` },
      { label: 'Best Score', value: stats.bestScore },
      { label: 'Best Time', value: fmt(stats.bestTime) },
      { label: 'Current Streak', value: `🔥 ${stats.currentStreak}` },
      { label: 'Longest Streak', value: stats.longestStreak },
      { label: 'Level', value: stats.level },
      { label: 'Rank', value: stats.rank },
      { label: 'Total XP', value: stats.xp },
      { label: 'Dailies Done', value: stats.dailiesCompleted },
      { label: 'Total Moves', value: stats.totalMoves },
    ];

    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'stats-item';
      el.innerHTML = `
        <div class="stats-item-value">${item.value}</div>
        <div class="stats-item-label">${item.label}</div>
      `;
      grid.appendChild(el);
    });
  }

  // ==========================================
  // Sidebar
  // ==========================================
  _openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btn = document.getElementById('menu-btn');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }

  _closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btn = document.getElementById('menu-btn');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  _setActiveNav(id) {
    document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
  }

  _updateSidebar() {
    const stats = this.progression.getStats();

    const levelEl = document.getElementById('sidebar-level');
    if (levelEl) levelEl.textContent = stats.level;

    const rankEl = document.getElementById('sidebar-rank');
    if (rankEl) rankEl.textContent = stats.rank;

    const streakEl = document.getElementById('sidebar-streak');
    if (streakEl) streakEl.textContent = stats.currentStreak;

    const xpFill = document.getElementById('sidebar-xp-fill');
    const pct = this.progression.xpProgressPercent();
    if (xpFill) xpFill.style.width = `${pct}%`;

    const xpCurrent = document.getElementById('sidebar-xp-current');
    if (xpCurrent) xpCurrent.textContent = this.progression.xpInCurrentLevel();

    const xpNeeded = document.getElementById('sidebar-xp-needed');
    if (xpNeeded) xpNeeded.textContent = this.progression.xpToNextLevel();
  }

  _updateHeaderXP() {
    const levelEl = document.getElementById('header-level');
    if (levelEl) levelEl.textContent = `Lv.${this.progression.level}`;

    const xpFill = document.getElementById('xp-bar-fill');
    const pct = this.progression.xpProgressPercent();
    if (xpFill) {
      xpFill.style.width = `${pct}%`;
      xpFill.setAttribute('aria-valuenow', pct);
    }
  }

  // ==========================================
  // Achievement Toast
  // ==========================================
  _showAchievementToast(achievement) {
    const toast = document.getElementById('achievement-toast');
    const icon = document.getElementById('achievement-toast-icon');
    const name = document.getElementById('achievement-toast-name');

    if (!toast) return;

    if (icon) icon.textContent = achievement.icon;
    if (name) name.textContent = achievement.name;

    toast.classList.remove('hiding');
    toast.hidden = false;

    this.audio.playAchievement();

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => {
        toast.hidden = true;
        toast.classList.remove('hiding');
      }, 300);
    }, 3000);
  }

  // ==========================================
  // Daily Challenge
  // ==========================================
  _checkDailyBadge() {
    const today = this._todayStr();
    const badge = document.getElementById('daily-badge');
    if (badge) {
      badge.style.display = this.storage.hasDailyBeenPlayed(today) ? 'none' : 'flex';
    }
  }

  _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // ==========================================
  // Share Result
  // ==========================================
  _shareResult() {
    const score = this.game.getScore();
    const elapsed = this.game.getElapsed();
    const s = Math.floor(elapsed / 1000);
    const m = Math.floor(s / 60);
    const time = `${m}:${String(s % 60).padStart(2, '0')}`;
    const moves = this.game.moves;
    const daily = this.game.isDaily ? ' | #DailyChallenge' : '';
    const text = `🃏 SolitaireRealm | Score: ${score} | Time: ${time} | Moves: ${moves}${daily}`;

    if (navigator.share) {
      navigator.share({ text, url: window.location.href })
        .catch(() => this._copyToClipboard(text));
    } else {
      this._copyToClipboard(text);
    }
  }

  _copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Result copied to clipboard!');
      }).catch(() => {
        prompt('Copy this result:', text);
      });
    } else {
      prompt('Copy this result:', text);
    }
  }

  // ==========================================
  // Service Worker
  // ==========================================
  _registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }
}

// ==========================================
// Boot
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  const app = new App();
  window._app = app; // expose for debugging
  await app.init();
});
