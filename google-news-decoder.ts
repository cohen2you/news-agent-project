/**
 * Google News URL Decoder
 * Decodes Google News Base64-encoded article URLs to get the real source URL
 * 
 * Uses Puppeteer (headless browser) to simulate a real user and follow Google's redirects.
 * This is more reliable than trying to decode the API calls directly.
 */

import puppeteer from 'puppeteer';

/**
 * Decode Google News URL to get the original source URL
 * @param sourceUrl - The Google News URL from the RSS feed
 * @returns The decoded real source URL (e.g., fox6now.com, cnbc.com)
 */
export async function decodeGoogleNewsUrl(sourceUrl: string): Promise<string> {
  // If no URL provided, return as-is
  if (!sourceUrl) {
    return sourceUrl;
  }

  try {
    const url = new URL(sourceUrl);
    
    // Only decode if it's a Google News link
    if (url.hostname.includes('news.google.com')) {
      try {
        console.log(`   🕵️‍♀️ Puppeteer decoding: ${sourceUrl.substring(0, 80)}...`);
        
        const browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Important for Render/Docker environments
            '--single-process' // Helps with resource limits
          ]
        });

        const page = await browser.newPage();
        
        // Block images/css to save bandwidth and speed up
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });

        // Go to the URL and wait for navigation to complete
        await page.goto(sourceUrl, { waitUntil: 'domcontentloaded' });
        
        // Wait a moment for the JS redirect to fire (Google is usually fast)
        try {
          await page.waitForNavigation({ timeout: 5000 }); 
        } catch (e) {
          // Sometimes it redirects instantly before we wait, which is fine
        }

        const finalUrl = page.url();
        await browser.close();

        // If it failed to redirect, return original (caller should check this)
        if (finalUrl.includes('news.google.com')) {
          console.warn(`   ⚠️  Failed to resolve redirect for: ${sourceUrl.substring(0, 80)}...`);
          return sourceUrl; 
        }

        console.log(`   ✅ Resolved to: ${finalUrl.substring(0, 100)}...`);
        return finalUrl;

      } catch (error: any) {
        console.error(`   ❌ Puppeteer Error: ${error.message}`);
        return sourceUrl;
      }
    }
    
    // Not a Google News URL, return as-is
    return sourceUrl;
  } catch (error: any) {
    // If URL parsing fails, return original
    console.log(`   ⚠️  Could not parse URL (${error.message}), using original`);
    return sourceUrl;
  }
}
