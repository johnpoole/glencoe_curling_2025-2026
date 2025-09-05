/**
 * Visualization module for rendering the curling sheet and stones
 */
export default class SheetRenderer {
  constructor(svg, sheetDimensions) {
    this.svg = svg;
    this.dimensions = sheetDimensions;
    
    // Calculate scales and dimensions
    this.setupScales();
    
    // Initialize the sheet
    this.drawSheet();
  }
  
  setupScales() {
    const svg = this.svg;
    const dim = this.dimensions;
    
    const W = svg.node().clientWidth;
    
    // Calculate ideal height based on physical sheet proportions
    const sheetRatio = dim.SHEET_W / (dim.XMAX - dim.XMIN); // Width:Length ratio
    const idealHeight = W * sheetRatio;
    
    // Set SVG height directly
    svg.style("height", idealHeight + "px");
    
    const H = svg.node().clientHeight;
    const M = {t: 16, r: 24, b: 16, l: 24};
    
    // Calculate the pixels per meter based on the x-axis
    const pixelsPerMeter = (W - M.l - M.r) / (dim.XMAX - dim.XMIN);
    const totalSheetWidth = dim.SHEET_W * pixelsPerMeter;
    const yCenter = (H - M.t - M.b) / 2 + M.t;  // Center of available height
    
    // Create and store scales
    this.xScale = d3.scaleLinear()
      .domain([dim.XMIN, dim.XMAX])
      .range([M.l, W - M.r]);
    
    this.yScale = d3.scaleLinear()
      .domain([-dim.HALF_W, dim.HALF_W])
      .range([yCenter + totalSheetWidth/2, yCenter - totalSheetWidth/2]);
      
    // Store these for later use
    this.W = W;
    this.H = H;
    this.M = M;
  }
  
  drawSheet() {
    const svg = this.svg;
    const dim = this.dimensions;
    const xScale = this.xScale;
    const yScale = this.yScale;
    
    // Sheet background
    svg.append("rect")
      .attr("class", "sheet")
      .attr("x", xScale(dim.XMIN)).attr("y", yScale(dim.HALF_W))
      .attr("width", xScale(dim.XMAX) - xScale(dim.XMIN))
      .attr("height", yScale(-dim.HALF_W) - yScale(dim.HALF_W));
    
    // Hog lines and tee line
    svg.append("line").attr("class","hog")
      .attr("x1", xScale(0)).attr("y1", yScale(-dim.HALF_W))
      .attr("x2", xScale(0)).attr("y2", yScale(dim.HALF_W));
    svg.append("line").attr("class","hog")
      .attr("x1", xScale(dim.FAR_HOG_X)).attr("y1", yScale(-dim.HALF_W))
      .attr("x2", xScale(dim.FAR_HOG_X)).attr("y2", yScale(dim.HALF_W));
    svg.append("line").attr("class","tee")
      .attr("x1", xScale(dim.TEE_X)).attr("y1", yScale(-dim.HALF_W))
      .attr("x2", xScale(dim.TEE_X)).attr("y2", yScale(dim.HALF_W));
    
    // House
    const house = svg.append("g");
    house.append("circle").attr("class","house").attr("stroke","#0b4")
      .attr("cx", xScale(dim.TEE_X)).attr("cy", yScale(0)).attr("r", Math.abs(xScale(dim.TEE_X+dim.HOUSE_R12)-xScale(dim.TEE_X)));
    house.append("circle").attr("class","house").attr("stroke","#1765ff")
      .attr("cx", xScale(dim.TEE_X)).attr("cy", yScale(0)).attr("r", Math.abs(xScale(dim.TEE_X+dim.HOUSE_R8)-xScale(dim.TEE_X)));
    house.append("circle").attr("class","house").attr("stroke","#c00")
      .attr("cx", xScale(dim.TEE_X)).attr("cy", yScale(0)).attr("r", Math.abs(xScale(dim.TEE_X+dim.HOUSE_R4)-xScale(dim.TEE_X)));
    house.append("circle").attr("fill","#eee").attr("stroke","#333")
      .attr("cx", xScale(dim.TEE_X)).attr("cy", yScale(0)).attr("r", Math.abs(xScale(dim.TEE_X+dim.BUTTON_R)-xScale(dim.TEE_X)));
  }
  
