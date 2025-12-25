# Setting Up Multiple Trello Lists for Different Workflows

## Overview

You can now use different Trello lists for different workflows:
- **PR Auto-Scan** → Uses `TRELLO_LIST_ID_PR` (or falls back to `TRELLO_LIST_ID`)
- **WGO/WIIM Agent** → Uses `TRELLO_LIST_ID_WGO` (or falls back to `TRELLO_LIST_ID`)
- **Default/Other** → Uses `TRELLO_LIST_ID`

## Your Current Lists

From your "Editorial AI Project" board:
1. **WGO/WIIM Stories** - `69457f7350ac5fd4b8efcc96`
2. **PR-Related Stories** - `69457f88b14cc47295a95c4d` ✅ (currently set)

## Setup

Add these to your `.env.local` file:

```env
# Default list (fallback if specific ones aren't set)
TRELLO_LIST_ID=69457f88b14cc47295a95c4d

# PR Auto-Scan will use this list
TRELLO_LIST_ID_PR=69457f88b14cc47295a95c4d

# WGO/WIIM Agent will use this list
TRELLO_LIST_ID_WGO=69457f7350ac5fd4b8efcc96
```

## How It Works

### PR Auto-Scan
- Checks for `TRELLO_LIST_ID_PR` first
- Falls back to `TRELLO_LIST_ID` if not set
- Creates cards in the "PR-Related Stories" list

### WGO/WIIM Agent (via `/start` endpoint)
- Checks for `TRELLO_LIST_ID_WGO` first
- Falls back to `TRELLO_LIST_ID` if not set
- Creates cards in the "WGO/WIIM Stories" list

### Fallback Behavior
- If a specific list ID isn't set, it uses `TRELLO_LIST_ID`
- This ensures backward compatibility

## Testing

1. **Test PR Auto-Scan:**
   ```bash
   # Start PR auto-scan
   curl -X POST http://localhost:3001/pr-auto-scan/start \
     -H "Content-Type: application/json" \
     -d "{\"mode\": \"auto\"}"
   ```
   - Cards should appear in "PR-Related Stories" list

2. **Test WGO Agent:**
   ```bash
   # Start agent with a topic
   curl -X POST http://localhost:3001/start \
     -H "Content-Type: application/json" \
     -d "{\"topic\": \"TSLA\"}"
   ```
   - Cards should appear in "WGO/WIIM Stories" list

## Verification

When you start the server, you should see:
```
✅ Found TRELLO_LIST_ID: 69457f88b14cc47295a95c4d
✅ Found TRELLO_LIST_ID_PR: 69457f88b14cc47295a95c4d
✅ Found TRELLO_LIST_ID_WGO: 69457f7350ac5fd4b8efcc96
```

## Quick Setup Command

Run this to get both list IDs:
```bash
npm run get-trello-ids
```

Then add to `.env.local`:
- `TRELLO_LIST_ID_PR` = "PR-Related Stories" list ID
- `TRELLO_LIST_ID_WGO` = "WGO/WIIM Stories" list ID




