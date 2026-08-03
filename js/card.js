/* Puzzle Planet - Card Class */
'use strict';

class Card {
  constructor(suit, rank) {
    this.suit = suit; // 'spades','hearts','diamonds','clubs'
    this.rank = rank; // 1-13
    this.faceUp = false;
    this.id = `${suit}-${rank}`;
    this.element = null;
  }

  get color() {
    return (this.suit === 'hearts' || this.suit === 'diamonds') ? 'red' : 'black';
  }

  get symbol() {
    return { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }[this.suit];
  }

  get rankDisplay() {
    return { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[this.rank] || String(this.rank);
  }

  get suitSymbol() {
    return this.symbol;
  }

  flip() {
    this.faceUp = !this.faceUp;
    return this;
  }

  clone() {
    const c = new Card(this.suit, this.rank);
    c.faceUp = this.faceUp;
    return c;
  }

  toJSON() {
    return { suit: this.suit, rank: this.rank, faceUp: this.faceUp };
  }

  static fromJSON(data) {
    const c = new Card(data.suit, data.rank);
    c.faceUp = data.faceUp;
    return c;
  }

  static createDeck() {
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    const cards = [];
    for (const suit of suits) {
      for (let rank = 1; rank <= 13; rank++) {
        cards.push(new Card(suit, rank));
      }
    }
    return cards;
  }
}

// Export as global
window.Card = Card;
