import { detectCollisions } from './Physics.js';
import { simulateStone, simulateAll } from './Simulation.js';

/**
 * Game Controller for managing curling game state and interactions
 */
export default class GameController {
  constructor(renderer, uiGetters) {
    this.renderer = renderer;
    this.uiGetters = uiGetters;
    this.stones = [];
    this.selectedStoneId = null;
    this.currentTeam = 'red';
    this.broomPos = { x: renderer.dimensions.TEE_X, y: 0 }; // Default on the button
    this.anim = null;
    this.sheetDimensions = renderer.dimensions;
    
    // Create the broom
    this.broom = renderer.createBroom(this.broomPos);
    
    // Set up click handler for broom placement
    this.setupBroomClickHandler();
    
    // Set up UI event handlers
    this.setupEventHandlers();
  }
  
  setupBroomClickHandler() {
    const renderer = this.renderer;
    const svg = renderer.svg;
    const xScale = renderer.xScale;
    const yScale = renderer.yScale;
    const dims = this.sheetDimensions;
    
    svg.on("click", (ev) => {
      const p = d3.pointer(ev, svg.node());
      const x = xScale.invert(p[0]);
      const y = yScale.invert(p[1]);
      if (x < dims.XMIN || x > dims.XMAX || Math.abs(y) > dims.HALF_W) return;
      this.broomPos = { x, y };
      renderer.updateBroom(this.broom, this.broomPos);
    });
  }
  
  setupEventHandlers() {
    // Wire buttons
    document.getElementById("throwBtn").addEventListener("click", () => this.runOnce());
    document.getElementById("resetBtn").addEventListener("click", () => this.resetAll());
    document.getElementById("csvBtn").addEventListener("click", () => this.exportCSV());
    document.getElementById("stopBtn").addEventListener("click", () => this.stopAnim());
    
    // Stone control buttons
    document.getElementById("removeStoneBtn").addEventListener("click", () => this.removeSelectedStone());
    document.getElementById("clearStonesBtn").addEventListener("click", () => this.clearStones());
  }
  
  // Generate a unique ID for stones
  generateStoneId() {
    return this.stones.length > 0 ? Math.max(...this.stones.map(s => s.id)) + 1 : 1;
  }
  
  // Update stone visuals on the sheet
  updateStoneDisplay() {
    // Remove existing stones
    this.renderer.clearStones();
    
    // Add stones from the array
    this.stones.forEach(stone => {
      // Make sure rotation is initialized
      if (stone.rotation === undefined) {
        stone.rotation = 0;
      }
      
      const stoneGroup = this.renderer.drawStone(stone, this.selectedStoneId === stone.id);
      
      // Add click handler
      stoneGroup.on("click", (event) => {
        // Select this stone for throwing
        this.selectedStoneId = stone.id;
        this.updateStoneDisplay(); // Update to show selection
        event.stopPropagation(); // Prevent click from being passed to sheet click handler
      });
      
      // Add drag handler
      stoneGroup.call(d3.drag()
        .on("drag", (event) => {
          // Allow dragging stones to position them
          stone.x = this.renderer.xScale.invert(event.x);
          stone.y = this.renderer.yScale.invert(event.y);
          d3.select(`#stone-${stone.id}`)
            .attr("transform", `translate(${this.renderer.xScale(stone.x)}, ${this.renderer.yScale(stone.y)}) rotate(${stone.rotation || 0})`);
        })
      );
    });
  }
  
  // Add a new stone
  addStone(team) {
    const start = this.sheetDimensions.START;
    
    // Position new stones in a reasonable location near start
    const offset = this.stones.length * 0.2; // Offset stones to avoid overlap
    const yPos = team === 'red' ? -0.2 - offset : 0.2 + offset;
    
    const newStone = {
      id: this.generateStoneId(),
      x: start.x,
      y: yPos,
      vx: 0, 
      vy: 0,
      w: 0,
      team: team,
      inPlay: true,
      t: 0,
      rotation: 0,  // Initialize rotation angle for handle
      toState() {
        return { t: this.t, x: this.x, y: this.y, vx: this.vx, vy: this.vy, w: this.w };
      },
      fromState(state) {
        this.t = state.t;
        this.x = state.x;
        this.y = state.y;
        this.vx = state.vx;
        this.vy = state.vy;
        this.w = state.w;
      }
    };
    
    this.stones.push(newStone);
    this.selectedStoneId = newStone.id;
    this.updateStoneDisplay();
  }
  
  // Remove a selected stone
  removeSelectedStone() {
    if (this.selectedStoneId === null) {
      alert("Please select a stone to remove");
      return;
    }
    
    const index = this.stones.findIndex(s => s.id === this.selectedStoneId);
    if (index !== -1) {
      this.stones.splice(index, 1);
      this.selectedStoneId = this.stones.length > 0 ? this.stones[0].id : null;
      this.updateStoneDisplay();
    }
  }
  
