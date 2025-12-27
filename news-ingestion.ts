/**
 * News Ingestion Service
 * Ultimate feed system: 20 sources covering Markets, Economy, Commodities, Tech & AI, Hedge Funds
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

// --- THE WORKING FEED LIST (Cleaned of Blocks & Broken Feeds) ---
const FEEDS = [
  // 1. MARKETS (Reliable & Fast)
  { name: "CNBC Markets", url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
  { name: "Business Insider", url: 'https://markets.businessinsider.com/rss/news' },
  { name: "Yahoo Finance Top", url: 'https://finance.yahoo.com/news/rssindex' },
  { name: "Fortune Finance", url: 'https://fortune.com/feed/finance' },

  // 2. ECONOMY & MACRO
  { name: "CNBC Economy", url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
  { name: "MarketWatch Top Stories", url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },

  // 3. COMMODITIES (Replaced Kitco with reliable alternatives)
  { name: "Investing.com Commodities", url: 'https://www.investing.com/rss/commodities.rss' },
  { name: "OilPrice.com", url: 'https://oilprice.com/rss/main' },

  // 4. TECH, AI & CRYPTO (Working perfectly based on logs)
  { name: "TechCrunch", url: 'https://techcrunch.com/feed/' },
  { name: "The Verge", url: 'https://www.theverge.com/rss/index.xml' },

  // 5. HEDGE FUNDS (The New "Rescue" List - Replaces blocked Bing & broken Opalesque)
  // ValueWalk: Excellent for value investing & hedge fund letters
  { name: "ValueWalk", url: 'https://www.valuewalk.com/feed/' },
  // Insider Monkey: Tracks 13F filings and insider buying
  { name: "Insider Monkey", url: 'https://www.insidermonkey.com/blog/feed/' },
  // Dealbreaker: Wall St culture and hedge fund gossip
  { name: "Dealbreaker", url: 'https://dealbreaker.com/.rss/full/' }
];

// Define List IDs (From your .env)
const LIST_IDS = {
  MARKETS: process.env.TRELLO_LIST_ID_MARKETS || '',
  ECONOMY: process.env.TRELLO_LIST_ID_ECONOMY || '',
  COMMODITIES: process.env.TRELLO_LIST_ID_COMMODITIES || '',
  HEDGE_FUNDS: process.env.TRELLO_LIST_ID_HEDGE_FUNDS || '',
  TECH: process.env.TRELLO_LIST_ID_TECH || process.env.TRELLO_LIST_ID_MARKETS || '',
  DEFAULT: process.env.TRELLO_LIST_ID || ''
};

// --- HELPER: FORMAT DATE ---
function formatPubDate(isoDateString?: string): string {
  if (!isoDateString) return "[New]"; // Fallback if no date provided

  const date = new Date(isoDateString);
  
  // Format: "Dec 27 2:30 PM" in EST/EDT (America/New_York timezone)
  // Using toLocaleString with timezone option to handle EST/EDT automatically
  const month = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    month: 'short' 
  });
  const day = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    day: 'numeric' 
  });
  const hour = parseInt(date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false 
  }));
  const minute = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    minute: '2-digit' 
  });
  const ampm = date.toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: true 
  }).split(' ')[1]; // Extract "AM" or "PM"
  
  // Convert 24-hour to 12-hour format
  let hour12 = hour % 12;
  hour12 = hour12 ? hour12 : 12; // the hour '0' should be '12'
  const minutePadded = minute.padStart(2, '0');

  return `[${month} ${day} ${hour12}:${minutePadded} ${ampm}]`;
}

// Smart Router Logic
function routeArticle(feedName: string, title: string, snippet: string): string {
  const text = (title + " " + snippet).toLowerCase();
  
  // A. Feed Name Overrides (Fastest Sorting)
  if (feedName.includes("Economy")) return LIST_IDS.ECONOMY;
  if (feedName.includes("Commodities") || feedName.includes("Oil")) return LIST_IDS.COMMODITIES;
  if (feedName.includes("Tech") || feedName.includes("Verge")) return LIST_IDS.TECH;
  
  // Route the new Hedge Fund feeds directly
  if (feedName.includes("ValueWalk") || feedName.includes("Insider Monkey") || feedName.includes("Dealbreaker")) {
    return LIST_IDS.HEDGE_FUNDS;
  }

  // B. Specific Personality Routing
  
  // Hedge Funds & Investor Icons (Includes Buffett/Berkshire now)
  if (text.match(/ackman|dalio|griffin|tepper|icahn|druckenmiller|buffett|berkshire|munger|pershing square|bridgewater|citadel|13f/)) {
    return LIST_IDS.HEDGE_FUNDS;
  }

  // Macro / Economy
  if (text.match(/el-erian|larry summers|powell|yellen|lagarde|gdp|cpi|pce|jobs|unemployment/)) {
    return LIST_IDS.ECONOMY;
  }

  // Tech / AI
  if (text.match(/nvidia|openai|altman|musk|crypto|bitcoin|apple|microsoft|google|meta|tsmc/)) {
    return LIST_IDS.TECH;
  }

  // C. Fallback Keyword Routing
  if (text.match(/oil|gold|silver|copper|gas|crude/)) return LIST_IDS.COMMODITIES;
  if (text.match(/rate|recession|inflation|yield/)) return LIST_IDS.ECONOMY;
  
  // Default: EVERYTHING else (Earnings, S&P 500 movements, Analyst Upgrades) goes to Markets
  return LIST_IDS.MARKETS;
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
  const processedTitles = new Set<string>();

  for (const feed of FEEDS) {
    try {
      console.log(`\n📰 Processing feed: ${feed.name}`);
      console.log(`   URL: ${feed.url.substring(0, 80)}...`);
      
      // Fetch with "Stealth" Browser Headers to avoid blocks
      const response = await axios.get(feed.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 8000,
        maxRedirects: 5
      });

      // Log response status for debugging
      if (response.status !== 200) {
        console.log(`   ⚠️  Feed returned status ${response.status}`);
      }

      // Check if response looks like RSS/XML
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('xml') && !contentType.includes('rss')) {
        console.log(`   ⚠️  Unexpected content type: ${contentType}`);
      }

      const feedData = await parser.parseString(response.data);
      const items = feedData.items || [];
      
      if (items.length === 0) {
        console.log(`   ⚠️  Feed parsed successfully but returned 0 items (feed name: ${feedData.title || 'N/A'})`);
      } else {
        console.log(`   ✅ Found ${items.length} article(s) in feed`);
      }
      
      // Only grab top 2 items per feed to avoid spamming the board
      const latestItems = items.slice(0, 2);
      
      for (const item of latestItems) {
        totalProcessed++;
        
        const cleanUrl = item.link || item.guid || '';
        const originalTitle = item.title || 'Untitled Article';
        const content = item.contentSnippet || item.content || '';
        
        // Skip if no URL or title
        if (!cleanUrl || !originalTitle) {
          console.log(`   ⚠️  Skipping article without URL or title`);
          totalSkipped++;
          continue;
        }
        
        // Format the date and prepend to title
        const datePrefix = formatPubDate(item.pubDate || item.isoDate);
        const title = `${datePrefix} ${originalTitle}`;
        
        // Check if already processed (by original title to avoid duplicates from different feeds)
        if (processedTitles.has(originalTitle)) {
          console.log(`   ⏭️  Already processed (duplicate title): "${originalTitle.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Also check URL for duplicates
        if (isAlreadyProcessed(cleanUrl)) {
          console.log(`   ⏭️  Already processed (duplicate URL): "${originalTitle.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Route based on Feed Name AND Content (use original title for routing)
        const targetListId = routeArticle(feed.name, originalTitle, content);
        
        if (!targetListId) {
          console.log(`   ⚠️  No valid list ID found for: "${originalTitle.substring(0, 50)}..."`);
          console.log(`   ⚠️  Check that TRELLO_LIST_ID_MARKETS, TRELLO_LIST_ID_ECONOMY, TRELLO_LIST_ID_COMMODITIES, TRELLO_LIST_ID_HEDGE_FUNDS, and TRELLO_LIST_ID_TECH are set in environment variables`);
          processedTitles.add(originalTitle);
          markAsProcessed(cleanUrl);
          totalSkipped++;
          continue;
        }
        
        // Logging destination for clarity
        let listName = "UNKNOWN";
        if (targetListId === LIST_IDS.HEDGE_FUNDS) listName = "HEDGE FUNDS";
        else if (targetListId === LIST_IDS.MARKETS) listName = "MARKETS";
        else if (targetListId === LIST_IDS.TECH) listName = "TECH";
        else if (targetListId === LIST_IDS.ECONOMY) listName = "ECONOMY";
        else if (targetListId === LIST_IDS.COMMODITIES) listName = "COMMODITIES";
        
        console.log(`   ✅ Target list determined: ${targetListId} [${listName}]`);
        console.log(`   ➡️  [${feed.name}] -> [${listName}] ${title.substring(0, 60)}...`);
        
        try {
          // Create Trello card with Process for AI button at the top (like WGO/PR cards)
          const baseUrl = process.env.APP_URL || 'http://localhost:3001';
          
          // First create card to get the card ID, then build full description
          // Use the formatted title with date prefix
          const tempCard = await trello.createCard(
            targetListId,
            title, // Title includes date prefix: "[Dec 27 2:30 PM] Original Title"
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
            console.log(`      → List ID: ${targetListId} [${listName}]`);
            console.log(`      → Card URL: ${tempCard.url}`);
            console.log(`      → Source URL: ${cleanUrl}`);
            
            processedTitles.add(originalTitle); // Track by original title (without date prefix)
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
      if (error.response) {
        console.error(`      Status: ${error.response.status}, StatusText: ${error.response.statusText}`);
      }
      if (error.code) {
        console.error(`      Error code: ${error.code}`);
      }
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
