/* SolitaireRealm - Renderer */
'use strict';

class Renderer {
  constructor(gameState) {
    this.game = gameState;
    this.animationSpeed = 1; // multiplier: 0=none, 0.5=fast, 1=normal, 2=slow
    this._celebrationParticles = [];
    this._celebrationFrame = null;
    this._wasteFanOffset = 20; // px offset for waste fan
  }

  // ==========================================
  // Card Element Creation
  // ==========================================
  createCardElement(card) {
    const el = document.createElement('div');
    el.className = `card ${card.faceUp ? 'face-up' : 'face-down'} ${card.color}`;
    el.dataset.cardId = card.id;
    el.dataset.suit = card.suit;
    el.dataset.rank = card.rank;

    // Back face
    const back = document.createElement('div');
    back.className = 'card-back';
    el.appendChild(back);

    // Front face
    const face = document.createElement('div');
    face.className = 'card-face';

    const cornerTop = document.createElement('div');
    cornerTop.className = 'card-corner card-corner-top';
    const rankTopEl = document.createElement('span');
    rankTopEl.className = 'card-rank';
    rankTopEl.textContent = card.rankDisplay;
    const suitTopEl = document.createElement('span');
    suitTopEl.className = 'card-suit-small';
    suitTopEl.textContent = card.symbol;
    cornerTop.appendChild(rankTopEl);
    cornerTop.appendChild(suitTopEl);

    const cornerBottom = document.createElement('div');
    cornerBottom.className = 'card-corner card-corner-bottom';
    const rankBotEl = document.createElement('span');
    rankBotEl.className = 'card-rank';
    rankBotEl.textContent = card.rankDisplay;
    const suitBotEl = document.createElement('span');
    suitBotEl.className = 'card-suit-small';
    suitBotEl.textContent = card.symbol;
    cornerBottom.appendChild(rankBotEl);
    cornerBottom.appendChild(suitBotEl);

    const center = document.createElement('div');
    center.className = 'card-center';
    center.textContent = card.symbol;
    center.setAttribute('aria-hidden', 'true');

    face.appendChild(cornerTop);
    face.appendChild(center);
    face.appendChild(cornerBottom);
    el.appendChild(face);

    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', card.faceUp ? `${card.rankDisplay} of ${card.suit}` : 'Face-down card');

    card.element = el;
    return el;
  }

  // ==========================================
  // Render Entire Board
  // ==========================================
  renderAll() {
    this._renderStock();
    this._renderWaste();
    for (let i = 0; i < 4; i++) this._renderFoundation(i);
    for (let i = 0; i < 7; i++) this._renderTableau(i);
  }

  _renderStock() {
    const pile = document.getElementById('pile-stock');
    if (!pile) return;
    // Remove old cards (keep placeholder)
    const oldCards = pile.querySelectorAll('.card');
    oldCards.forEach(c => c.remove());

    if (this.game.stock.length > 0) {
      const topCard = this.game.stock[this.game.stock.length - 1].clone();
      topCard.faceUp = false;
      const el = this.createCardElement(topCard);
      el.style.position = 'absolute';
      el.style.inset = '0';
      el.style.cursor = 'pointer';
      pile.appendChild(el);
    }
    // Show count indicator
    let countEl = pile.querySelector('.stock-count');
    if (!countEl) {
      countEl = document.createElement('div');
      countEl.className = 'stock-count';
      countEl.style.cssText = `
        position: absolute;
        bottom: 4px;
        right: 6px;
        font-size: 11px;
        font-weight: 700;
        color: rgba(255,255,255,0.5);
        pointer-events: none;
        z-index: 5;
      `;
      pile.appendChild(countEl);
    }
    countEl.textContent = this.game.stock.length > 0 ? this.game.stock.length : '';
  }