  // Clear all stones
  clearStones() {
    this.stopAnim();
    this.renderer.clearPaths();
    this.stones.length = 0;
    this.updateStoneDisplay();
  }
  
  // Reset the game
  resetAll() {
    this.stopAnim();
    this.renderer.clearPaths();
    this.stones.length = 0; // Remove all stones
    this.updateStoneDisplay();
    
    const metrics = ['mx', 'my', 'mt', 'mhh'];
    metrics.forEach(id => {
      document.getElementById(id).textContent = "";
    });
    
    this.currentTeam = 'red'; // Reset to first team
  }
  
  // Stop any active animation
  stopAnim() { 
    if (this.anim) { 
      this.anim.stop(); 
      this.anim = null; 
    } 
  }
  
  // Run the simulation once
  runOnce() {
    // Create parameters using the UI values
    const p = {
      m: 19.0,
      g: 9.81,
      R: this.uiGetters.Rrock(),
      rBand: this.uiGetters.rband(),
      mu0: this.uiGetters.mu0() * this.uiGetters.sweep(),
      alpha: this.uiGetters.alpha(),
      segments: this.uiGetters.segments(),
      dt: this.uiGetters.dt(),
      tMax: this.uiGetters.tmax(),
      vStop: 0.01,
      wStop: 0.02,
      vEps: 1e-6,
      restitution: 0.8
    };
    
    // Check if there's a stone of the current team
    const hasCurrentTeamStone = this.stones.some(stone => stone.team === this.currentTeam);
    
    if (this.stones.length === 0 || !hasCurrentTeamStone) {
      // If no stones placed, or no stone for current team, add one
      const offset = this.stones.length * 0.2; // Offset stones to avoid overlap
      const yPos = this.currentTeam === 'red' ? -0.2 - offset : 0.2 + offset;
      
      const newStone = {
        id: this.generateStoneId(),
        x: this.sheetDimensions.START.x,
        y: yPos,
        vx: 0,
        vy: 0,
        w: 0,
        team: this.currentTeam,
        inPlay: true,
        t: 0,
        rotation: 0,  // Initialize rotation angle for handle
        toState() {
          return { t: this.t, x: this.x, y: this.y, vx: this.vx, vy: this.vy, w: this.w };
        },
        fromState(state) {
          this.t = state.t;
          this.x = state.x;
          this.y = state.y;
          this.vx = state.vx;
          this.vy = state.vy;
          this.w = state.w;
        }
      };
      
      this.stones.push(newStone);
      this.selectedStoneId = newStone.id;
      this.updateStoneDisplay();
    }
    
    // Find the selected stone or use the first one
    const activeStoneIndex = this.selectedStoneId ? 
      this.stones.findIndex(s => s.id === this.selectedStoneId) : 
      this.stones.findIndex(s => s.team === this.currentTeam);
    
    if (activeStoneIndex === -1) {
      alert("Please select a stone to throw");
      return;
    }
    
    const activeStone = this.stones[activeStoneIndex];
    
    // Set velocity and spin for the selected stone
    const dir = {
      ux: this.broomPos.x - activeStone.x,
      uy: this.broomPos.y - activeStone.y
    };
    const mag = Math.hypot(dir.ux, dir.uy) || p.vEps;
    dir.ux /= mag;
    dir.uy /= mag;
    
    activeStone.vx = this.uiGetters.V0() * dir.ux;
    activeStone.vy = this.uiGetters.V0() * dir.uy;
    // Set angular velocity - keep the same physics direction, but we'll reverse the visual rotation
    activeStone.w = this.uiGetters.turn() === "in" ? 
      Math.abs(this.uiGetters.omega0()) : 
      -Math.abs(this.uiGetters.omega0());
    
    // Reset the stone's rotation to zero for the throw
    activeStone.rotation = 0;
    
    // Clear previous paths
    this.renderer.clearPaths();
    
    // Run the multi-stone simulation
    const trajectories = this.runSimulation(p);
    
    // Draw paths for all stones that moved
    Object.entries(trajectories).forEach(([stoneId, traj]) => {
      if (traj.length > 1) {
        const stoneColor = this.stones.find(s => s.id == stoneId).team === 'red' ? 
          "#e74c3c55" : "#f1c40f55";
        this.renderer.drawPath(traj, stoneColor);
      }
    });
    
    // Display metrics for the active stone
    const stoneId = activeStone.id;
    const traj = trajectories[stoneId];
    
    if (traj && traj.length > 0) {
      const end = traj[traj.length - 1];
      document.getElementById('mx').textContent = end.x.toFixed(2);
      document.getElementById('my').textContent = end.y.toFixed(2);
      document.getElementById('mt').textContent = end.t.toFixed(2);
      
      // Calculate hog-to-hog time if the stone crossed the far hog line
      let hogToHog = null;
      for (let i = 1; i < traj.length; i++) {
        if (traj[i-1].x <= this.sheetDimensions.FAR_HOG_X && traj[i].x >= this.sheetDimensions.FAR_HOG_X) {
          const t0 = traj[i-1], t1 = traj[i];
          const f = (this.sheetDimensions.FAR_HOG_X - t0.x) / (t1.x - t0.x);
          hogToHog = t0.t + f * (t1.t - t0.t);
          break;
        }
      }
      document.getElementById('mhh').textContent = hogToHog !== null ? hogToHog.toFixed(2) : "—";
    } else {
      ['mx', 'my', 'mt', 'mhh'].forEach(id => {
        document.getElementById(id).textContent = "—";
      });
    }
    
    // Animate the stones
    this.animateStones(trajectories, p.dt);
    
    // Switch teams after throwing
    this.currentTeam = this.currentTeam === 'red' ? 'yellow' : 'red';
  }
  
