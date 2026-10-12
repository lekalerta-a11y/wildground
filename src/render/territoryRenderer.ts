import { COLORS } from '../core/constants';
import type { TerritoryGrid } from '../core/territoryGrid';
import type { Camera } from './camera';

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

const SUPERSAMPLE = 2;
const BAKE_BLUR_PX = 2.2;
const EMOJI_SAMPLE = 4;
const EMOJI_SPACING_WORLD = 48;

/**
 * Mirrors the TerritoryGrid into a small offscreen "raw" canvas (one pixel
 * per grid cell), then bakes a supersampled, blurred version of it into a
 * second canvas. Baking the blur once -- only when territory actually
 * changes (capture/elimination) -- gives smooth, organic-looking blob edges
 * every frame at the cost of a normal (cheap) image blit, rather than
 * re-blurring a full-screen draw call 60 times a second.
 */
export class TerritoryRenderer {
  private rawCanvas: HTMLCanvasElement;
  private rawCtx: CanvasRenderingContext2D;
  private bakedCanvas: HTMLCanvasElement;
  private bakedCtx: CanvasRenderingContext2D;
  private colorCache = new Map<number, [number, number, number]>();
  private grid: TerritoryGrid;
  private emojiLayers: Array<{
    ownerId: number;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    pattern: CanvasPattern;
  }> = [];

  constructor(grid: TerritoryGrid, playerColors: Map<number, string>, playerEmojis = new Map<number, string>()) {
    this.grid = grid;

    this.rawCanvas = document.createElement('canvas');
    this.rawCanvas.width = grid.cols;
    this.rawCanvas.height = grid.rows;
    this.rawCtx = this.rawCanvas.getContext('2d')!;

    this.bakedCanvas = document.createElement('canvas');
    this.bakedCanvas.width = grid.cols * SUPERSAMPLE;
    this.bakedCanvas.height = grid.rows * SUPERSAMPLE;
    this.bakedCtx = this.bakedCanvas.getContext('2d')!;

    this.setPlayerColors(playerColors);
    for (const [ownerId, emoji] of playerEmojis) {
      const canvas = document.createElement('canvas');
      canvas.width = grid.cols * EMOJI_SAMPLE;
      canvas.height = grid.rows * EMOJI_SAMPLE;
      const ctx = canvas.getContext('2d')!;
      const tile = document.createElement('canvas');
      const tileSize = Math.round(EMOJI_SPACING_WORLD / grid.cellSize * EMOJI_SAMPLE);
      tile.width = tile.height = tileSize;
      const tileCtx = tile.getContext('2d')!;
      tileCtx.font = `${tileSize * 0.9}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      tileCtx.textAlign = 'center';
      tileCtx.textBaseline = 'middle';
      tileCtx.fillText(emoji, tileSize / 2, tileSize / 2);
      this.emojiLayers.push({ ownerId, canvas, ctx, pattern: ctx.createPattern(tile, 'repeat')! });
    }
  }

  setPlayerColors(playerColors: Map<number, string>) {
    this.colorCache.clear();
    this.colorCache.set(0, hexToRgb(COLORS.NEUTRAL_FILL));
    for (const [id, color] of playerColors) {
      this.colorCache.set(id, hexToRgb(color));
    }
  }

  rebuild() {
    const { cols, rows } = this.grid;
    const cells = this.grid.getCellsView();
    const imageData = this.rawCtx.createImageData(cols, rows);
    const data = imageData.data;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const px = i * 4;
        if (!this.grid.isInsideWorldCircle(col, row)) {
          data[px + 3] = 0;
          continue;
        }
        const owner = cells[i];
        const rgb = this.colorCache.get(owner) ?? this.colorCache.get(0)!;
        data[px] = rgb[0];
        data[px + 1] = rgb[1];
        data[px + 2] = rgb[2];
        data[px + 3] = 255;
      }
    }
    this.rawCtx.putImageData(imageData, 0, 0);

    // Bake a supersampled + blurred version so cell edges look like smooth,
    // rounded blobs instead of hard pixel steps, without re-blurring on
    // every render frame.
    const bctx = this.bakedCtx;
    bctx.clearRect(0, 0, this.bakedCanvas.width, this.bakedCanvas.height);
    bctx.imageSmoothingEnabled = true;
    bctx.imageSmoothingQuality = 'high';
    bctx.filter = `blur(${BAKE_BLUR_PX}px)`;
    bctx.drawImage(this.rawCanvas, 0, 0, this.bakedCanvas.width, this.bakedCanvas.height);
    bctx.filter = 'none';
    // A second, unblurred pass at reduced opacity keeps color saturation
    // from washing out near territory centers after blurring the edges.
    bctx.globalAlpha = 0.55;
    bctx.drawImage(this.rawCanvas, 0, 0, this.bakedCanvas.width, this.bakedCanvas.height);
    bctx.globalAlpha = 1;

    // Cache the tiled emoji fill only when ownership changes. The ownership
    // mask clips even partial emoji at the border and removes lost territory.
    for (const layer of this.emojiLayers) {
      const mask = this.rawCtx.createImageData(cols, rows);
      for (let i = 0; i < cells.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        if (cells[i] === layer.ownerId && this.grid.isInsideWorldCircle(col, row)) {
          mask.data[i * 4 + 3] = 255;
        }
      }
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = cols;
      maskCanvas.height = rows;
      maskCanvas.getContext('2d')!.putImageData(mask, 0, 0);
      const ctx = layer.ctx;
      ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      ctx.fillStyle = layer.pattern;
      ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(maskCanvas, 0, 0, layer.canvas.width, layer.canvas.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  draw(target: CanvasRenderingContext2D, camera: Camera, canvasW: number, canvasH: number) {
    const worldLeft = -this.grid.cols * 0.5 * this.grid.cellSize;
    const worldTop = -this.grid.rows * 0.5 * this.grid.cellSize;
    const screen = camera.worldToScreen({ x: worldLeft, y: worldTop }, canvasW, canvasH);
    const w = this.grid.cols * this.grid.cellSize * camera.zoom;
    const h = this.grid.rows * this.grid.cellSize * camera.zoom;
    const prevSmoothing = target.imageSmoothingEnabled;
    const prevQuality = target.imageSmoothingQuality;
    target.imageSmoothingEnabled = true;
    target.imageSmoothingQuality = 'high';
    target.drawImage(this.bakedCanvas, screen.x, screen.y, w, h);
    for (const layer of this.emojiLayers) {
      target.drawImage(layer.canvas, screen.x, screen.y, w, h);
    }
    target.imageSmoothingQuality = prevQuality;
    target.imageSmoothingEnabled = prevSmoothing;
  }
}
