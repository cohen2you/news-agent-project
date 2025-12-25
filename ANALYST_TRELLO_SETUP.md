# Analyst Notes Trello Setup

## Step 1: Get Your Trello List ID

You already created the "Analyst Notes" list on your Trello board. Now we need to get its List ID.

### Option A: Using the Existing Script (Easiest)

Run the existing Trello ID fetcher script:

```bash
npm run get-trello-ids
```

This will:
1. Connect to your Trello account (using `TRELLO_API_KEY` and `TRELLO_TOKEN` from `.env.local`)
2. Show all boards and lists
3. Display the List ID for your "Analyst Notes" list

**Output Example:**
```
✅ Found 5 list(s):

1. Analyst Notes
   List ID: 69457f88b14cc47295a95c4e

2. PR-Related Stories
   List ID: 69457f88b14cc47295a95c4d
...
```

### Option B: Manual Method

1. Open your Trello board
2. Click on the "Analyst Notes" list
3. Look at the URL: `https://trello.com/b/[BOARD_ID]/board-name#/[LIST_ID]`
4. The `LIST_ID` is the part after the `#/`

---

## Step 2: Add to .env.local

Add this line to your `.env.local` file:

```env
# Trello Configuration (existing - already set)
TRELLO_API_KEY=your-existing-api-key
TRELLO_TOKEN=your-existing-token
TRELLO_BOARD_ID=your-existing-board-id

# Existing Lists (you already have these)
TRELLO_LIST_ID=69457f88b14cc47295a95c4d
TRELLO_LIST_ID_PR=69457f88b14cc47295a95c4d
TRELLO_LIST_ID_WGO=69457f88b14cc47295a95c4e
TRELLO_LIST_ID_SUBMITTED=69457f88b14cc47295a95c4f
TRELLO_LIST_ID_IN_PROGRESS=69457f88b14cc47295a95c4g

# NEW: Analyst Notes List
TRELLO_LIST_ID_ANALYST_NOTES=69457f88b14cc47295a95c4e
```

**Replace** `69457f88b14cc47295a95c4e` with your actual "Analyst Notes" List ID.

---

## Step 3: Verify Setup

The Email Monitor Agent will use:
- `TRELLO_LIST_ID_ANALYST_NOTES` - Where analyst notes are created
- `TRELLO_LIST_ID_IN_PROGRESS` - Where cards move when story generation starts
- `TRELLO_LIST_ID_SUBMITTED` - Where cards move when story is complete

The Story Generator Agent will:
- Read cards from `TRELLO_LIST_ID_ANALYST_NOTES`
- Move cards to `TRELLO_LIST_ID_IN_PROGRESS` when generating
- Move cards to `TRELLO_LIST_ID_SUBMITTED` when done

---

## Step 4: Test Connection

After adding the List ID, restart your server and check the logs:

```bash
npm run dev
```

You should see:
```
✅ Found TRELLO_LIST_ID_ANALYST_NOTES: 69457f88b14cc47295a95c4e
```

---

## Trello Card Structure

When the Email Monitor Agent creates a card, it will include:

**Card Title:** 
- Format: `[TICKER]... Analyst Note: [Title/Subject]`

**Card Description:**
- **Firm:** [Analyst Firm Name]
- **Analyst:** [Analyst Name]
- **Ticker:** [Stock Ticker]
- **Date:** [Note Date]
- **Source:** [Email Subject/Sender]
- **Original Email:** [Full email content]
- **[Generate Story]** button link

**Metadata (Hidden):**
- Full email data stored as base64-encoded JSON (for later retrieval)

---

## Troubleshooting

### List ID Not Found
- Double-check the List ID in Trello URL
- Make sure the list is on the same board as your `TRELLO_BOARD_ID`
- Run `npm run get-trello-ids` to verify

### Cards Not Appearing
- Check that `TRELLO_API_KEY` and `TRELLO_TOKEN` are correct
- Verify the List ID is correct
- Check server logs for error messages

### Permission Errors
- Make sure your Trello token has read/write access to the board
- Check that the board is not in "Team" mode with restricted access




