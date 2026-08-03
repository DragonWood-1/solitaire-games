/* Puzzle Planet - Game Engine */
'use strict';

// Mulberry32 seeded PRNG
function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a seed from today's date (for daily challenge)
function dateSeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const ch = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return Math.abs(hash);
}

class GameState {
  constructor() {
    this.stock = [];
    this.waste = [];
    this.foundations = [[], [], [], []]; // 0=spades,1=hearts,2=diamonds,3=clubs
    this.tableau = [[], [], [], [], [], [], []];
    this.drawMode = 1;
    this.scoringMode = 'standard';
    this.autoFlip = true;
    this.score = 0;
    this.moves = 0;
    this.startTime = null;
    this.elapsed = 0;
    this._timerRef = null;
    this._history = []; // undo stack
    this._redoStack = [];
    this._maxHistory = 100;
    this._lastScoreDecay = 0;
    this.isDaily = false;
    this.dailyDate = null;
    this.gameOver = false;
    this.won = false;
    this.hintsUsed = 0;
    this.undosUsed = 0;
    this.foundationMoves = 0;
    this.seed = null;
    this.onUpdate = null; // callback
    this.onWin = null;
    this.onDraw = null;
  }

  // Fisher-Yates shuffle with optional seed
  _shuffle(arr, seed) {
    const rng = seed !== undefined ? mulberry32(seed) : Math.random.bind(Math);
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  deal(seed) {
    this.seed = seed !== undefined ? seed : Math.floor(Math.random() * 2147483647);
    const deck = this._shuffle(Card.createDeck(), this.seed);
    this.stock = [];
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.tableau = [[], [], [], [], [], [], []];
    this.score = 0;
    this.moves = 0;
    this.elapsed = 0;
    this._history = [];
    this._redoStack = [];
    this._lastScoreDecay = 0;
    this.gameOver = false;
    this.won = false;
    this.hintsUsed = 0;
    this.undosUsed = 0;
    this.foundationMoves = 0;

    // Deal to tableau: col i gets i+1 cards, top card face-up
    let idx = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[idx++].clone();
        card.faceUp = (row === col);
        this.tableau[col].push(card);
      }
    }
    // Rest goes to stock (all face-down)
    while (idx < deck.length) {
      this.stock.push(deck[idx++]);
    }

