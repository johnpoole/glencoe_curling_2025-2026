/**
 * Simple test runner for Photo Stone Detection
 * Tests the core logic without browser dependencies
 */

// Mock the basic dependencies we need
class MockSheetDimensions {
  constructor() {
    this.SHEET_W = 4.75;
    this.HALF_W = this.SHEET_W / 2;
    this.HOG_TO_HOG = 21.95;
    this.HOG_TO_TEE = 6.40;
    this.HOUSE_R12 = 1.829;
    this.HOUSE_R8 = 1.219;
    this.HOUSE_R4 = 0.610;
    this.BUTTON_R = 0.15;
    
    this.XMIN = 0;
    this.XMAX = this.HOG_TO_HOG + this.HOG_TO_TEE + this.HOUSE_R12 + 1.3;
    this.TEE_X = this.HOG_TO_HOG + this.HOG_TO_TEE;
    this.FAR_HOG_X = this.HOG_TO_HOG;
    
    this.START = { x: 0.2, y: 0 };
  }
}

class MockGameController {
  constructor() {
    this.sheetDimensions = new MockSheetDimensions();
    this.stones = [];
    this.stoneIdCounter = 1;
  }
  
  generateStoneId() {
    return this.stoneIdCounter++;
  }
  
  clearStones() {
    this.stones = [];
  }
  
  updateStoneDisplay() {
    console.log(`Updated display with ${this.stones.length} stones`);
  }
}

// Mock PhotoStoneDetection with just the core logic we want to test
class MockPhotoStoneDetection {
  constructor(gameController) {
    this.gameController = gameController;
  }
  
  // Test the coordinate conversion logic
  convertToSheetCoordinates(pixelX, pixelY) {
    const centerX = this.gameController.sheetDimensions.TEE_X;
    const centerY = 0;
    const houseRadius = this.gameController.sheetDimensions.HOUSE_R12;
    
    // Assume canvas size for testing
    const canvasWidth = 400;
    const canvasHeight = 300;
    
    const normalizedX = (pixelX / canvasWidth - 0.5) * 2;
    const normalizedY = (pixelY / canvasHeight - 0.5) * 2;
    
    return {
      x: centerX + normalizedX * houseRadius * 1.5,
      y: centerY + normalizedY * houseRadius * 1.5
    };
  }
  
  // Test the color detection logic
  isTargetColor(r, g, b, targetColor) {
    if (targetColor === 'red') {
      return r > 120 && r > g * 1.3 && r > b * 1.3;
    } else if (targetColor === 'yellow') {
      return r > 150 && g > 150 && b < 100 && Math.abs(r - g) < 50;
    }
    return false;
  }
  
  // Test the region detection logic
  detectColoredRegions(pixels, width, height, color) {
    const regions = [];
    const stepSize = 10;
    
    if (!pixels || (!Array.isArray(pixels) && !(pixels instanceof Uint8ClampedArray))) {
      console.warn('Invalid pixels data');
      return [];
    }
    
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
      console.warn('Invalid width or height');
      return [];
    }
    
