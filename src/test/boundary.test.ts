import { describe, expect, it } from 'vitest';
import { WORLD } from '../core/constants';
import { clampToWorld } from '../core/simulation';

describe('world boundary constraint', () => {
  it('leaves points inside the circle untouched', () => {
    const p = { x: 100, y: 50 };
    const result = clampToWorld(p, 0);
    expect(result).toEqual(p);
  });

  it('clamps points outside the circle back onto the boundary', () => {
    const p = { x: WORLD.RADIUS * 2, y: 0 };
    const result = clampToWorld(p, 0);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(WORLD.RADIUS, 5);
  });

  it('respects an inward margin (player collision radius)', () => {
    const p = { x: WORLD.RADIUS * 2, y: 0 };
    const result = clampToWorld(p, 20);
    expect(Math.hypot(result.x, result.y)).toBeCloseTo(WORLD.RADIUS - 20, 5);
  });

  it('never allows a point to leave the world regardless of direction', () => {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.7) {
      const p = { x: Math.cos(angle) * WORLD.RADIUS * 5, y: Math.sin(angle) * WORLD.RADIUS * 5 };
      const result = clampToWorld(p, 0);
      expect(Math.hypot(result.x, result.y)).toBeLessThanOrEqual(WORLD.RADIUS + 1e-6);
    }
  });
});
