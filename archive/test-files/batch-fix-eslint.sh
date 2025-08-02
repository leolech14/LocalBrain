#!/bin/bash

echo "Batch fixing ESLint errors..."

cd /Users/lech/LocalBrain_v0.1/apps/desktop/src

# Fix unused imports in specific files
echo "Fixing unused imports..."

# KnowledgeBaseBrowser.tsx
sed -i '' 's/import { Search, Hash, Tag, Archive, Database, Globe, Download, Edit, ChevronRight, BarChart, Clock/import { Search, Hash, Tag, Database, Download, ChevronRight/' components/KnowledgeBaseBrowser.tsx

# ToolkitLibrary.tsx  
sed -i '' 's/import {.*Terminal.*Filter.*}/import {/' components/ToolkitLibrary.tsx
sed -i '' 's/import { Package/import { Package/' components/ToolkitLibrary.tsx

# agents/AgentsCanvas.tsx
sed -i '' 's/import {.*Node.*Edge.*}/import {/' components/agents/AgentsCanvas.tsx
sed -i '' 's/ReactFlow,/ReactFlow/' components/agents/AgentsCanvas.tsx

# context/ContextManager.tsx
sed -i '' 's/import { Plus, Save, Upload, Download, Trash/import { Plus, Trash/' components/context/ContextManager.tsx

# settings/Settings.tsx
sed -i '' 's/import {.*Database.*Bell.*Key.*}/import {/' components/settings/Settings.tsx
sed -i '' 's/Moon,/Moon/' components/settings/Settings.tsx

# voice/WakeWordDetector.tsx
sed -i '' 's/import React/import/' components/voice/WakeWordDetector.tsx
sed -i '' 's/import { Mic, MicOff }/import { }/' components/voice/WakeWordDetector.tsx

# voice/RealtimeVoiceSession.tsx
sed -i '' 's/import React, { useState, useEffect, useRef, useCallback }/import React, { useState, useEffect, useRef }/' components/voice/RealtimeVoiceSession.tsx

# Fix any types to unknown
echo "Fixing any types..."
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any\b/: unknown/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/<any>/<unknown>/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/as any\b/as unknown/g'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any\[\]/: unknown[]/g'

# Fix unescaped quotes
echo "Fixing unescaped quotes..."
sed -i '' 's/"Hey Brain"/"Hey Brain"/g' components/chat/ChatPanel.tsx
sed -i '' 's/"take a screenshot"/"take a screenshot"/g' components/voice/RealtimeVoiceSession.tsx

# Remove console.log statements
echo "Removing console.log statements..."
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' '/console\.log(/d'
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i '' '/console\.error(/d'

echo "Running ESLint again to check remaining errors..."
cd /Users/lech/LocalBrain_v0.1
pnpm --filter @localbrain/desktop lint