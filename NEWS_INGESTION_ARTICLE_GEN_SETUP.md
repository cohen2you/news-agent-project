# News Ingestion Article Generation Setup

The news ingestion service (Markets, Economy, Commodities, Hedge Funds, Tech & AI lists) now supports article generation using the `/api/generate/story` endpoint from the news-story-generator app.

## Environment Configuration

Add these environment variables to your `.env` file:

```env
# News Story Generator (for news ingestion articles - Markets, Economy, Commodities, Hedge Funds, Tech & AI)
ARTICLE_GEN_APP_NEWS_STORY_TYPE=http
ARTICLE_GEN_APP_NEWS_STORY_URL=http://localhost:3000/api/generate/story
```

**Important Notes:**
- Make sure the port matches where your news-story-generator app is running (usually port 3000)
- The endpoint is `/api/generate/story` - this is the story generation endpoint used for news ingestion articles
- Uses `ARTICLE_GEN_APP_NEWS_STORY_URL` environment variable (separate from PR-related articles which use `ARTICLE_GEN_APP_STORY_URL`)

## How It Works

When you click "Generate Article" in a Trello card created by the news ingestion service:

1. The system extracts the article URL from the card description (`**Source URL:**` format)
2. The URL is passed to the `/api/generate/story` endpoint in the news-story-generator app
3. The story generator fetches/scrapes the article content from the URL
4. A complete article is generated and stored
5. The Trello card is moved to the "Submitted" list

## Card Structure

Cards created by the news ingestion service include:
- **Title**: The article headline
- **Source URL**: The full URL to the original article (prominently displayed at the top)
- **Content**: A snippet of the article content (first 1000 characters)
- **Generate Article Button**: Links to the article generation endpoint with `selectedApp=news-story`

## Testing

1. Make sure your news-story-generator app is running:
   ```bash
   cd C:\Users\Mike\Documents\news-story-generator
   npm run dev
   ```

2. Make sure the endpoint is accessible:
   - Visit `http://localhost:3000/api/generate/story` in your browser
   - You should see an error about POST method (that's expected - it means the endpoint exists)

3. Ensure news ingestion is enabled:
   ```env
   NEWS_INGESTION_ENABLED=true
   NEWS_INGESTION_INTERVAL=300000
   ```

4. Wait for cards to be created in the Markets, Economy, Commodities, or Hedge Funds lists, or trigger manually:
   ```bash
   # POST request to trigger news ingestion cycle
   curl -X POST http://localhost:3001/news-ingestion/run
   ```

5. Click "Generate Article" on a card to test the integration

