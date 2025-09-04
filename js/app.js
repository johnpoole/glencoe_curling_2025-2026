/**
 * Main application file for the curling simulation
 */
import SheetDimensions from './models/SheetDimensions.js';
import SheetRenderer from './models/SheetRenderer.js';
import UIManager from './models/UIManager.js';
import GameController from './models/GameController.js';
import { detectCollisions } from './models/Physics.js';

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create sheet dimensions
  const sheetDimensions = new SheetDimensions();
  
  // Set up the SVG renderer
  const svg = d3.select("#rink");
  const renderer = new SheetRenderer(svg, sheetDimensions);
  
  // Initialize UI manager
  const uiManager = new UIManager();
  
  // Create the game controller
  const gameController = new GameController(renderer, uiManager.getUIGetters());
});
