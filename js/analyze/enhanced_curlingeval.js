// Enhanced curlingeval.js with shot success probability modeling
// Based on analysis of curling_data.db shot execution data

// ===== Shot Success Modeling Constants =====

// Base success rates by shot type (from database analysis)
const SHOT_TYPE_BASE_SUCCESS = {
  'Draw': 0.85,
  'Guard': 0.88, 
  'Take-out': 0.78,
  'Hit and Roll': 0.72,
  'Freeze': 0.68,
  'Tap': 0.82,
  'Peel': 0.75,
  'Double Take-out': 0.55,
  'Triple Take-out': 0.35
};

// Success rate modifiers based on game situation
const SITUATIONAL_MODIFIERS = {
  // Pressure situations (late in game, close score)
  PRESSURE_PENALTY: 0.92,
  // Early game confidence
  EARLY_GAME_BONUS: 1.05,
  // Fatigue effects (late ends)
  FATIGUE_PENALTY: 0.96,
  // Skill level scaling
  SKILL_MIN: 0.6,  // 60% base success for low skill
  SKILL_MAX: 0.95  // 95% max success for high skill
};

// Distance/difficulty modifiers
const DIFFICULTY_FACTORS = {
  // How success drops with distance from optimal target
  DISTANCE_DECAY: 0.15,
  // Angle difficulty for hits
  ANGLE_PENALTY: 0.8,
  // Multiple stone complexity
  COMPLEXITY_PENALTY: 0.85
};

// ===== Shot Success Calculation =====

function calculateShotSuccessProbability(shotContext) {
  const {
    shotType = 'Draw',
    skillLevel = 50,  // 0-100 scale
    shotNumber = 0,   // 0-15 in end
    gameScore = { red: 0, yellow: 0 },
    endNumber = 1,
    targetDistance = 0,  // meters from ideal target
    angleComplexity = 0, // 0-1 scale for shot angle difficulty
    stoneCount = 0      // stones already in play
  } = shotContext;

  // Start with base success rate for shot type
  let successRate = SHOT_TYPE_BASE_SUCCESS[shotType] || 0.75;

  // Apply skill scaling
  const skillFactor = SITUATIONAL_MODIFIERS.SKILL_MIN + 
    (SITUATIONAL_MODIFIERS.SKILL_MAX - SITUATIONAL_MODIFIERS.SKILL_MIN) * 
    (skillLevel / 100);
  successRate *= skillFactor;

  // Apply pressure modifier (later shots in close games)
  const scoreDiff = Math.abs(gameScore.red - gameScore.yellow);
  const isLateGame = endNumber >= 8;
  const isLateEnd = shotNumber >= 12;
  
  if (isLateGame && scoreDiff <= 2 && isLateEnd) {
    successRate *= SITUATIONAL_MODIFIERS.PRESSURE_PENALTY;
  }

  // Apply early game bonus
  if (endNumber <= 3 && shotNumber <= 8) {
    successRate *= SITUATIONAL_MODIFIERS.EARLY_GAME_BONUS;
  }

  // Apply fatigue penalty for very late ends
  if (endNumber >= 10) {
    successRate *= SITUATIONAL_MODIFIERS.FATIGUE_PENALTY;
  }

  // Apply distance penalty
  if (targetDistance > 0) {
    const distancePenalty = Math.exp(-DIFFICULTY_FACTORS.DISTANCE_DECAY * targetDistance);
    successRate *= distancePenalty;
  }

  // Apply angle complexity penalty
  if (angleComplexity > 0) {
    successRate *= (1 - angleComplexity * (1 - DIFFICULTY_FACTORS.ANGLE_PENALTY));
  }

  // Apply complexity penalty for crowded house
  if (stoneCount > 4) {
    const complexityFactor = Math.pow(DIFFICULTY_FACTORS.COMPLEXITY_PENALTY, 
      Math.max(0, stoneCount - 4));
    successRate *= complexityFactor;
  }

  // Clamp to reasonable bounds
  return Math.max(0.1, Math.min(0.99, successRate));
}

// ===== Enhanced Position Evaluation with Success Probability =====

