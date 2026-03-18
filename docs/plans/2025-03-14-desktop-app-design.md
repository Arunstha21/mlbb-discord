# Desktop App Design - MLBB Tournament Bot

## Overview

Transform the MLBB Tournament Bot from a Node.js/CLI application into an Electron desktop app for easy deployment to office PCs without sharing source code. The app provides a GUI for configuration, embedded web interface, and bot management.

## Motivation

- **Easy deployment**: Standalone executable, no Node.js/Docker setup required
- **No code exposure**: Compiled app hides source code
- **Better UX**: Visual configuration instead of editing .env files
- **Cross-platform**: Support Windows and macOS office PCs

## Architecture

### Hybrid Approach: Desktop App with Embedded Bot

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron Main Process                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Renderer Process (UI)                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │ Config      │  │ Dashboard   │  │ Web View    │      │   │
│  │  │ Screen      │  │ (Logs/Status)│  │ (Embedded)  │      │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │   │
│  └─────────┼──────────────────┼──────────────────┼──────────┘   │
│            │ IPC              │ IPC              │              │
│  ┌─────────┼──────────────────┼──────────────────┼──────────┐   │
│  │         ▼                  ▼                  ▼          │   │
│  │            Main Process (Node.js)                        │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │         Bot Child Process                       │    │   │
│  │  │  (Existing Discord bot code - no changes)       │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Components

1. **GUI Layer (Electron)**
   - Configuration screen for bot settings
   - Dashboard with live logs and status
   - Embedded web interface (BrowserWindow)
   - Bot process management (start/stop)

2. **Background Bot Process**
   - Existing Discord bot code (unchanged)
   - Runs as child process
   - Streams logs to GUI via IPC
   - Express web server on configurable port

## Technology Stack

- **Electron**: Desktop framework, mature ecosystem
- **Node.js**: Reuse existing code
- **Express**: Existing web server
- **TypeScript**: Existing codebase

### Why Electron?

- Reuses existing Node.js/TypeScript code directly
- Easy cross-platform builds (Windows + macOS)
- Mature ecosystem and documentation
- Embedded browser for web interface

## UI Screens

### 1. Configuration Screen (First Launch)

```
┌─────────────────────────────────────────┐
│  MLBB Tournament Bot - Setup            │
├─────────────────────────────────────────┤
│                                         │
│  Discord Configuration                  │
│  ┌─────────────────────────────────┐   │
│  │ Bot Token: [_______________]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Challonge Configuration                │
│  ┌─────────────────────────────────┐   │
│  │ Username: [_______________]     │   │
│  │ API Key:   [_______________]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Bot Settings                           │
│  ┌─────────────────────────────────┐   │
│  │ Command Prefix: [____]          │   │
│  │ TO Role Name:   [____________]  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Save & Start Bot]  [Load Config]     │
└─────────────────────────────────────────┘
```

### 2. Main Dashboard (Bot Running)

```
┌─────────────────────────────────────────────────────────────────┐
│  MLBB Bot                            ● Running  [⚙] [⏹]        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Network Access                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Local:    http://localhost:3000             [📋 Copy]   │   │
│  │ Network: http://192.168.1.105:3000         [📋 Copy]   │   │
│  │                                                            │   │
│  │ Other users on your network can use the Network URL      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Connected Servers (3)                                          │
│  ┌────────────┐  ┌────────────┐                                 │
│  │ 🎮 MLBB    │  │ 🏆 TO HQ   │                                 │
│  │ Community  │  │            │                                 │
│  └────────────┘  └────────────┘                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Live Logs                                 [Auto-scroll] │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ [14:32:01] Bot started successfully                 │ │   │
│  │ │ [14:32:02] Web server listening on :3000            │ │   │
│  │ │ [14:32:02] Network URL: http://192.168.1.105:3000   │ │   │
│  │ │ [14:32:05] Connected to Discord                    │ │   │
│  │ │ [14:33:12] User @player1 verified                  │ │   │
│  │ │ [14:35:00] Round 1 started for tournament          │ │   │
│  │ │ ...                                               │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [🌐 Web Interface]  [📋 Export Logs]  [⚙ Settings]             │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Embedded Web Interface

When user clicks "🌐 Web Interface", it opens inside the app using Electron's BrowserWindow.

## IPC Communication

| Direction | Message | Purpose |
|-----------|---------|---------|
| UI → Main | `start-bot` | Spawn bot process with config |
| UI → Main | `stop-bot` | Kill bot process |
| UI → Main | `get-status` | Get bot running state |
| Main → UI | `bot-log` | Stream log lines to UI |
| Main → UI | `bot-status` | Update running state |
| Main → UI | `bot-error` | Report bot crashes/errors |
| Bot → Main | stdout/stderr | Pipe logs to main process |

## Configuration

### Config File Structure

```json
{
  "version": "1.0.0",
  "discord": {
    "token": "your_discord_bot_token_here"
  },
  "challonge": {
    "username": "your_challonge_username",
    "token": "your_challonge_api_token"
  },
  "bot": {
    "defaultPrefix": "!",
    "defaultToRole": "Organizer",
    "participantRole": "Participant"
  },
  "database": {
    "type": "sqlite",
    "path": "./data/dot.db"
  },
  "web": {
    "port": 3000,
    "autoIncrement": true
  },
  "logging": {
    "webhook": "",
    "level": "info"
  }
}
```

### Config Storage Locations

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%/mlbb-bot/` |
| macOS | `~/Library/Application Support/mlbb-bot/` |
| Linux | `~/.config/mlbb-bot/` |

