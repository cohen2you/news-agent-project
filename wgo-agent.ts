import { 
  StateGraph, 
  Annotation, 
  START, 
  END, 
  MemorySaver,
  Command,
  interrupt
} from "@langchain/langgraph";
import { generatePitchFromBenzinga } from "./benzinga-api";
import { generateArticle } from "./article-generator-integration";
import { TrelloService } from "./trello-service";

// WGO Agent State - specifically for WGO/WIIM stories
const WGOAgentState = Annotation.Root({
  topic: Annotation<string>,       // What to search for (ticker or topic)
  pitch: Annotation<string>,       // The generated pitch
  newsArticles: Annotation<any[]>, // News articles found from Benzinga
  selectedArticle: Annotation<any>, // The specific article selected
  humanFeedback: Annotation<string>, // "Approve" or "Reject" + notes
  selectedApp: Annotation<string>,  // Always "wgo" for this agent
  manualTicker: Annotation<string>,  // Manual ticker input
  finalArticle: Annotation<string>,  // The output from WGO generator
});

// NODE A: WGO Analyst - Scans Benzinga newsfeed AND press releases
const wgoAnalystNode = async (state: typeof WGOAgentState.State) => {
  console.log(`\n🕵️  WGO ANALYST: Scanning newsfeed and press releases for "${state.topic}"...`);
  
  const benzingaApiKey = process.env.BENZINGA_API_KEY; // Regular newsfeed API key
  const benzingaPrApiKey = process.env.BENZINGA_PR_API_KEY; // PR API key
  
  let newsArticles: any[] = [];
  let prArticles: any[] = [];
  let selectedArticle: any = null;
  let pitch = '';
  
  // Fetch news articles
  if (benzingaApiKey) {
    try {
      console.log(`   📰 Fetching news articles...`);
      const newsResult = await generatePitchFromBenzinga(state.topic, benzingaApiKey, false);
      newsArticles = newsResult.articles || [];
      if (newsResult.selectedArticle && !selectedArticle) {
        selectedArticle = newsResult.selectedArticle;
        pitch = newsResult.pitch;
      }
      console.log(`   ✅ Found ${newsArticles.length} news article(s)`);
    } catch (error) {
      console.error("Error fetching news from Benzinga:", error);
    }
  } else {
    console.warn(`⚠️  BENZINGA_API_KEY not set. Skipping news search.`);
  }
  
  // Fetch press releases
  if (benzingaPrApiKey) {
    try {
      console.log(`   📄 Fetching press releases...`);
      const prResult = await generatePitchFromBenzinga(state.topic, benzingaPrApiKey, true);
      prArticles = prResult.articles || [];
      // If we don't have a selected article yet, use the PR one
      if (prResult.selectedArticle && !selectedArticle) {
        selectedArticle = prResult.selectedArticle;
        pitch = prResult.pitch;
      }
      console.log(`   ✅ Found ${prArticles.length} press release(s)`);
    } catch (error) {
      console.error("Error fetching PRs from Benzinga:", error);
    }
  } else {
    console.warn(`⚠️  BENZINGA_PR_API_KEY not set. Skipping PR search.`);
  }
  
  // Combine all articles (news first, then PRs)
  const allArticles = [...newsArticles, ...prArticles];
  
  // Sort by date (most recent first)
  allArticles.sort((a, b) => {
    const dateA = a.created || 0;
    const dateB = b.created || 0;
    return dateB - dateA;
  });
  
  // If we have articles but no pitch yet, create one from the most recent
  if (allArticles.length > 0 && !pitch) {
    const topArticle = allArticles[0];
    const dateStr = topArticle.created 
      ? new Date(topArticle.created * 1000).toLocaleDateString()
      : 'Date not available';
    const summary = topArticle.teaser || topArticle.body?.substring(0, 200) || 'No summary available';
    const summaryPreview = summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
    
    const sourceType = prArticles.includes(topArticle) ? 'Benzinga Press Release' : 'Benzinga News';
    pitch = `Proposed Article: ${topArticle.title || 'Untitled Article'}

Source: ${sourceType}
Published: ${dateStr}

Summary: ${summaryPreview}

Proposed Angle: Analyze the implications of ${state.topic} based on recent market developments and news trends.`;
    
    if (!selectedArticle) {
      selectedArticle = topArticle;
    }
  }
  
  // If still no pitch, use fallback
  if (!pitch) {
    pitch = `Proposed Article: Technical Analysis - ${state.topic} Market Trends

Angle: Focus on technical indicators and market analysis for ${state.topic}.`;
  }
  
  console.log(`   📊 Total articles found: ${allArticles.length} (${newsArticles.length} news + ${prArticles.length} PRs)`);
  
  return { 
    pitch, 
    newsArticles: allArticles, // Return combined articles
    selectedArticle,
    selectedApp: "wgo" // Always use WGO generator for this agent
  };
};

