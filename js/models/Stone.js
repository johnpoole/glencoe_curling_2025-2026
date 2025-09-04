import State from './State.js';

/**
 * Stone class for tracking individual curling stones
 */
export default class Stone {
  constructor(id, position = {x: 0, y: 0}, velocity = {vx: 0, vy: 0}, omega = 0, team = 'red') {
    this.id = id;         // Unique identifier
    this.x = position.x;
    this.y = position.y;
    this.vx = velocity.vx;
    this.vy = velocity.vy;
    this.w = omega;       // Angular velocity
    this.team = team;     // 'red' or 'yellow'
    this.inPlay = true;   // Flag for stones in play
    this.t = 0;           // Time tracker
  }
  
  // Create a new state object from this stone
  toState() {
    return new State(this.t, this.x, this.y, this.vx, this.vy, this.w);
  }
  
  // Update stone from a state object
  fromState(state) {
    this.t = state.t;
    this.x = state.x;
    this.y = state.y;
    this.vx = state.vx;
    this.vy = state.vy;
    this.w = state.w;
  }
}
