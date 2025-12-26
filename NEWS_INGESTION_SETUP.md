# News Ingestion Setup Guide

## Overview

The News Ingestion service automatically fetches news from Google News RSS feeds and routes articles to appropriate Trello lists based on content analysis.

## Lists Used

The service routes articles to these lists:
- **Incoming: Markets** - Broad market news, indices (S&P 500, Nasdaq, Dow)
- **Incoming: Economy** - Economic indicators (inflation, CPI, Fed rates, GDP)
- **Incoming: Commodities** - Commodity prices (oil, gold, natural gas, etc.)
- **Incoming: Hedge Funds** - Institutional investors, 13F filings, activist investors

## Setup

### Step 1: Add List IDs to `.env.local`

Add these environment variables with your Trello list IDs:

```env
# Content-based routing lists
TRELLO_LIST_ID_MARKETS=694ee4bb0c29561632d4efce
TRELLO_LIST_ID_ECONOMY=694ee4d12912a7f76c1264bd
TRELLO_LIST_ID_COMMODITIES=694ee4dbc81a20d89732b39d
TRELLO_LIST_ID_HEDGE_FUNDS=694ee4e2c59c28e25f8d8e7e

# Enable news ingestion (set to 'true' to enable)
NEWS_INGESTION_ENABLED=true

# Interval in milliseconds (default: 300000 = 5 minutes)
NEWS_INGESTION_INTERVAL=300000
```

### Step 2: Enable the Service

Set `NEWS_INGESTION_ENABLED=true` in your `.env.local` file.

### Step 3: Restart the Server

The service will automatically start when the server starts.

## How It Works

1. **Fetches RSS Feeds**: Checks 4 Google News RSS feeds every 5 minutes (configurable)
2. **Routes Articles**: Uses content analysis to determine which list each article belongs to
3. **Creates Trello Cards**: Creates cards in the appropriate list with article title, URL, and snippet
4. **Deduplication**: Tracks processed URLs to avoid creating duplicate cards

## Routing Logic

Articles are routed based on keywords in the title and content:

- **Hedge Funds**: "hedge fund", "ackman", "dalio", "citadel", "13f", "activist investor"
- **Commodities**: "oil", "gold", "silver", "copper", "wheat", "natural gas", "commodities"
- **Economy**: "inflation", "cpi", "fed", "fomc", "gdp", "unemployment", "recession"
- **Markets**: "s&p 500", "nasdaq", "dow jones", "wall street", "market index"

If no match is found, articles go to the default list (TRELLO_LIST_ID).

## Manual Trigger

You can manually trigger a news cycle via API:

```bash
POST http://localhost:3001/news-ingestion/run
```

## Configuration

### Environment Variables

- `NEWS_INGESTION_ENABLED` - Set to `'true'` to enable automatic polling (default: disabled)
- `NEWS_INGESTION_INTERVAL` - Interval in milliseconds (default: 300000 = 5 minutes)
- `TRELLO_LIST_ID_MARKETS` - List ID for Markets articles
- `TRELLO_LIST_ID_ECONOMY` - List ID for Economy articles
- `TRELLO_LIST_ID_COMMODITIES` - List ID for Commodities articles
- `TRELLO_LIST_ID_HEDGE_FUNDS` - List ID for Hedge Funds articles
- `TRELLO_LIST_ID` - Default fallback list (if routing doesn't match)

## RSS Feeds

The service monitors these Google News RSS feeds:

1. **Hedge Funds & Institutional**: Searches for hedge fund news, Bill Ackman, Ray Dalio, Citadel, etc.
2. **Commodities**: Searches for oil prices, gold prices, natural gas, commodities
3. **Economy**: Searches for inflation, CPI, Fed rates, GDP, recession
4. **Markets**: Searches for stock market, S&P 500, Nasdaq, Dow Jones

## Logs

When running, you'll see logs like:

```
📡 [News Ingestion] Starting news cycle scan...
📰 Processing feed: Markets
   ✅ Found 20 article(s) in feed
   ✅ Created card: "S&P 500 Rises on Strong Earnings..."
      → List ID: 694ee4bb0c29561632d4efce
📊 [News Ingestion] Cycle Complete
   Total processed: 20
   Cards created: 5
   Skipped (duplicates/errors): 15
```

## Troubleshooting

**No cards being created?**
- Check that `NEWS_INGESTION_ENABLED=true` is set
- Verify all list IDs are correct in `.env.local`
- Check server logs for errors

**Too many duplicate cards?**
- The service tracks processed URLs in memory
- If the server restarts, it will process articles again
- Consider implementing persistent storage for URL tracking if needed

**Articles going to wrong lists?**
- Check the routing logic in `trello-list-router.ts`
- Adjust keyword patterns if needed
- Check logs to see which list each article was routed to

