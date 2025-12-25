# Technical Analysis API Call Documentation

## Overview

This document shows exactly how the Agent app calls the `/api/generate/technical-analysis` endpoint, including how it constructs the request body and what data is passed.

## Location

The code is in: `article-generator-integration.ts` in the `generateWithHTTP()` function.

## API Call Code

### 1. Endpoint Detection

```typescript
// Lines 119-121: Check if this is the technical-analysis endpoint
const isWGOTechnicalAnalysis = config.apiUrl.includes('/api/generate/technical-analysis') ||
                               config.apiUrl.includes('technical-analysis');
```

### 2. Request Body Construction (Lines 315-501)

For the technical-analysis endpoint, the request body is constructed as follows:

```typescript
if (isWGOTechnicalAnalysis) {
  let scrapedContent = '';
  let selectedArticles: any[] = [];
  
  // Prioritize the selectedArticle (the one from the pitch) over other articles
  const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
  
  // ... ticker extraction logic ...
  
  if (articleToUse) {
    // Use the specific article that was pitched - prioritize full body over teaser
    scrapedContent = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.summary || pitch;
    
    // Build selectedArticles array with the article data
    selectedArticles = [{
      title: articleToUse.title || articleToUse.headline || '',
      body: articleToUse.body || articleToUse.content || articleToUse.teaser || '',
      url: articleToUse.url || '',  // <-- URL is included here
      date: articleToUse.created ? formatArticleDate(articleToUse.created) : undefined
    }];
  } else {
    // No news articles - use pitch as scrapedContent
    scrapedContent = pitch;
  }
  
  // Ensure scrapedContent is never empty
  if (!scrapedContent || scrapedContent.trim().length === 0) {
    scrapedContent = pitch;
  }
  
  // The technical-analysis endpoint automatically fetches technical data and market context
  // IMPORTANT: The endpoint expects tickers as a STRING (comma-separated), not an array
  requestBody = {
    tickers: finalTicker || ticker, // String format
    scrapedContent: scrapedContent, // News/article content (text, not URL)
    selectedArticles: selectedArticles.length > 0 ? selectedArticles : undefined, // Optional: structured article data
  };
}
```

### 3. Final Request Body Structure

The request body sent to `/api/generate/technical-analysis` looks like this:

```json
{
  "tickers": "AAPL" or "NYSE:AAPL",  // String format (comma-separated if multiple)
  "scrapedContent": "Article body text here...",  // Full text content, NOT a URL
  "selectedArticles": [  // Optional - only included if article data is available
    {
      "title": "Article Title",
      "body": "Article body text...",
      "url": "https://example.com/article",  // <-- URL is in selectedArticles[0].url
      "date": "2025-01-15"
    }
  ]
}
```

**Important Notes:**
- ❌ **`newsUrl` field is NOT passed** - The URL is only in `selectedArticles[0].url`
- ✅ **`scrapedContent` contains the full article text** (not a URL)
- ✅ **`selectedArticles` is optional** - Only included if article data is available
- ✅ **`tickers` is a STRING** (comma-separated), not an array

### 4. Actual HTTP Request (Lines 707-713)

```typescript
const response = await fetch(config.apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(requestBody),
});
```

## Logging (What Gets Logged)

The code logs extensive information about what's being sent:

