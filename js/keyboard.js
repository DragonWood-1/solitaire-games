/* SolitaireRealm - Keyboard Manager */
'use strict';

class KeyboardManager {
  constructor() {
    this.onNewGame = null;
    this.onUndo = null;
    this.onRedo = null;
    this.onHint = null;
    this.onAutoComplete = null;
    this.onToggleSound = null;
    this.onCycleTheme = null;
    this.onCloseModal = null;
    this.onDrawStock = null;
    this.onSelectPile = null;    // (pileIndex) => void
    this.onAutoMove = null;      // () => void
    this.onNavigatePile = null;  // (direction) => void  ('up'|'down'|'left'|'right')
    this.onShowHelp = null;

    this._enabled = true;
    this._selectedPile = -1;

    this._handler = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._handler);
  }

  _onKeyDown(e) {
    if (!this._enabled) return;

    // Don't intercept if focus is in an input
    const tag = document.activeElement && document.activeElement.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key;

    switch (key) {
      case 'n':
      case 'N':
        if (!ctrl) {
          e.preventDefault();
          if (this.onNewGame) this.onNewGame();
        }
        break;

      case 'z':
      case 'Z':
        if (ctrl) {
          e.preventDefault();
          if (this.onUndo) this.onUndo();
        }
        break;

      case 'u':
      case 'U':
        if (!ctrl) {
          e.preventDefault();
          if (this.onUndo) this.onUndo();
        }
        break;

      case 'y':
      case 'Y':
        if (ctrl) {
          e.preventDefault();
          if (this.onRedo) this.onRedo();
        }
        break;

      case 'h':
      case 'H':
        if (!ctrl) {
          e.preventDefault();
          if (this.onHint) this.onHint();
        }
        break;

      case 'a':
      case 'A':
        if (!ctrl) {
          e.preventDefault();
          if (this.onAutoComplete) this.onAutoComplete();
        }
        break;

      case 'm':
      case 'M':
        if (!ctrl) {
          e.preventDefault();
          if (this.onToggleSound) this.onToggleSound();
        }
        break;

      case 't':
      case 'T':
        if (!ctrl) {
          e.preventDefault();
          if (this.onCycleTheme) this.onCycleTheme();
        }
        break;

      case ' ':
        e.preventDefault();
        if (this.onDrawStock) this.onDrawStock();
        break;

      case 'Escape':
        if (this.onCloseModal) this.onCloseModal();
        this._selectedPile = -1;
        break;

      case '?':
        e.preventDefault();
        if (this.onShowHelp) this.onShowHelp();
        break;

      case 'Enter':
        e.preventDefault();
        if (this.onAutoMove) this.onAutoMove();
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (this.onNavigatePile) this.onNavigatePile('up');
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (this.onNavigatePile) this.onNavigatePile('down');
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (this.onNavigatePile) this.onNavigatePile('left');
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (this.onNavigatePile) this.onNavigatePile('right');
        break;

      default:
        // 1-7: select tableau column
        if (!ctrl && key >= '1' && key <= '7') {
          e.preventDefault();
          const idx = parseInt(key) - 1;
          this._selectedPile = idx;
          if (this.onSelectPile) this.onSelectPile(idx);
        }
        break;
    }
  }

  setEnabled(enabled) {
    this._enabled = enabled;
  }

  destroy() {
    document.removeEventListener('keydown', this._handler);
  }
}

window.KeyboardManager = KeyboardManager;
