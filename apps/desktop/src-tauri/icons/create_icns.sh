#!/bin/bash

# Create iconset directory
mkdir -p LocalBrain.iconset

# Copy and rename files according to Apple's naming convention
cp icon_16.png LocalBrain.iconset/icon_16x16.png
cp icon_32.png LocalBrain.iconset/icon_16x16@2x.png
cp icon_32.png LocalBrain.iconset/icon_32x32.png
cp icon_64.png LocalBrain.iconset/icon_32x32@2x.png
cp icon_128.png LocalBrain.iconset/icon_128x128.png
cp icon_256.png LocalBrain.iconset/icon_128x128@2x.png
cp icon_256.png LocalBrain.iconset/icon_256x256.png
cp icon_512.png LocalBrain.iconset/icon_256x256@2x.png
cp icon_512.png LocalBrain.iconset/icon_512x512.png
cp icon_1024.png LocalBrain.iconset/icon_512x512@2x.png

# Create ICNS file
iconutil -c icns LocalBrain.iconset -o icon.icns

# Clean up
rm -rf LocalBrain.iconset

echo "Created icon.icns successfully!"