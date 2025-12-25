/**
 * Integration helpers for your existing article generation apps
 * Supports local files, GitHub repos, HTTP APIs, and Node modules
 */

import { exec } from "child_process";
import { promisify } from "util";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const execAsync = promisify(exec);

interface ArticleGenConfig {
  type: "python" | "http" | "github" | "node" | "typescript" | "tsx";
  pythonPath?: string;
  directory?: string;
  apiUrl?: string;
  repoPath?: string;
  script?: string;
  modulePath?: string;
  tsxPath?: string;
  nodePath?: string;
}

/**
 * Load configuration from environment variables
 */
function loadConfig(): ArticleGenConfig {
  // Don't default to python - require explicit configuration
  const type = (process.env.ARTICLE_GEN_TYPE || "http") as ArticleGenConfig["type"];
  
  return {
    type,
    pythonPath: process.env.ARTICLE_GEN_PYTHON_PATH,
    directory: process.env.ARTICLE_GEN_DIRECTORY,
    apiUrl: process.env.ARTICLE_GEN_API_URL,
    repoPath: process.env.ARTICLE_GEN_REPO_PATH,
    script: process.env.ARTICLE_GEN_SCRIPT || "generate_article.ts",
    modulePath: process.env.ARTICLE_GEN_MODULE_PATH,
    tsxPath: process.env.ARTICLE_GEN_TSX_PATH,
    nodePath: process.env.ARTICLE_GEN_NODE_PATH,
  };
}

/**
 * Generate article using Python script (local file)
 */
