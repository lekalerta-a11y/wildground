/**
 * A "personality" is just a set of multipliers/overrides applied on top of
 * the global AI constants (src/core/constants.ts). This keeps all four
 * rule-based bots sharing one implementation (per the original design
 * goal) while still behaving distinguishably in WATCH AI / PLAY.
 */
export interface RuleBasedPersonality {
  id: string;
  label: string;
  description: string;
  /** Multiplies AI.MISTAKE_CHANCE. */
  mistakeChanceMult: number;
  /** Multiplies AI.MAX_EXCURSION_DISTANCE. */
  excursionMult: number;
  /** Multiplies AI.THREAT_RADIUS (bigger = more cautious / reacts sooner). */
  threatRadiusMult: number;
  /** Multiplies AI.AWARENESS_RADIUS used specifically for attack-target search. */
  attackRangeMult: number;
  /** Fraction of MAX_EXCURSION at which the bot still considers attacking (higher = braver). */
  attackSafetyExcursionFraction: number;
}

export const PERSONALITIES: Record<string, RuleBasedPersonality> = {
  balanced: {
    id: 'rule-balanced',
    label: 'Balanced',
    description: 'Even mix of expansion, defense, and opportunistic attacks.',
    mistakeChanceMult: 1,
    excursionMult: 1,
    threatRadiusMult: 1,
    attackRangeMult: 1,
    attackSafetyExcursionFraction: 0.7,
  },
  aggressive: {
    id: 'rule-aggressive',
    label: 'Aggressive',
    description: 'Hunts exposed enemy trails further and riskier than most.',
    mistakeChanceMult: 1.15,
    excursionMult: 1.25,
    threatRadiusMult: 0.8,
    attackRangeMult: 1.35,
    attackSafetyExcursionFraction: 0.95,
  },
  cautious: {
    id: 'rule-cautious',
    label: 'Cautious',
    description: 'Shorter excursions, quicker retreats, rarely takes the bait.',
    mistakeChanceMult: 0.6,
    excursionMult: 0.7,
    threatRadiusMult: 1.35,
    attackRangeMult: 0.6,
    attackSafetyExcursionFraction: 0.4,
  },
  opportunist: {
    id: 'rule-opportunist',
    label: 'Opportunist',
    description: 'Prioritizes cutting enemy trails over pure expansion.',
    mistakeChanceMult: 1,
    excursionMult: 1,
    threatRadiusMult: 1,
    attackRangeMult: 1.6,
    attackSafetyExcursionFraction: 0.85,
  },
};

export const DEFAULT_PERSONALITY_ORDER = ['balanced', 'aggressive', 'cautious', 'opportunist'];
