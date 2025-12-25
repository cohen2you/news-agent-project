# Trello Integration Setup

This guide will help you set up the Trello integration for the Human-in-the-Loop approval workflow.

## Overview

The agent now creates Trello cards instead of immediately generating articles. This allows you to review and approve stories before they are written.

## Prerequisites

1. **Trello Account**: You need a Trello account
2. **Trello API Key and Token**: You need to generate these from Trello

## Step 1: Get Trello API Credentials

1. Go to https://trello.com/app-key
2. Copy your **API Key** (it will be displayed on the page)
3. Scroll down and click "Token" to generate an API token
4. Copy the generated **Token**

## Step 2: Add Credentials to .env.local

Add these to your `.env.local` file:

```env
TRELLO_API_KEY=your_api_key_here
TRELLO_TOKEN=your_token_here
```

## Step 3: Get Your Board and List IDs

Run the helper script to find your Board ID and List ID:

```bash
npm run get-trello-ids
```

This script will:
- List all your Trello boards
- Show the Board ID for each board
- If you have only one board, it will automatically show all lists
- Display the List ID for each list
- Suggest which list to use (looks for "Content Ideas" or similar)

## Step 4: Add Board and List IDs to .env.local

Add these to your `.env.local` file:

```env
TRELLO_BOARD_ID=your_board_id_here
TRELLO_LIST_ID=your_list_id_here
```

**Note**: The `TRELLO_BOARD_ID` is optional - it's mainly used for reference. The `TRELLO_LIST_ID` is required for creating cards.

## Step 5: Create a "Content Ideas" List (Optional)

If you don't have a list yet, create one in Trello:
1. Open your Trello board
2. Click "Add a list"
3. Name it "Content Ideas" (or any name you prefer)
4. Run `npm run get-trello-ids` again to get the List ID

## How It Works

### Agent Workflow

When you run the agent:
1. **Analyst Node**: Scans Benzinga newsfeed for stories
2. **Trello Pitch Node**: Creates a Trello card with:
   - **Title**: News headline
   - **Description**: Summary + source URL + ticker + date
   - **Source Link**: Link to original article/PR

The agent workflow now ends after creating the Trello card. You can review cards in Trello and manually trigger article generation when ready.

### PR Auto-Scan Workflow

When PR auto-scan is running:
1. Fetches latest PRs from Benzinga
2. For each PR, creates a Trello card instead of generating an article
3. Cards are added to your specified Trello list

## Card Format

Each Trello card contains:
- **Title**: The news headline or PR title
- **Description**:
  - Executive summary
  - Ticker (if available)
  - Publication date
  - Full pitch/angle
  - Link to original source

## Manual Article Generation

After reviewing cards in Trello, you can:
1. Use the existing `/generate-from-pr` endpoint to generate articles manually
2. Or use the agent workflow with manual approval

## Troubleshooting

### Error: "TRELLO_API_KEY and TRELLO_TOKEN must be set"
- Make sure you've added both to your `.env.local` file
- Restart your server after adding them

### Error: "TRELLO_LIST_ID not set"
- Run `npm run get-trello-ids` to get your List ID
- Add it to your `.env.local` file
- Restart your server

### Cards not appearing in Trello
- Check that your API key and token are correct
- Verify the List ID is correct
- Check server logs for error messages

## Next Steps

After setting up Trello integration:
1. Test by running the agent: `npm run agent`
2. Check your Trello board for the new card
3. Review the card and decide if you want to generate an article
4. Use the manual generation endpoints when ready




