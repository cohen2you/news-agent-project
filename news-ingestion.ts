/**
 * News Ingestion Service
 * Fetches news from RSS feeds and routes articles to appropriate Trello lists
 */

import Parser from 'rss-parser';
import { determineTargetList } from './trello-list-router';
import { TrelloService } from './trello-service';

// Initialize RSS Parser
const parser = new Parser({
  customFields: {
    item: ['contentSnippet', 'content']
  }
});

// Define RSS Feeds for different content categories
// Using Google News RSS - users will manually click the link and paste the real source URL
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
        
        // Google News link (user will click this and paste the real source URL)
        const googleNewsUrl = item.link || item.guid || '';
        const title = item.title || 'Untitled Article';
        // Use contentSnippet (provided by RSS parser) or fallback to empty string
        const content = item.contentSnippet || '';
        
        // Skip if no URL (can't track duplicates)
        if (!googleNewsUrl) {
          console.log(`   ⚠️  Skipping article without URL: "${title.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Check if already processed (using Google News URL for duplicate tracking)
        if (isAlreadyProcessed(googleNewsUrl)) {
          console.log(`   ⏭️  Already processed: "${title.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Determine target list using router
        console.log(`   🔍 Determining target list for: "${title.substring(0, 60)}..."`);
        const targetListId = determineTargetList(title, content, 'BUSINESS');
        
        if (!targetListId) {
          console.log(`   ⚠️  No valid list ID found for: "${title.substring(0, 50)}..."`);
          console.log(`   ⚠️  Check that TRELLO_LIST_ID_MARKETS, TRELLO_LIST_ID_ECONOMY, TRELLO_LIST_ID_COMMODITIES, and TRELLO_LIST_ID_HEDGE_FUNDS are set in environment variables`);
          markAsProcessed(googleNewsUrl); // Mark as processed even if no list found
          totalSkipped++;
          continue;
        }
        
        console.log(`   ✅ Target list determined: ${targetListId}`);
        
        try {
          // Create Trello card with Google News link
          // User will click the link, get redirected to the real source, and paste the source URL below
          const baseUrl = process.env.APP_URL || 'http://localhost:3001';
          
          // Build card description with Generate Article button at the top
          // First create card to get the card ID, then build full description
          const tempCard = await trello.createCard(
            targetListId,
            title,
            '' // Create with empty description first to get card ID
          );
          
          // Build full description with Generate Article button at the top
          if (tempCard && tempCard.id) {
            const generateArticleUrl = `${baseUrl}/trello/generate-article/${tempCard.id}?selectedApp=story`;
            let cardDescription = `**[Generate Article](${generateArticleUrl})**\n\n`;
            cardDescription += `---\n\n`;
            cardDescription += `**Google News Link:** [${googleNewsUrl}](${googleNewsUrl})\n\n`;
            cardDescription += `**Instructions:**\n`;
            cardDescription += `1. Click the Google News link above\n`;
            cardDescription += `2. Copy the real source URL (e.g., cnbc.com, reuters.com, etc.)\n`;
            cardDescription += `3. Paste it in the "Source URL" field below\n`;
            cardDescription += `4. (Optional) If scraping fails, paste the article text in the "Article Text" field\n\n`;
            cardDescription += `**Source URL:** \n\n`;
            cardDescription += `**Article Text:**\n\n`;
            cardDescription += `*(Paste article text here if scraping fails)*\n\n`;
            if (content) {
              cardDescription += `---\n\n**Article Summary:**\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}\n\n`;
            }
            
            // Update card with full description
            await trello.updateCardDescription(tempCard.id, cardDescription);
            
            console.log(`   ✅ Created card: "${title.substring(0, 50)}..."`);
            console.log(`      → List ID: ${targetListId}`);
            console.log(`      → Card URL: ${tempCard.url}`);
            console.log(`      → Google News URL: ${googleNewsUrl}`);
            
            markAsProcessed(googleNewsUrl);
            totalCreated++;
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            
            continue; // Skip to next item
          }
          
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

