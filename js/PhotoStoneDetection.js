/**
 * Photo Stone Detection Module
 * Handles photo upload and computer vision-based stone detection
 */
export default class PhotoStoneDetection {
  constructor(gameController) {
    this.gameController = gameController;
    this.canvas = null;
    this.ctx = null;
    this.uploadedImage = null;
    this.detectedStones = [];
    
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
    
    // Setup canvas
    this.canvas = this.photoCanvas;
    this.ctx = this.canvas.getContext('2d');
    
    // Event listeners
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    // File upload area
    this.photoUploadArea.addEventListener('click', () => {
      this.photoInput.click();
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
    
    // File input
    this.photoInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFileUpload(e.target.files[0]);
      }
    });
    
    // Control buttons
    this.detectStonesBtn.addEventListener('click', () => {
      this.detectStones();
    });
    
    this.clearPhotoBtn.addEventListener('click', () => {
      this.clearPhoto();
    });
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
    }
    
    this.detectStonesBtn.disabled = false;
  }
  
  async performStoneDetection() {
    // This is a simplified implementation - in a real version you'd use OpenCV.js
    // For now, we'll implement basic circle detection using canvas
    
    const stones = [];
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageData.data;
    
    // Very basic color-based detection (placeholder)
    // Look for red and yellow circular regions
    const redStones = this.detectColoredRegions(pixels, this.canvas.width, this.canvas.height, 'red');
    const yellowStones = this.detectColoredRegions(pixels, this.canvas.width, this.canvas.height, 'yellow');
    
    // Combine and convert to curling coordinates
    stones.push(...redStones.map(pos => ({ ...pos, team: 'red' })));
    stones.push(...yellowStones.map(pos => ({ ...pos, team: 'yellow' })));
    
    return stones;
  }
  
  detectColoredRegions(pixels, width, height, color) {
    // Simplified color detection - this is a placeholder for proper CV
    const regions = [];
    const stepSize = 10; // Sample every 10 pixels for speed
    
    for (let y = 0; y < height; y += stepSize) {
      for (let x = 0; x < width; x += stepSize) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        
        if (this.isTargetColor(r, g, b, color)) {
          // Found a potential stone pixel - check if we already have a region nearby
          if (!regions.some(region => Math.hypot(region.x - x, region.y - y) < 30)) {
            regions.push({ x, y });
          }
        }
      }
    }
    
    return regions;
  }
  
  isTargetColor(r, g, b, targetColor) {
    if (targetColor === 'red') {
      // Look for reddish colors
      return r > 120 && r > g * 1.3 && r > b * 1.3;
    } else if (targetColor === 'yellow') {
      // Look for yellowish colors
      return r > 150 && g > 150 && b < 100 && Math.abs(r - g) < 50;
    }
    return false;
  }
  
  loadStonesIntoSimulator(detectedStones) {
    // Clear existing stones
    this.gameController.clearStones();
    
    // Convert detected positions to curling sheet coordinates
    const convertedStones = detectedStones.map(stone => {
      const sheetPos = this.convertToSheetCoordinates(stone.x, stone.y);
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
  }
  
  convertToSheetCoordinates(pixelX, pixelY) {
    // This is a simplified conversion - in reality you'd need:
    // 1. House circle detection for reference points
    // 2. Perspective correction
    // 3. Proper scaling based on known dimensions
    
    // For now, just map to a reasonable area around the house
    const centerX = this.gameController.sheetDimensions.HOUSE.x;
    const centerY = this.gameController.sheetDimensions.HOUSE.y;
    const houseRadius = this.gameController.sheetDimensions.HOUSE.R;
    
    // Map canvas coordinates to sheet coordinates
    const normalizedX = (pixelX / this.canvas.width - 0.5) * 2;
    const normalizedY = (pixelY / this.canvas.height - 0.5) * 2;
    
    return {
      x: centerX + normalizedX * houseRadius * 1.5,
      y: centerY + normalizedY * houseRadius * 1.5
    };
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