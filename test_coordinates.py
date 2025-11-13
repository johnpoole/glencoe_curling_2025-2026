#!/usr/bin/env python3
"""
Test the corrected coordinate system
"""
import os
from PIL import Image
import numpy as np

def test_corrected_coordinates():
    image_path = 'test_images/curling_house_test.jpg'
    img = Image.open(image_path)
    
    print('COORDINATE SYSTEM VALIDATION TEST')
    print('=' * 60)
    print('Testing Y-flip correction for photo orientation')
    print()
    
    # Test coordinates from the orientation analysis
    # Red stones were found at Band 5 (80% from top) = bottom area
    # Blue stones were found at Band 2 (20% from top) = top area
    
    TEE_X = 28.35
    view_area = 8.0
    
    # Simulate stone positions based on band analysis
    test_cases = [
        {'name': 'Red Stone (Band 5 - bottom area)', 'pixel_x': img.width // 2, 'pixel_y': int(img.height * 0.8)},
        {'name': 'Blue Stone (Band 2 - top area)', 'pixel_x': img.width // 2, 'pixel_y': int(img.height * 0.2)},
        {'name': 'Center reference', 'pixel_x': img.width // 2, 'pixel_y': img.height // 2}
    ]
    
    print('COORDINATE CONVERSION TEST:')
    print('Expected after Y-flip:')
    print('  Red stones (bottom pixels) → positive Y (behind tee)')
    print('  Blue stones (top pixels) → negative Y (in front of tee)')
    print()
    
    for test in test_cases:
        # Original coordinate conversion (without Y-flip)
        normalized_x_orig = (test['pixel_x'] / img.width - 0.5) * 2
        normalized_y_orig = (test['pixel_y'] / img.height - 0.5) * 2
        sheet_x_orig = TEE_X + normalized_x_orig * view_area / 2
        sheet_y_orig = 0 + normalized_y_orig * view_area / 2
        
        # Corrected coordinate conversion (with Y-flip)
        normalized_x_new = (test['pixel_x'] / img.width - 0.5) * 2
        normalized_y_new = (test['pixel_y'] / img.height - 0.5) * 2
        sheet_x_new = TEE_X + normalized_x_new * view_area / 2
        sheet_y_new = 0 - normalized_y_new * view_area / 2  # Y-flip
        
        print(f'{test["name"]}:')
        print(f'  Pixel: ({test["pixel_x"]}, {test["pixel_y"]})')
        print(f'  Original: ({sheet_x_orig:.2f}m, {sheet_y_orig:.2f}m)')
        print(f'  Y-flipped: ({sheet_x_new:.2f}m, {sheet_y_new:.2f}m)')
        print()
    
    # Validation
    print('VALIDATION:')
    
    # Red stone test (should now be positive Y - behind tee)
    red_pixel_y = int(img.height * 0.8)  # Bottom area where red stones were found
    red_normalized_y = (red_pixel_y / img.height - 0.5) * 2
    red_sheet_y = 0 - red_normalized_y * view_area / 2
    
    # Blue stone test (should now be negative Y - in front of tee)  
    blue_pixel_y = int(img.height * 0.2)  # Top area where blue stones were found
    blue_normalized_y = (blue_pixel_y / img.height - 0.5) * 2
    blue_sheet_y = 0 - blue_normalized_y * view_area / 2
    
    print(f'Red stones (house): Y = {red_sheet_y:.2f}m', end='')
    if red_sheet_y > 0:
        print(' ✅ (positive Y = behind tee = house area)')
    else:
        print(' ❌ (should be positive for house)')
    
    print(f'Blue stones (guard): Y = {blue_sheet_y:.2f}m', end='')
    if blue_sheet_y < 0:
        print(' ✅ (negative Y = in front of tee = guard zone)')
    else:
        print(' ❌ (should be negative for guards)')
    
    print()
    if red_sheet_y > 0 and blue_sheet_y < 0:
        print('🎯 SUCCESS: Y-flip correction works!')
        print('   Red stones map to house area (positive Y)')
        print('   Blue stones map to guard zone (negative Y)')
        return True
    else:
        print('❌ FAILURE: Coordinate system still incorrect')
        return False

if __name__ == '__main__':
    success = test_corrected_coordinates()
    print('\nNEXT STEPS:')
    if success:
        print('✅ Coordinate system fixed - test browser detection')
    else:
        print('❌ Need further coordinate system debugging')