```typescript
// Lines 500-501: Log request body summary
console.log(`   ✅ Final WGO Technical Analysis request body: tickers="${finalTicker || ticker}" (string), scrapedContent length=${scrapedContent.length}`);
console.log(`   📊 Technical analysis will be automatically fetched and included in the article`);

// Lines 466-469: Log article details
console.log(`   ✅ Using WGO Technical Analysis endpoint with ticker: ${ticker} and news context`);
console.log(`   📊 Ticker source: ${manualTicker ? 'MANUAL' : 'extracted'}`);
console.log(`   Article title: ${selectedArticles[0].title || 'No title'}`);
console.log(`   Scraped content length: ${scrapedContent.length} chars`);

// Lines 685-705: Log full request details
console.log(`   📤 Making POST request to: ${config.apiUrl}`);
console.log(`   📦 Request body keys: ${Object.keys(requestBody).join(', ')}`);
if (requestBody.tickers) {
  console.log(`   📦 Request body tickers: ${JSON.stringify(requestBody.tickers)}`);
}
if (requestBody.scrapedContent) {
  console.log(`   📦 Request body scrapedContent length: ${requestBody.scrapedContent.length} chars`);
}
// Log full request body (truncated if > 500 chars)
const requestBodyStr = JSON.stringify(requestBody);
if (requestBodyStr.length > 500) {
  console.log(`   📦 Request body preview: ${requestBodyStr.substring(0, 500)}...`);
} else {
  console.log(`   📦 Full request body: ${requestBodyStr}`);
}
```

## Article Data Source

The article data (`articleToUse`) comes from:

1. **Primary source**: `selectedArticle` parameter (passed from the WGO agent when user selects an article)
2. **Fallback**: `newsArticles[0]` (first article from the news search)

The article object structure is:

```typescript
{
  title?: string,
  headline?: string,
  body?: string,          // Full article body text
  content?: string,       // Alternative to body
  teaser?: string,        // Short preview
  summary?: string,       // Alternative summary
  url?: string,           // Article URL
  created?: number,       // Unix timestamp
  ticker?: string,        // Stock ticker
  stocks?: Array<string | { ticker?: string, symbol?: string }>  // Multiple stocks
}
```

## URL Extraction/Scraping

**The Agent does NOT scrape URLs from articles.** Instead:

1. Articles are fetched from Benzinga API (which includes URLs)
2. Article data (including `url`) is passed directly to the article generator
3. The `url` is included in `selectedArticles[0].url` in the request body
4. The `scrapedContent` field contains the **text content** of the article, not the URL

## Example Server Logs

When the technical-analysis endpoint is called, you should see logs like:

```
🌐 Calling HTTP API: http://localhost:3003/api/generate/technical-analysis
   Topic: AAPL
   News articles: 1
   First article keys: title, body, url, created, ticker
   ✅ Using WGO Technical Analysis endpoint with ticker: AAPL and news context
   📊 Ticker source: article.ticker field
   Article title: Apple Announces New Product
   Scraped content length: 1234 chars
   ✅ Final WGO Technical Analysis request body: tickers="AAPL" (string), scrapedContent length=1234
   📊 Technical analysis will be automatically fetched and included in the article
   📤 Making POST request to: http://localhost:3003/api/generate/technical-analysis
   📦 Request body keys: tickers, scrapedContent, selectedArticles
   📦 Request body tickers: "AAPL"
   📦 Request body scrapedContent length: 1234 chars
   📦 Request body preview: {"tickers":"AAPL","scrapedContent":"Article text...","selectedArticles":[...]}
```

## Potential Issues

If the API endpoint expects a `newsUrl` field separately, this is the problem:

1. ✅ **URL IS passed** - But only in `selectedArticles[0].url`
2. ❌ **`newsUrl` field is NOT passed** - The endpoint would need to extract it from `selectedArticles`
3. ❌ **`scrapedContent` is text, not a URL** - The endpoint receives the article text directly

## Recommendation

If the `/api/generate/technical-analysis` endpoint expects a `newsUrl` field, you have two options:

1. **Option 1 (Recommended)**: Modify the endpoint to extract the URL from `selectedArticles[0].url`
2. **Option 2**: Modify `article-generator-integration.ts` to add a `newsUrl` field to the request body:

```typescript
requestBody = {
  tickers: finalTicker || ticker,
  scrapedContent: scrapedContent,
  newsUrl: selectedArticles.length > 0 ? selectedArticles[0].url : undefined,  // Add this
  selectedArticles: selectedArticles.length > 0 ? selectedArticles : undefined,
};
```

