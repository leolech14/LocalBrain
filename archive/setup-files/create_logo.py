#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont
import math

def create_localbrain_logo(size):
    """Create a LocalBrain logo with a stylized brain icon"""
    # Create a new image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Define colors
    bg_color = (20, 20, 30, 255)  # Dark background
    brain_color = (0, 200, 255, 255)  # Cyan/blue for brain
    accent_color = (100, 220, 255, 255)  # Lighter cyan for highlights
    
    # Draw background circle
    padding = size // 10
    draw.ellipse([padding, padding, size-padding, size-padding], fill=bg_color)
    
    # Draw stylized brain shape
    center_x = size // 2
    center_y = size // 2
    brain_size = size // 3
    
    # Left hemisphere
    left_center_x = center_x - brain_size // 4
    draw.ellipse([
        left_center_x - brain_size//2, 
        center_y - brain_size//2,
        left_center_x + brain_size//2,
        center_y + brain_size//2
    ], fill=brain_color)
    
    # Right hemisphere
    right_center_x = center_x + brain_size // 4
    draw.ellipse([
        right_center_x - brain_size//2,
        center_y - brain_size//2,
        right_center_x + brain_size//2,
        center_y + brain_size//2
    ], fill=brain_color)
    
    # Draw brain folds/convolutions
    for i in range(3):
        y_offset = (i - 1) * brain_size // 3
        draw.arc([
            center_x - brain_size//2,
            center_y - brain_size//3 + y_offset,
            center_x + brain_size//2,
            center_y + brain_size//3 + y_offset
        ], start=30, end=150, fill=accent_color, width=2)
    
    # Add neural network dots
    dot_positions = [
        (-brain_size//3, -brain_size//4),
        (brain_size//3, -brain_size//4),
        (-brain_size//2, 0),
        (brain_size//2, 0),
        (-brain_size//3, brain_size//4),
        (brain_size//3, brain_size//4),
    ]
    
    for dx, dy in dot_positions:
        dot_x = center_x + dx
        dot_y = center_y + dy
        draw.ellipse([
            dot_x - 3, dot_y - 3,
            dot_x + 3, dot_y + 3
        ], fill=accent_color)
    
    # Draw connections between dots
    for i in range(len(dot_positions)):
        for j in range(i+1, len(dot_positions)):
            if abs(i-j) in [1, 2]:  # Connect nearby dots
                x1 = center_x + dot_positions[i][0]
                y1 = center_y + dot_positions[i][1]
                x2 = center_x + dot_positions[j][0]
                y2 = center_y + dot_positions[j][1]
                draw.line([(x1, y1), (x2, y2)], fill=accent_color, width=1)
    
    # Add a subtle glow effect
    glow_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_img)
    for i in range(5, 0, -1):
        alpha = int(20 * (6-i))
        glow_draw.ellipse([
            center_x - brain_size//2 - i*2,
            center_y - brain_size//2 - i*2,
            center_x + brain_size//2 + i*2,
            center_y + brain_size//2 + i*2
        ], fill=(0, 200, 255, alpha))
    
    # Composite the glow behind the main image
    final_img = Image.alpha_composite(glow_img, img)
    
    return final_img

# Create icons in different sizes
sizes = {
    '32x32.png': 32,
    '128x128.png': 128,
    '128x128@2x.png': 256,
    'icon.png': 512
}

output_dir = '/Users/lech/LocalBrain_v0.1/apps/desktop/src-tauri/icons/'

for filename, size in sizes.items():
    logo = create_localbrain_logo(size)
    logo.save(os.path.join(output_dir, filename), 'PNG')
    print(f"Created {filename}")

# Also create an ICNS file for macOS
# We'll use the 512px version and let the system handle scaling
large_logo = create_localbrain_logo(1024)
large_logo.save(os.path.join(output_dir, 'icon_1024.png'), 'PNG')

# Create ICO file for Windows (multiple sizes)
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_images = []
for size in ico_sizes:
    ico_img = create_localbrain_logo(size[0])
    ico_images.append(ico_img)

ico_images[0].save(
    os.path.join(output_dir, 'icon.ico'),
    format='ICO',
    sizes=ico_sizes,
    append_images=ico_images[1:]
)
print("Created icon.ico")

print("\nLogo files created successfully!")
print("Note: You'll need to convert icon_1024.png to icon.icns using:")
print("  sips -s format icns icon_1024.png --out icon.icns")