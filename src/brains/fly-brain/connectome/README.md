# Fly Brain Connectome (template)

This folder is where the real Drosophila connectome data and neural simulation will live, per Phase 3 of the project plan.

## Files

- **`neuronModel.ts`** -- a minimal, working leaky integrate-and-fire (LIF) neuron implementation. Not yet wired to any real connectivity.
- **`connectomeModel.ts`** -- stub for the full network: loading connectivity, encoding sensory input, stepping neural dynamics, decoding motor output. Currently a no-op.

## Where connectome data goes

Once you have exported/preprocessed connectome data (e.g. a trimmed subset of FlyWire's proofread neuron and synapse tables -- not the full ~139k-neuron dataset, at least not at first), put it in a `data/` folder here, e.g.:

```
src/brains/fly-brain/connectome/data/
  neurons.json        <- neuron IDs, cell types, (optionally) predicted neurotransmitter
  synapses.json        <- weighted directed edges between neuron IDs
```

**Do not commit large raw connectome exports to source control.** Keep `data/` in `.gitignore` (or load large files at runtime from an external location) and only check in small, curated subsets needed for the actual simulated sub-network (e.g. visual system + central complex + a handful of descending neurons), not the entire brain, especially early on.

## Suggested build order

1. Pick a small, biologically meaningful sub-circuit to simulate first (the project write-up suggests starting with visual motion pathways + central complex navigation circuitry, since those map most directly onto "which way do I go" in this game).
2. Export/curate that sub-circuit's connectivity from FlyWire/Codex.
3. Load it in `connectomeModel.ts`'s constructor, building one `LIFNeuron` per neuron ID and storing the weighted edges.
4. Implement `encodeSensoryInput()` to map `SensorFrame` fields (see `../shared-sensors/sensorFrame.ts`) onto input currents for your sensory neuron population.
5. Implement `step()` to advance all neurons and propagate spikes along the loaded connectivity.
6. Implement `decodeMotorOutput()` to read your chosen descending/motor neuron population's activity and convert it into a heading.
7. Only after that's working should you consider scaling up toward a larger fraction of the real connectome -- start small and validate the pipeline end-to-end first.
