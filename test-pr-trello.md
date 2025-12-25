# Quick Test: PR Auto-Scan with Trello

## Step 1: Start the Server

Make sure your server is running:

```bash
npm run dev
```

**Look for these in the startup logs:**
```
✅ Found TRELLO_API_KEY (length: 32)
✅ Found TRELLO_TOKEN (length: 64)
✅ Found TRELLO_LIST_ID: 69457f88b14cc47295a95c4d
```

## Step 2: Test PR Auto-Scan

### Option A: Using the Web Dashboard

1. Open `index.html` in your browser
2. Click "📰 Start PR Auto-Scan" button
3. Select "Auto" mode (or "Manual" if you prefer)
4. Watch the server logs for Trello card creation

### Option B: Using curl/API

```bash
curl -X POST http://localhost:3001/pr-auto-scan/start \
  -H "Content-Type: application/json" \
  -d "{\"mode\": \"auto\"}"
```

## Step 3: Watch for Trello Cards

**In Server Logs, you should see:**
```
📌 Creating Trello card for PR: [PR Title]... (TICKER)
✅ Created Trello card: [Title] (https://trello.com/c/...)
✅ Trello card created: https://trello.com/c/...
```

**In Trello:**
1. Go to your "Editorial AI Project" board
2. Open the "PR-Related Stories" list
3. You should see new cards appearing!

## What Each Card Contains

- **Title**: PR headline
- **Description**:
  - Executive summary
  - Ticker (if available)
  - Publication date
  - Full pitch/angle
  - Link to original PR

## Troubleshooting

### No cards appearing?
- Check server logs for errors
- Verify TRELLO_LIST_ID is correct
- Make sure the list isn't archived in Trello

### "TRELLO_LIST_ID not set" error?
- Restart the server after adding to .env.local
- Check for typos in the List ID

### Cards going to wrong list?
- Verify the List ID matches "PR-Related Stories"
- Run `npm run get-trello-ids` again to confirm




