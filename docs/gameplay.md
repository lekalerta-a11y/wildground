# WildGround

A minimal, polished, Paper.io-style territory-capture arcade game built for the browser. Designed primarily as an **AI-vs-AI spectator game**, with a fully playable human mode as well.

## Overview

Players (human or bot) move continuously through a large circular world. Leaving your territory draws a trail behind you; reconnecting to your territory encloses and captures the area you swept through. Get your trail cut by an enemy and you're eliminated. Capture 100% of the world, or be the last one standing, to win.

The AI is intentionally simple: a non-ML, rule-based state machine that expands territory, defends itself, and opportunistically attacks exposed enemy trails. It's built to be easy to read and replace.

## Features

- Continuous, free-angle Paper.io-style movement with smooth turn-rate steering (no instant reversals)
- Large circular world, larger than the viewport, with a smooth-following camera
- Raster (grid-based) territory system with baked, anti-aliased edges (supersampled + blurred once per capture event) for smooth, organic-looking territory blobs instead of jagged pixel steps
- **Pluggable bot "brain" system** -- 6 selectable brains per bot slot (4 rule-based personalities, plus template slots for your own trained AI and a Drosophila connectome model), chosen per-slot in Settings for both PLAY and WATCH AI. See "Bot Brains" below.
- PLAY mode (you + up to 6 bots) and WATCH AI mode (2-4 bots, no human)
- Animal emoji skins with matching territory/trail colors and territory filled with repeating animal emoji, selected through SKINS under PLAY and remembered in the browser
- PLAY and WATCH AI have independent camera zoom / simulation speed -- PLAY always runs at a fixed, standard zoom and pace, unaffected by whatever the spectator controls were last set to in WATCH AI
- Live HUD leaderboard (territory % + kills), fixed-corner minimap, pause, restart, game-over screen
- Spectator tools for WATCH AI: bot-follow switching (auto-updates if the followed bot dies), zoom, and 0.5x/1x/2x/4x simulation speed
- Optional debug panel (press `H`) showing each bot's assigned brain, internal state, targets, and threat assessment
- Restrained particle feedback on capture/elimination -- no screen shake, no clutter
- Lightweight test suite covering the game-critical rules and the brain plugin system

## Game Rules

- **Territory**: Every player starts with ~0.15% of the world. Moving through your own or neutral territory is always safe.
- **Trails**: Leaving your territory draws a trail. The trail is exposed -- if an enemy's head touches it, **you** die (not them). Your own trail is always harmless to you.
- **Capture**: Reconnecting your trail to your territory encloses and claims that area, including any neutral or enemy territory inside the loop. Captures smaller than 0.005% of the world are ignored.
- **Capture kills**: If an enemy is physically standing inside the region you just captured, they die.
- **Body collision**: Two players bumping into each other just bounce apart -- no damage, no death.
- **Elimination**: Death is permanent for the match. Your territory reverts to neutral immediately (nobody inherits it).
- **Win**: Own 100% of the world, or be the last player alive.

## Controls

| Action | Input |
| --- | --- |
| Move | `WASD`, Arrow keys, or Mouse/Touch (aim direction) |
| Pause / Resume | `Esc` |
| Toggle debug panel | `H` |

## Game Modes

- **PLAY** -- You vs. 1-6 bots. Runs at a fixed standard zoom and pace, independent of any WATCH AI spectator settings.
- **SKINS** -- Requires at least 100,000 WG on Solana (mint `3hZ7a3r5ghQPnceqyjj4KTKi3yneWeKMmSTsqxX4idos`). Connect and sign a wallet login message to prove ownership through iDosGames. The browser derives the wallet's standard associated token account (ATA) with the official Solana addresses package and reads it with `getAccountInfo` through PublicNode RPC. No CloudCode HTTP, token transfers or paid indexer are required. This counts the standard WG account used by wallets, rather than extra/custom token accounts; the screen makes that scope explicit. Inside idosgames.com the platform wallet bridge handles sign-in; standalone play supports Phantom. Balance refreshes on focus, every minute and before a PLAY match. Failures keep skins locked and allow retry. Ordinary play remains free. The earlier CloudCode checker in `server/` is retained as an unused alternative for plans with outbound HTTP.
- **WATCH AI** -- 2-4 bots, no human player. Switch which bot the camera follows, zoom, and change simulation speed (0.5x-4x). These settings are remembered between WATCH AI matches but never carry over into PLAY.
- **SETTINGS** -- Default bot counts for each mode, and which brain each bot slot uses (see "Bot Brains" below).

