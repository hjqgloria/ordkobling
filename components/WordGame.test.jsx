import { describe, it, expect } from 'vitest';
import { wordScore, adj, genGrid, calculateBonus } from './gameLogic';
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

    it('calculates the +10 bonus for exact bonus words, plus +5 if long', () => {
      // Find a bonus word that is >= 8 chars for full bonus test
      const longBonusWord = BONUS_WORDS.find(w => w.length >= 8) || "ABSOLUTT"; // Fallback if none found
      expect(calculateBonus(longBonusWord)).toBe(15); // 10 (exact) + 5 (long)

      // Find a bonus word that is < 8 chars for basic bonus test
      const shortBonusWord = BONUS_WORDS.find(w => w.length < 8) || "HELSE"; // Fallback
      expect(calculateBonus(shortBonusWord)).toBe(10); // 10 (exact)
    });

    it('awards a +10 bonus for inflected forms of bonus words (root match)', () => {
      // Assuming "PLANLAGT" is in BONUS_WORDS and "PLANLAGTE" is an inflected form
      const bonusWordRoot = "PLANLAGT";
      const inflectedWord = "PLANLAGTE"; // Not an exact match, but a root match

      expect(BONUS_WORDS).toContain(bonusWordRoot); // Ensure the root word is in the list
      expect(BONUS_WORDS).not.toContain(inflectedWord.toUpperCase()); // Ensure it's not an exact match
      expect(calculateBonus(inflectedWord)).toBe(15); // 10 (root match) + 5 (length >= 8)
    });

    it('validates total points for "naturlig" vs "naturlige"', () => {
      // "NATURLIG" (8 chars): N(1)+A(1)+T(1)+U(3)+R(1)+L(1)+I(1)+G(3) = 12
      // Bonus: 10 (root) + 5 (len >= 8) = 15. Total = 27.
      const word1 = "NATURLIG";
      const totalScore1 = wordScore(word1) + calculateBonus(word1);
      
      // "NATURLIGE" (9 chars): Previous 12 + E(1) = 13
      // Bonus: 10 (root) + 5 (len >= 8) = 15. Total = 28.
      const word2 = "NATURLIGE";
      const totalScore2 = wordScore(word2) + calculateBonus(word2);

      expect(totalScore1).toBe(27);
      expect(totalScore2).toBe(28);
      expect(totalScore2).toBeGreaterThan(totalScore1);
    });

    it('awards a +5 bonus for long words not in the hidden list', () => {
      const longWord = 'LANGTORD'; // 8 characters
      expect(calculateBonus(longWord)).toBe(5);
    });
  });
});