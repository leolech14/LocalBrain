#!/bin/bash

# Deploy LocalBrain components to Retool

echo "🧠 Deploying LocalBrain components to Retool..."
echo "============================================"

# Set the API token
export RETOOL_API_TOKEN="retool_01k1hs3x1y7a9vxds3hatcd7xh"

# Login to Retool
echo "🔐 Logging in to Retool..."
npx retool-ccl login --token "$RETOOL_API_TOKEN" --domain "leonardolech1.retool.com"

# Initialize the library
echo ""
echo "📚 Initializing component library..."
npx retool-ccl init --name "LocalBrain Components" --description "AI-powered command center components"

# Deploy the components
echo ""
echo "🚀 Deploying components..."
npx retool-ccl deploy --yes

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Go to https://leonardolech1.retool.com"
echo "2. Open your app: https://leonardolech1.retool.com/editor/cb112456-6e75-11f0-b62c-731c2657e74d/LocalBrain/page1"
echo "3. In the component panel, look for 'LocalBrain Components'"
echo "4. Drag the components onto your canvas:"
echo "   - LocalBrainChat"
echo "   - LocalBrainTerminal"
echo "   - LocalBrainFileExplorer"