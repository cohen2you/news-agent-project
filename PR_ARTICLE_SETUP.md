# PR Article Generation Setup

PR-related articles are generated using the `/api/generate/pr-story` endpoint from the **news-story-generator** app.

## Environment Configuration

Add this to your `.env.local` file in the `news-agent-project` directory:

```env
# For PR-related articles - uses /api/generate/pr-story endpoint
ARTICLE_GEN_APP_STORY_TYPE=http
ARTICLE_GEN_APP_STORY_URL=http://localhost:3000/api/generate/pr-story
```

**Important Notes:**
- Make sure the port matches where your news-story-generator app is running (usually port 3000)
- The endpoint is `/api/generate/pr-story` - this is the PR-specific story generation endpoint
- This endpoint accepts: `ticker`, `sourceText`, `headline`, `date`, `sourceUrl`, `includeCTA`, `includeSubheads`

## How It Works

When you click "Generate Article" in a Trello card for a PR-related story:

1. The system calls the `/api/generate/pr-story` endpoint from news-story-generator
2. It sends:
   - `sourceText`: The PR body/content
   - `ticker`: The company ticker (extracted from PR)
   - `headline`: The PR headline
   - `date`: Formatted date from the PR
   - `sourceUrl`: URL to the original PR
   - `includeCTA`: true (includes call-to-action)
   - `includeSubheads`: true (includes subheadings)

3. The news-story-generator app generates a complete article and returns it
4. The article is stored and the Trello card is moved to the "Submitted" list

## Testing

1. Make sure your news-story-generator app is running:
   ```bash
   cd C:\Users\Mike\Documents\news-story-generator
   npm run dev
   ```

2. Make sure the endpoint is accessible:
   - Visit `http://localhost:3000/api/generate/pr-story` in your browser
   - You should see an error about POST method (that's expected - it means the endpoint exists)

3. Start the PR auto-scan and generate an article from a Trello card to test the integration



