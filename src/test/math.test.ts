import { describe, expect, it } from 'vitest';
import { normalizeAngle, pointToSegmentDistance, turnToward } from '../core/math';

describe('turnToward (smooth steering / no instant reversal)', () => {
  it('moves heading toward target but not past the max delta', () => {
    const result = turnToward(0, Math.PI / 2, 0.1);
    expect(result).toBeCloseTo(0.1, 5);
  });

  it('reaches the target exactly once within maxDelta', () => {
    const result = turnToward(0, 0.05, 0.1);
    expect(result).toBeCloseTo(0.05, 5);
  });

  it('cannot instantly reverse 180 degrees in one step', () => {
    const maxDelta = 0.1;
    const result = turnToward(0, Math.PI, maxDelta);
    // Should only have turned by maxDelta, never straight to PI.
    expect(Math.abs(normalizeAngle(result))).toBeCloseTo(maxDelta, 5);
    expect(Math.abs(normalizeAngle(result))).not.toBeCloseTo(Math.PI, 1);
  });

  it('takes the shortest rotational path', () => {
    // From near +PI turning toward -PI + 0.05 should go "forward" (short way).
    const result = turnToward(Math.PI - 0.02, -Math.PI + 0.05, 0.2);
    // Expect it wrapped past PI rather than swinging the long way to 0.
    expect(Math.abs(normalizeAngle(result - Math.PI))).toBeLessThan(0.2);
  });
});

describe('pointToSegmentDistance', () => {
  it('returns 0 for a point exactly on the segment', () => {
    const { distance } = pointToSegmentDistance({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(distance).toBeCloseTo(0, 5);
  });

  it('returns perpendicular distance for a point off the segment', () => {
    const { distance } = pointToSegmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(distance).toBeCloseTo(3, 5);
  });

  it('clamps to the nearest endpoint beyond the segment', () => {
    const { distance, closest } = pointToSegmentDistance(
      { x: 20, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    );
    expect(distance).toBeCloseTo(10, 5);
    expect(closest.x).toBeCloseTo(10, 5);
  });
});
