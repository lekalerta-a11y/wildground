import { COLORS, MINIMAP, WORLD } from '../core/constants';
import type { Player } from '../core/player';
import type { TerritoryGrid } from '../core/territoryGrid';
import type { Camera } from './camera';

export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP.SIZE_PX;
    this.canvas.height = MINIMAP.SIZE_PX;
    this.canvas.className = 'minimap-canvas';
    this.ctx = this.canvas.getContext('2d')!;
  }

  draw(grid: TerritoryGrid, players: Player[], camera: Camera) {
    const ctx = this.ctx;
    const size = MINIMAP.SIZE_PX;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.clip();

    // Downsample the ownership grid onto the minimap circle.
    const sampleStep = Math.max(1, Math.floor(grid.cols / (size * 1.4)));
    const colorFor = (owner: number): string => {
      if (owner === 0) return COLORS.NEUTRAL_FILL;
      const p = players.find((pl) => pl.id === owner);
      return p ? p.color : COLORS.NEUTRAL_FILL;
    };

    for (let row = 0; row < grid.rows; row += sampleStep) {
      for (let col = 0; col < grid.cols; col += sampleStep) {
        if (!grid.isInsideWorldCircle(col, row)) continue;
        const owner = grid.ownerAtCell(col, row);
        if (owner === 0) continue; // background already neutral-ish
        const world = grid.cellCenter(col, row);
        const mx = cx + (world.x / WORLD.RADIUS) * r;
        const my = cy + (world.y / WORLD.RADIUS) * r;
        ctx.fillStyle = colorFor(owner);
        ctx.fillRect(mx, my, sampleStep * 1.6, sampleStep * 1.6);
      }
    }
    ctx.restore();

    // Boundary ring.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.BOUNDARY_OUTER;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Players.
    for (const p of players) {
      if (!p.alive) continue;
      const mx = cx + (p.position.x / WORLD.RADIUS) * r;
      const my = cy + (p.position.y / WORLD.RADIUS) * r;
      ctx.beginPath();
      ctx.arc(mx, my, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.fill();
      ctx.stroke();
    }

    // Camera / focus indicator.
    const camX = cx + (camera.x / WORLD.RADIUS) * r;
    const camY = cy + (camera.y / WORLD.RADIUS) * r;
    const viewSize = 10 / camera.zoom;
    ctx.strokeStyle = 'rgba(20,20,20,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(camX - viewSize / 2, camY - viewSize / 2, viewSize, viewSize);
  }
}
