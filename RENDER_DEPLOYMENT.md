# Render Deployment Guide

## Quick Setup

1. **In Render Dashboard - Service Settings:**
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Node Version:** 22.16.0 (or 18+)

2. **Environment Variables to Add:**
   Add all variables from your `.env.local` file:
   - `BENZINGA_API_KEY`
   - `BENZINGA_PR_API_KEY`
   - `TRELLO_API_KEY`
   - `TRELLO_TOKEN`
   - `TRELLO_LIST_ID`, `TRELLO_LIST_ID_PR`, `TRELLO_LIST_ID_WGO`, etc.
   - `ARTICLE_GEN_APP_WGO_URL` and other article generator URLs
   - `EMAIL_CHECK_INTERVAL` (if using email agent)
   - `APP_URL` (should be your Render app URL: `https://your-app-name.onrender.com`)
   - Any other variables from `.env.local`

## Build Process

The deployment process:
1. Runs `npm install` to install all dependencies
2. Runs `npm run build` to compile TypeScript to JavaScript (outputs to `dist/`)
3. Copies `index.html` to `dist/` folder
4. Runs `npm start` which executes `node dist/server.js`

## Troubleshooting

### If render.yaml is not detected:
Manually set the build and start commands in Render Dashboard:
- Go to your service → Settings
- Set **Build Command:** `npm install && npm run build`
- Set **Start Command:** `npm start`

### Common Issues:

**Error: "Unknown file extension .ts"**
- This means Render is trying to run TypeScript directly
- Solution: Ensure Build Command includes `npm run build` and Start Command is `npm start`

**Error: "Cannot find module dist/server.js"**
- Build didn't complete successfully
- Check build logs for TypeScript compilation errors

**Error: "Cannot find index.html"**
- The postbuild script should copy it automatically
- Verify `index.html` exists in project root

## Verification

After deployment, check:
- Build logs show "Build successful"
- Start logs show server listening on port
- App URL loads the dashboard

