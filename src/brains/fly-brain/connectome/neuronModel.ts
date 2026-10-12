/**
 * TEMPLATE.
 *
 * A minimal leaky integrate-and-fire (LIF) neuron -- the same basic
 * neuron model used by the 2024 whole-brain Drosophila computational
 * model referenced in the project write-up (connectivity + predicted
 * neurotransmitter identity + simple spiking dynamics, rather than
 * treating neurons as ordinary ANN nodes).
 *
 * This implementation is functional but deliberately minimal, and is not
 * yet wired into any real connectivity data (see connectomeModel.ts).
 * Extend it as needed -- e.g. per-neurotransmitter behavior (excitatory
 * vs. inhibitory vs. modulatory), refractory periods, adaptation, etc.
 */
export interface LIFNeuronParams {
  /** Membrane time constant (seconds). Larger = leaks charge more slowly. */
  tau: number;
  /** Spike threshold (arbitrary units, consistent with input current scale). */
  threshold: number;
  /** Potential the membrane resets to after spiking. */
  resetPotential: number;
  /** Resting potential the membrane leaks toward with no input. */
  restingPotential: number;
}

export const DEFAULT_LIF_PARAMS: LIFNeuronParams = {
  tau: 0.02,
  threshold: 1.0,
  resetPotential: 0.0,
  restingPotential: 0.0,
};

export class LIFNeuron {
  readonly id: string;
  private params: LIFNeuronParams;
  private potential: number;
  private spiked = false;

  constructor(id: string, params: Partial<LIFNeuronParams> = {}) {
    this.id = id;
    this.params = { ...DEFAULT_LIF_PARAMS, ...params };
    this.potential = this.params.restingPotential;
  }

  /** Advance this neuron by `dt` seconds given a summed input current. */
  step(dt: number, inputCurrent: number): boolean {
    const { tau, threshold, resetPotential, restingPotential } = this.params;
    const leak = (restingPotential - this.potential) / tau;
    this.potential += (leak + inputCurrent) * dt;

    if (this.potential >= threshold) {
      this.potential = resetPotential;
      this.spiked = true;
      return true;
    }
    this.spiked = false;
    return false;
  }

  didSpike(): boolean {
    return this.spiked;
  }

  getPotential(): number {
    return this.potential;
  }
}
