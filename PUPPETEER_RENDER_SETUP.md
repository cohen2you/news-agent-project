# Puppeteer Setup for Render

This project uses Puppeteer (headless Chrome browser) to decode Google News URLs. Puppeteer requires Chrome to be installed on the server.

## Render Buildpack Configuration

Since you are using Render, you must add a Buildpack or Puppeteer will crash.

### Steps to Configure:

1. Go to your Render Dashboard
2. Click on your News Agent Service
3. Go to **Environment** (or **Settings** > **Build & Deploy**)
4. Scroll down to **Buildpacks**
5. Click **Add Buildpack**
6. Enter this URL: `https://github.com/puppeteer/puppeteer-buildpack.git`
7. **Drag it to the top** (above your Node.js buildpack)
8. Save and trigger a new deploy

### Buildpack Order (Important!)

The Puppeteer buildpack must be **first** (at the top), before the Node.js buildpack. This ensures Chrome is installed before Node.js dependencies are installed.

### Alternative: If Using Docker

If you are using Docker instead of Render's standard Node environment, you need to add instructions to your Dockerfile to install Chromium:

```dockerfile
# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    && rm -rf /var/lib/apt/lists/*
```

## Testing

After deploying with the buildpack:

1. Check the Render logs to ensure Puppeteer launches successfully
2. Test the news ingestion service
3. Verify that Google News URLs are being decoded correctly

## Troubleshooting

If you see errors like:
- `Error: Failed to launch the browser process`
- `No usable sandbox!`

Make sure:
1. The Puppeteer buildpack is added and at the top of the buildpack list
2. The buildpack URL is correct: `https://github.com/puppeteer/puppeteer-buildpack.git`
3. You've triggered a new deploy after adding the buildpack

## Local Development

For local development, Puppeteer will automatically download Chromium when you run `npm install`. No additional setup is needed.

