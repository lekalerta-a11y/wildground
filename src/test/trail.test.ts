import { describe, expect, it } from 'vitest';
import { PLAYER } from '../core/constants';
import { Player } from '../core/player';
import { Match } from '../core/simulation';
import { TerritoryGrid } from '../core/territoryGrid';

function makeSoloMatch() {
  const grid = new TerritoryGrid(20);
  const p = new Player({ id: 1, name: 'P1', color: '#fff', kind: 'human', spawn: { x: 0, y: 0 } });
  grid.stampCircle(p.position, PLAYER.STARTING_TERRITORY_RADIUS, 1);
  const match = new Match([p], grid);
  return { match, p };
}

describe('leaving territory creates a trail', () => {
  it('has no trail while inside own territory', () => {
    const { match, p } = makeSoloMatch();
    p.desiredHeading = 0;
    for (let i = 0; i < 5; i++) match.step(1 / 60);
    expect(p.outsideTerritory).toBe(false);
    expect(p.trail.length).toBe(0);
  });

  it('starts a trail once the player exits their territory', () => {
    const { match, p } = makeSoloMatch();
    p.desiredHeading = 0; // move along +x, out past the starting radius
    for (let i = 0; i < 400; i++) match.step(1 / 60);
    expect(p.outsideTerritory).toBe(true);
    expect(p.trail.length).toBeGreaterThan(0);
  });
});

describe('own trail is harmless', () => {
  it('does not eliminate a player whose head crosses its own trail', () => {
    const { match, p } = makeSoloMatch();
    // Send the player out, then loop it back across its own trail without
    // reconnecting to territory (small loop-the-loop), verifying it stays alive.
    const headings = [0, 0, 0, Math.PI / 2, Math.PI / 2, Math.PI, Math.PI, -Math.PI / 2, -Math.PI / 2];
    for (const h of headings) {
      p.desiredHeading = h;
      for (let i = 0; i < 40; i++) match.step(1 / 60);
    }
    expect(p.alive).toBe(true);
  });
});
