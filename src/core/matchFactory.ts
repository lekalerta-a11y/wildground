import { COLORS, PLAYER, PLAYER_NAMES } from './constants';
import { Player } from './player';
import { generateSpawnPoints } from './spawn';
import { Match } from './simulation';
import { TerritoryGrid } from './territoryGrid';
import type { PlayerSkin } from './skins';

export interface MatchSetupOptions {
  /** Total bot count (excludes the human, if present). */
  botCount: number;
  includeHuman: boolean;
  humanSkin?: PlayerSkin;
}

export function createMatch(opts: MatchSetupOptions): Match {
  const totalPlayers = opts.botCount + (opts.includeHuman ? 1 : 0);
  const spawns = generateSpawnPoints(totalPlayers);
  
  const players: Player[] = [];
  let nextId = 1;
  const humanColor = opts.humanSkin?.color ?? COLORS.HUMAN;
  // Reserve the closest palette color for the human so bots stay distinguishable.
  const palette = [...COLORS.BOT_PALETTE];
  if (opts.includeHuman && opts.humanSkin?.emoji) {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const humanRgb = rgb(humanColor);
    const distance = (hex: string) => rgb(hex).reduce((sum, v, i) => sum + (v - humanRgb[i]) ** 2, 0);
    const closest = palette.reduce((best, color) => distance(color) < distance(best) ? color : best);
    palette.splice(palette.indexOf(closest), 1);
  }

  if (opts.includeHuman) {
    players.push(
      new Player({
        id: nextId++,
        name: PLAYER_NAMES.HUMAN,
        color: humanColor,
        headEmoji: opts.humanSkin?.emoji,
        kind: 'human',
        spawn: spawns[players.length],
      })
    );
  }

  for (let i = 0; i < opts.botCount; i++) {
    players.push(
      new Player({
        id: nextId++,
        name: `${PLAYER_NAMES.BOT_PREFIX}${String(i + 1).padStart(2, '0')}`,
        color: palette[i % palette.length],
        kind: 'bot',
        spawn: spawns[players.length],
      })
    );
  }

  const grid = new TerritoryGrid();

  for (const p of players) {
    grid.stampCircle(p.position, PLAYER.STARTING_TERRITORY_RADIUS, p.id);
  }

  const match = new Match(players, grid);

  // Force an initial fraction computation so UI has correct values on frame 0.
  for (const p of players) {
    p.territoryFraction = grid.ownershipFraction(p.id);
  }

  return match;
}
