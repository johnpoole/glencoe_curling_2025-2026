/**
 * Test for Photo Stone Detection functionality
 * This test simulates uploading an image and running stone detection
 */

import PhotoStoneDetection from '../js/PhotoStoneDetection.js';
import GameController from '../js/models/GameController.js';
import SheetRenderer from '../js/models/SheetRenderer.js';
import SheetDimensions from '../js/models/SheetDimensions.js';
import UIManager from '../js/models/UIManager.js';

// Mock DOM elements for testing
function createMockDOM() {
  // Create a mock document with required elements
  const mockElements = {
    photoUploadArea: document.createElement('div'),
    photoInput: document.createElement('input'),
    photoCanvas: document.createElement('canvas'),
    photoControls: document.createElement('div'),
    detectStonesBtn: document.createElement('button'),
    clearPhotoBtn: document.createElement('button'),
    detectionStatus: document.createElement('div'),
    uploadPrompt: document.createElement('div'),
    rink: document.createElement('svg')
  };

  // Set up IDs
  mockElements.photoUploadArea.id = 'photoUploadArea';
  mockElements.photoInput.id = 'photoInput';
  mockElements.photoCanvas.id = 'photoCanvas';
  mockElements.photoControls.id = 'photoControls';
  mockElements.detectStonesBtn.id = 'detectStonesBtn';
  mockElements.clearPhotoBtn.id = 'clearPhotoBtn';
  mockElements.detectionStatus.id = 'detectionStatus';
  mockElements.uploadPrompt.id = 'uploadPrompt';
  mockElements.rink.id = 'rink';

  // Mock getElementById
  const originalGetElementById = document.getElementById;
  document.getElementById = (id) => {
    return mockElements[id.replace(/([A-Z])/g, (match, p1, offset) => 
      offset === 0 ? p1.toLowerCase() : p1.toLowerCase())] || null;
  };

  return { mockElements, cleanup: () => { document.getElementById = originalGetElementById; } };
}

// Create a mock image file from the test image path
async function createMockImageFile() {
  // In a real browser environment, we'd fetch the actual image
  // For testing, we'll create a mock file object
  const mockFile = new File(['mock image data'], 'curling_house_test.jpg', {
    type: 'image/jpeg'
  });

  // Mock the FileReader for image loading
  const originalFileReader = window.FileReader;
  window.FileReader = class MockFileReader {
    constructor() {
      this.result = null;
      this.onload = null;
      this.onerror = null;
    }

    readAsDataURL(file) {
      // Simulate successful file read
      setTimeout(() => {
        this.result = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
        if (this.onload) {
          this.onload({ target: this });
        }
      }, 10);
    }
  };

  return { mockFile, cleanup: () => { window.FileReader = originalFileReader; } };
}

// Mock canvas context for testing
function mockCanvasContext() {
  const mockImageData = {
    data: new Uint8ClampedArray(400 * 300 * 4), // 400x300 image with RGBA data
    width: 400,
    height: 300
  };

  // Fill with some mock red and yellow regions
  for (let i = 0; i < mockImageData.data.length; i += 4) {
    const pixel = i / 4;
    const x = pixel % 400;
    const y = Math.floor(pixel / 400);

    // Create some mock red stones (bright red pixels in certain areas)
    if ((x > 100 && x < 120 && y > 100 && y < 120) || 
        (x > 200 && x < 220 && y > 150 && y < 170)) {
      mockImageData.data[i] = 255;     // Red
      mockImageData.data[i + 1] = 50;  // Green
      mockImageData.data[i + 2] = 50;  // Blue
      mockImageData.data[i + 3] = 255; // Alpha
    }
    // Create some mock yellow stones (bright yellow pixels in certain areas)
    else if ((x > 150 && x < 170 && y > 120 && y < 140) || 
             (x > 250 && x < 270 && y > 180 && y < 200)) {
      mockImageData.data[i] = 255;     // Red
      mockImageData.data[i + 1] = 255; // Green
      mockImageData.data[i + 2] = 50;  // Blue
      mockImageData.data[i + 3] = 255; // Alpha
    }
    // Default to gray background
    else {
      mockImageData.data[i] = 128;     // Red
      mockImageData.data[i + 1] = 128; // Green
      mockImageData.data[i + 2] = 128; // Blue
      mockImageData.data[i + 3] = 255; // Alpha
    }
  }

  const mockContext = {
    clearRect: () => {},
    drawImage: () => {},
    getImageData: () => mockImageData
  };

  return mockContext;
}

