#!/usr/bin/env python3
"""
Test photo orientation and stone positions
"""
import os
from PIL import Image
import numpy as np

def analyze_orientation():
    image_path = 'test_images/curling_house_test.jpg'
    img = Image.open(image_path)
    pixels = np.array(img.convert('RGB'))
    
    print('PHOTO ORIENTATION ANALYSIS')
    print('=' * 50)
    print(f'Image size: {img.width}x{img.height}')
    print('Expected: stones thrown BOTTOM → TOP')
    print('Expected stones: 2 red (house) + 1 blue (guard)')
    print()
    
    # Divide into 5 horizontal bands
    num_bands = 5
    band_height = img.height // num_bands
    
    band_data = []
    
    for i in range(num_bands):
        start_y = i * band_height
        end_y = min((i + 1) * band_height, img.height)
        
        red_pixels = 0
        blue_pixels = 0
        total_sampled = 0
        
        # Sample pixels in this band
        step = 40
        for y in range(start_y, end_y, step):
            for x in range(0, img.width, step):
                r, g, b = pixels[y, x, 0], pixels[y, x, 1], pixels[y, x, 2]
                total_sampled += 1
                
                # Simple stone color detection
                if r > g + 15 and r > b + 15 and r > 100:
                    red_pixels += 1
                if b > r + 15 and b > g + 10 and b > 85:
                    blue_pixels += 1
        
        band_position = int((start_y / img.height) * 100)
        red_pct = (red_pixels / total_sampled) * 100 if total_sampled > 0 else 0
        blue_pct = (blue_pixels / total_sampled) * 100 if total_sampled > 0 else 0
        
        print(f'Band {i+1} ({band_position:2d}% from top): Red={red_pixels:3d} ({red_pct:4.1f}%), Blue={blue_pixels:3d} ({blue_pct:4.1f}%)')
        
        band_data.append({
            'band': i + 1,
            'red': red_pixels,
            'blue': blue_pixels,
            'red_pct': red_pct,
            'blue_pct': blue_pct,
            'position': band_position
        })
    
    print()
    
    # Find peak concentrations
    max_red = max(band_data, key=lambda x: x['red'])
    max_blue = max(band_data, key=lambda x: x['blue'])
    
    print('PEAK CONCENTRATIONS:')
    print(f'Red peak: Band {max_red["band"]} ({max_red["position"]}% from top) - {max_red["red"]} pixels')
    print(f'Blue peak: Band {max_blue["band"]} ({max_blue["position"]}% from top) - {max_blue["blue"]} pixels')
    print()
    
    print('ORIENTATION ANALYSIS:')
    print('If stones thrown bottom→top, expect:')
    print('  House (red stones): Bands 1-2 (top 0-40%)')
    print('  Guards (blue): Bands 2-3 (20-60% from top)')  
    print('  Throwing area: Bands 4-5 (60-100% from top)')
    print()
    
    print('ACTUAL RESULTS:')
    print(f'  Red stones: Band {max_red["band"]} ({max_red["position"]}% from top)')
    print(f'  Blue stones: Band {max_blue["band"]} ({max_blue["position"]}% from top)')
    print()
    
    # Determine coordinate system needed
    if max_red['band'] <= 2:
        print('✅ STANDARD ORIENTATION: Red stones in top area')
        print('   Coordinate system: (0,0) top-left, house at low Y values')
        y_flip_needed = False
    elif max_red['band'] >= 4:
        print('❌ INVERTED ORIENTATION: Red stones in bottom area')
        print('   Coordinate system: Need Y-flip, house at high Y values')
        y_flip_needed = True
    else:
        print('❓ UNCLEAR ORIENTATION: Red stones in middle')
        print('   May need further investigation')
        y_flip_needed = None
    
    return {
        'bands': band_data,
        'red_peak_band': max_red['band'],
        'blue_peak_band': max_blue['band'],
        'y_flip_needed': y_flip_needed
    }

if __name__ == '__main__':
    result = analyze_orientation()
    
    print('\nRECOMMENDATION:')
    if result['y_flip_needed'] is True:
        print('Update coordinate conversion to flip Y axis:')
        print('  sheet_y = 0 - normalized_y * view_area / 2')
    elif result['y_flip_needed'] is False:
        print('Current coordinate system appears correct')
    else:
        print('Need more detailed analysis')