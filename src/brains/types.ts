import type { Player } from '../core/player';
import type { Match } from '../core/simulation';
import type { RayReading } from './shared-sensors/sensorFrame';

/**
 * The ONE thing every bot "brain" must do: given the current match state,
 * decide where this bot wants to go by writing to `player.desiredHeading`.
 *
 * This is the entire contract. A brain can be:
 *  - a hand-written rule-based state machine (see rule-based/),
 *  - a trained neural network you plug in later (see custom-ai/),
 *  - a simulated biological connectome (see fly-brain/).
 *
 * The core game (simulation, rendering, camera, UI) never imports a
 * specific brain implementation directly -- it only talks to this
 * interface via the BrainRegistry. That means you can add, remove, or
 * rewrite a brain without touching anything under src/core, src/render,
 * or src/ui.
 */
export interface BotBrain {
  /** Stable id matching this brain's registry entry (for debug display). */
  readonly brainId: string;

  /**
   * Called every simulation frame. Implementations decide their own
   * internal update cadence (e.g. only re-planning every N ms) -- `dt` is
   * given in seconds so time-based throttling works regardless of frame
   * rate or WATCH AI's simulation speed multiplier.
   *
   * The ONLY required side effect is setting `player.desiredHeading`
   * (radians). The core simulation handles turning, movement, collisions,
   * trails, and capture on its own -- a brain never needs to touch
   * `player.position` directly.
   */
  update(dt: number, match: Match, player: Player): void;

  /** Optional: surfaced in the in-game debug panel (press H). */
  getDebugInfo?(): BotBrainDebugInfo;
}

export interface BotBrainDebugInfo {
  /** Short state/status label, e.g. "EXPANDING" or "IDLE (template)". */
  state: string;
  /** One-line human-readable description of what the brain is doing right now. */
  currentIntent: string;
  distanceFromHome?: number;
  nearestEnemyName?: string | null;
  nearestEnemyDistance?: number | null;
  threatLevel?: string;
  rays?: RayReading[];
}

/** Factory signature every registry entry provides. */
export type BotBrainFactory = (player: Player) => BotBrain;

export type BrainCategory = 'rule-based' | 'custom-ai' | 'fly-brain';

export interface BrainMeta {
  id: string;
  /** Shown in the brain-selection dropdown. */
  label: string;
  /** Short description shown as a tooltip/subtitle in the selector. */
  description: string;
  category: BrainCategory;
  create: BotBrainFactory;
}