import './style.css';
import { BotAIManager } from './ai/botAI';
import { BRAIN_REGISTRY } from './brains/registry';
import { CAMERA, SIMULATION_SPEEDS } from './core/constants';
import { createMatch } from './core/matchFactory';
import type { Match, MatchEventType } from './core/simulation';
import { HumanInputController } from './input/humanInput';
import { Camera } from './render/camera';
import { Minimap } from './render/minimap';
import { ParticleSystem } from './render/particles';
import { clearBackground, drawPlayer, drawTrail, drawWorldBoundary, drawRays } from './render/sceneRenderer';
import { TerritoryRenderer } from './render/territoryRenderer';
import { renderBrainSelectors } from './ui/brainSelector';
import { renderDebugPanel, renderLeaderboard, renderResults } from './ui/hud';
import { setupSlider } from './ui/sliderControl';
import { PLAYER_SKINS, loadPlayerSkin, savePlayerSkin } from './core/skins';
import { TokenSkinAccess, WG_DECIMALS } from './core/tokenSkinAccess';
import type { SkinAccessState } from './core/tokenSkinAccess';
import type { PlayerSkin } from './core/skins';

const FIXED_STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 8;
const DEFAULT_BOT_BRAINS = BRAIN_REGISTRY.filter((b) => b.category === 'rule-based').map((b) => b.id);

type Mode = 'menu' | 'playing';
type PlayKind = 'play' | 'watch';

class GameApp {
  private canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  private ctx = this.canvas.getContext('2d')!;
  private camera = new Camera();
  private particles = new ParticleSystem();
  private minimap = new Minimap();
  private input = new HumanInputController(this.canvas);

  private match: Match | null = null;
  private ai: BotAIManager | null = null;
  private territoryRenderer: TerritoryRenderer | null = null;

  private mode: Mode = 'menu';
  private playKind: PlayKind = 'play';
  private paused = false;
  private debugVisible = false;
  private simSpeed = 1;
  private followIndex = 0;
  private accumulator = 0;
  private lastTime = 0;

  // WATCH AI's zoom/speed are independent of PLAY mode -- PLAY always runs
  // at a fixed standard zoom and real-time (1x) speed, regardless of
  // whatever the spectator controls were last set to.
  private watchZoom = CAMERA.MIN_ZOOM;
  private watchSimSpeed = 4;
  private setSpeedSliderUI: ((value: number) => void) | null = null;

  // Bot count + per-slot brain selection for each mode. Settings is the
  // source of truth; PLAY/WATCH AI setup screens' sliders stay in sync
  // with it. Brain id arrays are always kept at full MAX_PLAYERS-ish
  // length so a slot's selection survives the count slider moving back
  // and forth.
  private playBots = 1;
  private watchBots = 2;
  private playBotBrainIds: string[] = Array.from({ length: 6 }, (_, i) => DEFAULT_BOT_BRAINS[i % DEFAULT_BOT_BRAINS.length]);
  private skinAccess = new TokenSkinAccess((state) => this.updateTokenAccess(state));
  private skinsUnlocked = false;
  private playerSkin = PLAYER_SKINS[0];
  private watchBotBrainIds: string[] = [...DEFAULT_BOT_BRAINS];
  private setPlaySliderMain: ((v: number) => void) | null = null;
  private setPlaySliderSettings: ((v: number) => void) | null = null;
  private setWatchSliderMain: ((v: number) => void) | null = null;
  private setWatchSliderSettings: ((v: number) => void) | null = null;

  constructor() {
    document.getElementById('minimap-slot')!.appendChild(this.minimap.canvas);
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    this.wireMenus();
    this.wireHotkeys();
    requestAnimationFrame((t) => this.loop(t));
  }

  private resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------------------------------------------------------------- menus

