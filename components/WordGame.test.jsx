import { describe, it, expect } from 'vitest';
import {
  wordScore,
  adj,
  genGrid,
  dailyGrid,
  calculateBonus,
  scoreWord,
  lengthBonus,
  specialBonus,
  LONG_WORD_BONUS,
  SPECIAL_CHAR_BONUS,
} from './gameLogic';
import BONUS_WORDS from './bonus_words.json';

describe('WordGame Logic Engine', () => {
  
  describe('wordScore()', () => {
    it('calculates basic score correctly', () => {
      // A=1, B=4, S=1 = 6
      expect(wordScore('ABS')).toBe(6);
    });

    it('handles unknown characters by defaulting to 1', () => {
      expect(wordScore('!!!')).toBe(3);
    });
  });

  describe('adj()', () => {
    it('returns true for horizontal neighbors', () => {
      expect(adj(0, 1)).toBe(true); // Index 0 and 1 on a 10-wide grid
    });

    it('returns true for vertical neighbors', () => {
      expect(adj(0, 10)).toBe(true); // Index 0 and 10
    });

    it('returns true for diagonal neighbors', () => {
      expect(adj(11, 0)).toBe(true); // Diagonal top-left
    });

    it('returns false for non-adjacent tiles', () => {
      expect(adj(0, 5)).toBe(false);
    });

    it('returns false for the same tile', () => {
      expect(adj(5, 5)).toBe(false);
    });
  });

  describe('genGrid()', () => {
    it('generates a grid of exactly 100 tiles', () => {
      const grid = genGrid();
      expect(grid.length).toBe(100);
      expect(grid.every(cell => cell !== null)).toBe(true);
    });

    it('dailyGrid is deterministic for a given day and differs across days', () => {
      const a1 = dailyGrid('2026-06-06');
      const a2 = dailyGrid('2026-06-06');
      const b = dailyGrid('2026-06-07');
      expect(a1).toEqual(a2); // same day -> identical shared board
      expect(a1).not.toEqual(b); // new day -> new board
    });
  });

  describe('scoreWord()', () => {
    it('rewards longer words over short rare-letter words (KÅRET beats FØD)', () => {
      // The reported bug: FØD (10 from rare letters) used to beat KÅRET (9).
      expect(scoreWord('KÅRET').total).toBeGreaterThan(scoreWord('FØD').total);
    });

    it('adds an escalating length bonus', () => {
      expect(lengthBonus(3)).toBe(0);
      expect(lengthBonus(5)).toBeGreaterThan(lengthBonus(4));
      expect(lengthBonus(8)).toBe(LONG_WORD_BONUS);
      expect(lengthBonus(12)).toBe(LONG_WORD_BONUS);
    });

    it('adds a bonus for each æ/ø/å but not for plain letters', () => {
      expect(specialBonus('SKAL')).toBe(0);
      expect(specialBonus('SKÅL')).toBe(SPECIAL_CHAR_BONUS);
      expect(specialBonus('ÆØÅ')).toBe(3 * SPECIAL_CHAR_BONUS);
    });

    it('total equals letters + length + special + hidden', () => {
      const s = scoreWord('KÅRET');
      expect(s.total).toBe(s.letters + s.length + s.special + s.hidden);
    });
  });

  describe('BONUS_WORDS Integration', () => {
    it('contains a valid list of strings from the JSON file', () => {
      expect(Array.isArray(BONUS_WORDS)).toBe(true);
      expect(BONUS_WORDS.length).toBeGreaterThan(0);
      expect(typeof BONUS_WORDS[0]).toBe('string');
    });

    it('awards the hidden-word bonus for exact bonus words (long or short)', () => {
      const longBonusWord = BONUS_WORDS.find(w => w.length >= 8) || "ABSOLUTT";
      const shortBonusWord = BONUS_WORDS.find(w => w.length < 8) || "HELSE";
      // calculateBonus is now ONLY the hidden-word bonus; length is handled by lengthBonus.
      expect(calculateBonus(longBonusWord)).toBe(10);
      expect(calculateBonus(shortBonusWord)).toBe(10);
    });

    it('awards the hidden-word bonus for inflected forms (root match)', () => {
      const root = BONUS_WORDS.find(w => w.length >= 5) || BONUS_WORDS[0];
      const inflected = root + "E";
      expect(BONUS_WORDS).toContain(root);
      expect(calculateBonus(inflected)).toBe(10);
    });

    it('gives no hidden-word bonus for words not in the list', () => {
      expect(calculateBonus('LANGTORD')).toBe(0);
    });

    it('a longer word always scores higher than its shorter prefix', () => {
      // "NATURLIGE" should beat "NATURLIG" thanks to the extra letter + length curve.
      expect(scoreWord('NATURLIGE').total).toBeGreaterThan(scoreWord('NATURLIG').total);
    });
  });
});