import type { SensorFrame } from '../../shared-sensors/sensorFrame';
import { LIFNeuron, type LIFNeuronParams } from './neuronModel';

/**
 * TEMPLATE / STUB.
 *
 * Intended eventual shape (per the project write-up's Phase 3): a network
 * of neurons whose connectivity is derived from a real Drosophila
 * connectome dataset (e.g. FlyWire/FAFB), simulated with a simple spiking
 * neuron model (leaky integrate-and-fire is the usual starting point --
 * see `neuronModel.ts`), taking `SensorFrame` data in through a sensory
 * encoding layer and producing motor output through a decoding layer.
 *
 * NONE of that is implemented here yet. This class exists so the rest of
 * the codebase (FlyBrain.ts) has a stable, real TypeScript type to code
 * against while the actual model is built out, and so you have an obvious
 * place to start.
 *
 * Suggested build order (matches the project's Phase 3 breakdown):
 *   1. Load a connectivity table (neuron IDs + weighted directed edges)
 *      from `connectome/data/` (create that folder once you have real
 *      data -- keep large datasets out of source control; see README.md).
 *   2. Instantiate one LIFNeuron (see neuronModel.ts) per connectome
 *      neuron ID you care about (likely a curated subset at first, not
 *      all ~139k neurons -- e.g. visual system + central complex +
 *      a handful of descending neurons).
 *   3. Implement `encodeSensoryInput()`: map SensorFrame fields onto input
 *      currents for your chosen sensory neuron population.
 *   4. Implement `step()`: advance every neuron's membrane potential per
 *      `neuronModel.ts`'s dynamics, propagate spikes along edges.
 *   5. Implement `decodeMotorOutput()`: read activity from your chosen
 *      motor/descending neuron population and convert it into a heading
 *      (or turn-left/straight/turn-right signal you then convert).
 */
export class ConnectomeModel {
  private neurons: Map<string, LIFNeuron> = new Map();
  private loaded = false;

  constructor(_params?: Partial<LIFNeuronParams>) {
    // TODO: load connectivity data and construct `this.neurons` +
    // adjacency/weights here. Left empty intentionally -- see class doc.
  }

  /** True once real connectome data + neurons have been loaded. */
  isLoaded(): boolean {
    return this.loaded && this.neurons.size >= 0;
  }

  /** TODO: map SensorFrame -> input currents on sensory neurons. */
  encodeSensoryInput(_frame: SensorFrame): void {
    // Placeholder no-op.
  }

  /** TODO: advance neural dynamics by `dt` seconds and propagate spikes. */
  step(_dt: number): void {
    // Placeholder no-op -- with zero neurons loaded, there's nothing to
    // simulate yet. Once neurons are constructed, iterate `this.neurons`
    // and call `.step(dt, inputCurrent)` per src/brains/fly-brain/
    // connectome/neuronModel.ts.
  }

  /** TODO: read activity from motor/descending neurons -> desired heading. */
  decodeMotorOutput(): { heading: number } | null {
    return null;
  }
}