async function generateWithPython(pitch: string, config: ArticleGenConfig): Promise<string> {
  if (!config.pythonPath) {
    throw new Error("ARTICLE_GEN_PYTHON_PATH not set in .env file");
  }

  if (!existsSync(config.pythonPath)) {
    throw new Error(`Python script not found: ${config.pythonPath}`);
  }

  try {
    console.log(`🐍 Running Python script: ${config.pythonPath}`);
    
    // Escape the pitch for command line
    const escapedPitch = pitch.replace(/"/g, '\\"');
    
    // Use python or python3 depending on system
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    
    const { stdout, stderr } = await execAsync(
      `${pythonCmd} "${config.pythonPath}" "${escapedPitch}"`
    );

    if (stderr && !stderr.includes("Warning")) {
      console.warn("Python script stderr:", stderr);
    }

    return stdout.trim();
  } catch (error: any) {
    console.error("Error calling Python script:", error);
    throw new Error(`Failed to generate article: ${error.message}`);
  }
}

/**
 * Generate article using HTTP API
 * Supports multiple API formats including Next.js apps
 */
async function generateWithHTTP(
  pitch: string,
  config: ArticleGenConfig,
  topic?: string,
  newsArticles?: any[],
  selectedArticle?: any,
  manualTicker?: string
): Promise<string> {
  if (!config.apiUrl) {
    throw new Error("ARTICLE_GEN_API_URL not set in .env file");
  }

  try {
    console.log(`🌐 Calling HTTP API: ${config.apiUrl}`);
    console.log(`   Topic: ${topic || 'not provided'}`);
    console.log(`   News articles: ${newsArticles ? newsArticles.length : 0}`);
    if (newsArticles && newsArticles.length > 0) {
      console.log(`   First article keys: ${Object.keys(newsArticles[0]).join(', ')}`);
    }
    
    // Extract topic from pitch (first line usually contains the topic)
    const extractedTopic = topic || (pitch.match(/Proposed Article: (.+?)(?:\n|$)/)?.[1]?.trim()) || pitch.split("\n")[0].trim();
    
    // Check which app format to use based on URL patterns
    // Check for story endpoint FIRST (for PR-related articles from news-story-generator)
    // Supports both /api/generate/story and /api/generate/pr-story
    const isStoryEndpoint = (config.apiUrl.includes('/api/generate/story') || 
                             config.apiUrl.includes('/api/generate/pr-story')) && 
                            !config.apiUrl.includes('wiim-project') &&
                            !config.apiUrl.includes('wgo');
    
    const isComprehensiveArticle = config.apiUrl.includes('/api/generate/comprehensive-article') || 
                                   config.apiUrl.includes('comprehensive-article');
    // Check for technical-analysis endpoint FIRST (most specific)
    const isWGOTechnicalAnalysis = config.apiUrl.includes('/api/generate/technical-analysis') ||
                                   config.apiUrl.includes('technical-analysis');
    
    const isWGOGenerator = config.apiUrl.includes('/api/generate/wgo') || 
                          config.apiUrl.includes('/api/generate/technical-analysis') ||
                          config.apiUrl.includes('wgo-no-news') ||
                          config.apiUrl.includes('wgo') ||
                          config.apiUrl.includes('wiim-project') ||
                          config.apiUrl.includes('technical-analysis');
    const isWGONoNews = config.apiUrl.includes('wgo-no-news');
    const isWGOStory = config.apiUrl.includes('/api/generate/story') && !isWGOTechnicalAnalysis;
    
    console.log(`   Endpoint detection:`);
    console.log(`      URL: ${config.apiUrl}`);
    console.log(`      isStoryEndpoint (news-story-generator): ${isStoryEndpoint}`);
    console.log(`      isComprehensiveArticle: ${isComprehensiveArticle}`);
    console.log(`      isWGOGenerator: ${isWGOGenerator}`);
    console.log(`      isWGONoNews: ${isWGONoNews}`);
    console.log(`      isWGOStory: ${isWGOStory}`);
    console.log(`      isWGOTechnicalAnalysis: ${isWGOTechnicalAnalysis}`);
    
    // Warn if using story endpoint instead of technical-analysis
    if (isWGOStory && !isWGOTechnicalAnalysis) {
      console.log(`      ⚠️  WARNING: Using /api/generate/story endpoint (no technical analysis)`);
      console.log(`      💡 To get technical analysis, update ARTICLE_GEN_APP_WGO_URL to: http://localhost:PORT/api/generate/technical-analysis`);
    }
    
    let requestBody: any;
    
    // IMPORTANT: Check news-story-generator story endpoint FIRST (for PR-related articles)
    // This endpoint is from news-story-generator app (not WGO)
    if (isStoryEndpoint) {
      // Format for news-story-generator /api/generate/story or /api/generate/pr-story endpoint
      const isPRStoryEndpoint = config.apiUrl.includes('/api/generate/pr-story');
      console.log(`   ✅ Using news-story-generator ${isPRStoryEndpoint ? 'PR-Story' : 'Story'} endpoint format`);
      
      // Use the actual article/PR content, not just the pitch
      const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
      
      let sourceText = pitch; // Default to pitch
      let ticker = extractTickerFromPitch(pitch, extractedTopic) || extractedTopic || manualTicker;
      let headline = '';
      let articleDate: string | undefined;
      
      if (articleToUse) {
        // Use the actual article/PR body content - prioritize full body over teaser
        // If body exists, use it; otherwise try content, then teaser as fallback
        sourceText = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.summary || pitch;
        headline = articleToUse.title || articleToUse.headline || '';
        
        // Log what we're using to help debug
        if (articleToUse.body && articleToUse.body.length > 0) {
          console.log(`   ✅ Using full body content (${articleToUse.body.length} chars)`);
        } else if (articleToUse.content && articleToUse.content.length > 0) {
          console.log(`   ⚠️  Body not available, using content field (${articleToUse.content.length} chars)`);
        } else if (articleToUse.teaser && articleToUse.teaser.length > 0) {
          console.log(`   ⚠️  Body/content not available, using teaser (${articleToUse.teaser.length} chars) - this may be incomplete!`);
        }
        
        // Format the date for the article
        if (articleToUse.created) {
          try {
            // Handle different date formats
            let dateValue: number;
            if (typeof articleToUse.created === 'number') {
              // If already a number, check if it's in seconds or milliseconds
              dateValue = articleToUse.created < 10000000000 ? articleToUse.created : Math.floor(articleToUse.created / 1000);
            } else if (typeof articleToUse.created === 'string') {
              // Parse string date
              const parsed = new Date(articleToUse.created);
              dateValue = Math.floor(parsed.getTime() / 1000);
            } else {
              dateValue = 0;
            }
            articleDate = formatArticleDate(dateValue > 0 ? dateValue : undefined);
          } catch (error) {
            console.warn(`   ⚠️  Could not format date: ${articleToUse.created}`, error);
            articleDate = undefined;
          }
        }
        
        // Extract ticker from article if available
        // IMPROVED: For multi-company PRs, try to identify the PRIMARY company
        // by analyzing which ticker/company is most prominent in the content
        if (articleToUse.ticker) {
          ticker = articleToUse.ticker;
          console.log(`   📊 Using explicit ticker field: ${ticker}`);
        } else if (articleToUse.stocks && Array.isArray(articleToUse.stocks) && articleToUse.stocks.length > 0) {
          // For multi-company PRs, analyze content to find PRIMARY company
          if (articleToUse.stocks.length > 1) {
            console.log(`   🔍 Multiple companies detected (${articleToUse.stocks.length}), analyzing content to find primary company...`);
            
            let bestTicker: string | null = null;
            let bestScore = 0;
            
            // Analyze source text to find which ticker is mentioned most
            const textToAnalyze = (sourceText || headline || '').toUpperCase();
            
            // Score each ticker based on mention frequency
            const tickerScores: Array<{ticker: string, score: number, mentions: number}> = [];
            
            for (const stock of articleToUse.stocks) {
              let stockTicker: string | null = null;
              if (typeof stock === 'string') {
                stockTicker = stock.toUpperCase().trim();
              } else if (typeof stock === 'object' && stock !== null) {
                stockTicker = (stock.ticker || stock.symbol || stock.name || '').toUpperCase().trim();
              }
              
              if (stockTicker && stockTicker.length > 0 && stockTicker.length <= 5) {
                // Count ticker mentions (word boundaries to avoid partial matches)
                const mentions = (textToAnalyze.match(new RegExp(`\\b${stockTicker}\\b`, 'g')) || []).length;
                
                // Additional scoring: ticker mentioned in first paragraph gets bonus
                const firstParagraph = textToAnalyze.split('\n')[0] || '';
                const inFirstParagraph = firstParagraph.includes(stockTicker) ? 2 : 0;
                
                const totalScore = mentions * 2 + inFirstParagraph; // Weight mentions more
                
                tickerScores.push({ ticker: stockTicker, score: totalScore, mentions });
                
                if (totalScore > bestScore) {
                  bestScore = totalScore;
                  bestTicker = stockTicker;
                }
              }
            }
            
            // Log analysis results
            if (tickerScores.length > 0) {
              tickerScores.sort((a, b) => b.score - a.score);
              console.log(`   📊 Ticker analysis results:`);
              tickerScores.slice(0, 3).forEach((ts, idx) => {
                console.log(`      ${idx + 1}. ${ts.ticker}: ${ts.mentions} mentions, score ${ts.score}`);
              });
            }
            
            // Use best ticker if found, otherwise fall back to first stock
            if (bestTicker && bestScore > 0) {
              ticker = bestTicker;
              console.log(`   ✅ Selected primary ticker: ${ticker} (${bestScore} score, ${tickerScores.find(ts => ts.ticker === ticker)?.mentions || 0} mentions)`);
            } else {
              // Fall back to first stock if no clear winner
              const firstStock = articleToUse.stocks[0];
              if (typeof firstStock === 'string') {
                ticker = firstStock;
              } else if (typeof firstStock === 'object' && firstStock !== null) {
                ticker = firstStock.ticker || firstStock.symbol || firstStock.name || ticker;
              }
              console.log(`   ⚠️  Could not determine primary company, using first stock: ${ticker}`);
            }
          } else {
            // Single company - just use first (and only) stock
            const firstStock = articleToUse.stocks[0];
            if (typeof firstStock === 'string') {
              ticker = firstStock;
            } else if (typeof firstStock === 'object' && firstStock !== null) {
              ticker = firstStock.ticker || firstStock.symbol || firstStock.name || ticker;
            }
          }
        }
        
        console.log(`   ✅ Using selected article/PR content for news-story-generator story`);
        console.log(`   Article title: ${headline || 'No title'}`);
        console.log(`   Source text length: ${sourceText.length} chars`);
        console.log(`   Ticker: ${ticker || 'N/A'}`);
        console.log(`   Date: ${articleDate || 'N/A'}`);
      } else {
        console.log(`   ⚠️  No article/PR content available, using pitch as sourceText`);
        headline = pitch.split('\n')[0].replace('Proposed Article: ', '').trim();
      }
      
      // Ensure sourceText is never empty (story endpoint requires it)
      if (!sourceText || sourceText.trim().length === 0) {
        sourceText = pitch;
        console.log(`   ⚠️  sourceText was empty, using pitch as fallback`);
      }
      
      // Use manual ticker if provided
      if (manualTicker) {
        ticker = manualTicker;
        console.log(`   ✅ Using manual ticker: ${ticker}`);
      }
      
      requestBody = {
        ticker: ticker || undefined,
        sourceText: sourceText,
        headline: headline || undefined,
        date: articleDate || undefined,
        sourceUrl: articleToUse?.url || undefined,
        includeCTA: true,
        includeSubheads: true,
      };
      
      console.log(`   ✅ Final news-story-generator Story request body: ticker=${ticker || 'N/A'}, sourceText length=${sourceText.length}, headline=${headline || 'none'}`);
    } else if (isWGOTechnicalAnalysis) {
      // IMPORTANT: Check WGO technical-analysis endpoint SECOND (most specific)
      // This endpoint automatically fetches technical data and market context
      // Format for WGO Technical Analysis endpoint (wiim-project-v2)
      // technical-analysis endpoint - integrated approach that fetches technical data automatically
      // It expects: ticker, scrapedContent or selectedArticles for news context
      let scrapedContent = '';
      let selectedArticles: any[] = [];
      
      // Prioritize the selectedArticle (the one from the pitch) over other articles
      const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
      
      // Extract ticker with exchange - prioritize manual ticker, then article/PR data, then from content, then from topic
      let ticker: string | null = null;
      let exchange: string | null = null;
      let tickerWithExchange: string | null = null;
      
      // Helper function to extract exchange and ticker from (EXCHANGE:TICKER) format
      const extractExchangeAndTicker = (text: string): { exchange: string | null, ticker: string | null } => {
        // Allow optional space after colon: (NASDAQ:SNPS) or (NASDAQ: SNPS)
        const exchangePattern = /\(([A-Z]+):\s*([A-Z]{1,5})\)/i;
        const match = text.match(exchangePattern);
        if (match) {
          return { exchange: match[1].toUpperCase(), ticker: match[2].toUpperCase().trim() };
        }
        return { exchange: null, ticker: null };
      };
      
      // 0. First priority: use manual ticker if provided
      if (manualTicker && /^[A-Z]{1,5}$/.test(manualTicker.toUpperCase().trim())) {
        ticker = manualTicker.toUpperCase().trim();
        // Try to find exchange from article content - use full body if available
        if (articleToUse) {
          const articleText = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.title || '';
          const extracted = extractExchangeAndTicker(articleText);
          if (extracted.exchange && extracted.ticker === ticker) {
            exchange = extracted.exchange;
            tickerWithExchange = `${exchange}:${ticker}`;
          } else {
            tickerWithExchange = ticker; // Fallback to just ticker if exchange not found
          }
        } else {
          tickerWithExchange = ticker;
        }
        console.log(`   ✅ Using manual ticker: ${tickerWithExchange}`);
      }
      
      // 1. If no manual ticker, check articleToUse.ticker field FIRST (from Trello card metadata)
      // This ensures the ticker from the Trello card is used before extracting from content
      if (articleToUse && !ticker) {
        // PRIORITY 1: Check direct ticker field (from Trello card)
        if (articleToUse.ticker && /^[A-Z]{1,5}$/.test(articleToUse.ticker.toUpperCase().trim())) {
          ticker = articleToUse.ticker.toUpperCase().trim();
          // Try to find exchange from article content
          const articleText = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.title || '';
          const extracted = extractExchangeAndTicker(articleText);
          if (extracted.exchange && extracted.ticker === ticker) {
            exchange = extracted.exchange;
            tickerWithExchange = `${exchange}:${ticker}`;
          } else {
            tickerWithExchange = ticker;
          }
          console.log(`   ✅ Using ticker from article.ticker field (from Trello card): ${tickerWithExchange}`);
        }
      }
      
      // 2. If still no ticker, try to get ticker with exchange from article content
      // ONLY accept tickers in (EXCHANGE:TICKER) format
      if (articleToUse && !ticker) {
        // Check article body/content for (EXCHANGE:TICKER) format - prioritize full body
        const articleText = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.summary || '';
        const extracted = extractExchangeAndTicker(articleText);
        if (extracted.ticker) {
          ticker = extracted.ticker;
          exchange = extracted.exchange;
          tickerWithExchange = exchange ? `${exchange}:${ticker}` : ticker;
          console.log(`   ✅ Extracted ticker from article content (EXCHANGE:TICKER format): ${tickerWithExchange}`);
        }
        
        // Also check title for (EXCHANGE:TICKER) format
        if (!ticker && articleToUse.title) {
          const extractedTitle = extractExchangeAndTicker(articleToUse.title);
          if (extractedTitle.ticker) {
            ticker = extractedTitle.ticker;
            exchange = extractedTitle.exchange;
            tickerWithExchange = exchange ? `${exchange}:${ticker}` : ticker;
            console.log(`   ✅ Extracted ticker from article title (EXCHANGE:TICKER format): ${tickerWithExchange}`);
          }
        }
        
        // Check stocks array LAST (only if no ticker field and no ticker in content)
        // This prevents stocks array from overriding the intended ticker from the Trello card
        if (!ticker && articleToUse.stocks && Array.isArray(articleToUse.stocks) && articleToUse.stocks.length > 0) {
          // Only use stocks array if ticker field wasn't present (avoid overriding card ticker)
          // Check if first stock is a string or has ticker field
          const firstStock = articleToUse.stocks[0];
          let stockStr = '';
          if (typeof firstStock === 'string') {
            stockStr = firstStock;
          } else if (typeof firstStock === 'object' && firstStock !== null) {
            stockStr = firstStock.ticker || firstStock.symbol || firstStock.name || '';
          }
          
          if (stockStr && /^[A-Z]{1,5}$/.test(stockStr.toUpperCase().trim())) {
            // Use the first stock directly (no need for EXCHANGE:TICKER format here since it's from stocks array)
            ticker = stockStr.toUpperCase().trim();
            // Try to find exchange from content
            const articleText = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.title || '';
            const extracted = extractExchangeAndTicker(articleText);
            if (extracted.exchange && extracted.ticker === ticker) {
              exchange = extracted.exchange;
              tickerWithExchange = `${exchange}:${ticker}`;
            } else {
              tickerWithExchange = ticker;
            }
            console.log(`   ⚠️  Using ticker from stocks array (no ticker field found): ${tickerWithExchange}`);
          }
        }
      }
      
      // 2. If still no ticker, try extracting from pitch (ONLY (EXCHANGE:TICKER) format)
      if (!ticker) {
        const extractedPitch = extractExchangeAndTicker(pitch);
        if (extractedPitch.ticker) {
          ticker = extractedPitch.ticker;
          exchange = extractedPitch.exchange;
          tickerWithExchange = exchange ? `${exchange}:${ticker}` : ticker;
          console.log(`   ✅ Extracted ticker from pitch (EXCHANGE:TICKER format): ${tickerWithExchange}`);
        }
      }
      
      // Use ticker with exchange if available, otherwise just ticker
      const finalTicker = tickerWithExchange || ticker;
      
      // If we still don't have a valid ticker, we can't proceed
      if (!ticker || !/^[A-Z]{1,5}$/.test(ticker)) {
        throw new Error(`TICKER_REQUIRED: No valid stock ticker found. The WGO Article Generator requires a stock ticker to generate technical analysis. Please provide a ticker manually.`);
      }
      
      if (articleToUse) {
        // Use the specific article that was pitched - prioritize full body over teaser
        scrapedContent = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.summary || pitch;
        
        // Build selectedArticles array with the article data
        selectedArticles = [{
          title: articleToUse.title || articleToUse.headline || '',
          body: articleToUse.body || articleToUse.content || articleToUse.teaser || '',
          url: articleToUse.url || '',
          date: articleToUse.created ? formatArticleDate(articleToUse.created) : undefined
        }];
        
        console.log(`   ✅ Using WGO Technical Analysis endpoint with ticker: ${ticker} and news context`);
        console.log(`   📊 Ticker source: ${manualTicker ? 'MANUAL (user-provided)' : (articleToUse?.ticker ? 'article.ticker field' : (articleToUse?.stocks ? 'article.stocks array' : 'extracted from content/pitch'))}`);
        console.log(`   Article title: ${selectedArticles[0].title || 'No title'}`);
        console.log(`   Scraped content length: ${scrapedContent.length} chars`);
        if (selectedArticle) {
          console.log(`   ✅ Using the exact article from the pitch`);
        }
        // Warn if ticker might be incorrect
        if (ticker && ticker.length <= 2) {
          console.log(`   ⚠️  WARNING: Ticker "${ticker}" is very short - please verify this is correct`);
        }
      } else {
        // No news articles - use pitch as scrapedContent
        scrapedContent = pitch;
        console.log(`   ✅ Using WGO Technical Analysis endpoint with ticker: ${ticker}`);
        console.log(`   No news articles available, using pitch as scrapedContent (${pitch.length} chars)`);
      }
      
      // Ensure scrapedContent is never empty
      if (!scrapedContent || scrapedContent.trim().length === 0) {
        scrapedContent = pitch;
        console.log(`   ⚠️  scrapedContent was empty, using pitch as fallback`);
      }
      
      // The technical-analysis endpoint automatically fetches technical data and market context
      // IMPORTANT: The endpoint expects tickers as a STRING (comma-separated), not an array
      // It will split the string by commas internally: tickers.split(',')
      // Use ticker with exchange if available (e.g., "NYSE:CRM"), otherwise just ticker
      requestBody = {
        tickers: finalTicker || ticker, // String format - endpoint expects string and will split by comma internally
        scrapedContent: scrapedContent, // News/article content
        selectedArticles: selectedArticles.length > 0 ? selectedArticles : undefined, // Optional: structured article data
      };
      
      console.log(`   ✅ Final WGO Technical Analysis request body: tickers="${finalTicker || ticker}" (string), scrapedContent length=${scrapedContent.length}`);
      console.log(`   📊 Technical analysis will be automatically fetched and included in the article`);
    } else if (isWGOGenerator) {
      // Format for WGO Article Generator (wiim-project-v2) - other endpoints (story, wgo, etc.)
      // Format for WGO Article Generator (wiim-project-v2)
      // Extract ticker from topic first, then from pitch
      let ticker = extractedTopic.toUpperCase().trim();
      // If topic is not a valid ticker (has spaces, numbers, etc), try to extract
      if (!/^[A-Z]{1,5}$/.test(ticker)) {
        ticker = extractTickerFromPitch(pitch, extractedTopic) || ticker.replace(/[^A-Z]/g, '').substring(0, 5);
      }
      
      // The story endpoint ALWAYS requires sourceText
      // Use story endpoint if news is available, otherwise use wgo-no-news
      if (isWGONoNews) {
        // wgo-no-news endpoint expects just a ticker (no sourceText needed)
        requestBody = {
          ticker: ticker,
        };
        console.log(`   ✅ Using WGO No News endpoint with ticker: ${ticker}`);
      } else if (isWGOTechnicalAnalysis) {
        // technical-analysis endpoint - integrated approach that fetches technical data automatically
        // It expects: ticker, scrapedContent or selectedArticles for news context
        let scrapedContent = '';
        let selectedArticles: any[] = [];
        
        // Prioritize the selectedArticle (the one from the pitch) over other articles
        const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
        
        if (articleToUse) {
          // Use the specific article that was pitched
          scrapedContent = articleToUse.body || articleToUse.teaser || articleToUse.content || articleToUse.summary || pitch;
          
          // Build selectedArticles array with the article data
          selectedArticles = [{
            title: articleToUse.title || articleToUse.headline || '',
            body: articleToUse.body || articleToUse.teaser || '',
            url: articleToUse.url || '',
            date: articleToUse.created ? formatArticleDate(articleToUse.created) : undefined
          }];
          
          console.log(`   ✅ Using WGO Technical Analysis endpoint with ticker: ${ticker} and news context`);
          console.log(`   Article title: ${selectedArticles[0].title || 'No title'}`);
          console.log(`   Scraped content length: ${scrapedContent.length} chars`);
          if (selectedArticle) {
            console.log(`   ✅ Using the exact article from the pitch`);
          }
        } else {
          // No news articles - use pitch as scrapedContent
          scrapedContent = pitch;
          console.log(`   ✅ Using WGO Technical Analysis endpoint with ticker: ${ticker}`);
          console.log(`   No news articles available, using pitch as scrapedContent (${pitch.length} chars)`);
        }
        
        // Ensure scrapedContent is never empty
        if (!scrapedContent || scrapedContent.trim().length === 0) {
          scrapedContent = pitch;
          console.log(`   ⚠️  scrapedContent was empty, using pitch as fallback`);
        }
        
        // The technical-analysis endpoint automatically fetches technical data and market context
        // It just needs ticker and news context (scrapedContent or selectedArticles)
        requestBody = {
          ticker: ticker,
          scrapedContent: scrapedContent, // News/article content
          selectedArticles: selectedArticles.length > 0 ? selectedArticles : undefined, // Optional: structured article data
        };
        
        console.log(`   ✅ Final WGO Technical Analysis request body: ticker=${ticker}, scrapedContent length=${scrapedContent.length}`);
        console.log(`   📊 Technical analysis will be automatically fetched and included in the article`);
      } else {
        // story endpoint ALWAYS requires sourceText
        let sourceText = pitch; // Default to pitch
        let headline = '';
        
        // Prioritize the selectedArticle (the one from the pitch) over other articles
        const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
        
        let articleDate: string | undefined;
        
        if (articleToUse) {
          // Use the specific article that was pitched - prioritize full body over teaser
          sourceText = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.summary || pitch;
          headline = articleToUse.title || articleToUse.headline || '';
          
          // Format the date for the article
          articleDate = formatArticleDate(articleToUse.created);
          
          console.log(`   ✅ Using WGO Story endpoint with ticker: ${ticker} and selected article`);
          console.log(`   Article title: ${headline || 'No title'}`);
          console.log(`   Article date: ${articleDate}`);
          console.log(`   Source text length: ${sourceText.length} chars`);
          if (selectedArticle) {
            console.log(`   ✅ Using the exact article from the pitch`);
          }
        } else {
          // No news articles - use pitch as sourceText (required field)
          headline = pitch.split('\n')[0].replace('Proposed Article: ', '').trim();
          console.log(`   ✅ Using WGO Story endpoint with ticker: ${ticker}`);
          console.log(`   No news articles available, using pitch as sourceText (${pitch.length} chars)`);
        }
        
        // Ensure sourceText is never empty (story endpoint requires it)
        if (!sourceText || sourceText.trim().length === 0) {
          sourceText = pitch;
          console.log(`   ⚠️  sourceText was empty, using pitch as fallback`);
        }
        
        requestBody = {
          ticker: ticker,
          sourceText: sourceText, // Always required for story endpoint
          headline: headline || undefined, // Optional field
          date: articleDate || undefined, // Pass formatted date
        };
        
        console.log(`   ✅ Final WGO Story request body: ticker=${ticker}, sourceText length=${sourceText.length}, headline=${headline || 'none'}`);
      }
    } else if (isComprehensiveArticle) {
      // Format for news-story-generator Next.js app
      console.log(`   ✅ Using Comprehensive Article format`);
      
      // Use the actual article/PR content, not just the pitch
      // Prioritize the selectedArticle (the one from the pitch) over other articles
      const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
      
      let sourceText = pitch; // Default to pitch
      let ticker = extractTickerFromPitch(pitch, extractedTopic) || extractedTopic;
      
      if (articleToUse) {
        // Use the actual article/PR body content - prioritize full body over teaser
        sourceText = articleToUse.body || articleToUse.content || articleToUse.teaser || articleToUse.summary || pitch;
        
        // Extract ticker from article if available
        if (articleToUse.ticker) {
          ticker = articleToUse.ticker;
        } else if (articleToUse.stocks && Array.isArray(articleToUse.stocks) && articleToUse.stocks.length > 0) {
          const firstStock = articleToUse.stocks[0];
          if (typeof firstStock === 'string') {
            ticker = firstStock;
          } else if (typeof firstStock === 'object' && firstStock !== null) {
            ticker = firstStock.ticker || firstStock.symbol || firstStock.name || ticker;
          }
        }
        
        console.log(`   ✅ Using selected article/PR content for comprehensive article`);
        console.log(`   Article title: ${articleToUse.title || articleToUse.headline || 'No title'}`);
        console.log(`   Source text length: ${sourceText.length} chars`);
        console.log(`   Ticker: ${ticker}`);
      } else {
        console.log(`   ⚠️  No article/PR content available, using pitch as sourceText`);
      }
      
      requestBody = {
        sourceText: sourceText,
        ticker: ticker || undefined,
        includeMarketData: true,
        includeCTA: true,
        includeSubheadings: true,
        includeRelatedArticles: true, // Request related articles for "Read Next" link
      };
    } else {
      // Generic format for other APIs
      console.log(`   ⚠️  Using generic API format (no specific endpoint detected)`);
      requestBody = {
        pitch: pitch,
        topic: extractedTopic,
      };
    }
    
    // Final validation - ensure sourceText exists for story endpoint (both /story and /pr-story)
    if (config.apiUrl.includes('/api/generate/story') || config.apiUrl.includes('/api/generate/pr-story')) {
      if (!requestBody.sourceText || (typeof requestBody.sourceText === 'string' && requestBody.sourceText.trim().length === 0)) {
        console.error(`   ❌ ERROR: sourceText is missing or empty for story endpoint!`);
        console.error(`   Pitch length: ${pitch.length}`);
        console.error(`   RequestBody keys: ${Object.keys(requestBody).join(', ')}`);
        requestBody.sourceText = pitch; // Force it to use pitch
        console.log(`   ✅ Fixed: Using pitch as sourceText (${pitch.length} chars)`);
      }
      console.log(`   ✅ sourceText validated: length=${requestBody.sourceText.length} chars`);
    }
    
    console.log(`   Sending request - sourceText present: ${!!requestBody.sourceText}, length: ${requestBody.sourceText?.length || 0}`);
    console.log(`   Request body keys: ${Object.keys(requestBody).join(', ')}`);
    
    console.log(`   📤 Making POST request to: ${config.apiUrl}`);
    console.log(`   📦 Request body keys: ${Object.keys(requestBody).join(', ')}`);
    if (requestBody.ticker) {
      console.log(`   📦 Request body ticker: ${requestBody.ticker}`);
    }
    if (requestBody.tickers) {
      console.log(`   📦 Request body tickers: ${JSON.stringify(requestBody.tickers)}`);
    }
    if (requestBody.scrapedContent) {
      console.log(`   📦 Request body scrapedContent length: ${requestBody.scrapedContent.length} chars`);
    }
    if (requestBody.sourceText) {
      console.log(`   📦 Request body sourceText length: ${requestBody.sourceText.length} chars`);
    }
    
    // Log full request body for debugging (truncated if too long)
    const requestBodyStr = JSON.stringify(requestBody);
    if (requestBodyStr.length > 500) {
      console.log(`   📦 Request body preview: ${requestBodyStr.substring(0, 500)}...`);
    } else {
      console.log(`   📦 Full request body: ${requestBodyStr}`);
    }
    
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`   ❌ API error: ${response.status} ${response.statusText}`);
      console.error(`   ❌ Error response: ${errorText.substring(0, 500)}`);
      console.error(`   ❌ Requested URL: ${config.apiUrl}`);
      console.error(`   ❌ Request method: POST`);
      console.error(`   ❌ Request body keys: ${Object.keys(requestBody).join(', ')}`);
      if (config.apiUrl) {
        console.error(`   💡 Make sure the article generation service is running at: ${config.apiUrl}`);
        console.error(`   💡 Check if the endpoint path is correct (should be /api/generate/comprehensive-article or similar)`);
      }
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    
    console.log(`   Response received. Keys: ${Object.keys(data).join(', ')}`);
    
    // Handle technical-analysis endpoint response format
    // It returns: { analyses: [{ ticker, companyName, analysis, data }] }
    if (data.analyses && Array.isArray(data.analyses) && data.analyses.length > 0) {
      // Extract the analysis text from the first (or only) analysis
      const analysisData = data.analyses[0];
      const analysisText = analysisData.analysis;
      if (analysisText) {
        console.log(`   ✅ Found analysis field in analyses array, length: ${analysisText.length} chars`);
        // Return WGO output as-is to preserve the original WGO style
        // Only do minimal formatting to preserve the structure
        return formatWGOOutput(analysisText, selectedArticle, newsArticles, true);
      }
    }
    
    // Handle different response formats
    if (data.story) {
      console.log(`   ✅ Found story field, length: ${data.story.length} chars`);
      
      // For story endpoint responses, check if source link needs to be added
      // The story generator may not include it even when includeCTA=true
      const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
      const storyText = data.story;
      
      // Check if story already has a source link
      const hasSourceLink = /Read the full source article/i.test(storyText) && /<a\s+[^>]*href/i.test(storyText);
      
      if (!hasSourceLink && articleToUse && articleToUse.url) {
        console.log(`   ⚠️  Story missing source link - adding it automatically`);
        const articleUrl = articleToUse.url;
        const articleTitle = articleToUse.title || articleToUse.headline || 'Source Article';
        
        // Remove any plain text source mentions first
        let cleanedStory = storyText.replace(/Read the full source article:.*$/i, '').trim();
        
        // Add properly formatted HTML source link
        const sourceLink = `\n\n<p style="margin: 1.5em 0 0.5em 0; font-size: 0.9rem; color: #64748b;">
          <a href="${articleUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">Read the full source article: ${articleTitle}</a>
        </p>`;
        
        return cleanedStory + sourceLink;
      }
      
      return storyText; // Return story as-is if link already present or not needed
    }
    if (data.article) {
      console.log(`   ✅ Found article field, length: ${data.article.length} chars`);
      
      // Check if comprehensive article response includes relatedArticles for "Read Next" link
      if (data.relatedArticles && Array.isArray(data.relatedArticles) && data.relatedArticles.length > 0) {
        console.log(`   ✅ Found ${data.relatedArticles.length} related articles for Read Next link`);
        
        // Build Read Next section
        const readNextSection = `\n\n<div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb;">
  <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem; color: #1f2937;">Read Next</h3>
  <ul style="list-style: none; padding: 0; margin: 0;">
${data.relatedArticles.map((article: any, index: number) => {
          const title = article.title || article.headline || 'Untitled Article';
          const url = article.url || '#';
          return `    <li style="margin-bottom: 0.75rem;">
      <a href="${url}" style="color: #2563eb; text-decoration: none; font-weight: 500; font-size: 1rem;" target="_blank" rel="noopener noreferrer">${title}</a>
    </li>`;
        }).join('\n')}
  </ul>
</div>`;
        
        return data.article + readNextSection;
      }
      
      return data.article;
    }
    if (data.content) {
      console.log(`   ✅ Found content field, length: ${data.content.length} chars`);
      return data.content;
    }
    if (data.text) {
      console.log(`   ✅ Found text field, length: ${data.text.length} chars`);
      return data.text;
    }
    if (data.result) {
      console.log(`   ✅ Found result field`);
      return data.result;
    }
    if (typeof data === 'string') {
      console.log(`   ✅ Response is string, length: ${data.length} chars`);
      return data;
    }
    
    // If it's an object, try to find the article field or stringify
    console.log(`   ⚠️  Unexpected response format. Full response: ${JSON.stringify(data).substring(0, 500)}`);
    return JSON.stringify(data, null, 2);
  } catch (error: any) {
    console.error("Error calling HTTP API:", error);
    throw new Error(`Failed to generate article: ${error.message}`);
  }
}

