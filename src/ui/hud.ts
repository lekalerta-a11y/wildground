import type { BotAIManager } from '../ai/botAI';
import { getBrainMeta } from '../brains/registry';
import type { Player } from '../core/player';

export function renderLeaderboard(players: Player[]) {
  const el = document.getElementById('leaderboard')!;
  const sorted = [...players].sort((a, b) => b.territoryFraction - a.territoryFraction);
  el.innerHTML = sorted
    .map((p) => {
      const pct = (p.territoryFraction * 100).toFixed(2);
      return `<div class="leaderboard-row ${p.alive ? '' : 'dead'}">
        <span class="swatch" style="background:${p.color}"></span>
        <span class="leaderboard-name">${p.name}</span>
        <span class="leaderboard-pct">${pct}%</span>
        <span class="leaderboard-kills">\u{1F480} ${p.kills}</span>
      </div>`;
    })
    .join('');
}

export function renderDebugPanel(players: Player[], ai: BotAIManager) {
  const el = document.getElementById('debug-panel')!;
  const bots = players.filter((p) => p.kind === 'bot');
  el.innerHTML = bots
    .map((p) => {
      const info = ai.getDebugInfo(p.id);
      if (!info) return '';
      const brainId = ai.getBrainId(p.id);
      const brainLabel = brainId ? getBrainMeta(brainId).label : '-';
      return `<div class="debug-bot" style="border-color:${p.color}">
        <div class="debug-title">${p.name}${p.alive ? '' : ' (dead)'}</div>
        <div>BRAIN: ${brainLabel}</div>
        <div>STATE: ${info.state}</div>
        <div>TERRITORY: ${(p.territoryFraction * 100).toFixed(2)}%</div>
        <div>KILLS: ${p.kills}</div>
        <div>POS: ${p.position.x.toFixed(0)}, ${p.position.y.toFixed(0)}</div>
        <div>HEADING: ${((p.heading * 180) / Math.PI).toFixed(0)}\u00B0</div>
        <div>DIST HOME: ${info.distanceFromHome !== undefined ? info.distanceFromHome.toFixed(0) : '-'}</div>
        <div>NEAREST ENEMY: ${info.nearestEnemyName ?? '-'} ${
        info.nearestEnemyDistance ? `(${info.nearestEnemyDistance.toFixed(0)})` : ''
      }</div>
        <div>THREAT: ${(info.threatLevel ?? 'none').toUpperCase()}</div>
        <div>INTENT: ${info.currentIntent}</div>
      </div>`;
    })
    .join('');
}

export function renderResults(players: Player[]) {
  const el = document.getElementById('results-list')!;
  const sorted = [...players].sort((a, b) => b.territoryFraction - a.territoryFraction);
  el.innerHTML = sorted
    .map((p, i) => {
      const pct = (p.territoryFraction * 100).toFixed(2);
      return `<li>
        <span class="results-rank">${i + 1}.</span>
        <span class="swatch" style="background:${p.color}"></span>
        <span class="leaderboard-name">${p.name}</span>
        <span class="leaderboard-pct">${pct}%</span>
        <span class="leaderboard-kills">${p.kills} Kill${p.kills === 1 ? '' : 's'}</span>
      </li>`;
    })
    .join('');
}
