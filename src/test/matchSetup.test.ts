import { describe, expect, it } from 'vitest';
import { createMatch } from '../core/matchFactory';
import { PLAYER_SKINS } from '../core/skins';
import { PLAYER, WORLD } from '../core/constants';
import { dist } from '../core/math';

describe('expanded PLAY matches', () => {
  it.each([4, 5, 6])('spawns a human against %i bots with separate starting territory', (botCount) => {
    const match = createMatch({ botCount, includeHuman: true });
    expect(match.players.filter((p) => p.kind === 'bot')).toHaveLength(botCount);
    expect(match.players.filter((p) => p.kind === 'human')).toHaveLength(1);
    for (const player of match.players) {
      expect(match.grid.ownerAt(player.position)).toBe(player.id);
      expect(dist(player.position, { x: 0, y: 0 }) + PLAYER.STARTING_TERRITORY_RADIUS).toBeLessThan(WORLD.RADIUS);
    }
  });

  it('applies the whale head and color without sharing the bot palette color', () => {
    const whale = PLAYER_SKINS.find((s) => s.id === 'whale')!;
    const match = createMatch({ botCount: 6, includeHuman: true, humanSkin: whale });
    const human = match.players.find((p) => p.kind === 'human')!;
    expect(human.headEmoji).toBe('🐳');
    expect(human.color).toBe('#2563eb');
    const bots = match.players.filter((p) => p.kind === 'bot');
    expect(new Set(match.players.map((p) => p.color)).size).toBe(7);
    expect(bots.every((p) => p.headEmoji === null)).toBe(true);
    expect(bots.some((p) => p.color === '#3b82f6')).toBe(false);
    human.reset(human.position);
    expect(human.headEmoji).toBe('🐳');
  });

  it('leaves WATCH AI independent of the human skin', () => {
    const match = createMatch({ botCount: 4, includeHuman: false, humanSkin: PLAYER_SKINS[1] });
    expect(match.players).toHaveLength(4);
    expect(match.players.every((p) => p.kind === 'bot' && p.headEmoji === null)).toBe(true);
  });
});