## Build & Deployment

### Package Structure

```
mlbb-desktop/
├── package.json
├── electron/
│   ├── main.ts           # Electron main process
│   └── preload.ts        # Preload script
├── src/                  # Existing bot code (unchanged)
│   ├── commands/
│   ├── events/
│   └── ...
├── ui/                   # New GUI code
│   ├── index.html
│   ├── renderer.ts
│   └── styles.css
├── assets/
│   ├── icon.ico
│   └── icon.icns
└── dist/                 # Built installers
```

### Build Scripts

```json
{
  "scripts": {
    "electron:dev": "electron electron/main.ts",
    "build": "tsc && tsc -p electron/tsconfig.json",
    "build:win": "npm run build && electron-builder --win",
    "build:mac": "npm run build && electron-builder --mac",
    "build:all": "npm run build && electron-builder --win --mac"
  }
}
```

### electron-builder Configuration

```yaml
appId: com.mlbb.tournament-bot
productName: MLBB Tournament Bot
directories:
  output: dist/installers
files:
  - electron/**/*
  - src/**/*
  - ui/**/*
  - data/**/*
win:
  target: nsis
  icon: assets/icon.ico
mac:
  target: dmg
  icon: assets/icon.icns
```

### Deployment Flow

1. Build on dev machine: `npm run build:win` or `npm run build:mac`
2. Copy resulting `.exe` or `.app` to office PC
3. User opens app → sees config screen
4. User enters credentials → saves config
5. Bot starts automatically

## Error Handling

| Scenario | Handling |
|----------|----------|
| Bot crashes | Detect via child process exit, show error in UI, offer restart |
| Port 3000 in use | Auto-increment to 3001, 3002... and update displayed URL |
| Config invalid | Validate on save, show inline errors, prevent bot start |
| Discord disconnect | Auto-reconnect with exponential backoff, log to UI |
| Database lock | Show "Database busy" error, offer retry option |

## Migration Notes

### Changes to Existing Code

Minimal changes required to existing bot code:
1. Config loading: Support `config.json` in addition to `.env`
2. Optional: File watcher for auto-restart on config change

### Config Loading Update

Update `src/config/index.ts` to support JSON:

```typescript
import { readFileSync } from "fs";
import { join } from "path";

// Try config.json first, fallback to .env
const configPath = join(app.getPath('userData'), 'config.json');
if (existsSync(configPath)) {
  const config = JSON.parse(readFileSync(configPath, 'utf-8'));
  // Use config values
} else {
  // Fallback to dotenv
  dotenv.config();
}
```

## Benefits

| Before | After |
|--------|-------|
| Node.js/Docker setup | Double-click `.exe` |
| Edit `.env` files | Visual config screen |
| Terminal commands | GUI with buttons |
| Source code visible | Compiled, hidden |
| Manual restart | Auto-restart on config save |

## Future Enhancements (Optional)

- Tournament management in GUI (currently uses existing web interface)
- Notification system for bot events
- Multi-bot management (run multiple instances)
- Config export/import for backup