## Bot Brains

Each bot slot -- in both PLAY and WATCH AI -- can independently be assigned one of **6 brains** from Settings:

| Brain | Category | What it does |
| --- | --- | --- |
| Balanced | Rule-based | Even mix of expansion, defense, and opportunistic attacks (the "default" bot). |
| Aggressive | Rule-based | Hunts exposed enemy trails further and takes riskier excursions. |
| Cautious | Rule-based | Shorter excursions, quicker retreats, rarely takes the bait. |
| Opportunist | Rule-based | Prioritizes cutting enemy trails over pure territory expansion. |
| Your AI (custom) | Template | Placeholder slot for a trained model you plug in later. Currently just wanders gently. |
| Fly Brain (connectome) | Template | Placeholder slot for a Drosophila connectome-based model. Currently just wanders gently. |

The four rule-based brains all share one non-ML implementation (a state machine: `EXPANDING`, `RETURNING`, `ATTACKING`, `AVOIDING`), tuned into distinguishable personalities via parameters -- see `src/brains/rule-based/`.

The last two are intentionally **empty templates**, not functional AI, so you can build your own without ever touching the core game (physics, territory, collisions, rendering, UI). See `src/brains/custom-ai/README.md` and `src/brains/fly-brain/connectome/README.md` for exactly where to plug in a trained model or a connectome simulation. Selecting them today just gets you a clearly-labeled placeholder bot -- nothing pretends to be smarter than it is.

## Bot Behavior

Rule-based bots reason only about what they could plausibly "see" -- nearby players, nearby trails, their own territory, and the world boundary -- within a bounded awareness radius. No global omniscience.

Priority order per decision tick:
1. **Survival** -- if the bot's own exposed trail is under real threat, it either runs for home or dodges.
2. **Useful expansion** -- close a loop and bank territory rather than wandering forever (excursion cap).
3. **Opportunistic attacks** -- cut a nearby enemy's exposed trail if it's reachable and reasonably safe.
4. **Continued expansion** -- plan a new outward loop and go claim more space.

Small random noise is injected into steering decisions so bots don't all behave identically and occasionally make imperfect choices (late turns, slightly risky routes, missed attacks). The four rule-based personalities (Balanced/Aggressive/Cautious/Opportunist) tune these same priorities with different thresholds -- see `src/brains/rule-based/personalities.ts`.

The two template brains (custom AI, fly brain) don't implement any real strategy yet -- see "Bot Brains" above and `SETUP.md` for how to build them out.

## Technical Stack

- **TypeScript** + **Vite** (dev server / bundler)
- **HTML5 Canvas 2D** for all game rendering
- **Vitest** for unit tests
- Local match simulation without a database. Optional WG skin access uses iDosGames wallet authentication and Solana RPC; see [token access](token-access.md).

## Project Structure

```
src/core/         world/simulation logic: constants, math, Player, TerritoryGrid,
                  Match (movement/collision/capture/win-conditions), spawn logic
src/ai/           bot perception helpers + BotAIManager (assigns/updates each
                  bot's selected brain from the registry; no brain-specific
                  logic lives here)
src/brains/       pluggable bot "brain" system -- see "Bot Brains" above
  types.ts               shared BotBrain interface every brain implements
  registry.ts             the single list of all 6 selectable brains
  shared-sensors/          bounded SensorFrame builder, shared by custom-ai/ and fly-brain/
  rule-based/              the 4 built-in personality bots (one shared implementation)
  custom-ai/               TEMPLATE: plug your trained model in here
  fly-brain/               TEMPLATE: plug a Drosophila connectome model in here
    connectome/            LIF neuron stub + connectome-network stub + data/ (gitignored)
src/input/        human keyboard/mouse/touch input
src/render/       camera, scene rendering, territory raster renderer, minimap, particles
src/ui/           HUD, sliders, brain-selector dropdowns, menu wiring
src/test/         vitest unit tests for critical game rules and the brain registry
src/main.ts       app entry point: game loop, menus, mode/state orchestration
src/style.css     all UI styling
index.html        page shell + all menu/HUD/debug DOM
```

