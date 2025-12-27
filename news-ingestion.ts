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

// --- THE ULTIMATE FEED LIST (20 Sources) ---
const FEEDS = [
  // 1. MARKETS (Broad Coverage)
  { name: "CNBC Markets", url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
  { name: "Business Insider", url: 'https://markets.businessinsider.com/rss/news' },
  { name: "Yahoo Finance Top", url: 'https://finance.yahoo.com/news/rssindex' },
  { name: "Seeking Alpha Market News", url: 'https://seekingalpha.com/market_news/feed' },

  // 2. ECONOMY & MACRO
  { name: "CNBC Economy", url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
  { name: "MarketWatch Top Stories", url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { name: "Bing: Fed & Rates", url: 'https://www.bing.com/news/search?q="Jerome+Powell"+OR+"Fed+Rate"+OR+"CPI"+OR+"Inflation"+OR+"Recession"&format=rss' },

  // 3. COMMODITIES
  { name: "Investing.com Commodities", url: 'https://www.investing.com/rss/commodities.rss' },
  { name: "OilPrice.com", url: 'https://oilprice.com/rss/main' },
  { name: "Kitco Gold", url: 'https://www.kitco.com/rss/category/news' },

  // 4. TECH, AI & CRYPTO
  { name: "TechCrunch", url: 'https://techcrunch.com/feed/' },
  { name: "The Verge", url: 'https://www.theverge.com/rss/index.xml' },
  { name: "Bing: AI & Chips", url: 'https://www.bing.com/news/search?q="Nvidia"+OR+"OpenAI"+OR+"Sam+Altman"+OR+"TSMC"+OR+"Artificial+Intelligence"&format=rss' },

  // 5. HEDGE FUNDS & INVESTOR TITANS
  // Tracks: Ackman, Dalio, Griffin, Tepper, Icahn, Druckenmiller... AND BUFFETT
  { name: "Bing: Investor Titans", url: 'https://www.bing.com/news/search?q="Bill+Ackman"+OR+"Ray+Dalio"+OR+"Ken+Griffin"+OR+"Carl+Icahn"+OR+"Warren+Buffett"+OR+"Berkshire+Hathaway"&format=rss' },
  { name: "Opalesque", url: 'https://www.opalesque.com/rss' },

  // 6. MARKET MOVERS (CEOs/Personalities)
  // Tracks: Musk, Dimon, Cathie Wood
  { name: "Bing: CEOs", url: 'https://www.bing.com/news/search?q="Elon+Musk"+OR+"Jamie+Dimon"+OR+"Cathie+Wood"+OR+"Michael+Burry"&format=rss' }
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
  
  // Format: "Dec 27 2:30 PM"
  // Note: On Render server, this will likely be UTC. 
  // If you want strict EST, you can subtract 5 hours or use specific timezone logic.
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  let hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, '0');
  const ampm = hour >= 12 ? 'PM' : 'AM';
  
  hour = hour % 12;
  hour = hour ? hour : 12; // the hour '0' should be '12'

  return `[${month} ${day} ${hour}:${minute} ${ampm}]`;
}

// Smart Router Logic
function routeArticle(feedName: string, title: string, snippet: string): string {
  const text = (title + " " + snippet).toLowerCase();
  
  // A. Feed Name Overrides
  if (feedName.includes("Economy")) return LIST_IDS.ECONOMY;
  if (feedName.includes("Commodities") || feedName.includes("Oil") || feedName.includes("Gold")) return LIST_IDS.COMMODITIES;
  if (feedName.includes("Tech") || feedName.includes("AI")) return LIST_IDS.TECH;
  
  // Send Investor Titans feed straight to Hedge Funds
  if (feedName.includes("Investor Titans") || feedName.includes("Hedge Fund")) return LIST_IDS.HEDGE_FUNDS;

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
        
        const cleanUrl = item.link || item.guid || '';
        const title = item.title || 'Untitled Article';
        const content = item.contentSnippet || item.content || '';
        
        // Skip if no URL or title
        if (!cleanUrl || !title) {
          console.log(`   ⚠️  Skipping article without URL or title`);
          totalSkipped++;
          continue;
        }
        
        // Check if already processed (by title to avoid duplicates from different feeds)
        if (processedTitles.has(title)) {
          console.log(`   ⏭️  Already processed (duplicate title): "${title.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Also check URL for duplicates
        if (isAlreadyProcessed(cleanUrl)) {
          console.log(`   ⏭️  Already processed (duplicate URL): "${title.substring(0, 50)}..."`);
          totalSkipped++;
          continue;
        }
        
        // Route based on Feed Name AND Content
        const targetListId = routeArticle(feed.name, title, content);
        
        if (!targetListId) {
          console.log(`   ⚠️  No valid list ID found for: "${title.substring(0, 50)}..."`);
          console.log(`   ⚠️  Check that TRELLO_LIST_ID_MARKETS, TRELLO_LIST_ID_ECONOMY, TRELLO_LIST_ID_COMMODITIES, TRELLO_LIST_ID_HEDGE_FUNDS, and TRELLO_LIST_ID_TECH are set in environment variables`);
          processedTitles.add(title);
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