/**
 * Format WGO output text to HTML with proper formatting
 * Converts markdown-style formatting to HTML and adds paragraph breaks
 */
function formatWGOOutput(text: string, selectedArticle?: any, newsArticles?: any[], preserveStyle: boolean = false): string {
  if (!text) return '';
  
  // If preserveStyle is true, return the text with minimal processing to preserve WGO style
  if (preserveStyle) {
    // Only normalize line breaks and convert markdown to HTML, but preserve the structure
    let formatted = text;
    
    // Convert markdown bold (**text**) to HTML bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Normalize line breaks
    formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Split by double line breaks to preserve paragraph structure from WGO
    let paragraphs = formatted.split(/\n\n+/);
    
    // If no double line breaks, split by single line breaks (WGO might use single breaks)
    if (paragraphs.length === 1 && formatted.includes('\n')) {
      paragraphs = formatted.split('\n').filter(p => p.trim().length > 0);
    }
    
    // Wrap each paragraph in <p> tags, preserving the original formatting
    let formattedParagraphs = paragraphs.map(para => {
      para = para.trim();
      if (!para) return '';
      
      // Preserve any existing HTML
      return `<p style="margin: 1em 0; line-height: 1.7; color: #1f2937;">${para}</p>`;
    }).filter(p => p.length > 0);
    
    // Get source article link if available
    const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
    let sourceLink = '';
    
    if (articleToUse) {
      const articleUrl = articleToUse.url || '';
      const articleTitle = articleToUse.title || articleToUse.headline || 'Source Article';
      
      if (articleUrl) {
        // Remove any existing plain text "Read the full source article" from the last paragraph
        // This handles cases where the WGO generator already included it as plain text
        if (formattedParagraphs.length > 0) {
          const lastPara = formattedParagraphs[formattedParagraphs.length - 1];
          // Check if the last paragraph contains plain text source link (not HTML link)
          if (/Read the full source article/i.test(lastPara) && !/<a\s+[^>]*href/i.test(lastPara)) {
            // Remove the plain text source link from the paragraph content
            formattedParagraphs[formattedParagraphs.length - 1] = lastPara.replace(/Read the full source article:.*$/i, '');
          }
        }
        
        // Create proper HTML hyperlink
        sourceLink = `<p style="margin: 1.5em 0 0.5em 0; font-size: 0.9rem; color: #64748b;">
          <a href="${articleUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">Read the full source article: ${articleTitle}</a>
        </p>`;
      }
    }
    
    let result = formattedParagraphs.join('\n');
    if (sourceLink) {
      result += '\n' + sourceLink;
    }
    
    return result;
  }
  
  // Original formatting logic (for backward compatibility)
  // Convert markdown bold (**text**) to HTML bold
  let formatted = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Normalize line breaks
  formatted = formatted.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split by double line breaks first (if they exist)
  let paragraphs = formatted.split(/\n\n+/);
  
  // If no double line breaks, intelligently split the text into logical paragraphs
  if (paragraphs.length === 1) {
    // Patterns that indicate the start of a new paragraph/section
    const splitPatterns = [
      /\s+(Currently, the (RSI|stock|MACD))/i,
      /\s+(The (MACD|RSI|moving averages?))/i,
      /\s+(Traders should)/i,
      /\s+(Over the past \d+ months?)/i,
      /\s+(In \w+, (a|an))/i,
      /\s+([A-Z][a-z]+ Price Action:)/,
    ];
    
    // Split on periods followed by space and capital letter
    // Then group sentences that belong together
    const sentences = formatted.split(/(\.\s+)(?=[A-Z])/);
    const newParagraphs: string[] = [];
    let currentParagraph = '';
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const fullSentence = currentParagraph + sentence;
      
      // Check if this sentence or the next one indicates a new paragraph
      if (i < sentences.length - 1) {
        const nextText = sentences.slice(i + 1).join('').substring(0, 50);
        const shouldSplit = splitPatterns.some(pattern => pattern.test(' ' + nextText));
        
        if (shouldSplit && fullSentence.trim().length > 30) {
          // Save current paragraph and start new one
          newParagraphs.push(fullSentence.trim());
          currentParagraph = '';
        } else {
          currentParagraph = fullSentence;
        }
      } else {
        currentParagraph = fullSentence;
      }
    }
    
    // Add remaining paragraph
    if (currentParagraph.trim()) {
      newParagraphs.push(currentParagraph.trim());
    }
    
    // Only use split paragraphs if we got meaningful splits
    if (newParagraphs.length > 1) {
      paragraphs = newParagraphs;
    }
  }
  
  // Process each paragraph - don't bold first and last paragraphs
  const formattedParagraphs = paragraphs.map((para, index) => {
    para = para.trim();
    if (!para) return '';
    
    const isFirst = index === 0;
    const isLast = index === paragraphs.length - 1;
    
    // Remove bold from first and last paragraphs
    if (isFirst || isLast) {
      para = para.replace(/<strong>(.+?)<\/strong>/g, '$1');
    }
    
    // If paragraph starts with a heading pattern (like "**Company Name**" or "MDIA Price Action:")
    if (/Price Action:/.test(para)) {
      return `<p style="margin: 1.5em 0 0.5em 0; font-weight: 600; font-size: 1.1em; color: #111827;">${para}</p>`;
    }
    
    // If paragraph starts with technical indicator patterns, add slight emphasis
    if (/^(Currently,|The (RSI|MACD|moving averages?)|Traders should|Over the past)/i.test(para)) {
      return `<p style="margin: 1.25em 0; line-height: 1.7; color: #374151;">${para}</p>`;
    }
    
    // Regular paragraph
    return `<p style="margin: 1em 0; line-height: 1.7; color: #1f2937;">${para}</p>`;
  }).filter(p => p.length > 0);
  
  // Get source article info for link and second paragraph
  const articleToUse = selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
  let sourceLink = '';
  let secondParagraph = '';
  
  if (articleToUse) {
    const articleUrl = articleToUse.url || '';
    const articleTitle = articleToUse.title || articleToUse.headline || 'Source Article';
    
    if (articleUrl) {
      sourceLink = `<p style="margin: 1.5em 0 0.5em 0; font-size: 0.9rem; color: #64748b;">
        <a href="${articleUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">Read the full source article: ${articleTitle}</a>
      </p>`;
    }
    
    // Extract second paragraph from article body - prioritize full body over teaser
    const articleText = articleToUse.body || articleToUse.content || articleToUse.teaser || '';
    if (articleText) {
      // Split into sentences and get second meaningful paragraph
      const sentences = articleText.split(/[.!?]\s+/).filter((s: string) => s.trim().length > 50);
      if (sentences.length >= 2) {
        // Get sentences 2-4 for second paragraph
        const secondParaSentences = sentences.slice(1, 4).join('. ');
        if (secondParaSentences.length > 100) {
          secondParagraph = `<p style="margin: 1.5em 0; line-height: 1.7; color: #4b5563; font-style: italic; border-left: 3px solid #e5e7eb; padding-left: 1rem;">
        ${secondParaSentences}${secondParaSentences.endsWith('.') ? '' : '.'}
      </p>`;
        }
      }
    }
  }
  
  // Join paragraphs and add source link and second paragraph
  let result = formattedParagraphs.join('\n');
  
  // Insert second paragraph after first paragraph if available
  if (secondParagraph && formattedParagraphs.length > 0) {
    result = formattedParagraphs[0] + '\n' + secondParagraph + '\n' + formattedParagraphs.slice(1).join('\n');
  }
  
  // Add source link at the end
  if (sourceLink) {
    result += '\n' + sourceLink;
  }
  
  return result;
}

