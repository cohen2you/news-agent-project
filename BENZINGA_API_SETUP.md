# Benzinga API Setup Guide

## Current Issue: 404 Error

If you're getting a 404 error, it means the API endpoint format might not match your Benzinga API subscription plan or version.

## Solutions

### 1. Check Your Benzinga API Documentation

The code tries multiple endpoint formats automatically, but you may need to use a specific format based on your subscription:

- **Free Tier**: May have limited endpoints
- **Pro/Enterprise**: Full API access with different endpoint structures

### 2. Verify Your API Key Format

Benzinga API keys can be in different formats:
- Some use `token` parameter
- Some use `apikey` parameter  
- Some use `X-API-KEY` header

The code tries all of these automatically.

### 3. Check Your API Plan

Different Benzinga plans have access to different endpoints:
- News API v1
- News API v2
- News API v2.1

### 4. Test Your API Key Directly

You can test your API key using curl:

```bash
# Try v2.1 format
curl "https://api.benzinga.com/api/v2.1/news?token=YOUR_API_KEY&pageSize=5"

# Try v2 format
curl "https://api.benzinga.com/api/v2/news?apikey=YOUR_API_KEY&pagesize=5"

# Try v1 format
curl "https://api.benzinga.com/api/v1/news?token=YOUR_API_KEY&limit=5"
```

### 5. Alternative: Use Stock Symbol Format

If you're searching for stock tickers (like "RKLB"), you might need to use the stock/news endpoint:

```bash
curl "https://api.benzinga.com/api/v2.1/news?token=YOUR_API_KEY&tickers=RKLB"
```

### 6. Contact Benzinga Support

If none of the endpoints work:
1. Check your Benzinga dashboard for the correct API endpoint
2. Verify your API key is active
3. Contact Benzinga support with your API key format and subscription plan

## Manual Configuration

If you know the correct endpoint format, you can modify `benzinga-api.ts` to use it directly instead of trying multiple formats.

## Fallback Behavior

The system will automatically fall back to a mock pitch if the API fails, so your workflow will continue to work even if the API is down.