  // Create and position the broom marker
  createBroom(initialPosition) {
    const svg = this.svg;
    const xScale = this.xScale;
    const yScale = this.yScale;
    
    const broom = svg.append("g").attr("class","broom");
    broom.append("circle").attr("r", 6).attr("cx", xScale(initialPosition.x)).attr("cy", yScale(initialPosition.y));
    broom.append("line").attr("x1", xScale(initialPosition.x)).attr("y1", yScale(initialPosition.y - 0.2))
      .attr("x2", xScale(initialPosition.x)).attr("y2", yScale(initialPosition.y + 0.2))
      .attr("stroke-width", 3).attr("stroke", "#4aa3ff");
    
    return broom;
  }
  
  // Update broom position
  updateBroom(broom, position) {
    const xScale = this.xScale;
    const yScale = this.yScale;
    
    broom.select("circle").attr("cx", xScale(position.x)).attr("cy", yScale(position.y));
    broom.select("line")
      .attr("x1", xScale(position.x)).attr("y1", yScale(position.y - 0.2))
      .attr("x2", xScale(position.x)).attr("y2", yScale(position.y + 0.2));
  }
  
  // Draw a stone on the sheet
  drawStone(stone, isSelected = false) {
    const svg = this.svg;
    const xScale = this.xScale;
    const yScale = this.yScale;
    
    // Initialize rotation angle if not set
    if (stone.rotation === undefined) {
      stone.rotation = 0;
    }
    
    // Create a group for the stone with its handle
    const stoneGroup = svg.append("g")
      .attr("class", "stone-group")
      .attr("id", `stone-${stone.id}`)
      .attr("transform", `translate(${xScale(stone.x)}, ${yScale(stone.y)}) rotate(${stone.rotation})`);
    
    // Add the stone circle
    const stoneElement = stoneGroup.append("circle")
      .attr("class", "stone")
      .attr("r", 7)
      .attr("cx", 0)
      .attr("cy", 0)
      .style("fill", stone.team === 'red' ? "#e74c3c" : "#f1c40f") // Red or yellow team colors
      .style("stroke", "#111")
      .style("stroke-width", 1.5)
      .style("cursor", "pointer")
      .style("stroke-dasharray", isSelected ? "2,2" : "none");
    
    // Add the handle (a T-shaped handle with grip at the end)
    const handleGroup = stoneGroup.append("g")
      .attr("class", "stone-handle");
    
    // Main handle line
    handleGroup.append("line")
      .attr("x1", -7)
      .attr("y1", 0)
      .attr("x2", 7)
      .attr("y2", 0)
      .style("stroke", "#333")
      .style("stroke-width", 2);
      
    // Cross piece at the end of the handle (perpendicular to the main handle)
    handleGroup.append("line")
      .attr("x1", 5)
      .attr("y1", -3)
      .attr("x2", 5)
      .attr("y2", 3)
      .style("stroke", "#333")
      .style("stroke-width", 2.5);
      
    return stoneGroup;
  }
  
