import { WORLD, PLAYER, MATCH } from './constants';
import { dist, randRange, type Vec2 } from './math';

/**
 * Generate `count` spawn points that are:
 *  - away from the world boundary
 *  - away from each other (minimum separation)
 *  - randomized between matches
 */
export function generateSpawnPoints(count: number): Vec2[] {
  const startRadius = PLAYER.STARTING_TERRITORY_RADIUS;
  const margin = startRadius * MATCH.BOUNDARY_SPAWN_MARGIN_FACTOR;
  const maxSpawnRadius = Math.max(WORLD.RADIUS - margin, WORLD.RADIUS * 0.3);

  const points: Vec2[] = [];

  // Standard random spawn logic for normal gameplay
  const maxAttempts = 400;
  const minSeparation = startRadius * MATCH.MIN_SPAWN_SEPARATION_FACTOR;

  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
      const angle = randRange(0, Math.PI * 2);
      const radius = randRange(maxSpawnRadius * 0.15, maxSpawnRadius);
      const candidate = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };

      const farEnough = points.every((p) => dist(p, candidate) >= minSeparation);
      if (farEnough) {
        points.push(candidate);
        placed = true;
      }
    }

    if (!placed) {
      // Fallback
      const angle = (i / count) * Math.PI * 2;
      const radius = maxSpawnRadius * 0.6;
      points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }
  }

  return points;
}
