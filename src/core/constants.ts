/**
 * WildGround - Central Game Constants
 *
 * Every important tunable value lives here. Change gameplay feel,
 * world size, AI timing, colors, etc. from this single file.
 */

export const WORLD = {
  /** Radius of the circular playable world, in world units. */
  RADIUS: 3200,
};

export const PLAYER = {
  /** Constant forward movement speed, world units / second. */
  SPEED: 220,
  /** Max turn rate, radians / second. Limits how fast heading can change. */
  TURN_RATE: 3.2,
  /** Radius of the player's body (used for rendering + body collision). */
  COLLISION_RADIUS: 14,
  /** Half-width of the trail ribbon. */
  TRAIL_WIDTH: 10,
  /** Minimum distance between trail sample points (world units). */
  TRAIL_SAMPLE_SPACING: 6,
  /** Fraction (0-1) of total world area a player starts with. */
  STARTING_TERRITORY_FRACTION: 0.0015,
  /** Approx radius of the starting circular territory, derived from area. */
  get STARTING_TERRITORY_RADIUS() {
    const worldArea = Math.PI * WORLD.RADIUS * WORLD.RADIUS;
    const startArea = worldArea * PLAYER.STARTING_TERRITORY_FRACTION;
    return Math.sqrt(startArea / Math.PI);
  },
};

export const TERRITORY = {
  /** Minimum valid capture, as a fraction of total world area. */
  MIN_CAPTURE_FRACTION: 0.00005, // 0.005%
  /** Resolution of the raster ownership grid (world units per cell). Smaller
   * = smoother-looking territory edges, at the cost of more cells to scan
   * during capture/rebuild operations (still cheap since those only run on
   * capture/elimination events, not every frame). */
  GRID_CELL_SIZE: 8,
};

export const MATCH = {
  MAX_PLAYERS: 7,
  PLAY_MODE_BOT_OPTIONS: [1, 2, 3, 4, 5, 6],
  WATCH_MODE_BOT_OPTIONS: [2, 3, 4],
  MIN_SPAWN_SEPARATION_FACTOR: 3.2, // multiple of starting territory radius
  BOUNDARY_SPAWN_MARGIN_FACTOR: 4,
};

export const AI = {
  /** How often (ms) bots re-evaluate their high level decision/state. */
  DECISION_INTERVAL_MS: 220,
  /** How often (ms) bots re-evaluate fine steering target. */
  STEERING_INTERVAL_MS: 90,
  /** Distance at which a bot begins to consider an enemy "nearby". */
  AWARENESS_RADIUS: 520,
  /** Distance at which a threat to the bot's own trail is urgent. */
  THREAT_RADIUS: 260,
  /** Chance per decision tick [0-1] that noise perturbs the bot's target heading. */
  MISTAKE_CHANCE: 0.08,
  /** Max random heading noise, radians. */
  MISTAKE_HEADING_NOISE: 0.5,
  /** Max distance a bot will roam from its own territory before forcing return. */
  MAX_EXCURSION_DISTANCE: 900,
};

export const CAMERA = {
  /** How quickly the camera eases toward the target position (higher = snappier). */
  SMOOTHING: 4.5,
  MIN_ZOOM: 0.55,
  MAX_ZOOM: 1.6,
  DEFAULT_ZOOM: 1.0,
  ZOOM_SMOOTHING: 5,
};

export const SIMULATION_SPEEDS = [0.5, 1, 2, 4] as const;

export const MINIMAP = {
  SIZE_PX: 168,
  MARGIN_PX: 16,
};

export const COLORS = {
  HUMAN: '#141414',
  BOT_PALETTE: ['#e6483c', '#3ec46d', '#3b82f6', '#a855f7', '#f59e0b', '#14b8a6', '#64748b'],
  NEUTRAL_FILL: '#eef2f5',
  BACKGROUND: '#f7f9fb',
  BOUNDARY_OUTER: '#38bdf8',
  BOUNDARY_SHADOW: '#94a3b8',
};

export const PLAYER_NAMES = {
  BOT_PREFIX: 'WILD-',
  HUMAN: 'PLAYER',
};