  // Draw a path from trajectory points
  drawPath(trajectory, color, isMultiPath = false, pathData = null) {
    const svg = this.svg;
    const xScale = this.xScale;
    const yScale = this.yScale;
    
    const line = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y));
    
    const path = svg.append("path")
      .attr("class", isMultiPath ? "path path-visualization" : "path")
      .attr("d", line(trajectory))
      .style("stroke", color || "#1f2b38")
      .style("stroke-width", isMultiPath ? 2.5 : 2);
      
    // Add data attributes for hover information if provided
    if (pathData) {
      path.attr("data-velocity", pathData.velocity)
          .attr("data-broom-y", pathData.broomY)
          .attr("data-spin", pathData.spinDirection);
          
      // Add mouseover/mouseout event handlers
      path.on("mouseover", function(event) {
        // Show this path at full opacity
        d3.select(this).style("opacity", 1)
                       .style("stroke-width", 4)
                       .style("filter", "drop-shadow(0 0 3px rgba(255, 255, 255, 0.9))");
        
        // Check if this is a collision path
        const isCollisionPath = pathData.isCollision || pathData.isHitStone;
        let relatedPaths = [];
        
        // If this is a collision path, find related paths (thrown and hit stones from same scenario)
        if (isCollisionPath && pathData.collisionId) {
          // Find all paths with the same collision ID
          relatedPaths = svg.selectAll(".path-visualization")
            .filter(function() {
              const pathCollisionId = d3.select(this).attr("data-collision-id");
              return pathCollisionId && pathCollisionId === pathData.collisionId && this !== event.currentTarget;
            }).nodes();
        }
        
        // Hide all other paths except related collision paths
        svg.selectAll(".path-visualization").filter(function() { 
          // Don't hide current path
          if (this === event.currentTarget) return false;
          
          // Don't hide related paths in the same collision scenario
          if (relatedPaths.includes(this)) return false;
          
          // Hide all other paths
          return true;
        }).style("opacity", 0.1);
        
        // Show related paths at slightly higher opacity
        if (relatedPaths.length > 0) {
          d3.selectAll(relatedPaths).style("opacity", 0.7);
        }
        
        // Generate appropriate info text
        let infoText;
        if (pathData.isCollision) {
          infoText = `Collision Path - Vel: ${pathData.velocity} m/s, Broom: ${pathData.broomY.toFixed(2)} m, Spin: ${pathData.spinDirection}`;
        } else if (pathData.isHitStone) {
          infoText = `Stone Movement - ${pathData.spinDirection}`;
        } else {
          infoText = `Vel: ${pathData.velocity} m/s, Broom: ${pathData.broomY.toFixed(2)} m, Spin: ${pathData.spinDirection}`;
        }
        
        // Remove any existing info box
        svg.selectAll(".path-info-box").remove();
        
        // Create info box
        const infoBox = svg.append("g")
          .attr("class", "path-info-box")
          .attr("transform", `translate(${xScale(trajectory[0].x)}, ${yScale(trajectory[0].y) - 20})`);
          
        infoBox.append("rect")
          .attr("x", -5)
          .attr("y", -20)
          .attr("width", infoText.length * 7)
          .attr("height", 20)
          .attr("rx", 5)
          .attr("ry", 5)
          .style("fill", "rgba(0, 0, 0, 0.7)");
          
        infoBox.append("text")
          .attr("x", 0)
          .attr("y", -5)
          .style("fill", "white")
          .style("font-size", "12px")
          .text(infoText);
      })
      .on("mouseout", function() {
        // Restore all paths to normal opacity
        svg.selectAll(".path-visualization").style("opacity", 0.8)
                                           .style("stroke-width", 2.5)
                                           .style("filter", "none");
        
        // Remove info box
        svg.selectAll(".path-info-box").remove();
        
        // Remove any temporary highlighting classes
        svg.selectAll(".path-visualization").classed("highlight-path", false);
      });
    }
      
    return path;
  }
  
  // Draw multiple paths with transparency
  drawMultiplePaths(pathsData) {
    // Clear existing paths first
    this.clearPaths();
    
    // Group for all paths
    const pathsGroup = this.svg.append("g")
      .attr("class", "paths-group");
    
    // Draw each trajectory
    pathsData.forEach(pathData => {
      this.drawPath(pathData.trajectory, pathData.color, true);
    });
    
    return pathsGroup;
  }
  
  // Clear all paths
  clearPaths() {
    this.svg.selectAll(".path").remove();
    this.svg.selectAll(".velocity-legend").remove();
  }
  
  // Draw velocity legend
  drawVelocityLegend(pathDetails) {
    // Remove any existing legends
    this.svg.selectAll(".velocity-legend").remove();
    
    // Create legend container
    const legend = this.svg.append("g")
      .attr("class", "velocity-legend")
      .attr("transform", `translate(${this.M.l + 10}, ${this.M.t + 10})`);
    
    // Add title
    legend.append("text")
      .attr("class", "velocity-legend-title")
      .attr("x", 0)
      .attr("y", 0)
      .text("Shot Parameters");
    
    // Add color boxes and labels for each velocity and spin direction
    pathDetails.forEach((detail, i) => {
      // Draw color box
      legend.append("rect")
        .attr("x", 0)
        .attr("y", 15 + i * 20)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", detail.color);
      
      // Add text label
      const labelText = typeof detail.velocity === 'number' ? 
        `${detail.velocity.toFixed(1)} m/s${detail.spinDirection ? ' - ' + detail.spinDirection : ''}` : 
        `${detail.velocity}${detail.spinDirection ? ' - ' + detail.spinDirection : ''}`;
      
      legend.append("text")
        .attr("x", 20)
        .attr("y", 15 + i * 20 + 12)
        .text(labelText);
    });
    
    // Add a note about broom positions
    legend.append("text")
      .attr("x", 0)
      .attr("y", 15 + pathDetails.length * 20 + 15)
      .attr("font-size", "10px")
      .text("Broom positions shown at specified spacing");
    
    return legend;
  }
  
  // Remove all stones
  clearStones() {
    this.svg.selectAll(".stone-group").remove();
  }
}
