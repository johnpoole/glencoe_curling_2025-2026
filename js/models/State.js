/**
 * State class for tracking stone state at a given time
 */
export default class State {
  constructor(t, x, y, vx, vy, w) { 
    this.t = t;   // Time
    this.x = x;   // X position
    this.y = y;   // Y position
    this.vx = vx; // X velocity
    this.vy = vy; // Y velocity
    this.w = w;   // Angular velocity
  }
}
