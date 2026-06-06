import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GameStatus from './GameStatus';

// Renders the game-over screen with sane defaults; override per test.
function renderOver(overrides = {}) {
  const props = {
    phase: 'over',
    score: 328,
    highScore: 393,
    playerName: '',
    dailyLeaderboard: [],
    allTimeLeaderboard: [],
    submitted: false,
    isNewRecord: false,
    found: [],
    setPlayerName: () => {},
    submitToLeaderboard: vi.fn(),
    startGame: () => {},
    ...overrides,
  };
  return render(<GameStatus {...props} />);
}

describe('GameStatus — submit gating on game over', () => {
  it('does NOT show the submit form when the score is not a new daily record', () => {
    // Regression: a 328 score below the 393 REKORD must not prompt submission.
    renderOver({ score: 328, highScore: 393, isNewRecord: false });
    expect(screen.queryByPlaceholderText('Ditt navn')).toBeNull();
  });

  it('shows the submit form when the player set a new daily record', () => {
    renderOver({ score: 400, highScore: 393, isNewRecord: true });
    expect(screen.queryByPlaceholderText('Ditt navn')).not.toBeNull();
  });

  it('hides the submit form again after the score has been submitted', () => {
    renderOver({ isNewRecord: true, submitted: true });
    expect(screen.queryByPlaceholderText('Ditt navn')).toBeNull();
    expect(screen.getByText(/Sendt inn/i)).toBeTruthy();
  });
});
