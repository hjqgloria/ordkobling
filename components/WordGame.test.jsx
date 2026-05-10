import { describe, it, expect } from 'vitest';
import { wordScore, adj, genGrid, calculateBonus } from './WordGame';
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
  });

  describe('BONUS_WORDS Integration', () => {
    it('contains a valid list of strings from the JSON file', () => {
      expect(Array.isArray(BONUS_WORDS)).toBe(true);
      expect(BONUS_WORDS.length).toBeGreaterThan(0);
      expect(typeof BONUS_WORDS[0]).toBe('string');
    });

    it('calculates the +10 hidden word bonus correctly', () => {
      const hiddenWord = BONUS_WORDS[0];
      // Should return 10 (hidden bonus) + 5 (if length >= 8)
      const expectedBonus = hiddenWord.length >= 8 ? 15 : 10;
      expect(calculateBonus(hiddenWord)).toBe(expectedBonus);
    });

    it('awards a +5 bonus for long words not in the hidden list', () => {
      const longWord = 'LANGTORD'; // 8 characters
      expect(calculateBonus(longWord)).toBe(5);
    });
  });
});