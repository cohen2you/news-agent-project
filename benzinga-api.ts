/**
 * Benzinga API Integration
 * Fetches news articles from Benzinga API based on topics
 */

interface BenzingaArticle {
  id: string;
  title: string;
  headline?: string; // Optional, falls back to title
  created: number;
  updated: number;
  teaser: string;
  body: string;
  channels: string[];
  stocks: string[];
  tags: string[];
  url: string;
}

interface BenzingaResponse {
  news: BenzingaArticle[];
  next_page?: string;
}

/**
 * Fetch news from Benzinga API
 */
export async function fetchBenzingaNews(
  topic: string,
  apiKey: string,
  limit: number = 10,
  prOnly: boolean = false
): Promise<BenzingaArticle[]> {
  try {
    // Press releases are accessed through the news endpoint with channels parameter
    // Use the same news endpoint but filter by channels for press releases
    const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';
    
    // Check if topic looks like a stock ticker (uppercase, 1-5 chars)
    const isLikelyTicker = /^[A-Z]{1,5}$/.test(topic);
    
    // Get today's date for logging
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Request more articles to ensure we get the most recent ones
    // Don't use dateFrom - let the API return the most recent articles, then we'll filter
    const requestLimit = limit * 3; // Request 3x more to ensure we have recent ones
    
    let url: string;
    
    const searchType = prOnly ? 'press releases' : 'articles';
    
    // For press releases, add channels parameter to filter
    // Try different channel name formats that Benzinga might use
    const channelsParam = prOnly ? '&channels=Press Releases' : '';
    
    if (isLikelyTicker) {
      // Strategy 1: Ticker-specific articles - get the most recent without date filter
      console.log(`📡 Searching for most recent ${topic} ${searchType} (no date filter, requesting ${requestLimit} items)...`);
      if (prOnly) {
        console.log(`   Using channels filter: Press Releases`);
      }
      url = `${BZ_NEWS_URL}?token=${apiKey}&tickers=${encodeURIComponent(topic)}&items=${requestLimit}&fields=headline,title,created,body,url,channels,teaser&accept=application/json&displayOutput=full${channelsParam}`;
    } else {
      // Strategy 2: Keyword search - get the most recent without date filter
      console.log(`📡 Searching for most recent ${searchType} about "${topic}" (no date filter, requesting ${requestLimit} items)...`);
      if (prOnly) {
        console.log(`   Using channels filter: Press Releases`);
      }
      url = `${BZ_NEWS_URL}?token=${apiKey}&keywords=${encodeURIComponent(topic)}&items=${requestLimit}&fields=headline,title,created,body,url,channels,teaser&accept=application/json&displayOutput=full${channelsParam}`;
    }
    
    console.log(`   Full URL: ${url.substring(0, 150)}...`); // Log first part of URL for debugging
    
    const response = await fetch(url, {
      headers: { 
        Accept: 'application/json' 
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Benzinga API error: ${response.status} ${response.statusText}`);
      if (errorText) {
        console.error(`   Error details: ${errorText.substring(0, 300)}`);
      }
      throw new Error(`Benzinga API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    // Debug: log response structure
    if (data && typeof data === 'object') {
      console.log(`📦 Benzinga API response keys: ${Object.keys(data).join(', ')}`);
    }
    
    // Handle Benzinga API v2 response format
    // Response can be: { news: [...] } or direct array
    let articles: any[] = [];
    
    if (data.news && Array.isArray(data.news)) {
      articles = data.news;
      console.log(`   Found ${articles.length} articles in data.news`);
    } else if (Array.isArray(data)) {
      articles = data;
      console.log(`   Response is direct array with ${articles.length} items`);
    } else if (data.results && Array.isArray(data.results)) {
      articles = data.results;
      console.log(`   Found ${articles.length} articles in data.results`);
    } else if (data.article && Array.isArray(data.article)) {
      articles = data.article;
      console.log(`   Found ${articles.length} articles in data.article`);
    } else {
      if (data && typeof data === 'object') {
        console.warn(`⚠️  Unexpected response format. Available keys: ${Object.keys(data).join(', ')}`);
        // Try to find any array in the response
        for (const key of Object.keys(data)) {
          if (Array.isArray((data as any)[key])) {
            articles = (data as any)[key];
            console.log(`   Found ${articles.length} items in data.${key}`);
            break;
          }
        }
      }
    }
    
    // Map to our article format (handle different field names)
    const mappedArticles: BenzingaArticle[] = articles.map((article: any) => {
      // Handle created date - Benzinga returns Unix timestamp (seconds) or date string
      let createdTimestamp: number;
      if (article.created) {
        // If it's already a number (Unix timestamp in seconds), use it
        if (typeof article.created === 'number') {
          createdTimestamp = article.created;
        } else if (typeof article.created === 'string') {
          // Try parsing as date string
          const date = new Date(article.created);
          createdTimestamp = isNaN(date.getTime()) ? Date.now() / 1000 : date.getTime() / 1000;
        } else {
          createdTimestamp = Date.now() / 1000;
        }
      } else if (article.created_date) {
        const date = new Date(article.created_date);
        createdTimestamp = isNaN(date.getTime()) ? Date.now() / 1000 : date.getTime() / 1000;
      } else {
        createdTimestamp = Date.now() / 1000;
      }
      
      // Extract body - check multiple possible fields
      const body = article.body || article.content || article.text || article.description || '';
      
      // Extract teaser/summary - use body excerpt if no teaser
      const teaser = article.teaser || article.summary || article.description || 
                     (body ? body.substring(0, 300).replace(/\s+/g, ' ').trim() : '') || '';
      
      // Extract title
      const title = article.title || article.headline || article.name || '[No Title]';
      
      // Extract stocks/tickers - handle different formats
      let stocks: any[] = [];
      if (article.stocks && Array.isArray(article.stocks)) {
        stocks = article.stocks;
      } else if (article.tickers && Array.isArray(article.tickers)) {
        stocks = article.tickers;
      } else if (article.symbols && Array.isArray(article.symbols)) {
        stocks = article.symbols;
      }
      
      return {
        id: article.id || article.article_id || article._id || '',
        title: title,
        created: createdTimestamp,
        updated: article.updated || createdTimestamp,
        teaser: teaser,
        body: body,
        channels: article.channels || [],
        stocks: stocks,
        tags: article.tags || [],
        url: article.url || article.link || article.permalink || ''
      };
    });
    
    if (mappedArticles.length === 0) {
      console.log(`⚠️  No news found for: ${topic}`);
      return [];
    }

    console.log(`✅ Found ${mappedArticles.length} articles from Benzinga`);
    return mappedArticles;
  } catch (error) {
    console.error("Error fetching Benzinga news:", error);
    throw error;
  }
}

/**
 * Fetch a specific Benzinga article by URL
 * Extracts article ID from URL and fetches full article data
 */
export async function fetchBenzingaArticleByUrl(articleUrl: string, apiKey: string): Promise<BenzingaArticle | null> {
  try {
    // Clean the URL first (remove markdown artifacts, trailing characters)
    let cleanedUrl = articleUrl
      .replace(/\]\(https?:\/\/.*$/, '') // Remove markdown link artifacts
      .replace(/\)+$/, '') // Remove trailing parentheses
      .trim();
    
    // Extract article ID from Benzinga URL
    // Benzinga URLs typically look like: 
    //   https://www.benzinga.com/news/25/12/49514553/...
    //   https://www.benzinga.com/pressreleases/25/12/g49281142/...
    //   https://www.benzinga.com/opinion/25/12/49514553/...
    // For press releases, the ID might be alphanumeric (g49281142)
    // For regular articles, it's numeric (49514553)
    
    // Try to extract numeric ID first (most common)
    let urlMatch = cleanedUrl.match(/\/(\d{6,})(?:\/|$)/); // Match 6+ digit numbers (article IDs)
    let articleId: string | null = null;
    
    if (urlMatch && urlMatch[1]) {
      articleId = urlMatch[1];
    } else {
      // Try alphanumeric ID (for press releases like g49281142)
      const alphanumericMatch = cleanedUrl.match(/\/([a-z]\d+)(?:\/|$)/i);
      if (alphanumericMatch && alphanumericMatch[1]) {
        articleId = alphanumericMatch[1];
      } else {
        // Fallback: try to match any sequence of digits (but prefer longer ones)
        const fallbackMatch = cleanedUrl.match(/\/(\d+)(?:\/|$)/);
        if (fallbackMatch && fallbackMatch[1] && fallbackMatch[1].length >= 6) {
          articleId = fallbackMatch[1];
        }
      }
    }
    
    if (!articleId) {
      console.error(`❌ Could not extract article ID from URL: ${cleanedUrl}`);
      console.error(`   Original URL: ${articleUrl}`);
      return null;
    }
    
    console.log(`📡 Fetching Benzinga article by ID: ${articleId} from URL: ${cleanedUrl}`);
    
    // Benzinga API doesn't support direct lookup by ID, so we'll search recent articles
    // We'll fetch a larger batch and match by URL or ID
    const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';
    
    // Detect if this is a press release URL
    const isPressRelease = cleanedUrl.includes('/pressreleases/');
    
    // Fetch a large batch of recent articles and search for matching URL
    // Increase limit to improve chances of finding the article
    // For press releases, add channels filter
    const channelsParam = isPressRelease ? '&channels=Press Releases' : '';
    const searchUrl = `${BZ_NEWS_URL}?token=${apiKey}&items=200${channelsParam}&fields=headline,title,created,body,url,channels,teaser,id&accept=application/json&displayOutput=full`;
    
    if (isPressRelease) {
      console.log(`   📰 Detected press release URL - using Press Releases channel filter`);
    }
    
    const response = await fetch(searchUrl, {
      headers: { 
        Accept: 'application/json' 
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`❌ Benzinga API error: ${response.status} ${response.statusText}`);
      if (errorText) {
        console.error(`   Error details: ${errorText.substring(0, 300)}`);
      }
      throw new Error(`Benzinga API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    // Handle response format
    let articles: any[] = [];
    if (data.news && Array.isArray(data.news)) {
      articles = data.news;
    } else if (Array.isArray(data)) {
      articles = data;
    } else if (data.data && Array.isArray(data.data)) {
      articles = data.data;
    }
    
    // Find article matching the URL
    // Try multiple matching strategies
    // Normalize URLs for comparison (remove trailing slashes, fragments, etc.)
    const normalizeUrlForMatch = (url: string): string => {
      return url.toLowerCase()
        .replace(/\/+$/, '') // Remove trailing slashes
        .replace(/#.*$/, '') // Remove fragments
        .trim();
    };
    
    const normalizedTargetUrl = normalizeUrlForMatch(cleanedUrl);
    
    let matchingArticle = articles.find((article: any) => {
      const articleUrlFromApi = article.url || article.link || article.permalink || '';
      // Exact URL match (normalized)
      return normalizeUrlForMatch(articleUrlFromApi) === normalizedTargetUrl;
    });
    
    // If no exact match, try ID match
    if (!matchingArticle) {
      matchingArticle = articles.find((article: any) => {
        return String(article.id || article.article_id || article._id) === articleId;
      });
    }
    
    // If still no match, try partial URL match (in case URL format differs slightly)
    if (!matchingArticle) {
      // Extract the path from the URL (everything after benzinga.com)
      const urlPath = cleanedUrl.replace(/^https?:\/\/[^\/]+/, '');
      matchingArticle = articles.find((article: any) => {
        const articleUrlFromApi = article.url || article.link || article.permalink || '';
        const normalizedApiUrl = normalizeUrlForMatch(articleUrlFromApi);
        return normalizedApiUrl.includes(articleId) || normalizedApiUrl.includes(urlPath) || articleUrlFromApi.includes(articleId);
      });
    }
    
    if (!matchingArticle) {
      console.error(`❌ Article not found in Benzinga API response for URL: ${cleanedUrl}`);
      console.error(`   Original URL: ${articleUrl}`);
      console.log(`   Searched ${articles.length} articles, but none matched the URL or ID`);
      console.log(`   Article ID from URL: ${articleId}`);
      console.log(`   Article type: ${isPressRelease ? 'Press Release' : 'News Article'}`);
      console.log(`   💡 The article might be older than the recent batch fetched (${articles.length} articles), or the URL format might be different.`);
      console.log(`   💡 If this is a manually added card, the article may need to be available in the Benzinga API's recent articles.`);
      return null;
    }
    
    // Map to BenzingaArticle format
    const title = matchingArticle.headline || matchingArticle.title || 'Untitled';
    const teaser = matchingArticle.teaser || matchingArticle.summary || '';
    const body = matchingArticle.body || matchingArticle.content || teaser;
    
    // Handle created date
    let createdTimestamp = 0;
    if (matchingArticle.created) {
      if (typeof matchingArticle.created === 'number') {
        createdTimestamp = matchingArticle.created < 10000000000 ? matchingArticle.created : Math.floor(matchingArticle.created / 1000);
      } else if (typeof matchingArticle.created === 'string') {
        const date = new Date(matchingArticle.created);
        createdTimestamp = Math.floor(date.getTime() / 1000);
      }
    }
    
    // Extract stocks/tickers
    let stocks: string[] = [];
    if (matchingArticle.stocks && Array.isArray(matchingArticle.stocks)) {
      stocks = matchingArticle.stocks.map((s: any) => typeof s === 'string' ? s : (s.ticker || s.symbol || ''));
    } else if (matchingArticle.symbols && Array.isArray(matchingArticle.symbols)) {
      stocks = matchingArticle.symbols;
    }
    
    const mappedArticle: BenzingaArticle = {
      id: String(matchingArticle.id || matchingArticle.article_id || matchingArticle._id || articleId),
      title: title,
      created: createdTimestamp,
      updated: matchingArticle.updated ? (typeof matchingArticle.updated === 'number' ? matchingArticle.updated : Math.floor(new Date(matchingArticle.updated).getTime() / 1000)) : createdTimestamp,
      teaser: teaser,
      body: body,
      channels: matchingArticle.channels || [],
      stocks: stocks,
      tags: matchingArticle.tags || [],
      url: matchingArticle.url || matchingArticle.link || matchingArticle.permalink || articleUrl
    };
    
    console.log(`✅ Found matching article: ${mappedArticle.title} (${mappedArticle.id})`);
    return mappedArticle;
  } catch (error) {
    console.error("Error fetching Benzinga article by URL:", error);
    throw error;
  }
}

/**
 * Scrape article content directly from a Benzinga URL
 * This is used when the API doesn't have the article in recent batches
 */
export async function scrapeBenzingaArticleByUrl(articleUrl: string): Promise<BenzingaArticle | null> {
  try {
    console.log(`🌐 Scraping article content from URL: ${articleUrl}`);
    
    // Fetch the HTML page
    const response = await fetch(articleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch URL: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    
    // Extract article ID from URL
    let articleId: string | null = null;
    const urlMatch = articleUrl.match(/\/([a-z]?\d+)(?:\/|$)/i);
    if (urlMatch && urlMatch[1]) {
      articleId = urlMatch[1];
    }
    
    // Extract title - look for common title selectors
    let title = 'Untitled';
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || 
                      html.match(/<h1[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/h1>/i) ||
                      html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim()
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ');
    }
    
    // Extract main content - look for article body
    // Benzinga typically uses <article>, <div class="article-content">, or similar
    let body = '';
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                        html.match(/<div[^>]*class="[^"]*article[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                        html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    if (articleMatch && articleMatch[1]) {
      // Remove HTML tags and decode entities
      body = articleMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // If no body found, try to extract from paragraphs
    if (!body || body.length < 100) {
      const paragraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
      if (paragraphs) {
        body = paragraphs
          .map(p => p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
          .filter(p => p.length > 20)
          .join(' ')
          .substring(0, 5000); // Limit to 5000 chars
      }
    }
    
    // Extract teaser (first 500 chars of body)
    const teaser = body ? body.substring(0, 500) : '';
    
    // Extract date - look for date in meta tags or content
    let createdTimestamp = Math.floor(Date.now() / 1000);
    const dateMatch = html.match(/<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i) ||
                        html.match(/<time[^>]*datetime="([^"]+)"/i);
    if (dateMatch && dateMatch[1]) {
      try {
        const date = new Date(dateMatch[1]);
        if (!isNaN(date.getTime())) {
          createdTimestamp = Math.floor(date.getTime() / 1000);
        }
      } catch (e) {
        // Use current timestamp if date parsing fails
      }
    }
    
    // Extract tickers/stocks - look for stock symbols in the content
    const stocks: string[] = [];
    const tickerRegex = /\b([A-Z]{1,5})\b/g;
    const tickerMatches = Array.from((title + ' ' + body).matchAll(tickerRegex));
    const uniqueTickers = new Set<string>();
    tickerMatches.forEach(match => {
      const ticker = match[1];
      // Filter out common words that look like tickers
      if (ticker.length >= 1 && ticker.length <= 5 && 
          !['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'ITS', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE'].includes(ticker)) {
        uniqueTickers.add(ticker);
      }
    });
    stocks.push(...Array.from(uniqueTickers).slice(0, 5)); // Limit to 5 tickers
    
    if (!body || body.length < 50) {
      console.warn(`⚠️  Scraped content is too short (${body.length} chars) - may not be accurate`);
    }
    
    const scrapedArticle: BenzingaArticle = {
      id: articleId || 'scraped',
      title: title,
      created: createdTimestamp,
      updated: createdTimestamp,
      teaser: teaser,
      body: body || teaser,
      channels: [],
      stocks: stocks,
      tags: [],
      url: articleUrl
    };
    
    console.log(`✅ Scraped article: ${title} (${body.length} chars)`);
    return scrapedArticle;
    
  } catch (error: any) {
    console.error(`❌ Error scraping article from URL:`, error.message);
    return null;
  }
}

/**
 * Generate a pitch from Benzinga news articles
 * Returns both the pitch and the articles for use in WGO with news
 */
export async function generatePitchFromBenzinga(
  topic: string,
  apiKey: string,
  prOnly: boolean = false
): Promise<{ pitch: string; articles: BenzingaArticle[]; selectedArticle: BenzingaArticle | null }> {
  try {
    // Fetch the 10 most recent articles for the ticker
    const articles = await fetchBenzingaNews(topic, apiKey, 10, prOnly);
    
    if (articles.length === 0) {
      return {
        pitch: `No recent news found for "${topic}". 

Please try a different topic or check back later.

The selected article generation app will determine the word count based on its configured prompts.`,
        articles: [],
        selectedArticle: null
      };
    }

    // Sort articles by date (most recent first) - ensure proper sorting
    const sortedArticles = [...articles].sort((a, b) => {
      const dateA = a.created || 0;
      const dateB = b.created || 0;
      return dateB - dateA; // Most recent first
    });
    
    // Filter articles to only include those from the last 7 days
    const sevenDaysAgo = Date.now() / 1000 - (7 * 24 * 60 * 60);
    const recentArticlesFiltered = sortedArticles.filter(article => {
      const articleDate = article.created || 0;
      return articleDate >= sevenDaysAgo;
    });

    // Log the date range of articles found (before filtering)
    if (sortedArticles.length > 0) {
      const newestDate = new Date(sortedArticles[0].created * 1000);
      const oldestDate = new Date(sortedArticles[sortedArticles.length - 1].created * 1000);
      console.log(`📅 All articles date range: ${oldestDate.toLocaleDateString()} to ${newestDate.toLocaleDateString()}`);
      console.log(`   Most recent article (before filter): "${sortedArticles[0].title?.substring(0, 60)}..." (${newestDate.toLocaleDateString()})`);
    }

    // Log the date range after filtering
    if (recentArticlesFiltered.length > 0) {
      const newestFiltered = new Date(recentArticlesFiltered[0].created * 1000);
      const oldestFiltered = new Date(recentArticlesFiltered[recentArticlesFiltered.length - 1].created * 1000);
      console.log(`📅 Filtered articles (last 7 days): ${oldestFiltered.toLocaleDateString()} to ${newestFiltered.toLocaleDateString()}`);
      console.log(`   Most recent article: "${recentArticlesFiltered[0].title?.substring(0, 60)}..." (${newestFiltered.toLocaleDateString()})`);
    }

    // Take the top 10 most recent from the filtered list
    const recentArticles = recentArticlesFiltered.slice(0, 10);
    
    console.log(`✅ Found ${recentArticles.length} most recent articles for ${topic} (filtered from ${recentArticlesFiltered.length} articles in last 7 days, out of ${articles.length} total)`);
    
    // Generate a simple pitch from the most recent article
    const topArticle = recentArticles[0];
    
    // Format date safely
    let dateStr = 'Date not available';
    try {
      if (topArticle.created) {
        const date = new Date(topArticle.created * 1000);
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleDateString();
        }
      }
    } catch (e) {
      console.warn('Error formatting date:', e);
    }
    
    // Get summary/teaser safely
    const summary = topArticle.teaser || topArticle.body?.substring(0, 200) || 'No summary available';
    const summaryPreview = summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
    
    // Generate a simple pitch (word count will be determined by the selected app's prompts)
    const pitch = `Proposed Article: ${topArticle.title || 'Untitled Article'}

Source: Benzinga News
Published: ${dateStr}

Summary: ${summaryPreview}

Proposed Angle: Analyze the implications of ${topic} based on recent market developments and news trends.`;

    return { pitch, articles: recentArticles, selectedArticle: topArticle };
  } catch (error) {
    console.error("Error generating pitch from Benzinga:", error);
    // Fallback pitch if API fails
    // Word count will be determined by the selected app's prompts
    return {
      pitch: `Proposed Article: ${topic} - Market Analysis

Note: Unable to fetch recent news from Benzinga. Please check your API key and connection.

Proposed Angle: Provide comprehensive analysis of ${topic} with current market context.`,
      articles: [],
      selectedArticle: null
    };
  }
}

