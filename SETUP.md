# Setup Guide

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` and add your configuration:

### Benzinga API Key

```env
BENZINGA_API_KEY=your_actual_api_key_here
```

Get your Benzinga API key from: https://www.benzinga.com/apis

### Article Generation App Configuration

Choose ONE of the following methods based on how your existing apps work:

#### Option 1: Local Python Script

If you have a Python script that generates articles:

```env
ARTICLE_GEN_TYPE=python
ARTICLE_GEN_PYTHON_PATH=C:\Users\Mike\Documents\your-article-generator\generate.py
```

**Example Python script interface:**
Your script should accept the pitch as a command-line argument and output the article to stdout:

```python
# generate.py
import sys

pitch = sys.argv[1] if len(sys.argv) > 1 else ""
# ... your article generation logic ...
print(generated_article)
```

#### Option 2: HTTP API

If your article generation app runs as an HTTP API:

```env
ARTICLE_GEN_TYPE=http
ARTICLE_GEN_API_URL=http://localhost:5000/generate
```

**Expected API format:**
- Method: POST
- Body: `{ "pitch": "...", "topic": "..." }`
- Response: `{ "article": "..." }` or `{ "content": "..." }`

#### Option 3: GitHub Repository (Cloned Locally)

If your app is in a GitHub repo that you've cloned:

```env
ARTICLE_GEN_TYPE=github
ARTICLE_GEN_REPO_PATH=C:\Users\Mike\Documents\your-article-repo
ARTICLE_GEN_SCRIPT=generate_article.py
```

#### Option 4: Node.js Module

If your app is a Node.js module:

```env
ARTICLE_GEN_TYPE=node
ARTICLE_GEN_MODULE_PATH=./article-generator
```

**Expected module format:**
```typescript
// article-generator/index.ts
export async function generateArticle(pitch: string): Promise<string> {
  // ... your logic ...
  return article;
}
```

## 3. Start the Server

```bash
npm run dev
```

The server will start on `http://localhost:3001`

## 4. Open the Dashboard

Visit: `http://localhost:3001/`

## Testing Your Integration

1. Enter a topic in the dashboard (e.g., "AI stocks")
2. The agent will fetch news from Benzinga and generate a pitch
3. Review and approve the pitch
4. The system will call your article generation app
5. View the generated article

## Troubleshooting

### Benzinga API Issues

- Check that your API key is correct in `.env`
- Verify you have an active Benzinga API subscription
- Check the console logs for API error messages

### Article Generation Issues

- Verify the path/URL in `.env` is correct
- For Python scripts: Ensure Python is in your PATH
- For HTTP APIs: Make sure your API server is running
- Check the console logs for detailed error messages

### Common Errors

**"ARTICLE_GEN_PYTHON_PATH not set"**
- Make sure you've set the correct environment variable in `.env`

**"Python script not found"**
- Check the path is correct (use absolute paths on Windows)
- Use forward slashes or escaped backslashes: `C:/path/to/script.py` or `C:\\path\\to\\script.py`

**"API error: 404"**
- Verify your HTTP API is running and the URL is correct
- Check that your API accepts POST requests with the expected format