See `SETUP.md` for a deeper guide to modifying specific systems (bot AI, constants, colors, world size, etc), and for exactly how to build out the custom AI / fly brain templates.

## How to Run

```bash
npm install
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`) in Chrome or Firefox.

## How to Build

```bash
npm run build
```

Outputs a static production build to `dist/`. Preview it locally with:

```bash
npm run preview
```

## How to Test

```bash
npm test
```

Runs the Vitest suite covering: boundary clamping, smooth-turn steering, trail creation/self-trail safety, enemy-trail collision, body collision, territory capture (including the minimum-capture threshold and ownership transfer), capture-triggered elimination, win conditions, and the brain registry/plugin system (every registered brain instantiates and runs without throwing, `BotAIManager` assigns the right brain per bot slot).

## Possible Future Enhancements

WildGround is deliberately scoped to a simple, polished V1. If you want to extend it later, here are ideas that fit the existing architecture without requiring a rewrite -- roughly ordered from smallest to most involved.

**AI quality**
- Replace either template brain with a real implementation -- `src/brains/custom-ai/` for a trained model, `src/brains/fly-brain/` for a connectome simulation. Both are already wired into the registry, Settings UI, and debug panel; only the brain's own logic needs to change.
- Give rule-based bots basic memory of recently-seen enemies so they can anticipate rather than only react to the current frame's perception snapshot.
- Add a simple "territory value" heuristic so bots prefer expanding into open neutral space over repeatedly grinding the same corner.
- Vary excursion size based on current territory share (an underdog bot could take bigger risks; a leading bot could play safer).
- Add more rule-based personality presets in `src/brains/rule-based/personalities.ts` (one line + one registry entry each) for more varied WATCH AI matches.

**Gameplay depth (optional, off by default)**
- A "sudden death" shrinking boundary for very long matches, to guarantee matches converge (would need to stay optional given the "no round timers" rule for default play).
- Replay/recording of a WATCH AI match (position + event log) so an interesting match can be played back later -- fits cleanly on top of the existing deterministic step-based simulation.
- Basic match history in memory only (this session) -- e.g. a small "last 5 results" strip on the main menu, without any persistence/backend.

**Visual polish**
- Territory edge "ink" outline (a thin darker stroke along each region's boundary) for extra readability at low zoom, computed from the same ownership grid via simple edge-detection on the raster.
- Subtle idle animation on the main menu background (a slow ambient territory-capture demo running behind the menu using the existing WATCH AI simulation).
- A short, restrained capture "ripple" shader/gradient effect at the moment a large capture completes, scaled by capture size.

**Spectator / debugging tools**
- Multi-bot debug overlay lines drawn directly in the world (e.g. a faint line from a bot to its current target waypoint) toggled alongside the existing `H` debug panel, useful when tuning AI behavior.
- A simple FPS/step-time counter in the debug panel for performance tuning on lower-end machines.
- Keyboard shortcuts to directly select a specific bot to follow in WATCH AI (e.g. number keys), instead of only cycling with the arrows.

**Engineering**
- Web Worker offload for the territory grid's flood-fill capture pass if world size / player count is increased significantly beyond the current defaults.
- Export/import of `constants.ts` values as a JSON config file, so different rule presets can be swapped without touching code.

None of these are required for V1 and intentionally aren't implemented -- they're listed here as a roadmap for anyone extending the project, consistent with the "don't add mechanics unless requested" philosophy this build follows.

