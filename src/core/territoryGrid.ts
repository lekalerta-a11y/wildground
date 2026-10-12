import { WORLD, TERRITORY } from './constants';
import type { Vec2 } from './math';

export const NEUTRAL = 0;

/**
 * Raster (grid-based) territory ownership system.
 *
 * The world's circular play area is covered by a square grid of cells.
 * Each cell stores the owning player's id (0 = neutral/unclaimed).
 *
 * Capture works via a "wall + flood fill" algorithm:
 *  1. The player's new trail (plus their existing territory) forms a set
 *     of "wall" cells.
 *  2. We flood-fill from the grid's outer border inward, through any cell
 *     that is NOT a wall cell. Anything the flood reaches is "outside".
 *  3. Any non-wall cell the flood never reaches is enclosed -> it becomes
 *     owned by the capturing player.
 *
 * This is a simple, robust, well-understood technique for arbitrary
 * free-angle Paper.io-style capture and performs well at this grid
 * resolution (a few hundred cells per axis).
 */
export class TerritoryGrid {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly originX: number; // world-space x of grid cell (0,0)'s top-left corner
  readonly originY: number;
  private cells: Uint8Array;
  private totalPlayableCells: number;

  constructor(cellSize: number = TERRITORY.GRID_CELL_SIZE) {
    this.cellSize = cellSize;
    const span = WORLD.RADIUS * 2;
    this.cols = Math.ceil(span / cellSize);
    this.rows = Math.ceil(span / cellSize);
    this.originX = -WORLD.RADIUS;
    this.originY = -WORLD.RADIUS;
    this.cells = new Uint8Array(this.cols * this.rows);
    this.totalPlayableCells = 0;
    this.markPlayableCells();
  }

