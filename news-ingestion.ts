/**
 * News Ingestion Service
 * Hybrid feed system: Reliable direct feeds (CNBC, Investing.com, Yahoo) + Search feeds (Bing)
 */

import Parser from 'rss-parser';
import axios from 'axios';
import { TrelloService } from './trello-service';

// Initialize RSS Parser
const parser = new Parser({
  customFields: {
    item: ['contentSnippet', 'content']
  }
});

// THE HYBRID FEED LIST
// We use CNBC/Investing.com for reliability (direct links) and Bing for specific keyword searches.
const FEEDS = [
  // --- RELIABLE DIRECT FEEDS (Clean Links, No Blocking) ---
  { 
    name: "CNBC Markets", 
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' 
  },
  { 
    name: "CNBC Economy", 
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' 
  },
  { 
    name: "Investing.com Commodities", 
    url: 'https://www.investing.com/rss/commodities.rss' 
  },
  { 
    name: "Yahoo Finance Top", 
    url: 'https://finance.yahoo.com/news/rssindex' 
  },

  // --- SEARCH FEEDS (Good for specific niches, but might block occasionally) ---
  { 
    name: "Bing: Hedge Funds", 
    url: 'https://www.bing.com/news/search?q=Hedge+Fund+OR+Bill+Ackman+OR+Ray+Dalio+OR+Ken+Griffin+OR+Citadel&format=rss' 
  }
];

// Define List IDs (From your .env)
const LIST_IDS = {
  MARKETS: process.env.TRELLO_LIST_ID_MARKETS || '',
  ECONOMY: process.env.TRELLO_LIST_ID_ECONOMY || '',
  COMMODITIES: process.env.TRELLO_LIST_ID_COMMODITIES || '',
  HEDGE_FUNDS: process.env.TRELLO_LIST_ID_HEDGE_FUNDS || '',
  DEFAULT: process.env.TRELLO_LIST_ID || '' 
};

// Smart Router Logic
function routeArticle(feedName: string, title: string, snippet: string): string {
  const text = (title + " " + snippet).toLowerCase();
  
  // A. Source-Based Routing (If it comes from the "Economy" feed, send it there!)
  if (feedName.includes("Economy")) return LIST_IDS.ECONOMY;
  if (feedName.includes("Commodities")) return LIST_IDS.COMMODITIES;
  if (feedName.includes("Hedge Funds")) return LIST_IDS.HEDGE_FUNDS;
  if (feedName.includes("Markets")) return LIST_IDS.MARKETS;

  // B. Content-Based Routing (Fallback for general feeds like Yahoo)
  if (text.match(/hedge fund|ackman|dalio|griffin|citadel|13f/)) return LIST_IDS.HEDGE_FUNDS;
  if (text.match(/oil|gold|silver|copper|wheat|gas|crude/)) return LIST_IDS.COMMODITIES;
  if (text.match(/inflation|cpi|fed|powell|gdp|rates|recession/)) return LIST_IDS.ECONOMY;
  if (text.match(/s&p|nasdaq|dow|stocks|market|rally|selloff/)) return LIST_IDS.MARKETS;

  return LIST_IDS.DEFAULT || LIST_IDS.MARKETS;
}

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
      
      // Fetch with "Stealth" Browser Headers to avoid blocks
      const response = await axios.get(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 8000
      });

      const feedData = await parser.parseString(response.data);
      const items = feedData.items || [];
      
      console.log(`   ✅ Found ${items.length} article(s) in feed`);
      
      // Only grab top 2 items per feed to avoid spamming the board
      const latestItems = items.slice(0, 2);
      
      for (const item of latestItems) {
        totalProcessed++;
        
        // Direct feeds provide clean URLs - no decoding needed!
        const cleanUrl = item.link || item.guid || '';
        const title = item.title || 'Untitled Article';
        const content = item.contentSnippet || item.content || '';
        
        // Skip if no URL (can't track duplicates)
        if (!cleanUrl) {
          console.log(`   ⚠️  Skipping article without URL: "${title.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Check if already processed
        if (isAlreadyProcessed(cleanUrl)) {
          console.log(`   ⏭️  Already processed: "${title.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Route based on Feed Name AND Content
        const targetListId = routeArticle(feed.name, title, content);
        
        if (!targetListId) {
          console.log(`   ⚠️  No valid list ID found for: "${title.substring(0, 50)}..."`);
          console.log(`   ⚠️  Check that TRELLO_LIST_ID_MARKETS, TRELLO_LIST_ID_ECONOMY, TRELLO_LIST_ID_COMMODITIES, and TRELLO_LIST_ID_HEDGE_FUNDS are set in environment variables`);
          markAsProcessed(cleanUrl); // Mark as processed even if no list found
          totalSkipped++;
          continue;
        }
        
        console.log(`   ✅ Target list determined: ${targetListId}`);
        console.log(`   ➡️  [${feed.name}] -> ${title.substring(0, 60)}...`);
        
        try {
          // Create Trello card with Process for AI button at the top (like WGO/PR cards)
          const baseUrl = process.env.APP_URL || 'http://localhost:3001';
          
          // First create card to get the card ID, then build full description
          const tempCard = await trello.createCard(
            targetListId,
            title,
            '' // Create with empty description first to get card ID
          );
          
          // Build full description with Process for AI button at the top
          if (tempCard && tempCard.id) {
            const processForAIUrl = `${baseUrl}/trello/process-card/${tempCard.id}`;
            let cardDescription = `**[Process For AI](${processForAIUrl})**\n\n`;
            cardDescription += `---\n\n`;
            cardDescription += `**Source URL:** ${cleanUrl}\n\n`;
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
            console.log(`      → Source URL: ${cleanUrl}`);
            
            markAsProcessed(cleanUrl);
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
      console.error(`   ❌ Failed to fetch "${feed.name}": ${error.message}`);
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
