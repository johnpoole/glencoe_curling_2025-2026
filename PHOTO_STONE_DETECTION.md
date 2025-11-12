# Photo Stone Detection Feature

## Overview
The photo stone detection feature allows users to upload overhead photos of a curling house and automatically detect stone positions to load them into the simulator. This is incredibly useful for analyzing real game situations.

## Current Implementation Status

### ✅ Completed Features
1. **Photo Upload Interface**: Drag & drop or click-to-browse file upload with preview
2. **Basic Image Processing**: Load and display images with proper scaling
3. **Simulator Integration**: Clear existing stones and load detected positions
4. **User Interface**: Status messages, controls, and visual feedback

### 🔧 Basic Implementation 
The current version includes a simplified computer vision pipeline that:
- Detects red and yellow colored regions using basic color thresholds
- Maps pixel coordinates to curling sheet positions
- Loads detected stones into the simulator

### 🚧 Areas for Enhancement

## Technical Architecture

### Files Added
- `js/PhotoStoneDetection.js` - Main module for photo processing
- Updated `index.html` - Photo upload UI section
- Updated `js/app.js` - Integration with main application

### Key Components

#### 1. PhotoStoneDetection Class
```javascript
class PhotoStoneDetection {
  constructor(gameController)    // Initialize with game controller reference
  handleFileUpload(file)         // Process uploaded image files
  detectStones()                 // Run stone detection algorithm
  loadStonesIntoSimulator(stones) // Transfer results to simulator
}
```

#### 2. User Interface Elements
- **Upload Area**: Drag & drop zone with visual feedback
- **Canvas Preview**: Displays uploaded image with detection overlay
- **Control Buttons**: Detect stones, clear photo
- **Status Display**: Progress and error messages

## Usage Instructions

### Basic Workflow
1. **Take Photo**: Capture overhead view of curling house
   - Best lighting: Even, bright illumination
   - Angle: Directly overhead or slight angle
   - Include: Full house circles and all stones

2. **Upload Photo**: 
   - Drag image file to upload area, or
   - Click upload area to browse files
   - Supports: JPG, PNG, and most image formats

3. **Detect Stones**: Click "Detect Stones" button
   - Algorithm analyzes image for stone-like objects
   - Color detection identifies red vs yellow teams

4. **Review Results**: Detected stones appear on simulator
   - Positions mapped to curling sheet coordinates
   - Ready for analysis or continuation of play

### Tips for Best Results
- **Lighting**: Avoid shadows and reflections
- **Contrast**: Clear distinction between stones and ice
- **Angle**: Minimize perspective distortion
- **Quality**: Higher resolution images work better

## Technical Implementation Details

### Current Detection Algorithm
```javascript
// Simplified color-based detection
detectColoredRegions(pixels, width, height, color) {
  // Sample pixels looking for target colors
  // Red stones: R > 120, R > 1.3*G, R > 1.3*B
  // Yellow stones: R,G > 150, B < 100, |R-G| < 50
}
```

### Coordinate Transformation
```javascript
convertToSheetCoordinates(pixelX, pixelY) {
  // Map canvas coordinates to curling sheet
  // Currently: Simple linear mapping to house area
  // Future: Perspective correction with reference points
}
```

## Advanced Enhancement Opportunities

### 1. Computer Vision Improvements
**Current**: Basic color detection
**Future**: OpenCV.js integration for:
- Circle detection (Hough transforms)
- Edge detection for stone boundaries
- Template matching for stone recognition
- Shadow and reflection handling

```javascript
// Example OpenCV.js integration
import cv from 'opencv.js';

detectStonesWithOpenCV(imageData) {
  // Convert to OpenCV format
  // Apply Gaussian blur
  // Use HoughCircles for stone detection
  // Color classification for team assignment
}
```

### 2. Perspective Correction
**Current**: Simple coordinate mapping
**Future**: Geometric transformation based on:
- House circle detection as reference
- Perspective correction matrix
- Automatic calibration from known dimensions

### 3. Machine Learning Approach
**Potential**: Train neural network for stone detection
- Dataset: Labeled curling images
- Model: Object detection (YOLO, SSD)
- Benefits: Handles complex lighting and angles

### 4. Interactive Validation
**Enhancement**: Manual correction interface
- Click to add/remove detected stones
- Drag to adjust positions
- Team assignment correction
- Confidence scoring display

## Development Roadmap

### Phase 1: Enhanced Computer Vision ✅ (Current)
- [x] Basic photo upload and processing
- [x] Simple color-based stone detection
- [x] Simulator integration

### Phase 2: Improved Detection 🔧
- [ ] OpenCV.js integration
- [ ] Circle detection algorithms
- [ ] Better color classification
- [ ] Shadow/reflection handling

### Phase 3: Perspective Correction 📋
- [ ] House circle detection
- [ ] Automatic perspective correction
- [ ] Camera angle compensation
- [ ] Distortion correction

### Phase 4: Interactive Validation 📋
- [ ] Manual position adjustment
- [ ] Detection confidence display
- [ ] Error correction interface
- [ ] Batch processing for multiple images

### Phase 5: Advanced Features 📋
- [ ] Video frame analysis
- [ ] Motion tracking between shots
- [ ] Automatic game state recognition
- [ ] Integration with shot analysis

## Code Extension Examples

### Adding OpenCV.js
```html
<!-- In index.html head section -->
<script async src="https://docs.opencv.org/4.8.0/opencv.js"></script>
```

```javascript
// Enhanced detection with OpenCV
async performAdvancedDetection() {
  const src = cv.imread(this.canvas);
  const gray = new cv.Mat();
  const circles = new cv.Mat();
  
  // Convert to grayscale
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  
  // Gaussian blur
  cv.GaussianBlur(gray, gray, new cv.Size(9, 9), 2, 2);
  
  // Hough circle detection
  cv.HoughCircles(gray, circles, cv.HOUGH_GRADIENT, 1, 20, 50, 30, 10, 50);
  
  // Process detected circles
  return this.processDetectedCircles(circles);
}
```

### Adding Interactive Validation
```javascript
addInteractiveValidation() {
  this.canvas.addEventListener('click', (e) => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking existing stone (remove)
    // Or empty area (add stone)
    this.handleManualStoneEdit(x, y);
  });
}
```

## Testing and Validation

### Test Images
Create test suite with:
- Various lighting conditions
- Different camera angles  
- Multiple stone configurations
- Challenging scenarios (shadows, reflections)

### Performance Metrics
- Detection accuracy (true positives)
- False positive rate
- Processing time
- User satisfaction

## Conclusion
The photo stone detection feature provides a solid foundation for computer vision-based curling analysis. The current implementation offers immediate utility while providing a platform for sophisticated enhancements. The modular design allows incremental improvements without affecting core simulator functionality.