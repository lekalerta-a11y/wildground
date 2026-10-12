import { AI, PLAYER, WORLD } from '../../core/constants';
import { dist, randRange, type Vec2 } from '../../core/math';
import type { Player } from '../../core/player';
import type { Match } from '../../core/simulation';
import { perceive } from '../../ai/perception';
import type { BotBrain, BotBrainDebugInfo } from '../types';
import type { RuleBasedPersonality } from './personalities';
import { PERSONALITIES } from './personalities';

export type RuleBasedState = 'EXPANDING' | 'RETURNING' | 'ATTACKING' | 'AVOIDING';

/**
 * Modular, non-ML controller for a single bot. Keeps its own small
 * state machine and steering plan, decoupled from core simulation and
 * rendering -- only `player.desiredHeading` is written back to the
 * simulation. Personality presets (src/brains/rule-based/personalities.ts)
 * tune the same logic into distinguishable behaviors.
 */
export class RuleBasedBrain implements BotBrain {
  readonly brainId: string;

  private readonly player: Player;
  private readonly personality: RuleBasedPersonality;
  private state: RuleBasedState = 'EXPANDING';
  private homeAnchor: Vec2;
  private waypoints: Vec2[] = [];
  private waypointIndex = 0;
  private timeSinceDecision = 0;
  private timeSinceSteer = 0;
  private replanCooldown = 0;
  private debug: BotBrainDebugInfo;

  constructor(player: Player, personality: RuleBasedPersonality = PERSONALITIES.balanced) {
    this.player = player;
    this.personality = personality;
    this.brainId = personality.id;
    this.homeAnchor = { ...player.position };
    this.debug = {
      state: this.state,
      distanceFromHome: 0,
      nearestEnemyName: null,
      nearestEnemyDistance: null,
      threatLevel: 'none',
      currentIntent: 'Booting up',
    };
  }

  getDebugInfo(): BotBrainDebugInfo {
    return this.debug;
  }

  update(dt: number, match: Match) {
    if (!this.player.alive) return;

    this.timeSinceDecision += dt * 1000;
    this.timeSinceSteer += dt * 1000;
    this.replanCooldown = Math.max(0, this.replanCooldown - dt * 1000);

    // Keep the home anchor fresh while standing on owned soil so RETURNING
    // always has a valid, reachable target.
    if (!this.player.outsideTerritory) {
      this.homeAnchor = { ...this.player.position };
    }

    if (this.timeSinceDecision >= AI.DECISION_INTERVAL_MS) {
      this.timeSinceDecision = 0;
      this.decide(match);
    }
    if (this.timeSinceSteer >= AI.STEERING_INTERVAL_MS) {
      this.timeSinceSteer = 0;
      this.steer();
    }
  }

  private decide(match: Match) {
    const p = perceive(this.player, match);
    const excursion = dist(this.player.position, this.homeAnchor);
    const maxExcursion = AI.MAX_EXCURSION_DISTANCE * this.personality.excursionMult;
    const threatRadius = AI.THREAT_RADIUS * this.personality.threatRadiusMult;

    this.debug.distanceFromHome = excursion;
    this.debug.nearestEnemyName = p.nearestEnemy?.player.name ?? null;
    this.debug.nearestEnemyDistance = p.nearestEnemy?.distance ?? null;

    // --- Threat assessment -------------------------------------------------
    const threatDist = p.selfTrailThreatDistance;
    let threatLevel: NonNullable<BotBrainDebugInfo['threatLevel']> = 'none';
    if (threatDist !== null) {
      if (threatDist <= threatRadius * 0.5) threatLevel = 'high';
      else if (threatDist <= threatRadius) threatLevel = 'low';
    }
    this.debug.threatLevel = threatLevel;

    // 1. SURVIVAL: high threat to our own exposed trail takes priority.
    if (this.player.outsideTerritory && threatLevel === 'high') {
      const distHome = dist(this.player.position, this.homeAnchor);
      if (distHome < AI.AWARENESS_RADIUS * 0.8) {
        this.setState('RETURNING', [this.homeAnchor], 'Trail threatened - heading home');
      } else {
        const enemy = p.nearestEnemy!.player;
        const away = escapeHeading(this.player.position, enemy.position);
        const dodge = {
          x: this.player.position.x + Math.cos(away) * 260,
          y: this.player.position.y + Math.sin(away) * 260,
        };
        this.setState('AVOIDING', [dodge, this.homeAnchor], 'Evading nearby threat');
      }
      this.applyMistakeNoise();
      return;
    }

    // 2. Excursion safety valve: don't wander forever.
    if (this.player.outsideTerritory && excursion > maxExcursion) {
      this.setState('RETURNING', [this.homeAnchor], 'Excursion too far - returning');
      this.applyMistakeNoise();
      return;
    }

    // 3. OPPORTUNISTIC ATTACK: a reachable, worthwhile enemy trail nearby.
    const attackRange = AI.AWARENESS_RADIUS * 0.6 * this.personality.attackRangeMult;
    if (p.bestAttackTarget && p.bestAttackTarget.distance < attackRange) {
      const safeToAttack =
        excursion < maxExcursion * this.personality.attackSafetyExcursionFraction ||
        !this.player.outsideTerritory;
      if (safeToAttack) {
        this.setState(
          'ATTACKING',
          [p.bestAttackTarget.point, this.homeAnchor],
          `Cutting ${p.bestAttackTarget.enemy.name}'s trail`
        );
        this.applyMistakeNoise();
        return;
      }
    }

    // 4. CONTINUE EXPANDING (default): plan a fresh loop if we don't have one.
    if (this.state !== 'EXPANDING' || this.waypoints.length === 0 || this.replanCooldown <= 0) {
      if (!this.player.outsideTerritory) {
        this.planExpansionLoop(maxExcursion);
      } else if (this.waypoints.length === 0) {
        this.setState('RETURNING', [this.homeAnchor], 'Re-planning: returning to close territory');
      }
    }

    this.applyMistakeNoise();
  }

