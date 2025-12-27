# Check News Ingestion Status

## To Verify News Ingestion is Running:

1. **Check Render Logs** for these startup messages:
   ```
   📡 Starting News Ingestion Service...
   Interval: X minutes
   ✅ News Ingestion Service started
   ```

   OR if disabled:
   ```
   ℹ️  News Ingestion Service disabled (set NEWS_INGESTION_ENABLED=true to enable)
   ```

2. **Check Environment Variables in Render:**
   - Go to Render Dashboard → Your Service → Environment
   - Verify `NEWS_INGESTION_ENABLED=true` is set
   - Verify `NEWS_INGESTION_INTERVAL=300000` (or your desired interval)
   - Verify all list IDs are set:
     - `TRELLO_LIST_ID_MARKETS`
     - `TRELLO_LIST_ID_ECONOMY`
     - `TRELLO_LIST_ID_COMMODITIES`
     - `TRELLO_LIST_ID_HEDGE_FUNDS`

3. **Manually Trigger to Test:**
   Use curl or Postman to trigger it manually:
   ```bash
   POST https://news-agent-project.onrender.com/news-ingestion/run
   ```

4. **Look for News Ingestion Logs:**
   After triggering, you should see:
   ```
   📡 [News Ingestion] Starting news cycle scan...
   📰 Processing feed: Markets
   📰 Processing feed: Economy
   📰 Processing feed: Commodities
   📰 Processing feed: Hedge Funds & Institutional
   ```

## Common Issues:

**No logs at all?**
- Service might not be enabled (`NEWS_INGESTION_ENABLED` not set to `'true'`)
- Check startup logs for the service status message

**Service enabled but no cards created?**
- Check for errors in logs
- Verify list IDs are correct
- Check if Bing RSS feeds are accessible

**Service runs but finds 0 articles?**
- Bing RSS feeds might be blocking requests
- Check if feeds are accessible by visiting the URLs directly

