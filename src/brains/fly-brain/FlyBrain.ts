import type { Player } from '../../core/player';
import type { Match } from '../../core/simulation';
import type { BotBrain, BotBrainDebugInfo } from '../types';
import { buildSensorFrame, type SensorFrame } from '../shared-sensors/sensorFrame';
import { ConnectomeModel } from './connectome/connectomeModel';

/**
 * ============================================================================
 *  TEMPLATE: Drosophila connectome-based brain goes here.
 * ============================================================================
 *
 * This is a placeholder implementation of the "biological brain" side of
 * the project (Phase 3 in the write-up): an agent whose behavior is
 * eventually driven by a computational model of the real adult Drosophila
 * connectome (e.g. FlyWire/FAFB), rather than a trained policy or hand
 * written rules.
 *
 * Right now this brain does NOT simulate any real neurons -- it runs a
 * clearly-labeled placeholder (slow, cautious wandering) so it's safe to
 * select in Settings today. See `connectome/` for where the real model
 * takes shape.
 *
 * WHERE TO PLUG IN THE REAL MODEL
 * ----------------------------------------------------------------------------
 * 1. `connectome/connectomeModel.ts` is a stub for holding
 *    connectivity + neuron dynamics (see that file for the intended shape:
 *    something like leaky-integrate-and-fire neurons wired according to
 *    real synaptic connectivity, per the 2024 whole-brain model referenced
 *    in the project write-up).
 * 2. `connectome/README.md` explains where to put exported connectome data
 *    (e.g. a trimmed/preprocessed subset of FlyWire's proofread neuron and
 *    synapse tables) once you have it.
 * 3. This file's `update()` builds a `SensorFrame` (same shared type used
 *    by `custom-ai/CustomAIBrain.ts`) each frame, is meant to encode it
 *    into the model's sensory/photoreceptor-analog input, step the neural
 *    dynamics forward, decode a motor output, and set
 *    `player.desiredHeading` from it.
 * 4. Because both brains share `SensorFrame`, you can keep the AI and the
 *    fly's *input* directly comparable (per the project's "shared sensory
 *    interface" design goal) while their internal computation is
 *    completely different -- that comparison is the actual experiment.
 *
 * This brain is registered in src/brains/registry.ts as `"fly-brain"` and
 * is selectable from Settings today (PLAY and WATCH AI), running the
 * placeholder wander behavior until the real connectome model lands.
 * ============================================================================
 */
export class FlyBrain implements BotBrain {
  readonly brainId = 'fly-brain';

  private player: Player;
  private sensorFrame: SensorFrame | null = null;
  private model: ConnectomeModel;
  private wanderTimer = 0;
  private wanderTarget = 0;

  constructor(player: Player) {
    this.player = player;
    this.wanderTarget = player.heading;
    // Stub construction only -- see connectome/connectomeModel.ts. Does not
    // load or simulate any real connectome data yet.
    this.model = new ConnectomeModel();
  }

  update(dt: number, match: Match): void {
    if (!this.player.alive) return;

    this.sensorFrame = buildSensorFrame(this.player, match, dt);

    // TODO: replace with real connectome-driven behavior, e.g.:
    //
    //   this.model.encodeSensoryInput(this.sensorFrame);
    //   this.model.step(dt);
    //   const motor = this.model.decodeMotorOutput();
    //   this.player.desiredHeading = motor.heading;
    //
    // Until the model is implemented, `ConnectomeModel` is an inert stub
    // (see connectome/connectomeModel.ts) and this brain just wanders
    // cautiously so it's obviously a placeholder, not a real result.
    this.model.step(dt);

    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTarget = this.player.heading + (Math.random() - 0.5) * 0.9;
      this.wanderTimer = 1.6 + Math.random() * 1.4;
    }
    this.player.desiredHeading = this.wanderTarget;
  }

  getDebugInfo(): BotBrainDebugInfo {
    return {
      state: 'PLACEHOLDER',
      currentIntent: 'Wandering (no connectome model loaded yet)',
      nearestEnemyDistance: this.sensorFrame?.nearestEnemyDistance ?? null,
      threatLevel: 'none',
    };
  }
}
