/**
 * Sheet dimensions and constants (in meters)
 */
export default class SheetDimensions {
  constructor() {
    /*** Geometry (meters) ***/
    this.SHEET_W = 4.75;             // sheet width
    this.HALF_W = this.SHEET_W / 2;
    this.HOG_TO_HOG = 21.95;
    this.HOG_TO_TEE = 6.40;
    this.HOUSE_R12 = 1.829;          // 12 ft radius
    this.HOUSE_R8  = 1.219;          // 8 ft
    this.HOUSE_R4  = 0.610;          // 4 ft
    this.BUTTON_R  = 0.15;
    
    // Visible x-range: from near hog (0) to a bit past far house
    this.XMIN = 0;
    this.XMAX = this.HOG_TO_HOG + this.HOG_TO_TEE + this.HOUSE_R12 + 1.3; // ~30 m
    this.TEE_X = this.HOG_TO_HOG + this.HOG_TO_TEE;
    this.FAR_HOG_X = this.HOG_TO_HOG;
    
    // Start location: near hog centerline
    this.START = { x: 0.2, y: 0 };   // 20 cm to right of near hog line
  }
}
