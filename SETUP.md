# SETUP.md - WildGround

A detailed guide to installing, running, testing, and modifying WildGround.

## 1. Required Software

- **Node.js** 22.12+
- **npm** (ships with Node)
- A modern desktop browser: **Chrome** or **Firefox**

Ordinary play runs locally without accounts or API keys. Optional WG skins use wallet authentication and a Solana RPC read; see `docs/token-access.md`.

## 2. Installation

```bash
cd wildground
npm ci
```

This installs Vite, TypeScript, Vitest and the runtime wallet/address packages.

## 3. Development Server

```bash
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`). Open it in Chrome or Firefox. The dev server supports hot-reload -- most edits appear instantly without a full page refresh.

## 4. Production Build

```bash
npm run build
```

Type-checks the project (`tsc`) and produces an optimized static bundle in `dist/`. To preview the production build locally:

```bash
npm run preview
```

Since the game is 100% client-side, `dist/` can be hosted on any static file host (or opened directly, though a local server is recommended for correct MIME types).

## 5. Testing

```bash
npm test
```

Runs the Vitest suite (`src/test/*.test.ts`) covering boundary clamping, steering, trails, collisions, territory capture (including the 0.005% minimum), elimination, win conditions, brain registration, match setup and WG balance verification.

Add new tests alongside the existing ones in `src/test/`. Pure logic (in `src/core/` and `src/ai/`) is written to be testable without a DOM or canvas, so prefer testing at that level.

## 6. Project Structure & Important Files

```
src/core/constants.ts       <- ALL tunable game constants live here
src/core/math.ts            <- vector/geometry helpers (steering, segment distance, etc.)
src/core/player.ts          <- Player entity (position, heading, trail, kills, etc.)
src/core/territoryGrid.ts   <- raster ownership grid + flood-fill capture algorithm
src/core/simulation.ts      <- Match class: movement, trail state, collisions, capture,
                                elimination, win conditions (the authoritative sim step)
src/core/spawn.ts           <- spawn point placement (boundary/separation rules)
src/core/matchFactory.ts    <- builds a Match: players, colors, starting territory

src/ai/perception.ts        <- bounded "what can this bot see" snapshot (used by rule-based brains)
src/ai/botAI.ts             <- BotAIManager: instantiates + updates each bot's assigned brain

src/brains/types.ts               <- the BotBrain interface every brain implements
src/brains/registry.ts             <- the single list of all 6 selectable brains
src/brains/shared-sensors/          <- bounded SensorFrame builder shared by custom-ai/ and fly-brain/
src/brains/rule-based/              <- the 4 built-in personality bots (one shared implementation)
src/brains/custom-ai/               <- TEMPLATE: plug your trained model in here
src/brains/fly-brain/               <- TEMPLATE: plug a Drosophila connectome model in here
  connectome/                        <- LIF neuron stub, connectome-network stub, data/ (gitignored)

src/input/humanInput.ts     <- WASD / arrow / mouse / touch input for the human player

src/render/camera.ts               <- smooth follow camera + zoom
src/render/sceneRenderer.ts        <- background, world boundary, trails, player blocks
src/render/territoryRenderer.ts    <- baked/smoothed raster blit of the ownership grid
src/render/minimap.ts              <- fixed-corner overview map
src/render/particles.ts            <- restrained capture/elimination particle bursts

src/ui/hud.ts               <- leaderboard, debug panel, results screen rendering
src/ui/sliderControl.ts     <- small reusable button-group "slider" control
src/ui/brainSelector.ts     <- per-bot-slot brain dropdown rows (used in Settings)

src/main.ts                 <- app entry point: game loop, menu wiring, mode orchestration
src/style.css                <- all UI styling
index.html                   <- page shell containing every menu/HUD/debug DOM node
```

## 7. How to Modify the Bot AI / Add New Brains

The bot AI is a **pluggable brain system**, isolated from the rest of the game so you can add, remove, or completely rewrite a bot's "mind" without touching simulation, rendering, camera, minimap, or UI code.

- **`src/brains/types.ts`** defines the entire contract: a `BotBrain` has an `update(dt, match, player)` method that must set `player.desiredHeading`, and an optional `getDebugInfo()` for the debug panel. That's it -- nothing else in the game cares how a brain arrives at its heading.
- **`src/brains/registry.ts`** is the single list of every selectable brain (currently 6: 4 rule-based personalities + 2 templates). This is the *only* file you need to touch to add a new brain to the Settings dropdowns -- add an entry with a unique `id`, a `label`/`description` for the UI, a `category`, and a `create(player)` factory.
- **`src/ai/botAI.ts`** (`BotAIManager`) instantiates one brain per bot from the registry (based on the per-slot selection made in Settings) and calls `update()` on each every simulation frame. It has no brain-specific logic in it.
- **`src/brains/rule-based/`** holds the 4 built-in non-ML personalities (Balanced/Aggressive/Cautious/Opportunist) -- one shared state-machine implementation (`ruleBasedBrain.ts`) parametrized by `personalities.ts`. Perception (bounded, "what could this bot plausibly see") lives in `src/ai/perception.ts` and is reused by the rule-based brain.
- **`src/brains/custom-ai/`** and **`src/brains/fly-brain/`** are empty/template brains for your own trained AI and a Drosophila connectome model respectively -- see section 16 below for details on each.
- **`src/brains/shared-sensors/sensorFrame.ts`** is a small, bounded "sensor snapshot" builder shared by the two template brains, meant to evolve into the richer biologically-motivated sensory interface described in the project's research notes without needing to touch either brain's file when you do.