  _renderWaste() {
    const pile = document.getElementById('pile-waste');
    if (!pile) return;
    const oldCards = pile.querySelectorAll('.card');
    oldCards.forEach(c => c.remove());

    const waste = this.game.waste;
    if (waste.length === 0) return;

    const drawMode = this.game.drawMode;
    const showCount = Math.min(drawMode, waste.length);
    const startIdx = waste.length - showCount;

    for (let i = 0; i < showCount; i++) {
      const card = waste[startIdx + i];
      const el = this.createCardElement(card);
      el.style.position = 'absolute';
      el.style.inset = '0';
      el.style.zIndex = String(i + 1);

      // Fan them if draw 3
      if (drawMode === 3 && showCount > 1) {
        const offset = i * this._wasteFanOffset;
        el.style.left = `${offset}px`;
        el.style.right = `${-offset}px`;
      }

      // Only top card is interactive
      if (i < showCount - 1) {
        el.style.pointerEvents = 'none';
        el.style.cursor = 'default';
      }

      el.dataset.pileType = 'waste';
      el.dataset.pileIndex = String(waste.length - showCount + i);

      pile.appendChild(el);
    }
    card && (pile.style.minWidth = drawMode === 3 ? `calc(var(--card-width) + ${(showCount - 1) * this._wasteFanOffset}px)` : '');
  }

  _renderFoundation(index) {
    const pile = document.getElementById(`pile-foundation-${index}`);
    if (!pile) return;
    const oldCards = pile.querySelectorAll('.card');
    oldCards.forEach(c => c.remove());

    const cards = this.game.foundations[index];
    if (cards.length === 0) return;

    const topCard = cards[cards.length - 1];
    const el = this.createCardElement(topCard);
    el.style.position = 'absolute';
    el.style.inset = '0';
    el.dataset.pileType = 'foundation';
    el.dataset.pileIndex = String(index);
    el.dataset.cardIndex = String(cards.length - 1);
    pile.appendChild(el);
  }

  _renderTableau(index) {
    const pile = document.getElementById(`pile-tableau-${index}`);
    if (!pile) return;
    const oldCards = pile.querySelectorAll('.card');
    oldCards.forEach(c => c.remove());

    const cards = this.game.tableau[index];
    if (cards.length === 0) {
      pile.style.minHeight = 'var(--card-height)';
      return;
    }

    const faceDownOffset = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--tableau-offset-up')) || 20;
    const faceUpOffset = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--tableau-offset-down')) || 28;

    let topPos = 0;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const el = this.createCardElement(card);
      el.style.position = 'absolute';
      el.style.top = `${topPos}px`;
      el.style.left = '0';
      el.style.right = '0';
      el.style.zIndex = String(i + 1);
      el.dataset.pileType = 'tableau';
      el.dataset.pileIndex = String(index);
      el.dataset.cardIndex = String(i);
      pile.appendChild(el);
      if (i < cards.length - 1) {
        topPos += card.faceUp ? faceUpOffset : faceDownOffset;
      }
    }

