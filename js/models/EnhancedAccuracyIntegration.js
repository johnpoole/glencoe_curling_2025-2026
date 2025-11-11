// Enhanced GameController integration with detailed accuracy
import { ENHANCED_ACCURACY_DATA, calculateShotSuccessProbability } from '../analyze/enhanced_accuracy_data.js';

export class EnhancedAccuracyExtension {
  
  constructor(gameController) {
    this.gameController = gameController;
    this.originalHighlightMethod = gameController.highlightBestAdvantagePath;
    
    // Override the highlight method with enhanced accuracy
    gameController.highlightBestAdvantagePath = this.enhancedHighlightBestAdvantagePath.bind(this);
  }
  
  async enhancedHighlightBestAdvantagePath(pathRecords) {
    if (!Array.isArray(pathRecords) || pathRecords.length === 0) {
      return;
    }

    const toggle = document.getElementById("showNonContactPaths");
    const showNonContact = !toggle || toggle.checked;

    try {
      const hammerTeam = this.gameController.getHammerTeam();
      const shotNumber = Math.min(this.gameController.gameState.stonesThrown, 15);
      const teamToThrow = this.gameController.currentTeam === "yellow" ? "yellow" : "red";

      let bestRecord = null;
      let bestEnhancedValue = -Infinity;

      pathRecords.forEach(record => {
        if (!this.isValidPath(record, showNonContact)) return;

        const finalState = record.trajectory[record.trajectory.length - 1];
        if (!finalState) return;

        // Enhanced shot analysis
        const shotType = this.classifyShotType(record);
        const requiredPrecision = this.calculateRequiredPrecision(shotType);
        const angleComplexity = this.calculateAngleComplexity(record);
        const modifiers = this.getSituationModifiers();

        // Calculate detailed accuracy probability
        const accuracyResult = calculateShotSuccessProbability(
          shotType,
          this.gameController.getSkillLevel ? this.gameController.getSkillLevel() : 50,
          requiredPrecision,
          angleComplexity,
          modifiers
        );

        // Enhanced expected value calculation
        const baseAdvantage = record.advantage || 0;
        const enhancedValue = baseAdvantage * accuracyResult.overall;

        // Store enhanced data
        record.enhancedAccuracy = accuracyResult;
        record.enhancedValue = enhancedValue;
        record.shotType = shotType;
        record.requiredPrecision = requiredPrecision;

        if (!bestRecord || enhancedValue > bestEnhancedValue) {
          bestEnhancedValue = enhancedValue;
          bestRecord = record;
        }
      });

      // Apply enhanced visual highlighting
      this.applyEnhancedHighlighting(pathRecords, bestRecord);
      
      // Log enhanced results
      if (bestRecord && bestRecord.enhancedAccuracy) {
        console.log(`Enhanced analysis: ${bestRecord.shotType} ` +
          `(${(bestRecord.enhancedAccuracy.overall * 100).toFixed(1)}% success, ` +
          `±${bestRecord.enhancedAccuracy.expectedDistanceError.toFixed(2)}m distance, ` +
          `±${bestRecord.enhancedAccuracy.expectedDirectionError.toFixed(1)}° direction)`);
      }

    } catch (error) {
      console.error("Error in enhanced accuracy analysis:", error);
      // Fallback to original method
      if (this.originalHighlightMethod) {
        this.originalHighlightMethod.call(this.gameController, pathRecords);
      }
    }
  }
  
  isValidPath(record, showNonContact) {
    if (!record || !record.trajectory || record.trajectory.length === 0) return false;
    if (record.trajectory.stoppedOnSheet === false) return false;
    if (!showNonContact && !record.makesContact) return false;
    if (!record.pathSelection) return false;
    return true;
  }
  
  classifyShotType(record) {
    // Enhanced shot type classification
    const velocity = record.velocity || 2.0;
    const makesContact = record.makesContact || false;
    const finalState = record.trajectory[record.trajectory.length - 1];
    const distanceToButton = Math.sqrt(finalState.x ** 2 + finalState.y ** 2);
    
    if (makesContact) {
      if (velocity > 2.5) {
        return 'Take-out';
      } else if (distanceToButton < 1.5) {
        return 'Hit and Roll';
      } else {
        return 'Hit';
      }
    } else {
      if (distanceToButton < 1.83) {
        return 'Draw';
      } else if (finalState.y > 2.0) {
        return 'Guard';
      } else {
        return 'Draw';
      }
    }
  }
  
  calculateRequiredPrecision(shotType) {
    const basePrecision = {
      'Draw': 0.25,
      'Take-out': 0.15,
      'Hit and Roll': 0.20,
      'Guard': 0.35,
      'Hit': 0.15
    };
    
    let precision = basePrecision[shotType] || 0.25;
    
    // Adjust for house complexity
    const stonesInPlay = this.gameController.stones.length;
    if (stonesInPlay > 6) {
      precision *= 0.8;
    }
    
    return precision;
  }
  
  calculateAngleComplexity(record) {
    // Calculate angle complexity based on surrounding stones
    const stones = this.gameController.stones || [];
    return Math.min(stones.length * 0.1, 1.0);
  }
  
