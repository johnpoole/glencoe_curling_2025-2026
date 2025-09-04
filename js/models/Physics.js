/**
 * Physics utility functions for the curling simulation
 */

/**
 * Calculate unit vector from a vector
 * @param {number} vx - X component of vector
 * @param {number} vy - Y component of vector
 * @param {number} eps - Small value to avoid division by zero
 * @returns {object} Unit vector {ux, uy} and magnitude s
 */
export function unit(vx, vy, eps) {
  const s = Math.hypot(vx, vy);
  if (s < eps) return { ux: 0, uy: 0, s: eps };
  return { ux: vx / s, uy: vy / s, s };
}

/**
 * Detect collisions between stones in a list
 * @param {Array} stonesList - List of Stone objects
 * @param {Params} params - Physics parameters
 */
export function detectCollisions(stonesList, params) {
  const twoR = 2 * params.R;  // Diameter - minimum distance between stone centers
  
  for (let i = 0; i < stonesList.length; i++) {
    if (!stonesList[i].inPlay) continue;
    
    for (let j = i + 1; j < stonesList.length; j++) {
      if (!stonesList[j].inPlay) continue;
      
      // Calculate distance between stone centers
      const dx = stonesList[j].x - stonesList[i].x;
      const dy = stonesList[j].y - stonesList[i].y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      // Check for collision
      if (distance < twoR) {
        // Stones are colliding - resolve collision
        resolveCollision(stonesList[i], stonesList[j], params);
      }
    }
  }
}

/**
 * Resolve collision between two stones using conservation of momentum
 * @param {Stone} stone1 - First stone in collision
 * @param {Stone} stone2 - Second stone in collision
 * @param {Params} params - Physics parameters
 */
export function resolveCollision(stone1, stone2, params) {
  // Unit vector along collision line
  const dx = stone2.x - stone1.x;
  const dy = stone2.y - stone1.y;
  const distance = Math.sqrt(dx*dx + dy*dy);
  
  // Normalize direction vector
  const nx = dx / distance;
  const ny = dy / distance;
  
  // Relative velocity
  const dvx = stone2.vx - stone1.vx;
  const dvy = stone2.vy - stone1.vy;
  
  // Project velocity onto collision normal
  const relativeVelocityAlongNormal = dvx * nx + dvy * ny;
  
  // Do not resolve if objects are moving away from each other
  if (relativeVelocityAlongNormal > 0) return;
  
  // Coefficient of restitution (1 = perfect elastic, < 1 = energy loss)
  const e = params.restitution;
  
  // Impulse scalar
  const j = -(1 + e) * relativeVelocityAlongNormal / 2; // Divide by 2 since both stones have equal mass
  
  // Apply impulse
  stone1.vx -= j * nx;
  stone1.vy -= j * ny;
  stone2.vx += j * nx;
  stone2.vy += j * ny;
  
  // Apply angular momentum changes - simplified model
  // Angular momentum change proportional to cross product of collision normal and impact point
  const crossFactor = 0.5; // Tuning parameter
  stone1.w += crossFactor * (nx * stone1.vy - ny * stone1.vx);
  stone2.w += crossFactor * (nx * stone2.vy - ny * stone2.vx);
  
  // Slight position adjustment to prevent stones from sticking
  const overlap = 2 * params.R - distance;
  stone1.x -= overlap * nx / 2;
  stone1.y -= overlap * ny / 2;
  stone2.x += overlap * nx / 2;
  stone2.y += overlap * ny / 2;
}
