# Update Your .env.local File

Since your AI Agent is running on port 3001, update your `.env.local` file to use port 3002 for the WGO app:

```env
# Benzinga API
BENZINGA_API_KEY=your_benzinga_api_key_here

# Default Article Generator (Comprehensive - running on 3000)
ARTICLE_GEN_TYPE=http
ARTICLE_GEN_API_URL=http://localhost:3000/api/generate/comprehensive-article

# WGO Article Generator (wiim-project-v2 - should run on 3002)
ARTICLE_GEN_APP_WGO_TYPE=http
ARTICLE_GEN_APP_WGO_URL=http://localhost:3002/api/generate/wgo
```

## To Run Your WGO App on Port 3002

When you start your `wiim-project-v2` app, specify the port:

```powershell
cd C:\Users\Mike\Documents\wiim-project-v2
$env:PORT=3002; npm run dev
```

Or create a `.env.local` file in the `wiim-project-v2` directory with:
```
PORT=3002
```

## Current Port Setup

- **Port 3000**: Comprehensive Article Generator (news-story-generator)
- **Port 3001**: AI Agent (news-agent-project) 
- **Port 3002**: WGO Article Generator (wiim-project-v2) ← Use this port





