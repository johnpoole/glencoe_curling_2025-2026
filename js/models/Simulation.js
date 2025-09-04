import State from './State.js';
import { unit, detectCollisions } from './Physics.js';

/**
 * Simulate motion for a single stone
 * @param {Stone} stone - Stone to simulate
 * @param {Params} p - Physics parameters
 * @param {number} duration - Duration to simulate
 * @param {boolean} checkCollisions - Whether to update stone state for collision detection
 * @returns {Array} Array of State objects representing the trajectory
 */
export function simulateStone(stone, p, duration, checkCollisions = true) {
  // Copy the stone's state to work with
  let s = stone.toState();
  const traj = [s];
  
  const I = 0.5 * p.m * p.R * p.R;
  const dN = (p.m * p.g) / p.segments;
  const phis = Array.from({ length: p.segments }, (_, i) => (2 * Math.PI * i) / p.segments);
  
  const N = Math.floor(duration / p.dt);
  for (let step = 0; step < N; step++) {
    if (Math.hypot(s.vx, s.vy) < p.vStop && Math.abs(s.w) < p.wStop) break;
    
    let Fx = 0, Fy = 0, tau = 0;
    
    for (let phi of phis) {
      const vlocx = s.vx - s.w * p.rBand * Math.sin(phi);
      const vlocy = s.vy + s.w * p.rBand * Math.cos(phi);
      const vmag = Math.hypot(vlocx, vlocy) || p.vEps;
      const mu = p.mu0 * (1 / Math.sqrt(vmag));
      const vhatx = vlocx / vmag;
      const vhaty = vlocy / vmag;
      const dFx = -(dN * mu) * vhatx;
      const dFy = -(dN * mu) * vhaty;
      Fx += dFx; Fy += dFy;
      tau += p.rBand * (Math.cos(phi) * dFy - Math.sin(phi) * dFx);
    }
    
    const Vh = unit(s.vx, s.vy, p.vEps);
    const Vperp = { x: -Vh.uy, y: Vh.ux };
    const vRot = Math.max(Math.abs(s.w) * p.rBand, p.vEps);
    const muP = p.alpha * (p.mu0) * (1 / Math.sqrt(vRot));
    const FpMag = p.m * p.g * muP;
    const sgnw = s.w > 0 ? 1 : (s.w < 0 ? -1 : 0);
    
    Fx += sgnw * FpMag * Vperp.x;
    Fy += sgnw * FpMag * Vperp.y;
    tau += -sgnw * FpMag * p.rBand;
    
    const ax = Fx / p.m;
    const ay = Fy / p.m;
    const alphaZ = tau / I;
    
    const vx = s.vx + p.dt * ax;
    const vy = s.vy + p.dt * ay;
    const w = s.w + p.dt * alphaZ;
    const x = s.x + p.dt * vx;
    const y = s.y + p.dt * vy;
    
    s = new State(s.t + p.dt, x, y, vx, vy, w);
    traj.push(s);
    
    // Update the stone's state for collision detection
    if (checkCollisions) {
      stone.fromState(s);
      
      // We'll check if it's off the sheet in the calling function
    }
  }
  
  // Update the stone with final state
  stone.fromState(s);
  
  return traj;
}

/**
 * Simulate all stones in the collection
 * @param {Params} p - Physics parameters
 * @param {number} duration - Duration to simulate
 * @param {Array} stones - Collection of Stone objects
 * @param {object} sheetDimensions - Dimensions of the curling sheet
 * @returns {object} Object with stone trajectories keyed by stone ID
 */
export function simulateAll(p, duration, stones, sheetDimensions) {
  // Initialize trajectories object
  const trajectories = {};
  stones.forEach(stone => {
    trajectories[stone.id] = [];
  });
  
  let time = 0;
  const timeStep = p.dt; // Use the same timestep as the physics
  
  while (time < duration) {
    // Check if all stones have stopped
    const allStopped = stones.every(stone => 
      !stone.inPlay || (Math.hypot(stone.vx, stone.vy) < p.vStop && Math.abs(stone.w) < p.wStop)
    );
    
    if (allStopped) break;
    
    // Move each stone for this time step
    stones.forEach(stone => {
      if (!stone.inPlay) return;
      
      // Simulate a single timestep for this stone
      const stepTraj = simulateStone(stone, p, timeStep, false);
      
      // Record trajectory
      if (stepTraj.length > 0) {
        trajectories[stone.id].push(stepTraj[stepTraj.length - 1]);
      }
      
      // Check if stone is off the sheet
      if (stone.x > sheetDimensions.XMAX + 0.5 || 
          stone.x < sheetDimensions.XMIN - 0.5 || 
          Math.abs(stone.y) > sheetDimensions.HALF_W + 0.5) {
        stone.inPlay = false;
      }
    });
    
    // Check for collisions between stones
    detectCollisions(stones, p);
    
    time += timeStep;
  }
  
  return trajectories;
}

