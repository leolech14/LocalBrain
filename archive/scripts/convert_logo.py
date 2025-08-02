#!/usr/bin/env python3
import os
from PIL import Image

# Open the original logo
original = Image.open('/Users/lech/LocalBrain_v0.1/original_logo.png')

# Convert to RGBA if needed
if original.mode != 'RGBA':
    original = original.convert('RGBA')

# Create different sizes for icons
sizes = {
    '32x32.png': 32,
    '128x128.png': 128,
    '128x128@2x.png': 256,
    'icon.png': 512,
    'icon_1024.png': 1024
}

output_dir = '/Users/lech/LocalBrain_v0.1/apps/desktop/src-tauri/icons/'

for filename, size in sizes.items():
    # Resize the image maintaining aspect ratio
    resized = original.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(os.path.join(output_dir, filename), 'PNG')
    print(f"Created {filename}")

# Create ICO file for Windows (multiple sizes)
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
ico_images = []
for size in ico_sizes:
    ico_img = original.resize(size, Image.Resampling.LANCZOS)
    ico_images.append(ico_img)

ico_images[0].save(
    os.path.join(output_dir, 'icon.ico'),
    format='ICO',
    sizes=ico_sizes,
    append_images=ico_images[1:]
)
print("Created icon.ico")

print("\nAll icon files created successfully!")