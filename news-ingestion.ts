/**
 * News Ingestion Service
 * Fetches news from RSS feeds and routes articles to appropriate Trello lists
 */

import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { determineTargetList } from './trello-list-router';
import { TrelloService } from './trello-service';

// Initialize RSS Parser
const parser = new Parser({
  customFields: {
    item: ['contentSnippet', 'content']
  }
});

// Define RSS Feeds for different content categories
const FEEDS = [
  // Hedge Funds & Institutional Investors
  {
    url: 'https://news.google.com/rss/search?q="Hedge+Fund"+OR+"Bill+Ackman"+OR+"Ray+Dalio"+OR+"Ken+Griffin"+OR+"Citadel"+OR+"Pershing+Square"+OR+"13F"&hl=en-US&gl=US&ceid=US:en',
    name: 'Hedge Funds & Institutional'
  },
  
  // Commodities
  {
    url: 'https://news.google.com/rss/search?q="Oil+Price"+OR+"Gold+Price"+OR+"Natural+Gas"+OR+"Commodities"+OR+"Crude+Oil"+OR+"WTI"+OR+"Brent"&hl=en-US&gl=US&ceid=US:en',
    name: 'Commodities'
  },
  
  // Economy
  {
    url: 'https://news.google.com/rss/search?q="Inflation"+OR+"CPI"+OR+"Fed+Rate"+OR+"GDP"+OR+"Recession"+OR+"FOMC"+OR+"Federal+Reserve"&hl=en-US&gl=US&ceid=US:en',
    name: 'Economy'
  },
  
  // Broad Markets
  {
    url: 'https://news.google.com/rss/search?q="Stock+Market"+OR+"S%26P+500"+OR+"Nasdaq"+OR+"Dow+Jones"+OR+"Wall+Street"&hl=en-US&gl=US&ceid=US:en',
    name: 'Markets'
  }
];

// Track processed article URLs to avoid duplicates
const processedArticleUrls = new Set<string>();
const MAX_PROCESSED_URLS = 10000; // Limit to prevent memory issues

/**
 * Decode Google News redirect URL to get the original source URL
 * Google News "cloaks" the real URL inside a redirection link to track clicks.
 * This function fetches the redirect page and extracts the real destination URL.
 */
async function getOriginalUrl(googleUrl: string): Promise<string> {
  // If it's not a Google News URL, return as-is
  if (!googleUrl || !googleUrl.includes('news.google.com')) {
    return googleUrl;
  }

  try {
    console.log(`   🔍 Decoding Google News URL: ${googleUrl.substring(0, 80)}...`);
    
    // Google News links are redirects. We fetch the page to find the real target.
    // Don't follow redirects automatically - we want to parse the redirect page HTML
    const response = await axios.get(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      maxRedirects: 0, // Don't follow redirects - we want to parse the redirect page
      validateStatus: (status) => status >= 200 && status < 400, // Accept 2xx and 3xx
      timeout: 10000 // 10 second timeout
    });
    
    // Load the HTML
    const $ = cheerio.load(response.data);
    
    // 2025 Method: The real URL is often hidden in a "jsname" attribute or distinct <a> tag
    // Try multiple selectors to find the real URL (in order of reliability)
    let realUrl = $('a[jsname="tljFtd"]').attr('href')     // Common selector for main article link
                 || $('a[jsname="yRWgLc"]').attr('href')    // Alternative selector
                 || $('a[jsname="UCw6bd"]').attr('href')    // Another common selector
                 || $('noscript a').attr('href')            // Fallback for non-JS
                 || $('article a[href^="http"]').first().attr('href') // Article link
                 || $('a[href^="http"]').not('[href*="google.com"]').first().attr('href'); // First external link (not Google)
    
    // If we found a URL, clean it up
    if (realUrl) {
      // Handle relative URLs
      if (realUrl.startsWith('/')) {
        realUrl = `https://news.google.com${realUrl}`;
      }
      
      // Remove Google tracking parameters if present
      try {
        const urlObj = new URL(realUrl);
        // Clean up the URL - remove Google tracking params
        const cleanUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
        console.log(`   ✅ Decoded to: ${cleanUrl.substring(0, 100)}...`);
        return cleanUrl;
      } catch {
        // If URL parsing fails, return as-is
        console.log(`   ✅ Decoded to: ${realUrl.substring(0, 100)}...`);
        return realUrl;
      }
    }
    
    // If no URL found, return original
    console.log(`   ⚠️  Could not decode URL from HTML, using original`);
    return googleUrl;
  } catch (err: any) {
    // If fetch fails, return original URL
    if (err.response && err.response.status >= 300 && err.response.status < 400) {
      // If we got a redirect response, try to extract the Location header
      const location = err.response.headers?.location;
      if (location) {
        console.log(`   ✅ Found redirect location: ${location.substring(0, 100)}...`);
        // Handle relative redirects
        if (location.startsWith('/')) {
          return `https://news.google.com${location}`;
        }
        return location;
      }
    }
    console.log(`   ⚠️  Could not resolve URL (${err.message}), using original`);
    return googleUrl;
  }
}

