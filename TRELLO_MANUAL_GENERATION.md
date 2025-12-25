# Trello Manual Article Generation Setup

## Overview

The PR auto-scan now creates Trello cards with a "Generate Article" link. Users can click the link in Trello to generate articles manually. After generation, cards are automatically moved to the "Submitted" list.

## Features

1. **24-Hour Initial Load**: Only PRs from the past 24 hours are loaded initially
2. **Manual Generation**: Cards include a "Generate Article" link (not automatic)
3. **Auto-Move to Submitted**: Cards automatically move to "Submitted" list after article generation

## Setup

### 1. Add Submitted List ID to .env.local

Run the helper script to get your "Submitted" list ID:

```bash
npm run get-trello-ids
```

Add to `.env.local`:

```env
TRELLO_LIST_ID_SUBMITTED=69457fb1a8b97c50617c5d6c
```

(Replace with your actual "Submitted" list ID)

### 2. Set APP_URL (Optional)

If your server is accessible from outside localhost, set this:

```env
APP_URL=http://your-domain.com:3001
```

If not set, defaults to `http://localhost:3001` (works for local Trello usage).

## How It Works

### 1. PR Auto-Scan Creates Cards

When you start PR auto-scan:
- Fetches PRs from past 24 hours (initial load)
- Creates Trello cards in "PR-Related Stories" list
- Each card includes a "Generate Article" link

### 2. User Clicks "Generate Article" in Trello

- Link opens: `http://localhost:3001/trello/generate-article/{cardId}`
- This is a POST endpoint that generates the article
- Uses the "comprehensive" article generator by default

### 3. Card Moves to Submitted

After article generation:
- Card automatically moves to "Submitted" list
- Generated article is stored in the system
- You can view it via the `/pr-auto-scan/articles` endpoint

## Trello Card Format

Each card contains:
- **Title**: PR headline
- **Description**:
  - Executive summary
  - Ticker and date
  - Link to original PR
  - **"Generate Article" link** (clickable button in Trello)

## Testing

1. **Start PR Auto-Scan**:
   - Open `http://localhost:3001`
   - Click "📰 Start PR Auto-Scan"
   - Click "🚀 Start PR Auto-Scan"
   - Check Trello for new cards

2. **Generate Article**:
   - Open a card in Trello
   - Click the "Generate Article" link in the card description
   - Article will be generated
   - Card will move to "Submitted" list

3. **Verify**:
   - Check server logs for generation confirmation
   - Verify card moved to "Submitted" list
   - Article is stored and accessible

## Troubleshooting

### "Generate Article" link doesn't work
- Check that `APP_URL` is set correctly in `.env.local`
- Make sure the server is running
- Check server logs for errors

### Card doesn't move to "Submitted" list
- Verify `TRELLO_LIST_ID_SUBMITTED` is set in `.env.local`
- Check server logs for move errors
- Ensure the list ID is correct (run `npm run get-trello-ids`)

### "PR data not found" error
- This happens if cards were created before this feature
- Only cards created after this update will have PR data stored
- You'll need to manually enter PR data or recreate the cards

## API Endpoint

### POST `/trello/generate-article/:cardId`

Generates an article from a Trello card and moves it to Submitted list.

**Parameters:**
- `cardId` (URL param): Trello card ID
- `selectedApp` (body, optional): Article generator app (default: "comprehensive")

**Response:**
```json
{
  "status": "success",
  "articleId": "trello_gen_...",
  "title": "Generated Article Title",
  "cardMoved": true,
  "message": "Article generated and card moved to Submitted list"
}
```




