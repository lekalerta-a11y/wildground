import type { Player } from '../core/player';
import { CustomAIBrain } from './custom-ai/CustomAIBrain';
import { FlyBrain } from './fly-brain/FlyBrain';
import { PERSONALITIES } from './rule-based/personalities';
import { RuleBasedBrain } from './rule-based/ruleBasedBrain';
import type { BrainMeta } from './types';

/**
 * Every selectable bot brain, in one place. To add a new brain type (a new
 * trained checkpoint, a new rule-based personality, a second fly-brain
 * variant, etc.) add one entry here -- nothing in src/core, src/render, or
 * src/ui needs to change.
 */
export const BRAIN_REGISTRY: BrainMeta[] = [
  {
    id: PERSONALITIES.balanced.id,
    label: PERSONALITIES.balanced.label,
    description: PERSONALITIES.balanced.description,
    category: 'rule-based',
    create: (player: Player) => new RuleBasedBrain(player, PERSONALITIES.balanced),
  },
  {
    id: PERSONALITIES.aggressive.id,
    label: PERSONALITIES.aggressive.label,
    description: PERSONALITIES.aggressive.description,
    category: 'rule-based',
    create: (player: Player) => new RuleBasedBrain(player, PERSONALITIES.aggressive),
  },
  {
    id: PERSONALITIES.cautious.id,
    label: PERSONALITIES.cautious.label,
    description: PERSONALITIES.cautious.description,
    category: 'rule-based',
    create: (player: Player) => new RuleBasedBrain(player, PERSONALITIES.cautious),
  },
  {
    id: PERSONALITIES.opportunist.id,
    label: PERSONALITIES.opportunist.label,
    description: PERSONALITIES.opportunist.description,
    category: 'rule-based',
    create: (player: Player) => new RuleBasedBrain(player, PERSONALITIES.opportunist),
  },
  {
    id: 'custom-ai',
    label: 'Your AI (custom)',
    description: 'Template slot for your own trained model. Placeholder wander behavior until wired up.',
    category: 'custom-ai',
    create: (player: Player) => new CustomAIBrain(player),
  },
  {
    id: 'fly-brain',
    label: 'Fly Brain (connectome)',
    description: 'Template slot for a Drosophila connectome model. Placeholder wander behavior until wired up.',
    category: 'fly-brain',
    create: (player: Player) => new FlyBrain(player),
  },
];

export const DEFAULT_BRAIN_ID = PERSONALITIES.balanced.id;

export function getBrainMeta(id: string): BrainMeta {
  return BRAIN_REGISTRY.find((b) => b.id === id) ?? BRAIN_REGISTRY[0];
}

export function createBrain(id: string, player: Player) {
  return getBrainMeta(id).create(player);
}
