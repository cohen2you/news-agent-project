# Fix Puppeteer on Render - Chrome Not Found Error

## The Problem

You're seeing this error:
```
❌ Puppeteer Error: Could not find Chrome (ver. 143.0.7499.169)
```

This means Chrome is not installed on your Render instance.

## Solution 1: Add Puppeteer Buildpack (Recommended)

This is the **required** step to make Puppeteer work on Render:

1. Go to your Render Dashboard
2. Click on your **News Agent Service**
3. Go to **Environment** (or **Settings** → **Build & Deploy**)
4. Scroll down to **Buildpacks**
5. Click **Add Buildpack**
6. Enter this URL: `https://github.com/puppeteer/puppeteer-buildpack.git`
7. **Drag it to the TOP** (must be above Node.js buildpack)
8. **Save** and trigger a **new deploy**

The buildpack order should look like this:
```
1. https://github.com/puppeteer/puppeteer-buildpack.git (TOP)
2. heroku/nodejs (or similar Node.js buildpack)
```

## Solution 2: Alternative - Use System Chrome Path

If the buildpack doesn't work, you can try setting the Chrome path manually:

1. In Render Dashboard → Your Service → Environment
2. Add a new environment variable:
   - **Key**: `PUPPETEER_EXECUTABLE_PATH`
   - **Value**: `/usr/bin/google-chrome` (or `/usr/bin/chromium-browser`)

Then redeploy.

## Solution 3: Temporary Workaround - Skip URL Decoding

If you need cards to be created immediately while you fix Puppeteer, you can temporarily disable URL decoding by using the Google News URL directly. However, **this is not recommended** as it can cause the AI to hallucinate stories from Google's redirect pages.

## Verify the Fix

After adding the buildpack and redeploying:

1. Check Render logs for Puppeteer errors
2. You should see `✅ Resolved to: [real URL]` instead of `❌ Puppeteer Error`
3. Cards should start appearing in your Trello lists

## Why This Happens

Puppeteer needs Chrome/Chromium to be installed on the server. On Render, Chrome is not installed by default. The Puppeteer buildpack automatically installs Chrome during the build process, making it available to Puppeteer at runtime.

