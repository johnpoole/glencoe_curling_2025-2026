# Integrating Shot Success Probabilities into curlingeval.js

## Overview

The current `curlingeval.js` assumes 100% shot execution success, which is unrealistic. The `curling_data.db` database contains shot-by-shot data with percentage scores (0-100%) that represent execution quality. This document outlines how to integrate empirical shot success probabilities to make the evaluator more realistic.

## Current State

### curlingeval.js Assumptions
- **Perfect Execution**: Every intended shot succeeds exactly as planned
- **Position-Only Evaluation**: Only considers stone positions, not execution risk
- **Static Skill Modeling**: Skill affects distribution spread but not success probability

### Available Database Information
```sql
-- Shot execution data structure
shots table:
- type: "Draw", "Take-out", "Hit and Roll", etc.
- percent_score: 0-100% execution quality  
- player_name, team, end context
- Associated stone positions before/after
```

## Enhancement Strategy

### 1. Empirical Success Rate Modeling

Extract base success rates by shot type from database:
```python
SELECT 
  type,
  AVG(percent_score) as avg_success,
  COUNT(*) as sample_size
FROM shots 
WHERE percent_score IS NOT NULL 
GROUP BY type
```

**Expected Results** (based on curling analytics):
- Draw shots: ~82% average success
- Take-outs: ~74% average success  
- Hit and Roll: ~68% average success
- Guards: ~85% average success
- Freeze attempts: ~61% average success

### 2. Situational Modifiers

Analyze how success rates vary by situation:

**Pressure Effects**:
- Hammer pressure (final stones): -8% success rate
- Steal attempts: -12% success rate
- Close games: Additional pressure penalty

**Game Context**:
- End number (fatigue effects)
- Shot number in end (setup vs. scoring)
- Current score differential

**Shot Complexity**:
- Number of stones in play
- Required angle precision
- Target distance from optimal

### 3. Enhanced Evaluation Logic

```javascript
function evaluateWithSuccessProbability(position, potentialShot) {
  // 1. Calculate shot success probability
  const successProb = calculateSuccessProbability({
    shotType: potentialShot.type,
    skillLevel: playerSkill,
    gameContext: currentSituation,
    shotComplexity: analyzeComplexity(potentialShot)
  });

  // 2. Evaluate success outcome
  const successValue = evaluatePosition17(resultingPosition);

  // 3. Evaluate failure outcome  
  const failureValue = evaluatePosition17(failurePosition);

  // 4. Return weighted expected value
  return {
    expectedValue: successProb * successValue + (1 - successProb) * failureValue,
    successProbability: successProb,
    scenarios: { success: successValue, failure: failureValue }
  };
}
```

## Implementation Plan

### Phase 1: Database Analysis
1. **Populate Database**: Run `populate_db.py` to fill `curling_data.db` with real shot data
2. **Extract Success Patterns**: Use `shot_success_analysis.py` to analyze success rates
3. **Calibrate Parameters**: Generate empirical constants for JavaScript integration

### Phase 2: Enhanced Evaluator
1. **Create `enhanced_curlingeval.js`**: Extended version with success probability modeling
2. **Shot Classification**: Automatically determine shot types from trajectory analysis
3. **Complexity Metrics**: Calculate angle difficulty, distance penalties, congestion effects

### Phase 3: Simulator Integration
1. **Enhanced Path Analysis**: Update `GameController.js` to use success-weighted evaluation
2. **Visual Feedback**: Color-code paths by both advantage and success probability
3. **Risk Display**: Show success percentages in hover tooltips and path metadata

### Phase 4: Advanced Features
1. **Player Profiles**: Individual skill modeling based on historical performance
2. **Learning System**: Update success models based on simulator usage patterns
3. **Uncertainty Quantification**: Confidence intervals on position evaluations

## Technical Architecture

```
curling_data.db (Shot execution data)
     ↓
shot_success_analysis.py (Empirical analysis)
     ↓
empirical_shot_parameters.js (Calibrated constants)
     ↓
enhanced_curlingeval.js (Success-aware evaluation)
     ↓
EnhancedGameController.js (Simulator integration)
     ↓
Enhanced UI (Risk-aware path visualization)
```

## Benefits of Integration

### More Realistic Strategy
- **Risk Assessment**: High-reward shots with low success probability properly weighted
- **Conservative Options**: Reliable shots valued appropriately
- **Skill Differentiation**: Different skill levels produce different optimal strategies

### Better Decision Support
- **Expected Value Optimization**: Choose shots based on weighted outcomes
- **Risk Tolerance**: Show both safe and aggressive options with their trade-offs
- **Learning Tool**: Understand why professionals choose certain shots

### Enhanced Analysis
- **Failure Mode Modeling**: Understand what happens when shots don't work
- **Pressure Response**: See how success rates change under pressure
- **Situational Awareness**: Context-dependent shot selection

## Example Output

```javascript
// Before (current): Only position value
{
  advantage: { red: 0.45, yellow: -0.45 },
  buckets17: { /* probability distribution */ }
}

// After (enhanced): Success-weighted evaluation  
{
  advantage: { red: 0.32, yellow: -0.32 }, // Reduced by failure risk
  buckets17: { /* adjusted distribution */ },
  successProbability: 0.73, // 73% chance of success
  expectedValue: 0.28, // Weighted by success/failure outcomes
  scenarios: {
    success: { advantage: { red: 0.45 } },
    failure: { advantage: { red: -0.15 } },
    current: { advantage: { red: 0.10 } }
  }
}
```

## Future Enhancements

### Machine Learning Integration
- **Shot Outcome Prediction**: Train models on trajectory → success probability
- **Player Behavior Modeling**: Learn individual player tendencies and skills
- **Dynamic Difficulty**: Adjust based on real-time performance feedback

### Advanced Failure Modeling
- **Partial Success**: Model shots that partially achieve their goal
- **Cascade Effects**: How one failure affects subsequent shot options
- **Recovery Strategies**: Optimize for minimizing damage from failures

### Real-Time Adaptation
- **Performance Tracking**: Update success models based on actual results
- **Fatigue Modeling**: Account for player energy levels throughout games
- **Pressure Calibration**: Individual responses to high-pressure situations

This integration transforms the simulator from a perfect-execution tool into a realistic decision support system that accounts for the inherent uncertainty in curling shot execution.