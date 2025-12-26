// Load environment variables from .env.local (preferred) or .env
import dotenv from "dotenv";
import { existsSync } from "fs";
import { join } from "path";

// Declare __dirname for TypeScript (available in CommonJS runtime)
declare const __dirname: string;

// Load .env.local first (if exists), then fall back to .env
const envLocalPath = join(process.cwd(), ".env.local");
const envPath = join(process.cwd(), ".env");

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log("✅ Loaded environment variables from .env.local");
  
  // Debug: Show WGO URL if it exists
  if (process.env.ARTICLE_GEN_APP_WGO_URL) {
    console.log(`✅ Found WGO URL: ${process.env.ARTICLE_GEN_APP_WGO_URL}`);
  } else {
    console.log("⚠️  ARTICLE_GEN_APP_WGO_URL not found in .env.local");
  }
  
  // Debug: Show API keys if they exist
  if (process.env.BENZINGA_API_KEY) {
    console.log(`✅ Found BENZINGA_API_KEY (length: ${process.env.BENZINGA_API_KEY.length})`);
  } else {
    console.log("⚠️  BENZINGA_API_KEY not found in .env.local");
  }
  
  if (process.env.BENZINGA_PR_API_KEY) {
    console.log(`✅ Found BENZINGA_PR_API_KEY (length: ${process.env.BENZINGA_PR_API_KEY.length})`);
  } else {
    console.log("⚠️  BENZINGA_PR_API_KEY not found in .env.local");
  }
  
  // Debug: Show Trello credentials if they exist
  if (process.env.TRELLO_API_KEY) {
    console.log(`✅ Found TRELLO_API_KEY (length: ${process.env.TRELLO_API_KEY.length})`);
  } else {
    console.log("⚠️  TRELLO_API_KEY not found in .env.local");
  }
  
  if (process.env.TRELLO_TOKEN) {
    console.log(`✅ Found TRELLO_TOKEN (length: ${process.env.TRELLO_TOKEN.length})`);
  } else {
    console.log("⚠️  TRELLO_TOKEN not found in .env.local");
  }
  
  if (process.env.TRELLO_LIST_ID) {
    console.log(`✅ Found TRELLO_LIST_ID: ${process.env.TRELLO_LIST_ID}`);
  } else {
    console.log("⚠️  TRELLO_LIST_ID not found in .env.local");
  }
  
  if (process.env.TRELLO_LIST_ID_PR) {
    console.log(`✅ Found TRELLO_LIST_ID_PR: ${process.env.TRELLO_LIST_ID_PR}`);
  }
  
  if (process.env.TRELLO_LIST_ID_WGO) {
    console.log(`✅ Found TRELLO_LIST_ID_WGO: ${process.env.TRELLO_LIST_ID_WGO}`);
  }
  
  if (process.env.TRELLO_LIST_ID_SUBMITTED) {
    console.log(`✅ Found TRELLO_LIST_ID_SUBMITTED: ${process.env.TRELLO_LIST_ID_SUBMITTED}`);
  } else {
    console.log("⚠️  TRELLO_LIST_ID_SUBMITTED not found (cards won't auto-move after generation)");
  }
  
  // Old editor agent is disabled by default - articles go directly to Submitted
  // Number verification runs automatically when cards are moved to Submitted
  console.log("ℹ️  Old editor agent is disabled - articles go directly to Submitted");
  if (process.env.EDITOR_NUMBER_VERIFICATION_ENABLED === 'true') {
    console.log("✅ Number verification is ENABLED - will run automatically when cards are moved to Submitted");
  } else {
    console.log("⚠️  Number verification is DISABLED - set EDITOR_NUMBER_VERIFICATION_ENABLED=true to enable");
  }
  
  if (process.env.TRELLO_LIST_ID_IN_PROGRESS) {
    console.log(`✅ Found TRELLO_LIST_ID_IN_PROGRESS: ${process.env.TRELLO_LIST_ID_IN_PROGRESS}`);
  } else {
    console.log("⚠️  TRELLO_LIST_ID_IN_PROGRESS not found (cards won't move to In Progress when generation starts)");
  }

  if (process.env.TRELLO_LIST_ID_ANALYST_NOTES) {
    console.log(`✅ Found TRELLO_LIST_ID_ANALYST_NOTES: ${process.env.TRELLO_LIST_ID_ANALYST_NOTES}`);
  } else {
    console.log("⚠️  TRELLO_LIST_ID_ANALYST_NOTES not found (email analyst agent won't create cards)");
  }

  if (process.env.TRELLO_LIST_ID_NEEDS_REVIEW) {
    const needsReviewListId = process.env.TRELLO_LIST_ID_NEEDS_REVIEW;
    if (needsReviewListId.toLowerCase().includes('your-') || needsReviewListId.toLowerCase().includes('placeholder') || needsReviewListId.length < 20) {
      console.log(`❌ TRELLO_LIST_ID_NEEDS_REVIEW appears to be a placeholder value: "${needsReviewListId}"`);
      console.log(`   ⚠️  Editor agent won't be able to escalate articles to human review without a valid list ID.`);
      console.log(`   💡 Run "npm run get-trello-ids" to find your "Needs Review" list ID and update .env.local`);
    } else {
      console.log(`✅ Found TRELLO_LIST_ID_NEEDS_REVIEW: ${needsReviewListId}`);
    }
  } else {
    console.log("⚠️  TRELLO_LIST_ID_NEEDS_REVIEW not found (editor agent won't escalate to human review)");
  }

  if (process.env.OPENAI_API_KEY) {
    console.log(`✅ Found OPENAI_API_KEY (length: ${process.env.OPENAI_API_KEY.length})`);
  } else {
    console.log("⚠️  OPENAI_API_KEY not found (editor agent won't be able to review articles)");
  }
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ Loaded environment variables from .env");
} else {
  console.warn("⚠️  No .env.local or .env file found");
}
import express from "express";
import cors from "cors";
import { Command } from "@langchain/langgraph";
import { graph } from "./agent"; // Import the main graph (for PR/general articles)
import { wgoGraph } from "./wgo-agent"; // Import the WGO-specific agent
import { graph as emailAnalystGraph } from "./email-analyst-agent"; // Import the Email Analyst agent
import { graph as analystStoryGraph } from "./analyst-story-agent"; // Import the Analyst Story Generator agent
import { editorGraph } from "./editor-agent"; // Import the Editor agent
import { numberVerificationGraph } from "./editor-number-verification-agent"; // Import the Number Verification agent
import { readFileSync } from "fs";
import { exec } from "child_process";
import { createServer } from "net";
import { PRMonitor } from "./pr-monitor";
import { SP500_TOP_100, MONITORED_STOCKS } from "./sp500-tickers";

const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] ${req.method} ${req.path}`);
  if (Object.keys(req.body).length > 0) {
    console.log(`  Body:`, JSON.stringify(req.body, null, 2));
  }
  if (Object.keys(req.query).length > 0) {
    console.log(`  Query:`, JSON.stringify(req.query, null, 2));
  }
  next();
});

/**
 * Get list of available article generation apps from environment
 */
// Endpoint to get available apps without starting an agent run
app.get("/available-apps", (req, res) => {
  const apps = getAvailableApps();
  res.json({ availableApps: apps });
});

function getAvailableApps(): Array<{ name: string; label: string; url?: string }> {
  const apps: Array<{ name: string; label: string; url?: string }> = [];
  
  console.log("🔍 Loading available apps from environment...");

  // Check for comprehensive article generator (news-story-generator)
  const comprehensiveUrl = process.env.ARTICLE_GEN_API_URL;
  if (comprehensiveUrl && comprehensiveUrl.includes('comprehensive-article')) {
    apps.push({
      name: "comprehensive",
      label: "News Story Generator",
      url: comprehensiveUrl
    });
  }

  // Check for WGO generator
  const wgoUrl = process.env.ARTICLE_GEN_APP_WGO_URL;
  console.log("🔍 Checking for WGO app:", wgoUrl ? `Found: ${wgoUrl}` : "Not found");
  console.log("🔍 All ARTICLE_GEN_APP_* variables:", 
    Object.keys(process.env)
      .filter(k => k.startsWith('ARTICLE_GEN_APP_'))
      .map(k => `${k}=${process.env[k]}`)
      .join(', ') || 'None'
  );
  if (wgoUrl) {
    apps.push({
      name: "wgo",
      label: "WGO Article Generator",
      url: wgoUrl
    });
  }

  // Check for other configured apps
  const envKeys = Object.keys(process.env);
  envKeys.forEach(key => {
    const match = key.match(/^ARTICLE_GEN_APP_([A-Z_]+)_URL$/);
    if (match) {
      const appName = match[1].toLowerCase().replace(/_/g, '-');
      const appLabel = match[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      const appUrl = process.env[key];
      
      if (appUrl && !apps.find(a => a.name === appName)) {
        apps.push({
          name: appName,
          label: appLabel,
          url: appUrl
        });
      }
    }
  });

  console.log(`✅ Found ${apps.length} available apps:`, apps.map(a => a.label).join(", "));
  return apps;
}

// 1. START ENDPOINT: Triggers the Analyst
// Usage: POST /start { "topic": "AI Trends", "prOnly": false }
app.post("/start", async (req, res) => {
  const { topic, prOnly } = req.body;
  
  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  // Generate a random ID for this specific article run
  const threadId = `run_${Date.now()}`;
  const config = { configurable: { thread_id: threadId } };

  console.log(`\n--- Starting Run ${threadId} for topic: ${topic}${prOnly ? ' (PRs only)' : ''} ---`);

  try {
    // Run the graph. It will stop automatically at the 'interrupt'
    // We use .invoke() to start it.
    await graph.invoke({ topic, prOnly: prOnly || false }, config);

    // Once it pauses, we fetch the state to see what the pitch is
    const state = await graph.getState(config);
    const currentPitch = state.values.pitch;
    const newsArticles = state.values.newsArticles || [];

    // Get available apps from environment
    const availableApps = getAvailableApps();

    // Format articles for frontend display
    const formattedArticles = newsArticles.map((article: any, index: number) => {
      // Format date safely
      let dateStr = 'Date not available';
      try {
        if (article.created) {
          const date = new Date(article.created * 1000);
          if (!isNaN(date.getTime())) {
            dateStr = date.toLocaleDateString();
          }
        }
      } catch (e) {
        // Keep default
      }
      
      // Get summary/teaser
      const summary = article.teaser || article.body?.substring(0, 200) || 'No summary available';
      const summaryPreview = summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
      
      return {
        index: index,
        title: article.title || 'Untitled Article',
        summary: summaryPreview,
        date: dateStr,
        url: article.url || '',
        body: article.body || '',
        teaser: article.teaser || '',
        created: article.created
      };
    });

    // Return the pitch, ID, articles, and available apps to the frontend
    res.json({
      status: "paused_for_review",
      threadId: threadId,
      pitch: currentPitch,
      articles: formattedArticles,
      availableApps: availableApps
    });
  } catch (error) {
    console.error("Error in /start:", error);
    res.status(500).json({ error: "Failed to start agent workflow" });
  }
});

// 1.5. REGENERATE PITCH ENDPOINT: Regenerates pitch for a specific article
// Usage: POST /regenerate-pitch { "threadId": "run_123", "articleIndex": 0 }
app.post("/regenerate-pitch", async (req, res) => {
  const { threadId, articleIndex } = req.body;

  if (!threadId || articleIndex === undefined) {
    return res.status(400).json({ error: "threadId and articleIndex are required" });
  }

  const config = { configurable: { thread_id: threadId } };

  try {
    // Get current state to access articles
    const currentState = await graph.getState(config);
    const newsArticles = currentState.values.newsArticles || [];
    
    if (articleIndex < 0 || articleIndex >= newsArticles.length) {
      return res.status(400).json({ error: "Invalid article index" });
    }

    const selectedArticle = newsArticles[articleIndex];
    const topic = currentState.values.topic;
    const prOnly = currentState.values.prOnly || false;

    // Generate a new pitch for the selected article
    const { generatePitchFromBenzinga } = await import("./benzinga-api");
    const usePRKey = prOnly === true;
    const apiKey = usePRKey 
      ? process.env.BENZINGA_PR_API_KEY 
      : process.env.BENZINGA_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Benzinga API key not configured" });
    }

    // Generate pitch from the selected article
    const dateStr = selectedArticle.created 
      ? new Date(selectedArticle.created * 1000).toLocaleDateString() 
      : 'Date not available';
    
    const summary = selectedArticle.teaser || selectedArticle.body?.substring(0, 200) || 'No summary available';
    const summaryPreview = summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
    
    const newPitch = `Proposed Article: ${selectedArticle.title || 'Untitled Article'}

Source: Benzinga News
Published: ${dateStr}

Summary: ${summaryPreview}

Proposed Angle: Analyze the implications of ${topic} based on recent market developments and news trends.`;

    // Update the state with the new pitch and selected article
    await graph.invoke(
      new Command({ 
        update: { 
          pitch: newPitch,
          selectedArticle: selectedArticle
        }
      }), 
      config
    );

    res.json({
      status: "success",
      pitch: newPitch,
      selectedArticle: {
        index: articleIndex,
        title: selectedArticle.title || 'Untitled Article',
        date: dateStr,
        summary: summaryPreview
      }
    });
  } catch (error: any) {
    console.error("Error regenerating pitch:", error);
    res.status(500).json({ error: "Failed to regenerate pitch" });
  }
});

// 1b. WGO START ENDPOINT: Triggers the WGO Agent (for WGO/WIIM stories)
// Usage: POST /wgo/start { "topic": "TSLA" }
app.post("/wgo/start", async (req, res) => {
  const { topic } = req.body;
  
  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  // Generate a random ID for this specific WGO run
  const threadId = `wgo_run_${Date.now()}`;
  const config = { configurable: { thread_id: threadId } };

  console.log(`\n--- Starting WGO Agent Run ${threadId} for topic: ${topic} ---`);

  try {
    // Run the WGO graph - it will create a Trello card and end
    await wgoGraph.invoke({ topic }, config);

    // Get the final state
    const state = await wgoGraph.getState(config);
    const currentPitch = state.values.pitch;
    const newsArticles = state.values.newsArticles || [];
    const finalResult = state.values.finalArticle || "WGO story pitched to Trello";

    // Format articles for frontend display
    const formattedArticles = newsArticles.map((article: any, index: number) => {
      let dateStr = 'Date not available';
      try {
        if (article.created) {
          const date = new Date(article.created * 1000);
          if (!isNaN(date.getTime())) {
            dateStr = date.toLocaleDateString();
          }
        }
      } catch (e) {
        // Keep default
      }
      
      const summary = article.teaser || article.body?.substring(0, 200) || 'No summary available';
      const summaryPreview = summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
      
      return {
        index: index,
        title: article.title || 'Untitled Article',
        summary: summaryPreview,
        date: dateStr,
        url: article.url || '',
        body: article.body || '',
        teaser: article.teaser || '',
        created: article.created
      };
    });

    // Return the result
    res.json({
      threadId,
      pitch: currentPitch,
      articles: formattedArticles,
      result: finalResult,
      agentType: "wgo"
    });
  } catch (error: any) {
    console.error("Error in /wgo/start:", error);
    res.status(500).json({ error: "Failed to start WGO agent workflow" });
  }
});

// Convenience GET endpoint to trigger WGO by ticker (for Trello control card links)
app.get("/wgo/start-link/:ticker", async (req, res) => {
  const { ticker } = req.params;
  if (!ticker) {
    return res.status(400).json({ error: "Ticker is required" });
  }

  // Reuse the POST logic with a generated threadId
  const threadId = `wgo_link_${Date.now()}`;
  const config = { configurable: { thread_id: threadId } };

  console.log(`\n--- Starting WGO Agent Run ${threadId} for ticker (link): ${ticker} ---`);

  try {
    await wgoGraph.invoke({ topic: ticker }, config);
    const state = await wgoGraph.getState(config);
    const currentPitch = state.values.pitch;
    const newsArticles = state.values.newsArticles || [];
    const finalResult = state.values.finalArticle || "WGO story pitched to Trello";

    res.json({
      threadId,
      pitch: currentPitch,
      articles: newsArticles,
      result: finalResult,
      agentType: "wgo",
    });
  } catch (error: any) {
    console.error("Error in /wgo/start-link:", error);
    res.status(500).json({ error: "Failed to start WGO agent from link" });
  }
});

// Helper: Create a control card in the WGO/WIIM list with quick links
app.post("/trello/wgo-control-card", async (req, res) => {
  console.log(`\n📌 [POST /trello/wgo-control-card] Creating WGO control card...`);
  try {
    const listId = process.env.TRELLO_LIST_ID_WGO || process.env.TRELLO_LIST_ID;

    if (!listId) {
      return res.status(500).json({ error: "TRELLO_LIST_ID_WGO or TRELLO_LIST_ID not configured" });
    }

    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const title = "🔍 WGO Search Control";
    const description = `
Use the links below to quickly trigger a WGO search for a specific ticker.
The WGO agent will scan for recent news articles AND press releases, then create new cards in this list.

---

**Quick Searches:**
- [Search TSLA](${appUrl}/wgo/start-link/TSLA)
- [Search AAPL](${appUrl}/wgo/start-link/AAPL)
- [Search MSFT](${appUrl}/wgo/start-link/MSFT)

---

**Chat to Search:**
Simply comment on this card with a ticker symbol (e.g., "AMD" or "Search AMD").
The agent will automatically trigger a WGO search and reply with results.

Example comments:
- \`AMD\`
- \`Search NVDA\`
- \`TSLA\`

---

**Custom Search:**
To search for another ticker, copy the link below and replace \`TICKER\` with your desired stock ticker:
\`\`\`
${appUrl}/wgo/start-link/TICKER
\`\`\`
Example: \`${appUrl}/wgo/start-link/GOOG\`

---

_This card is automatically managed. Please do not archive or delete._
`;

    // Check if a control card already exists to avoid duplicates
    const cardsInList = await trello.getCardsInList(listId);
    const existingControlCard = cardsInList.find(card => card.name === title);

    let card;
    if (existingControlCard) {
      console.log(`   ⚠️  WGO control card already exists (ID: ${existingControlCard.id}). Updating it.`);
      await trello.updateCardDescription(existingControlCard.id, description);
      card = existingControlCard;
    } else {
      card = await trello.createCard(listId, title, description);
      console.log(`   ✅ WGO control card created: ${card.url}`);
    }

    res.json({
      status: "completed",
      message: "WGO control card created/updated successfully.",
      cardUrl: card.url,
      cardId: card.id,
    });
  } catch (error: any) {
    console.error("❌ Error creating WGO control card:", error);
    res.status(500).json({ error: error.message || "Failed to create WGO control card" });
  }
});

// 2. APPROVE ENDPOINT: Triggers the Writer
// Usage: POST /approve { "threadId": "run_123", "decision": "yes", "selectedApp": "wgo", "selectedArticleIndex": 0 }
app.post("/approve", async (req, res) => {
  const { threadId, decision, selectedApp, selectedArticleIndex, manualTicker } = req.body;

  if (!threadId || !decision) {
    return res.status(400).json({ error: "threadId and decision are required" });
  }

  const config = { configurable: { thread_id: threadId } };

  console.log(`\n--- Resuming Run ${threadId} with decision: ${decision} ---`);
  if (selectedApp) {
    console.log(`   Selected app: ${selectedApp}`);
  }
  if (selectedArticleIndex !== undefined) {
    console.log(`   Selected article index: ${selectedArticleIndex}`);
  }

  try {
    // Get current state to access articles
    const currentState = await graph.getState(config);
    const newsArticles = currentState.values.newsArticles || [];
    
    // If an article index was selected, use that specific article
    let selectedArticle: any = null;
    if (selectedArticleIndex !== undefined && selectedArticleIndex !== null && 
        newsArticles[selectedArticleIndex]) {
      selectedArticle = newsArticles[selectedArticleIndex];
      console.log(`   Using article: "${selectedArticle?.title || 'Untitled'}"`);
    }
    
    // Resume the graph with the human decision, selected app, selected article, and manual ticker
    await graph.invoke(
      new Command({ 
        update: { 
          humanFeedback: decision,
          selectedApp: selectedApp || "default",
          selectedArticle: selectedArticle,
          manualTicker: manualTicker
        }
      }), 
      config
    );

    // Continue execution - invoke again to proceed past the interrupt
    await graph.invoke({}, config);

    // Get the final state
    const finalState = await graph.getState(config);
    
    res.json({
      status: "completed",
      finalArticle: finalState.values.finalArticle || "Article generation completed"
    });
  } catch (error) {
    console.error("Error in /approve:", error);
    res.status(500).json({ error: "Failed to resume agent workflow" });
  }
});

// Serve the dashboard HTML
app.get("/", (req, res) => {
  console.log("\n📄 [GET /] Serving index.html");
  try {
    // Try dist folder first (for production builds), then fall back to project root (for development)
    const distHtmlPath = join(__dirname, "index.html");
    const rootHtmlPath = join(process.cwd(), "index.html");
    const htmlPath = existsSync(distHtmlPath) ? distHtmlPath : rootHtmlPath;
    console.log(`📄 [GET /] Reading HTML from: ${htmlPath}`);
    const html = readFileSync(htmlPath, "utf-8");
    console.log(`📄 [GET /] ✅ HTML file loaded (${html.length} bytes)`);
    
    // Prevent caching in development to ensure fresh JavaScript
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.send(html);
  } catch (error) {
    console.error("❌ [GET /] Error serving dashboard:", error);
    res.status(500).send("Error loading dashboard");
  }
});

