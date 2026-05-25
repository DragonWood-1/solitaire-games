/* SolitaireRealm - Drag Manager */
'use strict';

class DragManager {
  constructor(gameState, renderer, onMove) {
    this.game = gameState;
    this.renderer = renderer;
    this.onMove = onMove; // callback(fromPile, cardIndex, toPile) => bool
    this.onDoubleClick = null; // callback(pileType, pileIndex, cardIndex)

    this._dragging = false;
    this._dragCards = []; // array of Card objects
    this._dragGhost = document.getElementById('drag-ghost');
    this._startX = 0;
    this._startY = 0;
    this._offsetX = 0;
    this._offsetY = 0;
    this._threshold = 5;
    this._moved = false;
    this._fromPile = null;
    this._fromCardIndex = 0;
    this._fromCardRect = null;
    this._velocity = { x: 0, y: 0 };
    this._lastX = 0;
    this._lastY = 0;
    this._lastTime = 0;
    this._raf = null;
    this._ghostX = 0;
    this._ghostY = 0;
    this._targetEl = null;
    this._lastClickTime = 0;
    this._lastClickTarget = null;

    this._bindEvents();
  }

  _bindEvents() {
    document.addEventListener('mousedown', this._onPointerDown.bind(this), { passive: false });
    document.addEventListener('mousemove', this._onPointerMove.bind(this), { passive: false });
    document.addEventListener('mouseup', this._onPointerUp.bind(this));

    document.addEventListener('touchstart', this._onPointerDown.bind(this), { passive: false });
    document.addEventListener('touchmove', this._onPointerMove.bind(this), { passive: false });
    document.addEventListener('touchend', this._onPointerUp.bind(this), { passive: false });

    document.addEventListener('dblclick', this._onDoubleClick.bind(this));
  }