To add a brand new brain type: implement `BotBrain` in a new file (anywhere under `src/brains/`), add one entry to `BRAIN_REGISTRY` in `registry.ts`, and it will automatically show up as a selectable option in Settings for both PLAY and WATCH AI -- no other file needs to change.

## 8. How to Change Game Constants

Open **`src/core/constants.ts`**. Every tunable value is centralized there, grouped by system:

| Group | What it controls |
| --- | --- |
| `WORLD` | World radius |
| `PLAYER` | Speed, turn rate, collision radius, trail width, starting territory size |
| `TERRITORY` | Minimum capture threshold, grid cell resolution (default `8` world units/cell) |
| `MATCH` | Max players, bot-count options per mode, spawn separation |
| `AI` | Decision/steering cadence, awareness/threat radii, mistake chance, max excursion distance |
| `CAMERA` | Follow smoothing, zoom range/defaults (PLAY mode's fixed zoom uses `CAMERA.MIN_ZOOM`; see `main.ts`) |
| `SIMULATION_SPEEDS` | Available WATCH AI simulation speed multipliers |
| `MINIMAP` | Size/margin |
| `COLORS` | Human color, bot palette, neutral/background/boundary colors |
| `PLAYER_NAMES` | Bot name prefix, human label |

Changes here take effect immediately in dev mode (hot reload).

## 9. How to Change World Size

Edit `WORLD.RADIUS` in `constants.ts`. The territory grid, spawn placement, and camera all derive from this value automatically. Larger worlds increase the grid cell count (`cols x rows`), which slightly increases the cost of `TerritoryGrid.rebuild()`-style operations (full grid scans happen only on capture/elimination events, not every frame, so this scales gracefully for reasonable world sizes).

## 9a. How PLAY and WATCH AI's Zoom/Speed Are Kept Independent

`src/main.ts` (`GameApp`) tracks WATCH AI's zoom and simulation speed separately from PLAY's:

- `this.watchZoom` / `this.watchSimSpeed` store whatever the spectator controls are currently set to, and are only ever applied to the camera/simulation while `playKind === 'watch'`.
- `startMatch()` hard-sets PLAY's camera to `CAMERA.MIN_ZOOM` and simulation speed to `2` every time a PLAY match starts, regardless of what WATCH AI was last set to.
- If you want to change PLAY's fixed zoom/speed, edit the two lines inside the `if (kind === 'play') { ... }` block in `startMatch()`. If you want PLAY to also be adjustable by the player, you'd need to add its own UI controls (the existing `#watch-controls` panel is intentionally WATCH-AI-only).

## 9b. How Territory Rendering Gets Its Smooth Edges

`src/render/territoryRenderer.ts` maintains two offscreen canvases:

1. `rawCanvas` -- one pixel per grid cell, hard-edged, matching `TerritoryGrid` exactly.
2. `bakedCanvas` -- a 2x supersampled version of `rawCanvas` with a blur baked in (`BAKE_BLUR_PX`), plus a second unblurred pass at reduced opacity layered on top so colors don't wash out near territory centers.

`rebuild()` (which regenerates both canvases) only runs when territory actually changes -- on `capture` and `elimination` events -- not every frame. The per-frame `draw()` call just blits the already-smooth `bakedCanvas`, which keeps rendering cheap even though the visual smoothing itself would be expensive to redo 60 times a second.

To make territory edges even softer, increase `BAKE_BLUR_PX` or `SUPERSAMPLE` at the top of `territoryRenderer.ts` (higher `SUPERSAMPLE` costs more memory/CPU per rebuild, not per frame). To make edges crisper/more retro, lower `BAKE_BLUR_PX` toward `0`.

## 10. How to Change Player Speed / Turn Rate

- `PLAYER.SPEED` -- constant forward movement speed (world units/second).
- `PLAYER.TURN_RATE` -- max heading change per second (radians). Lower values = wider, slower turns (more Paper.io-like momentum); higher values = snappier steering.

## 11. How to Change Colors

Edit `COLORS` in `constants.ts`:
- `COLORS.HUMAN` -- default Classic appearance. Animal skins override it with colors from `src/core/skins.ts`.
- `COLORS.BOT_PALETTE` -- an array; bots are assigned colors from this list in order. Add more entries if you increase `MATCH.MAX_PLAYERS`.
- `COLORS.NEUTRAL_FILL`, `COLORS.BACKGROUND`, `COLORS.BOUNDARY_OUTER`, `COLORS.BOUNDARY_SHADOW` -- world/UI colors.

Territory and trail rendering both pull directly from `player.color`, so a color change here updates everything (HUD, minimap, world) automatically.

## 12. How to Change the Capture Threshold

Edit `TERRITORY.MIN_CAPTURE_FRACTION` in `constants.ts` (default `0.00005` = 0.005% of world area). Captures below this size are ignored.

## 13. How to Change Bot Count / Limits

- `MATCH.PLAY_MODE_BOT_OPTIONS` -- selectable bot counts for PLAY (default `[1, 2, 3, 4, 5, 6]`).
- `MATCH.WATCH_MODE_BOT_OPTIONS` -- selectable bot counts for WATCH AI (default `[2, 3, 4]`).
- `MATCH.MAX_PLAYERS` -- hard cap (default `7`, one human plus six bots).

If you raise these, also add more entries to `COLORS.BOT_PALETTE` and update the corresponding button rows in `index.html` (`#play-bot-slider`, `#watch-bot-slider`, `#settings-play-slider`, `#settings-watch-slider`) plus the `data-value` buttons inside them.

## 13a. How the Per-Slot Brain Selector UI Works

In Settings, PLAY and WATCH AI each get their own row of "Bot N: [brain dropdown]" selectors, rendered by `src/ui/brainSelector.ts` (`renderBrainSelectors`). Key points if you're modifying this:

- `GameApp` (in `main.ts`) keeps two arrays, `playBotBrainIds` and `watchBotBrainIds`, holding the selected brain id for each bot slot. They default to the four rule-based personalities (`DEFAULT_BOT_BRAINS`, derived from `BRAIN_REGISTRY`).
- These arrays are always kept at full length regardless of the current bot-count slider, so a slot's selection is preserved if you move the slider down and back up.
- `setPlayBotCount()` / `setWatchBotCount()` keep both copies of each mode's bot-count slider (the setup screen's and Settings') in sync, and re-render that mode's brain selector rows to match the new count.
- `startMatch()` builds a `Map<playerId, brainId>` from the relevant array (sliced to the actual bot count) and passes it to `new BotAIManager(match, brainAssignment)`.
- If a brain id in the assignment doesn't match any registry entry, `BotAIManager` falls back to `DEFAULT_BRAIN_ID` (Balanced) rather than crashing -- so registry changes/typos degrade gracefully.

## 14. How to Enable / Debug the AI

Press **`H`** during any match to toggle the debug panel. It shows, per bot: **which brain it's running** (e.g. "Aggressive" or "Fly Brain (connectome)"), current state, territory %, kill count, position, heading, distance from home, nearest enemy + distance, threat level, and current intent -- sourced from `BotAIManager.getBrainId()` / `getDebugInfo()`, which delegate to whatever brain is assigned to that bot.

For deeper debugging, add fields to `BotBrainDebugInfo` in `src/brains/types.ts` and surface them in `src/ui/hud.ts` (`renderDebugPanel`). Any brain can populate as much or as little of `BotBrainDebugInfo` as it wants -- all fields except `state`/`currentIntent` are optional.

## 15. Common Troubleshooting

**Blank white screen / nothing renders**
Check the browser console for errors. Make sure `npm install` completed without errors and that you're viewing the dev server URL Vite printed (not a `file://` path).

**Game feels slow / low FPS**
Confirm you're running a production build (`npm run build && npm run preview`) rather than the unminified dev server for performance testing. Also check `WORLD.RADIUS` and `TERRITORY.GRID_CELL_SIZE` haven't been set to values that make the grid excessively large (smaller cell size = more cells = more work per capture event).

**Bots seem to stand still or spin**
This usually means `player.desiredHeading` isn't being updated -- check that `BotAIManager.update()` is being called each frame in `main.ts` and that your custom AI code (if modified) is still writing to `desiredHeading`.

**Tests fail after changing constants**
Some tests construct scenarios using specific coordinates relative to default constants (e.g., starting territory radius, world radius). If you change `WORLD.RADIUS` or `PLAYER.STARTING_TERRITORY_FRACTION` significantly, review `src/test/*.test.ts` for hardcoded distances that may need adjusting.

**TypeScript build errors after edits**
Run `npm run build` locally to see the exact `tsc` error with file/line. The project uses strict-ish settings (`noUnusedLocals`, `noUnusedParameters`) -- remove unused variables/imports rather than suppressing.

**Human controls feel unresponsive**
Mouse/touch steering aims relative to the player's on-screen position (roughly canvas center, since the camera follows the player). If you've changed camera smoothing (`CAMERA.SMOOTHING`) to be very slow, the player's screen position may lag from center, making pointer aiming feel off -- lower the smoothing value or account for camera lag in `src/input/humanInput.ts`.

**Territory edges look too soft/blurry, or too jagged**
See section 9b above -- adjust `BAKE_BLUR_PX` and `SUPERSAMPLE` in `src/render/territoryRenderer.ts`. Also confirm `TERRITORY.GRID_CELL_SIZE` (in `constants.ts`) wasn't set very large, which makes the underlying raster coarser before any blurring happens.

**PLAY mode's zoom or speed changed unexpectedly**
PLAY's zoom/speed are intentionally hard-set at the start of every PLAY match (see section 9a) and are not meant to inherit whatever WATCH AI was last configured to. If they seem to be leaking between modes after a code change, check that your edit didn't move logic outside the `if (kind === 'play')` branch in `GameApp.startMatch()`.

**A bot behaves exactly the same regardless of which brain I pick in Settings**
Confirm `startMatch()` is actually building the `brainAssignment` map from the array matching the mode you started (`playBotBrainIds` for PLAY, `watchBotBrainIds` for WATCH AI), and that the dropdown's `change` handler in `src/ui/brainSelector.ts` is writing to the same array instance `main.ts` reads from. Also check the debug panel (`H`) -- it shows each bot's actual assigned brain id/label, which is the fastest way to confirm the assignment took effect.

**I added a new brain to the registry but it's not showing up in Settings**
`renderBrainSelectors()` reads directly from `BRAIN_REGISTRY`, so a new entry should appear automatically the next time the selector rows re-render (e.g. reopen Settings, or move the relevant bot-count slider). If it still doesn't appear, double-check the new entry's `id` is unique and that `BRAIN_REGISTRY` is actually exported from `src/brains/registry.ts` (a typo'd import elsewhere won't cause a build error since the array is still valid TypeScript, just silently empty of your entry if you edited a copy instead of the real file).

## 16. Building Out the Custom AI Template

`src/brains/custom-ai/` is an empty template for your own trained model, wired into the game end-to-end already (registry entry `"custom-ai"`, selectable in Settings, updates every simulation frame, shows up in the debug panel) but currently just makes the bot wander gently.

Read `src/brains/custom-ai/README.md` and the comment block at the top of `CustomAIBrain.ts` for the full walkthrough. Short version:

1. Design your model's input representation, starting from `SensorFrame` (`src/brains/shared-sensors/sensorFrame.ts`) and extending it as needed.
2. Design your action space and how it maps to a heading (`player.desiredHeading`).
3. Train offline. `src/core/simulation.ts`'s `Match` class has no rendering or DOM dependency, so it can run headless (e.g. in a Node script or a training harness) for fast self-play against the rule-based brains already in this game.
4. Get your trained model running client-side (ONNX via onnxruntime-web is a common route, or a hand-rolled forward pass in TypeScript).
5. Load it in `CustomAIBrain`'s constructor (or lazily on first `update()`), and replace the placeholder wander logic in `update()` with real inference.
6. Optional: register multiple checkpoints as separate, individually selectable entries in `registry.ts` (e.g. `"custom-ai-v1"`, `"custom-ai-v2"`) so you can compare them head-to-head in WATCH AI.

## 17. Building Out the Fly Brain Template

`src/brains/fly-brain/` is an empty template for a Drosophila connectome-based model, also wired in end-to-end (registry entry `"fly-brain"`) but currently a placeholder.

Read `src/brains/fly-brain/connectome/README.md` and the comment blocks at the top of `FlyBrain.ts`, `connectome/connectomeModel.ts`, and `connectome/neuronModel.ts`. Short version:

1. `connectome/neuronModel.ts` already has a working, minimal leaky-integrate-and-fire (LIF) neuron implementation (`LIFNeuron`) -- not yet wired to any real connectivity.
2. `connectome/connectomeModel.ts` is where the network lives: load connectivity data, build one `LIFNeuron` per neuron you're modeling, encode `SensorFrame` data into sensory input, step the dynamics forward, and decode motor output into a heading.
3. Start with a small, curated sub-circuit (e.g. visual motion pathways + central complex navigation neurons + a handful of descending neurons) rather than the full ~139k-neuron connectome.
4. Put exported/preprocessed connectome data under `src/brains/fly-brain/connectome/data/` -- this path is already gitignored so large raw exports don't end up in source control.
5. Wire `ConnectomeModel` into `FlyBrain.update()` (see the TODO comments there), replacing the placeholder wander logic once `decodeMotorOutput()` returns something real.
