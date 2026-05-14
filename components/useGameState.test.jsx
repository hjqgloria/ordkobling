import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { useGameState } from './useGameState';

function HookContainer({ onReady }) {
  const state = useGameState();
  useEffect(() => {
    onReady(state);
  }, [state, onReady]);
  return null;
}

describe('useGameState hook', () => {
  beforeEach(() => {
    global.Audio = class {
      play() {
        return Promise.resolve();
      }
    };
  });

  it('clears the path when validation returns invalid', async () => {
    let currentState;
    const onReady = vi.fn((state) => {
      currentState = state;
    });

    render(<HookContainer onReady={onReady} />);

    await waitFor(() => expect(currentState).toBeDefined());

    currentState.setPath([0, 1, 2]);
    currentState.setPhase('play');

    await waitFor(() => expect(currentState.path).toEqual([0, 1, 2]));

    currentState.handleValidationResult('ABC', false);

    await waitFor(() => expect(currentState.path).toEqual([]));
  });

  it('slices the path when dragging back to a previously selected letter', async () => {
    let currentState;
    const onReady = vi.fn((state) => {
      currentState = state;
    });

    render(<HookContainer onReady={onReady} />);

    await waitFor(() => expect(currentState).toBeDefined());

    currentState.setPath([0, 1, 2]);
    currentState.setPhase('play');
    currentState.dragging.current = true;

    await waitFor(() => expect(currentState.path).toEqual([0, 1, 2]));

    currentState.onMove(0);

    await waitFor(() => expect(currentState.path).toEqual([0]));
  });
});