// Health check endpoint
// Debug endpoint to check WGO Control Card status
app.get("/debug/wgo-control-card", async (req, res) => {
  try {
    const controlCardId = process.env.TRELLO_WGO_CONTROL_CARD_ID;
    if (!controlCardId) {
      return res.json({
        configured: false,
        message: "TRELLO_WGO_CONTROL_CARD_ID not set in environment"
      });
    }

    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    console.log(`   🔗 Fetching comments from Trello card: ${controlCardId}`);
    const comments = await trello.getCardComments(controlCardId);

    // Filter bot comments
    const botCommentPatterns = [
      /^✅\s*Starting WGO search/i,
      /^✅\s*WGO Search Complete/i,
      /^✅\s*WGO search/i,
      /Found \d+ article\(s\):/i,
      /Check the "WGO\/WIIM Stories" list/i,
      /Pitch: Proposed Article:/i,
      /Source: Benzinga News/i
    ];
    
    const userComments = comments.filter(comment => {
      const text = comment.data.text.trim();
      return !botCommentPatterns.some(pattern => pattern.test(text));
    });

    return res.json({
      configured: true,
      controlCardId: controlCardId,
      totalComments: comments.length,
      userComments: userComments.length,
      lastProcessedCommentId: lastProcessedCommentId || null,
      monitorRunning: wgoControlCardMonitorInterval !== null,
      recentComments: comments.slice(0, 5).map(c => ({
        id: c.id,
        text: c.data.text.substring(0, 100),
        date: c.date,
        isBot: botCommentPatterns.some(p => p.test(c.data.text.trim()))
      })),
      recentUserComments: userComments.slice(0, 5).map(c => ({
        id: c.id,
        text: c.data.text.substring(0, 100),
        date: c.date
      }))
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Debug endpoint to reset WGO Control Card monitor state
app.post("/debug/wgo-control-card/reset", (req, res) => {
  const previousId = lastProcessedCommentId;
  lastProcessedCommentId = null;
  console.log(`\n🔄 [DEBUG] WGO Control Card monitor state reset`);
  console.log(`   Previous lastProcessedCommentId: ${previousId || 'none'}`);
  console.log(`   New lastProcessedCommentId: null (will reset on next check)`);
  return res.json({
    success: true,
    previousLastProcessedId: previousId,
    message: "Monitor state reset. On next check, all existing comments will be marked as processed."
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Test endpoint to verify analyst story generation endpoint is accessible
app.get("/analyst-story/test", (req, res) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  // Prefer standardized ARTICLE_GEN_APP_ANALYST_URL, fallback to legacy ANALYST_BASE_URL
  const analystUrl = process.env.ARTICLE_GEN_APP_ANALYST_URL || 
                     (process.env.ANALYST_BASE_URL ? `${process.env.ANALYST_BASE_URL}/api/generate/analyst-article` : null) ||
                     'http://localhost:3002/api/generate/analyst-article';
  const analystBaseUrl = process.env.ANALYST_BASE_URL || 'http://localhost:3002';
  res.json({
    status: "ok",
    message: "Analyst story endpoint is accessible",
    appUrl: appUrl,
    analystUrl: analystUrl,
    analystBaseUrl: analystBaseUrl, // Legacy, for backwards compatibility
    warnings: [
      appUrl.includes('localhost') ? "⚠️ APP_URL uses localhost - Trello web app cannot access this. Use a public URL or ngrok tunnel." : "✅ APP_URL is publicly accessible",
      analystUrl.includes('localhost') ? "⚠️ Analyst story generator URL uses localhost - make sure the server is running." : "✅ Analyst story generator URL is configured"
    ],
    endpoints: {
      generate: `${appUrl}/analyst-story/generate/:cardId`,
      test: `${appUrl}/analyst-story/test`,
      storyGenerator: analystUrl
    },
    environment: {
      ARTICLE_GEN_APP_ANALYST_URL: process.env.ARTICLE_GEN_APP_ANALYST_URL || 'NOT SET (preferred)',
      ANALYST_BASE_URL: process.env.ANALYST_BASE_URL || 'NOT SET (legacy, fallback)',
      ANALYST_AI_PROVIDER: process.env.ANALYST_AI_PROVIDER || 'NOT SET',
      TRELLO_LIST_ID_IN_PROGRESS: process.env.TRELLO_LIST_ID_IN_PROGRESS || 'NOT SET',
      TRELLO_LIST_ID_SUBMITTED: process.env.TRELLO_LIST_ID_SUBMITTED || 'NOT SET'
    }
  });
});

// Debug endpoint to list all stored analyst stories
app.get("/analyst-story/debug/stories", (req, res) => {
  const stories = Array.from(analystGeneratedStories.entries()).map(([id, story]) => ({
    id,
    cardId: story.cardId,
    title: story.title,
    ticker: story.ticker,
    createdAt: new Date(story.createdAt).toISOString(),
    storyLength: story.story.length
  }));
  
  res.json({
    total: analystGeneratedStories.size,
    stories: stories,
    viewUrl: (storyId: string) => `${process.env.APP_URL || 'http://localhost:3001'}/analyst-story/view/${storyId}`
  });
});

// Test endpoint to verify a specific card can be processed
app.get("/analyst-story/test-card/:cardId", async (req, res) => {
  const { cardId } = req.params;
  console.log(`\n🧪 [GET /analyst-story/test-card/${cardId}] Testing card processing...`);
  
  try {
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    
    // Try to read the card
    const cardData = await trello.getCardData(cardId);
    console.log(`   ✅ Card found: ${cardData.name}`);
    
    // Check if note data exists
    const hasNoteData = !!cardData.noteData;
    const hasPrData = !!cardData.prData;
    const descLength = cardData.desc?.length || 0;
    
    // Check for NOTE_DATA in description
    const hasNoteDataInDesc = cardData.desc?.includes('<!-- NOTE_DATA:') || false;
    
    res.json({
      status: "ok",
      card: {
        id: cardId,
        name: cardData.name,
        descLength: descLength,
        hasNoteData: hasNoteData,
        hasPrData: hasPrData,
        hasNoteDataInDesc: hasNoteDataInDesc,
        descPreview: cardData.desc?.substring(0, 200) || 'No description'
      },
      canProcess: hasNoteData || hasPrData || hasNoteDataInDesc || descLength > 100,
      issues: [
        !hasNoteData && !hasPrData && !hasNoteDataInDesc ? "⚠️ No note data found in card - may need to extract from description" : null,
        descLength === 0 ? "⚠️ Card has no description" : null,
        descLength > 16384 ? "⚠️ Card description exceeds Trello limit" : null
      ].filter(Boolean)
    });
  } catch (error: any) {
    console.error(`   ❌ Error testing card:`, error);
    res.status(500).json({
      status: "error",
      error: error.message,
      stack: error.stack
    });
  }
});

// Comprehensive diagnostic endpoint
app.get("/debug/system-status", async (req, res) => {
  const status: any = {
    timestamp: new Date().toISOString(),
    server: { running: true, port: PORT },
    trello: {
      apiKey: process.env.TRELLO_API_KEY ? `✅ Set (${process.env.TRELLO_API_KEY.length} chars)` : "❌ NOT SET",
      token: process.env.TRELLO_TOKEN ? `✅ Set (${process.env.TRELLO_TOKEN.length} chars)` : "❌ NOT SET",
      listIds: {
        default: process.env.TRELLO_LIST_ID || "❌ NOT SET",
        wgo: process.env.TRELLO_LIST_ID_WGO || "❌ NOT SET",
        analyst: process.env.TRELLO_LIST_ID_ANALYST_NOTES || "❌ NOT SET",
        pr: process.env.TRELLO_LIST_ID_PR || "❌ NOT SET"
      },
      controlCard: process.env.TRELLO_WGO_CONTROL_CARD_ID || "❌ NOT SET"
    },
    benzinga: {
      apiKey: process.env.BENZINGA_API_KEY ? `✅ Set (${process.env.BENZINGA_API_KEY.length} chars)` : "❌ NOT SET",
      prApiKey: process.env.BENZINGA_PR_API_KEY ? `✅ Set (${process.env.BENZINGA_PR_API_KEY.length} chars)` : "❌ NOT SET"
    },
    monitors: {
      wgoControlCard: wgoControlCardMonitorInterval !== null ? "✅ Running" : "❌ Not Running",
      autoButtonCheck: autoButtonCheckInterval !== null ? "✅ Running" : "❌ Not Running",
      emailPolling: process.env.EMAIL_CHECK_INTERVAL ? `✅ Configured (${process.env.EMAIL_CHECK_INTERVAL} min)` : "❌ Not Configured"
    }
  };

  // Test Trello connection
  try {
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    
    const testListId = process.env.TRELLO_LIST_ID_WGO || process.env.TRELLO_LIST_ID;
    if (testListId && testListId !== "❌ NOT SET") {
      try {
        const cards = await trello.getCardsInList(testListId);
        status.trello.connection = "✅ Connected";
        status.trello.testListCards = cards.length;
      } catch (error: any) {
        status.trello.connection = `❌ Error: ${error.message}`;
      }
    } else {
      status.trello.connection = "⚠️ No list ID to test";
    }
  } catch (error: any) {
    status.trello.connection = `❌ Error: ${error.message}`;
  }

  res.json(status);
});

// TEST ENDPOINT: Create Analyst Note Trello Card (for testing without email)
// Usage: POST /analyst/test-create-card
// Body: { subject, content, ticker?, firm?, analyst?, pdfContent? (base64), pdfFilename? }
app.post("/analyst/test-create-card", async (req, res) => {
  const { subject, content, ticker, firm, analyst, pdfContent, pdfFilename } = req.body;

  console.log(`\n🧪 [POST /analyst/test-create-card] Creating test Trello card`);

  if (!subject || !content) {
    return res.status(400).json({ error: "subject and content are required" });
  }

  try {
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    const listId = process.env.TRELLO_LIST_ID_ANALYST_NOTES;

    if (!listId) {
      return res.status(500).json({ error: "TRELLO_LIST_ID_ANALYST_NOTES not configured" });
    }

    // Build note data (similar to email agent)
    const noteData: any = {
      emailId: `test_${Date.now()}`,
      subject: subject,
      from: firm ? `${analyst || 'Analyst'} <analyst@${firm.toLowerCase().replace(/\s+/g, '')}.com>` : 'test@example.com',
      date: new Date(),
      ticker: ticker || null,
      firm: firm || 'Test Firm',
      analyst: analyst || 'Test Analyst',
      content: content,
      html: content,
      originalEmail: {
        headers: {},
      },
    };

    // If PDF content provided (base64), decode it
    if (pdfContent) {
      try {
        const pdfBuffer = Buffer.from(pdfContent, 'base64');
        noteData.pdfAttachment = {
          filename: pdfFilename || 'analyst-note.pdf',
          contentType: 'application/pdf',
          content: pdfBuffer,
        };
        console.log(`   📎 PDF attachment provided: ${noteData.pdfAttachment.filename} (${pdfBuffer.length} bytes)`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to decode PDF content:`, error);
      }
    }

    // Create card title with ticker prefix if available
    let title = subject;
    if (ticker) {
      title = `${ticker}... ${title}`;
    }

    // Build card description (same format as email agent)
    let description = `${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}\n\n`;

    description += `---\n\n`;
    description += `**Firm:** ${noteData.firm}\n`;
    description += `**Analyst:** ${noteData.analyst}\n`;
    if (noteData.ticker) {
      description += `**Ticker:** ${noteData.ticker}\n`;
    }
    description += `**Date:** ${noteData.date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    })}\n`;
    description += `**Source:** ${noteData.from}\n\n`;
    description += `---\n\n`;
    
    const baseUrl = process.env.APP_URL || 'http://localhost:3001';
    const generateArticleUrl = `${baseUrl}/analyst-story/generate/{cardId}`;
    description += `**[Generate Story](${generateArticleUrl})**\n\n`;

    // Store full note data as base64 for later retrieval (hidden in HTML comment)
    try {
      const noteDataJson = JSON.stringify(noteData);
      const noteDataBase64 = Buffer.from(noteDataJson).toString('base64');
      // Use HTML comment format - truly hidden in Trello (not displayed)
      description += `\n\n<!-- NOTE_DATA:${noteDataBase64} -->`;
    } catch (error) {
      console.warn('Failed to encode note data:', error);
    }

    // Create Trello card
    const card = await trello.createCard(listId, title, description);

    // Update card with generate link that includes actual card ID
    const updatedGenerateUrl = generateArticleUrl.replace('{cardId}', card.id);
    description = description.replace(generateArticleUrl, updatedGenerateUrl);
    await trello.updateCardDescription(card.id, description);

    console.log(`   ✅ Test Trello card created: ${card.url}`);

    res.json({
      success: true,
      message: "Test analyst note card created successfully",
      cardId: card.id,
      cardUrl: card.url,
      title: title,
    });

  } catch (error: any) {
    console.error(`   ❌ Error creating test card:`, error);
    res.status(500).json({ error: "Failed to create test card", details: error.message });
  }
});

// PR Monitor endpoints
let prMonitor: PRMonitor | null = null;

// Initialize PR Monitor if API key is available
if (process.env.BENZINGA_PR_API_KEY) {
  prMonitor = new PRMonitor(process.env.BENZINGA_PR_API_KEY, 5); // 5 minute intervals
  
  // Set callback to log new PRs
  prMonitor.setOnNewPRsCallback((ticker, newArticles) => {
    console.log(`\n📢 New PRs detected for ${ticker}:`);
    newArticles.forEach((article, idx) => {
      console.log(`   ${idx + 1}. ${article.title}`);
    });
  });
}

// Start/Stop PR Monitor
app.post("/pr-monitor/start", async (req, res) => {
  const { tickers, intervalMinutes } = req.body;
  
  if (!prMonitor) {
    return res.status(500).json({ error: "PR Monitor not initialized. BENZINGA_PR_API_KEY required." });
  }

  const tickersToMonitor = tickers || SP500_TOP_100.slice(0, 100);
  const interval = intervalMinutes || 1; // Default to 1 minute

  try {
    // Stop existing monitor if running
    if (prMonitor && prMonitor.isActive()) {
      prMonitor.stopMonitoring();
    }
    
    prMonitor = new PRMonitor(process.env.BENZINGA_PR_API_KEY!, interval);
    
    // Set callback to log new PRs
    prMonitor.setOnNewPRsCallback((ticker, newArticles) => {
      console.log(`\n📢 New PRs detected for ${ticker}:`);
      newArticles.forEach((article, idx) => {
        console.log(`   ${idx + 1}. ${article.title}`);
      });
    });
    
    // Start monitoring (this will do initial load immediately)
    await prMonitor.startMonitoring(tickersToMonitor);
    
    res.json({ 
      status: "started", 
      tickers: tickersToMonitor.length,
      intervalMinutes: interval
    });
  } catch (error: any) {
    console.error("Error starting PR monitor:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/pr-monitor/stop", (req, res) => {
  if (!prMonitor) {
    return res.status(400).json({ error: "PR Monitor not running" });
  }

  prMonitor.stopMonitoring();
  res.json({ status: "stopped" });
});

app.get("/pr-monitor/status", (req, res) => {
  if (!prMonitor) {
    return res.json({ 
      running: false, 
      message: "PR Monitor not initialized",
      recentPRs: []
    });
  }

  // Get the 10 most recent PRs
  const recentPRs = prMonitor.getRecentPRs(10);
  
  res.json({
    running: prMonitor.isActive(),
    status: prMonitor.getStatus(),
    recentPRs: recentPRs,
    totalMonitored: prMonitor.getStatus().length
  });
});

// Generate pitch from a PR
app.post("/generate-pitch-from-pr", async (req, res) => {
  const { pr } = req.body;
  
  if (!pr) {
    return res.status(400).json({ error: "PR data is required" });
  }

  try {
    // Format date
    const dateStr = pr.created 
      ? (() => {
          const date = new Date(pr.created * 1000);
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          
          if (date > sevenDaysAgo) {
            return date.toLocaleDateString('en-US', { weekday: 'long' });
          } else {
            return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
          }
        })()
      : 'Date not available';
    
    // Get full summary (longer for more detail)
    const fullBody = pr.body || '';
    const fullSummary = pr.teaser || (fullBody ? fullBody.substring(0, 800) : 'No summary available');
    const summaryPreview = fullSummary.length > 800 ? fullSummary.substring(0, 800) + '...' : fullSummary;
    
    // Extract ticker from PR - ONLY accept (EXCHANGE:TICKER) format
    const extractTickerFromText = (text: string): string | null => {
      if (!text) return null;
      // ONLY accept tickers in the format (EXCHANGE:TICKER) like (NYSE:CRM), (NASDAQ: SNPS), etc.
      // Allow optional space after colon: (NASDAQ:SNPS) or (NASDAQ: SNPS)
      const exchangePattern = /\(([A-Z]+):\s*([A-Z]{1,5})\)/i;
      const match = text.match(exchangePattern);
      if (match) {
        const ticker = match[2].toUpperCase().trim();
        if (ticker && ticker.length >= 1 && ticker.length <= 5 && /^[A-Z]+$/.test(ticker)) {
          return ticker;
        }
      }
      return null;
    };
    
    // Try to extract ticker from title first, then body/teaser
    let ticker: string | null = null;
    if (pr.title) {
      ticker = extractTickerFromText(pr.title);
    }
    if (!ticker && (pr.body || pr.teaser)) {
      ticker = extractTickerFromText(pr.body || pr.teaser || '');
    }
    // Also check stocks array if it contains (EXCHANGE:TICKER) format
    if (!ticker && pr.stocks && Array.isArray(pr.stocks) && pr.stocks.length > 0) {
      for (const stock of pr.stocks) {
        let stockStr = '';
        if (typeof stock === 'string') {
          stockStr = stock;
        } else if (typeof stock === 'object' && stock !== null) {
          stockStr = stock.ticker || stock.symbol || stock.name || '';
        }
        if (stockStr) {
          const tickerFromStock = extractTickerFromText(stockStr);
          if (tickerFromStock) {
            ticker = tickerFromStock;
            break;
          }
        }
      }
    }
    
    // Use extracted ticker or fall back to pr.ticker if it exists and is valid
    const finalTicker = ticker || (pr.ticker && /^[A-Z]{1,5}$/.test(pr.ticker.toUpperCase()) ? pr.ticker.toUpperCase() : null);
    const tickerDisplay = finalTicker || 'N/A';
    
    const title = pr.title || 'Untitled Article';
    
    // Extract key points from the body if available
    let keyPoints = '';
    if (fullBody) {
      // Try to extract bullet points or key sentences
      const sentences = fullBody.split(/[.!?]\s+/).filter((s: string) => s.length > 50 && s.length < 200);
      if (sentences.length > 0) {
        keyPoints = sentences.slice(0, 3).map((s: string, i: number) => `${i + 1}. ${s.trim()}`).join('\n');
      }
    }
    
    // Generate a more detailed pitch
    const detailedPitch = `Proposed Article: ${title}

Source: Benzinga Press Release
Published: ${dateStr}
${tickerDisplay !== 'N/A' ? `Company Ticker: ${tickerDisplay}` : ''}

Executive Summary:
${summaryPreview}

${keyPoints ? `Key Highlights:\n${keyPoints}\n\n` : ''}${fullBody ? `Full Press Release Content: Available (${fullBody.length} characters)
` : ''}${pr.url ? `Source URL: ${pr.url}
` : ''}
Proposed Article Angle: 
Develop a comprehensive, in-depth article analyzing the implications of this press release. The article should:

1. Market Impact & Investor Implications
   - Analyze how this news affects the company's stock performance and investor sentiment
   - Discuss potential market reactions and trading implications
   - Evaluate the significance within the broader market context

2. Industry Context & Competitive Positioning
   - Place this development within the industry landscape
   - Compare with competitor actions and industry trends
   - Assess competitive advantages or challenges revealed

3. Strategic Significance & Future Outlook
   - Examine the strategic importance of this announcement
   - Discuss potential future developments and implications
   - Evaluate long-term growth prospects and strategic direction

4. Key Metrics & Developments
   - Highlight important financial metrics, partnerships, or operational developments
   - Analyze the quantitative and qualitative aspects of the announcement
   - Provide context for understanding the significance of key numbers or milestones

The selected article generation app will determine the word count and specific formatting based on its configured prompts.`;

    res.json({
      status: "success",
      pitch: detailedPitch,
      pr: {
        ticker: tickerDisplay !== 'N/A' ? tickerDisplay : null,
        title: title,
        date: dateStr,
        url: pr.url || ''
      }
    });
  } catch (error: any) {
    console.error("Error generating pitch from PR:", error);
    res.status(500).json({ error: "Failed to generate pitch" });
  }
});

// Trello Webhook Handler - Automatically add "Process For AI" button when URL is detected in card description
// This triggers INSTANTLY when you save a URL in a Trello card description (no 30-second wait)
// 
// SETUP INSTRUCTIONS:
// 1. For local development: Use ngrok to expose your server:
//    - Install ngrok: https://ngrok.com/download
//    - Run: ngrok http 3001
//    - Copy the ngrok URL (e.g., https://abc123.ngrok.io)
//
// 2. Create Trello webhook:
//    POST https://api.trello.com/1/tokens/YOUR_TOKEN/webhooks/?key=YOUR_API_KEY
//    Body: {
//      "description": "News Agent - Card Updates",
//      "callbackURL": "https://YOUR_NGROK_URL/trello/webhook",
//      "idModel": "YOUR_BOARD_ID"
//    }
//
// 3. See TRELLO_WEBHOOK_SETUP.md for detailed instructions
//
app.post("/trello/webhook", async (req, res) => {
  console.log(`\n🔔 [POST /trello/webhook] Trello webhook received`);
  
  try {
    const webhook = req.body;
    
    // Trello sends different action types
    if (!webhook || !webhook.action) {
      console.log(`   ⚠️  Invalid webhook payload`);
      return res.status(400).json({ error: "Invalid webhook payload" });
    }
    
    const action = webhook.action;
    const actionType = action.type;
    
    console.log(`   📋 Action type: ${actionType}`);
    
    // We're interested in card updates (updateCard, createCard)
    if (actionType === 'updateCard' || actionType === 'createCard') {
      const cardData = action.data?.card || action.data?.cardBefore || action.data?.cardAfter;
      
      if (!cardData || !cardData.id) {
        console.log(`   ⚠️  No card data in webhook`);
        return res.status(200).json({ received: true }); // Return 200 to acknowledge webhook
      }
      
      const cardId = cardData.id;
      const listId = cardData.idList;
      const previousListId = action.data?.cardBefore?.idList;
      
      console.log(`   📋 Card ID: ${cardId}`);
      console.log(`   📋 List ID: ${listId}`);
      console.log(`   📋 Previous List ID: ${previousListId || 'N/A'}`);
      
      // Check if card was moved to "Submitted" list (trigger for number verification)
      const submittedListId = process.env.TRELLO_LIST_ID_SUBMITTED;
      const verificationEnabled = process.env.EDITOR_NUMBER_VERIFICATION_ENABLED === 'true';
      
      console.log(`   🔍 Number Verification Check:`);
      console.log(`      - Submitted List ID: ${submittedListId || 'NOT SET'}`);
      console.log(`      - Verification Enabled: ${verificationEnabled}`);
      console.log(`      - Current List ID: ${listId}`);
      console.log(`      - Previous List ID: ${previousListId || 'N/A'}`);
      console.log(`      - Is Submitted List: ${listId === submittedListId}`);
      console.log(`      - Was Moved: ${previousListId && previousListId !== submittedListId}`);
      
      if (submittedListId && verificationEnabled && listId === submittedListId && previousListId && previousListId !== submittedListId) {
        console.log(`   ✅ Card moved to Submitted list - triggering number verification...`);
        
        // Trigger number verification in background
        (async () => {
          try {
            const { TrelloService } = await import("./trello-service");
            const trello = new TrelloService();
            
            // Get card data
            const cardInfo = await trello.getCardData(cardId);
            const cardDesc = cardInfo.desc || '';
            
            // Extract article content from card description or stored articles
            let articleContent = '';
            let sourceMaterial: any = null;
            
            // Try to find article in stored articles by looking for article view URLs in description
            const articleUrlMatch = cardDesc.match(/\/pr-auto-scan\/articles\/([a-zA-Z0-9_]+)/);
            const analystStoryUrlMatch = cardDesc.match(/\/analyst-story\/view\/([a-zA-Z0-9_]+)/);
            
            if (articleUrlMatch) {
              const articleId = articleUrlMatch[1];
              const storedArticle = prGeneratedArticles.find(a => a.id === articleId);
              if (storedArticle) {
                articleContent = storedArticle.generatedArticle;
                sourceMaterial = storedArticle.sourceArticle;
                console.log(`   ✅ Found article in storage: ${articleId}`);
              }
            } else if (analystStoryUrlMatch) {
              const storyId = analystStoryUrlMatch[1];
              const storedStory = analystGeneratedStories.get(storyId);
              if (storedStory) {
                articleContent = storedStory.story;
                sourceMaterial = storedStory.noteData;
                console.log(`   ✅ Found analyst story in storage: ${storyId}`);
              }
            }
            
            // If not found in storage, try to extract from card description (may be embedded)
            if (!articleContent && cardDesc.includes('<h')) {
              // Article HTML might be in description
              const htmlMatch = cardDesc.match(/(<h[1-6][\s\S]*?<\/h[1-6]>[\s\S]*?)(?=\n\n---|$)/);
              if (htmlMatch) {
                articleContent = htmlMatch[1];
                console.log(`   ✅ Extracted article HTML from card description`);
              }
            }
            
            // Extract source material from PR_DATA or NOTE_DATA
            if (!sourceMaterial) {
              const prDataMatch = cardDesc.match(/<!--\s*PR_DATA:\s*([^>]+)\s*-->/);
              const noteDataMatch = cardDesc.match(/<!--\s*NOTE_DATA:\s*([^>]+)\s*-->/);
              
              if (prDataMatch || noteDataMatch) {
                try {
                  const dataStr = decodeURIComponent((prDataMatch || noteDataMatch)![1]);
                  sourceMaterial = JSON.parse(dataStr);
                  console.log(`   ✅ Extracted source material from card metadata`);
                } catch (parseError) {
                  console.warn(`   ⚠️  Could not parse source material from card: ${parseError}`);
                }
              }
            }
            
            if (!articleContent) {
              console.warn(`   ⚠️  Could not find article content for verification - skipping`);
              return;
            }
            
            if (!sourceMaterial) {
              console.warn(`   ⚠️  Could not find source material for verification - skipping`);
              return;
            }
            
            // Trigger number verification agent
            const verificationThreadId = `verification_${cardId}_${Date.now()}`;
            const verificationConfig = { configurable: { thread_id: verificationThreadId } };
            
            await numberVerificationGraph.invoke({
              cardId,
              articleContent,
              sourceMaterial,
              verificationStatus: '',
              verificationSummary: '',
              verifiedNumbers: 0,
              discrepancies: [],
              verificationNotes: '',
            }, verificationConfig);
            
            console.log(`   ✅ Number verification completed for card ${cardId}`);
          } catch (verifyError: any) {
            console.error(`   ❌ Error in number verification:`, verifyError);
            // Don't throw - just log the error
          }
        })();
        
        return res.status(200).json({ received: true });
      }
      
      // Check if card is in PR or WGO list (existing logic for "Process For AI" button)
      const prListId = process.env.TRELLO_LIST_ID_PR;
      const wgoListId = process.env.TRELLO_LIST_ID_WGO;
      const isPRList = prListId && listId === prListId;
      const isWGOList = wgoListId && listId === wgoListId;
      
      if (!isPRList && !isWGOList) {
        console.log(`   ⚠️  Card is not in PR or WGO list, skipping`);
        return res.status(200).json({ received: true });
      }
      
      // Get card description (from webhook data or fetch it)
      let cardDesc = '';
      if (actionType === 'updateCard' && action.data?.cardAfter?.desc !== undefined) {
        cardDesc = action.data.cardAfter.desc || '';
      } else if (actionType === 'createCard' && action.data?.card?.desc) {
        cardDesc = action.data.card.desc || '';
      } else {
        // Fetch card data to get description
        try {
          const { TrelloService } = await import("./trello-service");
          const trello = new TrelloService();
          const cardInfo = await trello.getCardData(cardId);
          cardDesc = cardInfo.desc || '';
        } catch (fetchError: any) {
          console.warn(`   ⚠️  Could not fetch card data: ${fetchError.message}`);
          return res.status(200).json({ received: true });
        }
      }
      
      // Check if card has URL but no Process For AI or Generate Article button
      const hasUrl = /https?:\/\//.test(cardDesc);
      const hasButton = /\[(Process For AI|Generate Article)\]/.test(cardDesc);
      const hasPRData = /<!--\s*PR_DATA:/.test(cardDesc) || /```metadata[^`]*PR_DATA:/.test(cardDesc);
      
      if (hasUrl && !hasButton && !hasPRData) {
        console.log(`   ✅ Card has URL but no button - adding "Process For AI" button`);
        
        const { TrelloService } = await import("./trello-service");
        const trello = new TrelloService();
        
        const appUrl = process.env.APP_URL || 'http://localhost:3001';
        const processUrl = `${appUrl}/trello/process-card/${cardId}`;
        
        // Add button to description
        let updatedDesc = cardDesc;
        // Remove any existing error messages or old buttons first
        updatedDesc = updatedDesc.replace(/\n\n---\n\n## ⚠️ Card Not Processed[\s\S]*?(?=\n\n---|$)/, '');
        updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Process For AI\]\([^)]+\)\*\*/g, '');
        updatedDesc += `\n\n---\n\n**[Process For AI](${processUrl})**`;
        
        try {
          await trello.updateCardDescription(cardId, updatedDesc);
          console.log(`   ✅ Successfully added "Process For AI" button to card ${cardId}`);
        } catch (updateError: any) {
          console.error(`   ❌ Error updating card: ${updateError.message}`);
        }
      } else {
        console.log(`   ℹ️  Card doesn't need button (hasUrl: ${hasUrl}, hasButton: ${hasButton}, hasPRData: ${hasPRData})`);
      }
    }
    
    // Always return 200 to acknowledge webhook receipt
    res.status(200).json({ received: true });
    
  } catch (error: any) {
    console.error(`   ❌ Error processing webhook:`, error);
    // Still return 200 to prevent Trello from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

// Process manually created Trello card - Extract URL, fetch article content, and set up for generation
// Usage: GET /trello/process-card/:cardId
app.get("/trello/process-card/:cardId", async (req, res) => {
  const { cardId } = req.params;
  
  console.log(`\n🔄 [GET /trello/process-card/${cardId}] Processing manually created card`);
  
  try {
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    
    // Get card data including list ID
    const card = await trello.getCard(cardId);
    const listId = card.idList;
    
    console.log(`   📋 Card: "${card.name}"`);
    console.log(`   📋 List ID: ${listId}`);
    
    // Determine if this is PR or WGO list based on list ID
    const prListId = process.env.TRELLO_LIST_ID_PR;
    const wgoListId = process.env.TRELLO_LIST_ID_WGO;
    const isPRList = prListId && listId === prListId;
    const isWGOList = wgoListId && listId === wgoListId;
    
    if (!isPRList && !isWGOList) {
      const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Error</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #dc2626;
        }
        .message {
            text-align: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="message">
        <h2>❌ Error</h2>
        <p>This card is not in a PR-Related Stories or WGO/WIIM Stories list.</p>
        <p>Please move the card to one of these lists before processing.</p>
        <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">Close</button>
    </div>
</body>
</html>`;
      return res.status(400).send(errorHtml);
    }
    
    const articleType = isPRList ? 'PR' : 'WGO';
    console.log(`   📝 Detected as ${articleType} article type`);
    
    // Extract URL from card description
    // Try multiple patterns: [link text](url), plain URL, or **Source:** [View Original](url)
    // IMPORTANT: Exclude our own internal URLs (process-card, generate-article, etc.)
    let articleUrl: string | null = null;
    
    // Helper function to check if URL is our internal endpoint (should be excluded)
    const isInternalUrl = (url: string): boolean => {
      const internalPatterns = [
        /localhost:3001/,
        /\/trello\/process-card\//,
        /\/trello\/generate-article\//,
        /\/analyst-story\/generate\//,
        /\/editor\//,
        /\/trello\/add-process-buttons\//
      ];
      return internalPatterns.some(pattern => pattern.test(url));
    };
    
    // Pattern 1: Markdown link [text](url) - prioritize Benzinga URLs
    const allMarkdownLinks = [...card.desc.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g)];
    if (allMarkdownLinks.length > 0) {
      // First, try to find a Benzinga URL
      const benzingaLink = allMarkdownLinks.find(match => 
        match[2].includes('benzinga.com') && !isInternalUrl(match[2])
      );
      if (benzingaLink) {
        articleUrl = benzingaLink[2];
      } else {
        // If no Benzinga URL, use first non-internal URL
        const nonInternalLink = allMarkdownLinks.find(match => !isInternalUrl(match[2]));
        if (nonInternalLink) {
          articleUrl = nonInternalLink[2];
        }
      }
    }
    
    // Pattern 2: Plain URL (http:// or https://) - prioritize Benzinga URLs
    if (!articleUrl) {
      const allPlainUrls = [...card.desc.matchAll(/(https?:\/\/[^\s\n\)]+)/g)];
      if (allPlainUrls.length > 0) {
        // First, try to find a Benzinga URL
        const benzingaUrl = allPlainUrls.find(match => 
          match[1].includes('benzinga.com') && !isInternalUrl(match[1])
        );
        if (benzingaUrl) {
          articleUrl = benzingaUrl[1];
        } else {
          // If no Benzinga URL, use first non-internal URL
          const nonInternalUrl = allPlainUrls.find(match => !isInternalUrl(match[1]));
          if (nonInternalUrl) {
            articleUrl = nonInternalUrl[1];
          }
        }
      }
    }
    
    // Pattern 3: Source URL in specific format
    if (!articleUrl) {
      const sourceMatch = card.desc.match(/\*\*Source:\*\*\s*\[View Original\]\((https?:\/\/[^\)]+)\)/);
      if (sourceMatch && !isInternalUrl(sourceMatch[1])) {
        articleUrl = sourceMatch[1];
      }
    }
    
    if (!articleUrl) {
      const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Error</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #dc2626;
        }
        .message {
            text-align: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="message">
        <h2>❌ Error</h2>
        <p>No URL found in card description.</p>
        <p>Please add the article URL to the card description and try again.</p>
        <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">Close</button>
    </div>
</body>
</html>`;
      return res.status(400).send(errorHtml);
    }
    
    console.log(`   🔗 Extracted URL: ${articleUrl}`);
    
    // Return immediately with processing message
    const processingHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Processing...</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #059669;
        }
        .message {
            text-align: center;
            padding: 20px;
        }
    </style>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.close();
            }, 100);
        };
    </script>
</head>
<body>
    <div class="message">
        <h2>🔄 Processing...</h2>
        <p>Preparing card for article generation...</p>
    </div>
</body>
</html>`;
    
    res.send(processingHtml);
    
    // Process in background
    (async () => {
      try {
        // No need to fetch from Benzinga API - the URL is already in the description
        // The "Generate Article" endpoint will fetch the article when needed
        console.log(`   ℹ️  URL found in description - skipping API fetch`);
        console.log(`   📝 Article will be fetched fresh from URL when "Generate Article" is clicked`);
        
        // Extract ticker from card title if present (format: "TICKER... Article Title")
        let ticker: string | null = null;
        const titleMatch = card.name.match(/^([A-Z]{1,5})\.\.\.\s+(.+)$/);
        if (titleMatch) {
          ticker = titleMatch[1].toUpperCase();
          console.log(`   📊 Extracted ticker from card title: ${ticker}`);
        }
        
        // Update card with "Generate Article" button
        const baseUrl = process.env.APP_URL || 'http://localhost:3001';
        const selectedApp = isPRList ? 'story' : 'wgo';
        const generateArticleUrl = `${baseUrl}/trello/generate-article/${cardId}?selectedApp=${selectedApp}`;
        
        // Build updated description
        let updatedDesc = card.desc;
        
        // Remove "Process For AI" button if present
        updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Process For AI\]\([^)]+\)\*\*/g, '');
        
        // Add "Generate Article" button
        updatedDesc += `\n\n---\n\n**[Generate Article](${generateArticleUrl})**`;
        
        // Update card description
        await trello.updateCardDescription(cardId, updatedDesc);
        
        console.log(`   ✅ Card processed successfully. Ready for article generation.`);
        console.log(`   🔗 URL in description: ${articleUrl}`);
        if (ticker) {
          console.log(`   📊 Ticker from card title: ${ticker}`);
        }
        
      } catch (error: any) {
        console.error(`   ❌ Error processing card:`, error);
        
        // Update card with error message
        try {
          const cardData = await trello.getCardData(cardId);
          let updatedDesc = cardData.desc || '';
          updatedDesc += `\n\n---\n\n## ❌ Processing Error\n\n\`\`\`\n${error.message}\n\`\`\`\n`;
          await trello.updateCardDescription(cardId, updatedDesc);
        } catch (updateError) {
          console.error(`   ❌ Failed to update card with error:`, updateError);
        }
      }
    })();
    
  } catch (error: any) {
    console.error(`   ❌ Error in process-card endpoint:`, error);
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Error</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #dc2626;
        }
        .message {
            text-align: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="message">
        <h2>❌ Error</h2>
        <p>${error.message || 'An error occurred while processing the card.'}</p>
        <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">Close</button>
    </div>
</body>
</html>`;
    res.status(500).send(errorHtml);
  }
});

// Helper endpoint: Add "Process For AI" buttons to manually created cards in a list
// Usage: GET /trello/add-process-buttons/:listId
// This scans all cards in the specified list and adds "Process For AI" buttons to cards that need them
app.get("/trello/add-process-buttons/:listId", async (req, res) => {
  const { listId } = req.params;
  
  console.log(`\n🔧 [GET /trello/add-process-buttons/${listId}] Adding Process For AI buttons to cards`);
  
  try {
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    
    // Access private methods through reflection (TypeScript allows this at runtime)
    // We'll use a helper method instead - create it in TrelloService
    // For now, let's use the Trello API directly with the service's credentials
    const trelloService = trello as any;
    const baseUrl = trelloService.baseUrl || 'https://api.trello.com/1';
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    
    if (!apiKey || !token) {
      throw new Error('TRELLO_API_KEY and TRELLO_TOKEN must be set');
    }
    
    // Fetch all cards in the list
    const cardsUrl = `${baseUrl}/lists/${listId}/cards?key=${apiKey}&token=${token}&fields=id,name,desc`;
    const cardsResponse = await fetch(cardsUrl);
    
    if (!cardsResponse.ok) {
      throw new Error(`Failed to fetch cards from list: ${cardsResponse.status} ${cardsResponse.statusText}`);
    }
    
    const cards = await cardsResponse.json() as Array<{ id: string; name: string; desc: string }>;
    console.log(`   📋 Found ${cards.length} cards in list`);
    
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const card of cards) {
      try {
        // Check if card already has PR_DATA (already processed)
        const hasPRData = /<!--\s*PR_DATA:/.test(card.desc || '') || /```metadata[^`]*PR_DATA:/.test(card.desc || '');
        
        // Check if card has a URL
        const hasUrl = /https?:\/\//.test(card.desc || '');
        
        // Check if card already has Process For AI or Generate Article button
        const hasButton = /\[(Process For AI|Generate Article)\]/.test(card.desc || '');
        
        // Skip if already processed or no URL or already has button
        if (hasPRData || !hasUrl || hasButton) {
          skippedCount++;
          continue;
        }
        
        // Add Process For AI button
        let updatedDesc = card.desc || '';
        updatedDesc += `\n\n---\n\n**[Process For AI](${appUrl}/trello/process-card/${card.id})**`;
        
        await trello.updateCardDescription(card.id, updatedDesc);
        console.log(`   ✅ Added Process For AI button to: "${card.name.substring(0, 50)}..."`);
        updatedCount++;
      } catch (cardError: any) {
        console.error(`   ⚠️  Error updating card ${card.id}:`, cardError.message);
      }
    }
    
    const resultHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Buttons Added</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #059669;
        }
        .message {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.close();
            }, 3000);
        };
    </script>
</head>
<body>
    <div class="message">
        <h2>✅ Process Complete</h2>
        <p><strong>${updatedCount}</strong> cards updated with "Process For AI" buttons</p>
        <p><strong>${skippedCount}</strong> cards skipped (already processed or no URL)</p>
        <p style="margin-top: 20px; font-size: 0.9em; color: #666;">This window will close automatically...</p>
    </div>
</body>
</html>`;
    
    res.send(resultHtml);
    
  } catch (error: any) {
    console.error(`   ❌ Error adding process buttons:`, error);
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Error</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #dc2626;
        }
        .message {
            text-align: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="message">
        <h2>❌ Error</h2>
        <p>${error.message || 'An error occurred while adding buttons.'}</p>
        <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; cursor: pointer;">Close</button>
    </div>
</body>
</html>`;
    res.status(500).send(errorHtml);
  }
});

// Generate article from Trello card (called when user clicks "Generate Article" link in Trello)
// Helper function to reconstruct PR data from card description (for older cards without embedded data)
function reconstructPRDataFromCard(cardName: string, cardDesc: string): any | null {
  try {
    // Extract ticker from description
    const tickerMatch = cardDesc.match(/\*\*Ticker:\*\*\s*([^\n]+)/);
    const ticker = tickerMatch ? tickerMatch[1].trim() : null;
    
    // Extract date from description
    const dateMatch = cardDesc.match(/\*\*Date:\*\*\s*([^\n]+)/);
    const dateStr = dateMatch ? dateMatch[1].trim() : null;
    
    // Extract source URL
    const sourceMatch = cardDesc.match(/\*\*Source:\*\*\s*\[View Original\]\(([^)]+)\)/);
    const sourceUrl = sourceMatch ? sourceMatch[1].trim() : null;
    
    // Extract summary/body from description (everything before the --- separator)
    const summaryMatch = cardDesc.split('---')[0];
    const summary = summaryMatch ? summaryMatch.trim() : cardDesc.substring(0, 500);
    
    // Extract pitch if available
    const pitchMatch = cardDesc.match(/\*\*pitch:\*\*\s*([^\n]+)/i);
    const pitch = pitchMatch ? pitchMatch[1].trim() : null;
    
    // Try to extract PR ID if present
    const prIdMatch = cardDesc.match(/\*\*prId:\*\*\s*([^\n]+)/i);
    const prId = prIdMatch ? prIdMatch[1].trim() : undefined;
    
    // Reconstruct PR data object
    if (cardName || sourceUrl) {
      return {
        title: cardName,
        headline: cardName,
        teaser: summary,
        body: summary,
        url: sourceUrl || 'No URL available',
        ticker: ticker,
        created: dateStr ? (() => {
          try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? Math.floor(Date.now() / 1000) : Math.floor(date.getTime() / 1000);
          } catch {
            return Math.floor(Date.now() / 1000);
          }
        })() : Math.floor(Date.now() / 1000),
        prId: prId,
        // Add stocks array if ticker is present
        stocks: ticker ? [ticker.toUpperCase()] : []
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Error reconstructing PR data:', error);
    return null;
  }
}

// Changed to GET since Trello links are clicked directly (GET requests)
app.get("/trello/generate-article/:cardId", async (req, res) => {
  const { cardId } = req.params;
  const { selectedApp = "story" } = req.query; // GET uses query params, not body - Default to "story" for PR-related articles
  
  console.log(`\n📝 [GET /trello/generate-article/${cardId}] Generating article from Trello card`);
  
  try {
    // Import services
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    
    // Move card to "In Progress" list immediately
    const inProgressListId = process.env.TRELLO_LIST_ID_IN_PROGRESS;
    let cardMoved = false;
    if (inProgressListId) {
      try {
        await trello.moveCardToList(cardId, inProgressListId);
        console.log(`   ✅ Moved card to In Progress list`);
        cardMoved = true;
      } catch (moveError: any) {
        console.warn(`   ⚠️  Error moving card to In Progress list:`, moveError.message);
        // Continue even if move fails
      }
    } else {
      console.log(`   ⚠️  TRELLO_LIST_ID_IN_PROGRESS not set, skipping card move to In Progress`);
    }
    
    // Return immediately after moving card, process generation in background
    // Return minimal HTML that auto-closes the window
    const autoCloseHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Processing...</title>
    <meta charset="UTF-8">
    <meta http-equiv="refresh" content="2;url=about:blank">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #059669;
        }
        .message {
            text-align: center;
            padding: 20px;
        }
    </style>
    <script>
        // Try to close the window immediately
        window.onload = function() {
            setTimeout(function() {
                window.close();
                // If window doesn't close (blocked by browser), show message
                setTimeout(function() {
                    document.body.innerHTML = '<div class="message"><h2>✅ Card moved to In Progress</h2><p>Article generation has started. You can close this window.</p></div>';
                }, 500);
            }, 100);
        };
    </script>
</head>
<body>
    <div class="message">
        <h2>Processing...</h2>
        <p>Moving card to In Progress...</p>
    </div>
</body>
</html>`;
    
    res.send(autoCloseHtml);
    
    // Continue processing in background (don't await, fire and forget)
    (async () => {
      try {
        // Get card data first to check for URL mismatches
        const { TrelloService } = await import("./trello-service");
        const trello = new TrelloService();
        const cardData = await trello.getCardData(cardId);
        const card = await trello.getCard(cardId);
        
        // Extract URL from card description to validate against stored data
        let cardDescriptionUrl: string | null = null;
        const isInternalUrl = (url: string): boolean => {
          const internalPatterns = [
            /localhost:3001/,
            /\/trello\/process-card\//,
            /\/trello\/generate-article\//,
            /\/analyst-story\/generate\//,
            /\/editor\//,
            /\/trello\/add-process-buttons\//
          ];
          return internalPatterns.some(pattern => pattern.test(url));
        };
        
        // Try to find Benzinga URL in description - use comprehensive extraction
        console.log(`   🔍 Extracting URL from card description (length: ${cardData.desc?.length || 0})...`);
        
        // Pattern 1: Markdown links [text](url) - prioritize Benzinga URLs
        const allMarkdownLinks = [...(cardData.desc || '').matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g)];
        const benzingaLink = allMarkdownLinks.find(match => 
          match[2].includes('benzinga.com') && !isInternalUrl(match[2])
        );
        if (benzingaLink) {
          cardDescriptionUrl = benzingaLink[2];
          console.log(`   ✅ Found Benzinga URL in markdown link: ${cardDescriptionUrl}`);
        } else {
          // Pattern 2: Plain URLs (may include trailing punctuation or markdown artifacts)
          const allPlainUrls = [...(cardData.desc || '').matchAll(/(https?:\/\/[^\s\n\)<>]+)/g)];
          const benzingaUrls = allPlainUrls
            .map(match => match[1])
            .filter(url => url.includes('benzinga.com') && !isInternalUrl(url))
            .map(url => {
              // Clean up URL: remove trailing punctuation, markdown artifacts, and duplicate URLs
              let cleaned = url
                .replace(/[.,;:!?]+$/, '') // Remove trailing punctuation
                .replace(/\]\(https?:\/\/.*$/, '') // Remove markdown link artifacts like ](https://...
                .replace(/\)+$/, '') // Remove trailing closing parentheses
                .trim();
              
              // If URL contains a duplicate (like url](url), take only the first part
              const duplicateMatch = cleaned.match(/^([^\)]+?)(\]\(https?:\/\/.*)$/);
              if (duplicateMatch) {
                cleaned = duplicateMatch[1];
              }
              
              return cleaned;
            })
            .filter(url => url.length > 0); // Remove empty URLs
          
          if (benzingaUrls.length > 0) {
            cardDescriptionUrl = benzingaUrls[0]; // Take first Benzinga URL found
            console.log(`   ✅ Found Benzinga URL in plain text: ${cardDescriptionUrl}`);
          } else {
            // Pattern 3: Any Benzinga URL pattern (fallback)
            const benzingaPattern = /(https?:\/\/[^\s\n\)<>]*benzinga\.com[^\s\n\)<>]*)/i;
            const fallbackMatch = (cardData.desc || '').match(benzingaPattern);
            if (fallbackMatch && !isInternalUrl(fallbackMatch[1])) {
              let cleaned = fallbackMatch[1]
                .replace(/[.,;:!?]+$/, '')
                .replace(/\]\(https?:\/\/.*$/, '')
                .replace(/\)+$/, '')
                .trim();
              
              const duplicateMatch = cleaned.match(/^([^\)]+?)(\]\(https?:\/\/.*)$/);
              if (duplicateMatch) {
                cleaned = duplicateMatch[1];
              }
              
              cardDescriptionUrl = cleaned;
              console.log(`   ✅ Found Benzinga URL via fallback pattern: ${cardDescriptionUrl}`);
            }
          }
        }
        
        if (!cardDescriptionUrl) {
          console.warn(`   ⚠️  No Benzinga URL found in card description`);
          console.warn(`   📋 Description preview: ${(cardData.desc || '').substring(0, 500)}`);
        }
        
        // Check if this is a manually created card (has URL but no PR_DATA)
        const hasPRDataInDesc = /<!--\s*PR_DATA:/.test(cardData.desc || '') || /```metadata[^`]*PR_DATA:/.test(cardData.desc || '');
        const isManualCard = cardDescriptionUrl && !hasPRDataInDesc;
        
        let sourceData: any = null;
        
        if (isManualCard) {
          // Manually created card - try to fetch from API, but if it fails, create minimal object from URL
          console.log(`   🔍 Manually created card detected - URL provided: ${cardDescriptionUrl}`);
          
          const apiKey = (card.idList === (process.env.TRELLO_LIST_ID_PR || '')) 
            ? process.env.BENZINGA_PR_API_KEY 
            : process.env.BENZINGA_API_KEY;
          
          // Try to fetch from API if key is available, but don't fail if it doesn't work
          if (apiKey) {
            try {
              const { fetchBenzingaArticleByUrl } = await import("./benzinga-api");
              sourceData = await fetchBenzingaArticleByUrl(cardDescriptionUrl!, apiKey);
              
              if (sourceData) {
                console.log(`   ✅ Fetched article from API: ${sourceData.title}`);
              } else {
                console.log(`   ⚠️  Article not found in API - will use URL directly`);
              }
            } catch (fetchError: any) {
              console.warn(`   ⚠️  API fetch failed (${fetchError.message}) - will use URL directly`);
            }
          }
          
          // If API fetch failed or returned nothing, try scraping the URL
          if (!sourceData) {
            console.log(`   🌐 API fetch failed - attempting to scrape article from URL...`);
            try {
              const { scrapeBenzingaArticleByUrl } = await import("./benzinga-api");
              sourceData = await scrapeBenzingaArticleByUrl(cardDescriptionUrl!);
              
              if (sourceData) {
                console.log(`   ✅ Successfully scraped article: ${sourceData.title}`);
                // Extract ticker from card title if present and not in scraped data
                const titleMatch = card.name.match(/^([A-Z]{1,5})\.\.\.\s+(.+)$/);
                if (titleMatch && titleMatch[1]) {
                  const cardTicker = titleMatch[1].toUpperCase();
                  if (!sourceData.stocks || sourceData.stocks.length === 0) {
                    sourceData.stocks = [cardTicker];
                  }
                }
              }
            } catch (scrapeError: any) {
              console.warn(`   ⚠️  Scraping failed (${scrapeError.message}) - will create minimal source data`);
            }
          }
          
          // If scraping also failed, create minimal sourceData from URL
          if (!sourceData) {
            console.log(`   📝 Creating minimal source data from URL (no API or scraped data available)`);
            const cardTitle = card.name.replace(/^[A-Z]{1,5}\.\.\.\s+/, ''); // Remove ticker prefix if present
            
            // Extract ticker from card title if present (format: "TICKER... Title")
            let ticker: string | null = null;
            const titleMatch = card.name.match(/^([A-Z]{1,5})\.\.\.\s+(.+)$/);
            if (titleMatch) {
              ticker = titleMatch[1].toUpperCase();
            }
            
            sourceData = {
              id: cardDescriptionUrl!.split('/').pop() || 'unknown',
              title: cardTitle,
              headline: cardTitle,
              url: cardDescriptionUrl!,
              body: '', // Will be populated from pitch/URL
              teaser: '',
              created: Math.floor(Date.now() / 1000),
              updated: Math.floor(Date.now() / 1000),
              channels: [],
              stocks: ticker ? [ticker] : [],
              tags: [],
              // Mark that this is URL-only data
              _urlOnly: true
            };
            
            console.log(`   ✅ Created minimal source data from URL`);
            console.log(`      Title: ${cardTitle}`);
            console.log(`      URL: ${cardDescriptionUrl}`);
            if (ticker) {
              console.log(`      Ticker: ${ticker}`);
            }
          }
        } else {
          // Try to get data from in-memory map first (for cards created in this session)
          // This map stores both PR data and article data (WGO)
          sourceData = trelloCardToPR.get(cardId);
        }
        
        // If not in memory and not a manual card, try to retrieve from Trello card description
        if (!sourceData && !isManualCard) {
          console.log(`   🔍 Source data not in memory, fetching from Trello card...`);
          try {
            // getCardData returns prData for both PR and article data (it's just the field name)
            if (cardData.prData) {
              sourceData = cardData.prData;
              console.log(`   ✅ Retrieved source data from card description`);
              console.log(`   📋 Source data keys: ${Object.keys(sourceData).join(', ')}`);
              
              // VALIDATION: Check if stored URL matches card description URL
              const storedUrl = sourceData.url || sourceData.link || '';
              console.log(`   🔍 Validating URL match:`);
              console.log(`      Card description URL: ${cardDescriptionUrl || '(none)'}`);
              console.log(`      Stored PR_DATA URL: ${storedUrl || '(none)'}`);
              
              // Normalize URLs for comparison (remove trailing slashes, convert to lowercase)
              const normalizeUrl = (url: string): string => {
                return url.toLowerCase().replace(/\/+$/, '').trim();
              };
              
              const normalizedCardUrl = cardDescriptionUrl ? normalizeUrl(cardDescriptionUrl) : null;
              const normalizedStoredUrl = storedUrl ? normalizeUrl(storedUrl) : null;
              
              if (normalizedCardUrl && normalizedStoredUrl && normalizedCardUrl !== normalizedStoredUrl) {
                console.warn(`   ⚠️  URL MISMATCH DETECTED!`);
                console.warn(`      Card description URL: ${cardDescriptionUrl}`);
                console.warn(`      Stored PR_DATA URL: ${storedUrl}`);
                console.warn(`   🔄 Re-fetching article from card description URL to fix mismatch...`);
                
                // Re-fetch the correct article from the URL in the description
                const apiKey = (card.idList === (process.env.TRELLO_LIST_ID_PR || '')) 
                  ? process.env.BENZINGA_PR_API_KEY 
                  : process.env.BENZINGA_API_KEY;
                
                if (apiKey) {
                  try {
                    const { fetchBenzingaArticleByUrl } = await import("./benzinga-api");
                    const correctArticle = await fetchBenzingaArticleByUrl(cardDescriptionUrl!, apiKey);
                    
                    if (correctArticle) {
                      console.log(`   ✅ Successfully re-fetched correct article: ${correctArticle.title}`);
                      sourceData = correctArticle;
                      // Update the card's PR_DATA with correct article
                      trelloCardToPR.set(cardId, correctArticle);
                      
                      // Also update card description with correct data
                      try {
                        const correctArticleJson = JSON.stringify(correctArticle);
                        const correctArticleBase64 = Buffer.from(correctArticleJson).toString('base64');
                        let updatedDesc = cardData.desc || '';
                        // Replace old PR_DATA with new one
                        updatedDesc = updatedDesc.replace(/<!--\s*PR_DATA:[^>]+-->/g, '');
                        updatedDesc = updatedDesc.replace(/```metadata[^`]*PR_DATA:[^\n`]+[^`]*```/g, '');
                        updatedDesc += `\n\n<!-- PR_DATA:${correctArticleBase64} -->`;
                        await trello.updateCardDescription(cardId, updatedDesc);
                        console.log(`   ✅ Updated card with correct article data`);
                      } catch (updateError: any) {
                        console.warn(`   ⚠️  Could not update card description:`, updateError.message);
                      }
                    } else {
                      console.error(`   ❌ Could not fetch article from URL: ${cardDescriptionUrl}`);
                      console.error(`   ⚠️  Will proceed with stored data, but article may be incorrect`);
                    }
                  } catch (fetchError: any) {
                    console.error(`   ❌ Error re-fetching article:`, fetchError.message);
                    console.error(`   ⚠️  Will proceed with stored data, but article may be incorrect`);
                  }
                } else {
                  console.error(`   ❌ API key not available for re-fetching article`);
                  console.error(`   ⚠️  Will proceed with stored data, but article may be incorrect`);
                }
              } else if (cardDescriptionUrl && !storedUrl) {
                // Card has URL in description but no stored data - this shouldn't happen, but handle it
                console.warn(`   ⚠️  Card description has URL but stored PR_DATA has no URL`);
                console.warn(`   💡 This card may need to be re-processed`);
              }
              
              // Store in memory for future use
              trelloCardToPR.set(cardId, sourceData);
            } else {
              console.log(`   ⚠️  No source data found in card description`);
              console.log(`   📋 Card description length: ${cardData.desc?.length || 0}`);
              
              // If card has URL in description, try to fetch it
              if (cardDescriptionUrl) {
                console.log(`   🔄 Card has URL in description, attempting to fetch article...`);
                const apiKey = (card.idList === (process.env.TRELLO_LIST_ID_PR || '')) 
                  ? process.env.BENZINGA_PR_API_KEY 
                  : process.env.BENZINGA_API_KEY;
                
                if (apiKey) {
                  try {
                    const { fetchBenzingaArticleByUrl } = await import("./benzinga-api");
                    const fetchedArticle = await fetchBenzingaArticleByUrl(cardDescriptionUrl!, apiKey);
                    
                    if (fetchedArticle) {
                      sourceData = fetchedArticle;
                      console.log(`   ✅ Successfully fetched article from URL: ${fetchedArticle.title}`);
                      trelloCardToPR.set(cardId, fetchedArticle);
                      
                      // Store in card description
                      try {
                        const articleJson = JSON.stringify(fetchedArticle);
                        const articleBase64 = Buffer.from(articleJson).toString('base64');
                        let updatedDesc = cardData.desc || '';
                        updatedDesc += `\n\n<!-- PR_DATA:${articleBase64} -->`;
                        await trello.updateCardDescription(cardId, updatedDesc);
                        console.log(`   ✅ Stored article data in card`);
                      } catch (updateError: any) {
                        console.warn(`   ⚠️  Could not store article data:`, updateError.message);
                      }
                    }
                  } catch (fetchError: any) {
                    console.error(`   ❌ Error fetching article:`, fetchError.message);
                  }
                }
              }
              
              // If still no sourceData, try to reconstruct PR data from card description fields as fallback
              if (!sourceData) {
                console.log(`   🔄 Attempting to reconstruct PR data from card description...`);
                try {
                  const reconstructed = reconstructPRDataFromCard(cardData.name, cardData.desc);
                  if (reconstructed) {
                    sourceData = reconstructed;
                    console.log(`   ✅ Reconstructed PR data from card description`);
                    console.log(`   📋 Reconstructed data keys: ${Object.keys(sourceData).join(', ')}`);
                    // Store in memory for future use
                    trelloCardToPR.set(cardId, sourceData);
                  } else {
                    console.log(`   ⚠️  Could not reconstruct PR data from card description`);
                  }
                } catch (reconError: any) {
                  console.warn(`   ⚠️  Error reconstructing PR data:`, reconError.message);
                }
              }
            }
          } catch (cardError: any) {
            console.error(`   ❌ Error fetching card data:`, cardError);
          }
        } else {
          console.log(`   ✅ Found source data in memory`);
          console.log(`   📋 Source data keys: ${Object.keys(sourceData).join(', ')}`);
          
          // VALIDATION: Check if stored URL matches card description URL (even for in-memory data)
          if (cardDescriptionUrl) {
            const storedUrl = sourceData.url || sourceData.link || '';
            console.log(`   🔍 Validating URL match (in-memory data):`);
            console.log(`      Card description URL: ${cardDescriptionUrl}`);
            console.log(`      Stored data URL: ${storedUrl || '(none)'}`);
            
            // Normalize URLs for comparison (remove trailing slashes, convert to lowercase)
            const normalizeUrl = (url: string): string => {
              return url.toLowerCase().replace(/\/+$/, '').trim();
            };
            
            const normalizedCardUrl = normalizeUrl(cardDescriptionUrl!);
            const normalizedStoredUrl = storedUrl ? normalizeUrl(storedUrl) : null;
            
            if (normalizedStoredUrl && normalizedCardUrl !== normalizedStoredUrl) {
              console.warn(`   ⚠️  URL MISMATCH DETECTED in memory data!`);
              console.warn(`      Card description URL: ${cardDescriptionUrl}`);
              console.warn(`      Stored data URL: ${storedUrl}`);
              console.warn(`   🔄 Re-fetching article from card description URL...`);
              
              // Re-fetch the correct article
              const apiKey = (card.idList === (process.env.TRELLO_LIST_ID_PR || '')) 
                ? process.env.BENZINGA_PR_API_KEY 
                : process.env.BENZINGA_API_KEY;
              
              if (apiKey) {
                try {
                  const { fetchBenzingaArticleByUrl } = await import("./benzinga-api");
                  const correctArticle = await fetchBenzingaArticleByUrl(cardDescriptionUrl!, apiKey);
                  
                  if (correctArticle) {
                    console.log(`   ✅ Successfully re-fetched correct article: ${correctArticle.title}`);
                    sourceData = correctArticle;
                    trelloCardToPR.set(cardId, correctArticle);
                  }
                } catch (fetchError: any) {
                  console.error(`   ❌ Error re-fetching article:`, fetchError.message);
                }
              }
            }
          }
        }
        
        // If no source data found, check if this might be a manually created card that needs processing
        if (!sourceData) {
          console.error(`   ❌ Source data not found for card ID: ${cardId}`);
          
          // Check if card description has a URL (manual card) - cardData already fetched above
          const hasUrl = cardDescriptionUrl !== null || /https?:\/\//.test(cardData.desc || '');
          const hasProcessButton = /\[Process For AI\]/.test(cardData.desc || '');
          
          // Move card back to original list or to a safe location
          try {
            const prListId = process.env.TRELLO_LIST_ID_PR;
            const wgoListId = process.env.TRELLO_LIST_ID_WGO;
            const inProgressListId = process.env.TRELLO_LIST_ID_IN_PROGRESS;
            
            // If card is in "In Progress", try to determine original list
            // Otherwise, leave it where it is
            let originalListId: string | null = null;
            if (card.idList === inProgressListId) {
              // Card is in "In Progress" - try to move to PR or WGO list
              // We'll try PR first, then WGO as fallback
              originalListId = prListId || wgoListId || null;
            } else {
              // Card is not in "In Progress", leave it where it is
              originalListId = null;
            }
            
            if (originalListId && card.idList !== originalListId) {
              await trello.moveCardToList(cardId, originalListId);
              console.log(`   🔄 Moved card back to original list due to missing source data`);
            }
          } catch (moveError: any) {
            console.error(`   ⚠️  Could not move card back:`, moveError.message);
          }
          
          if (hasUrl && !hasProcessButton) {
            // This is a manually created card that hasn't been processed yet
            const appUrl = process.env.APP_URL || 'http://localhost:3001';
            console.log(`   💡 This appears to be a manually created card with a URL but no source data.`);
            console.log(`   💡 Card needs to be processed first. Please click "Process For AI" button or visit: ${appUrl}/trello/process-card/${cardId}`);
            
            // Update card with error message and add Process For AI button
            try {
              let updatedDesc = cardData.desc || '';
              // Remove any existing error messages to avoid duplicates
              updatedDesc = updatedDesc.replace(/\n\n---\n\n## ⚠️ Card Not Processed[\s\S]*?(?=\n\n---|$)/, '');
              updatedDesc += `\n\n---\n\n## ⚠️ Card Not Processed\n\n`;
              updatedDesc += `This card was manually created but has not been processed yet.\n\n`;
              updatedDesc += `**To process this card:**\n`;
              updatedDesc += `1. Make sure the article URL is in the description\n`;
              updatedDesc += `2. Click **[Process For AI](${appUrl}/trello/process-card/${cardId})** to fetch article content\n`;
              updatedDesc += `3. After processing, the "Generate Article" button will appear\n`;
              await trello.updateCardDescription(cardId, updatedDesc);
            } catch (updateError) {
              console.error(`   ❌ Failed to update card:`, updateError);
            }
          } else {
            // Generic error - no source data found
            try {
              let updatedDesc = cardData.desc || '';
              updatedDesc = updatedDesc.replace(/\n\n---\n\n## ❌ Generation Error[\s\S]*?(?=\n\n---|$)/, '');
              updatedDesc += `\n\n---\n\n## ❌ Generation Error\n\n`;
              updatedDesc += `Could not find article source data. Please check that the card has been processed correctly.\n\n`;
              updatedDesc += `**Error:** Source data not found\n`;
              updatedDesc += `**Time:** ${new Date().toLocaleString()}\n`;
              await trello.updateCardDescription(cardId, updatedDesc);
            } catch (updateError) {
              console.error(`   ❌ Failed to update card with error:`, updateError);
            }
          }
          
          return; // Exit early - card moved back and error message added
        }
    
        // FINAL VALIDATION: For automatically created cards, validate URL matches stored data
        // (Manual cards are already handled above - they fetch immediately)
        if (!isManualCard && cardDescriptionUrl && sourceData) {
          const normalizeUrlFinal = (url: string): string => {
            return url.toLowerCase().replace(/\/+$/, '').trim().replace(/[.,;:!?]+$/, '');
          };
          // Automatically created card - validate URL matches stored data
          const storedUrl = sourceData.url || sourceData.link || '';
          const normalizedCardUrl = normalizeUrlFinal(cardDescriptionUrl!);
          const normalizedStoredUrl = storedUrl ? normalizeUrlFinal(storedUrl) : '';
          
          if (normalizedStoredUrl && normalizedCardUrl !== normalizedStoredUrl) {
            console.warn(`   ⚠️  URL MISMATCH - re-fetching from description URL before generation`);
            console.warn(`      Description URL: ${cardDescriptionUrl}`);
            console.warn(`      Stored URL: ${storedUrl}`);
            
            const apiKey = (card.idList === (process.env.TRELLO_LIST_ID_PR || '')) 
              ? process.env.BENZINGA_PR_API_KEY 
              : process.env.BENZINGA_API_KEY;
            
            if (apiKey) {
              try {
                const { fetchBenzingaArticleByUrl } = await import("./benzinga-api");
                const correctArticle = await fetchBenzingaArticleByUrl(cardDescriptionUrl!, apiKey);
                
                if (correctArticle) {
                  console.log(`   ✅ Re-fetched correct article: ${correctArticle.title}`);
                  sourceData = correctArticle;
                  trelloCardToPR.set(cardId, correctArticle);
                }
              } catch (fetchError: any) {
                console.error(`   ❌ Error re-fetching:`, fetchError.message);
                console.error(`   ⚠️  Proceeding with stored data - article may be incorrect!`);
              }
            }
          }
        }
    
    // Determine if this is PR data or article data (WGO)
    // PR data characteristics:
    //   - Has prId (unique identifier)
    //   - Has teaser and body fields
    //   - May have URL (PRs from Benzinga do have URLs)
    //   - May have stocks array
    // WGO article data characteristics:
    //   - No prId
    //   - Has URL
    //   - Has stocks array (from news articles)
    //   - Has title
    
    const hasPRId = sourceData.prId !== undefined;
    const hasURL = !!(sourceData.url || sourceData.link);
    const hasStocks = !!(sourceData.stocks && Array.isArray(sourceData.stocks) && sourceData.stocks.length > 0);
    const hasPRFields = !!(sourceData.teaser && sourceData.body);
    const hasTitle = !!(sourceData.title || sourceData.headline);
    
    // PR detection: prId is the definitive indicator
    // If no prId, check if it has PR-like fields (teaser + body) AND comes from a PR list (we'll use selectedApp hint)
    // If selectedApp=story is in the URL, it's likely a PR
    const isPR = hasPRId || (hasPRFields && selectedApp === "story");
    // WGO detection: Has URL/stocks/title but no prId, and selectedApp suggests WGO
    const isWGO = !isPR && (hasURL || hasStocks || hasTitle) && (selectedApp === "wgo" || !selectedApp || (!hasPRFields && selectedApp !== "story"));
    
    console.log(`   🔍 Data type detection:`);
    console.log(`      hasPRId: ${hasPRId}, hasURL: ${hasURL}, hasStocks: ${hasStocks}, hasPRFields: ${hasPRFields}`);
    console.log(`      Detected: ${isPR ? 'PR' : isWGO ? 'WGO article' : 'unknown'} data`);
    console.log(`   ✅ Found ${isPR ? 'PR' : isWGO ? 'WGO article' : 'unknown'} data: ${sourceData.title || sourceData.headline || 'Untitled'}...`);
    
    // Import article generation service
    const { generateArticle } = await import("./article-generator-integration");
    
    // Determine which app to use based on data type and query parameter
    // PRIORITY: Query parameter > Detection logic
    // If selectedApp is explicitly provided in the URL, trust it over auto-detection
    let appToUse: string | undefined = typeof selectedApp === 'string' ? selectedApp : undefined;
    
    // Only use auto-detection if selectedApp wasn't explicitly provided or is the default
    // This ensures that PR cards with selectedApp=story and WGO cards with selectedApp=wgo are respected
    if (!selectedApp || selectedApp === "story") {
      // Auto-detect based on data structure
      if (isPR) {
        appToUse = "story"; // PR articles use story generator
        console.log(`   🔍 Auto-detected as PR, using story generator`);
      } else if (isWGO) {
        appToUse = "wgo"; // WGO articles use WGO generator
        console.log(`   🔍 Auto-detected as WGO, using wgo generator`);
      } else {
        // If unclear, use selectedApp from query param, or default to story
        appToUse = selectedApp || "story";
        console.log(`   ⚠️  Could not auto-detect type, using ${appToUse}`);
      }
    } else {
      // selectedApp was explicitly provided (from Trello card link), use it
      console.log(`   ✅ Using explicit selectedApp from URL: ${selectedApp}`);
    }
    
    console.log(`   📝 Final app selection: ${appToUse} for article generation`);
    
    // Extract ticker - PRIORITIZE ticker from Trello card metadata over original article's stocks
    // This ensures the intended ticker (e.g., MSFT) is used, not a ticker mentioned in the article content (e.g., AAPL)
    let ticker: string | null = null;
    
    // PRIORITY 1: Check direct ticker field (from Trello card metadata/description)
    // This is the ticker that was explicitly set when creating the Trello card
    ticker = sourceData.ticker || sourceData.symbol || sourceData.topic || null;
    if (ticker) {
      ticker = String(ticker).toUpperCase().trim();
      console.log(`   📊 Using ticker from Trello card metadata: ${ticker}`);
    }
    
    // PRIORITY 2: Only if no ticker field, try stocks array (from original article)
    // This prevents the stocks array from overriding the intended ticker from the card
    if (!ticker && sourceData.stocks && Array.isArray(sourceData.stocks) && sourceData.stocks.length > 0) {
      const firstStock = sourceData.stocks[0];
      if (typeof firstStock === 'string') {
        ticker = firstStock.toUpperCase().trim();
      } else if (typeof firstStock === 'object' && firstStock !== null) {
        const tickerStr = (firstStock as any).ticker || (firstStock as any).symbol || (firstStock as any).name || '';
        if (tickerStr) {
          ticker = String(tickerStr).toUpperCase().trim();
        }
      }
      if (ticker) {
        console.log(`   ⚠️  No ticker in card metadata, using ticker from stocks array: ${ticker}`);
      }
    }
    
    console.log(`   📊 Final extracted ticker: ${ticker || 'N/A'}`);
    
    // Create pitch - different format for PR vs WGO
    let dateStr = 'Date not available';
    if (sourceData.created) {
      try {
        let date: Date;
        if (typeof sourceData.created === 'string') {
          date = new Date(sourceData.created);
        } else if (typeof sourceData.created === 'number') {
          date = sourceData.created > 1000000000000 ? new Date(sourceData.created) : new Date(sourceData.created * 1000);
        } else {
          date = new Date(sourceData.created);
        }
        
        if (!isNaN(date.getTime())) {
          dateStr = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
        }
      } catch (dateError) {
        dateStr = 'Date not available';
      }
    }
    
    const title = sourceData.title || sourceData.headline || 'Untitled';
    let pitch: string;
    
    // Check if this is URL-only data (no API content)
    const isUrlOnly = sourceData._urlOnly === true;
    
    if (isPR) {
      // PR format
      let summary = sourceData.teaser || (sourceData.body ? sourceData.body.substring(0, 500) : '');
      
      // If URL-only, use the URL in the summary
      if (isUrlOnly && !summary) {
        summary = `Source article available at: ${sourceData.url || cardDescriptionUrl || 'URL not available'}`;
      } else if (!summary) {
        summary = 'No summary available';
      }
      
      pitch = `Proposed Article: ${title}

Source: Benzinga Press Release${isUrlOnly ? ' (URL provided)' : ''}
Published: ${dateStr}
${ticker ? `Company Ticker: ${ticker}` : ''}
${isUrlOnly ? `Source URL: ${sourceData.url || cardDescriptionUrl || ''}` : ''}

Executive Summary:
${summary}

Proposed Angle: Analyze the implications of this press release${ticker ? ` for ${ticker} investors` : ''} and the broader market.`;
    } else {
      // WGO article format - try multiple summary sources (Benzinga articles often have 'teaser')
      let summary = sourceData.teaser || sourceData.summary || sourceData.description || 
                     (sourceData.body ? sourceData.body.substring(0, 500) : '');
      
      // If URL-only, use the URL in the summary
      if (isUrlOnly && !summary) {
        summary = `Source article available at: ${sourceData.url || cardDescriptionUrl || 'URL not available'}`;
      } else if (!summary) {
        summary = 'No summary available';
      }
      
      pitch = `Proposed Article: ${title}

Source: Benzinga News${isUrlOnly ? ' (URL provided)' : ''}
Published: ${dateStr}
${ticker ? `Company Ticker: ${ticker}` : ''}
${isUrlOnly ? `Source URL: ${sourceData.url || cardDescriptionUrl || ''}` : ''}

Executive Summary:
${summary}

Proposed Angle: Provide technical analysis and market insights${ticker ? ` for ${ticker}` : ''} based on this news story.`;
    }
    
    console.log(`   📝 Generating article using app: ${appToUse}`);
    console.log(`   📝 Title: ${title}`);
    console.log(`   📝 Ticker: ${ticker || 'N/A'}`);
    console.log(`   📝 Type: ${isPR ? 'PR' : isWGO ? 'WGO Article' : 'Unknown'}`);
    
    // Log what article is being processed
    console.log(`   📰 Processing article:`);
    console.log(`      Title: ${sourceData.title || sourceData.headline || 'No title'}`);
    console.log(`      URL: ${sourceData.url || sourceData.link || 'No URL'}`);
    console.log(`      Ticker: ${ticker || 'N/A'}`);
    if (sourceData.prId) {
      console.log(`      PR ID: ${sourceData.prId}`);
    }
    
    // Generate article
    const generatedArticle = await generateArticle(
      pitch,
      appToUse || 'default',
      ticker || undefined,
      [sourceData],
      sourceData,
      ticker || undefined
    );
    
    console.log(`   ✅ Article generated successfully (length: ${generatedArticle.length} chars)`);
    
    // Extract title from generated article
    function toTitleCase(str: string): string {
      return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    }
    
    let generatedTitle = title;
    if (generatedArticle) {
      const htmlMatch = generatedArticle.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      if (htmlMatch && htmlMatch[1]) {
        generatedTitle = htmlMatch[1].replace(/<[^>]+>/g, '').trim();
      } else {
        const textContent = generatedArticle.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const firstSentence = textContent.split(/[.!?]/)[0];
        if (firstSentence && firstSentence.length > 20 && firstSentence.length < 150) {
          generatedTitle = firstSentence.trim();
        }
      }
    }
    generatedTitle = toTitleCase(generatedTitle);
    
    // Escape HTML to prevent XSS
    function escapeHtml(text: string): string {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    }
    
    // Store generated article first (before updating Trello)
    // Use appropriate storage based on type
    const generatedId = `trello_gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const articleData = {
      id: generatedId,
      sourceArticle: sourceData,
      generatedArticle: generatedArticle,
      ticker: ticker || 'N/A',
      title: generatedTitle,
      createdAt: Date.now(),
      pitch: pitch,
      sourceUrl: isPR ? (sourceData.url || '') : (sourceData.url || sourceData.link || ''),
    };
    
    // Store in appropriate array based on type (before editor review)
    try {
      if (isPR) {
        prGeneratedArticles.push(articleData);
        console.log(`   💾 Stored article in prGeneratedArticles: ${generatedId} (total: ${prGeneratedArticles.length})`);
        console.log(`   🔗 Article viewable at: ${process.env.APP_URL || 'http://localhost:3001'}/pr-auto-scan/articles/${generatedId}`);
      } else {
        // For WGO articles, we can store them in the same array or a separate one
        // For now, let's use the same prGeneratedArticles array (it's a bit of a misnomer but works)
        prGeneratedArticles.push(articleData);
        console.log(`   💾 Stored article in prGeneratedArticles: ${generatedId} (total: ${prGeneratedArticles.length})`);
        console.log(`   🔗 Article viewable at: ${process.env.APP_URL || 'http://localhost:3001'}/pr-auto-scan/articles/${generatedId}`);
      }
      
      // Verify article was stored
      const verifyArticle = prGeneratedArticles.find(a => a.id === generatedId);
      if (!verifyArticle) {
        console.error(`   ❌ CRITICAL: Article ${generatedId} was not stored successfully!`);
        throw new Error(`Failed to store article ${generatedId} in prGeneratedArticles array`);
      } else {
        console.log(`   ✅ Verified article ${generatedId} is stored in array`);
      }
    } catch (storageError: any) {
      console.error(`   ❌ Error storing article:`, storageError);
      console.error(`   ❌ Storage error details:`, storageError.message);
      console.error(`   ❌ Stack trace:`, storageError.stack);
      throw storageError; // Re-throw to be caught by outer error handler
    }
    
    // Skip old editor review - articles go directly to Submitted
    // Number verification will run automatically when card is moved to Submitted
    console.log(`   ✅ Article generated - moving directly to Submitted list`);
    console.log(`   🔗 Article will be available at: ${process.env.APP_URL || 'http://localhost:3001'}/pr-auto-scan/articles/${generatedId}`);
    
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const articleViewUrl = `${appUrl}/pr-auto-scan/articles/${generatedId}`;
    
    try {
      console.log(`   📝 Updating Trello card description with article link...`);
      const cardData = await trello.getCardData(cardId);
      let updatedDesc = cardData.desc || '';
      updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Generate Article\]\([^)]+\)\*\*/g, '');
      updatedDesc += `\n\n---\n\n## ✅ Article Generated\n\n`;
      updatedDesc += `**Title:** ${generatedTitle}\n\n`;
      updatedDesc += `**View Article:** [View Generated Article](${articleViewUrl})\n\n`;
      updatedDesc += `**Generated:** ${new Date().toLocaleString()}\n`;
      
      await trello.updateCardDescription(cardId, updatedDesc);
      console.log(`   ✅ Card description updated successfully (length: ${updatedDesc.length} chars)`);
      console.log(`   🔗 Article link: ${articleViewUrl}`);
      
      // Add comment with article preview
      const articlePreview = generatedArticle
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 500);
      const commentText = `**✅ Article Generated**\n\n**Title:** ${generatedTitle}\n\n**Preview:** ${articlePreview}...\n\n[View Full Article](${articleViewUrl})`;
      try {
        await trello.addComment(cardId, commentText);
        console.log(`   ✅ Added article preview comment to card`);
      } catch (commentError: any) {
        console.warn(`   ⚠️  Could not add comment:`, commentError.message);
      }
      
      const submittedListId = process.env.TRELLO_LIST_ID_SUBMITTED;
      if (submittedListId) {
        await trello.moveCardToList(cardId, submittedListId);
        console.log(`   ✅ Moved card to Submitted list`);
        
        // Trigger number verification directly (since we moved it programmatically, webhook might not fire)
        const verificationEnabled = process.env.EDITOR_NUMBER_VERIFICATION_ENABLED === 'true';
        if (verificationEnabled) {
          console.log(`   🔢 Triggering number verification directly...`);
          (async () => {
            try {
              const verificationThreadId = `verification_${cardId}_${Date.now()}`;
              const verificationConfig = { configurable: { thread_id: verificationThreadId } };
              
              await numberVerificationGraph.invoke({
                cardId,
                articleContent: generatedArticle,
                sourceMaterial: sourceData,
                verificationStatus: '',
                verificationSummary: '',
                verifiedNumbers: 0,
                discrepancies: [],
                verificationNotes: '',
              }, verificationConfig);
              
              console.log(`   ✅ Number verification completed for card ${cardId}`);
            } catch (verifyError: any) {
              console.error(`   ❌ Error in number verification:`, verifyError);
              console.error(`   ❌ Error message: ${verifyError.message}`);
              console.error(`   ❌ Error stack: ${verifyError.stack}`);
            }
          })();
        } else {
          console.log(`   ℹ️  Number verification is disabled (EDITOR_NUMBER_VERIFICATION_ENABLED not set to 'true')`);
        }
      } else {
        console.warn(`   ⚠️  TRELLO_LIST_ID_SUBMITTED not set - card not moved to Submitted`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error updating card:`, error);
      console.error(`   ❌ Error details:`, error.message);
      console.error(`   ❌ Stack trace:`, error.stack);
    }
    
        // Article generation completed in background
        // Card was already moved to "In Progress" at the start
        // Now moved to "Submitted" when done
        console.log(`   ✅ Background article generation completed`);
      } catch (error: any) {
        console.error(`   ❌ Error in background article generation:`, error);
        
        // Update card with error message and move it back to original list
        try {
          const { TrelloService } = await import("./trello-service");
          const trello = new TrelloService();
          const card = await trello.getCard(cardId);
          const cardData = await trello.getCardData(cardId);
          
          // Move card back to original list
          const prListId = process.env.TRELLO_LIST_ID_PR;
          const wgoListId = process.env.TRELLO_LIST_ID_WGO;
          const inProgressListId = process.env.TRELLO_LIST_ID_IN_PROGRESS;
          
          // If card is in "In Progress", try to move it back to PR or WGO list
          let originalListId: string | null = null;
          if (card.idList === inProgressListId) {
            // Card is in "In Progress" - try to move to PR or WGO list
            originalListId = prListId || wgoListId || null;
          }
          
          if (originalListId && card.idList !== originalListId) {
            try {
              await trello.moveCardToList(cardId, originalListId);
              console.log(`   🔄 Moved card back to original list due to error`);
            } catch (moveError: any) {
              console.error(`   ⚠️  Could not move card back:`, moveError.message);
            }
          }
          
          // Update card description with error message
          let updatedDesc = cardData.desc || '';
          // Remove any existing error messages to avoid duplicates
          updatedDesc = updatedDesc.replace(/\n\n---\n\n## ❌ Generation Error[\s\S]*?(?=\n\n---|$)/, '');
          updatedDesc += `\n\n---\n\n## ❌ Generation Error\n\n`;
          updatedDesc += `An error occurred while generating the article.\n\n`;
          updatedDesc += `**Error:** ${error.message || 'Unknown error'}\n`;
          updatedDesc += `**Time:** ${new Date().toLocaleString()}\n\n`;
          updatedDesc += `Please try again or check the server logs for more details.\n`;
          await trello.updateCardDescription(cardId, updatedDesc);
          console.log(`   ✅ Updated card with error message`);
        } catch (updateError: any) {
          console.error(`   ❌ Failed to update card with error message:`, updateError);
        }
      }
    })(); // Execute async function immediately (fire and forget)
    
  } catch (error: any) {
    console.error(`   ❌ Error in Trello article generation endpoint:`, error);
    // If there's an error before background processing starts, still return the auto-close HTML
    const errorHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Processing...</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
            color: #dc2626;
        }
        .message {
            text-align: center;
            padding: 20px;
        }
    </style>
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.close();
            }, 100);
        };
    </script>
