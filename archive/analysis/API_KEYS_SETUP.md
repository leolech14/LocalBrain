# 🔑 LocalBrain API Keys Setup Guide

## Quick Setup

1. **Run the setup script:**
   ```bash
   ./setup-keys.sh
   ```

2. **Enter your OpenAI API key** when prompted
   - Get your key from: https://platform.openai.com/api-keys
   - The script will securely store it in `.env` and optionally in macOS Keychain

3. **That's it!** The app will automatically use your keys.

## Manual Setup

If you prefer to set up manually:

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env and add your keys:**
   ```bash
   # Replace with your actual OpenAI API key
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   
   # The app uses "o3" model by default as requested
   OPENAI_CHAT_MODEL=o3
   
   # Uses "maple" voice by default as requested
   OPENAI_TTS_VOICE=maple
   ```

3. **Optional: Add database encryption key:**
   ```bash
   # Generate a secure key:
   openssl rand -base64 32
   
   # Add to .env:
   DATABASE_ENCRYPTION_KEY=your-generated-key-here
   ```

## Security Best Practices

### ✅ DO:
- Store API keys in `.env` (git-ignored)
- Use macOS Keychain for extra security
- Rotate keys regularly
- Use environment-specific keys

### ❌ DON'T:
- Commit `.env` to git
- Share keys in code
- Use production keys in development
- Store keys in plain text files

## Using macOS Keychain (Recommended)

For maximum security, store your API key in macOS Keychain:

```bash
# Store key
security add-generic-password -a "LocalBrain" -s "OpenAI API Key" -w "your-api-key"

# Retrieve key (for verification)
security find-generic-password -a "LocalBrain" -s "OpenAI API Key" -w
```

## Environment Variables

All supported environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `OPENAI_BASE_URL` | OpenAI API base URL | https://api.openai.com |
| `OPENAI_CHAT_MODEL` | Chat model to use | o3 |
| `OPENAI_TTS_VOICE` | TTS voice | maple |
| `OLLAMA_BASE_URL` | Ollama server URL | http://localhost:11434 |
| `OLLAMA_MODEL` | Offline model | llama3:8b |
| `DEFAULT_WAKE_WORD` | Voice activation phrase | Hey Brain |
| `DATABASE_ENCRYPTION_KEY` | DB encryption key | Auto-generated |

## Troubleshooting

### "API key not configured" error
- Ensure `.env` file exists in project root
- Check key format: should start with `sk-`
- Restart the app after adding keys

### "Invalid API key" error
- Verify key at: https://platform.openai.com/api-keys
- Check for extra spaces or quotes
- Ensure key has necessary permissions

### Keys not loading
- Check `.env` file location (project root)
- Verify file permissions: `ls -la .env`
- Try absolute path in development

## Development vs Production

### Development
- Use `.env` file for convenience
- Consider using a separate development key
- Enable `DEV_MODE=true` in `.env`

### Production
- Use environment variables from the system
- Consider secret management services
- Enable audit logging and monitoring

## Need Help?

- Check if `.env` is properly formatted (no quotes around values)
- Ensure no trailing spaces in keys
- Run `./setup-keys.sh` for automated setup
- File an issue if problems persist