  // Run the simulation for all stones
  runSimulation(p) {
    // Initialize trajectories object
    const trajectories = {};
    this.stones.forEach(stone => {
      trajectories[stone.id] = [];
    });
    
    let time = 0;
    const timeStep = p.dt; // Use the same timestep as the physics
    const dims = this.sheetDimensions;
    
    while (time < p.tMax) {
      // Check if all stones have stopped
      const allStopped = this.stones.every(stone => 
        !stone.inPlay || (Math.hypot(stone.vx, stone.vy) < p.vStop && Math.abs(stone.w) < p.wStop)
      );
      
      if (allStopped) break;
      
      // Move each stone for this time step
      this.stones.forEach(stone => {
        if (!stone.inPlay) return;
        
        // Simulate a single timestep for this stone
        const stepTraj = simulateStone(stone, p, timeStep, false);
        
        // Record trajectory
        if (stepTraj.length > 0) {
          trajectories[stone.id].push(stepTraj[stepTraj.length - 1]);
        }
        
        // Check if stone is off the sheet
        if (stone.x > dims.XMAX + 0.5 || 
            stone.x < dims.XMIN - 0.5 || 
            Math.abs(stone.y) > dims.HALF_W + 0.5) {
          stone.inPlay = false;
        }
      });
      
      // Check for collisions between stones
      detectCollisions(this.stones, p);
      
      time += timeStep;
    }
    
    return trajectories;
  }
  
  // Animate the stones based on trajectories
  animateStones(trajectories, dt) {
    this.stopAnim();
    
    // Find the maximum frame count across all trajectories
    let maxFrames = 0;
    Object.values(trajectories).forEach(traj => {
      maxFrames = Math.max(maxFrames, traj.length);
    });
    
    if (maxFrames === 0) return; // No trajectories to animate
    
    const stepMS = 1000 * dt; // one sim-step per frame
    let frame = 0;
    
    // Initialize rotation tracking for each stone
    Object.entries(trajectories).forEach(([stoneId, traj]) => {
      if (traj.length > 0) {
        const stone = this.stones.find(s => s.id == stoneId);
        if (stone) {
          stone.rotation = 0; // Reset rotation at the start of each throw
          stone.w = traj[0].w; // Save initial angular velocity
        }
      }
    });
    
    this.anim = d3.interval(() => {
      if (frame >= maxFrames) { 
        this.stopAnim();
        this.updateStoneDisplay(); // Ensure final positions are shown
        return; 
      }
      
      // Update each stone position and rotation
      Object.entries(trajectories).forEach(([stoneId, traj]) => {
        if (frame < traj.length) {
          const stoneElem = d3.select(`#stone-${stoneId}`);
          if (!stoneElem.empty()) {
            // Find the stone object to get its angular velocity
            const stone = this.stones.find(s => s.id == stoneId);
            if (stone) {
              // Get current frame data
              const frameState = traj[frame];
              
              // Update stone's physical properties
              stone.x = frameState.x;
              stone.y = frameState.y;
              stone.vx = frameState.vx;
              stone.vy = frameState.vy;
              stone.w = frameState.w;
              
              // Calculate rotation increment since last frame
              if (frame > 0) {
                const dt = frameState.t - traj[frame-1].t;
                
                // Simply negate the angular velocity to reverse the direction
                stone.rotation -= frameState.w * dt * 180 / Math.PI;
              }
              
              // Update position and rotation
              stoneElem
                .attr("transform", `translate(${this.renderer.xScale(frameState.x)}, ${this.renderer.yScale(frameState.y)}) rotate(${stone.rotation})`);
            }
          }
        }
      });
      
      frame++;
    }, stepMS);
  }
  
  // Export stone data to CSV
  exportCSV() {
    if (this.stones.length === 0) {
      alert("No stones to export data for.");
      return;
    }
    
    // Export all stone positions and states
    let csv = "stone_id,team,t_s,x_m,y_m,vx_mps,vy_mps,omega_radps\n";
    
    this.stones.forEach(stone => {
      csv += `${stone.id},${stone.team},${stone.t.toFixed(4)},${stone.x.toFixed(6)},${stone.y.toFixed(6)},${stone.vx.toFixed(6)},${stone.vy.toFixed(6)},${stone.w.toFixed(6)}\n`;
    });
    
    const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "stones.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
