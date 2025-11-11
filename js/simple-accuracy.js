/**
 * Simple accuracy display using actual World Curling database data
 */

// Real accuracy data from the database analysis
const REAL_ACCURACY_DATA = {
  "Draw": { avgDistError: 0.141321, avgDirError: 5.329533, sampleCount: 36 },
  "Take-out": { avgDistError: 2.136815, avgDirError: 66.557844, sampleCount: 10 },
  "Guard": { avgDistError: 0.000000, avgDirError: 0.000000, sampleCount: 10 },
  "Hit and Roll": { avgDistError: 0.000000, avgDirError: 0.000000, sampleCount: 8 }
};

// Get current shot parameters from the UI
function getCurrentShotParams() {
  const weight = parseFloat(document.getElementById('V0')?.value || 1.93); // m/s
  const omega = parseFloat(document.getElementById('omega0')?.value || 1.45); // rad/s
  const turn = document.getElementById('turn')?.value || 'out';
  const sweep = parseFloat(document.getElementById('sweep')?.value || 1.0);
  
  return { weight, omega, turn, sweep };
}

// Determine shot type based on weight (matching typical curling weights)
function getShotType(weight) {
  if (weight < 1.9) return "Draw";
  if (weight < 2.3) return "Guard";
  if (weight < 2.7) return "Hit and Roll";
  return "Take-out";
}

// Get accuracy data for shot type from real database
function getAccuracyForShot(shotType, weight) {
  const data = REAL_ACCURACY_DATA[shotType];
  if (!data) return { distError: 0.15, dirError: 3.0, confidence: 0.7 };
  
  // Use actual database values
  const distError = data.avgDistError;
  const dirError = data.avgDirError;
  
  // Calculate confidence based on sample size and weight deviation
  const optimalWeight = 2.0;
  const weightDeviation = Math.abs(weight - optimalWeight);
  const sampleConfidence = Math.min(1.0, data.sampleCount / 30.0);
  const weightPenalty = Math.max(0.5, 1.0 - (weightDeviation * 0.3));
  
  return {
    distError: distError,
    dirError: dirError,
    confidence: sampleConfidence * weightPenalty,
    sampleSize: data.sampleCount
  };
}

// Update accuracy display with real database data
function updateAccuracyDisplay() {
  const accuracyMetrics = document.getElementById("accuracyMetrics");
  if (!accuracyMetrics) return;
  
  const params = getCurrentShotParams();
  const shotType = getShotType(params.weight);
  const accuracy = getAccuracyForShot(shotType, params.weight);
  
  const confidencePercent = (accuracy.confidence * 100).toFixed(0);
  const difficulty = accuracy.confidence > 0.7 ? 'easy' : accuracy.confidence > 0.5 ? 'medium' : 'hard';
  const difficultyText = accuracy.confidence > 0.7 ? 'Easy' : accuracy.confidence > 0.5 ? 'Medium' : 'Hard';
  
  accuracyMetrics.innerHTML = `
    <div class="accuracy-metric">
      <span class="label">Shot Type:</span>
      <span class="value">${shotType} (${params.weight.toFixed(2)} m/s)</span>
      <span class="shot-difficulty difficulty-${difficulty}">${difficultyText}</span>
    </div>
    <div class="accuracy-metric">
      <span class="label">Success Confidence:</span>
      <span class="value">${confidencePercent}%</span>
      <div class="accuracy-bar">
        <div class="accuracy-bar-fill" style="width: ${confidencePercent}%"></div>
      </div>
    </div>
    <div class="accuracy-metric">
      <span class="label">Distance Error (DB):</span>
      <span class="value">${accuracy.distError.toFixed(3)}m</span>
    </div>
    <div class="accuracy-metric">
      <span class="label">Direction Error (DB):</span>
      <span class="value">${accuracy.dirError.toFixed(1)}°</span>
    </div>
    <div class="accuracy-metric">
      <span class="label">Database Samples:</span>
      <span class="value">${accuracy.sampleSize} shots</span>
    </div>
    <div class="accuracy-metric">
      <span class="label">Data Source:</span>
      <span class="value">World Curling</span>
    </div>
  `;
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  // Show initial accuracy display
  updateAccuracyDisplay();
  
  // Update immediately when any parameter changes
  const inputs = document.querySelectorAll('#V0, #omega0, #turn, #sweep');
  inputs.forEach(input => {
    input.addEventListener('input', updateAccuracyDisplay);
    input.addEventListener('change', updateAccuracyDisplay);
  });
  
  // Update when paths are generated
  const showPathsBtn = document.getElementById('showPathsBtn');
  if (showPathsBtn) {
    showPathsBtn.addEventListener('click', function() {
      setTimeout(updateAccuracyDisplay, 100);
    });
  }
});