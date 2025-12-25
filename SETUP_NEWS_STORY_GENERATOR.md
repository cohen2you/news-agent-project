# Setting Up Your News Story Generator App

This guide shows how to connect your [news-story-generator](https://github.com/cohen2you/news-story-generator) Next.js app to the AI Agent.

## Step 1: Run Your Next.js App

First, make sure your news-story-generator app is running:

```bash
# Navigate to your news-story-generator directory
cd C:\path\to\news-story-generator

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

The app should start on `http://localhost:3000` (or another port if 3000 is taken).

## Step 2: Configure the AI Agent

Add this to your `.env.local` file in the `news-agent-project` directory:

```env
# Benzinga API (you already have this)
BENZINGA_API_KEY=your_benzinga_api_key_here

# Article Generation - Connect to your Next.js app
ARTICLE_GEN_TYPE=http
ARTICLE_GEN_API_URL=http://localhost:3000/api/generate/comprehensive-article
```

**Important Notes:**
- Make sure the port matches where your Next.js app is running
- The endpoint is `/api/generate/comprehensive-article` based on your repo

## Step 3: Verify the API Endpoint

Your Next.js app should have an API route at:
- `app/api/generate/comprehensive-article/route.ts` (App Router)
- OR `pages/api/generate/comprehensive-article.ts` (Pages Router)

The agent will send:
```json
{
  "sourceText": "Proposed Article: RKLB...\n[full pitch text]",
  "ticker": "RKLB",  // Auto-extracted if found in pitch
  "includeMarketData": true,
  "includeCTA": true,
  "includeSubheadings": true
}
```

## Step 4: Test the Connection

1. **Start your Next.js app:**
   ```bash
   cd news-story-generator
   npm run dev
   ```

2. **Start the AI Agent:**
   ```bash
   cd news-agent-project
   npm run dev
   ```

3. **Test in the dashboard:**
   - Go to `http://localhost:3001`
   - Enter a topic like "RKLB"
   - Approve the pitch
   - The agent should call your Next.js app to generate the article

## Troubleshooting

### Port Conflicts

If port 3000 is already in use:
- Change your Next.js app port: `PORT=3002 npm run dev`
- Update `.env.local`: `ARTICLE_GEN_API_URL=http://localhost:3002/api/generate/comprehensive-article`

### API Format Mismatch

If your Next.js API expects different parameters, you can:
1. Check your `route.ts` file to see what it expects
2. Share the expected format and I'll update the integration

### CORS Issues

If you get CORS errors, add this to your Next.js API route:
```typescript
export async function POST(request: Request) {
  // Add CORS headers
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  
  // ... your existing code
}
```

## Multiple Apps

If you have multiple article generation apps, you can:
1. Run them on different ports
2. Switch between them by changing `ARTICLE_GEN_API_URL` in `.env.local`
3. Or set up multiple configurations and switch as needed

## Next Steps

Once connected, the workflow will be:
1. **Analyst** → Fetches news from Benzinga → Generates pitch
2. **You** → Review and approve the pitch
3. **Writer** → Calls your Next.js app → Returns generated article

The generated article will appear in the dashboard!





