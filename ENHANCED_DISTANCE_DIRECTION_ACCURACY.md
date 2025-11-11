# Enhanced Shot Accuracy: Distance and Direction Analysis for World Curling Data

## Overview

Instead of using simple success/failure or percentage scores, this enhanced approach captures **distance and direction accuracy metrics** from World Curling Federation data to provide more nuanced shot analysis for the curlingeval.js simulator.

## Current vs Enhanced Approach

### Current System
- **Binary Success**: Shot succeeds (100%) or fails (0%)
- **Percentage Score**: 0-100% overall execution quality
- **Limited Insight**: Can't distinguish between different types of errors

### Enhanced System  
- **Distance Accuracy**: How far from intended target (meters)
- **Direction Accuracy**: Angular deviation from intended path (degrees)
- **Error Categorization**: Short/long, left/right, magnitude classification
- **Failure Mode Analysis**: Different ways shots can miss and their consequences

## Database Schema Enhancements

### New Tables

```sql
-- Detailed accuracy metrics for each shot
shot_accuracy_metrics:
- target_distance_error REAL    -- meters from intended target
- path_direction_error REAL     -- angular deviation in degrees  
- distance_category TEXT        -- 'short', 'long', 'on_target'
- direction_category TEXT       -- 'left', 'right', 'on_line'
- error_magnitude TEXT          -- 'minor', 'moderate', 'major'
- outcome_success BOOLEAN       -- did shot achieve intended outcome
- partial_success_score REAL    -- 0-1 scale for partial success

-- Enhanced shot intention analysis  
shot_intentions:
- intended_final_position_x/y   -- where stone should end up
- ideal_velocity REAL           -- optimal speed for shot
- margin_for_error REAL         -- acceptable deviation radius
- risk_level TEXT               -- 'low', 'medium', 'high'

-- Stone movement tracking
stone_movements:
- displacement_distance REAL    -- how far stone moved
- displacement_direction REAL   -- angle of movement
- movement_type TEXT            -- 'removed', 'displaced', 'stationary'
```

### Enhanced Views

```sql
-- Player accuracy patterns
player_accuracy_stats:
- avg_distance_error by shot type
- avg_direction_error by shot type  
- success_rate and consistency metrics
- Error pattern analysis (short/long bias, left/right bias)
```

## Target Inference Algorithm

Since World Curling data doesn't explicitly state shot intentions, we infer targets from context:

### Draw Shots
- **Target**: Button area or final stone position (if successful)
- **Confidence**: High if stone ends in house, medium otherwise

### Take-out Shots  
- **Target**: Position of stone that was removed
- **Confidence**: Very high if stone removed, lower if miss

### Guard Shots
- **Target**: Strategic position between hog line and house
- **Confidence**: High if stone ends in guard zone

### Hit and Roll
- **Target**: Final position of thrown stone after successful hit
- **Confidence**: Medium (complex shot with multiple objectives)

### Freeze Shots
- **Target**: Position just behind target stone
- **Confidence**: High if successful freeze achieved

## Accuracy Metrics Calculation

### Distance Error
```python
target_distance_error = sqrt(
    (final_x - target_x)² + (final_y - target_y)²
)

distance_category = {
    ≤ 0.20m: 'on_target',
    ≤ 0.50m: 'close', 
    ≤ 1.00m: 'moderate',
    > 1.00m: 'large'
}
```

### Direction Error  
```python
target_angle = arctan2(target_y, target_x)
final_angle = arctan2(final_y, final_x)
path_direction_error = |target_angle - final_angle|

direction_category = {
    ≤ 3.0°: 'on_line',
    ≤ 8.0°: 'slight',
    ≤ 15.0°: 'moderate', 
    > 15.0°: 'large'
}
```

### Composite Accuracy Score
```python
if outcome_success:
    accuracy = base_score + precision_bonus
else:
    accuracy = partial_success_score * penalty_factor
```

## Enhanced curlingeval.js Integration

### Detailed Probability Modeling

```javascript
// Instead of single success probability
successProbability = 0.73

// Enhanced breakdown
detailedProbability = {
    overall: 0.73,
    distance: 0.85,           // 85% chance of acceptable distance
    direction: 0.86,          // 86% chance of acceptable direction  
    expectedDistanceError: 0.15,  // Expected 15cm error
    expectedDirectionError: 2.3   // Expected 2.3° error
}
```

### Failure Mode Analysis

