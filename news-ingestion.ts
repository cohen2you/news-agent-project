/**
 * News Ingestion Service
 * Fetches news from RSS feeds and routes articles to appropriate Trello lists
 */

import Parser from 'rss-parser';
import { decodeGoogleNewsUrl } from './google-news-decoder';
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
        
        // Decode Google News Base64-encoded URL to get the real source URL
        // This uses Google's internal Batch Execute API to decode the URL
        const articleUrl = await decodeGoogleNewsUrl(googleUrl);
        
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