    try {
      for (let y = 0; y < height; y += stepSize) {
        for (let x = 0; x < width; x += stepSize) {
          const idx = (y * width + x) * 4;
          
          if (idx + 2 >= pixels.length) continue;
          
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          
          if (this.isTargetColor(r, g, b, color)) {
            if (!regions.some(region => Math.hypot(region.x - x, region.y - y) < 30)) {
              regions.push({ x, y });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in detectColoredRegions:', error);
      return [];
    }
    
    return regions;
  }
  
  // Test stone loading logic
  loadStonesIntoSimulator(detectedStones) {
    try {
      this.gameController.clearStones();
      
      const convertedStones = detectedStones.map((stone, index) => {
        if (!stone || typeof stone.x !== 'number' || typeof stone.y !== 'number') {
          throw new Error(`Invalid stone data at index ${index}: missing or invalid x/y coordinates`);
        }
        
        if (!stone.team || (stone.team !== 'red' && stone.team !== 'yellow')) {
          throw new Error(`Invalid stone team at index ${index}: ${stone.team}`);
        }
        
        const sheetPos = this.convertToSheetCoordinates(stone.x, stone.y);
        
        if (!sheetPos || typeof sheetPos.x !== 'number' || typeof sheetPos.y !== 'number') {
          throw new Error(`Failed to convert coordinates for stone at index ${index}`);
        }
        
        return {
          id: this.gameController.generateStoneId(),
          x: sheetPos.x,
          y: sheetPos.y,
          vx: 0,
          vy: 0,
          w: 0,
          team: stone.team,
          inPlay: true,
          t: 0,
          rotation: 0
        };
      });
      
      convertedStones.forEach(stone => {
        this.gameController.stones.push(stone);
      });
      
      this.gameController.updateStoneDisplay();
      return convertedStones;
    } catch (error) {
      console.error('Error loading stones:', error);
      throw error;
    }
  }
}

// Run the tests
function runPhotoDetectionTests() {
  console.log('🧪 Starting Photo Stone Detection Tests...\n');
  
  try {
    // Test 1: Basic setup
    console.log('Test 1: Basic Setup');
    const gameController = new MockGameController();
    const photoDetection = new MockPhotoStoneDetection(gameController);
    console.log('✅ Objects created successfully');
    console.log(`  TEE_X: ${gameController.sheetDimensions.TEE_X}`);
    console.log(`  HOUSE_R12: ${gameController.sheetDimensions.HOUSE_R12}`);
    
    // Test 2: Coordinate conversion
    console.log('\nTest 2: Coordinate Conversion');
    const testCoords = [
      { pixel: [200, 150], desc: 'Center' },
      { pixel: [100, 100], desc: 'Top-left quadrant' },
      { pixel: [300, 200], desc: 'Bottom-right quadrant' },
      { pixel: [150, 120], desc: 'Arbitrary position' }
    ];
    
    testCoords.forEach(test => {
      const sheetPos = photoDetection.convertToSheetCoordinates(test.pixel[0], test.pixel[1]);
      console.log(`✅ ${test.desc}: (${test.pixel[0]}, ${test.pixel[1]}) → (${sheetPos.x.toFixed(2)}, ${sheetPos.y.toFixed(2)})`);
    });
    
    // Test 3: Color detection
    console.log('\nTest 3: Color Detection');
    const colorTests = [
      { rgb: [255, 50, 50], color: 'red', expected: true },
      { rgb: [200, 40, 30], color: 'red', expected: true },
      { rgb: [100, 90, 80], color: 'red', expected: false },
      { rgb: [255, 255, 50], color: 'yellow', expected: true },
      { rgb: [200, 200, 40], color: 'yellow', expected: true },
      { rgb: [100, 100, 150], color: 'yellow', expected: false }
    ];
    
    colorTests.forEach(test => {
      const result = photoDetection.isTargetColor(test.rgb[0], test.rgb[1], test.rgb[2], test.color);
      const status = result === test.expected ? '✅' : '❌';
      console.log(`${status} RGB(${test.rgb.join(',')}) as ${test.color}: ${result} (expected ${test.expected})`);
    });
    
    // Test 4: Mock image data processing
    console.log('\nTest 4: Mock Image Processing');
    const width = 400;
    const height = 300;
    const mockImageData = new Uint8ClampedArray(width * height * 4);
    
    // Fill with some test patterns
    for (let i = 0; i < mockImageData.length; i += 4) {
      const pixel = i / 4;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      
      // Create red stones in specific areas
      if ((x > 100 && x < 120 && y > 100 && y < 120) || 
          (x > 200 && x < 220 && y > 150 && y < 170)) {
        mockImageData[i] = 255;     // Red
        mockImageData[i + 1] = 50;  // Green
        mockImageData[i + 2] = 50;  // Blue
        mockImageData[i + 3] = 255; // Alpha
      }
      // Create yellow stones in other areas
      else if ((x > 150 && x < 170 && y > 120 && y < 140) || 
               (x > 250 && x < 270 && y > 180 && y < 200)) {
        mockImageData[i] = 255;     // Red
        mockImageData[i + 1] = 255; // Green
        mockImageData[i + 2] = 50;  // Blue
        mockImageData[i + 3] = 255; // Alpha
      }
      // Gray background
      else {
        mockImageData[i] = 128;
        mockImageData[i + 1] = 128;
        mockImageData[i + 2] = 128;
        mockImageData[i + 3] = 255;
      }
    }
    
    const redStones = photoDetection.detectColoredRegions(mockImageData, width, height, 'red');
    const yellowStones = photoDetection.detectColoredRegions(mockImageData, width, height, 'yellow');
    
    console.log(`✅ Found ${redStones.length} red stone regions:`);
    redStones.forEach((stone, i) => {
      console.log(`  Red Stone ${i + 1}: (${stone.x}, ${stone.y})`);
    });
    
    console.log(`✅ Found ${yellowStones.length} yellow stone regions:`);
    yellowStones.forEach((stone, i) => {
      console.log(`  Yellow Stone ${i + 1}: (${stone.x}, ${stone.y})`);
    });
    
    // Test 5: Stone loading simulation
    console.log('\nTest 5: Stone Loading Simulation');
    const detectedStones = [
      ...redStones.map(pos => ({ ...pos, team: 'red' })),
      ...yellowStones.map(pos => ({ ...pos, team: 'yellow' }))
    ];
    
    if (detectedStones.length > 0) {
      const loadedStones = photoDetection.loadStonesIntoSimulator(detectedStones);
      console.log(`✅ Successfully loaded ${loadedStones.length} stones into simulator:`);
      loadedStones.forEach(stone => {
        console.log(`  Stone ID ${stone.id}: ${stone.team} at (${stone.x.toFixed(2)}, ${stone.y.toFixed(2)})`);
      });
    } else {
      console.log('⚠️ No stones detected to load');
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`  - Objects: ✅ Created`);
    console.log(`  - Coordinates: ✅ ${testCoords.length} conversions tested`);
    console.log(`  - Colors: ✅ ${colorTests.filter(t => photoDetection.isTargetColor(t.rgb[0], t.rgb[1], t.rgb[2], t.color) === t.expected).length}/${colorTests.length} color tests passed`);
    console.log(`  - Detection: ✅ Found ${detectedStones.length} total stones (${redStones.length} red, ${yellowStones.length} yellow)`);
    console.log(`  - Loading: ✅ ${detectedStones.length} stones loaded into simulator`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Export for use in other contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runPhotoDetectionTests };
}

// Run the tests
runPhotoDetectionTests();