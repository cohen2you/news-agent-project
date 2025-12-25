# Setting Up WGO Article Generator

This guide shows how to connect your [wiim-project-v2](https://github.com/cohen2you/wiim-project-v2) WGO Article Generator to the AI Agent.

## Step 1: Find the WGO API Endpoint

First, you need to identify the API endpoint for the WGO Article Generator in your `wiim-project-v2` app. Common locations:

- `app/api/generate/wgo/route.ts` (App Router)
- `pages/api/generate/wgo.ts` (Pages Router)
- Or check your app structure for the WGO segment

## Step 2: Run Your wiim-project-v2 App

Make sure your wiim-project-v2 app is running:

```bash
# Navigate to your wiim-project-v2 directory
cd C:\Users\Mike\Documents\wiim-project-v2

# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev
```

Note the port it runs on (usually 3000, 3001, or 3002 if others are in use).

## Step 3: Configure the AI Agent

Add this to your `.env.local` file in the `news-agent-project` directory:

```env
# Benzinga API (you already have this)
BENZINGA_API_KEY=your_benzinga_api_key_here

# Default Article Generator (Comprehensive)
ARTICLE_GEN_TYPE=http
ARTICLE_GEN_API_URL=http://localhost:3000/api/generate/comprehensive-article

# WGO Article Generator (wiim-project-v2)
ARTICLE_GEN_APP_WGO_TYPE=http
ARTICLE_GEN_APP_WGO_URL=http://localhost:3001/api/generate/wgo
```

**Important Notes:**
- Replace `3001` with the actual port your wiim-project-v2 app runs on
- Replace `/api/generate/wgo` with the actual endpoint path if different
- Make sure both apps can run simultaneously on different ports

## Step 4: Using Multiple Apps

Now when you use the dashboard:

1. **Enter a topic** → The agent fetches news and generates a pitch
2. **Review the pitch** → You'll see a dropdown to select which article generator to use:
   - **Default App** (Comprehensive Article Generator)
   - **WGO Article Generator**
3. **Select your preferred app** from the dropdown
4. **Approve & Generate** → The agent will use the selected app to generate the article

## Step 5: Test the Connection

1. **Start your wiim-project-v2 app:**
   ```bash
   cd C:\Users\Mike\Documents\wiim-project-v2
   npm run dev
   ```

2. **Start your news-story-generator app** (if using both):
   ```bash
   cd C:\Users\Mike\Documents\news-story-generator
   npm run dev
   ```

3. **Start the AI Agent:**
   ```bash
   cd C:\Users\Mike\Documents\news-agent-project
   npm run dev
   ```

4. **Test in the dashboard:**
   - Go to `http://localhost:3001` (or your agent port)
   - Enter a topic
   - Review the pitch
   - **Select "WGO Article Generator" from the dropdown**
   - Click "Approve & Generate"
   - The agent will call your WGO generator

## Finding the Correct Endpoint

If you're not sure what the WGO endpoint is:

1. Check your `wiim-project-v2` app structure:
   ```bash
   cd C:\Users\Mike\Documents\wiim-project-v2
   # Look for API routes
   dir app\api /s  # Windows
   # or
   find app/api -name "*.ts"  # If you have find
   ```

2. Or check the Next.js dev server logs when you access the WGO segment in the browser

3. Common patterns:
   - `/api/generate/wgo`
   - `/api/wgo/generate`
   - `/api/article/wgo`

## Troubleshooting

### Port Conflicts

If ports conflict, run apps on different ports:
- Comprehensive: `PORT=3000 npm run dev`
- WGO: `PORT=3001 npm run dev`
- Agent: `PORT=3002 npm run dev` (or update in server.ts)

### API Format

The agent sends this format to WGO:
```json
{
  "sourceText": "[pitch text]",
  "pitch": "[pitch text]",
  "topic": "[extracted topic]",
  "ticker": "[extracted ticker if found]"
}
```

If your WGO endpoint expects different parameters, let me know and I can update the integration.

### App Not Showing in Dropdown

If the WGO app doesn't appear in the dropdown:
1. Check that `ARTICLE_GEN_APP_WGO_URL` is set in `.env.local`
2. Restart the agent server
3. Check the server logs for any errors

## Adding More Apps

You can add more article generation apps using the same pattern:

```env
ARTICLE_GEN_APP_MYAPP_TYPE=http
ARTICLE_GEN_APP_MYAPP_URL=http://localhost:5000/api/generate
```

They'll automatically appear in the dropdown!





