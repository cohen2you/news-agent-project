# Analyst Tools Integration (wiim-project-v2)

This guide explains how to integrate the Analyst Story Generator Agent with your existing tools in `wiim-project-v2`.

---

## Overview

You have two tools in `wiim-project-v2`:
1. **Scraping/Extraction Tool** - Extracts data from analyst notes
2. **Story Generator Tool** - Generates analyst note stories

Both tools need to be accessible via HTTP endpoints so the Agent can call them.

---

## Step 1: Identify Your Tool Endpoints

You need to find the API endpoints in your `wiim-project-v2` project. Common locations:

### For Next.js App Router:
- `app/api/analyst/scrape/route.ts`
- `app/api/analyst/generate-story/route.ts`
- `app/api/extract/analyst-note/route.ts`
- `app/api/generate/analyst-story/route.ts`

### For Next.js Pages Router:
- `pages/api/analyst/scrape.ts`
- `pages/api/analyst/generate-story.ts`

### For Express/Fastify:
- Check your routes file for analyst-related endpoints

**Ask yourself:**
- What are the endpoint paths?
- What port does `wiim-project-v2` run on? (usually 3000, 3001, or 3002)

---

## Step 2: Understand Request/Response Formats

### Scraping/Extraction Tool

**Expected Request Format:**
The Agent will send analyst note content. Example formats:

```typescript
// Option A: Just the note content
POST /api/analyst/scrape
{
  "noteContent": "Full analyst note text here..."
}

// Option B: With metadata
POST /api/analyst/scrape
{
  "noteContent": "Full analyst note text...",
  "ticker": "TSLA",
  "firm": "Goldman Sachs",
  "analyst": "John Doe",
  "date": "2025-12-21"
}

// Option C: URL to scrape
POST /api/analyst/scrape
{
  "url": "https://example.com/analyst-note"
}
```

**Expected Response Format:**
Your tool should return extracted structured data:

```typescript
{
  "ticker": "TSLA",
  "firm": "Goldman Sachs",
  "analyst": "John Doe",
  "priceTarget": 350,
  "rating": "Buy",
  "summary": "Extracted summary...",
  "keyPoints": ["Point 1", "Point 2"],
  "extractedData": { /* any structured data */ }
}
```

---

### Story Generator Tool

**Expected Request Format:**
The Agent will send extracted data from the scraping tool:

```typescript
POST /api/analyst/generate-story
{
  "extractedData": {
    "ticker": "TSLA",
    "firm": "Goldman Sachs",
    "analyst": "John Doe",
    "priceTarget": 350,
    "rating": "Buy",
    "summary": "...",
    "keyPoints": [...]
  },
  "originalNote": "Full original note text...",
  "ticker": "TSLA"
}
```

**Expected Response Format:**
Your tool should return the generated story:

```typescript
{
  "story": "<p>Full HTML story content here...</p>",
  "title": "Goldman Sachs Raises TSLA Price Target to $350",
  "metadata": {
    "wordCount": 850,
    "generatedAt": "2025-12-21T10:00:00Z"
  }
}
```

---

## Step 3: Update Environment Variables

Add these to your `.env.local` in `news-agent-project`:

```env
# Analyst Tools (wiim-project-v2)
ANALYST_SCRAPER_URL=http://localhost:3002/api/analyst/scrape
ANALYST_STORY_GENERATOR_URL=http://localhost:3002/api/analyst/generate-story

# Or if using different ports/paths, adjust accordingly:
# ANALYST_SCRAPER_URL=http://localhost:3000/api/extract/analyst-note
# ANALYST_STORY_GENERATOR_URL=http://localhost:3000/api/generate/analyst-story
```

**Important:** 
- Replace `3002` with the actual port your `wiim-project-v2` runs on
- Replace the paths with your actual endpoint paths

---

## Step 4: Test Your Tools

Before integrating, test that your tools work:

### Test Scraping Tool:
```bash
curl -X POST http://localhost:3002/api/analyst/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "noteContent": "Goldman Sachs raises TSLA price target to $350. Analyst John Doe cites strong demand..."
  }'
```

### Test Story Generator:
```bash
curl -X POST http://localhost:3002/api/analyst/generate-story \
  -H "Content-Type: application/json" \
  -d '{
    "extractedData": {
      "ticker": "TSLA",
      "firm": "Goldman Sachs",
      "priceTarget": 350,
      "rating": "Buy"
    }
  }'
```

---

## Step 5: Integration Options

The Agent can integrate in two ways:

### Option A: Sequential (Recommended)
1. Agent reads analyst note from Trello
2. Calls Scraping Tool → gets extracted data
3. Calls Story Generator with extracted data → gets story
4. Updates Trello card with story

**Flow:**
```
Trello Card → Scraper → Extracted Data → Story Generator → Story → Trello Update
```

### Option B: Direct Generation
If your Story Generator can handle raw notes directly:

1. Agent reads analyst note from Trello
2. Calls Story Generator directly with note
3. Updates Trello card with story

**Flow:**
```
Trello Card → Story Generator → Story → Trello Update
```

**Which should we use?** Let me know your preference!

---

## Step 6: Request/Response Matching

**If your tools use different formats**, we can adapt:

### Example Adaptations:

**If Scraper expects URL instead of content:**
```typescript
// Agent will extract URL from email/Trello card
POST /api/analyst/scrape
{ "url": "https://research-firm.com/note-123" }
```

**If Story Generator expects different fields:**
```typescript
// Agent will transform extracted data to match
POST /api/analyst/generate-story
{
  "ticker": "TSLA",
  "firmName": "Goldman Sachs",  // Instead of "firm"
  "analystName": "John Doe",     // Instead of "analyst"
  "targetPrice": 350,            // Instead of "priceTarget"
  "recommendation": "Buy"        // Instead of "rating"
}
```

---

## Questions to Answer

Before I code the integration, please provide:

1. **Scraping Tool:**
   - Endpoint path: `_________________`
   - Port: `_________________`
   - Request format: `_________________` (what fields does it expect?)
   - Response format: `_________________` (what does it return?)

2. **Story Generator Tool:**
   - Endpoint path: `_________________`
   - Port: `_________________`
   - Request format: `_________________` (what fields does it expect?)
   - Response format: `_________________` (what does it return?)

3. **Workflow Preference:**
   - [ ] Sequential (Scrape → Generate)
   - [ ] Direct (Generate from note directly)

4. **Error Handling:**
   - What should happen if scraping fails?
   - What should happen if story generation fails?

---

## Next Steps

Once you provide the endpoint details, I'll:
1. Create the integration code
2. Add error handling
3. Set up proper request/response transformations
4. Test the flow

**Ready to proceed?** Just share your endpoint details!




