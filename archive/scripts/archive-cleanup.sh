#!/bin/bash

echo "🧹 Archiving non-essential files..."
echo "================================="

cd /Users/lech/LocalBrain_v0.1

# Create archive subdirectories
mkdir -p archive/{build-artifacts,test-files,temp-files,old-versions,scripts,docs}

# Move build artifacts
echo "📦 Moving build artifacts..."
mv LocalBrain-*.dmg archive/build-artifacts/ 2>/dev/null
mv apps/desktop/src-tauri/target archive/build-artifacts/ 2>/dev/null
mv apps/desktop/dist archive/build-artifacts/ 2>/dev/null

# Move test and temporary files
echo "🧪 Moving test files..."
mv fix-eslint-*.ts archive/test-files/ 2>/dev/null
mv fix-eslint-*.sh archive/test-files/ 2>/dev/null
mv batch-fix-eslint.sh archive/test-files/ 2>/dev/null
mv apps/desktop/jest.config.js archive/test-files/ 2>/dev/null
mv apps/desktop/.eslintrc.json archive/test-files/ 2>/dev/null

# Move old conversion scripts
echo "📜 Moving old scripts..."
mv convert_logo.py archive/scripts/ 2>/dev/null
mv original_logo.png archive/scripts/ 2>/dev/null
mv create_icns.sh archive/scripts/ 2>/dev/null
mv create_dmg.sh archive/scripts/ 2>/dev/null

# Move analysis and documentation files
echo "📄 Moving documentation..."
mv 4more-analysis.md archive/docs/ 2>/dev/null
mv FIXES_IMPLEMENTED.md archive/docs/ 2>/dev/null
mv *.analysis.md archive/docs/ 2>/dev/null
mv BUILDING.md archive/docs/ 2>/dev/null

# Move temporary scripts
echo "🔧 Moving temporary scripts..."
mv test-voice.sh archive/scripts/ 2>/dev/null
mv build-dmg.sh archive/scripts/ 2>/dev/null
mv setup-keys.sh archive/scripts/ 2>/dev/null
mv archive-cleanup.sh archive/scripts/ 2>/dev/null

# Move node_modules to archive (they can be reinstalled)
echo "📦 Archiving node_modules (can be reinstalled with pnpm install)..."
mv node_modules archive/ 2>/dev/null

# Clean up empty directories
echo "🗑️  Cleaning empty directories..."
find . -type d -empty -delete 2>/dev/null

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📊 Archive contents:"
du -sh archive/* | sort -h
echo ""
echo "💡 To restore any file:"
echo "   mv archive/category/filename ."
echo ""
echo "🚀 Essential files remain in place:"
echo "   - Source code (apps/, packages/)"
echo "   - Configuration files"
echo "   - README and LICENSE"
echo "   - Package files (package.json, pnpm-workspace.yaml)"
echo ""