</head>
<body>
    <div class="message">
        <h2>⚠️ Error</h2>
        <p>An error occurred. You can close this window.</p>
    </div>
</body>
</html>`;
    res.status(500).send(errorHtml);
  }
});

// EMAIL ANALYST AGENT ENDPOINT: Check for new analyst emails and create Trello cards
// Usage: POST /email-analyst/check
app.post("/email-analyst/check", async (req, res) => {
  console.log(`\n📧 [POST /email-analyst/check] Checking for analyst emails...`);
  
  try {
    const threadId = `email_analyst_${Date.now()}`;
    const config = { configurable: { thread_id: threadId } };
    
    console.log(`   🔄 Invoking email analyst graph with thread ID: ${threadId}`);
    
    // Invoke the email analyst agent
    const result = await emailAnalystGraph.invoke({}, config);
    console.log(`   ✅ Graph invocation completed`);
    console.log(`   📊 Graph result keys:`, Object.keys(result || {}));
    
    // Get the final state to see results
    const state = await emailAnalystGraph.getState(config);
    console.log(`   📊 Final state keys:`, Object.keys(state.values || {}));
    console.log(`   📊 State values:`, {
      emailMessagesCount: (state.values.emailMessages || []).length,
      extractedNotesCount: (state.values.extractedNotes || []).length,
      trelloCardsCount: (state.values.trelloCards || []).length,
    });
    
    const trelloCards = state.values.trelloCards || [];
    const extractedNotes = state.values.extractedNotes || [];
    
    console.log(`   ✅ Email analyst agent completed`);
    console.log(`   📧 Processed ${extractedNotes.length} email(s)`);
    console.log(`   📌 Created ${trelloCards.length} Trello card(s)`);
    
    if (trelloCards.length === 0 && extractedNotes.length > 0) {
      console.error(`   ⚠️  WARNING: ${extractedNotes.length} notes extracted but 0 cards created!`);
      console.error(`   ⚠️  This suggests the trello_cards node did not execute or failed silently.`);
    }
    
    res.json({
      status: "completed",
      emailsProcessed: extractedNotes.length,
      cardsCreated: trelloCards.length,
      cardUrls: trelloCards
    });
  } catch (error: any) {
    console.error(`   ❌ Error in email analyst agent:`, error);
    console.error(`   ❌ Error stack:`, error.stack);
    res.status(500).json({ 
      error: "Failed to check emails", 
      message: error.message 
    });
  }
});

// ANALYST STORY GENERATOR ENDPOINT: Generate analyst story from Trello card
// Usage: GET /analyst-story/generate/:cardId
// This endpoint is called when user clicks "Generate Story" button in Trello card
app.get("/analyst-story/generate/:cardId", async (req, res) => {
  const { cardId } = req.params;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📝 [GET /analyst-story/generate/${cardId}] Generating analyst story from Trello card`);
  console.log(`   🔍 Request received at: ${new Date().toISOString()}`);
  console.log(`   📋 Card ID: ${cardId}`);
  console.log(`   🌐 Request origin: ${req.get('origin') || 'unknown'}`);
  console.log(`   🔗 Referer: ${req.get('referer') || 'unknown'}`);
  console.log(`${"=".repeat(60)}`);
  
  try {
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    console.log(`   ✅ TrelloService initialized`);
    
    // Move card to "In Progress" list immediately
    const inProgressListId = process.env.TRELLO_LIST_ID_IN_PROGRESS;
    if (inProgressListId) {
      try {
        await trello.moveCardToList(cardId, inProgressListId);
        console.log(`   ✅ Moved card to In Progress list`);
      } catch (moveError: any) {
        console.warn(`   ⚠️  Error moving card to In Progress list:`, moveError.message);
      }
    } else {
      console.log(`   ⚠️  TRELLO_LIST_ID_IN_PROGRESS not set, skipping card move to In Progress`);
    }
    
    // Return immediately with auto-close page, process generation in background
    // Improved auto-close that works better across browsers
    const autoCloseHtml = `<!DOCTYPE html><html><head><title>Processing...</title><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;color:#059669}.message{text-align:center;padding:20px;max-width:400px}</style><script>
(function() {
  // Show processing message immediately
  document.body.innerHTML = '<div class="message"><h2>✅ Processing Started</h2><p>Analyst story generation has started.</p><p><small>This window will close automatically...</small></p></div>';
  
  // Try to close the window (works if opened by JavaScript)
  // If it doesn't close (e.g., user opened link directly), show success message
  setTimeout(function() {
    try {
      window.close();
      // If window.close() doesn't work, show message and redirect
      setTimeout(function() {
        if (!document.hidden) {
          document.body.innerHTML = '<div class="message"><h2>✅ Processing Started</h2><p>Analyst story generation is running in the background.</p><p><small>You can close this window now.</small></p></div>';
        }
      }, 500);
    } catch(e) {
      // Window can't be closed (e.g., not opened by script)
      document.body.innerHTML = '<div class="message"><h2>✅ Processing Started</h2><p>Analyst story generation is running in the background.</p><p><small>You can close this window now.</small></p></div>';
    }
  }, 1500);
})();
</script></head><body><div class="message"><h2>Processing...</h2><p>Starting analyst story generation...</p></div></body></html>`;
    res.send(autoCloseHtml);
    
    // Process story generation in background
    (async () => {
      const threadId = `analyst_story_run_${cardId}`;
      const config = { configurable: { thread_id: threadId } };
      
      try {
        const startTime = Date.now();
        console.log(`   🔄 Invoking analyst story graph with cardId: ${cardId}`);
        console.log(`   📋 Thread ID: ${threadId}`);
        console.log(`   ⏱️  Start time: ${new Date().toISOString()}`);
        console.log(`   🔍 Checking environment variables...`);
        console.log(`      - ARTICLE_GEN_APP_ANALYST_URL: ${process.env.ARTICLE_GEN_APP_ANALYST_URL || 'NOT SET (preferred)'}`);
        console.log(`      - ANALYST_BASE_URL: ${process.env.ANALYST_BASE_URL || 'NOT SET (legacy fallback)'}`);
        console.log(`      - ANALYST_AI_PROVIDER: ${process.env.ANALYST_AI_PROVIDER || 'NOT SET'}`);
        
        // Run the analyst story generation agent
        // NOTE: The agent's updateTrelloNode will handle moving the card to Submitted
        // We don't need to duplicate that logic here
        console.log(`   🚀 Starting analyst story graph execution...`);
        await analystStoryGraph.invoke({ cardId }, config);
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   ✅ Analyst story graph invocation completed (took ${elapsed}s)`);
        
        const state = await analystStoryGraph.getState(config);
        console.log(`   📊 Graph state retrieved`);
        console.log(`   📊 State keys: ${Object.keys(state.values || {}).join(', ')}`);
        
        // Log detailed state for debugging
        console.log(`   📊 State details:`);
        console.log(`      - noteData: ${state.values.noteData ? 'exists' : 'MISSING'}`);
        console.log(`      - extractedData: ${state.values.extractedData ? 'exists' : 'MISSING'}`);
        console.log(`      - generatedStory: ${state.values.generatedStory ? `exists (${typeof state.values.generatedStory === 'string' ? state.values.generatedStory.length : 'object'} chars)` : 'MISSING'}`);
        console.log(`      - storyTitle: ${state.values.storyTitle || 'MISSING'}`);
        console.log(`      - storyId: ${state.values.storyId || 'MISSING'}`);
        console.log(`   📊 All state keys: ${Object.keys(state.values).join(', ')}`);
        
        const generatedStory = state.values.generatedStory;
        const storyTitle = state.values.storyTitle || 'Untitled Analyst Story';
        
        console.log(`   📝 Generated story exists: ${!!generatedStory}`);
        console.log(`   📝 Story title: ${storyTitle}`);
        
        if (!generatedStory) {
          console.error(`   ❌ No story generated by agent`);
          console.error(`   📊 Full state values:`, JSON.stringify(state.values, null, 2));
          
          // Try to add error comment to card
          try {
            const { TrelloService } = await import("./trello-service");
            const trello = new TrelloService();
            const errorMsg = `❌ Error: No story was generated. Possible causes:\n- Card data could not be extracted\n- Story generator API failed\n- Check server logs for details`;
            await trello.addComment(cardId, errorMsg);
            console.log(`   ✅ Added error comment to Trello card`);
          } catch (commentError) {
            console.error(`   ❌ Failed to add error comment:`, commentError);
          }
          
          throw new Error('No story generated by agent - check logs for details');
        }
        
        // NOTE: The analyst story agent's updateTrelloNode already:
        // 1. Updates the card description with the story link
        // 2. Adds a comment
        // 3. Moves the card to Submitted list
        // So we don't need to do that here - the agent handles it all
        
        // Store the generated story so it can be viewed via the view endpoint
        // The agent's updateTrelloNode creates the storyId and writes it to the Trello card
        // CRITICAL: We must use the exact storyId that matches the cardId passed to this endpoint
        console.log(`   🔍 Attempting to store story for cardId: ${cardId}...`);
        
        // First, try to get storyId from state (if agent returned it)
        // This is the most reliable source since the agent just created it
        let storyId = state.values.storyId;
        console.log(`   🔍 storyId from state: ${storyId || 'null/undefined'}`);
        
        // Verify storyId matches the cardId (if present)
        if (storyId && !storyId.startsWith(`analyst_${cardId}_`)) {
          console.warn(`   ⚠️  WARNING: storyId from state doesn't match cardId!`);
          console.warn(`   ⚠️  storyId: ${storyId}`);
          console.warn(`   ⚠️  Expected prefix: analyst_${cardId}_`);
          console.warn(`   ⚠️  This shouldn't happen - using state storyId anyway`);
          // Keep the storyId from state - it's what the agent just created
        }
        
        // Always read from card description as primary source (agent just wrote it there)
        // This ensures we get the exact storyId that was written to THIS card
        // Add a small delay to ensure Trello has fully updated the card
        try {
          console.log(`   🔍 Waiting 500ms for Trello card to update...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          console.log(`   🔍 Reading card description for cardId: ${cardId} to extract storyId...`);
          const cardData = await trello.getCardData(cardId);
          console.log(`   🔍 Card name: ${cardData.name}`);
          console.log(`   🔍 Card description length: ${cardData.desc?.length || 0} chars`);
          
          // Try multiple patterns to extract storyId from the URL
          // IMPORTANT: Verify the extracted storyId matches the cardId
          const patterns = [
            /analyst-story\/view\/(analyst_[^\s\)\]]+)/,  // Standard pattern: analyst_xxx_xxx
            /analyst-story\/view\/([^\s\)\]]+)/,         // More permissive
            /\/analyst-story\/view\/([a-zA-Z0-9_]+)/,    // Even more permissive
          ];
          
          for (const pattern of patterns) {
            const match = cardData.desc?.match(pattern);
            if (match && match[1]) {
              const extractedId = match[1];
              
              // CRITICAL: Verify the extracted storyId matches this cardId
              if (extractedId.startsWith(`analyst_${cardId}_`)) {
                // Only use extracted ID if we don't have one from state, or if they match
                if (!storyId) {
                  console.log(`   ✅ Extracted storyId from card: ${extractedId} (no state storyId)`);
                  storyId = extractedId;
                } else if (storyId === extractedId) {
                  console.log(`   ✅ Extracted storyId from card matches state: ${extractedId}`);
                } else {
                  console.warn(`   ⚠️  Mismatch: state has ${storyId}, card has ${extractedId}`);
                  console.warn(`   ⚠️  Using state storyId (most recent): ${storyId}`);
                  // Keep storyId from state - it's what the agent just created
                }
                break;
              } else {
                console.warn(`   ⚠️  Extracted storyId doesn't match cardId: ${extractedId}`);
                console.warn(`   ⚠️  Expected prefix: analyst_${cardId}_`);
                console.warn(`   ⚠️  Actual prefix: analyst_${extractedId.split('_')[1]}_`);
              }
            }
          }
          
          // If still no match, try one more time after a longer delay (Trello API might be slow)
          if (!storyId) {
            console.log(`   🔍 Retrying after 1 second delay...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryCardData = await trello.getCardData(cardId);
            
            for (const pattern of patterns) {
              const match = retryCardData.desc?.match(pattern);
              if (match && match[1]) {
                const extractedId = match[1];
                if (extractedId.startsWith(`analyst_${cardId}_`)) {
                  console.log(`   ✅ Extracted storyId on retry: ${extractedId}`);
                  storyId = extractedId;
                  break;
                }
              }
            }
          }
          
          if (!storyId) {
            console.warn(`   ⚠️  Could not extract matching storyId from card description after retry`);
            console.warn(`   ⚠️  Looking for storyId starting with: analyst_${cardId}_`);
            const analystStoryIndex = cardData.desc?.indexOf('analyst-story');
            if (analystStoryIndex !== undefined && analystStoryIndex >= 0) {
              console.warn(`   ⚠️  Description snippet around 'analyst-story': ${cardData.desc?.substring(
                Math.max(0, analystStoryIndex - 50),
                analystStoryIndex + 200
              )}`);
            } else {
              console.warn(`   ⚠️  'analyst-story' not found in description`);
            }
          }
        } catch (extractError: any) {
          console.error(`   ❌ Error reading card to extract storyId:`, extractError.message);
          console.error(`   ❌ Will use storyId from state if it matches cardId`);
        }
        
        // Final verification: storyId must match cardId
        if (storyId && !storyId.startsWith(`analyst_${cardId}_`)) {
          console.error(`   ❌ CRITICAL: storyId doesn't match cardId!`);
          console.error(`   ❌ storyId: ${storyId}`);
          console.error(`   ❌ cardId: ${cardId}`);
          console.error(`   ❌ Cannot store story with mismatched ID`);
          storyId = null;
        }
        
        // Store the story if we have a storyId
        if (storyId) {
          try {
            // Store the story
            analystGeneratedStories.set(storyId, {
              id: storyId,
              cardId: cardId,
              story: typeof generatedStory === 'string' ? generatedStory : generatedStory.story || '',
              title: storyTitle,
              ticker: state.values.noteData?.ticker,
              createdAt: Date.now(),
              noteData: state.values.noteData
            });
            
            console.log(`   💾 ✅ Stored analyst story with ID: ${storyId}`);
            console.log(`   🔗 Story viewable at: ${process.env.APP_URL || 'http://localhost:3001'}/analyst-story/view/${storyId}`);
            console.log(`   📊 Total analyst stories stored: ${analystGeneratedStories.size}`);
            console.log(`   📋 All stored story IDs: ${Array.from(analystGeneratedStories.keys()).join(', ')}`);
          } catch (storageError: any) {
            console.error(`   ❌ Error storing analyst story:`, storageError.message);
            console.error(`   ❌ Error stack:`, storageError.stack);
            console.error(`   ⚠️  Story was generated but won't be viewable via URL (stored in Trello card)`);
            // Don't throw - story generation was successful, storage is just for convenience
          }
        } else {
          console.error(`   ❌ CRITICAL: No storyId available - story cannot be stored for viewing`);
          console.error(`   ❌ Story was generated but won't be accessible via URL`);
          console.error(`   ❌ Story content is in Trello card description, but view endpoint won't work`);
          
          // Last resort: generate a storyId based on cardId and current time
          // This won't match what's in the Trello card, but at least we can store it
          const fallbackStoryId = `analyst_${cardId}_${Date.now()}`;
          console.warn(`   ⚠️  Using fallback storyId: ${fallbackStoryId} (won't match Trello card URL)`);
          
          try {
            analystGeneratedStories.set(fallbackStoryId, {
              id: fallbackStoryId,
              cardId: cardId,
              story: typeof generatedStory === 'string' ? generatedStory : generatedStory.story || '',
              title: storyTitle,
              ticker: state.values.noteData?.ticker,
              createdAt: Date.now(),
              noteData: state.values.noteData
            });
            console.log(`   💾 Stored with fallback ID (won't match Trello URL): ${fallbackStoryId}`);
          } catch (fallbackError: any) {
            console.error(`   ❌ Even fallback storage failed:`, fallbackError.message);
          }
        }
        
        console.log(`   ✅ Story generation completed successfully`);
        console.log(`   ✅ Card should have been moved to Submitted list by the agent`);
        
        // NOTE: The analyst story agent's updateTrelloNode already handles:
        // - Updating card description with story link
        // - Adding comment
        // - Moving card to Submitted list
        // So we don't need to duplicate that here
        
        // Skip old editor review - stories go directly to Submitted
        // Number verification will run automatically when card is moved to Submitted
        console.log(`   ✅ Story generated - card already moved to Submitted by analyst story agent`);
        console.log(`   ℹ️  Number verification will run automatically when card is moved to Submitted`);
        
        console.log(`   ✅ Background analyst story generation completed`);
      } catch (error: any) {
        console.error(`\n${"=".repeat(60)}`);
        console.error(`   ❌ ERROR in background analyst story generation:`);
        console.error(`   ❌ Error message: ${error.message || 'Unknown error'}`);
        console.error(`   ❌ Error stack: ${error.stack || 'No stack trace'}`);
        if (error.cause) {
          console.error(`   ❌ Error cause:`, error.cause);
        }
        console.error(`${"=".repeat(60)}\n`);
        
        // Attempt to update card with detailed error message
        try {
          const { TrelloService } = await import("./trello-service");
          const trello = new TrelloService();
          
          // Get current card data
          const cardData = await trello.getCardData(cardId);
          let updatedDesc = cardData.desc || '';
          
          // Remove any existing error messages
          updatedDesc = updatedDesc.replace(/\n\n---\n\n## ❌ Error Generating Story[\s\S]*?$/m, '');
          
          // Add new error message
          const analystUrl = process.env.ARTICLE_GEN_APP_ANALYST_URL || 
                             (process.env.ANALYST_BASE_URL ? `${process.env.ANALYST_BASE_URL}/api/generate/analyst-article` : 'http://localhost:3002/api/generate/analyst-article');
          updatedDesc += `\n\n---\n\n## ❌ Error Generating Story\n\n**Error:** ${error.message || 'Unknown error'}\n\n**Time:** ${new Date().toLocaleString()}\n\n**Possible causes:**\n- Card data could not be extracted from Trello\n- Story generator API (${analystUrl}) is not accessible\n- API returned an error\n- Check server logs for detailed error information\n`;
          
          await trello.updateCardDescription(cardId, updatedDesc);
          console.log(`   ✅ Updated card description with error message`);
          
          // Add comment with error
          const errorComment = `❌ **Error generating analyst story**\n\n**Error:** ${error.message || 'Unknown error'}\n\n**Check:**\n1. Server logs for detailed error\n2. That ANALYST_BASE_URL is correct\n3. That the story generator API is running`;
          await trello.addComment(cardId, errorComment);
          console.log(`   ✅ Added error comment to Trello card`);
        } catch (updateError: any) {
          console.error(`   ❌ Failed to update Trello card with error:`, updateError.message);
          console.error(`   ❌ Update error stack:`, updateError.stack);
        }
      }
    })();
  } catch (error: any) {
    console.error(`   ❌ Error in analyst story generation endpoint:`, error);
    console.error(`   ❌ Error stack:`, error.stack);
    
    // Try to add error comment to Trello card
    try {
      const { TrelloService } = await import("./trello-service");
      const trello = new TrelloService();
      await trello.addComment(cardId, `❌ Error generating analyst story: ${error.message || 'Unknown error'}`);
    } catch (commentError) {
      console.error(`   ❌ Failed to add error comment to Trello:`, commentError);
    }
    
    const errorHtml = `<!DOCTYPE html><html><head><title>Error</title><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;color:#dc2626}.message{text-align:center;padding:20px;max-width:600px}.error-details{background:#fee;border:1px solid #fcc;padding:15px;margin:15px 0;border-radius:5px;text-align:left;font-family:monospace;font-size:12px}</style></head><body><div class="message"><h2>❌ Error Generating Story</h2><p>An error occurred while generating the analyst story.</p><div class="error-details"><strong>Error:</strong> ${error.message || 'Unknown error'}<br><br><strong>Please check:</strong><br>1. Server logs for detailed error information<br>2. That the analyst story agent is properly configured<br>3. That all required environment variables are set</div><p><small>You can close this window.</small></p></div></body></html>`;
    res.status(500).send(errorHtml);
  }
});