    this.startTime = Date.now();
    this._lastScoreDecay = Date.now();
    this._notifyUpdate();
  }

  dealDaily(dateStr) {
    this.isDaily = true;
    this.dailyDate = dateStr;
    this.deal(dateSeed(dateStr));
  }

  _notifyUpdate() {
    if (typeof this.onUpdate === 'function') this.onUpdate(this);
  }

  _notifyWin() {
    if (typeof this.onWin === 'function') this.onWin(this);
  }

  getElapsed() {
    if (!this.startTime) return this.elapsed;
    return this.elapsed + (Date.now() - this.startTime);
  }

  pauseTimer() {
    if (this.startTime) {
      this.elapsed += Date.now() - this.startTime;
      this.startTime = null;
    }
  }

  resumeTimer() {
    if (!this.startTime && !this.gameOver) {
      this.startTime = Date.now();
    }
  }

  // Score decay: -2 per 10 seconds
  checkScoreDecay() {
    if (this.gameOver) return;
    const now = Date.now();
    const intervals = Math.floor((now - this._lastScoreDecay) / 10000);
    if (intervals > 0) {
      this.score = Math.max(0, this.score - intervals * 2);
      this._lastScoreDecay += intervals * 10000;
    }
  }

  // ==========================================
  // Draw from stock
  // ==========================================
  drawCard() {
    if (this.gameOver) return false;

    if (this.stock.length === 0) {
      if (this.waste.length === 0) return false;
      // Reset: flip waste back to stock (no score change in standard; -100 in vegas)
      this._saveHistory('reset');
      const flipped = this.waste.slice().reverse().map(c => {
        const nc = c.clone();
        nc.faceUp = false;
        return nc;
      });
      this.stock = flipped;
      this.waste = [];
      if (this.scoringMode === 'vegas') {
        this.score = Math.max(0, this.score - 100);
      }
      this.moves++;
      this._redoStack = [];
      this._notifyUpdate();
      return true;
    }

    this._saveHistory('draw');
    const count = Math.min(this.drawMode, this.stock.length);
    for (let i = 0; i < count; i++) {
      const card = this.stock.pop().clone();
      card.faceUp = true;
      this.waste.push(card);
    }
    this.moves++;
    this._redoStack = [];
    this._notifyUpdate();
    if (typeof this.onDraw === 'function') this.onDraw();
    return true;
  }

  // ==========================================
  // Foundation suit index
  // ==========================================
  _suitIndex(suit) {
    return { spades: 0, hearts: 1, diamonds: 2, clubs: 3 }[suit];
  }

  // ==========================================
  // Can move to foundation?
  // ==========================================
  canMoveToFoundation(card, foundationIndex) {
    if (!card || !card.faceUp) return false;
    const pile = this.foundations[foundationIndex];
    const expectedSuit = ['spades', 'hearts', 'diamonds', 'clubs'][foundationIndex];
    if (card.suit !== expectedSuit) return false;
    if (pile.length === 0) return card.rank === 1;
    const top = pile[pile.length - 1];
    return card.rank === top.rank + 1;
  }

  // Can move to any foundation?
  canMoveToAnyFoundation(card) {
    for (let i = 0; i < 4; i++) {
      if (this.canMoveToFoundation(card, i)) return i;
    }
    return -1;
  }

  // ==========================================
  // Can move to tableau?
  // ==========================================
  canMoveToTableau(card, targetPileIndex) {
    if (!card || !card.faceUp) return false;
    const pile = this.tableau[targetPileIndex];
    if (pile.length === 0) return card.rank === 13;
    const top = pile[pile.length - 1];
    if (!top.faceUp) return false;
    return (card.color !== top.color) && (card.rank === top.rank - 1);
  }

  // ==========================================
  // Move cards
  // ==========================================
  // fromPile: {type: 'stock'|'waste'|'foundation'|'tableau', index?: number}
  // toPile: {type: 'foundation'|'tableau', index: number}
  // cardIndex: index within source pile (for tableau moves)
  moveCards(fromPile, cardIndex, toPile) {
    if (this.gameOver) return false;

    let cardsToMove = [];
    let valid = false;

    // Get cards from source
    if (fromPile.type === 'waste') {
      if (this.waste.length === 0) return false;
      cardsToMove = [this.waste[this.waste.length - 1]];
    } else if (fromPile.type === 'foundation') {
      const pile = this.foundations[fromPile.index];
      if (pile.length === 0) return false;
      cardsToMove = [pile[pile.length - 1]];
    } else if (fromPile.type === 'tableau') {
      const pile = this.tableau[fromPile.index];
      if (cardIndex < 0 || cardIndex >= pile.length) return false;
      cardsToMove = pile.slice(cardIndex);
      if (cardsToMove.some(c => !c.faceUp)) return false;
    } else {
      return false;
    }

    const card = cardsToMove[0];

    // Validate destination
    if (toPile.type === 'foundation') {
      if (cardsToMove.length !== 1) return false;
      valid = this.canMoveToFoundation(card, toPile.index);
    } else if (toPile.type === 'tableau') {
      valid = this.canMoveToTableau(card, toPile.index);
    }

    if (!valid) return false;

    this._saveHistory('move');

    // Remove from source
    if (fromPile.type === 'waste') {
      this.waste.pop();
    } else if (fromPile.type === 'foundation') {
      this.foundations[fromPile.index].pop();
    } else if (fromPile.type === 'tableau') {
      this.tableau[fromPile.index].splice(cardIndex);
    }

    // Add to destination
    if (toPile.type === 'foundation') {
      this.foundations[toPile.index].push(...cardsToMove);
      this.foundationMoves++;
    } else if (toPile.type === 'tableau') {
      this.tableau[toPile.index].push(...cardsToMove);
    }

    // Auto-flip revealed card
    if (this.autoFlip && fromPile.type === 'tableau') {
      const col = this.tableau[fromPile.index];
      if (col.length > 0 && !col[col.length - 1].faceUp) {
        col[col.length - 1].faceUp = true;
      }
    }

    // Scoring
    this._scoreMove(fromPile, toPile);
    this.moves++;
    this._redoStack = [];
    this._notifyUpdate();

    // Check win
    if (this.checkWin()) {
      this.gameOver = true;
      this.won = true;
      this.pauseTimer();
      this._notifyWin();
    }

    return true;
  }

  _scoreMove(fromPile, toPile) {
    if (this.scoringMode === 'standard') {
      if (fromPile.type === 'waste' && toPile.type === 'tableau') {
        this.score += 5;
      } else if (fromPile.type === 'waste' && toPile.type === 'foundation') {
        this.score += 10;
      } else if (fromPile.type === 'tableau' && toPile.type === 'foundation') {
        this.score += 10;
      } else if (fromPile.type === 'foundation' && toPile.type === 'tableau') {
        this.score = Math.max(0, this.score - 15);
      }
    } else if (this.scoringMode === 'vegas') {
      // In Vegas mode each card moved to foundation is worth a fixed score
      if (toPile.type === 'foundation') {
        this.score += 5;
      }
    }
    this.score = Math.max(0, this.score);
  }

  // ==========================================
  // Win condition
  // ==========================================
  checkWin() {
    return this.foundations.every(pile => pile.length === 13);
  }

  // All remaining cards are face-up (auto-complete eligible)
  canAutoComplete() {
    if (this.gameOver) return false;
    const allFaceUp = this.tableau.every(col => col.every(c => c.faceUp)) &&
                      this.waste.every(c => c.faceUp) &&
                      this.stock.length === 0;
    return allFaceUp && !this.checkWin();
  }

  // ==========================================
  // Undo / Redo
  // ==========================================
  _saveHistory(type) {
    const snap = this._snapshot();
    snap._type = type;
    this._history.push(snap);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }
  }

  _snapshot() {
    return {
      stock: this.stock.map(c => c.clone()),
      waste: this.waste.map(c => c.clone()),
      foundations: this.foundations.map(f => f.map(c => c.clone())),
      tableau: this.tableau.map(t => t.map(c => c.clone())),
      score: this.score,
      moves: this.moves,
      elapsed: this.getElapsed(),
      foundationMoves: this.foundationMoves,
    };
  }

  _restoreSnapshot(snap) {
    this.stock = snap.stock.map(c => c.clone());
    this.waste = snap.waste.map(c => c.clone());
    this.foundations = snap.foundations.map(f => f.map(c => c.clone()));
    this.tableau = snap.tableau.map(t => t.map(c => c.clone()));
    this.score = snap.score;
    this.moves = snap.moves;
    this.elapsed = snap.elapsed;
    this.foundationMoves = snap.foundationMoves;
    this.startTime = Date.now();
    this._lastScoreDecay = Date.now();
  }

  undo() {
    if (this._history.length === 0) return false;
    const redoSnap = this._snapshot();
    const snap = this._history.pop();
    this._redoStack.push(redoSnap);
    this._restoreSnapshot(snap);
    this.undosUsed++;
    this.gameOver = false;
    this.won = false;
    this._notifyUpdate();
    return true;
  }

  redo() {
    if (this._redoStack.length === 0) return false;
    const undoSnap = this._snapshot();
    const snap = this._redoStack.pop();
    this._history.push(undoSnap);
    this._restoreSnapshot(snap);
    this._notifyUpdate();
    return true;
  }

  canUndo() { return this._history.length > 0; }
  canRedo() { return this._redoStack.length > 0; }

  // ==========================================
  // Hints
  // ==========================================
  getHints() {
    const hints = [];

    // Get all playable cards
    const candidates = [];

    // From waste
    if (this.waste.length > 0) {
      candidates.push({ type: 'waste', card: this.waste[this.waste.length - 1], index: this.waste.length - 1 });
    }

    // From tableau tops
    for (let ci = 0; ci < 7; ci++) {
      const col = this.tableau[ci];
      // Face-up sequences
      const firstFaceUp = col.findIndex(c => c.faceUp);
      if (firstFaceUp >= 0) {
        candidates.push({ type: 'tableau', pileIndex: ci, card: col[firstFaceUp], cardIndex: firstFaceUp });
      }
    }

    // From foundations (moving back is sometimes useful)
    for (let fi = 0; fi < 4; fi++) {
      const pile = this.foundations[fi];
      if (pile.length > 0) {
        candidates.push({ type: 'foundation', pileIndex: fi, card: pile[pile.length - 1], cardIndex: pile.length - 1 });
      }
    }

    // Check each candidate against foundations and tableau
    for (const cand of candidates) {
      // To foundation
      const fi = this.canMoveToAnyFoundation(cand.card);
      if (fi >= 0) {
        hints.push({
          from: { type: cand.type, index: cand.pileIndex, cardIndex: cand.cardIndex },
          to: { type: 'foundation', index: fi },
          card: cand.card,
          priority: 10
        });
      }

      // To tableau
      for (let ti = 0; ti < 7; ti++) {
        if (cand.type === 'tableau' && cand.pileIndex === ti) continue;
        if (this.canMoveToTableau(cand.card, ti)) {
          // Avoid moving if it's already at top of a pile and leads to empty pile making same empty pile
          const fromPile = cand.type === 'tableau' ? this.tableau[cand.pileIndex] : null;
          const toPile = this.tableau[ti];
          // Prefer moves that expose face-down cards
          const exposesCard = fromPile && cand.cardIndex > 0 && !fromPile[cand.cardIndex - 1].faceUp;
          const priority = exposesCard ? 8 : (cand.type !== 'tableau' ? 5 : 3);
          hints.push({
            from: { type: cand.type, index: cand.pileIndex, cardIndex: cand.cardIndex },
            to: { type: 'tableau', index: ti },
            card: cand.card,
            priority
          });
        }
      }
    }

    // Stock draw if no waste or other hints
    if (hints.length === 0 && (this.stock.length > 0 || this.waste.length > 0)) {
      hints.push({
        from: { type: 'stock' },
        to: { type: 'stock' },
        card: null,
        priority: 1,
        action: 'draw'
      });
    }

    hints.sort((a, b) => b.priority - a.priority);
    return hints;
  }

  // ==========================================
  // Analyze Position
  // ==========================================
  analyzePosition() {
    const hints = this.getHints();
    const totalCards = 52;
    const inFoundation = this.foundations.reduce((s, p) => s + p.length, 0);
    const efficiency = Math.round((inFoundation / totalCards) * 100);

    // Check for deadlock: no valid moves
    const deadlocked = hints.length === 0 ||
      (hints.length === 1 && hints[0].action === 'draw' && this.stock.length === 0 && this.waste.length <= this.drawMode);

    let suggestion = '';
    if (hints.length > 0 && hints[0].action !== 'draw') {
      const h = hints[0];
      const fromName = h.from.type === 'waste' ? 'waste' :
                       h.from.type === 'foundation' ? 'foundation' :
                       `column ${(h.from.index || 0) + 1}`;
      const toName = h.to.type === 'foundation' ? 'foundation' :
                     `column ${(h.to.index || 0) + 1}`;
      suggestion = `Consider moving ${h.card ? h.card.rankDisplay + h.card.symbol : '?'} from ${fromName} to ${toName}`;
    } else if (this.stock.length > 0) {
      suggestion = 'Draw from the stock pile to reveal more cards.';
    } else if (deadlocked) {
      suggestion = 'No more moves available. Try undoing or starting a new game.';
    } else {
      suggestion = 'Keep moving cards to foundations!';
    }

    return { deadlocked, efficiency, suggestion, hintsAvailable: hints.length };
  }

  // ==========================================
  // Auto-complete step
  // ==========================================
  autoCompleteStep() {
    // Move lowest-ranked foundation-eligible card
    for (let fi = 0; fi < 4; fi++) {
      // From tableau
      for (let ti = 0; ti < 7; ti++) {
        const col = this.tableau[ti];
        if (col.length > 0) {
          const card = col[col.length - 1];
          if (card.faceUp && this.canMoveToFoundation(card, fi)) {
            return this.moveCards({ type: 'tableau', index: ti }, col.length - 1, { type: 'foundation', index: fi });
          }
        }
      }
      // From waste
      if (this.waste.length > 0) {
        const card = this.waste[this.waste.length - 1];
        if (this.canMoveToFoundation(card, fi)) {
          return this.moveCards({ type: 'waste' }, this.waste.length - 1, { type: 'foundation', index: fi });
        }
      }
    }
    return false;
  }

  // ==========================================
  // Serialization
  // ==========================================
  toJSON() {
    return {
      stock: this.stock.map(c => c.toJSON()),
      waste: this.waste.map(c => c.toJSON()),
      foundations: this.foundations.map(f => f.map(c => c.toJSON())),
      tableau: this.tableau.map(t => t.map(c => c.toJSON())),
      drawMode: this.drawMode,
      scoringMode: this.scoringMode,
      autoFlip: this.autoFlip,
      score: this.score,
      moves: this.moves,
      elapsed: this.getElapsed(),
      isDaily: this.isDaily,
      dailyDate: this.dailyDate,
      gameOver: this.gameOver,
      won: this.won,
      hintsUsed: this.hintsUsed,
      undosUsed: this.undosUsed,
      foundationMoves: this.foundationMoves,
      seed: this.seed,
    };
  }

  fromJSON(data) {
    this.stock = data.stock.map(c => Card.fromJSON(c));
    this.waste = data.waste.map(c => Card.fromJSON(c));
    this.foundations = data.foundations.map(f => f.map(c => Card.fromJSON(c)));
    this.tableau = data.tableau.map(t => t.map(c => Card.fromJSON(c)));
    this.drawMode = data.drawMode || 1;
    this.scoringMode = data.scoringMode || 'standard';
    this.autoFlip = data.autoFlip !== undefined ? data.autoFlip : true;
    this.score = data.score || 0;
    this.moves = data.moves || 0;
    this.elapsed = data.elapsed || 0;
    this.isDaily = data.isDaily || false;
    this.dailyDate = data.dailyDate || null;
    this.gameOver = data.gameOver || false;
    this.won = data.won || false;
    this.hintsUsed = data.hintsUsed || 0;
    this.undosUsed = data.undosUsed || 0;
    this.foundationMoves = data.foundationMoves || 0;
    this.seed = data.seed || null;
    this.startTime = this.gameOver ? null : Date.now();
    this._lastScoreDecay = Date.now();
    this._history = [];
    this._redoStack = [];
  }

  getScore() {
    return this.score;
  }
}

window.GameState = GameState;
window.mulberry32 = mulberry32;
window.dateSeed = dateSeed;