// NODE B: WGO Trello Pitch - Creates cards in WGO/WIIM Stories list for each article
const wgoTrelloPitchNode = async (state: typeof WGOAgentState.State) => {
  console.log(`\n📌 WGO TRELLO: Creating pitch cards in WGO/WIIM Stories list...`);
  
  try {
    const trello = new TrelloService();
    // Always use WGO-specific list ID
    const listId = process.env.TRELLO_LIST_ID_WGO || process.env.TRELLO_LIST_ID;
    
    if (!listId) {
      console.error("❌ TRELLO_LIST_ID_WGO or TRELLO_LIST_ID not set in environment variables");
      return { finalArticle: "Error: TRELLO_LIST_ID_WGO not configured" };
    }

    // Get articles to process - use all articles, not just selected one
    const articlesToProcess = state.newsArticles && state.newsArticles.length > 0 
      ? state.newsArticles 
      : (state.selectedArticle ? [state.selectedArticle] : []);
    
    if (articlesToProcess.length === 0) {
      console.warn("⚠️  No articles to create cards for");
      return { finalArticle: "No articles found to create Trello cards." };
    }

    console.log(`   📝 Creating ${articlesToProcess.length} Trello card(s)...`);

    const baseUrl = process.env.APP_URL || 'http://localhost:3001';
    const generateArticleUrl = `${baseUrl}/trello/generate-article/{cardId}?selectedApp=wgo`;
    
    const createdCards: string[] = [];

    // Create a card for each article
    for (let i = 0; i < articlesToProcess.length; i++) {
      const article = articlesToProcess[i];
      
      try {
        // Extract ticker from article - prioritize the topic ticker if it exists in stocks array
        let ticker: string | undefined = undefined;
        const topicUpper = state.topic ? state.topic.toUpperCase().trim() : null;
        
        if (article.stocks && Array.isArray(article.stocks) && article.stocks.length > 0) {
          // First, try to find the topic ticker in the article's stocks array
          if (topicUpper) {
            const foundTopicTicker = article.stocks.find((stock: any) => {
              let stockTicker: string | null = null;
              if (typeof stock === 'string') {
                stockTicker = stock.toUpperCase().trim();
              } else if (typeof stock === 'object' && stock !== null) {
                const tickerStr = (stock as any).ticker || (stock as any).symbol || (stock as any).name || '';
                if (tickerStr) {
                  stockTicker = String(tickerStr).toUpperCase().trim();
                }
              }
              return stockTicker === topicUpper;
            });
            
            if (foundTopicTicker) {
              // Use the topic ticker if found in stocks array
              if (typeof foundTopicTicker === 'string') {
                ticker = foundTopicTicker.toUpperCase().trim();
              } else if (typeof foundTopicTicker === 'object' && foundTopicTicker !== null) {
                const tickerStr = (foundTopicTicker as any).ticker || (foundTopicTicker as any).symbol || (foundTopicTicker as any).name || '';
                if (tickerStr) {
                  ticker = String(tickerStr).toUpperCase().trim();
                }
              }
            }
          }
          
          // If topic ticker not found, fall back to first stock in array
          if (!ticker) {
            const firstStock = article.stocks[0];
            if (typeof firstStock === 'string') {
              ticker = firstStock.toUpperCase().trim();
            } else if (typeof firstStock === 'object' && firstStock !== null) {
              const tickerStr = (firstStock as any).ticker || (firstStock as any).symbol || (firstStock as any).name || '';
              if (tickerStr) {
                ticker = String(tickerStr).toUpperCase().trim();
              }
            }
          }
        }
        
        // Final fallback to topic if no stocks found
        if (!ticker && state.topic) {
          ticker = state.topic.toUpperCase().trim();
        }
        
        // Extract headline from article title
        let headline = article.title || article.headline || state.topic || 'Untitled WGO Story';
        
        // Add ticker prefix to headline if ticker exists (format: "TICKER... (rest of title)")
        if (ticker) {
          headline = `${ticker}... ${headline}`;
        }
        
        // Build summary from article
        const summary = article.teaser || (article.body ? article.body.substring(0, 500) : 'No summary available');
        const sourceUrl = article.url || article.link || 'No URL available';
        
        const date = article.created 
          ? new Date(article.created * 1000).toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZoneName: 'short'
            })
          : new Date().toLocaleString('en-US', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
              timeZoneName: 'short'
            });

        // Determine if this is a press release
        const isPressRelease = article.url?.includes('/pressreleases/') || 
                               (Array.isArray(article.channels) && article.channels.some((ch: any) => 
                                 String(ch).toLowerCase().includes('press release')));
        const sourceType = isPressRelease ? 'Benzinga Press Release' : 'Benzinga News';
        
        // Create pitch for this article
        const pitch = `Proposed Article: ${headline}

Source: ${sourceType}
Published: ${date}
${ticker ? `Company Ticker: ${ticker}` : ''}

Executive Summary:
${summary}

Proposed Angle: Provide technical analysis and market insights${ticker ? ` for ${ticker}` : ''} based on this ${isPressRelease ? 'press release' : 'news story'}.`;

        // Create Trello card with "Generate Article" link
        const card = await trello.createCardFromNewsWithGenerateLink(
          listId,
          headline,
          summary,
          sourceUrl,
          generateArticleUrl,
          {
            ticker: ticker,
            date: date,
            topic: state.topic,
            pitch: pitch.substring(0, 500)
          },
          article // Store full article data in card description
        );

        createdCards.push(`${headline} - ${card.url}`);
        console.log(`   ✅ [${i + 1}/${articlesToProcess.length}] WGO Trello card created: ${headline.substring(0, 50)}...`);
      } catch (error: any) {
        console.error(`   ❌ Error creating card for article ${i + 1}:`, error.message);
        // Continue with next article even if one fails
      }
    }

    console.log(`✅ Created ${createdCards.length} WGO Trello card(s) total`);
    
    return { 
      finalArticle: `✅ WGO Stories pitched to Trello!\n\nCreated ${createdCards.length} card(s):\n${createdCards.slice(0, 5).map((url, i) => `${i + 1}. ${url}`).join('\n')}${createdCards.length > 5 ? `\n... and ${createdCards.length - 5} more` : ''}\n\nYou can review and generate these WGO stories in Trello.` 
    };
  } catch (error: any) {
    console.error("Error creating WGO Trello cards:", error);
    return { 
      finalArticle: `Error creating WGO Trello cards: ${error.message}\n\nPlease check your Trello configuration in .env file.` 
    };
  }
};

// Build the WGO Agent Graph
// Workflow: WGO Analyst -> WGO Trello Pitch -> End
const wgoWorkflow = new StateGraph(WGOAgentState)
  .addNode("wgo_analyst", wgoAnalystNode)
  .addNode("wgo_trello_pitch", wgoTrelloPitchNode)
  .addEdge(START, "wgo_analyst")
  .addEdge("wgo_analyst", "wgo_trello_pitch")
  .addEdge("wgo_trello_pitch", END);

// Persistence
const checkpointer = new MemorySaver();

export const wgoGraph = wgoWorkflow.compile({ checkpointer });

