#!/bin/bash

# LocalBrain API Key Setup Script
echo "🧠 LocalBrain API Key Configuration"
echo "==================================="
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists. Do you want to update it? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Copy .env.example if .env doesn't exist
if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
fi

echo "Please enter your API keys (press Enter to skip):"
echo ""

# OpenAI API Key
echo -n "OpenAI API Key: "
read -r openai_key
if [ -n "$openai_key" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$openai_key|" .env
    else
        # Linux
        sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=$openai_key|" .env
    fi
    echo "✅ OpenAI API key configured"
fi

# Database Encryption Key
echo ""
echo -n "Database Encryption Key (or press Enter to generate one): "
read -r db_key
if [ -z "$db_key" ]; then
    # Generate a secure random key
    db_key=$(openssl rand -base64 32)
    echo "🔐 Generated encryption key: $db_key"
fi
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|DATABASE_ENCRYPTION_KEY=.*|DATABASE_ENCRYPTION_KEY=$db_key|" .env
else
    sed -i "s|DATABASE_ENCRYPTION_KEY=.*|DATABASE_ENCRYPTION_KEY=$db_key|" .env
fi

# Optional: Store in macOS Keychain
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo "Do you want to store the OpenAI API key in macOS Keychain for extra security? (y/n)"
    read -r keychain_response
    if [ "$keychain_response" = "y" ] && [ -n "$openai_key" ]; then
        security add-generic-password -a "LocalBrain" -s "OpenAI API Key" -w "$openai_key" 2>/dev/null || \
        security delete-generic-password -a "LocalBrain" -s "OpenAI API Key" 2>/dev/null && \
        security add-generic-password -a "LocalBrain" -s "OpenAI API Key" -w "$openai_key"
        echo "✅ API key stored in macOS Keychain"
    fi
fi

echo ""
echo "🎉 Configuration complete!"
echo ""
echo "Your .env file has been updated with your API keys."
echo "The application will use these keys automatically when you run it."
echo ""
echo "To start LocalBrain, run:"
echo "  pnpm --filter=desktop dev"
echo ""