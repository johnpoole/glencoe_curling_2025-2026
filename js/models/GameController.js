import { detectCollisions } from './Physics.js';
import { simulateStone, simulateAll, simulateDraw } from './Simulation.js';
// We'll import the simple evaluator directly in evaluateCurrentPosition

/**
 * Game Controller for managing curling game state and interactions
 */
export default class GameController {
  constructor(renderer, uiGetters, uiManager) {
    this.renderer = renderer;
    this.uiGetters = uiGetters;
    this.uiManager = uiManager;
    this.stones = [];
    this.selectedStoneId = null;
    this.currentTeam = 'red';
    this.broomPos = { x: renderer.dimensions.TEE_X, y: 0 }; // Default on the button
    this.anim = null;
    this.sheetDimensions = renderer.dimensions;
    
    // Game state management
    this.gameState = {
      currentEnd: 1,
      stonesThrown: 0,
      stoneNumber: 1,
      maxStonesPerEnd: 16,
      manualThrow: false,
      scores: {
        red: 0,
        yellow: 0
      },
      throwingOrder: ['red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red'],
      endScores: []
    };
    
    // Create the broom
    this.broom = renderer.createBroom(this.broomPos);
    
    // Set up click handler for broom placement
    this.setupBroomClickHandler();
    
    // Set up UI event handlers
    this.setupEventHandlers();
    
    // Initialize game UI
    this.updateGameUI();
    
    // Make sure UI is updated after a short delay to ensure all values are displayed
    setTimeout(() => {
      // Force UI update again after DOM is fully ready
      this.updateGameUI();
    }, 200);
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
    
    // Shot exploration buttons
    document.getElementById("showPathsBtn").addEventListener("click", () => this.showMultiplePaths());
    document.getElementById("hidePathsBtn").addEventListener("click", () => this.hidePaths());
    
    // Game control buttons
    document.getElementById("nextThrowBtn").addEventListener("click", () => this.nextThrow());
    document.getElementById("scoreEndBtn").addEventListener("click", () => this.showScoringUI());
    document.getElementById("resetEndBtn").addEventListener("click", () => this.resetEnd());
    document.getElementById("confirmScoreBtn").addEventListener("click", () => this.confirmScore());
    document.getElementById("autoscoreBtn").addEventListener("click", () => this.autoScoreEnd());
    document.getElementById("cancelScoreBtn").addEventListener("click", () => this.hideScoringUI());
    document.getElementById("viewScoreboardBtn").addEventListener("click", () => this.updateScoreboard());
    
    // Score buttons
    document.querySelectorAll(".score-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const team = e.target.dataset.team;
        const score = e.target.dataset.score;
        
        // Clear other selections for this team
        document.querySelectorAll(`.score-btn[data-team="${team}"]`).forEach(b => {
          b.classList.remove("selected");
        });
        
        // Select this button
        e.target.classList.add("selected");
        
        // Only one team can score in an end
        if (score !== "0") {
          const otherTeam = team === "red" ? "yellow" : "red";
          document.querySelectorAll(`.score-btn[data-team="${otherTeam}"]`).forEach(b => {
            if (b.dataset.score !== "0") {
              b.classList.remove("selected");
            } else {
              b.classList.add("selected");
            }
          });
        }
      });
    });
  }
  
  // Generate a unique ID for stones
  generateStoneId() {
    return this.stones.length > 0 ? Math.max(...this.stones.map(s => s.id)) + 1 : 1;
  }
  
  // Update stone visuals on the sheet
  updateStoneDisplay() {
    // Remove existing stones
    this.renderer.clearStones();
    
    // Clear metrics display if we're not currently in an animation
    if (!this.anim && this.uiManager) {
      this.uiManager.clearMetrics();
    }
    
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
    
    // Clear position evaluation
    const evalElement = document.getElementById("positionEvaluation");
    if (evalElement) {
      evalElement.innerHTML = "";
    }
  }
  
  // Stop any active animation
  stopAnim() { 
    if (this.anim) { 
      this.anim.stop(); 
      this.anim = null; 
    } 
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
  
  // Calculate metrics at the end of animation
  calculateFinalMetrics(trajectories) {
    // We're only interested in the active stone (the one just thrown)
    const activeStoneId = this.activeStoneId || this.selectedStoneId;
    if (!activeStoneId) return;
    
    const trajectory = trajectories[activeStoneId];
    if (!trajectory || trajectory.length === 0) return;
    
    // Get the final frame data
    const finalFrame = trajectory[trajectory.length - 1];
    
      // Calculate hog-to-hog time
      let hogToHogTime = null;
      let hogTime = 0;
      
      // Get hog line positions from SheetDimensions
      const nearHogLine = 0; // Near hog is at x=0
      const farHogLine = this.renderer.dimensions.FAR_HOG_X;
      
      // Find the hog-to-hog time by looking for when the stone crosses the hog lines
      for (let i = 0; i < trajectory.length; i++) {
        const frame = trajectory[i];
        if (frame.x >= nearHogLine && hogTime === 0) {
          hogTime = frame.t; // First hog line cross time
        } else if (frame.x >= farHogLine && hogTime > 0) {
          hogToHogTime = frame.t - hogTime; // Calculate hog-to-hog time
          break;
        }
      }    // Update the metrics in the UI
    this.uiManager.updateMetrics(
      finalFrame.x, // Final x position
      finalFrame.y, // Final y position (curl)
      finalFrame.t, // Total time
      hogToHogTime  // Hog-to-hog time
    );
  }

  // Animate the stones based on trajectories
  animateStones(trajectories, dt) {
    // Force animation speed update from latest UI value
    this.stopAnim();
    
    // Find the maximum frame count across all trajectories
    let maxFrames = 0;
    Object.values(trajectories).forEach(traj => {
      maxFrames = Math.max(maxFrames, traj.length);
    });
    
    if (maxFrames === 0) return; // No trajectories to animate
    
    // Get the user-defined animation speed directly from the DOM
    const animSpeedElement = document.getElementById('animationSpeed');
    const animSpeed = animSpeedElement ? parseFloat(animSpeedElement.value) : 16;
    
    // For very high speeds, we'll skip frames to maintain smoothness
    const frameSkip = animSpeed > 16 ? Math.floor(animSpeed / 8) : 1;
    
    // Calculate step time based on animation speed and frame skipping
    const stepMS = (1000 * dt) / (animSpeed / frameSkip);
    
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
        // Animation complete - update metrics directly
        
        // Get the last thrown stone's trajectory
        const stoneId = this.activeStoneId || this.selectedStoneId;
        if (stoneId && trajectories[stoneId] && trajectories[stoneId].length > 0) {
          const traj = trajectories[stoneId];
          const lastFrame = traj[traj.length - 1];
          
          // Update metrics directly in DOM
          document.getElementById('mx').textContent = lastFrame.x.toFixed(2);
          document.getElementById('my').textContent = lastFrame.y.toFixed(2);
          document.getElementById('mt').textContent = lastFrame.t.toFixed(2);
          
          // Calculate hog-to-hog time
          let hogToHogTime = "—";
          let firstHogTime = 0;
          
          // Get hog line positions from SheetDimensions
          const nearHogLine = 0; // Near hog is at x=0
          const farHogLine = this.renderer.dimensions.FAR_HOG_X;
          
          for (let i = 0; i < traj.length; i++) {
            const frame = traj[i];
            if (frame.x >= nearHogLine && firstHogTime === 0) {
              firstHogTime = frame.t;
            } else if (frame.x >= farHogLine && firstHogTime > 0) {
              hogToHogTime = (frame.t - firstHogTime).toFixed(2);
              break;
            }
          }
          
          document.getElementById('mhh').textContent = hogToHogTime;
        }        this.stopAnim();
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
              // Get current frame data with frame skipping for higher speed animations
              const frameState = traj[Math.min(frame, traj.length - 1)];
              
              // Update stone's physical properties
              stone.x = frameState.x;
              stone.y = frameState.y;
              stone.vx = frameState.vx;
              stone.vy = frameState.vy;
              stone.w = frameState.w;
              
              // Calculate rotation increment since last frame
              if (frame > 0) {
                const dt = frameState.t - traj[frame-1].t;
                
                // For the visual rotation, we need to match curling conventions:
                // In curling, a positive angular velocity (CCW/in-turn) should rotate clockwise visually
                // and negative angular velocity (CW/out-turn) should rotate counterclockwise visually
                stone.rotation -= frameState.w * dt * 180 / Math.PI;
              }
              
              // Update position and rotation
              stoneElem
                .attr("transform", `translate(${this.renderer.xScale(frameState.x)}, ${this.renderer.yScale(frameState.y)}) rotate(${stone.rotation})`);
            }
          }
        }
      });
      
      // Calculate next frame based on frame skipping
      const nextFrame = frame + frameSkip;
      
      // If the next frame would go past the end, just go to the last frame
      if (frame < maxFrames && nextFrame >= maxFrames) {
        frame = maxFrames - 1; // Set to last valid frame
      } else {
        frame += frameSkip;
      }
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

  // Generate and display multiple shot trajectories
  showMultiplePaths() {
    console.log("showMultiplePaths function called");
    
    // Clear previous paths
    this.renderer.clearPaths();
    
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
    
    const start = this.sheetDimensions.START;
    const turn = this.uiGetters.turn();
    const omega0 = this.uiGetters.omega0();
    
    // Get parameters from UI
    const broomSpacing = document.getElementById("broomSpacing") ? 
      parseFloat(document.getElementById("broomSpacing").value) : 0.1524; // Default 6 inches
    
    const velocityStart = document.getElementById("velocityStart") ?
      parseFloat(document.getElementById("velocityStart").value) : 1.8;
    
    const velocityEnd = document.getElementById("velocityEnd") ?
      parseFloat(document.getElementById("velocityEnd").value) : 2.8;
    
    const velocityStep = document.getElementById("velocityStep") ?
      parseFloat(document.getElementById("velocityStep").value) : 0.1;
    
    // Set range for broom positions
    const broomYPositions = [];
    
    // Generate an array of broom positions from -2 meters to +2 meters
    for (let y = -2.0; y <= 2.0; y += broomSpacing) {
      broomYPositions.push(parseFloat(y.toFixed(4)));
    }
    
    // Set range for velocities
    const velocities = [];
    for (let v = velocityStart; v <= velocityEnd; v += velocityStep) {
      velocities.push(parseFloat(v.toFixed(2)));
    }
    
    // Define spin directions (both CW and CCW)
    const spinDirections = [
      { label: "In (CCW)", value: "in" },
      { label: "Out (CW)", value: "out" }
    ];
    
    // Generate more vibrant colors for better visibility
    const colorScaleIn = d3.scaleSequential(d3.interpolateCool)
      .domain([0, velocities.length - 1]);
    
    const colorScaleOut = d3.scaleSequential(d3.interpolateWarm)
      .domain([0, velocities.length - 1]);
    
    // Keep track of paths we're generating for the legend
    const pathDetails = [];
    const allPaths = [];
    
    // For each spin direction
    spinDirections.forEach(spinDirection => {
      // For each velocity, simulate shots for all broom positions
      velocities.forEach((velocity, vIndex) => {
        // Generate a color based on spin direction with higher opacity for better visibility
        const colorScale = spinDirection.value === "in" ? colorScaleIn : colorScaleOut;
        const color = d3.rgb(colorScale(vIndex));
        const colorWithOpacity = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`;
        
        let addedToLegend = false;
        
        // For each broom position, simulate a shot
        broomYPositions.forEach(broomY => {
          const broomPt = { x: this.sheetDimensions.TEE_X, y: broomY };
          const startPt = { x: start.x, y: 0 };
          
          // Simulate the shot with this spin direction
          const trajectory = simulateDraw(velocity, omega0, spinDirection.value, p, startPt, broomPt, this.sheetDimensions);
          
          // Get filter setting
          const filterPathsEnabled = document.getElementById("filterPaths") ? 
            document.getElementById("filterPaths").checked : true;
          
          // Use the metadata to check if the stone stopped properly on the sheet
          const pathIsValid = trajectory.stoppedOnSheet === true;
          
          // Either show all paths or only the valid ones
          if (!filterPathsEnabled || pathIsValid) {
            // Add to our collection
            allPaths.push({ 
              trajectory, 
              color: colorWithOpacity,
              velocity,
              spinDirection: spinDirection.label
            });
            
            // Create path data object with all info needed for hover
            const pathDataObj = {
              velocity,
              broomY, 
              spinDirection: spinDirection.label,
              color: colorWithOpacity
            };
            
            // Draw the path with semi-transparent color and pass path data
            this.renderer.drawPath(trajectory, colorWithOpacity, true, pathDataObj);
            
            // Only add to legend once per velocity/spin combination
            if (!addedToLegend) {
              pathDetails.push({ 
                velocity, 
                color: color.toString(), 
                spinDirection: spinDirection.label
              });
              addedToLegend = true;
            }
          }
        });
      });
    });
    
    // Check for stones on the sheet to simulate collisions
    const showCollisions = document.getElementById("showCollisions") ? 
      document.getElementById("showCollisions").checked : true;
      
    if (this.stones.length > 0 && showCollisions) {
      // For selected velocities, simulate collision paths with existing stones
      const collisionVelocities = [velocityStart, (velocityStart + velocityEnd) / 2, velocityEnd];
      const collisionColor = "rgba(50, 220, 50, 0.9)"; // Bright green for collision paths with high opacity
      let addedCollisionToLegend = false;
      
      collisionVelocities.forEach(velocity => {
        // Try a few strategic broom positions
        [-1, -0.5, 0, 0.5, 1].forEach(broomY => {
          spinDirections.forEach(spinDirection => {
            // Create a temporary stone for simulation
            const tempStone = {
              id: 999,
              x: start.x,
              y: 0,
              vx: 0, 
              vy: 0,
              w: 0,
              team: this.currentTeam,
              inPlay: true,
              t: 0,
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
            
            // Set up the throw
            const broomPt = { x: this.sheetDimensions.TEE_X, y: broomY };
            const dir = {
              ux: broomPt.x - tempStone.x,
              uy: broomPt.y - tempStone.y
            };
            const mag = Math.hypot(dir.ux, dir.uy) || p.vEps;
            dir.ux /= mag;
            dir.uy /= mag;
            
            tempStone.vx = velocity * dir.ux;
            tempStone.vy = velocity * dir.uy;
            tempStone.w = spinDirection.value === "in" ? 
              Math.abs(omega0) : -Math.abs(omega0);
            
            // Make a copy of existing stones
            const stonesCopy = this.stones.map(stone => ({
              ...stone,
              toState() { return { t: this.t, x: this.x, y: this.y, vx: this.vx, vy: this.vy, w: this.w }; },
              fromState(state) {
                this.t = state.t;
                this.x = state.x;
                this.y = state.y;
                this.vx = state.vx;
                this.vy = state.vy;
                this.w = state.w;
              }
            }));
            
            // Add the temporary stone
            stonesCopy.push(tempStone);
            
            // Simulate to see if collisions occur
            const trajectories = this.simulateForCollisions(stonesCopy, p);
            
            // Check if any collisions occurred
            if (trajectories.collisionData && trajectories.collisionData.collisionOccurred) {
              console.log("Found a collision scenario with velocity", velocity, "and broom position", broomY);
              
              // Draw the collision path
              if (trajectories[999] && trajectories[999].length > 0) {
                console.log("Drawing collision path with", trajectories[999].length, "points");
                
                // Generate a unique collision ID for this collision scenario
                const collisionId = `collision-${velocity}-${broomY}-${spinDirection.value}-${Date.now()}`;
                
                // Create path data for collision path
                const collisionPathData = {
                  velocity: velocity,
                  broomY: broomY,
                  spinDirection: spinDirection.label,
                  color: collisionColor,
                  isCollision: true,
                  collisionId: collisionId
                };
                
                // Always draw the throwing stone path
                const thrownStonePath = this.renderer.drawPath(trajectories[999], collisionColor, true, collisionPathData);
                
                // Add collision ID as a data attribute
                if (thrownStonePath) {
                  thrownStonePath.attr("data-collision-id", collisionId);
                }
                
                // Check if we have any stones that moved
                let movedStonesCount = 0;
                
                // Draw paths for all stones that moved due to collision
                Object.entries(trajectories).forEach(([stoneId, traj]) => {
                  if (stoneId !== '999' && 
                      stoneId !== 'collisionData' && 
                      traj.length > 1) {
                    
                    // Check if this stone moved due to the collision
                    const didMove = trajectories.collisionData.stoneMoved[stoneId];
                    
                    if (didMove) {
                      console.log(`Drawing moved stone ${stoneId} path with ${traj.length} points`);
                      movedStonesCount++;
                      
                      // Path data for moved stone
                      const movedStonePathData = {
                        velocity: "Stone moved",
                        broomY: broomY,
                        spinDirection: `Stone ${stoneId}`,
                        color: "rgba(180, 50, 220, 0.9)",
                        isHitStone: true,
                        collisionId: collisionId
                      };
                      
                      // This is an existing stone that moved due to collision - bright purple with high opacity
                      const hitStonePath = this.renderer.drawPath(traj, "rgba(180, 50, 220, 0.9)", true, movedStonePathData);
                      
                      // Add collision ID as a data attribute
                      if (hitStonePath) {
                        hitStonePath.attr("data-collision-id", collisionId);
                      }
                    }
                  }
                });
                
                console.log(`Found ${movedStonesCount} stones that moved in this collision scenario`);
                
                // Only add to legend once for collision paths
                if (!addedCollisionToLegend) {
                  // Add collision path to the legend
                  pathDetails.push({
                    velocity: "Collisions",
                    color: "rgb(50, 220, 50)",
                    spinDirection: ""
                  });
                  
                  // Add moved stones to legend
                  pathDetails.push({
                    velocity: "Stones moved",
                    color: "rgb(180, 50, 220)",
                    spinDirection: ""
                  });
                  
                  addedCollisionToLegend = true;
                }
              } else {
                console.log("No trajectory for thrown stone even though collision was detected");
              }
            }
          });
        });
      });
    }
    
    // Add legend for velocities and spin directions
    this.renderer.drawVelocityLegend(pathDetails);
  }
  
  // Hide all paths
  hidePaths() {
    this.renderer.clearPaths();
  }
  
  // Update the game UI with current state
  updateGameUI() {
    // Update current end and stones thrown
    document.getElementById("currentEndNumber").textContent = this.gameState.currentEnd;
    document.getElementById("stonesThrown").textContent = this.gameState.stonesThrown;
    document.getElementById("stoneNumber").textContent = this.gameState.stoneNumber;
    
    // Update team to throw
    const teamToThrowElem = document.getElementById("teamToThrow");
    if (this.gameState.stonesThrown < this.gameState.maxStonesPerEnd) {
      const teamIndex = this.gameState.stonesThrown % this.gameState.throwingOrder.length;
      const teamToThrow = this.gameState.throwingOrder[teamIndex];
      this.currentTeam = teamToThrow;
      
      teamToThrowElem.textContent = teamToThrow === 'red' ? 'Red' : 'Yellow';
      teamToThrowElem.style.color = teamToThrow === 'red' ? '#e74c3c' : '#f1c40f';
    }
    
    // Update scores
    document.getElementById("redScore").textContent = this.gameState.scores.red;
    document.getElementById("yellowScore").textContent = this.gameState.scores.yellow;
    
    // Force DOM update
    requestAnimationFrame(() => {
      // Re-check values
      document.getElementById("currentEndNumber").textContent = this.gameState.currentEnd;
      document.getElementById("stonesThrown").textContent = this.gameState.stonesThrown;
    });
  }
  
  // Handle the next throw in sequence
  nextThrow() {
    if (this.gameState.stonesThrown >= this.gameState.maxStonesPerEnd) {
      alert("All stones for this end have been thrown. Please score the end.");
      return;
    }
    
    // Set the correct team
    const teamIndex = this.gameState.stonesThrown % this.gameState.throwingOrder.length;
    const teamToThrow = this.gameState.throwingOrder[teamIndex];
    this.currentTeam = teamToThrow;
    
    // Flag to prevent double counting in runOnce
    this.gameState.manualThrow = false;
    
    // Update UI
    this.updateGameUI();
    
    // Throw the stone
    this.runOnce();
    
    // Update UI again
    this.updateGameUI();
    
    // Double-check we have the correct UI state
    setTimeout(() => {
      this.updateGameUI();
    }, 100);
  }
  
  // Override the runOnce method to integrate with game state
  runOnce() {
    // If manually throwing outside of game flow, ensure we update the UI after
    const updateAfter = true;
    
    // Run the original throw logic
    const start = this.sheetDimensions.START;
    const V0 = this.uiGetters.V0();
    const omega0 = this.uiGetters.omega0();
    const turn = this.uiGetters.turn();
    const sweep = this.uiGetters.sweep();
    
    // Create a new stone
    const stoneId = this.generateStoneId();
    
    // Save the active stone ID for metrics tracking
    this.activeStoneId = stoneId;
    
    const stone = {
      id: stoneId,
      x: start.x,
      y: 0,
      vx: 0,
      vy: 0,
      w: 0,
      team: this.currentTeam,
      inPlay: true,
      t: 0,
      rotation: 0,
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
    
    // Add the stone to our array
    this.stones.push(stone);
    
    // Make sure the stone is drawn on the sheet
    this.updateStoneDisplay();
    
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
    
    // Setup the throw
    const dir = {
      ux: this.broomPos.x - stone.x,
      uy: this.broomPos.y - stone.y
    };
    const mag = Math.hypot(dir.ux, dir.uy) || p.vEps;
    dir.ux /= mag;
    dir.uy /= mag;
    
    stone.vx = V0 * dir.ux;
    stone.vy = V0 * dir.uy;
    stone.w = turn === "in" ? Math.abs(omega0) : -Math.abs(omega0);
    
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
        
        // Update metrics for the stone that was just thrown
        if (stoneId == this.activeStoneId && traj.length > 0) {
          const lastFrame = traj[traj.length - 1];
          
          // Update metrics directly in DOM
          document.getElementById('mx').textContent = lastFrame.x.toFixed(2);
          document.getElementById('my').textContent = lastFrame.y.toFixed(2);
          document.getElementById('mt').textContent = lastFrame.t.toFixed(2);
          
          // Calculate hog-to-hog time
          let hogToHogTime = "—";
          let firstHogTime = 0;
          
          // Get hog line positions from SheetDimensions
          const nearHogLine = 0; // Near hog is at x=0
          const farHogLine = this.renderer.dimensions.FAR_HOG_X; // Far hog line from dimensions
          
          for (let i = 0; i < traj.length; i++) {
            const frame = traj[i];
            if (frame.x >= nearHogLine && firstHogTime === 0) {
              firstHogTime = frame.t;
            } else if (frame.x >= farHogLine && firstHogTime > 0) {
              hogToHogTime = (frame.t - firstHogTime).toFixed(2);
              break;
            }
          }
          
          document.getElementById('mhh').textContent = hogToHogTime;
        }
      }
    });
    
    // Animate the stones
    this.animateStones(trajectories, p.dt);
    
    // Increment stone count in game state
    if (!this.gameState.manualThrow) {
      this.gameState.stonesThrown++;
      this.gameState.stoneNumber = (this.gameState.stoneNumber % 8) + 1;
    }
    
    // Switch teams after throwing
    this.currentTeam = this.currentTeam === 'red' ? 'yellow' : 'red';
    
    // Evaluate the position
    this.evaluateCurrentPosition();
    
    if (updateAfter) {
      this.updateGameUI();
    }
  }
  
  // Reset the current end
  resetEnd() {
    if (confirm("Are you sure you want to reset the current end?")) {
      this.gameState.stonesThrown = 0;
      this.gameState.stoneNumber = 1;
      this.currentTeam = 'red'; // Red always starts the end
      this.clearStones();
      this.updateGameUI();
    }
  }
  
  // Show the scoring UI
  showScoringUI() {
    // Only show scoring if we have stones in play
    if (this.stones.length === 0) {
      alert("There are no stones to score.");
      return;
    }
    
    document.getElementById("endScoringDisplay").style.display = "block";
  }
  
  // Hide the scoring UI
  hideScoringUI() {
    document.getElementById("endScoringDisplay").style.display = "none";
    
    // Clear selections
    document.querySelectorAll(".score-btn").forEach(btn => {
      btn.classList.remove("selected");
    });
  }
  
  // Confirm manually entered score
  confirmScore() {
    let redScore = 0;
    let yellowScore = 0;
    
    // Get selected scores
    const redSelection = document.querySelector(".score-btn[data-team='red'].selected");
    const yellowSelection = document.querySelector(".score-btn[data-team='yellow'].selected");
    
    if (!redSelection && !yellowSelection) {
      alert("Please select a score for at least one team.");
      return;
    }
    
    if (redSelection) {
      redScore = redSelection.dataset.score === "4+" ? 4 : parseInt(redSelection.dataset.score);
    }
    
    if (yellowSelection) {
      yellowScore = yellowSelection.dataset.score === "4+" ? 4 : parseInt(yellowSelection.dataset.score);
    }
    
    // Check that only one team scored (curling rule)
    if (redScore > 0 && yellowScore > 0) {
      alert("Only one team can score in an end.");
      return;
    }
    
    // Save the score
    this.saveEndScore(redScore, yellowScore);
  }
  
  // Save the end score and advance to the next end
  saveEndScore(redScore, yellowScore) {
    // Update game scores
    this.gameState.scores.red += redScore;
    this.gameState.scores.yellow += yellowScore;
    
    // Save this end's score
    this.gameState.endScores.push({
      end: this.gameState.currentEnd,
      red: redScore,
      yellow: yellowScore
    });
    
    // Update the scoreboard with the new score
    if (this.gameState.currentEnd <= 8) {
      document.getElementById(`red-end-${this.gameState.currentEnd}`).textContent = 
        redScore || (yellowScore > 0 ? '0' : '-');
      document.getElementById(`yellow-end-${this.gameState.currentEnd}`).textContent = 
        yellowScore || (redScore > 0 ? '0' : '-');
    }
    
    // Update totals
    document.getElementById("red-total").textContent = this.gameState.scores.red;
    document.getElementById("yellow-total").textContent = this.gameState.scores.yellow;
    
    // Advance to next end
    this.gameState.currentEnd++;
    this.gameState.stonesThrown = 0;
    this.gameState.stoneNumber = 1;
    
    // Determine next end's starting team (winner of previous end goes last)
    if (redScore > yellowScore) {
      // Yellow starts if red won
      this.gameState.throwingOrder = ['yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow'];
    } else if (yellowScore > redScore) {
      // Red starts if yellow won
      this.gameState.throwingOrder = ['red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red', 'yellow', 'red'];
    }
    // If it's a blank end (0-0), the same team keeps hammer
    
    // Show a message with the end score
    const scoringTeam = redScore > 0 ? 'Red' : (yellowScore > 0 ? 'Yellow' : 'None');
    const points = redScore > 0 ? redScore : (yellowScore > 0 ? yellowScore : 0);
    
    if (points > 0) {
      alert(`End ${this.gameState.currentEnd - 1} Complete: ${scoringTeam} team scored ${points} point${points !== 1 ? 's' : ''}.`);
    } else {
      alert(`End ${this.gameState.currentEnd - 1} Complete: Blank end (0-0).`);
    }
    
    // If this was the final end, show game over message
    if (this.gameState.currentEnd > 8) {
      const redTotal = this.gameState.scores.red;
      const yellowTotal = this.gameState.scores.yellow;
      const winner = redTotal > yellowTotal ? 'Red' : (yellowTotal > redTotal ? 'Yellow' : 'Tied');
      
      setTimeout(() => {
        alert(`Game Over!\nFinal Score: Red ${redTotal} - ${yellowTotal} Yellow\n${winner === 'Tied' ? 'The game ended in a tie!' : `${winner} team wins!`}`);
      }, 100);
    }
    
    // Clear the stones and hide scoring UI
    this.clearStones();
    this.hideScoringUI();
    
    // Update UI
    this.updateGameUI();
  }
  
  // Automatically score the end based on stone positions
  autoScoreEnd() {
    // Get stones in the house
    const houseCenterX = this.sheetDimensions.TEE_X;
    const houseCenterY = 0;
    const houseRadius = this.sheetDimensions.HOUSE_R12;
    
    const stonesInHouse = this.stones.filter(stone => {
      const distanceToButton = Math.hypot(stone.x - houseCenterX, stone.y - houseCenterY);
      return distanceToButton <= houseRadius;
    });
    
    if (stonesInHouse.length === 0) {
      alert("No stones in the house. This is a blank end (0-0).");
      this.saveEndScore(0, 0);
      return;
    }
    
    // Sort stones by distance to button
    stonesInHouse.sort((a, b) => {
      const distA = Math.hypot(a.x - houseCenterX, a.y - houseCenterY);
      const distB = Math.hypot(b.x - houseCenterX, b.y - houseCenterY);
      return distA - distB;
    });
    
    // Closest stone determines the scoring team
    const closestStone = stonesInHouse[0];
    const scoringTeam = closestStone.team;
    
    // Count stones of scoring team until we encounter an opposing stone
    let score = 0;
    for (const stone of stonesInHouse) {
      if (stone.team === scoringTeam) {
        score++;
      } else {
        break;  // Stop counting when we hit the other team's stone
      }
    }
    
    // Cap score at 8 (although unlikely in real curling)
    score = Math.min(score, 8);
    
    const redScore = scoringTeam === 'red' ? score : 0;
    const yellowScore = scoringTeam === 'yellow' ? score : 0;
    
    // Confirm with user
    if (confirm(`Auto-scoring result: ${scoringTeam === 'red' ? 'Red' : 'Yellow'} team scores ${score} point${score !== 1 ? 's' : ''}. Confirm?`)) {
      this.saveEndScore(redScore, yellowScore);
    }
  }
  
  // Update the scoreboard display
  updateScoreboard() {
    // Update individual end scores
    this.gameState.endScores.forEach(endScore => {
      const endNumber = endScore.end;
      if (endNumber <= 8) {  // Only show first 8 ends
        // Update red score
        const redCell = document.getElementById(`red-end-${endNumber}`);
        if (redCell) {
          redCell.textContent = endScore.red || (endScore.yellow > 0 ? '0' : '-');
        }
        
        // Update yellow score
        const yellowCell = document.getElementById(`yellow-end-${endNumber}`);
        if (yellowCell) {
          yellowCell.textContent = endScore.yellow || (endScore.red > 0 ? '0' : '-');
        }
      }
    });
    
    // Update totals
    document.getElementById("red-total").textContent = this.gameState.scores.red;
    document.getElementById("yellow-total").textContent = this.gameState.scores.yellow;
    
    // Show the scoreboard modal
    document.getElementById("scoreboardModal").style.display = "block";
  }
  
  // Evaluate current stone positions and display the results
  evaluateCurrentPosition() {
    if (this.stones.length === 0) return;
    
    try {
      // Import the curlingeval.js module using dynamic import
      import('../analyze/curlingeval.js').then(module => {
        // Access evaluatePosition17 function from the module (handle both ESM and CommonJS exports)
        const evaluatePosition17 = module.evaluatePosition17 || module.default?.evaluatePosition17;
        
        // Convert our stone representation to the format expected by evaluatePosition17
        // evaluatePosition17 expects stones = [["A"|"B", x, y], ...] in Cartesian (m)
        const stoneData = this.stones.map(stone => {
          // Convert from sheet coordinates to button-centered coordinates
          const buttonX = this.renderer.dimensions.TEE_X;
          const x = stone.x - buttonX;
          const y = stone.y; // Y is already centered
          
          // Convert team names from 'red'/'yellow' to 'A'/'B' for the evaluator
          const team = stone.team === 'red' ? 'A' : 'B';
          
          return [team, x, y]; // Return array format needed by evaluatePosition17
        });
        
        // Determine which team has hammer
        let hammerTeam = 'A'; // Default to red (A) having hammer in first end
        
        if (this.gameState.currentEnd > 1 && this.gameState.endScores.length > 0) {
          const lastEnd = this.gameState.endScores[this.gameState.endScores.length - 1];
          if (lastEnd.red > 0) {
            hammerTeam = 'B'; // Yellow has hammer if red scored in the previous end
          } else if (lastEnd.yellow > 0) {
            hammerTeam = 'A'; // Red has hammer if yellow scored in the previous end
          }
        }
        
        // Get the shot number (0-15)
        const shotNumber = this.gameState.stonesThrown > 0 ? this.gameState.stonesThrown - 1 : 0;
        
        let result;
        
        // If all shots are thrown (16), calculate the actual score instead of a prediction
        if (shotNumber >= 15) { // Note: shotNumber is 0-15, so 15 is the last stone
          result = this.calculateActualEndResult(stoneData, hammerTeam);
        } else {
          // Use the new evaluatePosition17 function
          result = evaluatePosition17(shotNumber, hammerTeam, stoneData);
        }
        
        // Prepare for display
        const evalElement = document.getElementById("positionEvaluation");
        if (!evalElement) return;
        
        // Basic UI setup
        const hammerDisplay = hammerTeam === 'A' ? "Red" : "Yellow";
        // Convert advantages to percentages instead of showing raw decimal values
        const redAdvantage = Math.round(Math.max(0, result.advantage.A * 100)) + "%";
        const yellowAdvantage = Math.round(Math.max(0, result.advantage.B * 100)) + "%";
        
        const maxAdvantage = Math.max(Math.abs(result.advantage.A), Math.abs(result.advantage.B));
        const redWidth = maxAdvantage > 0 ? Math.max(0, result.advantage.A / maxAdvantage * 50) : 0;
        const yellowWidth = maxAdvantage > 0 ? Math.max(0, result.advantage.B / maxAdvantage * 50) : 0;
        
        let headerText = shotNumber >= 15 ? 
          `End ${this.gameState.currentEnd} Final Result` :
          `Shot ${Math.min(shotNumber + 1, 16)} / 16, ${hammerDisplay} has hammer`;
        
        // Create fresh probability distributions for each team that add up to 100%
        // In curling, when one team scores, the other team gets 0
        const redProbs = {}; 
        const yellowProbs = {};
        
        // Initialize with zeros
        for (let i = 0; i <= 8; i++) {
          redProbs[i] = 0;
          yellowProbs[i] = 0;
        }
        
        // Build probabilities directly from buckets17
        // In curlingeval.js:
        // - Positive k means hammer team scores k points (non-hammer team scores 0)
        // - Negative k means non-hammer team scores |k| points (hammer team scores 0)
        // - Zero means blank end (both teams score 0)
        
        // Handle blank end first (k=0)
        const blankProb = result.buckets17[0] || 0;
        redProbs[0] += blankProb;
        yellowProbs[0] += blankProb;
        
        // Calculate the sum of red scoring anything and yellow scoring anything
        let redScoringSum = 0;
        let yellowScoringSum = 0;
        
        // Process non-zero buckets
        for (let k = -8; k <= 8; k++) {
          if (k === 0) continue; // Already handled blank end
          
          const prob = result.buckets17[k] || 0;
          if (prob <= 0) continue; // Skip zero probabilities
          
          if (hammerTeam === 'A') { // Red has hammer
            if (k > 0) {
              // Red (hammer) scores k points
              redProbs[k] += prob;
              redScoringSum += prob;
              // When red scores, yellow must score 0
            } else {
              // Yellow (non-hammer) scores |k| points
              yellowProbs[-k] += prob;
              yellowScoringSum += prob;
              // When yellow scores, red must score 0
            }
          } else { // Yellow has hammer
            if (k > 0) {
              // Yellow (hammer) scores k points
              yellowProbs[k] += prob;
              yellowScoringSum += prob;
              // When yellow scores, red must score 0
            } else {
              // Red (non-hammer) scores |k| points
              redProbs[-k] += prob;
              redScoringSum += prob;
              // When red scores, yellow must score 0
            }
          }
        }
        
        // Now set the "0" scores to match the opposite team's scoring
        redProbs[0] = yellowScoringSum + blankProb;
        yellowProbs[0] = redScoringSum + blankProb;
        const formatTeamProbs = (rawProbs) => {
          // Convert to percentages and round
          const probs = {};
          let total = 0;
          
          // First pass - get integer percentages
          for (const [score, prob] of Object.entries(rawProbs)) {
            // Use Math.round to get fair rounding
            const pct = Math.round(prob * 100);
            if (pct > 0) { // Only keep non-zero percentages
              probs[score] = pct;
              total += pct;
            }
          }
          
          // Final verification - ensure we add to exactly 100%
          if (total !== 100 && Object.keys(probs).length > 0) {
            // Find the largest value to adjust
            let [largestKey, largestVal] = Object.entries(probs)
              .sort(([_, a], [__, b]) => b - a)[0];
              
            probs[largestKey] += (100 - total);
          }
          
          // Format for display
          return Object.entries(probs)
            .sort(([a], [b]) => parseInt(a) - parseInt(b)) // Sort by score (0, 1, 2, etc.)
            .map(([points, pct]) => `${points}: ${pct}%`)
            .join(", ");
        };
        
        // Generate display strings
        const redDisplay = formatTeamProbs(redProbs);
        const yellowDisplay = formatTeamProbs(yellowProbs);
        
        // Create raw buckets17 display
        const rawBuckets = Object.entries(result.buckets17)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([k, v]) => `${k}: ${v.toFixed(3)}`)
          .join(', ');
        
        // Create HTML output
        evalElement.innerHTML = `
          <div class="eval-header">${headerText}</div>
          <div class="team-advantage">
            <div class="red-advantage" style="width: ${redWidth}%;">${redAdvantage}</div>
            <div class="yellow-advantage" style="width: ${yellowWidth}%;">${yellowAdvantage}</div>
          </div>
          <div class="score-probabilities">
            <div>Raw buckets17: ${rawBuckets}</div>
            <div>Red probable scores: ${redDisplay}</div>
            <div>Yellow probable scores: ${yellowDisplay}</div>
          </div>
        `;
        
        // Log to console for debugging
        console.log("=== End " + this.gameState.currentEnd + " Position Evaluation ===");
        console.log("Shot #" + Math.min(shotNumber + 1, 16) + ", " + hammerDisplay + " has hammer");
        console.log("Team Advantage - Red: " + redAdvantage + ", Yellow: " + yellowAdvantage);
        console.log("Red probable scores: " + redDisplay);
        console.log("Yellow probable scores: " + yellowDisplay);
      }).catch(error => {
        console.error("Error loading curling evaluator:", error);
      });
    } catch (error) {
      console.error("Error evaluating position:", error);
    }
  }
  
  // Calculate the actual end result after all 16 shots have been thrown
  calculateActualEndResult(stoneData, hammerTeam) {
    // Get stones in the house
    const stonesInHouse = stoneData.filter(stone => {
      const distanceToButton = Math.hypot(stone[1], stone[2]);
      return distanceToButton <= 1.829; // R_HOUSE = 1.829 meters (6 feet)
    });
    
    // If no stones in the house, it's a blank end (0-0)
    if (stonesInHouse.length === 0) {
      // Format like evaluatePosition17 output
      const buckets = {};
      for (let i = -8; i <= 8; i++) {
        buckets[i] = 0;
      }
      buckets[0] = 1.0; // 100% chance of a blank end
      
      return {
        advantage: { A: 0, B: 0 },
        buckets17: buckets
      };
    }
    
    // Sort stones by distance to button
    stonesInHouse.sort((a, b) => {
      const distA = Math.hypot(a[1], a[2]);
      const distB = Math.hypot(b[1], b[2]);
      return distA - distB;
    });
    
    // Closest stone determines the scoring team
    const scoringTeam = stonesInHouse[0][0]; // Team is in first position of array
    
    // Count stones of scoring team until we encounter an opposing stone
    let score = 0;
    for (const stone of stonesInHouse) {
      if (stone[0] === scoringTeam) {
        score++;
      } else {
        break;  // Stop counting when we hit the other team's stone
      }
    }
    
    // Cap score at 8 (although unlikely in real curling)
    score = Math.min(score, 8);
    
    // Format like evaluatePosition17 output with buckets17
    const buckets = {};
    for (let i = -8; i <= 8; i++) {
      buckets[i] = 0;
    }
    
    // If hammer team scored
    if (scoringTeam === hammerTeam) {
      buckets[score] = 1.0; // 100% probability of hammer team scoring
    } else {
      buckets[-score] = 1.0; // 100% probability of non-hammer team scoring (negative value)
    }
    
    // Set advantage based on who scored
    let redAdvantage = 0;
    if (scoringTeam === 'A') {
      redAdvantage = score * 2; // More advantage for higher scores
    } else {
      redAdvantage = -score * 2;
    }
    
    return {
      advantage: { A: redAdvantage, B: -redAdvantage },
      buckets17: buckets
    };
  }
  
  // Simulate a scenario with potential collisions
  simulateForCollisions(stones, p) {
    console.log("Running collision simulation with", stones.length, "stones");
    
    // Initialize trajectories object
    const trajectories = {};
    stones.forEach(stone => {
      trajectories[stone.id] = [stone.toState()];
    });
    
    let time = 0;
    const timeStep = p.dt; // Use the same timestep as the physics
    const dims = this.sheetDimensions;
    
    // Track if collisions occur
    const collisionData = {
      collisionOccurred: false,
      stoneMoved: {},
      collisionTime: null
    };
    
    while (time < p.tMax) {
      // Check if all stones have stopped
      const allStopped = stones.every(stone => 
        !stone.inPlay || (Math.hypot(stone.vx, stone.vy) < p.vStop && Math.abs(stone.w) < p.wStop)
      );
      
      if (allStopped) {
        console.log("All stones stopped at time", time);
        break;
      }
      
      // Check initial velocities of stones to detect if they moved due to collision
      const preVelocities = {};
      stones.forEach(stone => {
        if (stone.inPlay) {
          preVelocities[stone.id] = Math.hypot(stone.vx, stone.vy);
        }
      });
      
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
        if (stone.x > dims.XMAX + 0.5 || 
            stone.x < dims.XMIN - 0.5 || 
            Math.abs(stone.y) > dims.HALF_W + 0.5) {
          stone.inPlay = false;
        }
      });
      
      // Check for collisions between stones
      const collisionsDetected = detectCollisions(stones, p);
      
      // If collisions happened, mark stones that started moving
      if (collisionsDetected) {
        console.log("Collision detected at time", time);
        collisionData.collisionOccurred = true;
        collisionData.collisionTime = time;
        
        // Check which stones suddenly gained velocity
        stones.forEach(stone => {
          if (stone.inPlay) {
            const currentVelocity = Math.hypot(stone.vx, stone.vy);
            // If velocity increased significantly after a collision, mark it
            if (stone.id !== 999 && // Not the thrown stone
                preVelocities[stone.id] !== undefined &&
                currentVelocity > preVelocities[stone.id] + 0.05) {
              console.log(`Stone ${stone.id} moved due to collision: vel ${preVelocities[stone.id].toFixed(3)} → ${currentVelocity.toFixed(3)}`);
              collisionData.stoneMoved[stone.id] = true;
            }
          }
        });
      }
      
      time += timeStep;
    }
    
    // Attach collision data to the result
    trajectories.collisionData = collisionData;
    
    if (collisionData.collisionOccurred) {
      console.log("Collision simulation completed. Collision detected:", 
                  collisionData.collisionOccurred,
                  "Stones moved:", Object.keys(collisionData.stoneMoved).length);
    }
    
    return trajectories;
  }
}