// Generate article directly from PR data (bypasses agent workflow)
app.post("/generate-from-pr", async (req, res) => {
  const { pr, selectedApp, manualTicker } = req.body;
  
  if (!pr) {
    return res.status(400).json({ error: "PR data is required" });
  }
  
  if (!selectedApp) {
    return res.status(400).json({ error: "selectedApp is required" });
  }

  try {
    console.log(`\n📝 Generating article directly from PR for app: ${selectedApp}`);
    console.log(`   PR Title: ${pr.title || 'No title'}`);
    console.log(`   PR Ticker: ${pr.ticker || 'N/A'}`);
    
    // Import the article generator
    const { generateArticle } = await import("./article-generator-integration");
    
    // Create a pitch from the PR
    const dateStr = pr.created 
      ? (() => {
          const date = new Date(pr.created * 1000);
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          
          if (date > sevenDaysAgo) {
            return date.toLocaleDateString('en-US', { weekday: 'long' });
          } else {
            return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
          }
        })()
      : 'Date not available';
    
    const ticker = pr.ticker || 'N/A';
    const title = pr.title || 'Untitled Article';
    const fullBody = pr.body || '';
    const summary = pr.teaser || (fullBody ? fullBody.substring(0, 800) : 'No summary available');
    
    const pitch = `Proposed Article: ${title}

Source: Benzinga Press Release
Published: ${dateStr}
${ticker !== 'N/A' ? `Company Ticker: ${ticker}` : ''}

Executive Summary:
${summary}

Proposed Angle: Analyze the implications of this press release.`;
    
    // Generate article using the selected app, passing the PR as the selectedArticle
    // For WGO with news, this will include technical analysis automatically
    // Use manualTicker if provided, otherwise use extracted ticker
    const finalTicker = manualTicker || (ticker !== 'N/A' ? ticker : undefined);
    const article = await generateArticle(
      pitch,
      selectedApp,
      finalTicker,
      [pr], // Pass PR as newsArticles array
      pr, // Pass PR as selectedArticle
      manualTicker // Pass manual ticker separately
    );
    
    res.json({
      status: "completed",
      finalArticle: article
    });
  } catch (error: any) {
    console.error("Error generating article from PR:", error);
    res.status(500).json({ error: "Failed to generate article: " + error.message });
  }
});

// ============================================
// AUTO-SCAN SYSTEM - Article Monitoring & Auto-Generation
// PR AUTO-SCAN SYSTEM - Press Release Monitoring & Auto-Generation
// ============================================

interface ProcessedArticle {
  id: string;
  processedAt: number;
}

interface GeneratedArticle {
  id: string;
  sourceArticle: any;
  generatedArticle: string;
  ticker: string;
  title: string;
  createdAt: number;
  pitch: string;
  sourceUrl?: string; // URL to the original PR/article
  order?: number; // Order in which the PR was processed (matches PR list order)
}

// In-memory storage for processed articles and generated articles
// In production, you'd want to use a database
const processedArticles = new Map<string, ProcessedArticle>();
const generatedArticles: GeneratedArticle[] = [];

// Auto-scan state
let autoScanInterval: NodeJS.Timeout | null = null;
let autoScanTickers: string[] = [];
let autoScanActive = false;
let autoScanApp = "wgo"; // Default to WGO

