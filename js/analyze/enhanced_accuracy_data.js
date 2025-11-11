// Auto-generated enhanced accuracy parameters
// Generated on 2025-11-11 08:49:16

export const ENHANCED_ACCURACY_DATA = {
  // Distance accuracy by shot type (meters)
  distance_accuracy: {
    "Draw": {
        "mean": 0.15,
        "std": 0.12,
        "bias": 0.02
    },
    "Take-out": {
        "mean": 0.23,
        "std": 0.18,
        "bias": 0.05
    },
    "Guard": {
        "mean": 0.18,
        "std": 0.15,
        "bias": -0.03
    }
},
  
  // Direction accuracy by shot type (degrees)  
  direction_accuracy: {
    "Draw": {
        "mean": 2.8,
        "std": 2.1,
        "bias": 0.5
    },
    "Take-out": {
        "mean": 4.2,
        "std": 3.5,
        "bias": 0.2
    },
    "Guard": {
        "mean": 3.2,
        "std": 2.4,
        "bias": 0.3
    }
},
  
  // Situational modifiers (multiplicative factors)
  modifiers: {
    pressure: { distance: 1.15, direction: 1.12 },
    fatigue: { distance: 1.08, direction: 1.05 },
    complex_house: { distance: 1.22, direction: 1.18 },
    ice_conditions: {
      'fast': { distance: 0.95, direction: 1.08 },
      'slow': { distance: 1.12, direction: 0.94 },
      'normal': { distance: 1.0, direction: 1.0 }
    }
  }
};

// Helper function to get accuracy parameters for a shot type
export function getAccuracyParameters(shotType) {
  return {
    distance: ENHANCED_ACCURACY_DATA.distance_accuracy[shotType] || ENHANCED_ACCURACY_DATA.distance_accuracy['Draw'],
    direction: ENHANCED_ACCURACY_DATA.direction_accuracy[shotType] || ENHANCED_ACCURACY_DATA.direction_accuracy['Draw']
  };
}

// Calculate success probability for given shot parameters
export function calculateShotSuccessProbability(shotType, skillLevel, requiredPrecision, angleComplexity, modifiers = {}) {
  const params = getAccuracyParameters(shotType);
  
  // Apply skill scaling
  const skillFactor = Math.pow(skillLevel / 100, 0.5);
  const effectiveDistanceStd = params.distance.std * (2 - skillFactor);
  const effectiveDirectionStd = params.direction.std * (2 - skillFactor);
  
  // Apply situational modifiers
  let distanceMod = 1.0;
  let directionMod = 1.0;
  
  if (modifiers.pressure) {
    distanceMod *= ENHANCED_ACCURACY_DATA.modifiers.pressure.distance;
    directionMod *= ENHANCED_ACCURACY_DATA.modifiers.pressure.direction;
  }
  
  if (modifiers.fatigue) {
    distanceMod *= ENHANCED_ACCURACY_DATA.modifiers.fatigue.distance;
    directionMod *= ENHANCED_ACCURACY_DATA.modifiers.fatigue.direction;
  }
  
  if (modifiers.complexHouse) {
    distanceMod *= ENHANCED_ACCURACY_DATA.modifiers.complex_house.distance;
    directionMod *= ENHANCED_ACCURACY_DATA.modifiers.complex_house.direction;
  }
  
  // Calculate probabilities (simplified normal distribution)
  const distanceSuccessProb = Math.exp(-Math.pow(requiredPrecision / (effectiveDistanceStd * distanceMod), 2) / 2);
  const directionTolerance = 5.0 - (angleComplexity * 4.0);
  const directionSuccessProb = Math.exp(-Math.pow(directionTolerance / (effectiveDirectionStd * directionMod), 2) / 2);
  
  return {
    overall: Math.max(0.1, Math.min(0.99, distanceSuccessProb * directionSuccessProb)),
    distance: distanceSuccessProb,
    direction: directionSuccessProb,
    expectedDistanceError: Math.abs(params.distance.bias) + effectiveDistanceStd * distanceMod,
    expectedDirectionError: Math.abs(params.direction.bias) + effectiveDirectionStd * directionMod
  };
}
