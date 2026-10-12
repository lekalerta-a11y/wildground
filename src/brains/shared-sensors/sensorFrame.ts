import { WORLD, PLAYER } from '../../core/constants';
import { dist, type Vec2 } from '../../core/math';
import type { Player } from '../../core/player';
import type { Match } from '../../core/simulation';

// 1. What the ray can hit. 
// Using a const object instead of enum to comply with 'erasableSyntaxOnly'
export const SensorHitType = {
  EMPTY: 0,
  OWN_TERRITORY: 1,
  ENEMY_TERRITORY: 2,
  OWN_TRAIL: 3,
  ENEMY_TRAIL: 4,
  ENEMY_BODY: 5,
  BOUNDARY: 6
} as const;

// Extract the type so we can still use it as a type annotation
export type SensorHitType = typeof SensorHitType[keyof typeof SensorHitType];
// 2. The reading from a single ray
export interface RayReading {
  hitType: SensorHitType;
  distance: number; // Normalized between 0.0 (touching) and 1.0 (max range)
}

// 3. The full sensory snapshot
export interface SensorFrame {
  dt: number;
  position: Vec2;
  heading: number;
  headingSin: number;
  headingCos: number;
  outsideTerritory: boolean;
  territoryFraction: number;
  
  // THE NEW RAYCAST VISION
  rays: RayReading[];

  // ---- Legacy placeholders (kept so your current template brains don't break) ----
  distanceToBoundary: number;
  nearestEnemyDistance: number | null;
  nearestEnemyAngle: number | null; 
  nearestEnemyHasExposedTrail: boolean;
  nearestEnemyTrailDistance: number | null;
  nearestEnemyTrailAngle: number | null;
  aliveOpponentCount: number;
  kills: number;
}

export function buildSensorFrame(self: Player, match: Match, dt: number): SensorFrame {
  // Raycast Settings
  const NUM_RAYS = 36;
  const MAX_VISION_DISTANCE = 800; // Cap vision so bots aren't omniscient
  const STEP_SIZE = 16; // Fast enough to be performant, small enough not to skip trails
  const ANGLE_STEP = (2 * Math.PI) / NUM_RAYS;

  const rays: RayReading[] = [];

  for (let i = 0; i < NUM_RAYS; i++) {
    // Offset ray angle by the player's current heading so it's always relative to where they are looking
    const rayAngle = self.heading + (i * ANGLE_STEP);
    const dirX = Math.cos(rayAngle);
    const dirY = Math.sin(rayAngle);

    let currentDist = 0;
    let hitType: SensorHitType = SensorHitType.EMPTY;

    while (currentDist <= MAX_VISION_DISTANCE) {
      currentDist += STEP_SIZE;
      
      const checkX = self.position.x + (dirX * currentDist);
      const checkY = self.position.y + (dirY * currentDist);
      const checkPoint = { x: checkX, y: checkY };

      // A. Check World Boundary
      if (Math.hypot(checkX, checkY) >= WORLD.RADIUS) {
        hitType = SensorHitType.BOUNDARY;
        break;
      }

      // B. Check Enemy Bodies & Trails
      let hitEntity = false;
      for (const p of match.players) {
        if (!p.alive) continue;

        // Check if we hit an enemy body
        if (p.id !== self.id) {
          if (dist(checkPoint, p.position) <= PLAYER.COLLISION_RADIUS) {
            hitType = SensorHitType.ENEMY_BODY;
            hitEntity = true;
            break;
          }
        }

        // Check if we hit a trail (own or enemy)
        if (p.outsideTerritory && p.trail.length > 0) {
          // Because trails are dropped closely together, checking distance to the trail coordinates is highly accurate
          for (const tp of p.trail) {
            if (dist(checkPoint, tp) <= PLAYER.TRAIL_WIDTH) {
              hitType = p.id === self.id ? SensorHitType.OWN_TRAIL : SensorHitType.ENEMY_TRAIL;
              hitEntity = true;
              break;
            }
          }
        }
        if (hitEntity) break;
      }
      if (hitEntity) break; // Stop the ray

      // C. Check Territory Grid
      const owner = match.grid.ownerAt(checkPoint);
      if (owner !== 0 && owner !== self.id) {
        hitType = SensorHitType.ENEMY_TERRITORY;
        break; 
      }
    }

    rays.push({
      hitType,
      distance: Math.min(currentDist, MAX_VISION_DISTANCE) / MAX_VISION_DISTANCE
    });
  }

  // --- Legacy Perception calculations (Kept to prevent breaking template files) ---
  const distanceToBoundary = WORLD.RADIUS - dist(self.position, { x: 0, y: 0 });
  let nearestEnemyDistance: number | null = null;
  let nearestEnemyAngle: number | null = null;
  let nearestEnemyHasExposedTrail = false;
  let aliveOpponentCount = 0;

  for (const other of match.players) {
    if (other.id === self.id || !other.alive) continue;
    aliveOpponentCount += 1;
    const d = dist(self.position, other.position);
    if (nearestEnemyDistance === null || d < nearestEnemyDistance) {
      nearestEnemyDistance = d;
      nearestEnemyAngle = normalizeRelativeAngle(
        Math.atan2(other.position.y - self.position.y, other.position.x - self.position.x) - self.heading
      );
      nearestEnemyHasExposedTrail = other.outsideTerritory;
    }
  }

  let nearestEnemyTrailDistance: number | null = null;
  let nearestEnemyTrailAngle: number | null = null;
  for (const other of match.players) {
    if (other.id === self.id || !other.alive || !other.outsideTerritory) continue;
    for (const point of other.trail) {
      const d = dist(self.position, point);
      if (nearestEnemyTrailDistance === null || d < nearestEnemyTrailDistance) {
        nearestEnemyTrailDistance = d;
        nearestEnemyTrailAngle = normalizeRelativeAngle(
          Math.atan2(point.y - self.position.y, point.x - self.position.x) - self.heading
        );
      }
    }
  }

  return {
    dt,
    position: { ...self.position },
    heading: self.heading,
    headingSin: Math.sin(self.heading),
    headingCos: Math.cos(self.heading),
    outsideTerritory: self.outsideTerritory,
    territoryFraction: self.territoryFraction,
    rays,
    distanceToBoundary,
    nearestEnemyDistance,
    nearestEnemyAngle,
    nearestEnemyHasExposedTrail,
    nearestEnemyTrailDistance,
    nearestEnemyTrailAngle,
    aliveOpponentCount,
    kills: self.kills,
  };
}

function normalizeRelativeAngle(angle: number): number {
  let a = angle % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}