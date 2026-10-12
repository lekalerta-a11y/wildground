import { describe, expect, it } from 'vitest';
import { PLAYER } from '../core/constants';
import { Player } from '../core/player';
import { Match } from '../core/simulation';
import { TerritoryGrid } from '../core/territoryGrid';

function makePlayer(id: number, spawn: { x: number; y: number }): Player {
  return new Player({ id, name: `P${id}`, color: '#fff', kind: 'human', spawn });
}

describe('enemy trail collision', () => {
  it('kills the trail owner when an enemy head crosses the exposed trail, not the attacker', () => {
    const grid = new TerritoryGrid(20);
    const a = makePlayer(1, { x: -500, y: 0 });
    const b = makePlayer(2, { x: 500, y: 0 });
    grid.stampCircle(a.position, PLAYER.STARTING_TERRITORY_RADIUS, 1);
    grid.stampCircle(b.position, PLAYER.STARTING_TERRITORY_RADIUS, 2);

    // Manually give player A an exposed trail crossing through the origin.
    a.outsideTerritory = true;
    a.trail = [
      { x: -50, y: 0 },
      { x: 50, y: 0 },
    ];
    a.position = { x: 200, y: 0 };

    // Player B walks straight through the origin, crossing A's trail.
    b.position = { x: -10, y: 0 };
    b.desiredHeading = 0;

    const match = new Match([a, b], grid);
    let aDied = false;
    for (let i = 0; i < 30 && !aDied; i++) {
      const result = match.step(1 / 60);
      if (result.events.some((e) => e.type === 'elimination' && e.playerId === 1)) aDied = true;
    }

    expect(aDied).toBe(true);
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(true); // attacker survives
  });
});

describe('player body collision', () => {
  it('pushes two overlapping players apart without killing either', () => {
    const grid = new TerritoryGrid(20);
    const a = makePlayer(1, { x: -5, y: 0 });
    const b = makePlayer(2, { x: 5, y: 0 });
    grid.stampCircle(a.position, PLAYER.STARTING_TERRITORY_RADIUS, 1);
    grid.stampCircle(b.position, PLAYER.STARTING_TERRITORY_RADIUS, 2);
    a.desiredHeading = 0;
    b.desiredHeading = Math.PI;

    const match = new Match([a, b], grid);
    match.step(1 / 60);

    expect(a.alive).toBe(true);
    expect(b.alive).toBe(true);
    const d = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
    expect(d).toBeGreaterThanOrEqual(PLAYER.COLLISION_RADIUS * 2 - 1e-6);
  });
});

describe('capture + player position interaction', () => {
  it('eliminates an enemy physically inside the newly captured region', () => {
    const grid = new TerritoryGrid(20);
    const capturer = makePlayer(1, { x: -400, y: 0 });
    const victim = makePlayer(2, { x: 0, y: 150 }); // sits inside the loop about to close
    grid.stampCircle(capturer.position, PLAYER.STARTING_TERRITORY_RADIUS, 1);

    const match = new Match([capturer, victim], grid);

    // Drive the capturer through Match.step so the real elimination path
    // (updateTerritoryState -> captureFromTrail -> handleCaptureEliminations)
    // fires, rather than calling the grid directly.
    capturer.outsideTerritory = true;
    capturer.trail = [
      { x: -350, y: 0 }, // start attached to home territory so the loop actually closes
      { x: -300, y: -250 },
      { x: 250, y: -250 },
      { x: 250, y: 250 },
      { x: -300, y: 250 },
    ];
    capturer.position = { x: -350, y: 0 }; // back inside own territory
    capturer.desiredHeading = capturer.heading;

    const result = match.step(1 / 60);
    const captureEvent = result.events.find((e) => e.type === 'capture');
    const elimEvent = result.events.find((e) => e.type === 'elimination' && e.playerId === 2);

    expect(captureEvent).toBeDefined();
    expect(elimEvent).toBeDefined();
    expect(victim.alive).toBe(false);
  });

  it('does NOT eliminate a player outside the captured region', () => {
    const grid = new TerritoryGrid(20);
    grid.stampCircle({ x: -400, y: 0 }, 100, 1);
    const trail = [
      { x: -300, y: -100 },
      { x: -200, y: -100 },
      { x: -200, y: 100 },
      { x: -300, y: 100 },
    ];
    const result = grid.captureFromTrail(1, trail);
    expect(result.changedCells.length).toBeGreaterThan(0);
    // A point far outside the captured loop remains neutral.
    expect(grid.ownerAt({ x: 2000, y: 2000 })).toBe(0);
  });

  it('survives when a player is outside the region being captured (Match-level)', () => {
    const grid = new TerritoryGrid(20);
    const capturer = makePlayer(1, { x: -400, y: 0 });
    const bystander = makePlayer(2, { x: 3000, y: -3000 }); // nowhere near the loop
    grid.stampCircle(capturer.position, PLAYER.STARTING_TERRITORY_RADIUS, 1);

    const match = new Match([capturer, bystander], grid);
    capturer.outsideTerritory = true;
    capturer.trail = [
      { x: -350, y: 0 },
      { x: -300, y: -250 },
      { x: 250, y: -250 },
      { x: 250, y: 250 },
      { x: -300, y: 250 },
    ];
    capturer.position = { x: -350, y: 0 };
    capturer.desiredHeading = capturer.heading;

    match.step(1 / 60);
    expect(bystander.alive).toBe(true);
  });
});

describe('win conditions', () => {
  it('declares a winner when only one player remains alive', () => {
    const grid = new TerritoryGrid(20);
    const a = makePlayer(1, { x: -500, y: 0 });
    const b = makePlayer(2, { x: 500, y: 0 });
    grid.stampCircle(a.position, PLAYER.STARTING_TERRITORY_RADIUS, 1);
    grid.stampCircle(b.position, PLAYER.STARTING_TERRITORY_RADIUS, 2);
    const match = new Match([a, b], grid);

    b.alive = false;
    b.territoryFraction = 0;
    const result = match.step(1 / 60);

    expect(result.matchOver).toBe(true);
    expect(result.winnerId).toBe(1);
    expect(match.isOver()).toBe(true);
  });

  it('declares a winner at ~100% world ownership', () => {
    const grid = new TerritoryGrid(20);
    const a = makePlayer(1, { x: 0, y: 0 });
    const b = makePlayer(2, { x: 3000, y: 3000 }); // effectively irrelevant/off-map
    b.alive = false;
    grid.stampCircle({ x: 0, y: 0 }, 100000, 1); // massively overshoots -> fills entire world
    const match = new Match([a, b], grid);

    const result = match.step(1 / 60);
    expect(result.matchOver).toBe(true);
    expect(result.winnerId).toBe(1);
  });
});
