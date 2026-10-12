import { DEFAULT_BRAIN_ID, createBrain } from '../brains/registry';
import type { BotBrain, BotBrainDebugInfo } from '../brains/types';
import type { Match } from '../core/simulation';

export class BotAIManager {
  private brains = new Map<number, BotBrain>();

  /**
   * @param match The match to manage bots for.
   * @param brainAssignment Optional map of playerId -> brain registry id.
   *   Any bot not present in the map falls back to the default rule-based
   *   brain, so existing callers (and tests) that don't care about brain
   *   selection keep working unchanged.
   */
  constructor(match: Match, brainAssignment?: Map<number, string>) {
    for (const p of match.players) {
      if (p.kind === 'bot') {
        const brainId = brainAssignment?.get(p.id) ?? DEFAULT_BRAIN_ID;
        this.brains.set(p.id, createBrain(brainId, p));
      }
    }
  }

  update(dt: number, match: Match) {
    for (const [playerId, brain] of this.brains) {
      const player = match.players.find((p) => p.id === playerId);
      if (player) brain.update(dt, match, player);
    }
  }

  getDebugInfo(playerId: number): BotBrainDebugInfo | null {
    return this.brains.get(playerId)?.getDebugInfo?.() ?? null;
  }

  getBrainId(playerId: number): string | null {
    return this.brains.get(playerId)?.brainId ?? null;
  }
}
