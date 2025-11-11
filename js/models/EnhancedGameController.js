// Integration example showing how to enhance the current GameController
// with shot success probability modeling

// Import the enhanced evaluator
import { evaluatePositionWithSuccessProbability, calculateShotSuccessProbability } from './analyze/enhanced_curlingeval.js';

// Enhanced version of the GameController's highlightBestAdvantagePath method
async function highlightBestAdvantagePathWithSuccess(pathRecords) {
  if (!Array.isArray(pathRecords) || pathRecords.length === 0) {
    return;
  }

  const toggle = document.getElementById("showNonContactPaths");
  const showNonContact = !toggle || toggle.checked;

  try {
    const hammerTeam = this.getHammerTeam();
    const shotNumber = Math.min(this.gameState.stonesThrown, 15);
    const baseStoneData = this.buildStoneData(this.stones);
    const teeX = this.sheetDimensions.TEE_X;
    const teamToThrow = this.currentTeam === "yellow" ? "yellow" : "red";

    let bestRecord = null;
    let bestExpectedValue = -Infinity;

    pathRecords.forEach(record => {
      if (!record || !record.trajectory || record.trajectory.length === 0) {
        return;
      }

      if (record.trajectory.stoppedOnSheet === false) {
        return;
      }

      if (!showNonContact && !record.makesContact) {
        return;
      }

      if (!record.pathSelection) {
        return;
      }

      const finalState = record.trajectory[record.trajectory.length - 1];
      if (!finalState) {
        return;
      }

      // Create hypothetical stone position after successful shot
      const hypotheticalData = baseStoneData.slice();
      hypotheticalData.push([teamToThrow, finalState.x - teeX, finalState.y]);

      // Determine shot type based on trajectory characteristics
      const shotType = classifyShotType(record, this.stones, finalState);
      
      // Calculate shot success probability
      const shotContext = {
        shotType: shotType,
        skillLevel: this.getSkillLevel(), // Get from UI or player profile
        shotNumber: shotNumber,
        gameScore: this.gameState.scores,
        endNumber: this.gameState.currentEnd,
        targetDistance: calculateTargetDistance(record, this.broomPos),
        angleComplexity: calculateAngleComplexity(record, this.stones),
        stoneCount: this.stones.length
      };

      const successProb = calculateShotSuccessProbability(shotContext);

      // Enhanced evaluation considering success probability
      const enhancedEval = evaluatePositionWithSuccessProbability(
        shotNumber, 
        hammerTeam, 
        baseStoneData, 
        this.getSkillLevel(),
        {
          type: shotType,
          outcome: { stones: hypotheticalData },
          targetDistance: shotContext.targetDistance,
          angleComplexity: shotContext.angleComplexity
        }
      );

      // Expected value considers both advantage and success probability
      const advantageValue = teamToThrow === "red" ? 
        enhancedEval.advantage.red : enhancedEval.advantage.yellow;
      
      const expectedValue = successProb * advantageValue + 
        (1 - successProb) * enhancedEval.scenarios.failure.advantage[teamToThrow];

      record.successProbability = successProb;
      record.expectedValue = expectedValue;
      record.shotType = shotType;

      if (record.pathData) {
        record.pathData.successProbability = successProb;
        record.pathData.expectedValue = expectedValue;
        record.pathData.shotType = shotType;
      }

      if (!bestRecord || expectedValue > bestExpectedValue) {
        bestExpectedValue = expectedValue;
        bestRecord = record;
      }
    });

    // Apply visual highlighting with success probability information
    pathRecords.forEach(record => {
      if (!record || !record.pathSelection) {
        return;
      }

      const isBest = record === bestRecord && isFinite(bestExpectedValue);
      
      // Color code by both advantage and success probability
      let strokeColor = record.color;
      if (isBest) {
        strokeColor = "#ff3b30"; // Red for best expected value
      } else if (record.successProbability && record.successProbability < 0.6) {
        strokeColor = "#ff9500"; // Orange for risky shots
      }
      
      record.pathSelection.style("stroke", strokeColor);

      // Add success probability and expected value to data attributes
      if (record.successProbability !== undefined) {
        record.pathSelection.attr("data-success-prob", 
          (record.successProbability * 100).toFixed(1) + "%");
      }
      if (record.expectedValue !== undefined) {
        record.pathSelection.attr("data-expected-value", 
          record.expectedValue.toFixed(3));
      }
      if (record.shotType) {
        record.pathSelection.attr("data-shot-type", record.shotType);
      }

      record.pathSelection.attr("data-best-expected", isBest ? "true" : null);
    });

    console.log(`Best path: ${bestRecord?.shotType} with ${(bestRecord?.successProbability * 100).toFixed(1)}% success probability`);
    
  } catch (error) {
    console.error("Error in enhanced advantage path highlighting:", error);
  }
}