  _getPointerPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  _getCardInfo(el) {
    // Walk up to find card element
    let node = el;
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains('card')) {
        return {
          el: node,
          pileType: node.dataset.pileType,
          pileIndex: parseInt(node.dataset.pileIndex) || 0,
          cardIndex: parseInt(node.dataset.cardIndex) || 0,
        };
      }
      node = node.parentElement;
    }
    return null;
  }

  _getPileInfo(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains('pile')) {
        return {
          el: node,
          pileType: node.dataset.pileType,
          pileIndex: parseInt(node.dataset.pileIndex) || 0,
        };
      }
      node = node.parentElement;
    }
    return null;
  }

  _onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return; // left click only

    const pos = this._getPointerPos(e);
    const cardInfo = this._getCardInfo(e.target);

    if (!cardInfo) return;
    if (!cardInfo.pileType) return;

    const { pileType, pileIndex, cardIndex } = cardInfo;

    // Only drag face-up cards
    let card = null;
    let cardsToMove = [];

    if (pileType === 'waste') {
      if (this.game.waste.length === 0) return;
      card = this.game.waste[this.game.waste.length - 1];
      if (!card.faceUp) return;
      cardsToMove = [card];
    } else if (pileType === 'foundation') {
      const pile = this.game.foundations[pileIndex];
      if (pile.length === 0) return;
      card = pile[pile.length - 1];
      if (!card.faceUp) return;
      cardsToMove = [card];
    } else if (pileType === 'tableau') {
      const col = this.game.tableau[pileIndex];
      if (cardIndex >= col.length) return;
      card = col[cardIndex];
      if (!card.faceUp) return;
      cardsToMove = col.slice(cardIndex);
    } else {
      return;
    }

    if (!card) return;

    // Prevent default to avoid text selection
    if (e.cancelable) e.preventDefault();

    this._dragging = false;
    this._moved = false;
    this._dragCards = cardsToMove;
    this._fromPile = { type: pileType, index: pileIndex };
    this._fromCardIndex = cardIndex;
    this._fromCardRect = cardInfo.el.getBoundingClientRect();
    this._startX = pos.x;
    this._startY = pos.y;
    this._offsetX = pos.x - this._fromCardRect.left;
    this._offsetY = pos.y - this._fromCardRect.top;
    this._lastX = pos.x;
    this._lastY = pos.y;
    this._lastTime = Date.now();
    this._velocity = { x: 0, y: 0 };
    this._ghostX = this._fromCardRect.left;
    this._ghostY = this._fromCardRect.top;
  }

  _onPointerMove(e) {
    if (!this._dragCards.length && !this._dragging) return;
    if (!this._dragCards.length) return;

    const pos = this._getPointerPos(e);
    const dx = pos.x - this._startX;
    const dy = pos.y - this._startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!this._dragging) {
      if (dist < this._threshold) return;
      this._startDrag();
    }

    if (e.cancelable) e.preventDefault();

    // Update velocity
    const now = Date.now();
    const dt = Math.max(now - this._lastTime, 1);
    this._velocity.x = (pos.x - this._lastX) / dt * 16;
    this._velocity.y = (pos.y - this._lastY) / dt * 16;
    this._lastX = pos.x;
    this._lastY = pos.y;
    this._lastTime = now;

    // Update ghost position
    this._ghostX = pos.x - this._offsetX;
    this._ghostY = pos.y - this._offsetY;

    if (!this._raf) {
      this._raf = requestAnimationFrame(() => {
        this._raf = null;
        this._updateGhostPosition();
        this._updateDropTarget(pos.x, pos.y);
      });
    }
  }

  _startDrag() {
    this._dragging = true;
    this._moved = true;

    // Build ghost
    const ghost = this._dragGhost;
    ghost.innerHTML = '';
    ghost.style.width = `${this._fromCardRect.width}px`;
    ghost.style.height = 'auto';

    // Mark source cards as dragging
    this._markSourceDragging(true);

    // Create ghost cards
    const faceDownOffset = 20;
    const faceUpOffset = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--tableau-offset-down')) || 28;

    for (let i = 0; i < this._dragCards.length; i++) {
      const card = this._dragCards[i];
      const cardEl = this.renderer.createCardElement(card);
      cardEl.style.position = i === 0 ? 'relative' : 'absolute';
      cardEl.style.top = i === 0 ? '0' : `${i * faceUpOffset}px`;
      cardEl.style.left = '0';
      cardEl.style.right = '0';
      cardEl.style.zIndex = String(i + 1);
      cardEl.style.pointerEvents = 'none';
      ghost.appendChild(cardEl);
    }

    if (this._dragCards.length > 1) {
      const h = this._fromCardRect.height + (this._dragCards.length - 1) * faceUpOffset;
      ghost.style.height = `${h}px`;
    }

    ghost.style.transform = `rotate(2deg) scale(1.04)`;
    ghost.style.boxShadow = '0 12px 32px rgba(0,0,0,0.5)';
    ghost.style.left = `${this._ghostX}px`;
    ghost.style.top = `${this._ghostY}px`;
    ghost.classList.add('active');

    // Highlight valid drop targets
    this.renderer.highlightValidDropTargets(this._dragCards[0]);
  }

  _markSourceDragging(isDragging) {
    if (!this._fromPile) return;
    const { type, index } = this._fromPile;
    let pileEl;
    if (type === 'waste') pileEl = document.getElementById('pile-waste');
    else if (type === 'foundation') pileEl = document.getElementById(`pile-foundation-${index}`);
    else if (type === 'tableau') pileEl = document.getElementById(`pile-tableau-${index}`);

    if (!pileEl) return;
    const cards = pileEl.querySelectorAll('.card');
    cards.forEach((c, i) => {
      if (i >= this._fromCardIndex) {
        if (isDragging) c.classList.add('dragging');
        else c.classList.remove('dragging');
      }
    });
  }

  _updateGhostPosition() {
    if (!this._dragging) return;
    const ghost = this._dragGhost;
    ghost.style.left = `${this._ghostX}px`;
    ghost.style.top = `${this._ghostY}px`;
  }

  _updateDropTarget(x, y) {
    if (!this._dragging) return;

    // Hide ghost temporarily to find element below
    this._dragGhost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    this._dragGhost.style.display = '';

    const pileInfo = el ? this._getPileInfo(el) : null;
    const cardInfo = el ? this._getCardInfo(el) : null;

    let targetPile = null;
    if (pileInfo && pileInfo.pileType !== 'stock') {
      targetPile = { type: pileInfo.pileType, index: pileInfo.pileIndex, el: pileInfo.el };
    } else if (cardInfo && cardInfo.pileType !== 'stock') {
      targetPile = { type: cardInfo.pileType, index: cardInfo.pileIndex, el: cardInfo.el.closest('.pile') };
    }

    // Update visual target indicator
    if (this._targetEl) {
      this._targetEl.classList.remove('valid-drop-target', 'invalid-drop');
    }

    if (targetPile && targetPile.el) {
      const card = this._dragCards[0];
      let isValid = false;
      if (targetPile.type === 'foundation') {
        isValid = this.game.canMoveToFoundation(card, targetPile.index);
      } else if (targetPile.type === 'tableau') {
        isValid = this.game.canMoveToTableau(card, targetPile.index);
      }
      this._targetEl = targetPile.el;
      this._targetEl.classList.add(isValid ? 'valid-drop-target' : 'invalid-drop');
    } else {
      this._targetEl = null;
    }
  }

  _onPointerUp(e) {
    if (!this._dragCards.length) return;

    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }

    if (!this._dragging) {
      // It was a click, not a drag
      this._dragCards = [];
      this._fromPile = null;
      return;
    }

    const pos = this._getPointerPos(e);

    // Find drop target
    this._dragGhost.style.display = 'none';
    const el = document.elementFromPoint(pos.x, pos.y);
    this._dragGhost.style.display = '';

    const pileInfo = el ? this._getPileInfo(el) : null;
    const cardInfo = el ? this._getCardInfo(el) : null;

    let toPile = null;
    if (pileInfo && pileInfo.pileType !== 'stock') {
      toPile = { type: pileInfo.pileType, index: pileInfo.pileIndex };
    } else if (cardInfo && cardInfo.pileType !== 'stock') {
      toPile = { type: cardInfo.pileType, index: cardInfo.pileIndex };
    }

    const fromPile = this._fromPile;
    const cardIndex = this._fromCardIndex;

    this._markSourceDragging(false);
    this.renderer.clearDropHighlights();

    if (this._targetEl) {
      this._targetEl.classList.remove('valid-drop-target', 'invalid-drop');
      this._targetEl = null;
    }

    // Hide ghost
    this._dragGhost.classList.remove('active');
    this._dragGhost.innerHTML = '';
    this._dragging = false;

    // Attempt move
    if (toPile && fromPile) {
      const moved = this.onMove(fromPile, cardIndex, toPile);
      if (!moved) {
        // Spring back animation
        this._springBack();
      }
    } else {
      // No valid target - animate snap back (already hidden ghost, just re-render)
    }

    this._dragCards = [];
    this._fromPile = null;
    this._moved = false;
  }

  _springBack() {
    // Ghost already hidden; the renderer will re-render correctly
    // No additional animation needed since cards were never visually moved from pile
  }

  _onDoubleClick(e) {
    const cardInfo = this._getCardInfo(e.target);
    if (!cardInfo || !cardInfo.pileType) return;
    if (typeof this.onDoubleClick === 'function') {
      this.onDoubleClick(cardInfo.pileType, cardInfo.pileIndex, cardInfo.cardIndex);
    }
  }

  destroy() {
    document.removeEventListener('mousedown', this._onPointerDown);
    document.removeEventListener('mousemove', this._onPointerMove);
    document.removeEventListener('mouseup', this._onPointerUp);
    document.removeEventListener('touchstart', this._onPointerDown);
    document.removeEventListener('touchmove', this._onPointerMove);
    document.removeEventListener('touchend', this._onPointerUp);
    document.removeEventListener('dblclick', this._onDoubleClick);
  }
}

window.DragManager = DragManager;
