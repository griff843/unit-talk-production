# Unit Talk Platform - App Launcher Guide

## 🚀 Quick Start (No More Issues!)

### To Start ALL Apps:

```
Double-click: START-ALL-APPS.bat
```

### To Start Individual Apps:

```
Double-click: START-COMMAND-CENTER.bat
Double-click: START-DASHBOARD.bat
Double-click: START-API.bat
Double-click: START-SMART-FORM.bat
Double-click: START-DISCORD-BOT.bat
```

## 🔧 If You Have Issues

### First Time Setup:

1. Run `FIX-NPM-ISSUES.ps1` (right-click → Run with PowerShell)
2. This fixes all Windows/npm compatibility issues

### Common Issues Fixed:

#### Issue: "npm run dev does nothing"

**Cause**: Shell compatibility between Git Bash and Windows **Fix**: Our
launchers use native Windows commands

#### Issue: "/usr/bin/bash: command not found"

**Cause**: npm trying to use Unix paths on Windows **Fix**: We force npm to use
cmd.exe

#### Issue: "Port already in use"

**Cause**: Previous process didn't shut down cleanly **Fix**: Our launchers
automatically kill old processes

#### Issue: "Can't tell if app is running"

**Cause**: No feedback when dev server starts **Fix**: Our launchers wait for
ports and show status

## 📁 App Locations & Ports

| App            | Port | Path                  |
| -------------- | ---- | --------------------- |
| API            | 3004 | `apps/api`            |
| Command Center | 3015 | `apps/command-center` |
| Dashboard      | 3005 | `apps/dashboard`      |
| Smart Form     | 3006 | `apps/smart-form`     |
| Discord Bot    | N/A  | `apps/discord-bot`    |

## 🛠️ Advanced Usage

### PowerShell Direct Commands:

```powershell
# Start specific app
.\launch-all-apps.ps1 -App command-center

# Start all apps
.\launch-all-apps.ps1 -App all

# Debug mode (keeps window open)
.\launch-all-apps.ps1 -App all -Debug
```

### What the Launcher Does:

1. ✅ Checks if port is in use and kills old process
2. ✅ Verifies node_modules exists (runs npm install if needed)
3. ✅ Starts app in new window with proper title
4. ✅ Waits for app to be ready before proceeding
5. ✅ Shows clear success/error messages
6. ✅ Works reliably on Windows without shell issues

## 🚨 Emergency Commands

### Kill All Node Processes:

```powershell
Get-Process node | Stop-Process -Force
```

### Check What's Using a Port:

```powershell
netstat -ano | findstr :3015
```

### Reset Everything:

```powershell
# Run from platform root
npm run clean
npm install
```

## ✅ Why This Works

1. **No Shell Conflicts**: Uses native Windows commands
2. **Automatic Cleanup**: Kills old processes before starting
3. **Smart Waiting**: Waits for apps to actually be ready
4. **Clear Feedback**: Shows exactly what's happening
5. **Error Recovery**: Handles common issues automatically

## 🎯 Bottom Line

**Just double-click the .bat files and everything works!**

No more:

- Shell compatibility issues
- Port conflicts
- Uncertainty about whether apps are running
- Manual process killing
- Path problems

Everything just works! 🎉