/**
 * Format date for article display
 * If within 7 days: returns day of week (e.g., "Monday", "Tuesday")
 * If older: returns month/day format (e.g., "12/15")
 */
function formatArticleDate(articleDate: number | undefined): string {
  if (!articleDate) {
    return '[Day not provided]';
  }

  const articleDateObj = new Date(articleDate * 1000);
  const now = new Date();
  const diffTime = now.getTime() - articleDateObj.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // If within 7 days, use day of week
  if (diffDays >= 0 && diffDays < 7) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return daysOfWeek[articleDateObj.getDay()];
  }

  // Otherwise use month/day format
  const month = articleDateObj.getMonth() + 1; // getMonth() returns 0-11
  const day = articleDateObj.getDate();
  return `${month}/${day}`;
}

/**
 * Extract stock ticker from pitch text (e.g., "RKLB", "AAPL")
 * Prioritizes the topic/query over random words in the pitch
 */
function extractTickerFromPitch(pitch: string, topic?: string): string | null {
  if (!pitch) return null;
  
  // ONLY accept tickers in the format (EXCHANGE:TICKER) like (NYSE:CRM), (NASDAQ: SNPS), etc.
  // Allow optional space after colon: (NASDAQ:SNPS) or (NASDAQ: SNPS)
  const exchangePattern = /\(([A-Z]+):\s*([A-Z]{1,5})\)/i;
  const match = pitch.match(exchangePattern);
  if (match) {
    const ticker = match[2].toUpperCase().trim();
    if (ticker && ticker.length >= 1 && ticker.length <= 5 && /^[A-Z]+$/.test(ticker)) {
      return ticker;
    }
  }
  
  return null;
}

