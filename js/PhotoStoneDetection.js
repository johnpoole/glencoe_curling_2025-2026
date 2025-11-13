/**
 * Photo Stone Detection Module
 * Handles photo upload and computer vision-based stone detection
 */
export default class PhotoStoneDetection {
  constructor(gameController) {
    if (!gameController) {
      console.error('PhotoStoneDetection requires a valid game controller');
      return;
    }
    
    this.gameController = gameController;
    this.canvas = null;
    this.ctx = null;
    this.uploadedImage = null;
    this.detectedStones = [];
    
    // Validate gameController has required methods and properties
    if (!this.gameController.sheetDimensions) {
      console.error('Game controller missing sheetDimensions');
      return;
    }
    
    if (typeof this.gameController.generateStoneId !== 'function') {
      console.error('Game controller missing generateStoneId method');
      return;
    }
    
    if (typeof this.gameController.clearStones !== 'function') {
      console.error('Game controller missing clearStones method');
      return;
    }
    
    if (typeof this.gameController.updateStoneDisplay !== 'function') {
      console.error('Game controller missing updateStoneDisplay method');
      return;
    }
    
    this.initializeUI();
  }
  
  initializeUI() {
    // Get UI elements
    this.photoUploadArea = document.getElementById('photoUploadArea');
    this.photoInput = document.getElementById('photoInput');
    this.photoCanvas = document.getElementById('photoCanvas');
    this.photoControls = document.getElementById('photoControls');
    this.detectStonesBtn = document.getElementById('detectStonesBtn');
    this.clearPhotoBtn = document.getElementById('clearPhotoBtn');
    this.detectionStatus = document.getElementById('detectionStatus');
    
    // Validate essential UI elements
    if (!this.photoUploadArea || !this.photoInput || !this.photoCanvas) {
      console.error('Required photo detection UI elements not found');
      return;
    }
    
    // Setup canvas
    this.canvas = this.photoCanvas;
    this.ctx = this.canvas.getContext('2d');
    
    if (!this.ctx) {
      console.error('Failed to get 2D context from photo canvas');
      return;
    }
    
    // Event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // File upload area
    if (this.photoUploadArea) {
      this.photoUploadArea.addEventListener('click', () => {
        if (this.photoInput) {
          this.photoInput.click();
        }
      });
      
      this.photoUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.photoUploadArea.style.backgroundColor = '#e3f2fd';
      });
      
      this.photoUploadArea.addEventListener('dragleave', () => {
        this.photoUploadArea.style.backgroundColor = '#f8f9fa';
      });
      
