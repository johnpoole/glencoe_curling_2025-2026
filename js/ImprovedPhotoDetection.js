/**
 * Real Image Analysis Tool
 * Analyzes the actual test image to understand why detection isn't working
 */

// First, let's create a tool to analyze the actual image colors and positions
function createImageAnalyzer() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  return {
    async analyzeImage(imageFile) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          // Set canvas size to match image
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw image to canvas
          ctx.drawImage(img, 0, 0);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Analyze the image
          const analysis = this.analyzeImageData(imageData, canvas.width, canvas.height);
          resolve(analysis);
        };
        img.onerror = reject;
        
        // Load the image
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target.result;
        };
        reader.readAsDataURL(imageFile);
      });
    },
    
    analyzeImageData(imageData, width, height) {
      const pixels = imageData.data;
      const analysis = {
        dimensions: { width, height },
        colorRanges: {
          red: { min: { r: 255, g: 255, b: 255 }, max: { r: 0, g: 0, b: 0 }, samples: [] },
          yellow: { min: { r: 255, g: 255, b: 255 }, max: { r: 0, g: 0, b: 0 }, samples: [] },
          other: { samples: [] }
        },
        brightestPixels: [],
        darkestPixels: [],
        averageColor: { r: 0, g: 0, b: 0 }
      };
      
      let totalR = 0, totalG = 0, totalB = 0;
      const sampleStep = 50; // Sample every 50 pixels for analysis
      
      for (let i = 0; i < pixels.length; i += 4 * sampleStep) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        
        if (r === undefined) continue;
        
        totalR += r;
        totalG += g;
        totalB += b;
        
        const pixel = i / 4;
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        
        // Check if this might be a red stone
        if (this.mightBeRedStone(r, g, b)) {
          analysis.colorRanges.red.samples.push({ x, y, r, g, b });
          analysis.colorRanges.red.min.r = Math.min(analysis.colorRanges.red.min.r, r);
          analysis.colorRanges.red.min.g = Math.min(analysis.colorRanges.red.min.g, g);
          analysis.colorRanges.red.min.b = Math.min(analysis.colorRanges.red.min.b, b);
          analysis.colorRanges.red.max.r = Math.max(analysis.colorRanges.red.max.r, r);
          analysis.colorRanges.red.max.g = Math.max(analysis.colorRanges.red.max.g, g);
          analysis.colorRanges.red.max.b = Math.max(analysis.colorRanges.red.max.b, b);
        }
        
        // Check if this might be a yellow stone
        if (this.mightBeYellowStone(r, g, b)) {
          analysis.colorRanges.yellow.samples.push({ x, y, r, g, b });
          analysis.colorRanges.yellow.min.r = Math.min(analysis.colorRanges.yellow.min.r, r);
          analysis.colorRanges.yellow.min.g = Math.min(analysis.colorRanges.yellow.min.g, g);
          analysis.colorRanges.yellow.min.b = Math.min(analysis.colorRanges.yellow.min.b, b);
          analysis.colorRanges.yellow.max.r = Math.max(analysis.colorRanges.yellow.max.r, r);
          analysis.colorRanges.yellow.max.g = Math.max(analysis.colorRanges.yellow.max.g, g);
          analysis.colorRanges.yellow.max.b = Math.max(analysis.colorRanges.yellow.max.b, b);
        }
        
        // Track brightest and darkest pixels
        const brightness = (r + g + b) / 3;
        if (brightness > 200) {
          analysis.brightestPixels.push({ x, y, r, g, b, brightness });
        } else if (brightness < 50) {
          analysis.darkestPixels.push({ x, y, r, g, b, brightness });
        }
        
        // Sample some other pixels for reference
        if (analysis.colorRanges.other.samples.length < 100) {
          analysis.colorRanges.other.samples.push({ x, y, r, g, b });
        }
      }
      
      const sampleCount = pixels.length / (4 * sampleStep);
      analysis.averageColor.r = Math.round(totalR / sampleCount);
      analysis.averageColor.g = Math.round(totalG / sampleCount);
      analysis.averageColor.b = Math.round(totalB / sampleCount);
      
      // Sort samples by position to understand image layout
      analysis.brightestPixels.sort((a, b) => b.brightness - a.brightness);
      analysis.darkestPixels.sort((a, b) => a.brightness - b.brightness);
      
      return analysis;
    },
    
    mightBeRedStone(r, g, b) {
      // Much more lenient red detection for analysis
      return r > 80 && (r > g + 20 || r > b + 20);
    },
    
    mightBeYellowStone(r, g, b) {
      // Much more lenient yellow detection for analysis
      return (r + g) > 160 && r > 80 && g > 80 && b < (r + g) / 2;
    }
  };
}

