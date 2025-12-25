# How to Connect Your Existing Article Generation Apps

Since you're using TypeScript, here are the best ways to connect your existing apps:

## Option 1: HTTP API (Recommended for TypeScript Apps)

If your article generation apps run as HTTP servers (most common for TypeScript):

**In your `.env.local` file:**
```env
ARTICLE_GEN_TYPE=http
ARTICLE_GEN_API_URL=http://localhost:5000/generate
```

**Your app should accept:**
- Method: POST
- Body: `{ "pitch": "...", "topic": "..." }`
- Response: `{ "article": "..." }` or `{ "content": "..." }`

**Example TypeScript API endpoint:**
```typescript
// In your existing app
app.post('/generate', async (req, res) => {
  const { pitch, topic } = req.body;
  const article = await generateArticle(pitch);
  res.json({ article });
});
```

## Option 2: TypeScript Script (Run directly)

If you have a TypeScript file that generates articles:

**In your `.env.local` file:**
```env
ARTICLE_GEN_TYPE=typescript
ARTICLE_GEN_TSX_PATH=C:\Users\Mike\Documents\your-app\generate.ts
```

**Your script should:**
- Accept the pitch as the first command-line argument
- Output the article to stdout

**Example TypeScript script:**
```typescript
// generate.ts
const pitch = process.argv[2] || "";
const article = await generateArticle(pitch);
console.log(article);
```

## Option 3: Node.js Module (Import directly)

If your app exports a function:

**In your `.env.local` file:**
```env
ARTICLE_GEN_TYPE=node
ARTICLE_GEN_MODULE_PATH=../your-app/src/generator
```

**Your module should export:**
```typescript
// In your existing app
export async function generateArticle(pitch: string): Promise<string> {
  // ... your logic ...
  return article;
}
```

## Quick Setup

1. **Find out how your apps work:**
   - Are they running as HTTP servers? → Use Option 1
   - Are they TypeScript files? → Use Option 2
   - Are they modules/package exports? → Use Option 3

2. **Add to `.env.local`:**
   ```env
   BENZINGA_API_KEY=your_key_here
   ARTICLE_GEN_TYPE=http  # or typescript, or node
   ARTICLE_GEN_API_URL=http://localhost:5000/generate  # adjust based on type
   ```

3. **Restart the server:**
   ```bash
   npm run dev
   ```

## Need Help?

Share:
- Where your apps are located (file paths or GitHub URLs)
- How they're structured (HTTP API, script, module)
- How to run/call them

And I'll help you configure it!





