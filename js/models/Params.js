/**
 * Physics parameters for the curling simulation
 */
export default class Params {
  constructor() {
    this.m = 19.0;    // kg
    this.g = 9.81;
    this.R = null;     // Set from UI
    this.rBand = null; // Set from UI
    this.mu0 = null;   // Set from UI (includes sweep factor)
    this.alpha = null; // Set from UI
    this.segments = null; // Set from UI
    this.dt = null;    // Set from UI
    this.tMax = null;  // Set from UI
    this.vStop = 0.01;
    this.wStop = 0.02;
    this.vEps = 1e-6;
    this.restitution = 0.8; // Coefficient of restitution for stone-stone collisions
  }

  // Update parameters from UI elements
  updateFromUI(uiGetters) {
    this.R = uiGetters.Rrock();
    this.rBand = uiGetters.rband();
    this.mu0 = uiGetters.mu0() * uiGetters.sweep();
    this.alpha = uiGetters.alpha();
    this.segments = uiGetters.segments();
    this.dt = uiGetters.dt();
    this.tMax = uiGetters.tmax();
  }
}