// Create an improved PhotoStoneDetection with better algorithms
class ImprovedPhotoStoneDetection {
  constructor(gameController) {
    this.gameController = gameController;
    this.analyzer = createImageAnalyzer();
  }
  
  async analyzeUploadedImage(imageFile) {
    console.log('🔍 Analyzing uploaded image...');
    const analysis = await this.analyzer.analyzeImage(imageFile);
    
    console.log('📊 Image Analysis Results:');
    console.log(`  Dimensions: ${analysis.dimensions.width} x ${analysis.dimensions.height}`);
    console.log(`  Average color: RGB(${analysis.averageColor.r}, ${analysis.averageColor.g}, ${analysis.averageColor.b})`);
    
    console.log(`  Potential red stones: ${analysis.colorRanges.red.samples.length} pixels`);
    if (analysis.colorRanges.red.samples.length > 0) {
      console.log(`    Red range: R(${analysis.colorRanges.red.min.r}-${analysis.colorRanges.red.max.r}) G(${analysis.colorRanges.red.min.g}-${analysis.colorRanges.red.max.g}) B(${analysis.colorRanges.red.min.b}-${analysis.colorRanges.red.max.b})`);
      console.log(`    Red sample positions:`, analysis.colorRanges.red.samples.slice(0, 5));
    }
    
    console.log(`  Potential yellow stones: ${analysis.colorRanges.yellow.samples.length} pixels`);
    if (analysis.colorRanges.yellow.samples.length > 0) {
      console.log(`    Yellow range: R(${analysis.colorRanges.yellow.min.r}-${analysis.colorRanges.yellow.max.r}) G(${analysis.colorRanges.yellow.min.g}-${analysis.colorRanges.yellow.max.g}) B(${analysis.colorRanges.yellow.min.b}-${analysis.colorRanges.yellow.max.b})`);
      console.log(`    Yellow sample positions:`, analysis.colorRanges.yellow.samples.slice(0, 5));
    }
    
    console.log(`  Brightest pixels: ${analysis.brightestPixels.length} (could be ice or lighting)`);
    if (analysis.brightestPixels.length > 0) {
      console.log(`    Brightest sample:`, analysis.brightestPixels[0]);
    }
    
    return analysis;
  }
  
  improvedColorDetection(r, g, b, targetColor, analysis) {
    if (targetColor === 'red') {
      // Use adaptive thresholds based on image analysis
      const redRange = analysis.colorRanges.red;
      if (redRange.samples.length > 0) {
        // If we found red samples, use their range
        return r >= redRange.min.r * 0.8 && r <= redRange.max.r * 1.2 &&
               r > g + 10 && r > b + 10;
      } else {
        // Fallback to broader detection
        return r > 100 && r > g + 20 && r > b + 20;
      }
    } else if (targetColor === 'yellow') {
      const yellowRange = analysis.colorRanges.yellow;
      if (yellowRange.samples.length > 0) {
        return r >= yellowRange.min.r * 0.8 && g >= yellowRange.min.g * 0.8 &&
               b <= yellowRange.max.b * 1.2;
      } else {
        // Fallback detection
        return r > 120 && g > 120 && b < 100 && Math.abs(r - g) < 80;
      }
    }
    return false;
  }
  
  improvedCoordinateMapping(pixelX, pixelY, imageWidth, imageHeight) {
    // This needs to be much more sophisticated for real images
    // For now, let's at least account for image aspect ratio
    
    const centerX = this.gameController.sheetDimensions.TEE_X;
    const centerY = 0;
    
    // Assume the image shows roughly a 6m x 6m area around the house
    const imageAreaWidth = 6.0;  // meters
    const imageAreaHeight = 6.0; // meters
    
    // Convert to normalized coordinates (-1 to 1)
    const normalizedX = (pixelX / imageWidth - 0.5) * 2;
    const normalizedY = (pixelY / imageHeight - 0.5) * 2;
    
    return {
      x: centerX + normalizedX * imageAreaWidth / 2,
      y: centerY + normalizedY * imageAreaHeight / 2
    };
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.ImprovedPhotoStoneDetection = ImprovedPhotoStoneDetection;
  window.createImageAnalyzer = createImageAnalyzer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ImprovedPhotoStoneDetection, createImageAnalyzer };
}