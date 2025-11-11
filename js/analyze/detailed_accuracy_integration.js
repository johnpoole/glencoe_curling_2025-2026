// Enhanced curlingeval.js integration with distance/direction accuracy
// This version uses detailed accuracy metrics instead of just success/failure

// Import the enhanced accuracy data (would come from database analysis)
const ENHANCED_ACCURACY_DATA = {
  // Distance accuracy by shot type (meters)
  distance_accuracy: {
    'Draw': { mean: 0.15, std: 0.12, bias: 0.02 },        // Slightly short on average
    'Take-out': { mean: 0.23, std: 0.18, bias: 0.05 },    // More variable, longer bias
    'Hit and Roll': { mean: 0.28, std: 0.22, bias: 0.08 },
    'Guard': { mean: 0.18, std: 0.15, bias: -0.03 },      // Slightly long
    'Freeze': { mean: 0.35, std: 0.25, bias: 0.12 }       // Most difficult
  },
  
  // Direction accuracy by shot type (degrees)
  direction_accuracy: {
    'Draw': { mean: 2.8, std: 2.1, bias: 0.5 },           // Slight right bias
    'Take-out': { mean: 4.2, std: 3.5, bias: 0.2 },
    'Hit and Roll': { mean: 5.1, std: 4.0, bias: 0.8 },
    'Guard': { mean: 3.2, std: 2.4, bias: 0.3 },
    'Freeze': { mean: 6.8, std: 5.2, bias: 1.1 }
  },
  
  // Situational modifiers
  modifiers: {
    pressure: { distance: 1.15, direction: 1.12 },        // 15% worse distance, 12% worse direction
    fatigue: { distance: 1.08, direction: 1.05 },
    complex_house: { distance: 1.22, direction: 1.18 },
    ice_conditions: {
      'fast': { distance: 0.95, direction: 1.08 },
      'slow': { distance: 1.12, direction: 0.94 },
      'normal': { distance: 1.0, direction: 1.0 }
    }
  }
};

// Enhanced shot success probability calculation using distance/direction accuracy
function calculateDetailedShotProbability(shotContext) {
  const {
    shotType = 'Draw',
    skillLevel = 50,        // 0-100 scale
    targetDistance = 0,     // meters from ideal position
    requiredPrecision = 0.5, // acceptable error radius (meters)
    angleComplexity = 0,    // 0-1 scale for directional precision needed
    situationModifiers = {}
  } = shotContext;

  // Get base accuracy statistics for this shot type
  const distanceStats = ENHANCED_ACCURACY_DATA.distance_accuracy[shotType] || 
                       ENHANCED_ACCURACY_DATA.distance_accuracy['Draw'];
  const directionStats = ENHANCED_ACCURACY_DATA.direction_accuracy[shotType] || 
                        ENHANCED_ACCURACY_DATA.direction_accuracy['Draw'];

  // Apply skill scaling (better players have lower error variance)
  const skillFactor = Math.pow(skillLevel / 100, 0.5);
  const adjustedDistanceStd = distanceStats.std * (2 - skillFactor);
  const adjustedDirectionStd = directionStats.std * (2 - skillFactor);

  // Apply situational modifiers
  let distanceMod = 1.0;
  let directionMod = 1.0;

  if (situationModifiers.pressure) {
    distanceMod *= ENHANCED_ACCURACY_DATA.modifiers.pressure.distance;
    directionMod *= ENHANCED_ACCURACY_DATA.modifiers.pressure.direction;
  }

  if (situationModifiers.fatigue) {
    distanceMod *= ENHANCED_ACCURACY_DATA.modifiers.fatigue.distance;
    directionMod *= ENHANCED_ACCURACY_DATA.modifiers.fatigue.direction;
  }

  if (situationModifiers.complexHouse) {
    distanceMod *= ENHANCED_ACCURACY_DATA.modifiers.complex_house.distance;
    directionMod *= ENHANCED_ACCURACY_DATA.modifiers.complex_house.direction;
  }

  // Calculate probability of achieving required precision
  const effectiveDistanceStd = adjustedDistanceStd * distanceMod;
  const effectiveDirectionStd = adjustedDirectionStd * directionMod;

  // Distance success probability (normal distribution)
  const distanceSuccessProb = calculateNormalSuccessProbability(
    distanceStats.bias, effectiveDistanceStd, requiredPrecision
  );

  // Direction success probability (accounting for angle complexity)
  const requiredDirectionPrecision = 5.0 - (angleComplexity * 4.0); // 1-5 degree tolerance
  const directionSuccessProb = calculateNormalSuccessProbability(
    directionStats.bias, effectiveDirectionStd, requiredDirectionPrecision
  );

  // Combined probability (both distance and direction must be successful)
  const overallSuccessProb = distanceSuccessProb * directionSuccessProb;

  return {
    overall: Math.max(0.1, Math.min(0.99, overallSuccessProb)),
    distance: distanceSuccessProb,
    direction: directionSuccessProb,
    expectedDistanceError: Math.abs(distanceStats.bias) + effectiveDistanceStd,
    expectedDirectionError: Math.abs(directionStats.bias) + effectiveDirectionStd,
    breakdown: {
      skillFactor,
      distanceMod,
      directionMod,
      requiredPrecision,
      requiredDirectionPrecision
    }
  };
}