  private markPlayableCells() {
    // Pre-compute how many cells fall inside the circular world; used for
    // percentage-of-world calculations. We don't store this per-cell beyond
    // the count (owner array already implicitly excludes out-of-world cells
    // because they are simply never assigned/queried in gameplay).
    let count = 0;
    const r2 = WORLD.RADIUS * WORLD.RADIUS;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const wx = this.originX + (col + 0.5) * this.cellSize;
        const wy = this.originY + (row + 0.5) * this.cellSize;
        if (wx * wx + wy * wy <= r2) count++;
      }
    }
    this.totalPlayableCells = count;
  }

  worldToCell(p: Vec2): { col: number; row: number } {
    const col = Math.floor((p.x - this.originX) / this.cellSize);
    const row = Math.floor((p.y - this.originY) / this.cellSize);
    return { col, row };
  }

  cellCenter(col: number, row: number): Vec2 {
    return {
      x: this.originX + (col + 0.5) * this.cellSize,
      y: this.originY + (row + 0.5) * this.cellSize,
    };
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
  }

  isInsideWorldCircle(col: number, row: number): boolean {
    const c = this.cellCenter(col, row);
    return c.x * c.x + c.y * c.y <= WORLD.RADIUS * WORLD.RADIUS;
  }

  private index(col: number, row: number): number {
    return row * this.cols + col;
  }

  ownerAt(p: Vec2): number {
    const { col, row } = this.worldToCell(p);
    if (!this.inBounds(col, row)) return NEUTRAL;
    return this.cells[this.index(col, row)];
  }

  ownerAtCell(col: number, row: number): number {
    if (!this.inBounds(col, row)) return NEUTRAL;
    return this.cells[this.index(col, row)];
  }

  setOwnerAtCell(col: number, row: number, owner: number) {
    if (!this.inBounds(col, row)) return;
    this.cells[this.index(col, row)] = owner;
  }

  /** Stamp a filled disc of ownership centered at world point p (used for starting territory). */
  stampCircle(center: Vec2, radius: number, owner: number) {
    const minCol = Math.max(0, Math.floor((center.x - radius - this.originX) / this.cellSize));
    const maxCol = Math.min(
      this.cols - 1,
      Math.ceil((center.x + radius - this.originX) / this.cellSize)
    );
    const minRow = Math.max(0, Math.floor((center.y - radius - this.originY) / this.cellSize));
    const maxRow = Math.min(
      this.rows - 1,
      Math.ceil((center.y + radius - this.originY) / this.cellSize)
    );
    const r2 = radius * radius;
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const c = this.cellCenter(col, row);
        const dx = c.x - center.x;
        const dy = c.y - center.y;
        if (dx * dx + dy * dy <= r2 && this.isInsideWorldCircle(col, row)) {
          this.setOwnerAtCell(col, row, owner);
        }
      }
    }
  }

  /** Set every cell currently owned by `owner` to neutral (used on elimination). */
  clearOwner(owner: number) {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === owner) this.cells[i] = NEUTRAL;
    }
  }

  /** Replace all occurrences of one owner id with another (unused normally, kept for completeness). */
  reassignOwner(from: number, to: number) {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === from) this.cells[i] = to;
    }
  }

  ownedCellCount(owner: number): number {
    let count = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === owner) count++;
    }
    return count;
  }

  ownershipFraction(owner: number): number {
    if (this.totalPlayableCells === 0) return 0;
    return this.ownedCellCount(owner) / this.totalPlayableCells;
  }

  get totalCells(): number {
    return this.totalPlayableCells;
  }

  /** Rasterize a thick polyline as "wall" cells into a boolean buffer. */
  private rasterizeTrail(trail: Vec2[], halfWidth: number, out: Uint8Array) {
    if (trail.length === 0) return;
    const stampSeg = (a: Vec2, b: Vec2) => {
      const minCol = Math.max(
        0,
        Math.floor((Math.min(a.x, b.x) - halfWidth - this.originX) / this.cellSize)
      );
      const maxCol = Math.min(
        this.cols - 1,
        Math.ceil((Math.max(a.x, b.x) + halfWidth - this.originX) / this.cellSize)
      );
      const minRow = Math.max(
        0,
        Math.floor((Math.min(a.y, b.y) - halfWidth - this.originY) / this.cellSize)
      );
      const maxRow = Math.min(
        this.rows - 1,
        Math.ceil((Math.max(a.y, b.y) + halfWidth - this.originY) / this.cellSize)
      );
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lenSq = abx * abx + aby * aby || 1;
      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const c = this.cellCenter(col, row);
          let t = ((c.x - a.x) * abx + (c.y - a.y) * aby) / lenSq;
          t = Math.max(0, Math.min(1, t));
          const px = a.x + abx * t;
          const py = a.y + aby * t;
          const dx = c.x - px;
          const dy = c.y - py;
          if (dx * dx + dy * dy <= halfWidth * halfWidth) {
            out[this.index(col, row)] = 1;
          }
        }
      }
    };
    for (let i = 0; i < trail.length - 1; i++) {
      stampSeg(trail[i], trail[i + 1]);
    }
    if (trail.length === 1) {
      const { col, row } = this.worldToCell(trail[0]);
      if (this.inBounds(col, row)) out[this.index(col, row)] = 1;
    }
  }

  /**
   * Attempt to capture territory for `owner` based on the trail they just
   * closed by reconnecting to their own territory.
   *
   * Returns the set of cells that changed ownership (for incremental
   * rendering) and the captured area as a fraction of total world area.
   * If the capture is below the minimum threshold, no changes are made.
   */
  captureFromTrail(
    owner: number,
    trail: Vec2[],
    trailHalfWidth: number = this.cellSize * 0.75
  ): { changedCells: Array<{ col: number; row: number; from: number }>; capturedFraction: number } {
    const wall = new Uint8Array(this.cols * this.rows);

    // Existing territory of the owner is also a "wall" for flood-fill purposes,
    // since the trail's endpoints attach to it, closing the loop.
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === owner) wall[i] = 1;
    }
    this.rasterizeTrail(trail, trailHalfWidth, wall);

    // Multi-source BFS flood fill from the grid border (and anything outside
    // the world circle) through non-wall cells.
    const outside = new Uint8Array(this.cols * this.rows);
    const queue = new Int32Array(this.cols * this.rows);
    let qHead = 0;
    let qTail = 0;

    const tryPush = (col: number, row: number) => {
      if (!this.inBounds(col, row)) return;
      const idx = this.index(col, row);
      if (outside[idx] || wall[idx]) return;
      outside[idx] = 1;
      queue[qTail++] = idx;
    };

    for (let col = 0; col < this.cols; col++) {
      tryPush(col, 0);
      tryPush(col, this.rows - 1);
    }
    for (let row = 0; row < this.rows; row++) {
      tryPush(0, row);
      tryPush(this.cols - 1, row);
    }
    // Also seed every cell outside the playable circle, so the boundary of
    // the circle doesn't get mistaken for an enclosed pocket.
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (!this.isInsideWorldCircle(col, row)) {
          const idx = this.index(col, row);
          if (!outside[idx] && !wall[idx]) {
            outside[idx] = 1;
            queue[qTail++] = idx;
          }
        }
      }
    }

    while (qHead < qTail) {
      const idx = queue[qHead++];
      const row = Math.floor(idx / this.cols);
      const col = idx - row * this.cols;
      tryPush(col - 1, row);
      tryPush(col + 1, row);
      tryPush(col, row - 1);
      tryPush(col, row + 1);
    }

    // Enclosed cells: inside the world circle, not outside-flood-reached.
    // Only cells NOT already owned by `owner` represent newly captured
    // area -- the minimum-capture threshold is measured against that new
    // area alone, not the player's pre-existing territory (which is also
    // part of the enclosed/wall region by construction).
    const changedCells: Array<{ col: number; row: number; from: number }> = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (!this.isInsideWorldCircle(col, row)) continue;
        const idx = this.index(col, row);
        if (outside[idx]) continue;
        if (this.cells[idx] !== owner) {
          changedCells.push({ col, row, from: this.cells[idx] });
        }
      }
    }

    const capturedFraction = changedCells.length / this.totalPlayableCells;
    if (capturedFraction < TERRITORY.MIN_CAPTURE_FRACTION || changedCells.length === 0) {
      return { changedCells: [], capturedFraction: 0 };
    }

    for (const c of changedCells) {
      this.cells[this.index(c.col, c.row)] = owner;
    }

    return { changedCells, capturedFraction };
  }

  /** Check whether a world point falls within `owner`'s territory. */
  isOwnedBy(p: Vec2, owner: number): boolean {
    return this.ownerAt(p) === owner;
  }

  /** Snapshot the full grid (used by renderer/minimap). */
  getCellsView(): Uint8Array {
    return this.cells;
  }
}
