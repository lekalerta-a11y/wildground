import { describe, expect, it } from 'vitest';
import { TerritoryGrid } from '../core/territoryGrid';

describe('TerritoryGrid capture', () => {
  it('stamps a starting circular territory for a player', () => {
    const grid = new TerritoryGrid(40);
    grid.stampCircle({ x: 0, y: 0 }, 300, 1);
    expect(grid.ownerAt({ x: 0, y: 0 })).toBe(1);
    expect(grid.ownershipFraction(1)).toBeGreaterThan(0);
  });

  it('captures an enclosed loop and assigns it to the capturing player', () => {
    const grid = new TerritoryGrid(20);
    grid.stampCircle({ x: 0, y: 0 }, 100, 1);

    // Walk a square loop out from the territory edge and back, enclosing
    // a chunk of neutral territory.
    const trail = [
      { x: 100, y: 0 },
      { x: 250, y: 0 },
      { x: 250, y: 250 },
      { x: -250, y: 250 },
      { x: -250, y: 0 },
      { x: -100, y: 0 },
    ];
    const result = grid.captureFromTrail(1, trail);
    expect(result.changedCells.length).toBeGreaterThan(0);
    expect(result.capturedFraction).toBeGreaterThan(0);
    // A point well inside the enclosed loop should now belong to player 1.
    expect(grid.ownerAt({ x: 0, y: 150 })).toBe(1);
  });

  it('ignores captures below the minimum threshold', () => {
    const grid = new TerritoryGrid(20);
    grid.stampCircle({ x: 0, y: 0 }, 100, 1);

    // Tiny loop, far smaller than the minimum capture percentage.
    const trail = [
      { x: 100, y: 0 },
      { x: 105, y: 0 },
      { x: 105, y: 5 },
      { x: 100, y: 5 },
    ];
    const before = grid.ownershipFraction(1);
    const result = grid.captureFromTrail(1, trail);
    const after = grid.ownershipFraction(1);
    expect(result.changedCells.length).toBe(0);
    expect(after).toBeCloseTo(before, 5);
  });

  it('transfers ownership from an enemy when their territory is enclosed', () => {
    const grid = new TerritoryGrid(20);
    grid.stampCircle({ x: -400, y: 0 }, 100, 1); // player 1 territory (far away)
    grid.stampCircle({ x: 0, y: 0 }, 100, 2); // player 2 territory, to be captured

    // Player 1 draws a loop that starts and ends inside their own territory
    // (so the wall is fully closed) and encloses all of player 2's territory.
    const trail = [
      { x: -400, y: 0 },
      { x: -400, y: -300 },
      { x: 300, y: -300 },
      { x: 300, y: 300 },
      { x: -400, y: 300 },
      { x: -400, y: 0 },
    ];
    const before2 = grid.ownershipFraction(2);
    const result = grid.captureFromTrail(1, trail);
    const after2 = grid.ownershipFraction(2);

    expect(result.changedCells.length).toBeGreaterThan(0);
    expect(after2).toBeLessThan(before2);
    expect(grid.ownerAt({ x: 0, y: 0 })).toBe(1);
  });

  it('total ownership fractions never exceed 1', () => {
    const grid = new TerritoryGrid(20);
    grid.stampCircle({ x: -500, y: 0 }, 150, 1);
    grid.stampCircle({ x: 500, y: 0 }, 150, 2);
    const total = grid.ownershipFraction(1) + grid.ownershipFraction(2);
    expect(total).toBeLessThanOrEqual(1.0001);
  });
});
