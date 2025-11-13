#!/usr/bin/env python3
"""
Analyze the detection corrections to improve algorithm accuracy.
"""

import json

# Your correction data
correction_data = {
    "imageInfo": {
        "width": 3072,
        "height": 4080
    },
    "cropInfo": {
        "x": 0,
        "y": 596,
        "width": 3072,
        "height": 3465
    },
    "correctedStones": [
        {
            "team": "red",
            "originalCoords": {"x": 2138, "y": 428},
            "displayCoords": {"x": 557, "y": 267},
            "confidence": 19
        },
        {
            "team": "red", 
            "originalCoords": {"x": 1440, "y": 1298},
            "displayCoords": {"x": 375, "y": 493},
            "confidence": 9
        },
        {
            "team": "blue",
            "originalCoords": {"x": 1414, "y": 3240},
            "displayCoords": {"x": 368, "y": 999},
            "confidence": 24
        }
    ]
}

def analyze_corrections():
    """Analyze the correction data to understand detection errors."""
    
    print("🔍 DETECTION CORRECTION ANALYSIS")
    print("=" * 50)
    
    crop = correction_data["cropInfo"]
    image = correction_data["imageInfo"]
    stones = correction_data["correctedStones"]
    
    print(f"Image size: {image['width']}x{image['height']}")
    print(f"Crop region: {crop['x']},{crop['y']} to {crop['x']+crop['width']},{crop['y']+crop['height']}")
    print(f"Crop size: {crop['width']}x{crop['height']}")
    print()
    
    # Calculate detection errors
    print("DETECTION ERRORS:")
    print("-" * 30)
    
    for i, stone in enumerate(stones, 1):
        orig_x, orig_y = stone["originalCoords"]["x"], stone["originalCoords"]["y"]
        
        # Convert display coords back to original image coords
        # Display coords are scaled down from original
        display_x, display_y = stone["displayCoords"]["x"], stone["displayCoords"]["y"]
        
        # Calculate the display scale used
        display_scale = 800 / image["width"]  # maxDisplayWidth = 800
        
        # Convert display back to original image coords
        actual_orig_x = (display_x / display_scale) + crop["x"]
        actual_orig_y = (display_y / display_scale) + crop["y"]
        
        # Error in pixels
        error_x = orig_x - actual_orig_x
        error_y = orig_y - actual_orig_y
        error_distance = (error_x**2 + error_y**2)**0.5
        
        print(f"{stone['team'].upper()} Stone {i}:")
        print(f"  Detected at: ({orig_x}, {orig_y}) in crop coords")
        print(f"  Should be at: ({actual_orig_x:.0f}, {actual_orig_y:.0f}) in crop coords")
        print(f"  Error: ({error_x:.0f}, {error_y:.0f}) pixels, distance: {error_distance:.0f}px")
        print(f"  Confidence: {stone['confidence']} pixels")
        print()
    
    # Analyze stone positions relative to curling sheet
    print("STONE POSITIONS ON CURLING SHEET:")
    print("-" * 40)
    
    # Crop height represents the curling sheet from throwing area to back wall
    # Bottom of crop (y=3465) should be the throwing area
    # Top of crop (y=0) should be near the back wall
    
    for i, stone in enumerate(stones, 1):
        # Use corrected positions (display coords converted to crop coords)
        display_x, display_y = stone["displayCoords"]["x"], stone["displayCoords"]["y"]
        display_scale = 800 / image["width"]
        
        crop_x = display_x / display_scale
        crop_y = display_y / display_scale
        
        # Convert to sheet position (0 = throwing area, 1 = far end)
        sheet_y = 1.0 - (crop_y / crop["height"])  # Flip since y=0 is top
        sheet_x = (crop_x - crop["width"]/2) / (crop["width"]/2)  # Center at 0
        
        print(f"{stone['team'].upper()} Stone {i}:")
        print(f"  Crop coordinates: ({crop_x:.0f}, {crop_y:.0f})")
        print(f"  Sheet position: ({sheet_x:.3f}, {sheet_y:.3f})")
        
        # Determine location on sheet
        if sheet_y > 0.85:
            location = "Near throwing area (guard zone)"
        elif sheet_y > 0.7:
            location = "Center ice" 
        elif sheet_y > 0.4:
            location = "Approach to house"
        else:
            location = "In the house"
            
        print(f"  Location: {location}")
        print()

def generate_calibration_constants():
    """Generate calibration constants for improved detection."""
    
    print("🎯 CALIBRATION RECOMMENDATIONS:")
    print("=" * 50)
    
    stones = correction_data["correctedStones"]
    
    # Analyze confidence levels
    confidences = [stone["confidence"] for stone in stones]
    min_conf = min(confidences)
    max_conf = max(confidences)
    avg_conf = sum(confidences) / len(confidences)
    
    print(f"Confidence analysis:")
    print(f"  Range: {min_conf} - {max_conf} pixels")
    print(f"  Average: {avg_conf:.1f} pixels")
    print(f"  Recommendation: Lower minimum confidence threshold to {min_conf - 2}")
    print()
    
    # Analyze stone spacing for clustering
    crop = correction_data["cropInfo"]
    display_scale = 800 / correction_data["imageInfo"]["width"]
    
    distances = []
    for i in range(len(stones)):
        for j in range(i+1, len(stones)):
            s1 = stones[i]
            s2 = stones[j]
            
            x1 = s1["displayCoords"]["x"] / display_scale
            y1 = s1["displayCoords"]["y"] / display_scale
            x2 = s2["displayCoords"]["x"] / display_scale
            y2 = s2["displayCoords"]["y"] / display_scale
            
            dist = ((x1-x2)**2 + (y1-y2)**2)**0.5
            distances.append(dist)
    
    min_spacing = min(distances)
    print(f"Stone spacing analysis:")
    print(f"  Minimum distance between stones: {min_spacing:.0f} pixels")
    print(f"  Recommendation: Use clustering radius of {min_spacing//3:.0f}px")
    print()
    
    print("UPDATED DETECTION PARAMETERS:")
    print("-" * 40)
    print(f"// Recommended updates for PhotoStoneDetection.js")
    print(f"const MIN_CONFIDENCE = {min_conf - 2};  // was probably higher")
    print(f"const CLUSTER_RADIUS = {min_spacing//3:.0f};  // was probably 70")
    print(f"const MIN_PIXELS_PER_STONE = {min_conf - 3};  // minimum viable detection")
    print()

if __name__ == "__main__":
    analyze_corrections()
    print()
    generate_calibration_constants()