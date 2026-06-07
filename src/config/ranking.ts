export const RankingConfig = {
  // PageRank Iteration Settings
  DAMPING_FACTOR: 0.85,
  UNIVERSAL_BASIC_INCOME_SHARE: 0.15,
  MAX_ITERATIONS: 100,
  CONVERGENCE_THRESHOLD: 0.00001,

  // Post-Processing Settings
  MIN_LIST_APPEARANCES: 20, // Minimum number of lists an item must appear in to be considered for global ranking

  // Emotional Gap Multiplier Settings
  // Assumes explicit rating scores are out of 100
  EMOTIONAL_GAP_BASE_MULTIPLIER: 1.0,
  EMOTIONAL_GAP_MAX_SCORE: 100,
  EMOTIONAL_GAP_SCALING_FACTOR: 0.2, // At max gap (100), the multiplier adds this much (max multiplier = 1.5)

  // Time Decay Settings
  TIME_DECAY_HALF_LIFE_DAYS: 365.25 * 5, // 5 years
  TIME_DECAY_FLOOR: 0.5, // Never decays below 50%
} as const;