  private planExpansionLoop(maxExcursion: number) {
    const angle = randRange(0, Math.PI * 2);
    const safeMaxDistance = Math.max(
      120,
      Math.min(maxExcursion * 0.75, WORLD.RADIUS - dist(this.homeAnchor, { x: 0, y: 0 }) - 150)
    );
    const excursionDistance = randRange(safeMaxDistance * 0.45, safeMaxDistance);
    const sweep = randRange(0.6, 1.6) * (Math.random() < 0.5 ? -1 : 1);

    const out1 = polarOffset(this.homeAnchor, angle, excursionDistance * 0.55);
    const out2 = polarOffset(this.homeAnchor, angle + sweep * 0.5, excursionDistance);
    const out3 = polarOffset(this.homeAnchor, angle + sweep, excursionDistance * 0.6);

    this.setState('EXPANDING', [out1, out2, out3, this.homeAnchor], 'Expanding territory');
    this.replanCooldown = AI.DECISION_INTERVAL_MS * 6;
  }

  private setState(state: RuleBasedState, waypoints: Vec2[], intent: string) {
    this.state = state;
    this.waypoints = waypoints;
    this.waypointIndex = 0;
    this.debug.state = state;
    this.debug.currentIntent = intent;
  }

  private applyMistakeNoise() {
    const chance = AI.MISTAKE_CHANCE * this.personality.mistakeChanceMult;
    if (Math.random() < chance) {
      const noise = randRange(-AI.MISTAKE_HEADING_NOISE, AI.MISTAKE_HEADING_NOISE);
      this.player.desiredHeading += noise;
    }
  }

  private steer() {
    if (this.waypoints.length === 0) return;
    const target = this.waypoints[this.waypointIndex];
    const d = dist(this.player.position, target);
    const arriveRadius = this.state === 'RETURNING' ? PLAYER.STARTING_TERRITORY_RADIUS * 0.6 : 70;

    if (d < arriveRadius && this.waypointIndex < this.waypoints.length - 1) {
      this.waypointIndex += 1;
    }

    const finalTarget = this.waypoints[this.waypointIndex];
    this.player.desiredHeading = Math.atan2(
      finalTarget.y - this.player.position.y,
      finalTarget.x - this.player.position.x
    );
  }
}

function polarOffset(origin: Vec2, angle: number, distance: number): Vec2 {
  const p = { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance };
  const r = dist(p, { x: 0, y: 0 });
  const maxR = WORLD.RADIUS - 200;
  if (r > maxR) {
    const scale = maxR / r;
    return { x: p.x * scale, y: p.y * scale };
  }
  return p;
}

function escapeHeading(self: Vec2, threat: Vec2): number {
  return Math.atan2(self.y - threat.y, self.x - threat.x);
}
