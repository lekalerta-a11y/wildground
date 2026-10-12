import type { Vec2 } from './math';

export type PlayerKind = 'human' | 'bot';

export interface PlayerConfig {
  id: number; // 1-based; 0 is reserved for NEUTRAL territory
  name: string;
  color: string;
  kind: PlayerKind;
  spawn: Vec2;
  headEmoji?: string | null;
}

export class Player {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly kind: PlayerKind;
  readonly headEmoji: string | null;

  position: Vec2;
  heading: number; // radians
  desiredHeading: number; // radians, steering target

  alive: boolean = true;
  outsideTerritory: boolean = false;
  trail: Vec2[] = [];
  kills: number = 0;
  territoryFraction: number = 0;

  constructor(cfg: PlayerConfig) {
    this.id = cfg.id;
    this.name = cfg.name;
    this.color = cfg.color;
    this.kind = cfg.kind;
    this.headEmoji = cfg.headEmoji ?? null;
    this.position = { ...cfg.spawn };
    this.heading = Math.random() * Math.PI * 2;
    this.desiredHeading = this.heading;
  }

  reset(spawn: Vec2) {
    this.position = { ...spawn };
    this.heading = Math.random() * Math.PI * 2;
    this.desiredHeading = this.heading;
    this.alive = true;
    this.outsideTerritory = false;
    this.trail = [];
    this.kills = 0;
  }
}
