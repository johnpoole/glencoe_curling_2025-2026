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
    
    const stoneElement = svg.append("circle")
      .attr("class", "stone")
      .attr("id", `stone-${stone.id}`)
      .attr("r", 7)
      .attr("cx", xScale(stone.x))
      .attr("cy", yScale(stone.y))
      .style("fill", stone.team === 'red' ? "#e74c3c" : "#f1c40f") // Red or yellow team colors
      .style("stroke", "#111")
      .style("stroke-width", 1.5)
      .style("cursor", "pointer")
      .style("stroke-dasharray", isSelected ? "2,2" : "none");
      
    return stoneElement;
  }
  
  // Draw a path from trajectory points
  drawPath(trajectory, color) {
    const svg = this.svg;
    const xScale = this.xScale;
    const yScale = this.yScale;
    
    const line = d3.line()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y));
    
    return svg.append("path")
      .attr("class", "path")
      .attr("d", line(trajectory))
      .style("stroke", color)
      .style("stroke-width", 2);
  }
  
  // Clear all paths
  clearPaths() {
    this.svg.selectAll(".path").remove();
  }
  
  // Remove all stones
  clearStones() {
    this.svg.selectAll(".stone").remove();
  }
}