// Store fetched articles with processing status
interface ArticleProcessingStatus {
  articleId: string;
  article: any;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  generatedArticleId?: string;
  trelloCardUrl?: string; // URL of the Trello card created for this article
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

let fetchedArticles: ArticleProcessingStatus[] = [];
let currentlyProcessingIndex: number = -1;

// PR Auto-scan state (separate from article auto-scan)
let prAutoScanInterval: NodeJS.Timeout | null = null;
let prAutoScanActive = false;
let prAutoScanMode: 'auto' | 'manual' = 'auto';
const prProcessedArticles = new Map<string, ProcessedArticle>();
const prGeneratedArticles: GeneratedArticle[] = [];
let prFetchedArticles: ArticleProcessingStatus[] = [];
let prCurrentlyProcessingIndex: number = -1;
// Map to store Trello card ID -> PR data for article generation
let trelloCardToPR: Map<string, any> = new Map();
// Storage for analyst-generated stories (keyed by storyId)
const analystGeneratedStories = new Map<string, {
  id: string;
  cardId: string;
  story: string;
  title: string;
  ticker?: string;
  createdAt: number;
  noteData?: any;
}>();

// Background polling for automatic "Process For AI" button addition
let autoButtonCheckInterval: NodeJS.Timeout | null = null;
let wgoControlCardMonitorInterval: NodeJS.Timeout | null = null;
let lastProcessedCommentId: string | null = null;
let autoButtonCheckActive = false;

// Function to check cards and add "Process For AI" buttons automatically
async function checkAndAddProcessButtons() {
  if (!autoButtonCheckActive) return;
  
  try {
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    
    const prListId = process.env.TRELLO_LIST_ID_PR;
    const wgoListId = process.env.TRELLO_LIST_ID_WGO;
    const listsToCheck = [prListId, wgoListId].filter(Boolean) as string[];
    
    if (listsToCheck.length === 0) {
      return;
    }
    
    const apiKey = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    const baseUrl = 'https://api.trello.com/1';
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    
    if (!apiKey || !token) {
      return;
    }
    
    for (const listId of listsToCheck) {
      try {
        // Fetch all cards in the list
        const cardsUrl = `${baseUrl}/lists/${listId}/cards?key=${apiKey}&token=${token}&fields=id,name,desc`;
        const cardsResponse = await fetch(cardsUrl);
        
        if (!cardsResponse.ok) continue;
        
        const cards = await cardsResponse.json() as Array<{ id: string; name: string; desc: string }>;
        
        for (const card of cards) {
          try {
            const cardDesc = card.desc || '';
            
            // Check if card has URL but no button and isn't processed
            const hasUrl = /https?:\/\//.test(cardDesc);
            const hasButton = /\[(Process For AI|Generate Article)\]/.test(cardDesc);
            const hasPRData = /<!--\s*PR_DATA:/.test(cardDesc) || /```metadata[^`]*PR_DATA:/.test(cardDesc);
            
            if (hasUrl && !hasButton && !hasPRData) {
              // Add Process For AI button
              let updatedDesc = cardDesc;
              updatedDesc = updatedDesc.replace(/\n\n---\n\n## ⚠️ Card Not Processed[\s\S]*?(?=\n\n---|$)/, '');
              updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Process For AI\]\([^)]+\)\*\*/g, '');
              
              const processUrl = `${appUrl}/trello/process-card/${card.id}`;
              updatedDesc += `\n\n---\n\n**[Process For AI](${processUrl})**`;
              
              await trello.updateCardDescription(card.id, updatedDesc);
              console.log(`   ✅ Auto-added "Process For AI" button to card: "${card.name.substring(0, 50)}..."`);
            }
          } catch (cardError: any) {
            // Silently skip errors for individual cards
          }
        }
      } catch (listError: any) {
        // Silently skip errors for individual lists
      }
    }
  } catch (error: any) {
    // Silently fail - this is background polling
  }
}

// Start/Stop automatic button checking
function startAutoButtonCheck() {
  if (autoButtonCheckInterval) {
    return;
  }
  
  autoButtonCheckActive = true;
  console.log(`\n🔄 Starting automatic "Process For AI" button checker (checks every 30 seconds)`);
  
  // Run immediately
  checkAndAddProcessButtons();
  
  // Then check every 30 seconds
  autoButtonCheckInterval = setInterval(() => {
    checkAndAddProcessButtons();
  }, 30000); // 30 seconds
}

function stopAutoButtonCheck() {
  if (autoButtonCheckInterval) {
    clearInterval(autoButtonCheckInterval);
    autoButtonCheckInterval = null;
  }
  autoButtonCheckActive = false;
  console.log(`\n⏹️  Stopped automatic "Process For AI" button checker`);
}

// Monitor WGO Control Card comments for ticker search requests
async function monitorWGOControlCardComments() {
  const controlCardId = process.env.TRELLO_WGO_CONTROL_CARD_ID;
  if (!controlCardId) {
    // This should never happen if startWGOControlCardMonitor is called correctly
    // But log it just in case
    console.error(`\n❌ [WGO Control Card] ERROR: TRELLO_WGO_CONTROL_CARD_ID not set!`);
    return;
  }

  try {
    const { TrelloService } = await import("./trello-service");
    const trello = new TrelloService();
    console.log(`   🔗 Fetching comments from Trello card: ${controlCardId}`);
    const comments = await trello.getCardComments(controlCardId);

    // Always log for debugging
    console.log(`\n🔍 [WGO Control Card] Checking comments (found ${comments.length} total, lastProcessed: ${lastProcessedCommentId || 'none'})`);

    if (comments.length === 0) {
      console.log(`   ℹ️  No comments found on card`);
      return;
    }

    // Log recent comments for debugging
    if (comments.length > 0) {
      console.log(`   📋 Recent comments (newest first):`);
      comments.slice(0, 3).forEach((c, i) => {
        console.log(`      ${i + 1}. [${c.id}] "${c.data.text.substring(0, 50)}..." (${c.date})`);
      });
    }

    // Filter out bot comments (comments that start with ✅ or contain bot-specific patterns)
    const botCommentPatterns = [
      /^✅\s*Starting WGO search/i,
      /^✅\s*WGO Search Complete/i,
      /^✅\s*WGO search/i,
      /Found \d+ article\(s\):/i,
      /Check the "WGO\/WIIM Stories" list/i,
      /Pitch: Proposed Article:/i,
      /Source: Benzinga News/i
    ];
    
    const userComments = comments.filter(comment => {
      const text = comment.data.text.trim();
      const isBotComment = botCommentPatterns.some(pattern => pattern.test(text));
      if (isBotComment) {
        console.log(`   🤖 Filtered bot comment: "${text.substring(0, 50)}..."`);
      }
      return !isBotComment;
    });

    console.log(`   👤 Found ${userComments.length} user comment(s) (after filtering ${comments.length - userComments.length} bot comments)`);

    if (userComments.length === 0) {
      console.log(`   ℹ️  No user comments to process`);
      return;
    }

    // Log user comments for debugging
    if (userComments.length > 0) {
      console.log(`   📋 User comments:`);
      userComments.slice(0, 3).forEach((c, i) => {
        console.log(`      ${i + 1}. [${c.id}] "${c.data.text.substring(0, 50)}..."`);
      });
    }

    // On first run, mark ALL existing comments as processed to avoid processing old comments
    if (!lastProcessedCommentId && comments.length > 0) {
      console.log(`\n💡 [WGO Control Card] First run - marking all ${comments.length} existing comment(s) as processed`);
      // Mark the newest comment as processed (even if it's a user comment)
      // This prevents processing old comments on startup
      // Only NEW comments added after this will be processed
      lastProcessedCommentId = comments[0].id;
      console.log(`   📌 Last processed comment ID set to: ${lastProcessedCommentId}`);
      console.log(`   ℹ️  Only comments added AFTER this will be processed`);
      return; // Don't process any existing comments on first run
    }

    // Find the newest user comment we haven't processed yet
    interface TrelloComment {
      id: string;
      data: { text: string; };
      date: string;
      idMemberCreator: string;
    }
    let newComment: TrelloComment | null = null;
    if (lastProcessedCommentId) {
      // Find the index of the last processed comment in the full comments list
      const lastProcessedIndex = comments.findIndex(c => c.id === lastProcessedCommentId);
      
      console.log(`   🔍 Searching for new comments:`);
      console.log(`      - Last processed ID: ${lastProcessedCommentId}`);
      console.log(`      - Last processed index: ${lastProcessedIndex}`);
      console.log(`      - Total comments: ${comments.length}`);
      console.log(`      - User comments: ${userComments.length}`);
      
      if (lastProcessedIndex === -1) {
        // Last processed comment is no longer in the list (older than limit)
        // This means we've restarted or the comment was deleted
        // Process the newest user comment
        newComment = userComments[0];
        if (newComment) {
          console.log(`   ✅ Last processed comment not found in list, processing newest user comment`);
        }
      } else {
        // Check if the newest comment (index 0) is different from what we last processed
        // This is the most common case: user adds a new comment, it becomes index 0
        const newestComment = comments[0];
        console.log(`   🔍 Checking newest comment (index 0):`);
        console.log(`      - Newest comment ID: ${newestComment.id}`);
        console.log(`      - Last processed ID: ${lastProcessedCommentId}`);
        console.log(`      - Are they different: ${newestComment.id !== lastProcessedCommentId}`);
        
        if (newestComment.id !== lastProcessedCommentId) {
          // The newest comment is different from what we last processed
          // Check if it's a user comment (not a bot comment)
          const isNewestBot = botCommentPatterns.some(p => p.test(newestComment.data.text.trim()));
          if (!isNewestBot) {
            // It's a new user comment!
            const userCommentIndex = userComments.findIndex(c => c.id === newestComment.id);
            if (userCommentIndex >= 0) {
              newComment = userComments[userCommentIndex];
              console.log(`   ✅ NEW USER COMMENT DETECTED at index 0!`);
              console.log(`      - Comment ID: ${newComment.id}`);
              console.log(`      - Comment text: "${newComment.data.text.substring(0, 50)}..."`);
            } else {
              console.log(`   ⚠️  Newest comment is not in userComments list (might be filtered)`);
            }
          } else {
            console.log(`   ℹ️  Newest comment is a bot comment, checking for newer user comments...`);
          }
        } else {
          console.log(`   ℹ️  Newest comment is the same as last processed (already processed)`);
        }
        
        // If we didn't find a new comment at index 0, check for user comments with index < lastProcessedIndex
        if (!newComment) {
          console.log(`   🔍 Checking for user comments newer than last processed (index < ${lastProcessedIndex})...`);
          for (const userComment of userComments) {
            const userCommentIndex = comments.findIndex(c => c.id === userComment.id);
            if (userCommentIndex < lastProcessedIndex) {
              // This user comment is newer than the last processed one
              newComment = userComment;
              console.log(`   ✅ Found newer user comment at index ${userCommentIndex} (last processed was at ${lastProcessedIndex})`);
              break;
            }
          }
        }
        
        // If still no new comment found, check if the last processed was a bot comment
        // In that case, we should process the newest user comment
        if (!newComment && userComments.length > 0) {
          const lastProcessedComment = comments[lastProcessedIndex];
          const isLastProcessedBot = botCommentPatterns.some(p => p.test(lastProcessedComment.data.text.trim()));
          if (isLastProcessedBot) {
            // Last processed was a bot comment, so process the newest user comment
            newComment = userComments[0];
            console.log(`   ✅ Last processed was bot comment, processing newest user comment`);
          } else {
            // All comments have been processed
            console.log(`   ℹ️  No new comments found - all user comments have been processed`);
          }
        }
      }
    } else {
      // No lastProcessedCommentId - this shouldn't happen after first run, but handle it
      newComment = userComments[0];
      if (newComment) {
        console.log(`   ✅ No last processed ID, processing newest user comment`);
      }
    }

    if (!newComment) {
      console.log(`   ⚠️  No new comment found to process`);
      console.log(`      - Last processed ID: ${lastProcessedCommentId || 'none'}`);
      console.log(`      - User comments available: ${userComments.length}`);
      if (lastProcessedCommentId) {
        const lastProcessedIndex = comments.findIndex(c => c.id === lastProcessedCommentId);
        if (lastProcessedIndex >= 0) {
          console.log(`      - Last processed is at index ${lastProcessedIndex} in comments list`);
          const lastProcessedComment = comments[lastProcessedIndex];
          console.log(`      - Last processed comment: "${lastProcessedComment.data.text.substring(0, 50)}..."`);
        } else {
          console.log(`      - Last processed comment ID not found in current comments list`);
        }
      }
      return;
    }

    // Skip if this is the last processed comment
    if (lastProcessedCommentId === newComment.id) {
      return;
    }

    // Parse comment text to extract ticker
    const commentText = newComment.data.text.trim();
    console.log(`\n💬 [WGO Control Card] ✅ NEW COMMENT DETECTED!`);
    console.log(`   📝 Comment text: "${commentText}"`);
    console.log(`   🆔 Comment ID: ${newComment.id}`);
    console.log(`   📅 Comment date: ${newComment.date}`);
    
    // Skip if comment is a stop command (check this FIRST before any processing)
    if (/\b(stop|halt|cancel|abort|cease|end)\b.*(?:generating|running|search|searches)/i.test(commentText) ||
        /(?:stop|halt|cancel|abort|cease|end)\s+(?:generating|running|search|searches)/i.test(commentText)) {
      console.log(`\n🛑 [WGO Control Card] Stop command detected: "${commentText}" - marking all comments as processed`);
      // Mark this and all older comments as processed
      lastProcessedCommentId = comments[0].id; // Mark newest as processed
      return;
    }
    
    // Patterns: "AMD", "Search AMD", "search AMD", "AMD please", etc.
    // But exclude patterns that match bot replies (e.g., "Starting WGO search")
    const tickerPattern = /(?:search\s+)?([A-Z]{1,5})\b/i;
    const match = commentText.match(tickerPattern);
    
    if (!match) {
      // Not a valid ticker command - skip silently
      lastProcessedCommentId = newComment.id;
      return;
    }

    const ticker = match[1].toUpperCase();
    
    // Validate ticker (1-5 uppercase letters)
    if (!/^[A-Z]{1,5}$/.test(ticker)) {
      lastProcessedCommentId = newComment.id;
      return;
    }

    console.log(`\n💬 [WGO Control Card] New comment detected: "${commentText}" → Extracted ticker: ${ticker}`);
    
    // Mark as processed before starting (to avoid duplicate processing)
    lastProcessedCommentId = newComment.id;

    // Reply immediately that we're starting
    try {
      await trello.addComment(controlCardId, `✅ Starting WGO search for **${ticker}**...`);
    } catch (error: any) {
      console.error(`   ⚠️  Could not add reply comment:`, error.message);
    }

    // Trigger WGO search in background
    (async () => {
      try {
        const threadId = `wgo_comment_${Date.now()}`;
        const config = { configurable: { thread_id: threadId } };

        console.log(`\n${"=".repeat(60)}`);
        console.log(`   🔍 [WGO Control Card] Triggering WGO agent for ${ticker}...`);
        console.log(`   📋 Config:`, JSON.stringify(config, null, 2));
        console.log(`   📋 Topic: ${ticker}`);
        
        try {
          await wgoGraph.invoke({ topic: ticker }, config);
          console.log(`   ✅ WGO agent invocation completed for ${ticker}`);
        } catch (invokeError: any) {
          console.error(`\n   ❌ ERROR during WGO agent invocation:`);
          console.error(`      Error message: ${invokeError.message || invokeError}`);
          console.error(`      Error stack: ${invokeError.stack || 'No stack trace'}`);
          throw invokeError; // Re-throw to be caught by outer catch
        }

        console.log(`   🔄 Fetching WGO agent state...`);
        const state = await wgoGraph.getState(config);
        console.log(`   📊 WGO Agent State retrieved:`);
        console.log(`      - News articles count: ${(state.values.newsArticles || []).length}`);
        console.log(`      - Has pitch: ${!!state.values.pitch}`);
        console.log(`      - Final article preview: ${state.values.finalArticle?.substring(0, 100) || 'none'}...`);
        
        const newsArticles = state.values.newsArticles || [];
        const pitch = state.values.pitch || '';
        const finalResult = state.values.finalArticle || "WGO story pitched to Trello";
        
        // Separate news articles from press releases
        const regularNews: any[] = [];
        const pressReleases: any[] = [];
        
        newsArticles.forEach((article: any) => {
          const isPressRelease = article.url?.includes('/pressreleases/') || 
                                 (Array.isArray(article.channels) && article.channels.some((ch: any) => 
                                   String(ch).toLowerCase().includes('press release')));
          if (isPressRelease) {
            pressReleases.push(article);
          } else {
            regularNews.push(article);
          }
        });
        
        console.log(`   📊 Processing results:`);
        console.log(`      - Total articles found: ${newsArticles.length} (${regularNews.length} news + ${pressReleases.length} PRs)`);
        console.log(`      - Pitch length: ${pitch.length} chars`);
        console.log(`      - Final result: ${finalResult.substring(0, 100)}...`);

        // Build reply with results
        let replyText = `**✅ WGO Search Complete for ${ticker}**\n\n`;
        
        if (newsArticles.length > 0) {
          replyText += `Found **${newsArticles.length}** article(s):\n`;
          if (regularNews.length > 0) {
            replyText += `- **${regularNews.length}** news article(s)\n`;
          }
          if (pressReleases.length > 0) {
            replyText += `- **${pressReleases.length}** press release(s)\n`;
          }
          replyText += `\n`;
          
          // Show top 5 articles (mix of news and PRs)
          newsArticles.slice(0, 5).forEach((article: any, index: number) => {
            const title = article.title || 'Untitled';
            const url = article.url || '#';
            const isPR = article.url?.includes('/pressreleases/') || 
                        (Array.isArray(article.channels) && article.channels.some((ch: any) => 
                          String(ch).toLowerCase().includes('press release')));
            const typeLabel = isPR ? '📄 PR' : '📰 News';
            replyText += `${index + 1}. ${typeLabel} [${title}](${url})\n`;
          });
          if (newsArticles.length > 5) {
            replyText += `\n_...and ${newsArticles.length - 5} more article(s)_\n`;
          }
        } else {
          replyText += `No articles found for ${ticker}.\n`;
        }

        if (pitch) {
          replyText += `\n**Pitch:** ${pitch.substring(0, 200)}${pitch.length > 200 ? '...' : ''}\n`;
        }

        replyText += `\nCheck the "WGO/WIIM Stories" list for the generated card.`;

        await trello.addComment(controlCardId, replyText);
        console.log(`   ✅ Added reply comment with results for ${ticker}`);
      } catch (error: any) {
        console.error(`   ❌ Error processing WGO search for ${ticker}:`, error);
        try {
          await trello.addComment(controlCardId, `❌ Error processing search for **${ticker}**: ${error.message || 'Unknown error'}`);
        } catch (replyError: any) {
          console.error(`   ⚠️  Could not add error reply:`, replyError.message);
        }
      }
    })();

  } catch (error: any) {
    // Log errors for debugging
    console.error(`\n❌ [WGO Control Card] Error in monitor:`, error.message || error);
    if (error.stack) {
      console.error(`   Stack:`, error.stack.split('\n').slice(0, 3).join('\n'));
    }
  }
}

function startWGOControlCardMonitor() {
  const controlCardId = process.env.TRELLO_WGO_CONTROL_CARD_ID;
  if (!controlCardId) {
    console.log(`\n💡 Set TRELLO_WGO_CONTROL_CARD_ID in .env.local to enable WGO control card comment monitoring`);
    return;
  }

  console.log(`\n💬 Starting WGO control card comment monitor`);
  console.log(`   📌 Control Card ID: ${controlCardId}`);
  console.log(`   ⏰ Will check for new comments every 10 seconds`);
  
  // Run immediately (but don't await - it's async)
  console.log(`   🚀 Running initial check now...`);
  monitorWGOControlCardComments().catch(error => {
    console.error(`\n❌ [WGO Control Card] Error in initial check:`, error);
  });
  
  // Then check every 10 seconds
  wgoControlCardMonitorInterval = setInterval(() => {
    monitorWGOControlCardComments().catch(error => {
      console.error(`\n❌ [WGO Control Card] Error in periodic check:`, error);
    });
  }, 10000); // 10 seconds
  
  console.log(`   ✅ Monitor started successfully`);
}

function stopWGOControlCardMonitor() {
  if (wgoControlCardMonitorInterval) {
    clearInterval(wgoControlCardMonitorInterval);
    wgoControlCardMonitorInterval = null;
  }
  console.log(`\n⏹️  Stopped WGO control card comment monitor`);
}

// Hardcoded ticker lists for PR auto-scan (3 API queries)
const PR_AUTO_SCAN_TICKER_LISTS = [
  "FCEL,CGC,TLRY,ACB,MU,SNDL,APLD,IREN,ASTS,LCID,RKLB,HUT,BE,SBUX,SPCE,RIVN,BLNK,PLTR,PLUG,CIFR,CRWV,SOFI,SHOP,HIVE,BBAI,TSLA,HOOD,QS,OPEN,MRNA,ROKU,QBTS,BB,SOUN,SNAP,WKHS,AMZN,MSTR,XPEV,PINS,UAL,PTON,IONQ,GE,FUBO,META,AMD,XYZ,RIOT,$BTC",
  "NVDA,HUBS,MSFT,COIN,CHPT,NIO,CSCO,CLSK,NET,DKNG,QQQ,GOOG,GOOGL,QCOM,BA,ORCL,NVAX,CRWD,NKE,DIS,DAL,LUV,HD,SPY,GM,BIDU,CCL,F,BABA,ZM,BYND,UBER,RGTI,MARA,INTC,ARM,V,WFC,TTD,JPM,WMT,XOMA,NFLX,T,AAL,GILD,AMC,PFE,JNJ,AAPL",
  "DOCU,CRM,COST,ADBE,PYPL,GME,TGTX,CVX,DELL,HPQ,INO"
];

// Helper function to get article ID (unique identifier)
function getArticleId(article: any): string {
  return article.id || article.url || `${article.title}_${article.created}`;
}

// Helper function to check if article is from past 48 hours
function isWithin48Hours(article: any): boolean {
  if (!article.created) return false;
  const articleDate = new Date(article.created * 1000);
  const now = new Date();
  const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
  return hoursDiff <= 48;
}

// Helper function to check if article is from past 36 hours
function isWithin36Hours(article: any): boolean {
  if (!article.created) return false;
  
  try {
    let articleDate: Date;
    if (typeof article.created === 'string') {
      articleDate = new Date(article.created);
    } else if (typeof article.created === 'number') {
      // If it's already in milliseconds, use as-is; otherwise assume seconds
      articleDate = article.created > 1000000000000 ? new Date(article.created) : new Date(article.created * 1000);
    } else {
      articleDate = new Date(article.created);
    }
    
    if (isNaN(articleDate.getTime())) {
      return false;
    }
    
    const now = new Date();
    const hoursDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60);
    return hoursDiff <= 36;
  } catch (error) {
    return false;
  }
}

