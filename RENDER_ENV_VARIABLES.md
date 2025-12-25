# Render Environment Variables Setup

Since your WGO search works locally but not on Render, you need to add all environment variables to Render's dashboard.

## Required Environment Variables for WGO

Add these in **Render Dashboard → Your Service → Environment**:

### Benzinga API Keys
```
BENZINGA_API_KEY=your_benzinga_api_key_here
BENZINGA_PR_API_KEY=your_benzinga_pr_api_key_here
```

### Trello Credentials
```
TRELLO_API_KEY=your_trello_api_key_here
TRELLO_TOKEN=your_trello_token_here
```

### Trello List IDs
```
TRELLO_LIST_ID=your_default_list_id
TRELLO_LIST_ID_WGO=69457f7350ac5fd4b8efcc96
TRELLO_LIST_ID_PR=69457f88b14cc47295a95c4d
TRELLO_WGO_CONTROL_CARD_ID=694a75ba447b3cda80662c98
```

### Application URL
```
APP_URL=https://your-render-service-url.onrender.com
```
**Important**: Replace `your-render-service-url.onrender.com` with your actual Render service URL. This is used to generate article links in Trello cards.

### Optional: Article Generator URLs
```
ARTICLE_GEN_APP_WGO_URL=https://your-wgo-generator-url
ARTICLE_GEN_APP_PR_URL=https://your-pr-generator-url
```

## How to Add Environment Variables in Render

1. Go to your Render Dashboard
2. Click on your **news-agent-project** service
3. Go to **Environment** tab (in the left sidebar)
4. Click **Add Environment Variable** for each variable above
5. Copy the values from your `.env.local` file
6. **Save** each variable
7. **Redeploy** your service (Render will auto-deploy when you save env vars)

## Quick Checklist

- [ ] `BENZINGA_API_KEY` - Required for news articles
- [ ] `BENZINGA_PR_API_KEY` - Required for press releases
- [ ] `TRELLO_API_KEY` - Required for Trello integration
- [ ] `TRELLO_TOKEN` - Required for Trello integration
- [ ] `TRELLO_LIST_ID_WGO` - Required for WGO cards
- [ ] `APP_URL` - **Critical**: Must be your Render service URL
- [ ] `TRELLO_WGO_CONTROL_CARD_ID` - Required for control card monitoring

## Verify Environment Variables

After adding them, check your Render logs. You should see:
```
✅ Found BENZINGA_API_KEY (length: XX)
✅ Found BENZINGA_PR_API_KEY (length: XX)
✅ Found TRELLO_API_KEY (length: XX)
✅ Found TRELLO_LIST_ID_WGO: 69457f7350ac5fd4b8efcc96
```

If you see warnings like:
```
⚠️  BENZINGA_API_KEY not found
⚠️  TRELLO_LIST_ID_WGO not found
```

Then those variables aren't set correctly in Render.

## Common Issues

1. **APP_URL is localhost**: Make sure `APP_URL` is set to your Render service URL, not `http://localhost:3001`
2. **Missing API keys**: WGO search will return 0 articles if Benzinga keys are missing
3. **Missing Trello credentials**: Cards won't be created if Trello credentials are missing
4. **Wrong list ID**: Cards might be created in the wrong list if `TRELLO_LIST_ID_WGO` is incorrect

