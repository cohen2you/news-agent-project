# Testing Trello Integration

This guide will walk you through testing the Trello integration step by step.

## Prerequisites Check

Before testing, make sure you have:

1. ✅ Trello API Key and Token in `.env.local`
2. ✅ Trello List ID in `.env.local`
3. ✅ Server dependencies installed

## Step 1: Get Your Trello IDs

First, let's get your Board and List IDs:

```bash
npm run get-trello-ids
```

**Expected Output:**
```
✅ Loaded environment variables from .env.local
🔍 Fetching Trello Boards and Lists...

📋 Fetching your boards...

✅ Found 1 board(s):

1. My Content Board
   Board ID: 1234567890abcdef
   URL: https://trello.com/b/...

📋 Fetching lists for "My Content Board"...

✅ Found 3 list(s):

1. Content Ideas
   List ID: abcdef1234567890

📝 Add these to your .env.local file:

TRELLO_BOARD_ID=1234567890abcdef
TRELLO_LIST_ID=abcdef1234567890
```

**Action:** Copy the List ID and add it to your `.env.local` file if you haven't already.

## Step 2: Start the Server

Open a terminal and start the development server:

```bash
npm run dev
```

You should see:
```
✅ Loaded environment variables from .env.local
✅ Found TRELLO_API_KEY (length: 32)
✅ Found TRELLO_TOKEN (length: 64)
Server running on http://localhost:3001
```

## Step 3: Test Method 1 - Agent Workflow (Recommended)

### Option A: Using the API Endpoint

Open another terminal (or use Postman/curl) and test the agent:

```bash
# Test with a simple topic
curl -X POST http://localhost:3001/start \
  -H "Content-Type: application/json" \
  -d '{"topic": "TSLA", "prOnly": false}'
```

**Expected Response:**
```json
{
  "status": "completed",
  "threadId": "run_...",
  "finalArticle": "✅ Story pitched to Trello!\n\nCard: [Headline]\nURL: https://trello.com/c/..."
}
```

**What to Check:**
1. ✅ Response shows "Story pitched to Trello!"
2. ✅ Card URL is provided
3. ✅ Go to Trello and verify the card appears in your list

### Option B: Using the Web Dashboard

1. Open `index.html` in your browser (or serve it with a local server)
2. Enter a topic (e.g., "NVDA" or "AI stocks")
3. Click "Start Agent"
4. The agent will create a Trello card
5. Check your Trello board for the new card

## Step 4: Test Method 2 - PR Auto-Scan

This tests the PR auto-scan feature that creates Trello cards for press releases.

### Start PR Auto-Scan

```bash
# Using curl
curl -X POST http://localhost:3001/pr-auto-scan/start \
  -H "Content-Type: application/json" \
  -d '{"mode": "auto"}'
```

**Or use the web dashboard:**
1. Open `index.html`
2. Click "📰 Start PR Auto-Scan"
3. Wait a few seconds
4. Check your Trello board

**Expected Behavior:**
- Server logs show: `📌 Creating Trello card for PR: [Title]...`
- Cards appear in your Trello list
- Each card has:
  - PR headline as title
  - Summary in description
  - Source URL link
  - Ticker and date info

## Step 5: Verify Cards in Trello

1. **Open your Trello board**
2. **Check your "Content Ideas" list** (or whatever list you configured)
3. **Verify each card contains:**
   - ✅ Headline as the card title
   - ✅ Summary text
   - ✅ Ticker (if available)
   - ✅ Publication date
   - ✅ Link to original source
   - ✅ Full pitch/angle

## Step 6: Check Server Logs

Watch the terminal where `npm run dev` is running. You should see:

```
📌 TRELLO: Creating pitch card...
✅ Created Trello card: [Headline] (https://trello.com/c/...)
✅ Trello card created: https://trello.com/c/...
```

## Troubleshooting

### Error: "TRELLO_API_KEY and TRELLO_TOKEN must be set"

**Fix:**
1. Check your `.env.local` file has both variables
2. Make sure there are no extra spaces or quotes
3. Restart the server after adding them

### Error: "TRELLO_LIST_ID not set"

**Fix:**
1. Run `npm run get-trello-ids`
2. Copy the List ID
3. Add `TRELLO_LIST_ID=your_list_id` to `.env.local`
4. Restart the server

### Cards Not Appearing in Trello

**Check:**
1. Verify the List ID is correct (run `npm run get-trello-ids` again)
2. Check server logs for error messages
3. Verify your API key and token are valid
4. Make sure the list exists and is not archived

### "Trello API error: 401 Unauthorized"

**Fix:**
- Your API key or token is incorrect
- Regenerate them at https://trello.com/app-key
- Update `.env.local` and restart server

### "Trello API error: 400 Bad Request"

**Fix:**
- The List ID might be incorrect
- Run `npm run get-trello-ids` to get the correct ID
- Make sure the list is not archived

## Quick Test Script

Here's a quick test you can run to verify everything works:

```bash
# 1. Check Trello credentials
npm run get-trello-ids

# 2. Start server (in one terminal)
npm run dev

# 3. Test agent (in another terminal)
curl -X POST http://localhost:3001/start \
  -H "Content-Type: application/json" \
  -d '{"topic": "AAPL"}'

# 4. Check Trello board - you should see a new card!
```

## Success Criteria

✅ **Test is successful if:**
1. Server starts without errors
2. Agent creates a Trello card
3. Card appears in your Trello list
4. Card contains headline, summary, and source URL
5. No errors in server logs

## Next Steps After Testing

Once testing is successful:
1. ✅ Your workflow is ready to use
2. ✅ Cards will be created automatically
3. ✅ Review cards in Trello
4. ✅ Manually trigger article generation when ready (using existing endpoints)




