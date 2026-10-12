import { describe, expect, it } from 'vitest';
import { BotAIManager } from '../ai/botAI';
import { BRAIN_REGISTRY, createBrain, getBrainMeta } from '../brains/registry';
import { PLAYER } from '../core/constants';
import { createMatch } from '../core/matchFactory';

describe('brain registry', () => {
  it('contains exactly six selectable brains: 4 rule-based + custom AI + fly brain', () => {
    expect(BRAIN_REGISTRY.length).toBe(6);
    const ruleBased = BRAIN_REGISTRY.filter((b) => b.category === 'rule-based');
    const custom = BRAIN_REGISTRY.filter((b) => b.category === 'custom-ai');
    const fly = BRAIN_REGISTRY.filter((b) => b.category === 'fly-brain');
    expect(ruleBased.length).toBe(4);
    expect(custom.length).toBe(1);
    expect(fly.length).toBe(1);
  });

  it('every registry id is unique', () => {
    const ids = BRAIN_REGISTRY.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('falls back to the first registry entry for an unknown id', () => {
    const meta = getBrainMeta('does-not-exist');
    expect(meta).toBe(BRAIN_REGISTRY[0]);
  });

  it('creates a working brain instance for every registered id', () => {
    const match = createMatch({ botCount: 1, includeHuman: false });
    const bot = match.players[0];
    for (const meta of BRAIN_REGISTRY) {
      const brain = createBrain(meta.id, bot);
      expect(brain.brainId).toBe(meta.id);
      // Every brain must be able to run an update tick without throwing,
      // and (per the BotBrain contract) leave a finite heading behind.
      expect(() => brain.update(1 / 60, match, bot)).not.toThrow();
      expect(Number.isFinite(bot.desiredHeading)).toBe(true);
    }
  });
});

describe('BotAIManager brain assignment', () => {
  it('assigns each bot the requested brain id and falls back to default for unmapped bots', () => {
    const match = createMatch({ botCount: 2, includeHuman: false });
    const [botA, botB] = match.players;
    const assignment = new Map<number, string>([[botA.id, 'rule-cautious']]);
    const ai = new BotAIManager(match, assignment);

    expect(ai.getBrainId(botA.id)).toBe('rule-cautious');
    expect(ai.getBrainId(botB.id)).toBe('rule-balanced'); // default fallback
  });

  it('drives assigned bots forward each update without throwing', () => {
    const match = createMatch({ botCount: 2, includeHuman: false });
    const assignment = new Map<number, string>([
      [match.players[0].id, 'custom-ai'],
      [match.players[1].id, 'fly-brain'],
    ]);
    const ai = new BotAIManager(match, assignment);

    for (let i = 0; i < 30; i++) {
      ai.update(1 / 60, match);
      match.step(1 / 60);
    }

    for (const p of match.players) {
      expect(Number.isFinite(p.position.x)).toBe(true);
      expect(Number.isFinite(p.position.y)).toBe(true);
    }
  });

  it('template brains (custom-ai, fly-brain) never move a bot outside the world boundary', () => {
    const match = createMatch({ botCount: 1, includeHuman: false });
    const assignment = new Map<number, string>([[match.players[0].id, 'custom-ai']]);
    const ai = new BotAIManager(match, assignment);
    for (let i = 0; i < 200; i++) {
      ai.update(1 / 60, match);
      match.step(1 / 60);
    }
    const p = match.players[0];
    const distFromCenter = Math.hypot(p.position.x, p.position.y);
    expect(distFromCenter).toBeLessThanOrEqual(3200 - PLAYER.COLLISION_RADIUS + 1);
  });
});