  getSituationModifiers() {
    const modifiers = {};
    const gameState = this.gameController.gameState;
    
    // Pressure situation
    if (gameState.currentEnd >= 8) {
      const scoreDiff = Math.abs(gameState.scores.red - gameState.scores.yellow);
      if (scoreDiff <= 2) {
        modifiers.pressure = true;
      }
    }
    
    // Fatigue
    if (gameState.currentEnd >= 10) {
      modifiers.fatigue = true;
    }
    
    // Complex house
    if (this.gameController.stones.length >= 6) {
      modifiers.complexHouse = true;
    }
    
    return modifiers;
  }
  
  applyEnhancedHighlighting(pathRecords, bestRecord) {
    pathRecords.forEach(record => {
      if (!record || !record.pathSelection) return;

      const isBest = record === bestRecord;
      let strokeColor = record.color;
      let strokeWidth = 2;

      if (isBest) {
        strokeColor = "#ff3b30"; // Red for best enhanced value
        strokeWidth = 3;
      } else if (record.enhancedAccuracy) {
        // Color code by accuracy
        const accuracy = record.enhancedAccuracy.overall;
        if (accuracy < 0.5) {
          strokeColor = "#ff9500"; // Orange for risky
        } else if (accuracy > 0.8) {
          strokeColor = "#34c759"; // Green for safe
        }
      }

      record.pathSelection
        .style("stroke", strokeColor)
        .style("stroke-width", strokeWidth);

      // Enhanced data attributes
      if (record.enhancedAccuracy) {
        record.pathSelection
          .attr("data-enhanced-success", `${(record.enhancedAccuracy.overall * 100).toFixed(1)}%`)
          .attr("data-distance-error", `±${record.enhancedAccuracy.expectedDistanceError.toFixed(2)}m`)
          .attr("data-direction-error", `±${record.enhancedAccuracy.expectedDirectionError.toFixed(1)}°`)
          .attr("data-shot-type", record.shotType)
          .attr("data-precision-required", `${record.requiredPrecision.toFixed(2)}m`);
      }
    });
    
    // Update UI accuracy display
    this.updateAccuracyDisplay(pathRecords);
  }
  
  // Method to update accuracy display in UI
  updateAccuracyDisplay(pathRecords) {
    const accuracyToggle = document.getElementById("showAccuracyData");
    const accuracyDisplay = document.getElementById("accuracyDisplay");
    const accuracyMetrics = document.getElementById("accuracyMetrics");
    
    if (!accuracyToggle || !accuracyToggle.checked || !pathRecords.length) {
      if (accuracyDisplay) accuracyDisplay.style.display = 'none';
      return;
    }
    
    if (accuracyDisplay) accuracyDisplay.style.display = 'block';
    
    // Find best path for accuracy analysis
    let bestPath = null;
    let bestValue = -Infinity;
    
    pathRecords.forEach(record => {
      const shotType = this.classifyShotType(record);
      const precision = this.calculateRequiredPrecision(shotType);
      const complexity = this.calculateAngleComplexity(record);
      
      const accuracy = calculateShotSuccessProbability(shotType, 50, precision, complexity, {});
      if (accuracy.overall > bestValue) {
        bestValue = accuracy.overall;
        bestPath = { record, shotType, accuracy };
      }
    });
    
    if (bestPath && accuracyMetrics) {
      const { shotType, accuracy } = bestPath;
      
      accuracyMetrics.innerHTML = `
        <div class="accuracy-metric">
          <span class="label">Shot Type:</span>
          <span class="value">${shotType}</span>
          <span class="shot-difficulty difficulty-${accuracy.overall > 0.7 ? 'easy' : accuracy.overall > 0.4 ? 'medium' : 'hard'}">
            ${accuracy.overall > 0.7 ? 'Easy' : accuracy.overall > 0.4 ? 'Medium' : 'Hard'}
          </span>
        </div>
        <div class="accuracy-metric">
          <span class="label">Success Probability:</span>
          <span class="value">${(accuracy.overall * 100).toFixed(1)}%</span>
          <div class="accuracy-bar">
            <div class="accuracy-bar-fill" style="width: ${accuracy.overall * 100}%"></div>
          </div>
        </div>
        <div class="accuracy-metric">
          <span class="label">Expected Distance Error:</span>
          <span class="value">${accuracy.expectedDistanceError.toFixed(2)}m</span>
        </div>
        <div class="accuracy-metric">
          <span class="label">Expected Direction Error:</span>
          <span class="value">${accuracy.expectedDirectionError.toFixed(1)}°</span>
        </div>
        <div class="accuracy-metric">
          <span class="label">Distance Accuracy:</span>
          <span class="value">${(accuracy.distance * 100).toFixed(1)}%</span>
        </div>
        <div class="accuracy-metric">
          <span class="label">Direction Accuracy:</span>
          <span class="value">${(accuracy.direction * 100).toFixed(1)}%</span>
        </div>
      `;
    }
  }
}

// Auto-initialization for existing GameController
export function enhanceGameController(gameController) {
  if (gameController && !gameController._enhancedAccuracyExtension) {
    gameController._enhancedAccuracyExtension = new EnhancedAccuracyExtension(gameController);
    console.log("✓ GameController enhanced with detailed accuracy analysis");
  }
  return gameController;
}
