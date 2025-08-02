#!/bin/bash

# Setup Retool Custom Component Library for LocalBrain

echo "🧠 LocalBrain Retool Custom Component Library Setup"
echo "=================================================="

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js v20 or later is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Create LocalBrain CCL directory
mkdir -p LocalBrain_CCL
cd LocalBrain_CCL

# Clone Retool's template repository
echo ""
echo "📦 Cloning Retool CCL template..."
git clone https://github.com/tryretool/custom-component-library-template.git .

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install

# Install retool-ccl utility globally
echo ""
echo "🔧 Installing retool-ccl utility..."
npm install -g retool-ccl

# Login to Retool (will prompt for API token)
echo ""
echo "🔐 Logging into Retool..."
echo "Please use your API token: retool_01k1hs3x1y7a9vxds3hatcd7xh"
retool-ccl login

# Create the library
echo ""
echo "📚 Creating LocalBrain component library..."
retool-ccl init

echo ""
echo "✅ Setup complete! Next steps:"
echo "1. cd LocalBrain_CCL"
echo "2. Edit src/index.tsx to add LocalBrain components"
echo "3. Run 'retool-ccl dev' to test in development mode"
echo "4. Run 'retool-ccl deploy' to deploy to your Retool organization"