  private wireMenus() {
    show('screen-menu');

    document.getElementById('btn-play')!.addEventListener('click', () => show('screen-play-setup'));
    document.getElementById('btn-watch')!.addEventListener('click', () => show('screen-watch-setup'));
    document.getElementById('btn-skins')!.addEventListener('click', () => {
      if (!this.skinsUnlocked) {
        show('screen-skin-access');
        document.getElementById('btn-wg-connect')!.focus();
        return;
      }
      show('screen-skins');
      document.querySelector<HTMLButtonElement>('.skin-option.selected')?.focus();
    });
    this.setupSkins();
    document.getElementById('btn-wg-connect')!.addEventListener('click', () => void this.skinAccess.connect());
    document.getElementById('btn-wg-refresh')!.addEventListener('click', () => void this.skinAccess.refresh());
    document.getElementById('btn-wg-disconnect')!.addEventListener('click', () => this.skinAccess.disconnect());
    document.getElementById('btn-wg-open-skins')!.addEventListener('click', () => {
      if (!this.skinsUnlocked) return;
      show('screen-skins');
      document.querySelector<HTMLButtonElement>('.skin-option.selected')?.focus();
    });
    document.getElementById('btn-settings')!.addEventListener('click', () => show('screen-settings'));

    for (const btn of document.querySelectorAll<HTMLButtonElement>('.btn-back')) {
      btn.addEventListener('click', () => {
        const closingSkins = !!btn.closest('#screen-skins');
        show(btn.dataset.target!);
        if (closingSkins) document.getElementById('btn-skins')!.focus();
      });
    }

    // PLAY bot count: two sliders (setup screen + settings) stay in sync,
    // and the brain-selector rows in Settings regenerate to match.
    this.setPlaySliderMain = setupSlider('play-bot-slider', this.playBots, (v) => this.setPlayBotCount(v));
    this.setPlaySliderSettings = setupSlider('settings-play-slider', this.playBots, (v) =>
      this.setPlayBotCount(v)
    );
    // WATCH AI bot count: same pattern.
    this.setWatchSliderMain = setupSlider('watch-bot-slider', this.watchBots, (v) => this.setWatchBotCount(v));
    this.setWatchSliderSettings = setupSlider('settings-watch-slider', this.watchBots, (v) =>
      this.setWatchBotCount(v)
    );
    this.renderPlayBrainSelectors();
    this.renderWatchBrainSelectors();

    document.getElementById('btn-play-start')!.addEventListener('click', async () => {
      const button = document.getElementById('btn-play-start') as HTMLButtonElement;
      button.disabled = true;
      await this.skinAccess.refresh();
      button.disabled = false;
      this.startMatch('play', this.playBots);
    });
    document.getElementById('btn-watch-start')!.addEventListener('click', () => {
      this.startMatch('watch', this.watchBots);
    });

    this.setSpeedSliderUI = setupSlider('speed-slider', this.watchSimSpeed, (v) => {
      this.watchSimSpeed = v;
      if (this.playKind === 'watch') this.simSpeed = v;
    });
    const zoomSliderEl = document.getElementById('zoom-slider') as HTMLInputElement;
    zoomSliderEl.value = String(this.watchZoom);
    zoomSliderEl.addEventListener('input', (e) => {
      const v = parseFloat((e.target as HTMLInputElement).value);
      this.watchZoom = v;
      if (this.playKind === 'watch') this.camera.setZoom(v);
    });
    document.getElementById('btn-follow-prev')!.addEventListener('click', () => this.cycleFollow(-1));
    document.getElementById('btn-follow-next')!.addEventListener('click', () => this.cycleFollow(1));

    document.getElementById('btn-resume')!.addEventListener('click', () => this.togglePause(false));
    document.getElementById('btn-pause-restart')!.addEventListener('click', () => this.restart());
    document.getElementById('btn-pause-menu')!.addEventListener('click', () => this.returnToMenu());
    document.getElementById('btn-again')!.addEventListener('click', () => this.restart());
    document.getElementById('btn-gameover-menu')!.addEventListener('click', () => this.returnToMenu());
  }

