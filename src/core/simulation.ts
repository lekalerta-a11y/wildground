import { WORLD, PLAYER, TERRITORY } from './constants';
import { dist, pointToSegmentDistance, turnToward, type Vec2 } from './math';
import { Player } from './player';
import { NEUTRAL, TerritoryGrid } from './territoryGrid';

export type MatchEventType =
  | { type: 'capture'; playerId: number; fraction: number; changedCells: number }
  | { type: 'elimination'; playerId: number; killerId: number | null; reason: 'trail' | 'capture' }
  | { type: 'win'; playerId: number | null; reason: '100percent' | 'lastAlive' };

export interface StepResult {
  events: MatchEventType[];
  matchOver: boolean;
  winnerId: number | null;
}

/**
 * Owns and advances the authoritative game simulation for one match.
 * Does not know about rendering, camera, input devices, or AI decision
 * logic -- callers simply set `player.desiredHeading` before calling step().
 */
export class Match {
  readonly grid: TerritoryGrid;
  readonly players: Player[];
  private over = false;
  private winnerId: number | null = null;

  constructor(players: Player[], grid?: TerritoryGrid) {
    this.players = players;
    this.grid = grid ?? new TerritoryGrid();
  }

  isOver(): boolean {
    return this.over;
  }

  getWinnerId(): number | null {
    return this.winnerId;
  }

  /** Advance the simulation by `dt` seconds (already scaled by simulation speed). */
  step(dt: number): StepResult {
    const events: MatchEventType[] = [];
    if (this.over) return { events, matchOver: true, winnerId: this.winnerId };

    this.updateMovement(dt);
    this.updateTerritoryState(events);
    this.updateTrailCollisions(events);
    this.updateBodyCollisions();
    this.updateTerritoryFractions();
    this.checkWinConditions(events);

    return { events, matchOver: this.over, winnerId: this.winnerId };
  }

  private updateMovement(dt: number) {
    const maxDelta = PLAYER.TURN_RATE * dt;
    for (const p of this.players) {
      if (!p.alive) continue;
      p.heading = turnToward(p.heading, p.desiredHeading, maxDelta);
      const nx = p.position.x + Math.cos(p.heading) * PLAYER.SPEED * dt;
      const ny = p.position.y + Math.sin(p.heading) * PLAYER.SPEED * dt;
      p.position = clampToWorld({ x: nx, y: ny });
    }
  }

  private updateTerritoryState(events: MatchEventType[]) {
    for (const p of this.players) {
      if (!p.alive) continue;
      const insideOwn = this.grid.isOwnedBy(p.position, p.id);

      if (insideOwn) {
        if (p.outsideTerritory) {
          // Returned home -- attempt to close the loop and capture.
          const trail = [...p.trail, p.position];
          const result = this.grid.captureFromTrail(p.id, trail);
          p.outsideTerritory = false;
          p.trail = [];
          if (result.changedCells.length > 0) {
            events.push({
              type: 'capture',
              playerId: p.id,
              fraction: result.capturedFraction,
              changedCells: result.changedCells.length,
            });
            this.handleCaptureEliminations(p.id, result.changedCells, events);
          }
        }
        // else: was already home, nothing to do.
      } else {
        if (!p.outsideTerritory) {
          p.outsideTerritory = true;
          p.trail = [{ ...p.position }];
        } else {
          const last = p.trail[p.trail.length - 1];
          if (!last || dist(last, p.position) >= PLAYER.TRAIL_SAMPLE_SPACING) {
            p.trail.push({ ...p.position });
          }
        }
      }
    }
  }

  private handleCaptureEliminations(
    capturerId: number,
    changedCells: Array<{ col: number; row: number; from: number }>,
    events: MatchEventType[]
  ) {
    if (changedCells.length === 0) return;
    const cellSet = new Set(changedCells.map((c) => `${c.col},${c.row}`));
    for (const other of this.players) {
      if (!other.alive || other.id === capturerId) continue;
      const { col, row } = this.grid.worldToCell(other.position);
      if (cellSet.has(`${col},${row}`)) {
        this.eliminate(other, capturerId, 'capture', events);
      }
    }
  }

  private updateTrailCollisions(events: MatchEventType[]) {
    const threshold = PLAYER.TRAIL_WIDTH + PLAYER.COLLISION_RADIUS;
    for (const attacker of this.players) {
      if (!attacker.alive) continue;
      for (const victim of this.players) {
        if (!victim.alive || victim.id === attacker.id) continue;
        if (!victim.outsideTerritory || victim.trail.length < 2) continue;
        for (let i = 0; i < victim.trail.length - 1; i++) {
          const { distance } = pointToSegmentDistance(
            attacker.position,
            victim.trail[i],
            victim.trail[i + 1]
          );
          if (distance <= threshold) {
            this.eliminate(victim, attacker.id, 'trail', events);
            break;
          }
        }
      }
    }
  }

  private updateBodyCollisions() {
    const minDist = PLAYER.COLLISION_RADIUS * 2;
    for (let i = 0; i < this.players.length; i++) {
      const a = this.players[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.players.length; j++) {
        const b = this.players[j];
        if (!b.alive) continue;
        const d = dist(a.position, b.position);
        if (d > 0 && d < minDist) {
          const overlap = minDist - d;
          const dx = (b.position.x - a.position.x) / d;
          const dy = (b.position.y - a.position.y) / d;
          a.position = { x: a.position.x - dx * overlap * 0.5, y: a.position.y - dy * overlap * 0.5 };
          b.position = { x: b.position.x + dx * overlap * 0.5, y: b.position.y + dy * overlap * 0.5 };
          a.position = clampToWorld(a.position);
          b.position = clampToWorld(b.position);
        }
      }
    }
  }

  private eliminate(
    player: Player,
    killerId: number | null,
    reason: 'trail' | 'capture',
    events: MatchEventType[]
  ) {
    if (!player.alive) return;
    player.alive = false;
    player.outsideTerritory = false;
    player.trail = [];
    this.grid.clearOwner(player.id);
    if (killerId !== null) {
      const killer = this.players.find((p) => p.id === killerId);
      if (killer) killer.kills += 1;
    }
    events.push({ type: 'elimination', playerId: player.id, killerId, reason });
  }

  private updateTerritoryFractions() {
    for (const p of this.players) {
      p.territoryFraction = p.alive ? this.grid.ownershipFraction(p.id) : 0;
    }
  }

  private checkWinConditions(events: MatchEventType[]) {
    if (this.over) return;
    const alive = this.players.filter((p) => p.alive);

    for (const p of alive) {
      if (p.territoryFraction >= 0.999) {
        this.over = true;
        this.winnerId = p.id;
        events.push({ type: 'win', playerId: p.id, reason: '100percent' });
        return;
      }
    }

    if (alive.length <= 1 && this.players.length > 1) {
      this.over = true;
      this.winnerId = alive.length === 1 ? alive[0].id : null;
      events.push({ type: 'win', playerId: this.winnerId, reason: 'lastAlive' });
    }
  }
}

/** Clamp a world-space point so it cannot leave the circular play area. */
export function clampToWorld(p: Vec2, margin: number = PLAYER.COLLISION_RADIUS): Vec2 {
  const maxR = WORLD.RADIUS - margin;
  const d = Math.hypot(p.x, p.y);
  if (d <= maxR || d === 0) return p;
  const scale = maxR / d;
  return { x: p.x * scale, y: p.y * scale };
}

export { NEUTRAL, TERRITORY };
