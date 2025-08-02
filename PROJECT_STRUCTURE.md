# LocalBrain Project Structure

## 🎯 Clean Project Layout

After archiving non-essential files, the project now has a clean, focused structure:

```
LocalBrain_v0.1/
├── .claude/                    # Claude AI configuration
├── .git/                       # Git repository
├── .github/                    # GitHub workflows
├── .husky/                     # Git hooks
├── apps/                       # Application source code
│   └── desktop/               # Tauri desktop app
│       ├── src/              # React frontend
│       └── src-tauri/        # Rust backend
├── packages/                   # Shared packages
│   ├── core/                 # Core functionality
│   ├── types/                # TypeScript types
│   └── ui/                   # UI components
├── scripts/                    # Essential scripts
├── archive/                    # Non-essential files (can be deleted)
│   ├── build-artifacts/      # Build outputs
│   ├── docs/                 # Old documentation
│   ├── analysis/             # Analysis files
│   ├── retool/               # Retool integration
│   ├── scripts/              # Old scripts
│   ├── setup-files/          # Setup helpers
│   └── test-files/           # Test configurations
├── .env                        # Environment variables (git-ignored)
├── .env.example               # Example environment file
├── .gitignore                 # Git ignore rules
├── CLAUDE.md                  # Claude AI instructions
├── LOGO.png                   # LocalBrain logo
├── package.json               # Root package file
├── pnpm-lock.yaml            # Lock file
├── pnpm-workspace.yaml       # Workspace configuration
├── README.md                  # Project documentation
└── tsconfig.json             # TypeScript configuration
```

## 📦 Essential Files Only

The root directory now contains only:
- **Configuration files** (.env, .gitignore, tsconfig.json)
- **Package management** (package.json, pnpm files)
- **Documentation** (README.md, CLAUDE.md)
- **Source code** (apps/, packages/)
- **Essential scripts** (scripts/)

## 🗄️ Archived Content

All non-essential files have been moved to `archive/`:
- Build outputs (10GB+ of compiled code)
- Node modules (359MB - can reinstall with `pnpm install`)
- Test configurations
- Analysis documents
- Retool integration files
- Setup scripts
- Old documentation

## 🚀 Quick Start

With this clean structure:

```bash
# Install dependencies
pnpm install

# Run development mode
pnpm --filter=desktop tauri:dev

# Build production app
pnpm --filter=desktop tauri:build
```

## 💡 Archive Management

- **To permanently clean**: `rm -rf archive/`
- **To restore a file**: `mv archive/category/filename .`
- **Archive size**: ~10.5GB (mostly build artifacts)

The project is now clean, organized, and ready for development!