/**
 * Simulate with initial velocity vector toward the broom
 * @param {number} Vmag - Initial velocity magnitude
 * @param {number} omegaMag - Initial angular velocity magnitude
 * @param {string} turnStr - Turn direction ("in" or "out")
 * @param {Params} p - Physics parameters
 * @param {object} startPt - Starting point {x, y}
 * @param {object} broomPt - Broom target point {x, y}
 * @param {object} sheetDimensions - Dimensions of the curling sheet
 * @returns {Array} Array of State objects representing the trajectory
 */
export function simulateDraw(Vmag, omegaMag, turnStr, p, startPt, broomPt, sheetDimensions) {
  const dir = unit(broomPt.x - startPt.x, broomPt.y - startPt.y, p.vEps);
  const vx0 = Vmag * dir.ux;
  const vy0 = Vmag * dir.uy;
  const w0 = turnStr === "in" ? Math.abs(omegaMag) : -Math.abs(omegaMag);

  const I = 0.5 * p.m * p.R * p.R;
  const dN = (p.m * p.g) / p.segments;
  const phis = Array.from({ length: p.segments }, (_, i) => (2 * Math.PI * i) / p.segments);

  let s = new State(0, startPt.x, startPt.y, vx0, vy0, w0);
  const traj = [s];
  
  // Track if the stone has stopped
  let stoneStopped = false;

  const N = Math.floor(p.tMax / p.dt);
  for (let step = 0; step < N; step++) {
    // More precise stopping condition - the stone has truly stopped
    if (Math.hypot(s.vx, s.vy) < p.vStop && Math.abs(s.w) < p.wStop) {
      stoneStopped = true;
      break;
    }

    let Fx = 0, Fy = 0, tau = 0;

    for (let phi of phis) {
      const vlocx = s.vx - s.w * p.rBand * Math.sin(phi);
      const vlocy = s.vy + s.w * p.rBand * Math.cos(phi);
      const vmag = Math.hypot(vlocx, vlocy) || p.vEps;
      const mu = p.mu0 * (1 / Math.sqrt(vmag));
      const vhatx = vlocx / vmag;
      const vhaty = vlocy / vmag;
      const dFx = -(dN * mu) * vhatx;
      const dFy = -(dN * mu) * vhaty;
      Fx += dFx; Fy += dFy;
      tau += p.rBand * (Math.cos(phi) * dFy - Math.sin(phi) * dFx);
    }

    const Vh = unit(s.vx, s.vy, p.vEps);
    const Vperp = { x: -Vh.uy, y: Vh.ux };
    const vRot = Math.max(Math.abs(s.w) * p.rBand, p.vEps);
    const muP = p.alpha * (p.mu0) * (1 / Math.sqrt(vRot));
    const FpMag = p.m * p.g * muP;
    const sgnw = s.w > 0 ? 1 : (s.w < 0 ? -1 : 0);

    Fx += sgnw * FpMag * Vperp.x;
    Fy += sgnw * FpMag * Vperp.y;
    tau += -sgnw * FpMag * p.rBand;

    const ax = Fx / p.m;
    const ay = Fy / p.m;
    const alphaZ = tau / I;

    const vx = s.vx + p.dt * ax;
    const vy = s.vy + p.dt * ay;
    const w  = s.w + p.dt * alphaZ;
    const x  = s.x + p.dt * vx;
    const y  = s.y + p.dt * vy;

    s = new State(s.t + p.dt, x, y, vx, vy, w);
    traj.push(s);

    // Stop if off the visible sheet horizontally
    if (x > sheetDimensions.XMAX + 0.5 || 
        x < sheetDimensions.XMIN - 0.5 || 
        Math.abs(y) > sheetDimensions.HALF_W + 0.5) break;
  }
  
  // Add metadata about whether the stone stopped naturally
  traj.stoneStopped = stoneStopped;
  traj.stoppedOnSheet = stoneStopped && 
    s.x >= sheetDimensions.XMIN && 
    s.x <= sheetDimensions.XMAX &&
    Math.abs(s.y) <= sheetDimensions.HALF_W;
    
  return traj;
}