function calculateNormalSuccessProbability(bias, std, tolerance) {
  // Calculate probability that |error - bias| <= tolerance
  // Using normal distribution approximation
  
  const z1 = (tolerance - bias) / std;
  const z2 = (-tolerance - bias) / std;
  
  return normalCDF(z1) - normalCDF(z2);
}

function normalCDF(z) {
  // Approximation of normal cumulative distribution function
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function erf(x) {
  // Approximation of error function
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

// Enhanced position evaluation with detailed accuracy modeling
function evaluatePositionWithDetailedAccuracy(shotNumber, hammerTeam, stones, 
  skillPercent = 50, potentialShot = null) {
  
  // Get base evaluation
  const baseEval = evaluatePosition17(shotNumber, hammerTeam, stones, skillPercent);
  
  if (!potentialShot) {
    return baseEval;
  }

  // Calculate detailed shot probability
  const shotContext = {
    shotType: potentialShot.type || 'Draw',
    skillLevel: skillPercent,
    targetDistance: potentialShot.targetDistance || 0,
    requiredPrecision: potentialShot.requiredPrecision || 0.3,
    angleComplexity: potentialShot.angleComplexity || 0,
    situationModifiers: potentialShot.situationModifiers || {}
  };

  const detailedProb = calculateDetailedShotProbability(shotContext);

  // Model different failure modes based on expected errors
  const failureScenarios = generateFailureScenarios(
    potentialShot, detailedProb.expectedDistanceError, detailedProb.expectedDirectionError
  );

  // Weight all scenarios by their probabilities
  let weightedAdvantage = { red: 0, yellow: 0 };
  let weightedBuckets = {};
  for (let score = -8; score <= 8; score++) {
    weightedBuckets[score] = 0;
  }

  // Success scenario
  if (potentialShot.successOutcome) {
    const successEval = evaluatePosition17(shotNumber + 1, hammerTeam, 
      potentialShot.successOutcome.stones, skillPercent);
    
    weightedAdvantage.red += detailedProb.overall * successEval.advantage.red;
    weightedAdvantage.yellow += detailedProb.overall * successEval.advantage.yellow;
    
    for (let score = -8; score <= 8; score++) {
      weightedBuckets[score] += detailedProb.overall * (successEval.buckets17[score] || 0);
    }
  }

  // Failure scenarios
  failureScenarios.forEach(scenario => {
    const scenarioEval = evaluatePosition17(shotNumber + 1, hammerTeam, 
      scenario.resultingStones, skillPercent);
    
    weightedAdvantage.red += scenario.probability * scenarioEval.advantage.red;
    weightedAdvantage.yellow += scenario.probability * scenarioEval.advantage.yellow;
    
    for (let score = -8; score <= 8; score++) {
      weightedBuckets[score] += scenario.probability * (scenarioEval.buckets17[score] || 0);
    }
  });

  return {
    advantage: weightedAdvantage,
    buckets17: weightedBuckets,
    detailedProbability: detailedProb,
    failureScenarios: failureScenarios,
    scenarios: {
      success: potentialShot.successOutcome ? 
        evaluatePosition17(shotNumber + 1, hammerTeam, potentialShot.successOutcome.stones, skillPercent) : null,
      failures: failureScenarios
    }
  };
}

function generateFailureScenarios(potentialShot, expectedDistanceError, expectedDirectionError) {
  const scenarios = [];
  
  // Scenario 1: Short (30% of failures)
  if (potentialShot.shortOutcome) {
    scenarios.push({
      type: 'short',
      probability: 0.3 * (1 - potentialShot.successProbability || 0.3),
      resultingStones: potentialShot.shortOutcome.stones,
      description: `Shot ${expectedDistanceError.toFixed(2)}m short of target`
    });
  }

  // Scenario 2: Long (25% of failures)  
  if (potentialShot.longOutcome) {
    scenarios.push({
      type: 'long',
      probability: 0.25 * (1 - potentialShot.successProbability || 0.3),
      resultingStones: potentialShot.longOutcome.stones,
      description: `Shot ${expectedDistanceError.toFixed(2)}m past target`
    });
  }

  // Scenario 3: Direction miss (35% of failures)
  if (potentialShot.directionMissOutcome) {
    scenarios.push({
      type: 'direction_miss',
      probability: 0.35 * (1 - potentialShot.successProbability || 0.3),
      resultingStones: potentialShot.directionMissOutcome.stones,
      description: `Shot ${expectedDirectionError.toFixed(1)}° off target line`
    });
  }

  // Scenario 4: Complete miss (10% of failures)
  if (potentialShot.missOutcome) {
    scenarios.push({
      type: 'complete_miss',
      probability: 0.10 * (1 - potentialShot.successProbability || 0.3),
      resultingStones: potentialShot.missOutcome.stones,
      description: 'Complete miss - shot ineffective'
    });
  }

  return scenarios;
}

// Enhanced GameController integration
class EnhancedAccuracyGameController {
  
  constructor(gameController) {
    this.base = gameController;
    this.accuracyHistory = [];
  }

  async highlightBestDetailedAdvantagePath(pathRecords) {
    if (!Array.isArray(pathRecords) || pathRecords.length === 0) {
      return;
    }

    const toggle = document.getElementById("showNonContactPaths");
    const showNonContact = !toggle || toggle.checked;

    try {
      const hammerTeam = this.base.getHammerTeam();
      const shotNumber = Math.min(this.base.gameState.stonesThrown, 15);
      const baseStoneData = this.base.buildStoneData(this.base.stones);
      const teamToThrow = this.base.currentTeam === "yellow" ? "yellow" : "red";

      let bestRecord = null;
      let bestDetailedValue = -Infinity;

      pathRecords.forEach(record => {
        if (!this.isValidPath(record, showNonContact)) return;

        const finalState = record.trajectory[record.trajectory.length - 1];
        if (!finalState) return;

        // Enhanced shot context with accuracy requirements
        const shotType = this.classifyShotType(record, this.base.stones, finalState);
        const precisionRequired = this.calculateRequiredPrecision(shotType, record);
        
        const detailedShotContext = {
          shotType: shotType,
          skillLevel: this.base.getSkillLevel(),
          targetDistance: this.calculateTargetDistance(record, this.base.broomPos),
          requiredPrecision: precisionRequired,
          angleComplexity: this.calculateAngleComplexity(record, this.base.stones),
          situationModifiers: this.getSituationModifiers()
        };

        // Calculate detailed probability
        const detailedProb = calculateDetailedShotProbability(detailedShotContext);

        // Enhanced evaluation with failure scenarios
        const enhancedEval = evaluatePositionWithDetailedAccuracy(
          shotNumber, hammerTeam, baseStoneData, this.base.getSkillLevel(),
          this.createPotentialShotObject(record, detailedProb)
        );

        const detailedValue = teamToThrow === "red" ? 
          enhancedEval.advantage.red : enhancedEval.advantage.yellow;

        // Store detailed metrics
        record.detailedProbability = detailedProb;
        record.detailedValue = detailedValue;
        record.accuracyBreakdown = detailedProb.breakdown;

        if (!bestRecord || detailedValue > bestDetailedValue) {
          bestDetailedValue = detailedValue;
          bestRecord = record;
        }
      });

      // Apply enhanced visual highlighting
      this.applyDetailedHighlighting(pathRecords, bestRecord);

    } catch (error) {
      console.error("Error in detailed accuracy path highlighting:", error);
    }
  }

  calculateRequiredPrecision(shotType, record) {
    // Calculate how precise the shot needs to be based on context
    const basePrecision = {
      'Draw': 0.25,        // 25cm tolerance
      'Take-out': 0.15,    // 15cm tolerance (need to hit stone)
      'Hit and Roll': 0.20, // 20cm tolerance
      'Guard': 0.35,       // 35cm tolerance (more forgiving)
      'Freeze': 0.10       // 10cm tolerance (very precise)
    };

    let precision = basePrecision[shotType] || 0.25;

    // Adjust based on house complexity
    const stonesInPlay = this.base.stones.length;
    if (stonesInPlay > 6) {
      precision *= 0.8; // Need more precision with crowded house
    }

    return precision;
  }

  getSituationModifiers() {
    const modifiers = {};
    
    // Check for pressure situation
    if (this.base.gameState.currentEnd >= 8 && 
        Math.abs(this.base.gameState.scores.red - this.base.gameState.scores.yellow) <= 2) {
      modifiers.pressure = true;
    }

    // Check for fatigue (late in game)
    if (this.base.gameState.currentEnd >= 10) {
      modifiers.fatigue = true;
    }

    // Check for complex house
    if (this.base.stones.length >= 6) {
      modifiers.complexHouse = true;
    }

    return modifiers;
  }

  applyDetailedHighlighting(pathRecords, bestRecord) {
    pathRecords.forEach(record => {
      if (!record || !record.pathSelection) return;

      const isBest = record === bestRecord;
      let strokeColor = record.color;
      let strokeWidth = 2;

      if (isBest) {
        strokeColor = "#ff3b30"; // Red for best detailed value
        strokeWidth = 3;
      } else if (record.detailedProbability) {
        // Color code by success probability
        const prob = record.detailedProbability.overall;
        if (prob < 0.5) {
          strokeColor = "#ff9500"; // Orange for low probability
        } else if (prob > 0.8) {
          strokeColor = "#34c759"; // Green for high probability
        }
      }

      record.pathSelection
        .style("stroke", strokeColor)
        .style("stroke-width", strokeWidth);

      // Add detailed data attributes
      if (record.detailedProbability) {
        record.pathSelection
          .attr("data-success-prob", (record.detailedProbability.overall * 100).toFixed(1) + "%")
          .attr("data-distance-error", record.detailedProbability.expectedDistanceError.toFixed(3) + "m")
          .attr("data-direction-error", record.detailedProbability.expectedDirectionError.toFixed(1) + "°")
          .attr("data-detailed-value", record.detailedValue.toFixed(3));
      }
    });

    if (bestRecord && bestRecord.detailedProbability) {
      console.log(`Best path: ${bestRecord.shotType} with ${(bestRecord.detailedProbability.overall * 100).toFixed(1)}% success 
        (±${bestRecord.detailedProbability.expectedDistanceError.toFixed(2)}m distance, 
        ±${bestRecord.detailedProbability.expectedDirectionError.toFixed(1)}° direction)`);
    }
  }

  // Helper methods...
  isValidPath(record, showNonContact) {
    if (!record || !record.trajectory || record.trajectory.length === 0) return false;
    if (record.trajectory.stoppedOnSheet === false) return false;
    if (!showNonContact && !record.makesContact) return false;
    if (!record.pathSelection) return false;
    return true;
  }

  classifyShotType(record, existingStones, finalState) {
    // Enhanced shot type classification
    // (Implementation would be similar to previous version but more detailed)
    return record.shotType || 'Draw'; // Simplified for now
  }

  calculateTargetDistance(record, broomPosition) {
    // Calculate distance from intended target
    const finalState = record.trajectory[record.trajectory.length - 1];
    return Math.sqrt(
      (finalState.x - broomPosition.x)**2 + 
      (finalState.y - broomPosition.y)**2
    );
  }

  calculateAngleComplexity(record, stones) {
    // Calculate how complex the shot angle is based on surrounding stones
    return Math.min(stones.length * 0.1, 1.0); // Simplified
  }

  createPotentialShotObject(record, detailedProb) {
    // Create object describing the potential shot outcomes
    return {
      type: record.shotType || 'Draw',
      successProbability: detailedProb.overall,
      successOutcome: { stones: [] }, // Would be populated with actual outcome
      // Additional failure scenarios would be generated here
    };
  }
}

// Export enhanced functionality
export { 
  calculateDetailedShotProbability,
  evaluatePositionWithDetailedAccuracy,
  EnhancedAccuracyGameController,
  ENHANCED_ACCURACY_DATA
};