  private wireHotkeys() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && ['screen-skins', 'screen-skin-access'].some((id) => !document.getElementById(id)!.classList.contains('hidden'))) {
        show('screen-menu');
        document.getElementById('btn-skins')!.focus();
        return;
      }
      if (e.key === 'Escape' && this.mode === 'playing') {
        this.togglePause(!this.paused);
      }
      if (e.key.toLowerCase() === 'h' && this.mode === 'playing') {
        this.debugVisible = !this.debugVisible;
        toggle('debug-panel', this.debugVisible);
      }
    });
  }

  private setupSkins() {
    const grid = document.getElementById('skin-grid')!;
    for (const skin of PLAYER_SKINS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'skin-option';
      button.disabled = !this.skinsUnlocked;
      button.dataset.skinId = skin.id;
      button.style.setProperty('--skin-color', skin.color);
      const icon = document.createElement('span');
      icon.className = skin.emoji ? 'skin-emoji' : 'skin-classic';
      icon.textContent = skin.emoji;
      icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = skin.name;
      button.append(icon, label);
      button.addEventListener('click', () => this.selectSkin(skin));
      grid.append(button);
    }
    this.updateSkinUI();
  }

  private updateTokenAccess(state: SkinAccessState) {
    this.skinsUnlocked = state.unlocked;
    this.playerSkin = state.unlocked ? loadPlayerSkin() : PLAYER_SKINS[0];
    this.updateSkinUI();
    document.getElementById('wg-access-status')!.textContent = state.message;
    document.getElementById('wg-wallet-address')!.textContent = state.address ? `Verified wallet: ${state.address}` : '';
    const units = 10n ** BigInt(WG_DECIMALS);
    document.getElementById('wg-wallet-balance')!.textContent = state.balance === null ? ''
      : `${(state.balance / units).toLocaleString('en-US')}.${(state.balance % units).toString().padStart(WG_DECIMALS, '0').replace(/0+$/, '') || '0'} WG`;
    for (const id of ['btn-wg-connect', 'btn-wg-refresh', 'btn-wg-disconnect']) {
      (document.getElementById(id) as HTMLButtonElement).disabled = state.busy;
    }
    toggle('btn-wg-refresh', !!state.address);
    toggle('btn-wg-disconnect', !!state.address);
    toggle('btn-wg-open-skins', state.unlocked);
    document.getElementById('skins-lock-note')!.textContent = state.unlocked ? '100,000 WG holding verified' : 'Hold 100,000 $WG to unlock';
    if (!state.unlocked && !document.getElementById('screen-skins')!.classList.contains('hidden')) show('screen-skin-access');
  }

  private selectSkin(skin: PlayerSkin) {
    if (!this.skinsUnlocked) return;
    this.playerSkin = skin;
    const saved = savePlayerSkin(skin);
    this.updateSkinUI();
    document.getElementById('skin-status')!.textContent = saved
      ? `${skin.name} selected. Saved for your next games.`
      : `${skin.name} selected for this session. Browser storage is unavailable.`;
  }

  private updateSkinUI() {
    for (const button of document.querySelectorAll<HTMLButtonElement>('.skin-option')) {
      const selected = button.dataset.skinId === this.playerSkin.id;
      button.classList.toggle('selected', selected);
      button.disabled = !this.skinsUnlocked;
      button.setAttribute('aria-pressed', String(selected));
    }
    const preview = document.getElementById('skin-preview')!;
    preview.style.setProperty('--skin-color', this.playerSkin.color);
    const head = document.getElementById('skin-preview-head')!;
    head.className = this.playerSkin.emoji ? 'skin-emoji' : 'skin-classic';
    head.textContent = this.playerSkin.emoji;
    document.getElementById('skin-preview-name')!.textContent = this.playerSkin.name;
    const skinsButton = document.getElementById('btn-skins') as HTMLButtonElement;
    skinsButton.disabled = false;
    skinsButton.textContent = this.skinsUnlocked ? `SKINS · ${this.playerSkin.emoji ?? 'Classic'}` : '🔒 SKINS';
  }

  private cycleFollow(dir: number) {
    if (!this.match) return;
    const alive = this.match.players.filter((p) => p.alive);
    if (alive.length === 0) return;
    this.followIndex = (this.followIndex + dir + alive.length) % alive.length;
    document.getElementById('watch-follow-name')!.textContent = alive[this.followIndex].name;
  }

  private setPlayBotCount(v: number) {
    this.playBots = v;
    this.setPlaySliderMain?.(v);
    this.setPlaySliderSettings?.(v);
    this.renderPlayBrainSelectors();
  }

  private setWatchBotCount(v: number) {
    this.watchBots = v;
    this.setWatchSliderMain?.(v);
    this.setWatchSliderSettings?.(v);
    this.renderWatchBrainSelectors();
  }

  private renderPlayBrainSelectors() {
    renderBrainSelectors('settings-play-brains', this.playBots, this.playBotBrainIds, (index, brainId) => {
      this.playBotBrainIds[index] = brainId;
    });
  }

  private renderWatchBrainSelectors() {
    renderBrainSelectors('settings-watch-brains', this.watchBots, this.watchBotBrainIds, (index, brainId) => {
      this.watchBotBrainIds[index] = brainId;
    });
  }

  // ---------------------------------------------------------------- match lifecycle

  private startMatch(kind: PlayKind, botCount: number) {
    this.playKind = kind;
    this.match = createMatch({
      botCount,
      includeHuman: kind === 'play',
      humanSkin: this.skinsUnlocked ? this.playerSkin : PLAYER_SKINS[0],
    });

    const brainIds = kind === 'play' ? this.playBotBrainIds : this.watchBotBrainIds;
    const bots = this.match.players.filter((p) => p.kind === 'bot');
    const brainAssignment = new Map<number, string>();
    bots.forEach((bot, i) => {
      brainAssignment.set(bot.id, brainIds[i] ?? DEFAULT_BOT_BRAINS[i % DEFAULT_BOT_BRAINS.length]);
    });
    this.ai = new BotAIManager(this.match, brainAssignment);

    const colorMap = new Map(this.match.players.map((p) => [p.id, p.color]));
    const emojiMap = new Map(this.match.players.flatMap((p) => p.headEmoji ? [[p.id, p.headEmoji] as const] : []));
    this.territoryRenderer = new TerritoryRenderer(this.match.grid, colorMap, emojiMap);
    this.territoryRenderer.rebuild();

    this.followIndex = 0;
    this.paused = false;
    this.debugVisible = false;
    this.accumulator = 0;

    // PLAY always runs at a fixed standard zoom/speed, regardless of
    // whatever the spectator last chose in WATCH AI: zoom matches WATCH
    // AI's minimum (most zoomed-out) level, and speed matches WATCH AI's
    // 2x setting, since that reads as the "normal" pace for this game.
    if (kind === 'play') {
      this.simSpeed = 2;
      this.camera.snapZoom(CAMERA.MIN_ZOOM);
    } else {
      this.simSpeed = this.watchSimSpeed;
      this.camera.snapZoom(this.watchZoom);
      this.setSpeedSliderUI?.(this.watchSimSpeed);
      const zoomSliderEl = document.getElementById('zoom-slider') as HTMLInputElement | null;
      if (zoomSliderEl) zoomSliderEl.value = String(this.watchZoom);
    }

    const followed = this.getFollowedPlayer();
    if (followed) this.camera.snapTo(followed.position);

    hideAll();
    show('hud');
    toggle('watch-controls', kind === 'watch');
    toggle('debug-panel', false);
    if (kind === 'watch' && followed) {
      document.getElementById('watch-follow-name')!.textContent = followed.name;
    }

    this.mode = 'playing';
  }

  private restart() {
    if (!this.match) return;
    const botCount = this.match.players.filter((p) => p.kind === 'bot').length;
    this.startMatch(this.playKind, botCount);
  }

  private returnToMenu() {
    this.mode = 'menu';
    this.match = null;
    this.ai = null;
    this.territoryRenderer = null;
    hideAll();
    show('screen-menu');
  }

  private togglePause(pause: boolean) {
    this.paused = pause;
    toggle('screen-pause', pause);
  }

  private getFollowedPlayer() {
    if (!this.match) return null;
    if (this.playKind === 'play') {
      return this.match.players.find((p) => p.kind === 'human') ?? this.match.players[0];
    }
    const alive = this.match.players.filter((p) => p.alive);
    if (alive.length === 0) return this.match.players[0] ?? null;
    if (this.followIndex >= alive.length) this.followIndex = 0;
    return alive[this.followIndex];
  }

  // ---------------------------------------------------------------- loop

  private loop(timeMs: number) {
    const dt = this.lastTime ? Math.min((timeMs - this.lastTime) / 1000, 0.1) : 0;
    this.lastTime = timeMs;

    if (this.mode === 'playing' && !this.paused && this.match && this.ai) {
      this.updateHumanInput();

      this.accumulator += dt * this.simSpeed;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
        const result = this.match.step(FIXED_STEP);
        this.ai.update(FIXED_STEP, this.match);
        this.handleEvents(result.events);
        this.accumulator -= FIXED_STEP;
        steps += 1;

        if (result.matchOver) {
          this.accumulator = 0;
          this.onMatchOver();
          break;
        }
      }

      const followed = this.getFollowedPlayer();
      this.camera.update(dt, followed ? followed.position : { x: 0, y: 0 });
      this.particles.update(dt);

      if (this.mode === 'playing') {
        renderLeaderboard(this.match.players);
        if (this.debugVisible) renderDebugPanel(this.match.players, this.ai);
        
        if (this.playKind === 'watch') {
          const followed = this.getFollowedPlayer();
          const label = document.getElementById('watch-follow-name');
          if (label && followed) label.textContent = followed.name;
        }
      }
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private updateHumanInput() {
    if (this.playKind !== 'play' || !this.match) return;
    const human = this.match.players.find((p) => p.kind === 'human');
    if (!human || !human.alive) return;
    const rect = this.canvas.getBoundingClientRect();
    const screenPos = this.camera.worldToScreen(human.position, rect.width, rect.height);
    const { heading } = this.input.getDesiredHeading(screenPos.x, screenPos.y, human.desiredHeading);
    human.desiredHeading = heading;
  }

  private handleEvents(events: MatchEventType[]) {
    if (!this.match || !this.territoryRenderer) return;
    let needsRebuild = false;
    for (const ev of events) {
      if (ev.type === 'capture') {
        needsRebuild = true;
        const p = this.match.players.find((pl) => pl.id === ev.playerId);
        if (p) this.particles.burst(p.position, p.color, 10);
      } else if (ev.type === 'elimination') {
        needsRebuild = true;
        const p = this.match.players.find((pl) => pl.id === ev.playerId);
        if (p) this.particles.burst(p.position, p.color, 16);
      }
    }
    if (needsRebuild) this.territoryRenderer.rebuild();
  }

  private onMatchOver() {
    if (this.match) renderResults(this.match.players);
    hideAll();
    show('screen-gameover');
    this.mode = 'menu';
  }

  // ---------------------------------------------------------------- render

  private render() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;
    clearBackground(this.ctx, w, h);

    if (this.match && this.territoryRenderer) {
      drawWorldBoundary(this.ctx, this.camera, w, h);
      this.territoryRenderer.draw(this.ctx, this.camera, w, h);

      for (const p of this.match.players) drawTrail(this.ctx, this.camera, w, h, p);

      const followed = this.getFollowedPlayer();
      const sorted = [...this.match.players].sort((a, b) => (a.alive === b.alive ? 0 : a.alive ? 1 : -1));
      for (const p of sorted) {
        drawPlayer(this.ctx, this.camera, w, h, p, followed?.id === p.id);
      }

      if (this.debugVisible && this.ai) {
        for (const p of this.match.players) {
          if (p.kind === 'bot' && p.alive) {
            const info = this.ai.getDebugInfo(p.id);
            if (info?.rays) {
              drawRays(this.ctx, this.camera, w, h, p, info.rays);
            }
          }
        }
      }

      this.particles.draw(this.ctx, this.camera, w, h);
      this.minimap.draw(this.match.grid, this.match.players, this.camera);
    } else {
      drawWorldBoundary(this.ctx, this.camera, w, h);
    }
  }
}

function show(id: string) {
  hideAll();
  document.getElementById(id)?.classList.remove('hidden');
}

function hideAll() {
  for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
  document.getElementById('hud')?.classList.add('hidden');
}

function toggle(id: string, visible: boolean) {
  document.getElementById(id)?.classList.toggle('hidden', !visible);
}

void SIMULATION_SPEEDS;

new GameApp();