/**
 * Check if an article URL has already been processed
 */
function isAlreadyProcessed(url: string): boolean {
  return processedArticleUrls.has(url);
}

/**
 * Mark an article URL as processed
 */
function markAsProcessed(url: string): void {
  processedArticleUrls.add(url);
  
  // Limit size to prevent memory leaks
  if (processedArticleUrls.size > MAX_PROCESSED_URLS) {
    const firstUrl = processedArticleUrls.values().next().value;
    if (firstUrl) {
      processedArticleUrls.delete(firstUrl);
    }
  }
}

/**
 * Main function to fetch and route news articles
 */
export async function runNewsCycle(): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📡 [News Ingestion] Starting news cycle scan...`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log(`   Feeds to check: ${FEEDS.length}`);
  console.log(`${"=".repeat(60)}\n`);

  const trello = new TrelloService();
  let totalProcessed = 0;
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const feed of FEEDS) {
    try {
      console.log(`\n📰 Processing feed: ${feed.name}`);
      console.log(`   URL: ${feed.url.substring(0, 80)}...`);
      
      const feedData = await parser.parseURL(feed.url);
      const items = feedData.items || [];
      
      console.log(`   ✅ Found ${items.length} article(s) in feed`);
      
      // Process top 5 newest items per feed to avoid spamming
      const latestItems = items.slice(0, 5);
      
      for (const item of latestItems) {
        totalProcessed++;
        
        const googleUrl = item.link || item.guid || '';
        const title = item.title || 'Untitled Article';
        // Use contentSnippet (provided by RSS parser) or fallback to empty string
        const content = item.contentSnippet || '';
        
        // Skip if no URL (can't track duplicates)
        if (!googleUrl) {
          console.log(`   ⚠️  Skipping article without URL: "${title.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Decode Google News redirect URL to get the real source URL
        const articleUrl = await getOriginalUrl(googleUrl);
        
        // Check if already processed (use original URL for deduplication)
        if (isAlreadyProcessed(articleUrl)) {
          console.log(`   ⏭️  Already processed: "${title.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Determine target list using router
        const targetListId = determineTargetList(title, content, 'BUSINESS');
        
        if (!targetListId) {
          console.log(`   ⚠️  No valid list ID found for: "${title.substring(0, 50)}..."`);
          markAsProcessed(articleUrl); // Mark as processed even if no list found
          totalSkipped++;
          continue;
        }
        
        try {
          // Create Trello card with full URL prominently displayed (use decoded original URL)
          const baseUrl = process.env.APP_URL || 'http://localhost:3001';
          
          // Build card description with URL prominently displayed
          let cardDescription = `**Source URL:** ${articleUrl}\n\n`;
          if (content) {
            cardDescription += `${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}\n\n`;
          }
          
          // Create card first
          const card = await trello.createCard(
            targetListId,
            title,
            cardDescription
          );
          
          // Now add Generate Article button with actual card ID
          if (card && card.id) {
            const generateArticleUrl = `${baseUrl}/trello/generate-article/${card.id}?selectedApp=story`;
            cardDescription += `---\n\n**[Generate Article](${generateArticleUrl})**`;
            await trello.updateCardDescription(card.id, cardDescription);
          }
          
          console.log(`   ✅ Created card: "${title.substring(0, 50)}..."`);
          console.log(`      → List ID: ${targetListId}`);
          console.log(`      → Card URL: ${card.url}`);
          console.log(`      → Source URL: ${articleUrl}`);
          
          markAsProcessed(articleUrl); // Track using decoded URL
          totalCreated++;
          
          // Small delay to avoid rate limiting (especially important with URL decoding)
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error: any) {
          console.error(`   ❌ Error creating card for "${title.substring(0, 50)}...":`, error.message);
          // Don't mark as processed if creation failed - allow retry
        }
      }
      
    } catch (error: any) {
      console.error(`   ❌ Error processing feed "${feed.name}":`, error.message);
      // Continue with next feed even if one fails
    }
  }
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 [News Ingestion] Cycle Complete`);
  console.log(`   Total processed: ${totalProcessed}`);
  console.log(`   Cards created: ${totalCreated}`);
  console.log(`   Skipped (duplicates/errors): ${totalSkipped}`);
  console.log(`${"=".repeat(60)}\n`);
}

