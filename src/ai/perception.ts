import { AI, WORLD } from '../core/constants';
import { dist, pointToSegmentDistance, type Vec2 } from '../core/math';
import type { Player } from '../core/player';
import type { Match } from '../core/simulation';

export interface EnemySighting {
  player: Player;
  distance: number;
  hasExposedTrail: boolean;
}

export interface Perception {
  self: Player;
  distanceToBoundary: number;
  nearbyEnemies: EnemySighting[];
  nearestEnemy: EnemySighting | null;
  /** Distance from self to the closest point on the closest threatening enemy's trail (attack targets). */
  bestAttackTarget: { enemy: Player; point: Vec2; distance: number } | null;
  /** True if an enemy head is close enough to the bot's own exposed trail to be a real threat. */
  selfTrailThreatDistance: number | null;
}

/**
 * Build a bounded, "human observable" snapshot of the world around `self`.
 * Bots only reason about entities within AI.AWARENESS_RADIUS -- no global
 * omniscience about the rest of the map.
 */
export function perceive(self: Player, match: Match): Perception {
  const distanceToBoundary = WORLD.RADIUS - dist(self.position, { x: 0, y: 0 });

  const nearbyEnemies: EnemySighting[] = [];
  for (const other of match.players) {
    if (other.id === self.id || !other.alive) continue;
    const d = dist(self.position, other.position);
    if (d <= AI.AWARENESS_RADIUS) {
      nearbyEnemies.push({ player: other, distance: d, hasExposedTrail: other.outsideTerritory });
    }
  }
  nearbyEnemies.sort((a, b) => a.distance - b.distance);
  const nearestEnemy = nearbyEnemies[0] ?? null;

  // Look for a good attack opportunity: an enemy with an exposed trail whose
  // closest trail point is within reach.
  let bestAttackTarget: Perception['bestAttackTarget'] = null;
  for (const sighting of nearbyEnemies) {
    if (!sighting.hasExposedTrail || sighting.player.trail.length < 2) continue;
    let closestOnTrail: { point: Vec2; distance: number } | null = null;
    for (let i = 0; i < sighting.player.trail.length - 1; i++) {
      const { distance, closest } = pointToSegmentDistance(
        self.position,
        sighting.player.trail[i],
        sighting.player.trail[i + 1]
      );
      if (!closestOnTrail || distance < closestOnTrail.distance) {
        closestOnTrail = { point: closest, distance };
      }
    }
    if (closestOnTrail && closestOnTrail.distance <= AI.AWARENESS_RADIUS) {
      if (!bestAttackTarget || closestOnTrail.distance < bestAttackTarget.distance) {
        bestAttackTarget = {
          enemy: sighting.player,
          point: closestOnTrail.point,
          distance: closestOnTrail.distance,
        };
      }
    }
  }

  // How close is the nearest enemy to *my* exposed trail (threat to me)?
  let selfTrailThreatDistance: number | null = null;
  if (self.outsideTerritory && self.trail.length >= 1) {
    for (const sighting of nearbyEnemies) {
      let minD = dist(sighting.player.position, self.position);
      for (let i = 0; i < self.trail.length - 1; i++) {
        const { distance } = pointToSegmentDistance(
          sighting.player.position,
          self.trail[i],
          self.trail[i + 1]
        );
        minD = Math.min(minD, distance);
      }
      if (selfTrailThreatDistance === null || minD < selfTrailThreatDistance) {
        selfTrailThreatDistance = minD;
      }
    }
  }

  return {
    self,
    distanceToBoundary,
    nearbyEnemies,
    nearestEnemy,
    bestAttackTarget,
    selfTrailThreatDistance,
  };
}