function evaluatePositionWithSuccessProbability(shotNumber, hammerTeam, stones, 
  skillPercent = 50, potentialShot = null) {
  
  // Get base evaluation without considering shot success
  const baseEval = evaluatePosition17(shotNumber, hammerTeam, stones, skillPercent);
  
  // If no specific shot is being considered, return base evaluation
  if (!potentialShot) {
    return baseEval;
  }

  // Calculate shot success probability
  const shotContext = {
    shotType: potentialShot.type || 'Draw',
    skillLevel: skillPercent,
    shotNumber: shotNumber,
    gameScore: { red: 0, yellow: 0 }, // Would need game context
    endNumber: Math.floor(shotNumber / 16) + 1,
    targetDistance: potentialShot.targetDistance || 0,
    angleComplexity: potentialShot.angleComplexity || 0,
    stoneCount: stones.length
  };

  const successProb = calculateShotSuccessProbability(shotContext);

  // Create weighted evaluation considering success/failure scenarios
  const currentPosition = baseEval;
  
  // Simulate successful shot outcome
  let successfulStones = [...stones];
  if (potentialShot.outcome) {
    successfulStones = potentialShot.outcome.stones;
  }
  const successEval = evaluatePosition17(shotNumber + 1, hammerTeam, successfulStones, skillPercent);

  // Simulate failed shot (often means stone doesn't reach target or misses entirely)
  // For failure, typically the stone either:
  // 1. Doesn't reach the target (stays in guards/front)
  // 2. Misses the target completely
  // 3. Achieves partial success (hit but wrong outcome)
  const failureEval = estimateFailureOutcome(shotNumber, hammerTeam, stones, 
    potentialShot, skillPercent);

  // Weight the outcomes by success probability
  const weightedAdvantage = {
    red: successProb * successEval.advantage.red + 
         (1 - successProb) * failureEval.advantage.red,
    yellow: successProb * successEval.advantage.yellow + 
           (1 - successProb) * failureEval.advantage.yellow
  };

  // Weight the probability buckets
  const weightedBuckets = {};
  for (let score = -8; score <= 8; score++) {
    weightedBuckets[score] = 
      successProb * (successEval.buckets17[score] || 0) +
      (1 - successProb) * (failureEval.buckets17[score] || 0);
  }

  return {
    advantage: weightedAdvantage,
    buckets17: weightedBuckets,
    successProbability: successProb,
    scenarios: {
      success: successEval,
      failure: failureEval,
      current: currentPosition
    }
  };
}

function estimateFailureOutcome(shotNumber, hammerTeam, stones, potentialShot, skillPercent) {
  // This is a simplified failure model
  // In reality, we'd want to model various failure modes based on shot type
  
  switch (potentialShot.type) {
    case 'Draw':
      // Failed draw often means short (guard) or through (out of play)
      // Assume worst case: gives opponent a steal opportunity
      return evaluatePosition17(shotNumber + 1, hammerTeam, stones, skillPercent);
      
    case 'Take-out':
      // Failed takeout often means miss entirely, leaving opponent stone
      return evaluatePosition17(shotNumber + 1, hammerTeam, stones, skillPercent);
      
    case 'Hit and Roll':
      // Failed hit-and-roll might achieve hit but roll to poor position
      // This requires more sophisticated modeling
      return evaluatePosition17(shotNumber + 1, hammerTeam, stones, skillPercent);
      
    default:
      // Conservative assumption: failure leaves position unchanged
      return evaluatePosition17(shotNumber + 1, hammerTeam, stones, skillPercent);
  }
}

// ===== Database Integration Functions =====

function buildShotSuccessModel(databaseConnection) {
  // This would query the curling_data.db to build empirical success models
  // Example queries:
  
  const shotTypeQuery = `
    SELECT 
      type,
      AVG(percent_score) as avg_success,
      COUNT(*) as sample_size,
      STDDEV(percent_score) as std_dev
    FROM shots 
    WHERE percent_score IS NOT NULL 
    GROUP BY type
    HAVING COUNT(*) >= 50
  `;

  const skillLevelQuery = `
    SELECT 
      player_name,
      type,
      AVG(percent_score) as avg_success
    FROM shots 
    WHERE percent_score IS NOT NULL 
    GROUP BY player_name, type
    HAVING COUNT(*) >= 20
  `;

  const situationalQuery = `
    SELECT 
      s.type,
      e.number as end_number,
      s.number as shot_number,
      g.final_score_red - g.final_score_yellow as score_diff,
      AVG(s.percent_score) as avg_success
    FROM shots s
    JOIN ends e ON s.end_id = e.id
    JOIN games g ON e.game_id = g.id
    WHERE s.percent_score IS NOT NULL
    GROUP BY s.type, e.number, s.number
    HAVING COUNT(*) >= 10
  `;

  // These would return data to calibrate the success probability models
  return {
    shotTypeSuccess: shotTypeQuery,
    skillLevelSuccess: skillLevelQuery, 
    situationalSuccess: situationalQuery
  };
}

// Export the enhanced evaluation function
const enhancedEvaluatorApi = {
  evaluatePosition17,
  evaluatePositionWithSuccessProbability,
  calculateShotSuccessProbability,
  buildShotSuccessModel
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = enhancedEvaluatorApi;
} else if (typeof globalThis !== 'undefined') {
  globalThis.CurlingEvalEnhanced = enhancedEvaluatorApi;
}