      this.photoUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        this.photoUploadArea.style.backgroundColor = '#f8f9fa';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.handleFileUpload(files[0]);
        }
      });
    }
    
    // File input
    if (this.photoInput) {
      this.photoInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleFileUpload(e.target.files[0]);
        }
      });
    }
    
    // Control buttons
    if (this.detectStonesBtn) {
      this.detectStonesBtn.addEventListener('click', () => {
        this.detectStones();
      });
    }
    
    if (this.clearPhotoBtn) {
      this.clearPhotoBtn.addEventListener('click', () => {
        this.clearPhoto();
      });
    }
  }
  
  async handleFileUpload(file) {
    this.setStatus('Loading image...');
    
    if (!file.type.startsWith('image/')) {
      this.setStatus('Please upload an image file.', 'error');
      return;
    }
    
    try {
      const img = await this.loadImage(file);
      this.displayImage(img);
      this.uploadedImage = img;
      this.photoControls.style.display = 'block';
      this.setStatus('Image loaded. Click "Detect Stones" to analyze.');
    } catch (error) {
      this.setStatus('Error loading image: ' + error.message, 'error');
    }
  }
  
  loadImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  displayImage(img) {
    // Scale image to fit canvas while maintaining aspect ratio
    const maxWidth = 400;
    const maxHeight = 300;
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    
    this.canvas.width = img.width * scale;
    this.canvas.height = img.height * scale;
    
    // Clear and draw image
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    
    this.canvas.style.display = 'block';
    
    // Hide upload prompt
    document.getElementById('uploadPrompt').style.display = 'none';
  }
  
  async detectStones() {
    if (!this.uploadedImage) {
      this.setStatus('Please upload an image first.', 'error');
      return;
    }
    
    if (!this.ctx || !this.canvas) {
      this.setStatus('Canvas not properly initialized.', 'error');
      console.error('Canvas or context not available for stone detection');
      return;
    }
    
    if (!this.gameController) {
      this.setStatus('Game controller not available.', 'error');
      console.error('Game controller not available for stone detection');
      return;
    }
    
    this.setStatus('Detecting stones... (This may take a moment)');
    this.detectStonesBtn.disabled = true;
    
    try {
      // Basic computer vision stone detection
      const stones = await this.performStoneDetection();
      
      if (stones.length === 0) {
        this.setStatus('No stones detected. Try adjusting lighting or camera angle.', 'warning');
      } else {
        this.setStatus(`Found ${stones.length} potential stones. Loading into simulator...`);
        this.loadStonesIntoSimulator(stones);
        this.setStatus(`Successfully loaded ${stones.length} stones from photo!`, 'success');
      }
    } catch (error) {
      this.setStatus('Error detecting stones: ' + error.message, 'error');
      console.error('Stone detection error:', error);
    }
    
    this.detectStonesBtn.disabled = false;
  }
  
  async performStoneDetection() {
    // Conservative stone detection for accurate results

    try {
      const stones = [];

      // For robustness we run detection on a cropped, full-resolution offscreen canvas.
      // 1) draw uploaded image to an offscreen canvas at full resolution
      // 2) detect the ice region and crop to it (removes non-ice borders)
      // 3) detect vertical flip (house top/bottom) and set flip flag
      // 4) run colored-region detection on the cropped image

      if (!this.uploadedImage) throw new Error('No uploadedImage available for detection');

      // Create offscreen full-res canvas
      const off = document.createElement('canvas');
      off.width = this.uploadedImage.width;
      off.height = this.uploadedImage.height;
      const offCtx = off.getContext('2d');
      offCtx.drawImage(this.uploadedImage, 0, 0);

      // Get full image data
      const fullImageData = offCtx.getImageData(0, 0, off.width, off.height);

      // Detect the ice region and crop rectangle (in full-res coordinates)
      const crop = this.detectIceRegion(fullImageData.data, off.width, off.height);
      this.lastCrop = crop; // store for debug/visualization

      // Create cropped canvas
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, crop.width);
      cropCanvas.height = Math.max(1, crop.height);
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(off, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);

      // Optionally downsample for speed if very large, but keep detection on cropped image
      const procCanvas = document.createElement('canvas');
      const maxProcDim = 1200; // keep reasonable processing size
      let procWidth = cropCanvas.width;
      let procHeight = cropCanvas.height;
      let scale = 1;
      if (Math.max(procWidth, procHeight) > maxProcDim) {
        scale = maxProcDim / Math.max(procWidth, procHeight);
        procWidth = Math.round(procWidth * scale);
        procHeight = Math.round(procHeight * scale);
      }
      procCanvas.width = procWidth;
      procCanvas.height = procHeight;
      const procCtx = procCanvas.getContext('2d');
      procCtx.drawImage(cropCanvas, 0, 0, cropCanvas.width, cropCanvas.height, 0, 0, procWidth, procHeight);

      const procImageData = procCtx.getImageData(0, 0, procWidth, procHeight);
      const pixels = procImageData.data;

      console.log('🔍 Starting conservative stone detection on cropped image', procWidth, 'x', procHeight, 'canvas');

      // Detect vertical flip based on house/red density bands (run on cropped but downsampled image)
      this.flipVertical = this.detectVerticalFlip(procImageData, procWidth, procHeight);
      console.log('↕️  Flip vertical detected:', this.flipVertical);

      // Detect red, blue, and yellow regions with strict criteria
      const redRegions = this.detectColoredRegions(pixels, procWidth, procHeight, 'red');
      const blueRegions = this.detectColoredRegions(pixels, procWidth, procHeight, 'blue');
      const yellowRegions = this.detectColoredRegions(pixels, procWidth, procHeight, 'yellow');

      console.log('🔴 Found', redRegions.length, 'red regions');
      console.log('🔵 Found', blueRegions.length, 'blue regions');
      console.log('🟡 Found', yellowRegions.length, 'yellow regions');

      // Group regions into stone candidates with stricter clustering
      const redStones = this.groupRegionsIntoStones(redRegions, 'red');
      const blueStones = this.groupRegionsIntoStones(blueRegions, 'blue');
      const yellowStones = this.groupRegionsIntoStones(yellowRegions, 'yellow');

      console.log('🎯 Grouped into', redStones.length, 'red stones,', blueStones.length, 'blue stones, and', yellowStones.length, 'yellow stones');

      // Take only the most confident detections to avoid false positives
      const finalRedStones = redStones.slice(0, 2); // Top 2 red candidates only
      const finalBlueStones = blueStones.slice(0, 1); // Top 1 blue candidate only
      const finalYellowStones = yellowStones.slice(0, 0); // No yellow expected

      // Map stone pixel coords back to cropped full-res coordinates by reversing proc scaling
      const mapToCropCoords = (s) => {
        return {
          x: Math.round(s.x / scale),
          y: Math.round(s.y / scale),
          team: s.team,
          pixelCount: s.pixelCount || s.confidence || 0
        };
      };

      const cropRed = finalRedStones.map(mapToCropCoords);
      const cropBlue = finalBlueStones.map(mapToCropCoords);
      const cropYellow = finalYellowStones.map(mapToCropCoords);

      stones.push(...cropRed);
      stones.push(...cropBlue);
      stones.push(...cropYellow);

      // Save debug info
      this.lastDetectionDebug = {
        crop,
        procWidth,
        procHeight,
        scale,
        flipVertical: this.flipVertical,
        counts: {
          redCandidates: redRegions.length,
          blueCandidates: blueRegions.length,
          yellowCandidates: yellowRegions.length,
          finalRed: cropRed.length,
          finalBlue: cropBlue.length,
          finalYellow: cropYellow.length
        }
      };

      console.log('✅ Final detection:', stones.length, 'total stones');

      return stones;
    } catch (error) {
      console.error('Error in stone detection:', error);
      throw new Error(`Stone detection failed: ${error.message}`);
    }
  }
  
  groupRegionsIntoStones(regions, team) {
    if (regions.length === 0) return [];
    
    const stoneGroups = [];
    const groupRadius = 200; // IMPROVED: Much larger radius based on calibration analysis
    const minPixelsPerStone = 6; // IMPROVED: Lowered from 8 based on calibration (min confidence was 9)
    const used = new Set();
    
    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) continue;
      
      const group = {
        pixels: [regions[i]],
        centerX: regions[i].x,
        centerY: regions[i].y,
        team: team
      };
      
      // Find nearby pixels that belong to the same stone
      for (let j = i + 1; j < regions.length; j++) {
        if (used.has(j)) continue;
        
        const distance = Math.hypot(regions[i].x - regions[j].x, regions[i].y - regions[j].y);
        if (distance <= groupRadius) {
          group.pixels.push(regions[j]);
          used.add(j);
        }
      }
      
      // Calculate center of mass for the stone
      let sumX = 0, sumY = 0;
      group.pixels.forEach(pixel => {
        sumX += pixel.x;
        sumY += pixel.y;
      });
      group.centerX = Math.round(sumX / group.pixels.length);
      group.centerY = Math.round(sumY / group.pixels.length);
      
      // Only consider as a stone if it has enough pixels
      if (group.pixels.length >= minPixelsPerStone) {
        stoneGroups.push({
          x: group.centerX,
          y: group.centerY,
          team: team,
          pixelCount: group.pixels.length
        });
      }
      
      used.add(i);
    }
    
    // Sort by pixel count (larger groups are more likely to be actual stones)
    return stoneGroups.sort((a, b) => b.pixelCount - a.pixelCount);
  }

  /**
   * Detect approximate ice region (crop rectangle) in the image data.
   * Strategy: compute row-wise brightness and look for the continuous band
   * that corresponds to the sled/ice area between hogline and backline. Trim
   * non-ice edges.
   */
  detectIceRegion(pixels, width, height) {
    // pixels is Uint8ClampedArray in RGBA order
    const rowBrightness = new Float32Array(height);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      let count = 0;
      for (let x = 0; x < width; x += 10) { // sample every 10 px for speed
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        // brightness (perceived)
        const bright = 0.299 * r + 0.587 * g + 0.114 * b;
        sum += bright;
        count++;
      }
      rowBrightness[y] = sum / Math.max(1, count);
    }

    // Smooth brightness with simple moving average to reduce noise
    const smooth = new Float32Array(height);
    const window = 25;
    for (let y = 0; y < height; y++) {
      let s = 0;
      let c = 0;
      for (let k = Math.max(0, y - window); k <= Math.min(height - 1, y + window); k++) {
        s += rowBrightness[k];
        c++;
      }
      smooth[y] = s / c;
    }

    // Find top and bottom bounds where brightness is within ice-like range
    // Ice will be relatively bright and consistent; edges (stands, floor, boards) will be darker or variable
    const mean = smooth.reduce((a, b) => a + b, 0) / height;
    const std = Math.sqrt(smooth.reduce((a, b) => a + (b - mean) * (b - mean), 0) / height);

    const thresh = Math.max(0, mean - std * 0.6);

    // Find first and last row above threshold
    let top = 0;
    while (top < height && smooth[top] < thresh) top++;
    let bottom = height - 1;
    while (bottom > 0 && smooth[bottom] < thresh) bottom--;

    // Clamp and expand a little to capture full ice area
    top = Math.max(0, top - 20);
    bottom = Math.min(height - 1, bottom + 20);

    // Use full width for now; future improvement could detect left/right cuts
    const crop = {
      x: 0,
      y: top,
      width: width,
      height: Math.max(1, bottom - top + 1)
    };

    return crop;
  }

  /**
   * Detect whether the cropped image needs a vertical flip so that bottom pixels map
   * to the house (tee area). Strategy: divide image into bands and compare red density.
   */
  detectVerticalFlip(imageData, width, height) {
    try {
      const data = imageData.data;
      const bands = 6;
      const bandCounts = new Array(bands).fill(0);
      const bandSize = Math.floor(height / bands);

      for (let b = 0; b < bands; b++) {
        const y0 = b * bandSize;
        const y1 = (b === bands - 1) ? height : y0 + bandSize;
        let count = 0;
        let samples = 0;
        for (let y = y0; y < y1; y += 6) {
          for (let x = 0; x < width; x += 8) {
            const idx = (y * width + x) * 4;
            const r = data[idx], g = data[idx + 1], bl = data[idx + 2];
            if (r > 110 && r > g + 15 && r > bl + 15) count++;
            samples++;
          }
        }
        bandCounts[b] = count / Math.max(1, samples);
      }

      // The band with highest normalized red density indicates house location
      let maxIdx = 0;
      for (let i = 1; i < bands; i++) if (bandCounts[i] > bandCounts[maxIdx]) maxIdx = i;

      // If the highest red density is in a bottom band (higher index) we likely need no flip
      // If the highest red density is in a top band, we need to flip
      const bottomBias = (maxIdx >= Math.floor(bands / 2));

      // The user stated images will be flipped vertical for odd/even ends; default to false
      // Return true if majority of red is at the top (needs flip to bring house to bottom)
      return !bottomBias;
    } catch (e) {
      console.warn('detectVerticalFlip failed, defaulting to false', e);
      return false;
    }
  }
  
  detectColoredRegions(pixels, width, height, color) {
    // Much more conservative color detection for accurate stone identification
    const regions = [];
    const stepSize = 15; // Fine sampling for better accuracy
    
    // Validate inputs
    if (!pixels || !Array.isArray(pixels) && !(pixels instanceof Uint8ClampedArray)) {
      console.warn('Invalid pixels data provided to detectColoredRegions');
      return [];
    }
    
    if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
      console.warn('Invalid width or height provided to detectColoredRegions');
      return [];
    }
    
    try {
      for (let y = 0; y < height; y += stepSize) {
        for (let x = 0; x < width; x += stepSize) {
          const idx = (y * width + x) * 4;
          
          // Check bounds
          if (idx + 2 >= pixels.length) continue;
          
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          
          if (this.isTargetColor(r, g, b, color)) {
            regions.push({ x, y });
          }
        }
      }
    } catch (error) {
      console.error('Error in detectColoredRegions:', error);
      return [];
    }
    
    return regions;
  }
  
  isTargetColor(r, g, b, targetColor) {
    if (targetColor === 'red') {
      // Strict red detection to reduce false positives
      return (r > 120 && r > g + 20 && r > b + 20 && r < 180); // IMPROVED: Lowered from 130 and 25
    } else if (targetColor === 'yellow') {
      // Strict yellow detection  
      return (r > 150 && g > 130 && b < 110 && Math.abs(r - g) < 50);
    } else if (targetColor === 'blue') {
      // Strict blue detection to reduce false positives
      return (b > 95 && b > r + 15 && b > g + 10 && r < 120 && g < 130); // IMPROVED: Lowered from 100 and 20/15
    }
    return false;
  }
  
  loadStonesIntoSimulator(detectedStones) {
    try {
      // Clear existing stones
      this.gameController.clearStones();
      
      // Convert detected positions to curling sheet coordinates
      const convertedStones = detectedStones.map((stone, index) => {
        // Validate stone object
        if (!stone || typeof stone.x !== 'number' || typeof stone.y !== 'number') {
          throw new Error(`Invalid stone data at index ${index}: missing or invalid x/y coordinates`);
        }
        
        if (!stone.team || (stone.team !== 'red' && stone.team !== 'yellow' && stone.team !== 'blue')) {
          throw new Error(`Invalid stone team at index ${index}: ${stone.team}`);
        }
        
        const sheetPos = this.convertToSheetCoordinates(stone.x, stone.y);
        
        // Validate converted coordinates
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
      
      // Add stones to game controller
      convertedStones.forEach(stone => {
        this.gameController.stones.push(stone);
      });
      
      // Update display
      this.gameController.updateStoneDisplay();
    } catch (error) {
      console.error('Error loading stones into simulator:', error);
      throw new Error(`Failed to load stones: ${error.message}`);
    }
  }
  
  convertToSheetCoordinates(pixelX, pixelY) {
    // Convert pixel (in cropped-image coordinates) into curling sheet coordinates.
    // Handles vertical flip (this.flipVertical) and cropping offsets (this.lastCrop).

    const centerX = this.gameController.sheetDimensions.TEE_X;
    const viewAreaWidth = 8.0;   // meters (X span)
    const viewAreaDepth = 6.0;   // meters (Y span from tee backward to throwing zone)

    // If we have a crop, use crop dimensions; otherwise fall back to uploadedImage or canvas
    const crop = this.lastCrop || { x: 0, y: 0, width: (this.uploadedImage ? this.uploadedImage.width : this.canvas.width), height: (this.uploadedImage ? this.uploadedImage.height : this.canvas.height) };

    const imageWidth = crop.width;
    const imageHeight = crop.height;

    // If flipVertical is set, invert the pixelY in crop coordinates
    let localY = pixelY;
    if (this.flipVertical) {
      localY = imageHeight - pixelY;
    }

    // Convert to normalized coords: -1 (left/top) .. +1 (right/bottom)
    const normalizedX = (pixelX / imageWidth - 0.5) * 2;
    const normalizedY = (localY / imageHeight - 0.5) * 2;

    // Map to sheet coordinates. We want:
    // - normalizedY = +1 (bottom) -> sheetY ≈ 0 (tee/house)  
    // - normalizedY = -1 (top) -> sheetY ≈ -viewAreaDepth (throwing area)
    const sheetX = centerX + normalizedX * (viewAreaWidth / 2);
    const sheetY = normalizedY * 1.5; // Simple direct mapping: bottom(+1)->+1.5, top(-1)->-1.5

    return { x: sheetX, y: sheetY };
  }
  
  clearPhoto() {
    this.canvas.style.display = 'none';
    this.photoControls.style.display = 'none';
    document.getElementById('uploadPrompt').style.display = 'block';
    this.uploadedImage = null;
    this.detectedStones = [];
    this.photoInput.value = '';
    this.setStatus('');
  }
  
  setStatus(message, type = 'info') {
    if (!this.detectionStatus) {
      console.log(`Status: ${message} (${type})`);
      return;
    }
    
    this.detectionStatus.textContent = message;
    this.detectionStatus.className = '';
    
    switch (type) {
      case 'error':
        this.detectionStatus.style.color = '#e74c3c';
        break;
      case 'warning':
        this.detectionStatus.style.color = '#f39c12';
        break;
      case 'success':
        this.detectionStatus.style.color = '#27ae60';
        break;
      default:
        this.detectionStatus.style.color = '#666';
    }
  }
}