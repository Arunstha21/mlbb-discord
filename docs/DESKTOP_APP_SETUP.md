# Desktop App Setup Guide

## Installation

### Windows
1. Download `MLBB Tournament Bot Setup.exe`
2. Run the installer
3. Choose installation directory (default: `%LOCALAPPDATA%\Programs\mlbb-tournament-bot`)
4. Click "Finish" to launch the app

### macOS
1. Download `MLBB Tournament Bot-X.X.X.dmg`
2. Open the disk image
3. Drag "MLBB Tournament Bot" to Applications
4. Launch from Applications folder

## First Time Setup

1. **Discord Bot Token**
   - Go to https://discord.com/developers/applications
   - Create an application or select existing
   - Go to "Bot" section and click "Reset Token" (or copy existing)
   - Enable necessary intents (Server Members, Message Content)
   - Copy the token

2. **Challonge Credentials**
   - Go to https://challonge.com/settings/developer
   - Copy your API key
   - Your username is your Challonge username

3. **Bot Settings**
   - Command Prefix: Character(s) to prefix commands (default: `!`)
   - TO Role Name: Discord role name for Tournament Organizers (default: `Organizer`)

## Network Access

The web interface is accessible from other devices on your network:

- **Local URL**: http://localhost:3000 (only on this machine)
- **Network URL**: http://192.168.x.x:3000 (accessible from other devices)

Click the 📋 button to copy the URL to clipboard.

## Features

- **Configuration GUI**: Easy setup without editing .env files
- **Live Logs**: View bot activity in real-time
- **Network Detection**: Automatic network IP detection for shared access
- **Port Auto-Increment**: Automatically finds available port if 3000 is busy
- **Embedded Web Interface**: Opens web UI within the app
- **Config Persistence**: Settings saved across app restarts
- **Export Logs**: Download logs as text file for debugging

## Troubleshooting

### Bot won't start
- Verify Discord token is correct
- Check that port 3000 is not in use (app will try 3001, 3002, etc.)
- Check the logs in the dashboard for error messages

### Can't access web interface from other devices
- Ensure both devices are on the same network
- Check firewall settings on the machine running the bot
- Verify the network URL is correct

### Bot keeps disconnecting
- Check your internet connection
- Verify Discord token hasn't been reset
- Check Discord status at https://discordstatus.com

### Config errors on startup
- The app will show validation errors with specific field information
- Common issues:
  - Discord token too short (should be 50+ characters)
  - Challonge API key too short (should be 20+ characters)
  - Command prefix too long (max 10 characters)