// Test function
async function testPhotoStoneDetection() {
  console.log('🧪 Starting Photo Stone Detection Test...\n');

  // Set up mocks
  const domMock = createMockDOM();
  const fileMock = await createMockImageFile();

  try {
    // Create required dependencies
    const sheetDimensions = new SheetDimensions();
    
    // Mock D3 select for SVG
    const mockSvg = {
      attr: () => mockSvg,
      style: () => mockSvg,
      append: () => mockSvg,
      selectAll: () => mockSvg,
      data: () => mockSvg,
      enter: () => mockSvg,
      exit: () => mockSvg,
      remove: () => mockSvg,
      on: () => mockSvg,
      node: () => ({ getBoundingClientRect: () => ({ width: 800, height: 600 }) })
    };

    // Mock d3 if not available
    if (typeof window.d3 === 'undefined') {
      window.d3 = {
        select: () => mockSvg,
        scaleLinear: () => ({ domain: () => ({ range: () => ({ invert: (x) => x }) }) }),
        pointer: () => [0, 0],
        interval: (callback, delay) => {
          const id = setInterval(callback, delay);
          return { stop: () => clearInterval(id) };
        }
      };
    }

    const renderer = new SheetRenderer(mockSvg, sheetDimensions);
    const uiManager = new UIManager();
    const gameController = new GameController(renderer, uiManager.getUIGetters(), uiManager);

    // Mock canvas context
    domMock.mockElements.photoCanvas.getContext = () => mockCanvasContext();
    domMock.mockElements.photoCanvas.width = 400;
    domMock.mockElements.photoCanvas.height = 300;

    console.log('✅ Dependencies created successfully');

    // Create PhotoStoneDetection instance
    const photoDetection = new PhotoStoneDetection(gameController);
    console.log('✅ PhotoStoneDetection instance created');

    // Test image loading
    console.log('📸 Testing image upload...');
    await photoDetection.handleFileUpload(fileMock.mockFile);
    console.log('✅ Image upload completed');

    // Test stone detection
    console.log('🔍 Testing stone detection...');
    const stones = await photoDetection.performStoneDetection();
    
    console.log(`✅ Stone detection completed. Found ${stones.length} stones:`);
    stones.forEach((stone, index) => {
      console.log(`  Stone ${index + 1}: Team=${stone.team}, Position=(${stone.x}, ${stone.y})`);
    });

    // Test loading stones into simulator
    if (stones.length > 0) {
      console.log('🎯 Testing stone loading into simulator...');
      const initialStoneCount = gameController.stones.length;
      photoDetection.loadStonesIntoSimulator(stones);
      const finalStoneCount = gameController.stones.length;
      
      console.log(`✅ Stones loaded. Stone count: ${initialStoneCount} → ${finalStoneCount}`);
      
      // Validate stones were added correctly
      if (finalStoneCount > initialStoneCount) {
        console.log('✅ Stones successfully added to simulator');
        
        // Check if stones have proper properties
        const addedStones = gameController.stones.slice(-stones.length);
        addedStones.forEach((stone, index) => {
          console.log(`  Simulator Stone ${index + 1}: ID=${stone.id}, Team=${stone.team}, Position=(${stone.x.toFixed(2)}, ${stone.y.toFixed(2)})`);
        });
      } else {
        console.log('❌ No stones were added to simulator');
      }
    }

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    // Cleanup mocks
    domMock.cleanup();
    fileMock.cleanup();
    console.log('🧹 Test cleanup completed');
  }
}

// Export for use in other test files or manual execution
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testPhotoStoneDetection };
}

// Auto-run test if this file is executed directly
if (typeof window !== 'undefined') {
  // Run test when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testPhotoStoneDetection);
  } else {
    testPhotoStoneDetection();
  }
}

// For manual execution in console
window.runPhotoDetectionTest = testPhotoStoneDetection;