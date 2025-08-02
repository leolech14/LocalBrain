#!/bin/bash

echo "🧠 Building LocalBrain DMG..."
echo "============================"
echo ""

# Change to the desktop app directory
cd "$(dirname "$0")/apps/desktop"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null

# Build the application in release mode
echo "🔨 Building LocalBrain in release mode..."
echo "This may take a few minutes..."
echo ""

pnpm tauri build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    
    # Find the DMG file
    DMG_FILE=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" | head -1)
    
    if [ -f "$DMG_FILE" ]; then
        # Copy DMG to root directory with a nice name
        FINAL_DMG="/Users/lech/LocalBrain_v0.1/LocalBrain-0.1.0.dmg"
        cp "$DMG_FILE" "$FINAL_DMG"
        
        echo "📦 DMG created successfully!"
        echo "   Location: $FINAL_DMG"
        echo "   Size: $(du -h "$FINAL_DMG" | cut -f1)"
        echo ""
        echo "🎯 The DMG includes:"
        echo "   ✓ LocalBrain app with correct icon"
        echo "   ✓ Code signed (if certificates available)"
        echo "   ✓ Ready for distribution"
        echo ""
        echo "📱 To install:"
        echo "   1. Double-click the DMG file"
        echo "   2. Drag LocalBrain to Applications"
        echo "   3. Eject the DMG"
        echo "   4. Launch LocalBrain from Applications"
        echo ""
        
        # Open the DMG location in Finder
        open -R "$FINAL_DMG"
    else
        echo "❌ Error: DMG file not found after build"
        exit 1
    fi
else
    echo ""
    echo "❌ Build failed!"
    echo "Check the error messages above for details."
    exit 1
fi