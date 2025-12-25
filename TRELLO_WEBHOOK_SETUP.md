# Trello Webhook Setup for Instant "Process For AI" Button Addition

## Overview

By default, the system checks for cards that need "Process For AI" buttons every 30 seconds. However, you can set up a Trello webhook to trigger this **instantly** when you save a URL in a card's description field.

## How It Works

When you save a URL in a Trello card description, Trello sends a webhook notification to your server, which immediately checks if the card needs a "Process For AI" button and adds it automatically.

## Quick Setup (Easiest Method)

### Step 1: Install and Start ngrok

```bash
# Download from https://ngrok.com/download
# Or install via package manager:
choco install ngrok  # Windows
brew install ngrok   # Mac

# Start ngrok tunnel to your server
ngrok http 3001
```

**Important:** Keep ngrok running in a separate terminal window. You'll see a URL like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3001
```

Copy the **HTTPS URL** (the one starting with `https://`).

### Step 2: Run the Setup Script

```powershell
# Make sure your server is running on port 3001
# Then run the setup script with your ngrok URL:
.\setup-trello-webhook.ps1 -NgrokUrl "https://your-ngrok-url.ngrok.io"
```

The script will:
- ✅ Check for existing webhooks
- ✅ Create a new webhook pointing to your ngrok URL
- ✅ Verify the setup

**That's it!** Now when you save a URL in a Trello card description, the "Process For AI" button will appear instantly.

## Manual Setup (Alternative)

### Option 1: Using ngrok (Recommended for Local Development)

**Step 1: Install ngrok**
- Download from https://ngrok.com/download
- Or install via package manager: `choco install ngrok` (Windows) or `brew install ngrok` (Mac)

**Step 2: Start ngrok tunnel**
```bash
ngrok http 3001
```

This will give you a public URL like: `https://abc123.ngrok.io`

**Step 3: Configure Trello Webhook**

1. Go to https://trello.com/app-key
2. Copy your API Key
3. Create a webhook using this URL format:
   ```
   https://api.trello.com/1/tokens/YOUR_TOKEN/webhooks/?key=YOUR_API_KEY
   ```

4. Use this PowerShell command (replace values):
```powershell
$apiKey = "YOUR_TRELLO_API_KEY"
$token = "YOUR_TRELLO_TOKEN"
$ngrokUrl = "https://abc123.ngrok.io"  # Your ngrok URL
$boardId = "YOUR_TRELLO_BOARD_ID"

$webhookUrl = "https://api.trello.com/1/tokens/$token/webhooks/?key=$apiKey"
$body = @{
    description = "News Agent Project - Card Updates"
    callbackURL = "$ngrokUrl/trello/webhook"
    idModel = $boardId
} | ConvertTo-Json

Invoke-RestMethod -Uri $webhookUrl -Method POST -Body $body -ContentType "application/json"
```

**Step 4: Verify Webhook**
- Check webhooks: `https://api.trello.com/1/tokens/YOUR_TOKEN/webhooks/?key=YOUR_API_KEY`
- You should see your webhook listed

**Step 5: Test**
1. Add a URL to a card description in Trello
2. Click Save
3. The "Process For AI" button should appear **instantly** (no 30-second wait)

### Option 2: Keep Using Polling (No Setup Required)

The current 30-second polling works without any setup. It will:
- Check every 30 seconds for cards with URLs but no buttons
- Add buttons automatically
- Work on localhost without any external services

**Trade-off:** Up to 30-second delay vs. instant updates

## Webhook vs. Polling Comparison

| Feature | Webhook (ngrok) | Polling (Current) |
|---------|----------------|-------------------|
| **Speed** | Instant | Up to 30 seconds |
| **Setup** | Requires ngrok + webhook config | None |
| **Reliability** | Depends on ngrok staying up | Always works |
| **Cost** | Free tier available | Free |
| **Localhost** | Works with ngrok | Works directly |

## Troubleshooting

**Webhook not working?**
1. Check ngrok is running: `ngrok http 3001`
2. Verify webhook is created: Check Trello webhook list
3. Check server logs for webhook requests
4. Ensure your server is accessible via the ngrok URL

**Polling not working?**
1. Check server logs for: `🔄 Starting automatic "Process For AI" button checker`
2. Verify cards are in PR-Related Stories or WGO/WIIM Stories lists
3. Check that cards have URLs in description

## Recommendation

- **For development/testing:** Use polling (current setup) - it's simpler
- **For production:** Set up webhook with ngrok or a production server for instant updates

