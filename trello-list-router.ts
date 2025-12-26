/**
 * Trello List Router
 * Routes news articles to appropriate Trello lists based on content analysis
 */

// List Types for Type Safety
export type TrelloListType = 'MARKETS' | 'ECONOMY' | 'COMMODITIES' | 'HEDGE_FUNDS' | 'BUSINESS' | 'WGO' | 'PR' | 'ANALYST';

// Map environment variables to list types
export const TRELLO_LIST_IDS: Record<TrelloListType, string | undefined> = {
  MARKETS: process.env.TRELLO_LIST_ID_MARKETS,
  ECONOMY: process.env.TRELLO_LIST_ID_ECONOMY,
  COMMODITIES: process.env.TRELLO_LIST_ID_COMMODITIES,
  HEDGE_FUNDS: process.env.TRELLO_LIST_ID_HEDGE_FUNDS,
  BUSINESS: process.env.TRELLO_LIST_ID || process.env.TRELLO_LIST_ID_BUSINESS, // Default/fallback
  WGO: process.env.TRELLO_LIST_ID_WGO,
  PR: process.env.TRELLO_LIST_ID_PR,
  ANALYST: process.env.TRELLO_LIST_ID_ANALYST_NOTES,
};

/**
 * Agent Personas/Prompts for each list type
 * These can be used to customize article generation prompts per list
 */
export const AGENT_PERSONAS: Record<TrelloListType, { role: string; prompt: string }> = {
  HEDGE_FUNDS: {
    role: "Institutional Analyst",
    prompt: "Analyze this news specifically for 13F filings, activist letters, and big money moves. Focus on the manager's reputation and institutional investor implications."
  },
  COMMODITIES: {
    role: "Commodities Trader",
    prompt: "Focus on supply chain disruptions, spot prices, and geopolitical impact on raw materials. Analyze price movements and market fundamentals."
  },
  ECONOMY: {
    role: "Economist",
    prompt: "Focus on macro economic impact, inflation, monetary policy, employment data, GDP, and broader economic implications."
  },
  MARKETS: {
    role: "Market Reporter",
    prompt: "Summarize market movements, index performance, broad market trends, and overall market sentiment."
  },
  BUSINESS: {
    role: "General Business Reporter",
    prompt: "Standard business news summary focusing on company performance, corporate developments, and industry trends."
  },
  WGO: {
    role: "Market Analyst",
    prompt: "Analyze market implications with technical analysis focus."
  },
  PR: {
    role: "Press Release Analyst",
    prompt: "Summarize press release content with focus on corporate announcements."
  },
  ANALYST: {
    role: "Equity Analyst",
    prompt: "Analyze analyst ratings and research notes for investment implications."
  }
};

/**
 * Determines which Trello list to use based on article content
 * @param title - Article title
 * @param content - Article body/content
 * @param defaultListType - Default list type to use if no match is found (defaults to 'BUSINESS')
 * @returns The list ID to use, or undefined if no valid list is configured
 */
export function determineTargetList(
  title: string,
  content: string = '',
  defaultListType: TrelloListType = 'BUSINESS'
): string | undefined {
  const text = `${title} ${content}`.toLowerCase();

  // 1. Hedge Funds (Highest Priority - specific institutional terms)
  if (text.match(/\b(hedge fund|ackman|dalio|icahn|citadel|point72|millennium|renaissance|13f|13-f|filing|activist|activist investor|institutional investor|big money|whale|whale alert)\b/)) {
    const listId = TRELLO_LIST_IDS.HEDGE_FUNDS;
    if (listId) {
      console.log(`   🎯 Router: HEDGE_FUNDS list (matched: hedge fund/institutional terms)`);
      return listId;
    }
  }

  // 2. Commodities (Priority 2 - specific commodity terms)
  if (text.match(/\b(oil|crude|wti|brent|gold|silver|platinum|copper|aluminum|wheat|corn|soybean|natural gas|ng|commodity|commodities|spot price|futures|supply chain|raw materials)\b/)) {
    const listId = TRELLO_LIST_IDS.COMMODITIES;
    if (listId) {
      console.log(`   🎯 Router: COMMODITIES list (matched: commodity terms)`);
      return listId;
    }
  }

  // 3. Economy (Priority 3 - macro economic indicators)
  if (text.match(/\b(inflation|cpi|ppi|fomc|fed|federal reserve|gdp|unemployment|jobs report|employment|monetary policy|interest rate|rate cut|rate hike|recession|economic growth|economic data|macro)\b/)) {
    const listId = TRELLO_LIST_IDS.ECONOMY;
    if (listId) {
      console.log(`   🎯 Router: ECONOMY list (matched: economic indicators)`);
      return listId;
    }
  }

  // 4. Markets (Priority 4 - broad market terms)
  if (text.match(/\b(s&p 500|s&p|sp500|nasdaq|dow jones|dow|wall street|market index|market indices|market close|market open|market rally|market selloff|market volatility|vix|market sentiment)\b/)) {
    const listId = TRELLO_LIST_IDS.MARKETS;
    if (listId) {
      console.log(`   🎯 Router: MARKETS list (matched: market index/broad market terms)`);
      return listId;
    }
  }

  // 5. Default fallback
  const listId = TRELLO_LIST_IDS[defaultListType];
  if (listId) {
    console.log(`   🎯 Router: ${defaultListType} list (default/fallback)`);
    return listId;
  }

  console.warn(`   ⚠️  Router: No valid list ID found for type ${defaultListType}`);
  return undefined;
}

/**
 * Gets the agent persona/prompt for a specific list type
 * @param listType - The list type
 * @returns The persona object with role and prompt
 */
export function getAgentPersona(listType: TrelloListType): { role: string; prompt: string } {
  return AGENT_PERSONAS[listType] || AGENT_PERSONAS.BUSINESS;
}