/**
 * Generate article using script from GitHub repo (cloned locally)
 */
async function generateWithGitHub(pitch: string, config: ArticleGenConfig): Promise<string> {
  if (!config.repoPath) {
    throw new Error("ARTICLE_GEN_REPO_PATH not set in .env file");
  }

  const scriptPath = join(config.repoPath, config.script || "generate_article.py");

  if (!existsSync(scriptPath)) {
    throw new Error(`Script not found in repo: ${scriptPath}`);
  }

  // Use the Python script from the repo
  const pythonConfig: ArticleGenConfig = {
    ...config,
    type: "python",
    pythonPath: scriptPath,
  };

  return generateWithPython(pitch, pythonConfig);
}

/**
 * Generate article using TypeScript file (via tsx)
 */
async function generateWithTypeScript(pitch: string, config: ArticleGenConfig): Promise<string> {
  const scriptPath = config.tsxPath || config.nodePath;
  
  if (!scriptPath) {
    throw new Error("ARTICLE_GEN_TSX_PATH or ARTICLE_GEN_NODE_PATH not set in .env file");
  }

  if (!existsSync(scriptPath)) {
    throw new Error(`TypeScript script not found: ${scriptPath}`);
  }

  try {
    console.log(`📘 Running TypeScript script: ${scriptPath}`);
    
    // Escape the pitch for command line
    const escapedPitch = pitch.replace(/"/g, '\\"');
    
    // Use tsx to run TypeScript directly
    const { stdout, stderr } = await execAsync(
      `npx tsx "${scriptPath}" "${escapedPitch}"`
    );

    if (stderr && !stderr.includes("Warning") && !stderr.includes("DeprecationWarning")) {
      console.warn("TypeScript script stderr:", stderr);
    }

    return stdout.trim();
  } catch (error: any) {
    console.error("Error calling TypeScript script:", error);
    throw new Error(`Failed to generate article: ${error.message}`);
  }
}

/**
 * Generate article using Node.js module
 */
async function generateWithNode(pitch: string, config: ArticleGenConfig): Promise<string> {
  if (!config.modulePath) {
    throw new Error("ARTICLE_GEN_MODULE_PATH not set in .env file");
  }

  try {
    console.log(`📦 Loading Node module: ${config.modulePath}`);
    
    // Dynamic import of the module (supports both .js and .ts if using tsx)
    const module = await import(config.modulePath);
    
    // Try common function names
    const generateFn = module.generateArticle || module.generate || module.default;
    
    if (typeof generateFn !== "function") {
      throw new Error("Module does not export a generate function. Expected: generateArticle, generate, or default export");
    }

    const article = await generateFn(pitch);
    return typeof article === "string" ? article : JSON.stringify(article);
  } catch (error: any) {
    console.error("Error calling Node module:", error);
    throw new Error(`Failed to generate article: ${error.message}`);
  }
}

/**
 * Load app-specific configuration
 */
function loadAppConfig(appName: string): ArticleGenConfig {
  const baseConfig = loadConfig();
  
  // If appName is "default", fall back to comprehensive (news-story-generator)
  if (appName === "default") {
    console.log(`   ⚠️  "default" app selected, falling back to comprehensive (news-story-generator)`);
    // Return comprehensive config if available, otherwise base config
    const comprehensiveUrl = process.env.ARTICLE_GEN_API_URL;
    if (comprehensiveUrl && comprehensiveUrl.includes('comprehensive-article')) {
      return {
        ...baseConfig,
        apiUrl: comprehensiveUrl
      };
    }
    return baseConfig;
  }
  
  // Load app-specific environment variables
  // Format: ARTICLE_GEN_APP_{APPNAME}_TYPE, ARTICLE_GEN_APP_{APPNAME}_URL, etc.
  const appUpper = appName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  
  const typeEnvKey = `ARTICLE_GEN_APP_${appUpper}_TYPE`;
  const urlEnvKey = `ARTICLE_GEN_APP_${appUpper}_URL`;
  
  const appType = process.env[typeEnvKey] || baseConfig.type;
  let appUrl = process.env[urlEnvKey];
  
  console.log(`   Looking for app config: ${typeEnvKey}=${appType}, ${urlEnvKey}=${appUrl || 'not set'}`);
  
    // Special handling for "story" app - if not set, try to convert base URL to story endpoint
    if (!appUrl && appName.toLowerCase() === 'story' && baseConfig.apiUrl) {
      // Convert comprehensive-article or other endpoints to pr-story endpoint (preferred for PR-related articles)
      appUrl = baseConfig.apiUrl.replace('/comprehensive-article', '/pr-story').replace('/api/generate/comprehensive-article', '/api/generate/pr-story');
      // Also handle if it's already pointing to /story, convert to /pr-story
      appUrl = appUrl.replace('/api/generate/story', '/api/generate/pr-story');
      // Fix any potential typos in the URL (e.g., htttp -> http)
      appUrl = appUrl.replace(/ht+tp:/g, 'http:');
      console.log(`   ⚠️  ${urlEnvKey} not found! Converting base URL to pr-story endpoint: ${appUrl}`);
    }
  
  if (!appUrl) {
    console.warn(`   ⚠️  ${urlEnvKey} not found! Falling back to base config URL: ${baseConfig.apiUrl || 'not set'}`);
  }
  
  return {
    ...baseConfig,
    type: appType as ArticleGenConfig["type"],
    apiUrl: appUrl || baseConfig.apiUrl,
  };
}

/**
 * Main function to generate article based on configuration
 * @param pitch - The article pitch to generate from
 * @param appName - Optional app name to use (e.g., "wgo", "comprehensive", "default")
 * @param topic - Optional topic/ticker to help with extraction
 * @param newsArticles - Optional news articles for WGO with news
 * @param selectedArticle - Optional specific article that was pitched (use this for WGO)
 */
export async function generateArticle(
  pitch: string, 
  appName: string = "default",
  topic?: string,
  newsArticles?: any[],
  selectedArticle?: any,
  manualTicker?: string
): Promise<string> {
  const config = loadAppConfig(appName);

  console.log(`\n📝 Generating article with app: ${appName}`);
  console.log(`   Method: ${config.type}`);
  console.log(`   API URL: ${config.apiUrl || 'not set'}`);
  console.log(`   Pitch: ${pitch.substring(0, 100)}...`);

  try {
    switch (config.type) {
      case "python":
        return await generateWithPython(pitch, config);
      
      case "http":
        return await generateWithHTTP(pitch, config, topic, newsArticles, selectedArticle, manualTicker);
      
      case "github":
        return await generateWithGitHub(pitch, config);
      
      case "node":
        return await generateWithNode(pitch, config);
      
      case "typescript":
      case "tsx":
        return await generateWithTypeScript(pitch, config);
      
      default:
        throw new Error(`Unknown article generation type: ${config.type}. Supported: python, http, github, node, typescript, tsx`);
    }
  } catch (error: any) {
    console.error(`❌ Article generation failed:`, error);
    throw error;
  }
}

/**
 * List available article generation apps in a directory
 */
export async function listAvailableApps(directory?: string): Promise<string[]> {
  const dir = directory || process.env.ARTICLE_GEN_DIRECTORY;
  
  if (!dir || !existsSync(dir)) {
    return [];
  }

  // This would require reading the directory - simplified for now
  return [];
}