// Helper function to check if article is from past 7 days
function isWithin7Days(article: any): boolean {
  if (!article.created) return false;
  
  try {
    let articleDate: Date;
    if (typeof article.created === 'string') {
      articleDate = new Date(article.created);
    } else if (typeof article.created === 'number') {
      // If it's already in milliseconds, use as-is; otherwise assume seconds
      articleDate = article.created > 1000000000000 ? new Date(article.created) : new Date(article.created * 1000);
    } else {
      articleDate = new Date(article.created);
    }
    
    if (isNaN(articleDate.getTime())) {
      return false;
    }
    
    const now = new Date();
    const daysDiff = (now.getTime() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  } catch (error) {
    return false;
  }
}

// Endpoint: Start auto-scan
app.post("/auto-scan/start", async (req, res) => {
  console.log("\n🚀 [POST /auto-scan/start] Request received");
  console.log("🚀 [POST /auto-scan/start] Body:", JSON.stringify(req.body, null, 2));
  const { tickers, app } = req.body;
  
  if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
    console.log("❌ [POST /auto-scan/start] Invalid request: tickers array is required");
    return res.status(400).json({ error: "tickers array is required and must not be empty" });
  }
  
  // Validate tickers (uppercase, 1-5 chars)
  const validTickers = tickers
    .map((t: string) => String(t).trim().toUpperCase())
    .filter((t: string) => /^[A-Z]{1,5}$/.test(t));
  
  if (validTickers.length === 0) {
    return res.status(400).json({ error: "No valid tickers provided" });
  }
  
  try {
    // Stop existing scan if running
    if (autoScanInterval) {
      clearInterval(autoScanInterval);
      autoScanInterval = null;
    }
    
    autoScanTickers = validTickers;
    autoScanApp = app || "wgo";
    autoScanActive = true;
    
    console.log(`\n🚀 AUTO-SCAN: Started monitoring ${validTickers.length} tickers`);
    console.log(`   Tickers: ${validTickers.join(', ')}`);
    console.log(`   App: ${autoScanApp}`);
    console.log(`   Check interval: 5 minutes`);
    console.log(`   📥 Step 1: Fetching 10 most recent articles for each ticker...`);
    
    // Step 1: Run initial scan with 10 most recent articles (no time filter)
    await runAutoScan(true); // true = initial load mode
    
    console.log(`   ✅ Initial load complete. Starting regular scanning...`);
    
    // Step 2: Set up interval to check every 5 minutes (with 48-hour filter)
    autoScanInterval = setInterval(async () => {
      if (autoScanActive) {
        await runAutoScan(false); // false = regular scan mode
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    res.json({
      status: "started",
      tickers: validTickers,
      app: autoScanApp,
      intervalMinutes: 5
    });
  } catch (error: any) {
    console.error("Error starting auto-scan:", error);
    res.status(500).json({ error: error.message || "Failed to start auto-scan" });
  }
});

// Endpoint: Stop auto-scan
app.post("/auto-scan/stop", (req, res) => {
  console.log("\n⏸️  [POST /auto-scan/stop] Request received");
  if (autoScanInterval) {
    clearInterval(autoScanInterval);
    autoScanInterval = null;
  }
  autoScanActive = false;
  currentlyProcessingIndex = -1;
  console.log(`⏸️  [POST /auto-scan/stop] ✅ Auto-scan stopped`);
  
  res.json({ status: "stopped" });
});

// Endpoint: Get auto-scan status
app.get("/auto-scan/status", (req, res) => {
  console.log("\n📊 [GET /auto-scan/status] Request received");
  const status = {
    active: autoScanActive,
    tickers: autoScanTickers,
    app: autoScanApp,
    processedCount: processedArticles.size,
    generatedCount: generatedArticles.length
  };
  console.log(`📊 [GET /auto-scan/status] Response:`, JSON.stringify(status, null, 2));
  res.json(status);
});

// Endpoint: Get fetched articles with processing status
app.get("/auto-scan/fetched-articles", (req, res) => {
  console.log("\n📋 [GET /auto-scan/fetched-articles] Request received");
  console.log(`📋 [GET /auto-scan/fetched-articles] Returning ${fetchedArticles.length} fetched articles`);
  
  res.json({
    articles: fetchedArticles.map((item, index) => ({
      index: index,
      articleId: item.articleId,
      title: item.article.title || item.article.headline || 'Untitled',
      ticker: (() => {
        if (!item.article.stocks || item.article.stocks.length === 0) return 'N/A';
        const firstStock = item.article.stocks[0];
        if (typeof firstStock === 'string') return firstStock.toUpperCase();
        if (typeof firstStock === 'object' && firstStock !== null) {
          return (firstStock as any).ticker || (firstStock as any).symbol || (firstStock as any).name || 'N/A';
        }
        return 'N/A';
      })(),
      source: 'Benzinga',
      published: item.article.created ? new Date(item.article.created * 1000).toISOString() : null,
      status: item.status,
      isCurrentlyProcessing: index === currentlyProcessingIndex,
      generatedArticleId: item.generatedArticleId,
      error: item.error,
      startedAt: item.startedAt,
      completedAt: item.completedAt
    })),
    currentlyProcessingIndex: currentlyProcessingIndex,
    count: fetchedArticles.length
  });
});

// Endpoint: Get generated articles
app.get("/auto-scan/articles", (req, res) => {
  console.log("\n📰 [GET /auto-scan/articles] Request received");
  // Return articles sorted by creation date (newest first)
  const sorted = [...generatedArticles].sort((a, b) => b.createdAt - a.createdAt);
  console.log(`📰 [GET /auto-scan/articles] Returning ${sorted.length} articles`);
  
  res.json({
    articles: sorted.map(article => ({
      id: article.id,
      ticker: article.ticker,
      title: article.title,
      sourceTitle: article.sourceArticle.title || article.sourceArticle.headline || 'No title',
      createdAt: article.createdAt,
      generatedArticle: article.generatedArticle,
      pitch: article.pitch
    })),
    count: sorted.length
  });
});

// Endpoint: Get single generated article
app.get("/auto-scan/articles/:id", (req, res) => {
  const { id } = req.params;
  console.log(`\n📄 [GET /auto-scan/articles/${id}] Request received`);
  const article = generatedArticles.find(a => a.id === id);
  
  if (!article) {
    console.log(`❌ [GET /auto-scan/articles/${id}] Article not found`);
    return res.status(404).json({ error: "Article not found" });
  }
  console.log(`✅ [GET /auto-scan/articles/${id}] Article found: ${article.ticker} - ${article.title}`);
  
  res.json({
    id: article.id,
    ticker: article.ticker,
    title: article.title,
    sourceArticle: article.sourceArticle,
    generatedArticle: article.generatedArticle,
    pitch: article.pitch,
    createdAt: article.createdAt
  });
});

// Core function: Run auto-scan and generate articles
// initialLoad: if true, fetch 10 most recent articles (no time filter). If false, only fetch from past 48 hours.
async function runAutoScan(initialLoad: boolean = false) {
  if (!autoScanActive || autoScanTickers.length === 0) {
    return;
  }
  
  const apiKey = process.env.BENZINGA_API_KEY;
  if (!apiKey) {
    console.error("❌ AUTO-SCAN: BENZINGA_API_KEY not configured");
    return;
  }
  
  // Check if Trello list ID is configured for WGO auto-scan
  const listId = process.env.TRELLO_LIST_ID_WGO || process.env.TRELLO_LIST_ID;
  if (!listId) {
    console.error("❌ AUTO-SCAN: TRELLO_LIST_ID_WGO or TRELLO_LIST_ID not configured");
    console.error("❌ WGO cards will not be created in Trello. Please set TRELLO_LIST_ID_WGO in .env.local");
    return;
  }
  
  if (initialLoad) {
    console.log(`\n📥 AUTO-SCAN: Initial load - fetching 10 most recent articles...`);
  } else {
    console.log(`\n🔍 AUTO-SCAN: Regular scan - checking for new articles from past 48 hours...`);
  }
  console.log(`   Tickers: ${autoScanTickers.join(', ')}`);
  console.log(`   Trello List ID: ${listId.substring(0, 8)}...`);
  
  try {
    const { fetchBenzingaNews } = await import("./benzinga-api");
    const { generateArticle } = await import("./article-generator-integration");
    
    // Fetch articles for each ticker
    const allArticles: any[] = [];
    
    for (const ticker of autoScanTickers) {
      try {
        if (initialLoad) {
          // Initial load: Fetch 10 most recent articles (no time filter)
          console.log(`   📥 Fetching 10 most recent articles for ${ticker}...`);
          const articles = await fetchBenzingaNews(ticker, apiKey, 10, false); // prOnly = false
          
          // Filter to only articles with valid tickers in stocks array
          const validArticles = articles.filter(article => {
            if (!article.stocks || !Array.isArray(article.stocks) || article.stocks.length === 0) {
              return false;
            }
            
            // Check if any stock in the array matches our ticker
            return article.stocks.some((stock: any) => {
              let stockTicker: string | null = null;
              if (typeof stock === 'string') {
                stockTicker = stock.toUpperCase().trim();
              } else if (typeof stock === 'object' && stock !== null) {
                const tickerStr = (stock as any).ticker || (stock as any).symbol || (stock as any).name || '';
                if (tickerStr) {
                  stockTicker = String(tickerStr).toUpperCase().trim();
                }
              }
              return stockTicker === ticker;
            });
          });
          
          // Take only the first 10 (most recent)
          const recentArticles = validArticles.slice(0, 10);
          console.log(`   ✅ Found ${recentArticles.length} recent articles for ${ticker}`);
          allArticles.push(...recentArticles);
        } else {
          // Regular scan: Fetch articles from past 48 hours
          console.log(`   🔍 Regular scan: Fetching articles for ${ticker}...`);
          const articles = await fetchBenzingaNews(ticker, apiKey, 20, false); // prOnly = false
          console.log(`   📦 API returned ${articles.length} articles for ${ticker}`);
          
          // Filter to only articles from past 48 hours
          const recentArticles = articles.filter(isWithin48Hours);
          console.log(`   ⏰ ${recentArticles.length} articles are within 48 hours (filtered out ${articles.length - recentArticles.length} older articles)`);
          
          // For regular scans, be more lenient: accept articles returned by the ticker query
          // The API already filtered by ticker, so we trust those results
          // But still prefer articles that have the ticker in stocks array
          const validArticles = recentArticles.filter(article => {
            // If article has stocks array, check if ticker is in it
            if (article.stocks && Array.isArray(article.stocks) && article.stocks.length > 0) {
              const hasTicker = article.stocks.some((stock: any) => {
                let stockTicker: string | null = null;
                if (typeof stock === 'string') {
                  stockTicker = stock.toUpperCase().trim();
                } else if (typeof stock === 'object' && stock !== null) {
                  const tickerStr = (stock as any).ticker || (stock as any).symbol || (stock as any).name || '';
                  if (tickerStr) {
                    stockTicker = String(tickerStr).toUpperCase().trim();
                  }
                }
                return stockTicker === ticker.toUpperCase().trim();
              });
              
              // Accept if ticker is in stocks array
              if (hasTicker) {
                return true;
              }
            }
            
            // If no stocks array or ticker not in stocks, still accept it
            // because the API query already filtered by ticker
            // This handles cases where articles mention the ticker but don't have it in stocks
            return true;
          });
          
          console.log(`   ✅ Found ${validArticles.length} valid articles from past 48 hours for ${ticker}`);
          
          // Log sample of articles found (first 3)
          if (validArticles.length > 0) {
            console.log(`   📰 Sample articles found:`);
            validArticles.slice(0, 3).forEach((article, idx) => {
              const title = article.title || article.headline || 'Untitled';
              const date = article.created ? new Date(article.created * 1000).toLocaleString() : 'No date';
              const stocks = article.stocks && Array.isArray(article.stocks) 
                ? article.stocks.map((s: any) => typeof s === 'string' ? s : (s?.ticker || s?.symbol || s?.name || '?')).join(', ')
                : 'No stocks';
              console.log(`      ${idx + 1}. "${title.substring(0, 60)}..." (${date}) [Stocks: ${stocks}]`);
            });
          }
          
          allArticles.push(...validArticles);
        }
        
        // Small delay between tickers
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`   ⚠️  Error fetching articles for ${ticker}:`, error);
      }
    }
    
    if (initialLoad) {
      console.log(`   ✅ Found ${allArticles.length} total recent articles (initial load)`);
      
      // Store fetched articles with 'queued' status
      fetchedArticles = allArticles.map(article => ({
        articleId: getArticleId(article),
        article: article,
        status: 'queued' as const
      }));
      currentlyProcessingIndex = -1;
      console.log(`   📋 Stored ${fetchedArticles.length} articles in queue`);
    } else {
      console.log(`   ✅ Found ${allArticles.length} articles from past 48 hours`);
    }
    
    // Process new articles
    let newCount = 0;
    let generatedCount = 0;
    let skippedCount = 0;
    let cardCreationErrors = 0;
    
    console.log(`   🔍 Processing ${allArticles.length} articles (${processedArticles.size} already processed)...`);
    console.log(`   📋 TRELLO_LIST_ID_WGO: ${process.env.TRELLO_LIST_ID_WGO || 'NOT SET'}`);
    console.log(`   📋 TRELLO_LIST_ID: ${process.env.TRELLO_LIST_ID || 'NOT SET'}`);
    
    for (let i = 0; i < allArticles.length; i++) {
      const article = allArticles[i];
      const articleId = getArticleId(article);
      
      // Skip if already processed
      if (processedArticles.has(articleId)) {
        skippedCount++;
        // Log all skips during regular scans for debugging (not initial load)
        if (!initialLoad) {
          const title = article.title || article.headline || 'Untitled';
          const processedInfo = processedArticles.get(articleId);
          const processedTime = processedInfo?.processedAt 
            ? new Date(processedInfo.processedAt).toLocaleString() 
            : 'unknown';
          console.log(`   ⏭️  Skipping already processed (processed at ${processedTime}): ${title.substring(0, 60)}...`);
        } else if (skippedCount <= 3) {
          // Log first few skips during initial load
          const title = article.title || article.headline || 'Untitled';
          console.log(`   ⏭️  Skipping already processed: ${title.substring(0, 50)}...`);
        }
        continue;
      }
      
      newCount++;
      
      // Update status to 'generating' if this is initial load
      if (initialLoad) {
        const fetchedIndex = fetchedArticles.findIndex(f => f.articleId === articleId);
        if (fetchedIndex >= 0) {
          fetchedArticles[fetchedIndex].status = 'generating';
          fetchedArticles[fetchedIndex].startedAt = Date.now();
          currentlyProcessingIndex = fetchedIndex;
          console.log(`   🔄 [${fetchedIndex + 1}/${fetchedArticles.length}] Now creating Trello card: ${article.title?.substring(0, 50)}...`);
        }
      }
      
      try {
        // Extract ticker from article - prioritize monitored tickers
        let articleTicker: string | null = null;
            
            if (article.stocks && Array.isArray(article.stocks) && article.stocks.length > 0) {
          // First, try to find a monitored ticker in the article's stocks array
          for (const monitoredTicker of autoScanTickers) {
            const monitoredUpper = monitoredTicker.toUpperCase().trim();
            const foundTicker = article.stocks.find((stock: any) => {
              let stockTicker: string | null = null;
              if (typeof stock === 'string') {
                stockTicker = stock.toUpperCase().trim();
              } else if (typeof stock === 'object' && stock !== null) {
                const tickerStr = (stock as any).ticker || (stock as any).symbol || (stock as any).name || '';
                if (tickerStr) {
                  stockTicker = String(tickerStr).toUpperCase().trim();
                }
              }
              return stockTicker === monitoredUpper;
            });
            
            if (foundTicker) {
              // Found a monitored ticker, use it
              if (typeof foundTicker === 'string') {
                articleTicker = foundTicker.toUpperCase().trim();
              } else if (typeof foundTicker === 'object' && foundTicker !== null) {
                const tickerStr = (foundTicker as any).ticker || (foundTicker as any).symbol || (foundTicker as any).name || '';
                if (tickerStr) {
                  articleTicker = String(tickerStr).toUpperCase().trim();
                }
              }
              break; // Use the first matching monitored ticker
            }
          }
          
          // If no monitored ticker found, fall back to first stock in array
          if (!articleTicker) {
              const firstStock = article.stocks[0];
              if (typeof firstStock === 'string') {
              articleTicker = firstStock.toUpperCase().trim();
            } else if (typeof firstStock === 'object' && firstStock !== null) {
              const tickerStr = (firstStock as any).ticker || (firstStock as any).symbol || (firstStock as any).name || '';
              if (tickerStr) {
                articleTicker = String(tickerStr).toUpperCase().trim();
              }
            }
          }
        }
        
        if (!articleTicker) {
          console.log(`   ⚠️  Skipping article: No ticker found - "${article.title?.substring(0, 50)}"`);
          continue;
        }
        
        // Create pitch from article
        const dateStr = article.created 
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
        
        // Get original title for pitch (before adding ticker prefix)
        const originalTitle = article.title || article.headline || 'Untitled Article';
        
        // Add ticker prefix to headline if ticker exists (format: "TICKER... (rest of title)")
        // This is the title that will appear on the Trello card
        let title = originalTitle;
        if (articleTicker) {
          title = `${articleTicker}... ${title}`;
        }
        
        const body = article.body || article.teaser || '';
        const summary = article.teaser || (body ? body.substring(0, 500) : 'No summary available');
        
        const pitch = `Proposed Article: ${originalTitle}

Source: Benzinga News
Published: ${dateStr}
Company Ticker: ${articleTicker}

Executive Summary:
${summary}

Proposed Angle: Analyze the implications of this news article for ${articleTicker} investors and the broader market.`;
        
        console.log(`   📌 Creating Trello card for article: ${title.substring(0, 50)}... (${articleTicker})`);
        
        // Create Trello card instead of generating article automatically
        // Article generation will be manual via Trello card link
        const { TrelloService } = await import("./trello-service");
        const trello = new TrelloService();
        
        // Use WGO-specific list ID if set, otherwise fall back to default
        const listId = process.env.TRELLO_LIST_ID_WGO || process.env.TRELLO_LIST_ID;
        
        if (!listId) {
          console.error(`   ❌ TRELLO_LIST_ID or TRELLO_LIST_ID_WGO not set. Skipping article "${title.substring(0, 50)}..."`);
          console.error(`   ❌ Please set TRELLO_LIST_ID_WGO in your .env.local file to create WGO cards in Trello.`);
          // Don't mark as processed if card creation fails
          if (initialLoad) {
            const fetchedIndex = fetchedArticles.findIndex(f => f.articleId === articleId);
            if (fetchedIndex >= 0) {
              fetchedArticles[fetchedIndex].status = 'failed';
              fetchedArticles[fetchedIndex].error = 'TRELLO_LIST_ID_WGO not configured';
              fetchedArticles[fetchedIndex].completedAt = Date.now();
            }
          }
          continue;
        }
        
        const sourceUrl = article.url || article.link || 'No URL available';
        
        // Create Trello card with "Generate Article" link
        // WGO articles use the "wgo" generator, so include selectedApp=wgo in the link
        const baseUrl = process.env.APP_URL || 'http://localhost:3001';
        const generateArticleUrl = `${baseUrl}/trello/generate-article/{cardId}?selectedApp=wgo`;
        
        const card = await trello.createCardFromNewsWithGenerateLink(
          listId,
          title,
          summary,
          sourceUrl,
          generateArticleUrl,
          {
            ticker: articleTicker,
            date: dateStr,
            pitch: pitch
          },
          article // Store full article data in card description
        );
        
        console.log(`   ✅ Trello card created: ${card.url} (ID: ${card.id})`);
        
        // Store mapping of card ID to article data for later article generation
        // We'll store this in a Map for quick lookup
        if (!trelloCardToPR) {
          trelloCardToPR = new Map();
        }
        trelloCardToPR.set(card.id, article);
        
        // Mark as processed ONLY after successful card creation
        processedArticles.set(articleId, {
          id: articleId,
          processedAt: Date.now()
        });
        
        generatedCount++; // Count as "processed" (card created)
        
        // Update status to 'completed' (card created) if this is initial load
        if (initialLoad) {
          const fetchedIndex = fetchedArticles.findIndex(f => f.articleId === articleId);
          if (fetchedIndex >= 0) {
            fetchedArticles[fetchedIndex].status = 'completed';
            fetchedArticles[fetchedIndex].trelloCardUrl = card.url;
            fetchedArticles[fetchedIndex].completedAt = Date.now();
            console.log(`   ✅ [${fetchedIndex + 1}/${fetchedArticles.length}] Card created: ${title.substring(0, 50)}...`);
          }
        }
        
      } catch (error: any) {
        cardCreationErrors++;
        console.error(`   ❌ [${cardCreationErrors}] Error creating Trello card for "${article.title?.substring(0, 50)}":`, error.message);
        console.error(`   ❌ Full error:`, error);
        console.error(`   ❌ Error stack:`, error.stack);
        
        // Don't mark as processed if card creation fails - remove it if it was already added
        processedArticles.delete(articleId);
        
        // Update status to 'failed' if this is initial load
        if (initialLoad) {
          const fetchedIndex = fetchedArticles.findIndex(f => f.articleId === articleId);
          if (fetchedIndex >= 0) {
            fetchedArticles[fetchedIndex].status = 'failed';
            fetchedArticles[fetchedIndex].error = error.message;
            fetchedArticles[fetchedIndex].completedAt = Date.now();
            console.log(`   ❌ [${fetchedIndex + 1}/${fetchedArticles.length}] Failed: ${article.title?.substring(0, 50)}...`);
          }
        }
      }
    }
    
    if (initialLoad) {
      console.log(`   📊 Initial Load Summary: ${newCount} articles processed, ${generatedCount} Trello cards created${cardCreationErrors > 0 ? `, ${cardCreationErrors} card creation errors` : ''}`);
    } else {
      console.log(`   📊 Regular Scan Summary: ${allArticles.length} articles fetched, ${skippedCount} already processed, ${newCount} new articles found, ${generatedCount} Trello cards created${cardCreationErrors > 0 ? `, ${cardCreationErrors} card creation errors` : ''}`);
      if (newCount === 0 && skippedCount > 0) {
        console.log(`   ℹ️  All fetched articles were already processed. Waiting for new articles...`);
      } else if (allArticles.length === 0) {
        console.log(`   ℹ️  No articles found in the past 48 hours for the monitored tickers.`);
      }
    }
    
  } catch (error: any) {
    console.error("❌ AUTO-SCAN: Error:", error);
  }
}

// ============================================================================
// PR AUTO-SCAN ENDPOINTS - Press Release Monitoring & Auto-Generation
// ============================================================================

// Endpoint: Start PR auto-scan
app.post("/pr-auto-scan/start", async (req, res) => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 [POST /pr-auto-scan/start] PR AUTO-SCAN START REQUEST");
  console.log("=".repeat(60));
  console.log(`   📋 Request body:`, JSON.stringify(req.body, null, 2));
  
  const { mode = 'auto' } = req.body;
  const scanMode = mode === 'manual' ? 'manual' : 'auto';
  console.log(`   📋 Mode: ${scanMode}`);
  
  // Check for PR API key
  const prApiKey = process.env.BENZINGA_PR_API_KEY;
  if (!prApiKey) {
    console.log("❌ [POST /pr-auto-scan/start] BENZINGA_PR_API_KEY not configured");
    console.log("   💡 Add BENZINGA_PR_API_KEY to .env.local");
    return res.status(400).json({ error: "BENZINGA_PR_API_KEY not configured in .env.local" });
  }
  console.log(`   ✅ BENZINGA_PR_API_KEY: Set (${prApiKey.length} chars)`);
  
  // Check for Trello credentials (required for creating cards)
  const trelloListId = process.env.TRELLO_LIST_ID_PR || process.env.TRELLO_LIST_ID;
  if (!trelloListId) {
    console.log("❌ [POST /pr-auto-scan/start] TRELLO_LIST_ID or TRELLO_LIST_ID_PR not configured");
    console.log("   💡 Add TRELLO_LIST_ID_PR or TRELLO_LIST_ID to .env.local");
    return res.status(400).json({ error: "TRELLO_LIST_ID or TRELLO_LIST_ID_PR must be set in .env.local to create Trello cards" });
  }
  console.log(`   ✅ Trello List ID: ${trelloListId}`);
  
  // Check for Trello API credentials
  if (!process.env.TRELLO_API_KEY || !process.env.TRELLO_TOKEN) {
    console.log("❌ [POST /pr-auto-scan/start] TRELLO_API_KEY or TRELLO_TOKEN not configured");
    console.log("   💡 Add TRELLO_API_KEY and TRELLO_TOKEN to .env.local");
    return res.status(400).json({ error: "TRELLO_API_KEY and TRELLO_TOKEN must be set in .env.local" });
  }
  console.log(`   ✅ Trello API Key: Set (${process.env.TRELLO_API_KEY.length} chars)`);
  console.log(`   ✅ Trello Token: Set (${process.env.TRELLO_TOKEN.length} chars)`);
  
  try {
    // Stop existing PR scan if running
    if (prAutoScanInterval) {
      console.log(`   🔄 Stopping existing PR auto-scan interval...`);
      clearInterval(prAutoScanInterval);
      prAutoScanInterval = null;
    }
    
    prAutoScanActive = true;
    prAutoScanMode = scanMode;
    console.log(`   ✅ prAutoScanActive set to: ${prAutoScanActive}`);
    console.log(`   ✅ prAutoScanMode set to: ${prAutoScanMode}`);
    
    const totalTickers = PR_AUTO_SCAN_TICKER_LISTS.reduce((sum, list) => sum + list.split(',').length, 0);
    console.log(`\n🚀 PR AUTO-SCAN: Starting monitoring...`);
    console.log(`   📊 Total tickers: ${totalTickers}`);
    console.log(`   📋 Ticker lists: ${PR_AUTO_SCAN_TICKER_LISTS.length}`);
    console.log(`   🎯 Mode: ${scanMode}`);
    console.log(`   📌 Output: Creating Trello cards in list: ${trelloListId}`);
    console.log(`   ⏰ Check interval: 5 minutes`);
    console.log(`   📥 Step 1: Running initial scan (fetching PRs from past 36 hours)...`);
    
    // Step 1: Run initial scan with PRs from past 36 hours
    console.log(`\n   🔄 Calling runPRAutoScan(true)...`);
    await runPRAutoScan(true); // true = initial load mode (36-hour filter)
    console.log(`   ✅ Initial scan completed`);
    
    console.log(`\n   📥 Step 2: Setting up interval for regular scanning (every 5 minutes)...`);
    
    // Step 2: Set up interval to check every 5 minutes (with 48-hour filter)
    prAutoScanInterval = setInterval(async () => {
      console.log(`\n⏰ PR AUTO-SCAN: Interval triggered (prAutoScanActive: ${prAutoScanActive})`);
      if (prAutoScanActive) {
        console.log(`   ✅ prAutoScanActive is true, running scan...`);
        try {
          await runPRAutoScan(false); // false = regular scan mode
        } catch (intervalError: any) {
          console.error(`   ❌ Error in PR auto-scan interval:`, intervalError);
          console.error(`   ❌ Error message:`, intervalError.message);
          console.error(`   ❌ Error stack:`, intervalError.stack);
        }
      } else {
        console.log(`   ⚠️  prAutoScanActive is false, skipping scan`);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    console.log(`   ✅ PR auto-scan interval set up successfully`);
    console.log(`   ✅ PR Auto-Scan is now RUNNING`);
    console.log("=".repeat(60));
    
    res.json({
      status: "started",
      mode: scanMode,
      tickerLists: PR_AUTO_SCAN_TICKER_LISTS.length,
      totalTickers: totalTickers,
      output: "Trello cards",
      trelloListId: trelloListId,
      intervalMinutes: 5
    });
  } catch (error: any) {
    console.error("\n❌ [POST /pr-auto-scan/start] FATAL ERROR:");
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
    res.status(500).json({ error: error.message || "Failed to start PR auto-scan" });
  }
});

// Endpoint: Stop PR auto-scan
app.post("/pr-auto-scan/stop", (req, res) => {
  console.log("\n⏸️  [POST /pr-auto-scan/stop] Request received");
  if (prAutoScanInterval) {
    clearInterval(prAutoScanInterval);
    prAutoScanInterval = null;
  }
  prAutoScanActive = false;
  prCurrentlyProcessingIndex = -1;
  console.log(`⏸️  [POST /pr-auto-scan/stop] ✅ PR Auto-scan stopped`);
  
  res.json({ status: "stopped" });
});

// Endpoint: Get PR auto-scan status
app.get("/pr-auto-scan/status", (req, res) => {
  console.log("\n📊 [GET /pr-auto-scan/status] Request received");
  const totalTickers = PR_AUTO_SCAN_TICKER_LISTS.reduce((sum, list) => sum + list.split(',').length, 0);
  const intervalActive = prAutoScanInterval !== null;
  console.log(`   📊 prAutoScanActive: ${prAutoScanActive}, intervalActive: ${intervalActive}, interval: ${prAutoScanInterval ? 'set' : 'null'}`);
  const status = {
    active: prAutoScanActive,
    intervalActive: intervalActive,
    mode: prAutoScanMode,
    tickerLists: PR_AUTO_SCAN_TICKER_LISTS.length,
    totalTickers: totalTickers,
    app: "comprehensive",
    processedCount: prProcessedArticles.size,
    generatedCount: prGeneratedArticles.length
  };
  // Reduced verbose logging for status endpoint (called every 30 seconds by UI)
  // Uncomment these for debugging if needed
  // console.log(`📊 [GET /pr-auto-scan/status] prAutoScanActive: ${prAutoScanActive}`);
  // console.log(`📊 [GET /pr-auto-scan/status] Response:`, JSON.stringify(status, null, 2));
  res.json(status);
});

// Endpoint: Get fetched PRs with processing status
app.get("/pr-auto-scan/fetched-articles", (req, res) => {
  // Reduced logging for fetched-articles endpoint (called frequently by UI polling)
  // console.log("\n📋 [GET /pr-auto-scan/fetched-articles] Request received");
  
  try {
    // Reduced verbose logging - uncomment for debugging
    // console.log(`📋 [GET /pr-auto-scan/fetched-articles] Starting to map ${prFetchedArticles.length} items...`);
    
    const mappedArticles = prFetchedArticles.map((item, index) => {
      try {
        // Safe access with null checks
        const article = item.article || {};
        // Reduced verbose logging (commented out for frequent polling)
        // console.log(`📋 [GET /pr-auto-scan/fetched-articles] Processing item ${index + 1}/${prFetchedArticles.length}: articleId=${item.articleId}, status=${item.status}`);
        
        const result = {
          index: index,
          articleId: item.articleId || 'unknown',
          title: article.title || article.headline || 'Untitled',
          ticker: (() => {
            if (!article.stocks || !Array.isArray(article.stocks) || article.stocks.length === 0) {
              // console.log(`   ⚠️  Item ${index + 1}: No stocks array found`);
              return 'N/A';
            }
            const firstStock = article.stocks[0];
            if (typeof firstStock === 'string') return firstStock.toUpperCase();
            if (typeof firstStock === 'object' && firstStock !== null) {
              return (firstStock as any).ticker || (firstStock as any).symbol || (firstStock as any).name || 'N/A';
            }
            return 'N/A';
          })(),
          source: 'Benzinga PR',
          published: (() => {
            try {
              if (!article.created) {
                console.log(`   ⚠️  Item ${index + 1}: No created field`);
      return null;
              }
              // Handle different date formats
              let timestamp = article.created;
              // console.log(`   📋 Item ${index + 1}: Processing date, type=${typeof timestamp}, value=${timestamp}`);
              
              // If it's a string, try to parse it
              if (typeof timestamp === 'string') {
                const parsed = Date.parse(timestamp);
                if (!isNaN(parsed)) {
                  const date = new Date(parsed);
                  // console.log(`   ✅ Item ${index + 1}: Parsed string date successfully: ${date.toISOString()}`);
                  return date.toISOString();
                }
                console.log(`   ⚠️  Item ${index + 1}: Failed to parse string date: ${timestamp}`);
                return null;
              }
              // If it's a number, check if it's in seconds (Unix timestamp) or milliseconds
              if (typeof timestamp === 'number') {
                // If timestamp is less than year 2000 in milliseconds, it's likely in seconds
                if (timestamp < 946684800000) {
                  timestamp = timestamp * 1000;
                  console.log(`   📋 Item ${index + 1}: Converted from seconds to milliseconds: ${timestamp}`);
                }
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                  console.log(`   ✅ Item ${index + 1}: Parsed number date successfully: ${date.toISOString()}`);
                  return date.toISOString();
                }
                console.log(`   ⚠️  Item ${index + 1}: Invalid number date: ${timestamp}`);
      }
      return null;
            } catch (dateError: any) {
              console.error(`   ❌ Item ${index + 1}: Date parsing error: ${dateError.message}`);
              console.error(`   ❌ Item ${index + 1}: created value: ${article.created}, type: ${typeof article.created}`);
              return null;
            }
          })(),
          status: item.status || 'queued',
          isCurrentlyProcessing: index === prCurrentlyProcessingIndex,
          generatedArticleId: item.generatedArticleId,
          error: item.error,
          startedAt: item.startedAt,
          completedAt: item.completedAt
        };
        
        // console.log(`   ✅ Item ${index + 1} mapped successfully: ${result.title.substring(0, 50)}...`);
        return result;
      } catch (itemError: any) {
        console.error(`   ❌ Error mapping item ${index + 1}:`, itemError);
        console.error(`   Item data:`, JSON.stringify(item, null, 2).substring(0, 500));
        // Return a safe fallback object
        return {
          index: index,
          articleId: item?.articleId || `error_${index}`,
          title: 'Error loading PR',
          ticker: 'N/A',
          source: 'Benzinga PR',
          published: null,
          status: item?.status || 'error',
          isCurrentlyProcessing: false,
          generatedArticleId: item?.generatedArticleId,
          error: itemError.message,
          startedAt: item?.startedAt,
          completedAt: item?.completedAt
        };
      }
    });
    
    // Reduced verbose logging - uncomment for debugging
    // console.log(`📋 [GET /pr-auto-scan/fetched-articles] Successfully mapped ${mappedArticles.length} articles`);
    
    const response = {
      articles: mappedArticles,
      currentlyProcessingIndex: prCurrentlyProcessingIndex,
      count: prFetchedArticles.length
    };
    
    // Reduced verbose logging - uncomment for debugging
    // console.log(`📋 [GET /pr-auto-scan/fetched-articles] ✅ Sending response with ${mappedArticles.length} articles`);
    res.json(response);
  } catch (error: any) {
    console.error("❌ [GET /pr-auto-scan/fetched-articles] Fatal error:", error);
    console.error("❌ [GET /pr-auto-scan/fetched-articles] Error stack:", error.stack);
    res.status(500).json({ 
      error: "Failed to fetch PRs", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      articles: [],
      currentlyProcessingIndex: -1,
      count: 0
    });
  }
});

// Endpoint: Get generated PR articles
app.get("/pr-auto-scan/articles", (req, res) => {
  // Reduced logging for articles endpoint (called frequently by UI polling)
  // console.log("\n📰 [GET /pr-auto-scan/articles] Request received");
  
  try {
    // Return articles sorted by order (matching PR list order), then by creation date as fallback
    const sorted = [...prGeneratedArticles].sort((a, b) => {
      // First sort by order if available (maintains PR list sequential order)
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      // Fallback to creation date (oldest first to maintain processing order)
      return a.createdAt - b.createdAt;
    });
    console.log(`📰 [GET /pr-auto-scan/articles] Sorted ${sorted.length} articles by PR order`);
    
    const mappedArticles = sorted.map((article, idx) => {
      try {
        const result = {
          id: article.id,
          ticker: article.ticker,
          title: article.title,
          sourceTitle: article.sourceArticle?.title || article.sourceArticle?.headline || 'No title',
          sourceUrl: article.sourceUrl || article.sourceArticle?.url || '',
          createdAt: article.createdAt,
          generatedArticle: article.generatedArticle,
          pitch: article.pitch
        };
        console.log(`   📰 Article ${idx + 1}/${sorted.length}: ${article.ticker} - ${article.title?.substring(0, 50)}...`);
        return result;
      } catch (itemError: any) {
        console.error(`   ❌ Error mapping article ${idx + 1}:`, itemError);
        return {
          id: article?.id || `error_${idx}`,
          ticker: article?.ticker || 'N/A',
          title: 'Error loading article',
          sourceTitle: 'Unknown',
          createdAt: article?.createdAt || Date.now(),
          generatedArticle: article?.generatedArticle || '',
          pitch: article?.pitch || ''
        };
      }
    });
    
    console.log(`📰 [GET /pr-auto-scan/articles] ✅ Returning ${mappedArticles.length} articles`);
    res.json({
      articles: mappedArticles,
      count: sorted.length
    });
  } catch (error: any) {
    console.error("❌ [GET /pr-auto-scan/articles] Error:", error);
    console.error("❌ [GET /pr-auto-scan/articles] Error stack:", error.stack);
    res.status(500).json({
      error: "Failed to fetch generated articles",
      message: error.message,
      articles: [],
      count: 0
    });
  }
});

// Endpoint: Get single generated PR article
// Endpoint: Generate article for a specific PR manually
app.post("/pr-auto-scan/generate-article/:articleId", async (req, res) => {
  const { articleId } = req.params;
  console.log(`\n📝 [POST /pr-auto-scan/generate-article/${articleId}] Manual article generation requested`);
  
  try {
    // Find the PR in the fetched articles queue
    const fetchedItem = prFetchedArticles.find(f => f.articleId === articleId);
    if (!fetchedItem) {
      console.log(`   ❌ PR not found in queue: ${articleId}`);
      return res.status(404).json({ error: "PR not found in queue" });
    }
    
    // Check if already generated
    if (fetchedItem.generatedArticleId) {
      console.log(`   ⚠️  Article already generated for this PR: ${fetchedItem.generatedArticleId}`);
      return res.status(400).json({ 
        error: "Article already generated",
        articleId: fetchedItem.generatedArticleId
      });
    }
    
    // Check if currently generating
    if (fetchedItem.status === 'generating') {
      console.log(`   ⚠️  Article generation already in progress`);
      return res.status(400).json({ error: "Article generation already in progress" });
    }
    
    const pr = fetchedItem.article;
    if (!pr) {
      console.log(`   ❌ PR data missing for articleId: ${articleId}`);
      return res.status(404).json({ error: "PR data not found" });
    }
    
    // Update status to generating
    fetchedItem.status = 'generating';
    fetchedItem.startedAt = Date.now();
    const fetchedIndex = prFetchedArticles.findIndex(f => f.articleId === articleId);
    prCurrentlyProcessingIndex = fetchedIndex;
    
    console.log(`   🔄 Starting generation for PR: ${pr.title?.substring(0, 50)}...`);
    
    // Extract ticker from PR
    let prTicker: string | null = null;
      if (pr.stocks && Array.isArray(pr.stocks) && pr.stocks.length > 0) {
      const firstStock = pr.stocks[0];
      if (typeof firstStock === 'string') {
        prTicker = firstStock.toUpperCase().trim();
      } else if (typeof firstStock === 'object' && firstStock !== null) {
        const tickerStr = (firstStock as any).ticker || (firstStock as any).symbol || (firstStock as any).name || '';
        if (tickerStr) {
          prTicker = String(tickerStr).toUpperCase().trim();
        }
      }
    }
    
    if (!prTicker) {
      fetchedItem.status = 'failed';
      fetchedItem.error = 'No ticker found in PR';
      prCurrentlyProcessingIndex = -1;
      console.log(`   ❌ No ticker found for PR: ${pr.title?.substring(0, 50)}`);
      return res.status(400).json({ error: "No ticker found in PR" });
    }
    
    // Check for comprehensive article generator
    const comprehensiveUrl = process.env.ARTICLE_GEN_API_URL;
    if (!comprehensiveUrl || !comprehensiveUrl.includes('comprehensive-article')) {
      fetchedItem.status = 'failed';
      fetchedItem.error = 'ARTICLE_GEN_API_URL not configured';
      prCurrentlyProcessingIndex = -1;
      console.log(`   ❌ ARTICLE_GEN_API_URL not configured`);
      return res.status(400).json({ error: "ARTICLE_GEN_API_URL must be set to comprehensive-article endpoint" });
    }
    
    // Create pitch from PR
    const dateStr = pr.created 
      ? new Date(pr.created * 1000).toLocaleDateString()
      : 'Date not available';
    
    const title = pr.title || pr.headline || 'Untitled Press Release';
    const body = pr.body || pr.teaser || '';
    const summary = pr.teaser || (body ? body.substring(0, 500) : 'No summary available');
    
    const pitch = `Proposed Article: ${title}

Source: Benzinga Press Release
Published: ${dateStr}
Company Ticker: ${prTicker}

Executive Summary:
${summary}

Proposed Angle: Analyze the implications of this press release for ${prTicker} investors and the broader market.`;
    
    console.log(`   📝 Generating article for PR: ${title.substring(0, 50)}... (${prTicker})`);
    
    const { generateArticle } = await import("./article-generator-integration");
    
    // Generate article using comprehensive article generator
    const generatedArticle = await generateArticle(
      pitch,
      "comprehensive",
      prTicker,
      [pr],
      pr,
      prTicker
    );
    
    console.log(`   ✅ Article generated successfully, length: ${generatedArticle.length} chars`);
    
    // Extract title from generated article
    let generatedTitle = title;
    try {
      const titleMatch = generatedArticle.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      if (titleMatch && titleMatch[1]) {
        generatedTitle = titleMatch[1].trim();
      } else {
        const firstSentence = generatedArticle.split(/[.!?]/)[0].trim();
        if (firstSentence.length > 10 && firstSentence.length < 200) {
          generatedTitle = firstSentence;
        }
      }
    } catch (titleError) {
      console.log(`   ⚠️  Could not extract title from generated article, using PR title`);
    }
    
    // Convert to title case
    function toTitleCase(str: string): string {
      return str.replace(/\w\S*/g, (txt) => {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    }
    generatedTitle = toTitleCase(generatedTitle);
    
    // Store generated article
    const generatedId = `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const prUrl = pr.url || '';
    const prOrder = prFetchedArticles.length - fetchedIndex; // Maintain order
    
    prGeneratedArticles.push({
      id: generatedId,
      title: generatedTitle,
      generatedArticle: generatedArticle,
      ticker: prTicker,
      sourceArticle: pr,
      createdAt: Date.now(),
      pitch: pitch,
      sourceUrl: prUrl,
      order: prOrder
    });
    
    // Update fetched item
    fetchedItem.status = 'completed';
    fetchedItem.generatedArticleId = generatedId;
    fetchedItem.completedAt = Date.now();
    prCurrentlyProcessingIndex = -1;
    
    // Mark as processed
    prProcessedArticles.set(articleId, {
      id: articleId,
      processedAt: Date.now()
    });
    
    console.log(`   ✅ Article stored with ID: ${generatedId}`);
    
    res.json({
      success: true,
      articleId: generatedId,
      title: generatedTitle,
      status: 'completed'
    });
    
  } catch (error: any) {
    console.error(`   ❌ Error generating article:`, error);
    
    // Update status to failed
    const fetchedItem = prFetchedArticles.find(f => f.articleId === articleId);
    if (fetchedItem) {
      fetchedItem.status = 'failed';
      fetchedItem.error = error.message || 'Generation failed';
      fetchedItem.completedAt = Date.now();
    }
    prCurrentlyProcessingIndex = -1;
    
    res.status(500).json({ 
      error: "Failed to generate article",
      message: error.message
    });
  }
});

app.get("/pr-auto-scan/articles/:id", (req, res) => {
  const { id } = req.params;
  const { format } = req.query; // Support ?format=json for API calls
  console.log(`\n📄 [GET /pr-auto-scan/articles/${id}] Request received`);
  console.log(`   🔍 Searching in prGeneratedArticles array (${prGeneratedArticles.length} articles)`);
  
  // Debug: log all article IDs (limit to first 20 to avoid log spam)
  if (prGeneratedArticles.length > 0) {
    const allIds = prGeneratedArticles.map(a => a.id);
    const idsToShow = allIds.slice(0, 20);
    console.log(`   📋 Available article IDs (showing first 20 of ${allIds.length}): ${idsToShow.join(', ')}`);
  }
  
  let article = prGeneratedArticles.find(a => a.id === id);
  
  // If exact match not found, try case-insensitive match
  if (!article) {
    article = prGeneratedArticles.find(a => a.id.toLowerCase() === id.toLowerCase());
    if (article) {
      console.log(`   ⚠️  Found case-insensitive match: ${article.id} (requested: ${id})`);
    }
  }
  
  // If still not found, try partial timestamp match (in case of timing differences)
  if (!article) {
    const idMatch = id.match(/trello_gen_(\d+)_/);
    if (idMatch) {
      const requestedTimestamp = parseInt(idMatch[1]);
      const partialMatches = prGeneratedArticles.filter(a => {
        const articleMatch = a.id.match(/trello_gen_(\d+)_/);
        if (articleMatch) {
          const articleTimestamp = parseInt(articleMatch[1]);
          // If timestamps are within 1 minute, consider it a match
          return Math.abs(articleTimestamp - requestedTimestamp) < 60000;
        }
        return false;
      });
      
      if (partialMatches.length > 0) {
        // Use the closest match (smallest timestamp difference)
        article = partialMatches.reduce((closest, current) => {
          const closestMatch = closest.id.match(/trello_gen_(\d+)_/);
          const currentMatch = current.id.match(/trello_gen_(\d+)_/);
          if (closestMatch && currentMatch) {
            const closestDiff = Math.abs(parseInt(closestMatch[1]) - requestedTimestamp);
            const currentDiff = Math.abs(parseInt(currentMatch[1]) - requestedTimestamp);
            return currentDiff < closestDiff ? current : closest;
          }
          return closest;
        });
        console.log(`   💡 Found article with similar timestamp: ${article.id} (requested: ${id})`);
      }
    }
  }
  
  if (!article) {
    console.log(`❌ [GET /pr-auto-scan/articles/${id}] Article not found`);
    console.log(`   💡 This might happen if:`);
    console.log(`      - The server was restarted (articles are stored in memory)`);
    console.log(`      - The article generation failed before storage`);
    console.log(`      - The article ID doesn't match (check logs for actual ID)`);
    console.log(`   📊 Total articles in memory: ${prGeneratedArticles.length}`);
    return res.status(404).json({ error: "Article not found" });
  }
  console.log(`✅ [GET /pr-auto-scan/articles/${id}] Article found: ${article.ticker} - ${article.title}`);
  
  // If format=json is requested, return JSON (for API calls)
  if (format === 'json') {
      return res.json({
      id: article.id,
      ticker: article.ticker,
      title: article.title,
      sourceArticle: article.sourceArticle,
      sourceUrl: article.sourceUrl || article.sourceArticle?.url || '',
      generatedArticle: article.generatedArticle,
      pitch: article.pitch,
      createdAt: article.createdAt
    });
  }
  
  // Otherwise, return formatted HTML page for viewing/copying
  const htmlContent = article.generatedArticle || '';
  const title = article.title || 'Article';
  const ticker = article.ticker || '';
  const sourceUrl = article.sourceUrl || article.sourceArticle?.url || '';
  
  // Escape HTML for display in the page (not in the article content itself)
  function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
  
  // Format article content: ensures proper paragraph formatting regardless of input format
  // Similar to formatWGOOutput - handles both HTML and plain text
  function formatArticleContent(content: string): string {
    if (!content) return '';
    
    // Normalize line breaks
    let formatted = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Check if content already contains HTML tags
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(formatted);
    
    if (hasHtmlTags) {
      // It's HTML - check if it has proper paragraph structure
      // If it's all in one big block (no <p> tags or very few), reformat it
      const pTagCount = (formatted.match(/<p[^>]*>/gi) || []).length;
      const hasProperParagraphs = pTagCount > 3; // If more than 3 paragraphs, assume it's properly formatted
      
      if (!hasProperParagraphs) {
        // HTML but not properly paragraphized - extract text content while preserving formatting
        // Preserve common formatting tags (strong, em, b, i) but remove structural tags
        formatted = formatted
          .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n') // Convert <p> tags to newlines
          .replace(/<\/?p[^>]*>/gi, '\n') // Remove remaining <p> tags
          .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
          .replace(/<\/?(div|span|section|article)[^>]*>/gi, '\n') // Remove block containers
          // Preserve formatting tags - we'll convert them to markdown then back to HTML
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
          // Remove any remaining HTML tags
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        // Continue to plain text processing below (which will convert markdown back to HTML)
      } else {
        // Already has proper paragraph structure, return as-is
        return formatted;
      }
    }
    
    // Plain text or HTML without proper paragraphs - convert to properly formatted HTML
    // Split by double newlines for paragraphs (like formatWGOOutput does)
    let paragraphs = formatted.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    // If no double newlines, try splitting by single newlines
    if (paragraphs.length === 1 && formatted.includes('\n')) {
      paragraphs = formatted.split('\n').filter(p => p.trim().length > 0);
    }
    
    // If still only one paragraph and it's very long, try splitting by sentence boundaries
    if (paragraphs.length === 1 && paragraphs[0].length > 500) {
      const longText = paragraphs[0];
      
      // Split by periods followed by space and capital letter (sentence boundaries)
      // Use a simpler regex that's more compatible
      const sentenceRegex = /\.\s+(?=[A-Z])/g;
      const sentenceMatches = [...longText.matchAll(sentenceRegex)];
      
      if (sentenceMatches.length > 2) {
        // Split into sentences
        let lastIndex = 0;
        const sentences: string[] = [];
        
        sentenceMatches.forEach(match => {
          if (match.index !== undefined) {
            const sentence = longText.substring(lastIndex, match.index + 1).trim();
            if (sentence.length > 0) {
              sentences.push(sentence);
            }
            lastIndex = match.index + match[0].length;
          }
        });
        
        // Add the last sentence
        const lastSentence = longText.substring(lastIndex).trim();
        if (lastSentence.length > 0) {
          sentences.push(lastSentence);
        }
        
        // Group sentences into paragraphs (roughly 3-4 sentences per paragraph)
        if (sentences.length > 3) {
          const groupSize = 3;
          paragraphs = [];
          for (let i = 0; i < sentences.length; i += groupSize) {
            const group = sentences.slice(i, i + groupSize).join(' ');
            if (group.trim().length > 0) {
              paragraphs.push(group.trim());
            }
          }
        }
      }
    }
    
    // Convert each paragraph to HTML
    const htmlParagraphs = paragraphs.map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      
      // Check if it's a heading (starts with ### or ## or #)
      if (/^###\s+/.test(trimmed)) {
        const text = trimmed.replace(/^###\s+/, '').trim();
        return `<h3>${escapeHtml(text)}</h3>`;
      } else if (/^##\s+/.test(trimmed)) {
        const text = trimmed.replace(/^##\s+/, '').trim();
        return `<h2>${escapeHtml(text)}</h2>`;
      } else if (/^#\s+/.test(trimmed)) {
        const text = trimmed.replace(/^#\s+/, '').trim();
        return `<h1>${escapeHtml(text)}</h1>`;
      } else {
        // Regular paragraph - process inline formatting
        let html = escapeHtml(trimmed);
        
        // Convert **bold** to <strong>
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // Convert *italic* to <em> (but not if already processed as bold)
        html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
        
        return `<p>${html}</p>`;
      }
    }).filter(p => p.length > 0);
    
    return htmlParagraphs.join('\n');
  }
  
  const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - Generated Article</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-bottom: 3px solid #5a67d8;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
            line-height: 1.3;
        }
        .header .meta {
            font-size: 14px;
            opacity: 0.9;
            margin-top: 10px;
        }
        .header .meta a {
            color: white;
            text-decoration: underline;
        }
        .toolbar {
            background: #f8f9fa;
            padding: 15px 30px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover {
            background: #5a67d8;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }
        .btn-secondary {
            background: #48bb78;
            color: white;
        }
        .btn-secondary:hover {
            background: #38a169;
        }
        .btn-outline {
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
        }
        .btn-outline:hover {
            background: #f0f4ff;
        }
        .success-message {
            background: #c6f6d5;
            color: #22543d;
            padding: 12px 20px;
            border-radius: 6px;
            margin-left: auto;
            display: none;
            font-weight: 500;
        }
        .success-message.show {
            display: block;
        }
        .article-content {
            padding: 40px;
        }
        .article-content h1,
        .article-content h2,
        .article-content h3 {
            margin: 30px 0 15px 0;
            color: #2d3748;
        }
        .article-content h1 {
            font-size: 32px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        .article-content h2 {
            font-size: 24px;
        }
        .article-content h3 {
            font-size: 20px;
        }
        .article-content p {
            margin-bottom: 16px;
            color: #4a5568;
            font-size: 16px;
        }
        .article-content a {
            color: #667eea;
            text-decoration: underline;
        }
        .article-content a:hover {
            color: #5a67d8;
        }
        .article-content ul,
        .article-content ol {
            margin: 16px 0 16px 30px;
            color: #4a5568;
        }
        .article-content li {
            margin-bottom: 8px;
        }
        .article-content strong {
            font-weight: 600;
            color: #2d3748;
        }
        .article-content em {
            font-style: italic;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #718096;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        @media print {
            .toolbar, .footer {
                display: none;
            }
            .container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
                ${ticker ? `<strong>Ticker:</strong> ${escapeHtml(ticker)} • ` : ''}
                <strong>Generated:</strong> ${new Date(article.createdAt).toLocaleString()}
                ${sourceUrl ? ` • <a href="${escapeHtml(sourceUrl)}" target="_blank">View Original PR</a>` : ''}
            </div>
        </div>
        <div class="toolbar">
            <button class="btn btn-primary" onclick="copyArticleToClipboard()">📋 Copy Article HTML</button>
            <button class="btn btn-secondary" onclick="copyPlainText()">📄 Copy Plain Text</button>
            <a href="${escapeHtml(sourceUrl)}" target="_blank" class="btn btn-outline">🔗 View Original PR</a>
            <a href="/" class="btn btn-outline">← Back to Dashboard</a>
            <div class="success-message" id="successMsg">✅ Copied to clipboard!</div>
        </div>
        <div class="article-content" id="articleContent">
            ${formatArticleContent(htmlContent)}
        </div>
        <div class="footer">
            <p>Article ID: ${escapeHtml(article.id)}</p>
            <p><a href="/pr-auto-scan/articles/${escapeHtml(id)}?format=json">View JSON</a> | <a href="/">Dashboard</a></p>
        </div>
    </div>
    
    <script>
        function copyArticleToClipboard() {
            const articleContent = document.getElementById('articleContent');
            
            if (!articleContent) {
                alert('Error: Could not find article content to copy.');
                return;
            }
            
            // Clone the content to avoid modifying the original
            const clonedContent = articleContent.cloneNode(true);
            
            // Create a temp div to work with
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(clonedContent);
            
            // Walk through all text nodes and fix spacing
            const walker = document.createTreeWalker(
                tempDiv,
                NodeFilter.SHOW_TEXT,
                null
            );
            
            let node;
            const textNodes = [];
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            
            // Fix spacing in text nodes
            textNodes.forEach(textNode => {
                let text = textNode.textContent;
                
                // Normalize whitespace: multiple spaces/tabs/newlines -> single space
                text = text.replace(/[\\s\\t\\n\\r]+/g, ' ');
                
                // Fix spacing around punctuation
                // Add space before opening parenthesis if missing (but not if already has space)
                text = text.replace(/([^\\s])\\(/g, '$1 (');
                // Fix spacing after closing parenthesis (but not before punctuation)
                text = text.replace(/\\)([^\\s.,;:!?\\])/g, ') $1');
                
                // Fix specific duplicate word patterns (like "according toaccording to")
                // Only fix common phrases that might get duplicated, not all words
                const duplicatePhrases = [
                    'according to', 'based on', 'due to', 'such as', 'as well as',
                    'in order to', 'in addition to', 'as reported by', 'as stated',
                    'for example', 'for instance', 'in other words'
                ];
                duplicatePhrases.forEach(phrase => {
                    // Simple string replacement for duplicates (case-insensitive)
                    const lowerText = text.toLowerCase();
                    const lowerPhrase = phrase.toLowerCase();
                    const phraseIndex = lowerText.indexOf(lowerPhrase + lowerPhrase);
                    if (phraseIndex !== -1) {
                        // Found duplicate, replace with single occurrence
                        const before = text.substring(0, phraseIndex);
                        const after = text.substring(phraseIndex + phrase.length * 2);
                        text = before + phrase + after;
                    }
                });
                
                // Fix cases where words are directly concatenated (camelCase or concatenated words)
                // Only add space if it looks like two separate words merged
                text = text.replace(/([a-z])([A-Z][a-z])/g, '$1 $2');
                
                // Fix spacing around periods followed by capital letters (sentence breaks)
                text = text.replace(/([a-zA-Z])\\.([A-Z])/g, '$1. $2');
                
                // Trim the text node but don't remove internal spaces
                if (textNode.previousSibling || textNode.nextSibling) {
                    // Not first or last, just normalize
                    textNode.textContent = text;
      } else {
                    // First or last, can trim
                    textNode.textContent = text.trim();
                }
            });
            
            // Get the cleaned HTML
            let html = tempDiv.innerHTML;
            
            // Remove whitespace at start/end of paragraphs (inside the tags)
            html = html.replace(/<p([^>]*)>\\s+/g, '<p$1>');
            html = html.replace(/\\s+<\\/p>/g, '</p>');
            
            // Ensure paragraphs are separated by a single newline for WordPress
            html = html.replace(/<\\/p>\\s*<p/g, '</p>\\n<p');
            
            // Clean up whitespace between other block-level tags
            html = html.replace(/><\\/(p|div|h[1-6]|ul|ol|li)>\\s*</g, '></$1>\\n<');
            html = html.replace(/>\\s*<(p|div|h[1-6]|ul|ol|li)/g, '>\\n<$1');
            
            // Remove whitespace between inline elements
            html = html.replace(/><\\/(strong|em|b|i|a|span)>\\s*</g, '></$1><');
            html = html.replace(/>\\s*<(strong|em|b|i|a|span)/g, '><$1');
            
            // Clean up any remaining excessive whitespace between tags
            html = html.replace(/>\\s{2,}</g, '><');
            
            // Normalize multiple newlines to double newline max
            html = html.replace(/\\n{3,}/g, '\\n\\n');
            
            // Trim the entire string
            html = html.trim();
            
            // Try modern clipboard API first (more reliable)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(html).then(() => {
                    showSuccess();
                }).catch((err) => {
                    console.error('Clipboard API failed:', err);
                    // Fallback to execCommand method
                    fallbackCopy(html);
                });
            } else {
                // Fallback to execCommand method
                fallbackCopy(html);
            }
            
            function fallbackCopy(text) {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.top = '0';
                textarea.style.left = '0';
                textarea.style.width = '2em';
                textarea.style.height = '2em';
                textarea.style.padding = '0';
                textarea.style.border = 'none';
                textarea.style.outline = 'none';
                textarea.style.boxShadow = 'none';
                textarea.style.background = 'transparent';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                
                // For iOS
                textarea.contentEditable = true;
                textarea.readOnly = false;
                
                // Select and copy
                const range = document.createRange();
                range.selectNodeContents(textarea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textarea.setSelectionRange(0, 999999); // For mobile devices
                
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        showSuccess();
                    } else {
                        alert('Failed to copy. Please select and copy manually.');
                    }
                } catch (err) {
                    console.error('execCommand failed:', err);
                    alert('Failed to copy. Please select and copy manually.');
                }
                
                // Clean up
                document.body.removeChild(textarea);
                selection.removeAllRanges();
            }
        }
        
        function copyPlainText() {
            const articleContent = document.getElementById('articleContent');
            const text = articleContent.innerText || articleContent.textContent;
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showSuccess();
            } catch (err) {
                alert('Failed to copy. Please select and copy manually.');
            }
            document.body.removeChild(textarea);
        }
        
        function showSuccess() {
            const msg = document.getElementById('successMsg');
            msg.classList.add('show');
            setTimeout(() => {
                msg.classList.remove('show');
            }, 2000);
        }
        
        // Auto-select article content on click for easy copying
        document.getElementById('articleContent').addEventListener('click', function(e) {
            if (e.target.tagName === 'P' || e.target.tagName === 'H1' || e.target.tagName === 'H2' || e.target.tagName === 'H3') {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(e.target);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(htmlPage);
});

// ANALYST STORY VIEW ENDPOINT: View generated analyst story
// Usage: GET /analyst-story/view/:storyId
app.get("/analyst-story/view/:storyId", (req, res) => {
  let { storyId } = req.params; // Use let instead of const so we can reassign if needed
  const { format } = req.query; // Support ?format=json for API calls
  console.log(`\n📄 [GET /analyst-story/view/${storyId}] Request received`);
  console.log(`   🔍 Searching in analystGeneratedStories map (${analystGeneratedStories.size} stories)`);
  
  let story = analystGeneratedStories.get(storyId);
  
  // If story not found by storyId, try to find by cardId (extracted from storyId)
  if (!story && storyId.startsWith('analyst_')) {
    const cardIdFromStoryId = storyId.split('_')[1];
    console.log(`   🔍 Story not found by storyId, trying to find by cardId: ${cardIdFromStoryId}`);
    
    // Find story by cardId
    for (const [id, storedStory] of analystGeneratedStories.entries()) {
      if (storedStory.cardId === cardIdFromStoryId) {
        console.log(`   ✅ Found story by cardId match: ${id}`);
        story = storedStory;
        // Update the storyId for use in the rest of the function
        storyId = id;
        break;
      }
    }
  }
  
  if (!story) {
    const availableIds = Array.from(analystGeneratedStories.keys());
    console.log(`❌ [GET /analyst-story/view/${storyId}] Story not found`);
    console.log(`   💡 This might happen if the server was restarted (stories are stored in memory)`);
    console.log(`   💡 Total stories stored: ${analystGeneratedStories.size}`);
    console.log(`   💡 Available story IDs: ${availableIds.slice(0, 10).join(', ')}${availableIds.length > 10 ? `... (${availableIds.length} total)` : ''}`);
    console.log(`   💡 Requested storyId: ${storyId}`);
    console.log(`   💡 StoryId format check: ${storyId.startsWith('analyst_') ? '✅ Correct format' : '❌ Wrong format'}`);
    
    // Extract cardId from storyId and show stories for that card
    if (storyId.startsWith('analyst_')) {
      const cardIdFromStoryId = storyId.split('_')[1];
      const storiesForCard = Array.from(analystGeneratedStories.entries())
        .filter(([id, s]) => s.cardId === cardIdFromStoryId);
      if (storiesForCard.length > 0) {
        console.log(`   💡 Found ${storiesForCard.length} story(ies) for cardId ${cardIdFromStoryId}:`);
        storiesForCard.forEach(([id, s]) => {
          console.log(`      - ${id} (title: ${s.title})`);
        });
      }
    }
    
    // Check if there's a similar storyId (maybe timestamp mismatch)
    const similarIds = availableIds.filter(id => id.includes(storyId.split('_').slice(0, 2).join('_')));
    if (similarIds.length > 0) {
      console.log(`   💡 Found similar story IDs: ${similarIds.join(', ')}`);
    }
    
    const errorHtml = `<!DOCTYPE html><html><head><title>Story Not Found</title><meta charset="UTF-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f5f5f5;color:#dc2626}.message{text-align:center;padding:20px;max-width:600px;background:white;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.debug{text-align:left;margin-top:20px;padding:15px;background:#f8f9fa;border-radius:6px;font-size:12px;font-family:monospace}</style></head><body><div class="message"><h2>❌ Story Not Found</h2><p>The requested analyst story could not be found.</p><div class="debug"><strong>Debug Info:</strong><br>Requested ID: ${escapeHtml(storyId)}<br>Total stories stored: ${analystGeneratedStories.size}<br>${availableIds.length > 0 ? `Available IDs: ${availableIds.slice(0, 5).map(id => escapeHtml(id)).join(', ')}${availableIds.length > 5 ? '...' : ''}` : 'No stories stored'}</div><p><small>This might happen if the server was restarted (stories are stored in memory).</small></p><p><a href="/analyst-story/debug/stories">View All Stored Stories</a> | <a href="/">← Back to Dashboard</a></p></div></body></html>`;
    
    function escapeHtml(text: string): string {
      const map: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, (m) => map[m]);
    }
    
    return res.status(404).send(errorHtml);
  }
  
  console.log(`✅ [GET /analyst-story/view/${storyId}] Story found: ${story.ticker || 'N/A'} - ${story.title}`);
  
  // If format=json is requested, return JSON (for API calls)
  if (format === 'json') {
    return res.json({
      id: story.id,
      cardId: story.cardId,
      ticker: story.ticker,
      title: story.title,
      story: story.story,
      createdAt: story.createdAt
    });
  }
  
  // Otherwise, return formatted HTML page for viewing/copying
  const htmlContent = story.story || '';
  const title = story.title || 'Analyst Story';
  const ticker = story.ticker || '';
  const cardUrl = `https://trello.com/c/${story.cardId}`;
  
  // Escape HTML for display in the page (not in the article content itself)
  function escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
  
  // Format article content: ensures proper paragraph formatting regardless of input format
  function formatArticleContent(content: string): string {
    if (!content) return '';
    
    // Normalize line breaks
    let formatted = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Check if content already contains HTML tags
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(formatted);
    
    if (hasHtmlTags) {
      // It's HTML - check if it has proper paragraph structure
      const pTagCount = (formatted.match(/<p[^>]*>/gi) || []).length;
      const hasProperParagraphs = pTagCount > 3;
      
      if (!hasProperParagraphs) {
        // HTML but not properly paragraphized - extract text content while preserving formatting
        formatted = formatted
          .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
          .replace(/<\/?p[^>]*>/gi, '\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/?(div|span|section|article)[^>]*>/gi, '\n')
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
      } else {
        // Already has proper paragraph structure, return as-is
        return formatted;
      }
    }
    
    // Plain text or HTML without proper paragraphs - convert to properly formatted HTML
    let paragraphs = formatted.split(/\n\n+/).filter(p => p.trim().length > 0);
    
    // If no double newlines, try splitting by single newlines
    if (paragraphs.length === 1 && formatted.includes('\n')) {
      paragraphs = formatted.split('\n').filter(p => p.trim().length > 0);
    }
    
    // If still only one paragraph and it's very long, try splitting by sentence boundaries
    if (paragraphs.length === 1 && paragraphs[0].length > 500) {
      const sentences = paragraphs[0].split(/(?<=[.!?])\s+(?=[A-Z])/);
      if (sentences.length > 1) {
        const groupSize = 3;
        paragraphs = [];
        for (let i = 0; i < sentences.length; i += groupSize) {
          const group = sentences.slice(i, i + groupSize).join(' ');
          if (group.trim().length > 0) {
            paragraphs.push(group.trim());
          }
        }
      }
    }
    
    // Convert each paragraph to HTML
    const htmlParagraphs = paragraphs.map(para => {
      const trimmed = para.trim();
      if (!trimmed) return '';
      
      if (/^###\s+/.test(trimmed)) {
        const text = trimmed.replace(/^###\s+/, '').trim();
        return `<h3>${escapeHtml(text)}</h3>`;
      } else if (/^##\s+/.test(trimmed)) {
        const text = trimmed.replace(/^##\s+/, '').trim();
        return `<h2>${escapeHtml(text)}</h2>`;
      } else if (/^#\s+/.test(trimmed)) {
        const text = trimmed.replace(/^#\s+/, '').trim();
        return `<h1>${escapeHtml(text)}</h1>`;
      } else {
        let html = escapeHtml(trimmed);
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
        return `<p>${html}</p>`;
      }
    }).filter(p => p.length > 0);
    
    return htmlParagraphs.join('\n');
  }
  
  const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} - Analyst Story</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-bottom: 3px solid #5a67d8;
        }
        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
            line-height: 1.3;
        }
        .header .meta {
            font-size: 14px;
            opacity: 0.9;
            margin-top: 10px;
        }
        .header .meta a {
            color: white;
            text-decoration: underline;
        }
        .toolbar {
            background: #f8f9fa;
            padding: 15px 30px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover {
            background: #5a67d8;
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
        }
        .btn-secondary {
            background: #48bb78;
            color: white;
        }
        .btn-secondary:hover {
            background: #38a169;
        }
        .btn-outline {
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
        }
        .btn-outline:hover {
            background: #f0f4ff;
        }
        .success-message {
            background: #c6f6d5;
            color: #22543d;
            padding: 12px 20px;
            border-radius: 6px;
            margin-left: auto;
            display: none;
            font-weight: 500;
        }
        .success-message.show {
            display: block;
        }
        .article-content {
            padding: 40px;
        }
        .article-content h1,
        .article-content h2,
        .article-content h3 {
            margin: 30px 0 15px 0;
            color: #2d3748;
        }
        .article-content h1 {
            font-size: 32px;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }
        .article-content h2 {
            font-size: 24px;
        }
        .article-content h3 {
            font-size: 20px;
        }
        .article-content p {
            margin-bottom: 16px;
            color: #4a5568;
            font-size: 16px;
        }
        .article-content a {
            color: #667eea;
            text-decoration: underline;
        }
        .article-content a:hover {
            color: #5a67d8;
        }
        .article-content strong {
            font-weight: 600;
            color: #2d3748;
        }
        .article-content em {
            font-style: italic;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #718096;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .footer a:hover {
            text-decoration: underline;
        }
        @media print {
            .toolbar, .footer {
                display: none;
            }
            .container {
                box-shadow: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
                ${ticker ? `<strong>Ticker:</strong> ${escapeHtml(ticker)} • ` : ''}
                <strong>Generated:</strong> ${new Date(story.createdAt).toLocaleString()}
                • <a href="${escapeHtml(cardUrl)}" target="_blank">View Trello Card</a>
            </div>
        </div>
        <div class="toolbar">
            <button class="btn btn-primary" onclick="copyArticleToClipboard()">📋 Copy Article HTML</button>
            <button class="btn btn-secondary" onclick="copyPlainText()">📄 Copy Plain Text</button>
            <a href="${escapeHtml(cardUrl)}" target="_blank" class="btn btn-outline">🔗 View Trello Card</a>
            <a href="/" class="btn btn-outline">← Back to Dashboard</a>
            <div class="success-message" id="successMsg">✅ Copied to clipboard!</div>
        </div>
        <div class="article-content" id="articleContent">
            ${formatArticleContent(htmlContent)}
        </div>
        <div class="footer">
            <p>Story ID: ${escapeHtml(story.id)}</p>
            <p><a href="/analyst-story/view/${escapeHtml(storyId)}?format=json">View JSON</a> | <a href="/">Dashboard</a></p>
        </div>
    </div>
    
    <script>
        function copyArticleToClipboard() {
            const articleContent = document.getElementById('articleContent');
            if (!articleContent) {
                alert('Error: Could not find article content to copy.');
                return;
            }
            const clonedContent = articleContent.cloneNode(true);
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(clonedContent);
            const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null);
            let node;
            const textNodes = [];
            while (node = walker.nextNode()) {
                textNodes.push(node);
            }
            textNodes.forEach(textNode => {
                let text = textNode.textContent;
                text = text.replace(/[\\s\\t\\n\\r]+/g, ' ');
                textNode.textContent = text;
            });
            let html = tempDiv.innerHTML;
            html = html.replace(/\\n{3,}/g, '\\n\\n');
            html = html.trim();
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(html).then(() => {
                    showSuccess();
                }).catch((err) => {
                    console.error('Clipboard API failed:', err);
                    fallbackCopy(html);
                });
            } else {
                fallbackCopy(html);
            }
            function fallbackCopy(text) {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.top = '0';
                textarea.style.left = '0';
                textarea.style.width = '2em';
                textarea.style.height = '2em';
                textarea.style.padding = '0';
                textarea.style.border = 'none';
                textarea.style.outline = 'none';
                textarea.style.boxShadow = 'none';
                textarea.style.background = 'transparent';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.contentEditable = true;
                textarea.readOnly = false;
                const range = document.createRange();
                range.selectNodeContents(textarea);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textarea.setSelectionRange(0, 999999);
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        showSuccess();
                    } else {
                        alert('Failed to copy. Please select and copy manually.');
                    }
                } catch (err) {
                    console.error('execCommand failed:', err);
                    alert('Failed to copy. Please select and copy manually.');
                }
                document.body.removeChild(textarea);
                selection.removeAllRanges();
            }
        }
        function copyPlainText() {
            const articleContent = document.getElementById('articleContent');
            const text = articleContent.innerText || articleContent.textContent;
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showSuccess();
            } catch (err) {
                alert('Failed to copy. Please select and copy manually.');
            }
            document.body.removeChild(textarea);
        }
        function showSuccess() {
            const msg = document.getElementById('successMsg');
            msg.classList.add('show');
            setTimeout(() => {
                msg.classList.remove('show');
            }, 2000);
        }
        document.getElementById('articleContent').addEventListener('click', function(e) {
            if (e.target.tagName === 'P' || e.target.tagName === 'H1' || e.target.tagName === 'H2' || e.target.tagName === 'H3') {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(e.target);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(htmlPage);
});

// Core function: Run PR auto-scan and generate articles
// initialLoad: if true, fetch most recent PRs from past 36 hours. If false, only fetch from past 48 hours.
async function runPRAutoScan(initialLoad: boolean = false) {
  console.log(`\n🔍 [runPRAutoScan] Called with initialLoad=${initialLoad}, prAutoScanActive=${prAutoScanActive}`);
  
  if (!prAutoScanActive) {
    console.log(`   ⚠️  PR auto-scan is not active, returning early`);
    return;
  }
  
  const prApiKey = process.env.BENZINGA_PR_API_KEY;
  if (!prApiKey) {
    console.error("❌ PR AUTO-SCAN: BENZINGA_PR_API_KEY not configured");
    return;
  }
  
  if (initialLoad) {
    console.log(`\n📥 PR AUTO-SCAN: Initial load - fetching PRs from past 36 hours...`);
  } else {
    console.log(`\n🔍 PR AUTO-SCAN: Regular scan - checking for new PRs from past 48 hours...`);
  }
  
  try {
    const { generateArticle } = await import("./article-generator-integration");
    
    // Fetch PRs using 3 hardcoded API queries
    const allPRs: any[] = [];
    const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';
    
    for (let queryIndex = 0; queryIndex < PR_AUTO_SCAN_TICKER_LISTS.length; queryIndex++) {
      const tickerList = PR_AUTO_SCAN_TICKER_LISTS[queryIndex];
      try {
        console.log(`   📥 Query ${queryIndex + 1}/3: Fetching PRs for ${tickerList.split(',').length} tickers...`);
        
        // Build URL matching user's format exactly
        // User's format: pageSize=100&displayOutput=headline&token=...&tickers=...&page=0
        // We add fields and full displayOutput for complete data, and channels filter for PRs
        const url = `${BZ_NEWS_URL}?pageSize=100&displayOutput=full&token=${prApiKey}&tickers=${encodeURIComponent(tickerList)}&page=0&fields=headline,title,created,body,url,channels,teaser&accept=application/json&channels=Press Releases`;
        
        const response = await fetch(url, {
          headers: { 
            Accept: 'application/json' 
          },
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error(`   ❌ Benzinga API error for query ${queryIndex + 1}: ${response.status} ${response.statusText}`);
          if (errorText) {
            console.error(`   Error details: ${errorText.substring(0, 300)}`);
          }
          continue; // Skip this query and continue with next
        }

        const data = await response.json() as any;
        
        // Handle Benzinga API v2 response format
        // Response can be: { news: [...] } or direct array
        let prs: any[] = [];
        if (data && typeof data === 'object') {
          if (Array.isArray(data)) {
            prs = data;
          } else if (data.news && Array.isArray(data.news)) {
            prs = data.news;
          } else if (data.data && Array.isArray(data.data)) {
            prs = data.data;
          }
        }
        
        if (initialLoad) {
          // Initial load: Filter to only PRs from past 36 hours
          console.log(`   🔍 Query ${queryIndex + 1}/3: Filtering ${prs.length} PRs to past 36 hours...`);
          
          // Debug: Show sample dates
          if (prs.length > 0 && prs[0].created) {
            const sampleDate = prs[0].created;
            console.log(`   📅 Sample PR date format: ${typeof sampleDate}, value: ${sampleDate}`);
          }
          
          const recentPRs = prs.filter(isWithin36Hours);
          const filteredOut = prs.length - recentPRs.length;
          
          if (filteredOut > 0) {
            console.log(`   ⚠️  Filtered out ${filteredOut} PRs older than 36 hours`);
            // Show date range
            if (prs.length > 0) {
              try {
                const oldestPR = prs[prs.length - 1];
                let oldestDate: Date | null = null;
                if (oldestPR.created) {
                  if (typeof oldestPR.created === 'string') {
                    oldestDate = new Date(oldestPR.created);
                  } else if (typeof oldestPR.created === 'number') {
                    oldestDate = oldestPR.created > 1000000000000 
                      ? new Date(oldestPR.created) 
                      : new Date(oldestPR.created * 1000);
                  }
                  if (oldestDate && !isNaN(oldestDate.getTime())) {
                    const hoursAgo = (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60);
                    console.log(`   📅 Oldest PR in batch: ${hoursAgo.toFixed(1)} hours ago`);
                  }
                }
              } catch (e) {}
            }
          }
          
          console.log(`   ✅ Query ${queryIndex + 1}/3: Found ${recentPRs.length} PRs from past 36 hours (initial load)`);
          allPRs.push(...recentPRs);
        } else {
          // Regular scan: Filter to only PRs from past 48 hours
          const recentPRs = prs.filter(isWithin48Hours);
          console.log(`   ✅ Query ${queryIndex + 1}/3: Found ${recentPRs.length} PRs from past 48 hours`);
          allPRs.push(...recentPRs);
        }
        
        // Small delay between queries
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`   ⚠️  Error fetching PRs for query ${queryIndex + 1}:`, error);
      }
    }
    
    console.log(`   📊 Summary: Fetched ${allPRs.length} PRs total`);
    
    // Fallback: If no PRs found in time window, fetch 10 latest from past 7 days
    if (allPRs.length === 0) {
      console.log(`   ⚠️  No PRs found in time window, falling back to fetch 10 latest PRs from past 7 days...`);
      
      const fallbackPRs: any[] = [];
      
      for (let queryIndex = 0; queryIndex < PR_AUTO_SCAN_TICKER_LISTS.length; queryIndex++) {
        const tickerList = PR_AUTO_SCAN_TICKER_LISTS[queryIndex];
        try {
          console.log(`   📥 Fallback Query ${queryIndex + 1}/3: Fetching PRs for ${tickerList.split(',').length} tickers (no time filter)...`);
          
          const url = `${BZ_NEWS_URL}?pageSize=100&displayOutput=full&token=${prApiKey}&tickers=${encodeURIComponent(tickerList)}&page=0&fields=headline,title,created,body,url,channels,teaser&accept=application/json&channels=Press Releases`;
          
          const response = await fetch(url, {
            headers: { 
              Accept: 'application/json' 
            },
          });

          if (!response.ok) {
            console.error(`   ❌ Benzinga API error for fallback query ${queryIndex + 1}: ${response.status} ${response.statusText}`);
            continue;
          }

          const data = await response.json() as any;
          
          let prs: any[] = [];
          if (data && typeof data === 'object') {
            if (Array.isArray(data)) {
              prs = data;
            } else if (data.news && Array.isArray(data.news)) {
              prs = data.news;
            } else if (data.data && Array.isArray(data.data)) {
              prs = data.data;
            }
          }
          
          // Filter to past 7 days only
          const recentPRs = prs.filter(isWithin7Days);
          console.log(`   ✅ Fallback Query ${queryIndex + 1}/3: Found ${recentPRs.length} PRs from past 7 days`);
          fallbackPRs.push(...recentPRs);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`   ⚠️  Error in fallback query ${queryIndex + 1}:`, error);
        }
      }
      
      // Sort by date (newest first) and take top 10
      fallbackPRs.sort((a, b) => {
        const dateA = a.created || 0;
        const dateB = b.created || 0;
        return dateB - dateA; // Most recent first
      });
      
      const top10PRs = fallbackPRs.slice(0, 10);
      console.log(`   ✅ Fallback: Selected top 10 PRs from ${fallbackPRs.length} PRs found in past 7 days`);
      allPRs.push(...top10PRs);
    }
    
    if (initialLoad) {
      console.log(`   ✅ Found ${allPRs.length} total recent PRs (initial load)`);
      
      // Store fetched PRs with 'queued' status
      console.log(`   📋 Mapping ${allPRs.length} PRs to prFetchedArticles array...`);
      prFetchedArticles = allPRs.map((pr, idx) => {
        const articleId = getArticleId(pr);
        console.log(`   📋 PR ${idx + 1}/${allPRs.length}: articleId=${articleId}, title="${pr.title?.substring(0, 50)}..."`);
        return {
          articleId: articleId,
          article: pr,
          status: 'queued' as const
        };
      });
      prCurrentlyProcessingIndex = -1;
      console.log(`   📋 ✅ Stored ${prFetchedArticles.length} PRs in queue`);
      console.log(`   📋 Sample PR structure:`, JSON.stringify(prFetchedArticles[0]?.article || {}, null, 2).substring(0, 500));
    } else {
      console.log(`   ✅ Found ${allPRs.length} PRs from past 48 hours`);
    }
    
    // Process new PRs
    let newCount = 0;
    let generatedCount = 0;
    let skippedCount = 0;
    let cardCreationErrors = 0;
    
    console.log(`   🔄 Starting to process ${allPRs.length} PRs...`);
    console.log(`   🔄 prProcessedArticles.size: ${prProcessedArticles.size}`);
    console.log(`   📋 TRELLO_LIST_ID_PR: ${process.env.TRELLO_LIST_ID_PR || 'NOT SET'}`);
    console.log(`   📋 TRELLO_LIST_ID: ${process.env.TRELLO_LIST_ID || 'NOT SET'}`);
    
    for (let i = 0; i < allPRs.length; i++) {
      const pr = allPRs[i];
      const prId = getArticleId(pr);
      
      // Skip if already processed
      if (prProcessedArticles.has(prId)) {
        skippedCount++;
        if (i < 5 || i % 50 === 0) {
          console.log(`   ⏭️  Skipping already processed PR ${i + 1}/${allPRs.length}: ${pr.title?.substring(0, 40)}...`);
        }
        continue;
      }
      
      console.log(`   🔄 Processing new PR ${i + 1}/${allPRs.length}: ${pr.title?.substring(0, 50)}...`);
      
      newCount++;
      
      // Mark as processed
      prProcessedArticles.set(prId, {
        id: prId,
        processedAt: Date.now()
      });
      
      // Update status to 'generating' if this is initial load
      if (initialLoad) {
        const fetchedIndex = prFetchedArticles.findIndex(f => f.articleId === prId);
        console.log(`   🔍 Looking for PR in queue: prId=${prId}, foundIndex=${fetchedIndex}`);
        if (fetchedIndex >= 0) {
          prFetchedArticles[fetchedIndex].status = 'generating';
          prFetchedArticles[fetchedIndex].startedAt = Date.now();
          prCurrentlyProcessingIndex = fetchedIndex;
          console.log(`   🔄 [${fetchedIndex + 1}/${prFetchedArticles.length}] Now creating Trello card: ${pr.title?.substring(0, 50)}...`);
          console.log(`   🔄 Updated prFetchedArticles[${fetchedIndex}].status to 'generating'`);
        } else {
          console.log(`   ⚠️  PR not found in prFetchedArticles queue: ${prId}`);
        }
      }
      
      // Always create Trello cards (article generation is manual via Trello link)
      // Define title early so it's available in error handling
      const prTitle = pr.title || pr.headline || 'Untitled Press Release';
      
      console.log(`   📝 Creating Trello card for PR: "${prTitle.substring(0, 60)}..."`);
      
      try {
        // Extract ticker from PR
        let prTicker: string | null = null;
        console.log(`   🔍 Extracting ticker from PR...`);
        if (pr.stocks && Array.isArray(pr.stocks) && pr.stocks.length > 0) {
          const firstStock = pr.stocks[0];
          if (typeof firstStock === 'string') {
            prTicker = firstStock.toUpperCase().trim();
          } else if (typeof firstStock === 'object' && firstStock !== null) {
            const tickerStr = (firstStock as any).ticker || (firstStock as any).symbol || (firstStock as any).name || '';
            if (tickerStr) {
              prTicker = String(tickerStr).toUpperCase().trim();
            }
          }
        }
        
        // Create pitch from PR - robust date parsing
        let dateStr = 'Date not available';
        if (pr.created) {
          try {
            let date: Date;
            if (typeof pr.created === 'string') {
              // Try parsing as ISO string or date string
              date = new Date(pr.created);
            } else if (typeof pr.created === 'number') {
              // If it's already in milliseconds, use as-is; otherwise assume seconds
              date = pr.created > 1000000000000 ? new Date(pr.created) : new Date(pr.created * 1000);
            } else {
              date = new Date(pr.created);
            }
            
            if (!isNaN(date.getTime())) {
              dateStr = date.toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
            }
          } catch (dateError) {
            console.error(`   ⚠️  Error parsing date for PR: ${dateError}`);
            dateStr = 'Date not available';
          }
        }
        
        // Add ticker prefix to title if available (format: "TICKER... Title")
        let title = prTitle;
        if (prTicker) {
          title = `${prTicker}... ${prTitle}`;
        }
        
        const body = pr.body || pr.teaser || '';
        const summary = pr.teaser || (body ? body.substring(0, 500) : 'No summary available');
        const sourceUrl = pr.url || 'No URL available';
        
        const pitch = `Proposed Article: ${prTitle}

Source: Benzinga Press Release
Published: ${dateStr}
${prTicker ? `Company Ticker: ${prTicker}` : ''}

Executive Summary:
${summary}

Proposed Angle: Analyze the implications of this press release${prTicker ? ` for ${prTicker} investors` : ''} and the broader market.`;
        
        console.log(`   📌 Creating Trello card for PR: ${title.substring(0, 50)}... ${prTicker ? `(${prTicker})` : ''}`);
        console.log(`   📋 Card details:`);
        console.log(`      - Title: ${title.substring(0, 60)}...`);
        console.log(`      - Ticker: ${prTicker || 'None'}`);
        console.log(`      - Date: ${dateStr}`);
        console.log(`      - Summary length: ${summary.length} chars`);
        console.log(`      - URL: ${sourceUrl.substring(0, 60)}...`);
        
        // Log PR fields that might contain images/attachments (for debugging)
        const imageFields = ['imageUrl', 'image_url', 'coverImage', 'cover_image', 'image', 'thumbnail', 'thumbnailUrl', 'attachments'];
        const foundImageFields = imageFields.filter(field => pr[field]);
        if (foundImageFields.length > 0) {
          console.log(`   🖼️  PR has image/attachment fields: ${foundImageFields.join(', ')}`);
          foundImageFields.forEach(field => {
            console.log(`      - ${field}: ${typeof pr[field] === 'string' ? pr[field].substring(0, 80) : JSON.stringify(pr[field]).substring(0, 80)}`);
          });
        }
        
        // Import Trello service
        console.log(`   🔄 Importing TrelloService...`);
        const { TrelloService } = await import("./trello-service");
        const trello = new TrelloService();
        // Use PR-specific list ID if set, otherwise fall back to default
        const listId = process.env.TRELLO_LIST_ID_PR || process.env.TRELLO_LIST_ID;
        
        console.log(`   📋 Trello List ID: ${listId || 'NOT SET'}`);
        if (!listId) {
          console.error(`   ❌ TRELLO_LIST_ID or TRELLO_LIST_ID_PR not set. Skipping PR "${title.substring(0, 50)}..."`);
          console.error(`   💡 Add TRELLO_LIST_ID_PR or TRELLO_LIST_ID to .env.local`);
          continue;
        }
        
        // Create Trello card with "Generate Article" link
        // PR articles use the "story" generator, so include selectedApp=story in the link
        const baseUrl = process.env.APP_URL || 'http://localhost:3001';
        const generateArticleUrl = `${baseUrl}/trello/generate-article/{cardId}?selectedApp=story`;
        console.log(`   🔗 Generate Article URL: ${generateArticleUrl}`);
        
        console.log(`   🔄 Calling trello.createCardFromNewsWithGenerateLink()...`);
        const card = await trello.createCardFromNewsWithGenerateLink(
          listId,
          title,
          summary,
          sourceUrl,
          generateArticleUrl,
          {
            ticker: prTicker || undefined,
            date: dateStr,
            pitch: pitch,
            prId: prId
          },
          pr // Store full PR data in card description
        );
        
        console.log(`   ✅ Trello card created successfully!`);
        console.log(`      - Card URL: ${card.url}`);
        console.log(`      - Card ID: ${card.id}`);
        console.log(`      - Card Name: ${card.name?.substring(0, 60) || 'N/A'}...`);
        
        // Check if PR has image URL and attach it to the card
        const imageUrl = pr.imageUrl || pr.image_url || pr.coverImage || pr.cover_image || pr.image || null;
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
          console.log(`   🖼️  PR has image URL: ${imageUrl.substring(0, 60)}...`);
          try {
            // Download image and attach to card
            const imageResponse = await fetch(imageUrl);
            if (imageResponse.ok) {
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              const imageFilename = imageUrl.split('/').pop() || 'pr-image.jpg';
              const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
              
              await trello.attachFileToCard(
                card.id,
                imageBuffer,
                imageFilename,
                contentType
              );
              console.log(`   ✅ Attached image to Trello card: ${imageFilename} (${imageBuffer.length} bytes)`);
            } else {
              console.warn(`   ⚠️  Could not download image: ${imageResponse.status} ${imageResponse.statusText}`);
            }
          } catch (imageError: any) {
            console.warn(`   ⚠️  Error attaching image to card:`, imageError.message);
            // Continue even if image attachment fails - card is still created
          }
        } else {
          console.log(`   ℹ️  PR has no image URL to attach`);
        }
        
        // Store mapping of card ID to PR data for later article generation
        // We'll store this in a Map for quick lookup
        if (!trelloCardToPR) {
          trelloCardToPR = new Map();
        }
        trelloCardToPR.set(card.id, pr);
        
        // Update status to 'completed' (card created) if this is initial load
        if (initialLoad) {
          const fetchedIndex = prFetchedArticles.findIndex(f => f.articleId === prId);
          if (fetchedIndex >= 0) {
            prFetchedArticles[fetchedIndex].status = 'completed';
            prFetchedArticles[fetchedIndex].trelloCardUrl = card.url;
            prFetchedArticles[fetchedIndex].completedAt = Date.now();
            console.log(`   ✅ [${fetchedIndex + 1}/${prFetchedArticles.length}] Card created: ${title.substring(0, 50)}...`);
          }
        }
        
        generatedCount++;
        console.log(`   ✅ Successfully created Trello card ${generatedCount}/${newCount} for PR: ${title.substring(0, 50)}...`);
        
  } catch (error: any) {
        cardCreationErrors++;
        const errorTitle = prTitle || pr?.title || 'Unknown PR';
        console.error(`   ❌ [${cardCreationErrors}] Error creating Trello card for PR "${errorTitle.substring(0, 50)}...":`, error);
        console.error(`   ❌ Error details:`, error.message);
        console.error(`   ❌ Error stack:`, error.stack);
        
        // Update status to 'failed' if this is initial load
        if (initialLoad) {
          const fetchedIndex = prFetchedArticles.findIndex(f => f.articleId === prId);
          console.log(`   🔍 Looking for failed PR in queue: prId=${prId}, foundIndex=${fetchedIndex}`);
          if (fetchedIndex >= 0) {
            prFetchedArticles[fetchedIndex].status = 'failed';
            prFetchedArticles[fetchedIndex].error = error.message;
            prFetchedArticles[fetchedIndex].completedAt = Date.now();
            console.log(`   ❌ [${fetchedIndex + 1}/${prFetchedArticles.length}] Failed: ${pr.title?.substring(0, 50)}...`);
            console.log(`   ❌ Error message: ${error.message}`);
            console.log(`   ❌ Updated prFetchedArticles[${fetchedIndex}].status to 'failed'`);
          } else {
            console.log(`   ⚠️  Failed PR not found in prFetchedArticles queue: ${prId}`);
          }
        }
      }
    }
    
    if (initialLoad) {
      console.log(`\n📊 PR AUTO-SCAN Initial Load Summary:`);
      console.log(`   📊 New PRs processed: ${newCount}`);
      console.log(`   📊 Articles generated: ${generatedCount}`);
      console.log(`   📊 Total generated articles: ${prGeneratedArticles.length}`);
      console.log(`   📊 Processing Summary:`);
      console.log(`      - Total PRs fetched: ${allPRs.length}`);
      console.log(`      - New PRs to process: ${newCount}`);
      console.log(`      - Already processed (skipped): ${skippedCount}`);
      console.log(`      - Trello cards created: ${generatedCount}${cardCreationErrors > 0 ? ` (${cardCreationErrors} errors)` : ''}`);
      console.log(`   📊 PRs in queue: ${prFetchedArticles.length}`);
      console.log(`   📊 Currently processing index: ${prCurrentlyProcessingIndex}`);
      console.log(`   📊 Queue status breakdown:`);
      const statusCounts: Record<string, number> = {};
      prFetchedArticles.forEach(item => {
        statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`      ${status}: ${count}`);
      });
    } else {
      console.log(`\n📊 PR AUTO-SCAN Regular Scan Summary:`);
      console.log(`   📊 New PRs found: ${newCount}`);
      console.log(`   📊 Articles generated: ${generatedCount}`);
      console.log(`   📊 Total generated articles: ${prGeneratedArticles.length}`);
    }
    
  } catch (error: any) {
    console.error("\n❌ PR AUTO-SCAN: Fatal Error:", error);
    console.error("❌ PR AUTO-SCAN: Error message:", error.message);
    console.error("❌ PR AUTO-SCAN: Error stack:", error.stack);
  }
}

const PORT = parseInt(process.env.PORT || '3001', 10);

// Function to check and kill process on port if needed (more aggressive)
async function ensurePortIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // On Windows, use the kill-port.ps1 script which is more aggressive
      const killPortScript = join(process.cwd(), 'kill-port.ps1');
      const killCmd = `powershell -ExecutionPolicy Bypass -File "${killPortScript}"`;
      
      exec(killCmd, (killError: any, killStdout: string, killStderr: string) => {
        if (killStdout) {
          console.log(`   ${killStdout.trim().split('\n').join('\n   ')}`);
        }
        
        // Wait a moment for Windows to release the port
        setTimeout(() => {
          // Test if port is actually free now
          const testServer = createServer();
          testServer.once('error', (testErr: any) => {
            testServer.close();
            resolve(false); // Still in use
          });
          testServer.once('listening', () => {
            testServer.close();
            resolve(true); // Port is free
          });
          testServer.listen(port, '127.0.0.1');
        }, 1500);
      });
    } else {
      // Unix/Linux: Use lsof to check and kill process (force kill)
      exec(`lsof -ti:${port}`, (checkError: any) => {
        if (checkError !== null) {
          // No process found, port is free
          resolve(true);
          return;
        }
        
        // Process found, force kill it
        exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, (error: any) => {
          setTimeout(() => {
            exec(`lsof -ti:${port}`, (finalCheckError: any) => {
              // If finalCheckError is not null, it means no process found (port is free)
              resolve(finalCheckError !== null);
            });
          }, 500);
        });
      });
    }
  });
}

