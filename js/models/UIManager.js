/**
 * UI Manager for handling user inputs and controls
 */
export default class UIManager {
  constructor() {
    // Create getter functions for UI values
    this.getters = {
      V0: () => +document.getElementById("V0").value,
      omega0: () => +document.getElementById("omega0").value,
      turn: () => document.getElementById("turn").value,
      mu0: () => +document.getElementById("mu0").value,
      alpha: () => +document.getElementById("alpha").value,
      sweep: () => +document.getElementById("sweep").value,
      segments: () => +document.getElementById("segments").value,
      dt: () => +document.getElementById("dt").value,
      tmax: () => +document.getElementById("tmax").value,
      rband: () => +document.getElementById("rband").value,
      Rrock: () => +document.getElementById("R").value,
      animationSpeed: () => +document.getElementById("animationSpeed").value,
      
      // Multi-trajectory parameters
      showMultiTrajectories: () => document.getElementById("showMultiTrajectories") ? 
        document.getElementById("showMultiTrajectories").checked : false,
      broomSpacing: () => document.getElementById("broomSpacing") ?
        +document.getElementById("broomSpacing").value : 0.1524, // Default 6 inches in meters
      velocityStart: () => document.getElementById("velocityStart") ?
        +document.getElementById("velocityStart").value : 1.8,
      velocityEnd: () => document.getElementById("velocityEnd") ?
        +document.getElementById("velocityEnd").value : 2.8,
      velocityStep: () => document.getElementById("velocityStep") ?
        +document.getElementById("velocityStep").value : 0.1,
      showCollisions: () => document.getElementById("showCollisions") ?
        document.getElementById("showCollisions").checked : true,
      filterPaths: () => document.getElementById("filterPaths") ?
        document.getElementById("filterPaths").checked : true,
      applyExecutionErrors: () => document.getElementById("applyExecutionErrors") ?
        document.getElementById("applyExecutionErrors").checked : true
    };
    
    // Metric display elements
    this.metrics = {
      mx: document.getElementById("mx"),
      my: document.getElementById("my"),
      mt: document.getElementById("mt"),
      mhh: document.getElementById("mhh")
    };
    
    // Initialize sliders
    this.initializeSliders();
  }
  
  // Get all UI getters
  getUIGetters() {
    return this.getters;
  }
  
  // Update metric displays
  updateMetrics(x, y, t, hogToHog) {
    this.metrics.mx.textContent = x !== undefined ? x.toFixed(2) : "—";
    this.metrics.my.textContent = y !== undefined ? y.toFixed(2) : "—";
    this.metrics.mt.textContent = t !== undefined ? t.toFixed(2) : "—";
    this.metrics.mhh.textContent = hogToHog !== undefined ? hogToHog.toFixed(2) : "—";
  }
  
  // Clear metric displays
  clearMetrics() {
    this.updateMetrics();
  }
  
  // Initialize slider event listeners
  initializeSliders() {
    // Initial speed slider
    const speedSlider = document.getElementById("V0");
    const speedValue = document.getElementById("V0-value");
    
    if (speedSlider && speedValue) {
      // Update value display on input change
      speedSlider.addEventListener("input", () => {
        speedValue.textContent = speedSlider.value;
      });
    }
  }
}