```javascript
failureScenarios = [
    {
        type: 'short',
        probability: 0.12,     // 12% chance of being short
        impact: -0.15          // Position value penalty
    },
    {
        type: 'direction_miss',
        probability: 0.10,     // 10% chance of direction miss
        impact: -0.08          // Smaller penalty
    }
]
```

### Enhanced Path Visualization

```javascript
// Color coding by accuracy type
if (distance_error < 0.2 && direction_error < 3.0) {
    pathColor = "#34c759";     // Green - high accuracy
} else if (distance_error > 0.5 || direction_error > 8.0) {
    pathColor = "#ff9500";     // Orange - risky shot
} else {
    pathColor = "#007aff";     // Blue - moderate accuracy
}

// Hover information
tooltip = `
    Success: ${overallProb}%
    Distance: ±${expectedDistanceError}m  
    Direction: ±${expectedDirectionError}°
    Risk Level: ${riskCategory}
`;
```

## Expected Analysis Results

Based on curling analytics research, we would expect to find:

### Distance Accuracy Patterns
- **Draw shots**: 82% within 25cm, average error 15cm, slight short bias
- **Take-outs**: 74% successful contact, 18cm average miss distance  
- **Guards**: 85% reach guard zone, 12cm placement error
- **Freeze attempts**: 61% successful, 35cm average error

### Direction Accuracy Patterns
- **Overall**: 3.2° average direction error with right-hand bias
- **Pressure situations**: +15% direction error increase
- **Complex house**: +22% direction error increase  
- **Player handedness**: Left vs right-handed error patterns

### Situational Effects
- **End-game pressure**: +8% distance error, +12% direction error
- **Fatigue (late ends)**: +5% distance error, +3% direction error
- **Ice conditions**: Fast ice = better distance, worse direction control

## Benefits Over Current System

### 1. **Realistic Strategy Analysis**
- Account for specific error tendencies (short vs long, left vs right)
- Choose shots based on player-specific accuracy patterns
- Optimize for acceptable error margins rather than perfect execution

### 2. **Better Risk Assessment**  
- Distinguish between "safe miss" and "costly miss" scenarios
- Quantify trade-offs between aggressive and conservative shots
- Account for shot difficulty in decision making

### 3. **Enhanced Learning**
- Identify specific areas for improvement (distance vs direction)
- Understand why certain shots are chosen by professionals
- Practice shot selection based on personal accuracy patterns

### 4. **Adaptive Simulation**
- Adjust strategy based on demonstrated accuracy patterns
- Account for pressure, fatigue, and situational factors
- Model individual player strengths and weaknesses

## Implementation Roadmap

### Phase 1: Data Processing (Completed)
- ✅ Enhanced database schema created
- ✅ Target inference algorithm implemented
- ✅ Accuracy metrics calculation system built

### Phase 2: Analysis Integration
- 🔄 Populate database with World Curling shot data
- 🔄 Calculate distance/direction metrics for historical shots
- 🔄 Build empirical accuracy models by shot type and situation

### Phase 3: Simulator Enhancement
- 🔄 Integrate detailed probability calculations
- 🔄 Enhanced path visualization with accuracy indicators
- 🔄 Failure scenario modeling and display

### Phase 4: Advanced Features
- 🔄 Player-specific accuracy profiles
- 🔄 Adaptive learning from simulator usage
- 🔄 Real-time accuracy feedback and coaching

## Usage Example

```javascript
// Current system
path = {
    advantage: 0.45,
    successProbability: 0.73
}

// Enhanced system  
path = {
    advantage: 0.32,                    // Reduced by failure risk
    detailedProbability: {
        overall: 0.73,
        distance: 0.85,
        direction: 0.86,
        expectedDistanceError: 0.15,    // ±15cm
        expectedDirectionError: 2.3     // ±2.3°
    },
    failureScenarios: [
        { type: 'short', probability: 0.12, impact: -0.15 },
        { type: 'wide', probability: 0.10, impact: -0.08 },
        { type: 'miss', probability: 0.05, impact: -0.25 }
    ],
    riskAssessment: {
        safeMiss: true,                 // Missing won't be catastrophic
        marginForError: 0.20,           // 20cm acceptable error
        alternativeShots: 2             // Other viable options available
    }
}
```

This enhanced approach transforms the simulator from a perfect-execution tool into a realistic decision support system that accounts for the inherent uncertainty and skill variations in curling shot execution, providing much more valuable analysis for strategy development and player training.