// Function to setup graceful shutdown handlers
function setupGracefulShutdown(server: any) {
  let isShuttingDown = false;
  
  const shutdown = (signal: string) => {
    if (isShuttingDown) {
      console.log(`\n⚠️  Already shutting down, forcing exit...`);
      process.exit(1);
      return;
    }
    isShuttingDown = true;
    
    console.log(`\n\n⚠️  Received ${signal}. Shutting down gracefully...`);
    console.log(`   Closing server and cleaning up...`);
    
    // Stop any running intervals
    if (autoScanInterval) {
      clearInterval(autoScanInterval);
      autoScanInterval = null;
      console.log(`   ✅ Stopped auto-scan interval`);
    }
    if (prAutoScanInterval) {
      clearInterval(prAutoScanInterval);
      prAutoScanInterval = null;
      console.log(`   ✅ Stopped PR auto-scan interval`);
    }
    
    // Stop auto button checker
    stopAutoButtonCheck();
    
    // Stop WGO control card monitor
    stopWGOControlCardMonitor();
    
    // Close server with timeout
    server.close(() => {
      console.log(`   ✅ Server closed gracefully`);
      console.log(`   ✅ Exiting cleanly (port should be released)`);
      process.exit(0);
    });
    
    // Force exit after 5 seconds if server doesn't close
    setTimeout(() => {
      console.log(`   ⚠️  Server didn't close in time, forcing exit...`);
      process.exit(1);
    }, 5000);(() => {
      console.log('✅ Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 5 seconds if it doesn't close gracefully
    setTimeout(() => {
      console.error('⚠️  Forcing shutdown...');
      process.exit(1);
    }, 5000);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Start server with automatic port cleanup
async function startServer() {
  // Kill any existing processes on the port (kill-port script should have done this, but double-check)
  console.log(`🔍 Checking port ${PORT}...`);
  
  // Aggressive attempt to kill any processes using the port
  const portFreed = await ensurePortIsFree(PORT);
  if (portFreed) {
    console.log(`   ✅ Port ${PORT} is free`);
  } else {
    console.log(`   ⚠️  Port ${PORT} may still be in use, will attempt to bind anyway...`);
  }
  
  // Additional delay to allow Windows to fully release the port
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxBindAttempts = 3;
    
    function tryBind() {
      attempts++;
      
      // Create server - Node.js should set SO_REUSEADDR by default, but on Windows
      // we need to ensure we can bind even if port is in TIME_WAIT state
      const http = require('http');
      const server = http.createServer(app);
      
      // Set SO_REUSEADDR via socket options (allows reusing port even if in TIME_WAIT)
      // Access socket before listening to set options
      server.on('listening', () => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🚀 API Server running on http://localhost:${PORT}`);
        console.log(`📄 Dashboard available at: http://localhost:${PORT}/`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`${'='.repeat(60)}\n`);
        console.log("📝 Waiting for requests...\n");
        
        // Start automatic button checker for manual cards
        startAutoButtonCheck();
        
        // Start WGO control card comment monitor
        // DISABLED: WGO is manually triggered via comments, no need for constant polling
        // startWGOControlCardMonitor();
        
        // Start email analyst agent polling if EMAIL_CHECK_INTERVAL is set
        const emailCheckInterval = process.env.EMAIL_CHECK_INTERVAL;
        if (emailCheckInterval) {
          const intervalMinutes = parseInt(emailCheckInterval);
          if (!isNaN(intervalMinutes) && intervalMinutes > 0) {
            console.log(`\n📧 Starting email analyst agent polling (checks every ${intervalMinutes} minutes)...`);
            
            // Run immediately on startup
            setTimeout(async () => {
              try {
                console.log(`\n📧 [AUTO] Running initial email check...`);
                const threadId = `email_analyst_${Date.now()}`;
                const config = { configurable: { thread_id: threadId } };
                
                console.log(`   🔄 Invoking email analyst graph with thread ID: ${threadId}`);
                const result = await emailAnalystGraph.invoke({}, config);
                console.log(`   ✅ Graph invocation completed`);
                
                const state = await emailAnalystGraph.getState(config);
                console.log(`   📊 Final state:`, {
                  emailMessagesCount: (state.values.emailMessages || []).length,
                  extractedNotesCount: (state.values.extractedNotes || []).length,
                  trelloCardsCount: (state.values.trelloCards || []).length,
                });
                
                const trelloCards = state.values.trelloCards || [];
                const extractedNotes = state.values.extractedNotes || [];
                
                console.log(`   ✅ Initial email check completed`);
                console.log(`   📧 Processed ${extractedNotes.length} email(s)`);
                console.log(`   📌 Created ${trelloCards.length} Trello card(s)`);
                
                if (trelloCards.length === 0 && extractedNotes.length > 0) {
                  console.error(`   ⚠️  WARNING: ${extractedNotes.length} notes extracted but 0 cards created!`);
                  console.error(`   ⚠️  This suggests the trello_cards node did not execute or failed silently.`);
                }
              } catch (error: any) {
                console.error(`   ❌ Error in initial email check:`, error);
                console.error(`   ❌ Error stack:`, error.stack);
              }
            }, 5000); // Wait 5 seconds after server starts
            
            // Then check at the specified interval
            setInterval(async () => {
              try {
                console.log(`\n📧 [AUTO] Running scheduled email check...`);
                const threadId = `email_analyst_${Date.now()}`;
                const config = { configurable: { thread_id: threadId } };
                
                console.log(`   🔄 Invoking email analyst graph with thread ID: ${threadId}`);
                const result = await emailAnalystGraph.invoke({}, config);
                console.log(`   ✅ Graph invocation completed`);
                
                const state = await emailAnalystGraph.getState(config);
                const trelloCards = state.values.trelloCards || [];
                const extractedNotes = state.values.extractedNotes || [];
                
                console.log(`   ✅ Email check completed`);
                console.log(`   📧 Processed ${extractedNotes.length} email(s)`);
                console.log(`   📌 Created ${trelloCards.length} Trello card(s)`);
                
                if (trelloCards.length === 0 && extractedNotes.length > 0) {
                  console.error(`   ⚠️  WARNING: ${extractedNotes.length} notes extracted but 0 cards created!`);
                  console.error(`   ⚠️  This suggests the trello_cards node did not execute or failed silently.`);
                }
              } catch (error: any) {
                console.error(`   ❌ Error in email check:`, error);
                console.error(`   ❌ Error stack:`, error.stack);
              }
            }, intervalMinutes * 60 * 1000); // Convert minutes to milliseconds
          } else {
            console.warn(`   ⚠️  EMAIL_CHECK_INTERVAL is set but invalid: ${emailCheckInterval}`);
          }
        } else {
          console.log(`   💡 Set EMAIL_CHECK_INTERVAL in .env.local to enable automatic email checking`);
        }
        
        // Auto-start PR auto-scan if enabled
        if (process.env.AUTO_START_PR_SCAN === 'true') {
          console.log(`\n🚀 Auto-starting PR auto-scan (AUTO_START_PR_SCAN=true)...`);
          // Use setTimeout to ensure server is fully ready
          setTimeout(async () => {
            try {
              const prApiKey = process.env.BENZINGA_PR_API_KEY;
              const trelloListId = process.env.TRELLO_LIST_ID_PR || process.env.TRELLO_LIST_ID;
              
              if (prApiKey && trelloListId && process.env.TRELLO_API_KEY && process.env.TRELLO_TOKEN) {
                // Directly start PR auto-scan instead of making HTTP request
                console.log(`   ✅ All required environment variables present, starting PR auto-scan...`);
                
                // Stop existing PR scan if running
                if (prAutoScanInterval) {
                  console.log(`   🔄 Stopping existing PR auto-scan interval...`);
                  clearInterval(prAutoScanInterval);
                  prAutoScanInterval = null;
                }
                
                prAutoScanActive = true;
                prAutoScanMode = 'auto';
                console.log(`   ✅ prAutoScanActive set to: ${prAutoScanActive}`);
                console.log(`   ✅ prAutoScanMode set to: ${prAutoScanMode}`);
                
                // Calculate total tickers (PR_AUTO_SCAN_TICKER_LISTS is already defined at the top of the file)
                const totalTickers = PR_AUTO_SCAN_TICKER_LISTS.reduce((sum, list) => sum + list.split(',').length, 0);
                console.log(`   📊 Total tickers: ${totalTickers}`);
                console.log(`   📋 Ticker lists: ${PR_AUTO_SCAN_TICKER_LISTS.length}`);
                console.log(`   🎯 Mode: auto`);
                console.log(`   📌 Output: Creating Trello cards in list: ${trelloListId}`);
                console.log(`   ⏰ Check interval: 5 minutes`);
                console.log(`   📥 Step 1: Running initial scan (fetching PRs from past 36 hours)...`);
                
                // Step 1: Run initial scan with PRs from past 36 hours
                console.log(`   🔄 Calling runPRAutoScan(true)...`);
                await runPRAutoScan(true); // true = initial load mode (36-hour filter)
                console.log(`   ✅ Initial scan completed`);
                
                console.log(`   📥 Step 2: Setting up interval for regular scanning (every 5 minutes)...`);
                
                // Step 2: Set up interval to check every 5 minutes (with 48-hour filter)
                prAutoScanInterval = setInterval(async () => {
                  console.log(`\n⏰ PR AUTO-SCAN: Interval triggered (prAutoScanActive: ${prAutoScanActive})`);
                  if (prAutoScanActive) {
                    console.log(`   ✅ prAutoScanActive is true, running scan...`);
                    try {
                      await runPRAutoScan(false); // false = regular scan mode
                    } catch (intervalError: any) {
                      console.error(`   ❌ Error in PR auto-scan interval:`, intervalError);
                      console.error(`   ❌ Error message:`, intervalError.message);
                      console.error(`   ❌ Error stack:`, intervalError.stack);
                    }
                  } else {
                    console.log(`   ⚠️  prAutoScanActive is false, skipping scan`);
                  }
                }, 5 * 60 * 1000); // 5 minutes
                
                console.log(`   ✅ PR auto-scan interval set up successfully`);
                console.log(`   ✅ PR Auto-Scan is now RUNNING`);
              } else {
                console.warn(`   ⚠️  PR auto-scan not auto-started: missing required environment variables`);
                console.warn(`   ⚠️  Required: BENZINGA_PR_API_KEY, TRELLO_LIST_ID_PR (or TRELLO_LIST_ID), TRELLO_API_KEY, TRELLO_TOKEN`);
              }
            } catch (error: any) {
              console.error(`   ❌ Error auto-starting PR auto-scan:`, error);
              console.error(`   ❌ Error message:`, error.message);
              console.error(`   ❌ Error stack:`, error.stack);
            }
          }, 2000); // Wait 2 seconds for server to be fully ready
        }
        
        // Setup graceful shutdown handlers
        setupGracefulShutdown(server);
        
        resolve(server);
      });
      
      // Handle server errors (like port already in use)
      server.on('error', async (error: any) => {
        if (error.code === 'EADDRINUSE') {
          if (attempts < maxBindAttempts) {
            console.log(`   ⚠️  Port ${PORT} in use (attempt ${attempts}/${maxBindAttempts})`);
            console.log(`   💡 This could be TIME_WAIT state (normal after stopping server)`);
            console.log(`   🔄 Attempting to kill process and retry...`);
            
            // Try to kill the process again (in case it's actually still running)
            await ensurePortIsFree(PORT);
            
            // Wait progressively longer on each retry (TIME_WAIT can last 30-240 seconds)
            const waitTime = attempts * 2000; // 2s, 4s, 6s
            console.log(`   ⏳ Waiting ${waitTime/1000}s for port to be released...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Retry binding (with SO_REUSEADDR, this should work even in TIME_WAIT)
            tryBind();
          } else {
            console.error(`\n❌ Port ${PORT} is still in use after ${maxBindAttempts} attempts.`);
            console.error(`\n💡 This usually means:`);
            console.error(`   1. Another process is actively using the port, OR`);
            console.error(`   2. The port is in TIME_WAIT state (wait 30-240 seconds)`);
            console.error(`\n   Try:`);
            console.error(`   npm run kill-port`);
            console.error(`   # Wait 5 seconds, then:`);
            console.error(`   npm run dev`);
            reject(error);
          }
        } else {
          console.error('❌ Server error:', error);
          reject(error);
        }
      });
      
      // Start listening - on Windows, we'll use a workaround to handle TIME_WAIT
      // If binding fails, we'll retry with exponential backoff
      // Note: Node.js sets SO_REUSEADDR by default, but Windows TIME_WAIT can still cause issues
      server.listen(PORT, '0.0.0.0', () => {
        // Success callback - server is listening
      });
    }
    
    // Start the first bind attempt
    tryBind();
  });
}

// Start the server - shutdown handlers are set up in setupGracefulShutdown()
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