// Helper functions for shot classification and analysis
function classifyShotType(record, existingStones, finalState) {
  const makesContact = record.makesContact;
  const velocity = record.velocity;
  const endPosition = { x: finalState.x, y: finalState.y };
  
  // Distance to button for classification
  const distanceToButton = Math.sqrt(endPosition.x * endPosition.x + endPosition.y * endPosition.y);
  
  if (makesContact) {
    if (velocity > 2.5) { // High velocity suggests takeout intent
      return "Take-out";
    } else if (distanceToButton > 1.5) {
      return "Hit and Roll";
    } else {
      return "Hit";
    }
  } else {
    if (distanceToButton < 1.83) { // Inside house
      return "Draw";
    } else if (endPosition.y > 2.0) { // Front of house
      return "Guard";  
    } else {
      return "Draw";
    }
  }
}

function calculateTargetDistance(record, broomPosition) {
  const finalState = record.trajectory[record.trajectory.length - 1];
  const dx = finalState.x - broomPosition.x;
  const dy = finalState.y - broomPosition.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function calculateAngleComplexity(record, stones) {
  if (!record.makesContact) {
    return 0; // No angle complexity for non-contact shots
  }
  
  // Simplified angle complexity based on number of nearby stones
  const finalState = record.trajectory[record.trajectory.length - 1];
  let complexity = 0;
  
  for (const stone of stones) {
    const distance = Math.sqrt(
      (stone.x - finalState.x) ** 2 + 
      (stone.y - finalState.y) ** 2
    );
    if (distance < 0.5) { // Within 50cm
      complexity += 0.2;
    }
  }
  
  return Math.min(complexity, 1.0); // Cap at 1.0
}

// Enhanced hover display for paths with success probability
function enhancePathHoverDisplay(pathData) {
  const originalHover = this.renderer.showPathHover;
  
  this.renderer.showPathHover = function(pathData, event) {
    // Call original hover display
    originalHover.call(this, pathData, event);
    
    // Add success probability information
    if (pathData.successProbability !== undefined) {
      const tooltip = d3.select("body").select(".path-tooltip");
      if (!tooltip.empty()) {
        tooltip.append("div")
          .html(`<strong>Success Probability:</strong> ${(pathData.successProbability * 100).toFixed(1)}%`);
        
        if (pathData.expectedValue !== undefined) {
          tooltip.append("div")
            .html(`<strong>Expected Value:</strong> ${pathData.expectedValue.toFixed(2)}`);
        }
        
        if (pathData.shotType) {
          tooltip.append("div")
            .html(`<strong>Shot Type:</strong> ${pathData.shotType}`);
        }
      }
    }
  };
}

// Integration with UI controls - add success probability visualization
function addSuccessProbabilityControls() {
  const controlsContainer = document.querySelector('.shot-exploration-controls');
  
  if (controlsContainer) {
    const successToggle = document.createElement('label');
    successToggle.innerHTML = `
      <input type="checkbox" id="showSuccessProbability" checked>
      Show Success Probability
    `;
    
    const riskFilter = document.createElement('label');
    riskFilter.innerHTML = `
      <input type="range" id="minSuccessThreshold" min="0" max="100" value="0" step="5">
      Min Success Rate: <span id="successThresholdValue">0%</span>
    `;
    
    controlsContainer.appendChild(successToggle);
    controlsContainer.appendChild(riskFilter);
    
    // Event listeners for new controls
    document.getElementById('showSuccessProbability').addEventListener('change', 
      () => this.updatePathVisibility());
      
    document.getElementById('minSuccessThreshold').addEventListener('input', (e) => {
      document.getElementById('successThresholdValue').textContent = e.target.value + '%';
      this.updatePathVisibility();
    });
  }
}