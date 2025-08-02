#!/bin/bash

# Create a temporary directory for DMG contents
mkdir -p /tmp/LocalBrain_DMG
cp -R /Users/lech/Desktop/LocalBrain.app /tmp/LocalBrain_DMG/

# Create a symbolic link to Applications
cd /tmp/LocalBrain_DMG
ln -s /Applications Applications

# Create the DMG
hdiutil create -volname "LocalBrain" -srcfolder /tmp/LocalBrain_DMG -ov -format UDZO /Users/lech/Desktop/LocalBrain_0.1.0_with_logo.dmg

# Clean up
rm -rf /tmp/LocalBrain_DMG

echo "DMG created successfully at /Users/lech/Desktop/LocalBrain_0.1.0_with_logo.dmg"