    // Set pile min-height to contain all cards
    const cardHeight = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--card-height')) || 112;
    pile.style.minHeight = `${topPos + cardHeight}px`;
  }

  // ==========================================
  // FLIP Animation (FLIP = First Last Invert Play)
  // ==========================================
  animateCardMove(cardEl, fromRect, toRect, duration) {
    if (!cardEl || this.animationSpeed === 0) return Promise.resolve();

    const actualDuration = duration * this.animationSpeed;
    if (actualDuration <= 0) return Promise.resolve();

    const dx = fromRect.left - toRect.left;
    const dy = fromRect.top - toRect.top;

    cardEl.style.transform = `translate(${dx}px, ${dy}px)`;
    cardEl.style.transition = 'none';
    cardEl.style.zIndex = '1000';

    return new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cardEl.style.transition = `transform ${actualDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
          cardEl.style.transform = '';
          cardEl.addEventListener('transitionend', () => {
            cardEl.style.transition = '';
            cardEl.style.zIndex = '';
            resolve();
          }, { once: true });
        });
      });
    });
  }

  // ==========================================
  // Card Flip Animation
  // ==========================================
  animateFlip(cardEl, onHalfway, duration) {
    if (!cardEl || this.animationSpeed === 0) {
      if (onHalfway) onHalfway();
      return Promise.resolve();
    }

    const actualDuration = duration * this.animationSpeed;

    return new Promise(resolve => {
      cardEl.style.transition = `transform ${actualDuration / 2}ms ease-in`;
      cardEl.style.transform = 'rotateY(90deg)';

      const handler = () => {
        if (onHalfway) onHalfway();
        cardEl.style.transition = `transform ${actualDuration / 2}ms ease-out`;
        cardEl.style.transform = 'rotateY(0deg)';
        const handler2 = () => {
          cardEl.style.transition = '';
          cardEl.style.transform = '';
          resolve();
        };
        cardEl.addEventListener('transitionend', handler2, { once: true });
      };

      cardEl.addEventListener('transitionend', handler, { once: true });
    });
  }

  // ==========================================
  // Win Animation
  // ==========================================
  animateWin() {
    const overlay = document.getElementById('win-celebration');
    if (!overlay) return;

    const suits = ['♠', '♥', '♦', '♣'];
    const colors = ['#e94560', '#c084fc', '#38bdf8', '#34d399'];
    const particles = [];

    for (let i = 0; i < 60; i++) {
      const particle = document.createElement('div');
      const suit = suits[Math.floor(Math.random() * suits.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.textContent = suit;
      particle.style.cssText = `
        position: absolute;
        font-size: ${12 + Math.random() * 20}px;
        color: ${color};
        left: ${Math.random() * 100}%;
        top: 100%;
        opacity: 1;
        pointer-events: none;
        will-change: transform, opacity;
      `;

      const vx = (Math.random() - 0.5) * 200;
      const vy = -(200 + Math.random() * 400);
      const rotation = (Math.random() - 0.5) * 720;

      particle._vx = vx;
      particle._vy = vy;
      particle._rotation = 0;
      particle._rotSpeed = rotation;
      particle._x = parseFloat(particle.style.left);
      particle._y = 100;
      particle._opacity = 1;
      particle._delay = Math.random() * 1000;

      overlay.appendChild(particle);
      particles.push(particle);
    }

    let startTime = null;
    const totalDuration = 3000;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      particles.forEach(p => {
        const pElapsed = elapsed - p._delay;
        if (pElapsed < 0) return;
        const t = pElapsed / 1000;
        const x = parseFloat(p.style.left) + p._vx * t * 0.01;
        const y = 100 + p._vy * t * 0.01 + 0.5 * 200 * t * t * 0.01;
        const rot = p._rotSpeed * t * 0.01;
        const opacity = Math.max(0, 1 - pElapsed / totalDuration);

        p.style.transform = `translate(${(x - parseFloat(p.style.left)) * 0.5}px, ${y - 100}%) rotate(${rot}deg)`;
        p.style.opacity = opacity;
      });

      if (elapsed < totalDuration + 1000) {
        this._celebrationFrame = requestAnimationFrame(animate);
      } else {
        overlay.innerHTML = '';
      }
    };

    this._celebrationFrame = requestAnimationFrame(animate);
  }

  stopWinAnimation() {
    if (this._celebrationFrame) {
      cancelAnimationFrame(this._celebrationFrame);
      this._celebrationFrame = null;
    }
    const overlay = document.getElementById('win-celebration');
    if (overlay) overlay.innerHTML = '';
  }

  // ==========================================
  // Hint Highlight
  // ==========================================
  showHint(fromPile, fromCardIndex, toPile) {
    this.clearHints();

    // Find source card element
    let sourceEl = null;
    if (fromPile.type === 'waste') {
      const pileEl = document.getElementById('pile-waste');
      if (pileEl) {
        const cards = pileEl.querySelectorAll('.card');
        if (cards.length > 0) sourceEl = cards[cards.length - 1];
      }
    } else if (fromPile.type === 'tableau') {
      const pileEl = document.getElementById(`pile-tableau-${fromPile.index}`);
      if (pileEl) {
        const cards = pileEl.querySelectorAll('.card');
        if (fromCardIndex < cards.length) sourceEl = cards[fromCardIndex];
      }
    } else if (fromPile.type === 'foundation') {
      const pileEl = document.getElementById(`pile-foundation-${fromPile.index}`);
      if (pileEl) {
        const cards = pileEl.querySelectorAll('.card');
        if (cards.length > 0) sourceEl = cards[cards.length - 1];
      }
    }

    // Find target pile element
    let targetEl = null;
    if (toPile.type === 'foundation') {
      targetEl = document.getElementById(`pile-foundation-${toPile.index}`);
    } else if (toPile.type === 'tableau') {
      targetEl = document.getElementById(`pile-tableau-${toPile.index}`);
    }

    if (sourceEl) {
      sourceEl.classList.add('hint-source');
    }
    if (targetEl) {
      targetEl.classList.add('hint-target');
      // Add to card if there's one
      const topCard = targetEl.querySelector('.card:last-child');
      if (topCard) topCard.classList.add('hint-target');
    }

    // Auto-clear after 2s
    setTimeout(() => this.clearHints(), 2000);
  }

  clearHints() {
    document.querySelectorAll('.hint-source, .hint-target').forEach(el => {
      el.classList.remove('hint-source', 'hint-target');
    });
  }

  // ==========================================
  // Update Stats Display
  // ==========================================
  updateStats(score, timeMs, moves) {
    const scoreEl = document.getElementById('stat-score');
    const timeEl = document.getElementById('stat-time');
    const movesEl = document.getElementById('stat-moves');

    if (scoreEl) scoreEl.textContent = score;
    if (timeEl) timeEl.textContent = this._formatTime(timeMs);
    if (movesEl) movesEl.textContent = moves;
  }

  _formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ==========================================
  // Drop Target Highlighting
  // ==========================================
  highlightValidDropTargets(card) {
    this.clearDropHighlights();
    if (!card) return;

    // Foundation piles
    for (let i = 0; i < 4; i++) {
      if (this.game.canMoveToFoundation(card, i)) {
        const el = document.getElementById(`pile-foundation-${i}`);
        if (el) el.classList.add('valid-drop');
      }
    }

    // Tableau piles
    for (let i = 0; i < 7; i++) {
      if (this.game.canMoveToTableau(card, i)) {
        const el = document.getElementById(`pile-tableau-${i}`);
        if (el) el.classList.add('valid-drop');
      }
    }
  }

  clearDropHighlights() {
    document.querySelectorAll('.valid-drop, .invalid-drop, .valid-drop-target').forEach(el => {
      el.classList.remove('valid-drop', 'invalid-drop', 'valid-drop-target');
    });
  }

  // ==========================================
  // Get Card Position
  // ==========================================
  getCardRect(pileType, pileIndex, cardIndex) {
    let pileEl;
    if (pileType === 'stock') pileEl = document.getElementById('pile-stock');
    else if (pileType === 'waste') pileEl = document.getElementById('pile-waste');
    else if (pileType === 'foundation') pileEl = document.getElementById(`pile-foundation-${pileIndex}`);
    else if (pileType === 'tableau') pileEl = document.getElementById(`pile-tableau-${pileIndex}`);

    if (!pileEl) return null;

    const cards = pileEl.querySelectorAll('.card');
    if (cardIndex !== undefined && cardIndex < cards.length) {
      return cards[cardIndex].getBoundingClientRect();
    }
    return pileEl.getBoundingClientRect();
  }

  setAnimationSpeed(speed) {
    // speed: 'none'=0, 'fast'=0.5, 'normal'=1, 'slow'=2
    const map = { none: 0, fast: 0.5, normal: 1, slow: 2 };
    this.animationSpeed = map[speed] !== undefined ? map[speed] : 1;
  }
}

window.Renderer = Renderer;
