import Parser from 'rss-parser';
import axios from 'axios';

const parser = new Parser();

// --- THE WORKING FEED LIST (No Dead Feeds) ---
const FEEDS = [
  // 1. MARKETS (Reliable & Fast)
  { name: "CNBC Markets", url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664' },
  { name: "Business Insider", url: 'https://markets.businessinsider.com/rss/news' },
  { name: "Yahoo Finance Top", url: 'https://finance.yahoo.com/news/rssindex' },
  { name: "Fortune Finance", url: 'https://fortune.com/feed/finance' },

  // 2. ECONOMY & MACRO (Replaced Zombie CNN with NYT & Yahoo Economy)
  { name: "CNBC Economy", url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258' },
  { name: "NY Times Economy", url: 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml' },
  { name: "Yahoo Finance Economy", url: 'https://finance.yahoo.com/news/rss/economy' },

  // 3. COMMODITIES
  { name: "Investing.com Commodities", url: 'https://www.investing.com/rss/commodities.rss' },
  { name: "OilPrice.com", url: 'https://oilprice.com/rss/main' },
  
  // 4. TECH, AI & CRYPTO
  { name: "TechCrunch", url: 'https://techcrunch.com/feed/' },
  { name: "The Verge", url: 'https://www.theverge.com/rss/index.xml' },

  // 5. HEDGE FUNDS (The "Rescue" List - Verified Working)
  { name: "ValueWalk", url: 'https://www.valuewalk.com/feed/' },
  { name: "Insider Monkey", url: 'https://www.insidermonkey.com/blog/feed/' },
  { name: "Dealbreaker", url: 'https://dealbreaker.com/.rss/full/' }
];

// 3. Define List IDs
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
  if (!isoDateString) return "[New]";
  
  const date = new Date(isoDateString);
  
  // Format: "Dec 27 2:30 PM" in EST/EDT (America/New_York timezone)
  // Using toLocaleString with timezone option for each component to handle EST/EDT automatically
  const timeZone = 'America/New_York';
  
  const month = date.toLocaleString('en-US', { timeZone, month: 'short' });
  const day = parseInt(date.toLocaleString('en-US', { timeZone, day: 'numeric' }));
  const hour24 = parseInt(date.toLocaleString('en-US', { timeZone, hour: 'numeric', hour12: false }));
  const minute = parseInt(date.toLocaleString('en-US', { timeZone, minute: 'numeric' }));
  
  // Convert 24-hour to 12-hour format
  let hour12 = hour24 % 12;
  hour12 = hour12 ? hour12 : 12; // the hour '0' should be '12'
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const minutePadded = minute.toString().padStart(2, '0');

  return `[${month} ${day} ${hour12}:${minutePadded} ${ampm}]`;
}

// 4. Smart Router Logic
function routeArticle(feedName: string, title: string, snippet: string): string {
  const text = (title + " " + snippet).toLowerCase();
  
  // A. Feed Name Overrides
  if (feedName.includes("Economy")) return LIST_IDS.ECONOMY;
  if (feedName.includes("Commodities") || feedName.includes("Oil")) return LIST_IDS.COMMODITIES;
  if (feedName.includes("Tech") || feedName.includes("Verge")) return LIST_IDS.TECH;
  if (feedName.includes("ValueWalk") || feedName.includes("Insider") || feedName.includes("Dealbreaker")) return LIST_IDS.HEDGE_FUNDS;

  // B. Specific Personality Routing
  if (text.match(/ackman|dalio|griffin|tepper|icahn|druckenmiller|buffett|berkshire|munger|pershing square|bridgewater|citadel|13f/)) return LIST_IDS.HEDGE_FUNDS;
  if (text.match(/el-erian|larry summers|powell|yellen|lagarde|gdp|cpi|pce|jobs|unemployment|recession/)) return LIST_IDS.ECONOMY;
  if (text.match(/nvidia|openai|altman|musk|crypto|bitcoin|apple|microsoft|google|meta|tsmc/)) return LIST_IDS.TECH;

  // C. Fallback Keyword Routing
  if (text.match(/oil|gold|silver|copper|gas|crude/)) return LIST_IDS.COMMODITIES;
  if (text.match(/rate|inflation|yield/)) return LIST_IDS.ECONOMY;
  
  return LIST_IDS.MARKETS;
}

// 5. The Main Function
export async function runNewsCycle() {
  console.log("📡 [News Ingestion] Starting Cycle...");
  const processedTitles = new Set<string>();

  for (const feed of FEEDS) {
    console.log(`📰 Processing feed: ${feed.name}`);
    try {
      // Small delay between feeds to be polite
      await new Promise(r => setTimeout(r, 1500));

      const response = await axios.get(feed.url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        },
        timeout: 8000
      });

      const feedData = await parser.parseString(response.data);
      const latestItems = feedData.items.slice(0, 2); 

      console.log(`   ✅ Found ${latestItems.length} article(s) in feed URL: ${feed.url}`);

      for (const item of latestItems) {
        if (!item.link || !item.title) continue;
        if (processedTitles.has(item.title)) continue;
        processedTitles.add(item.title);

        const targetListId = routeArticle(feed.name, item.title, item.contentSnippet || "");
        if (!targetListId) {
          console.log(`   ⚠️  No target list found for: ${item.title}`);
          continue;
        }
        
        const datePrefix = formatPubDate(item.pubDate || item.isoDate);
        const finalTitle = `${datePrefix} ${item.title}`;

        console.log(`   ➡️  [${feed.name}] -> ${finalTitle.substring(0, 60)}...`);
        
        const baseUrl = process.env.APP_URL || 'http://localhost:3001';
        const processUrl = `${baseUrl}/trello/process-card/{cardId}`;
        
        await axios.post(`https://api.trello.com/1/cards`, {
          idList: targetListId,
          key: process.env.TRELLO_API_KEY,
          token: process.env.TRELLO_TOKEN,
          name: finalTitle,
          desc: `**[Process For AI](${processUrl})**\n\n---\n\n**Source URL:** ${item.link}\n\n**Article Text:**\n\n_(Paste the full article text here)_`
        });
      }
    } catch (error: any) {
      console.error(`   ❌ Failed "${feed.name}": ${error.message}`);
    }
  }
  
  console.log("============================================================");
  console.log(`✅ [News Ingestion] Cycle Complete`);
  console.log("============================================================");
}

