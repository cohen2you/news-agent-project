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

// 1. Define the "Brain" (State) of the Agent
// This tracks the data as it moves between nodes.
const AgentState = Annotation.Root({
  topic: Annotation<string>,       // What to search for
  prOnly: Annotation<boolean>,     // Whether to search PRs only
  pitch: Annotation<string>,       // The generated pitch
  newsArticles: Annotation<any[]>, // News articles found (for WGO with news)
  selectedArticle: Annotation<any>, // The specific article selected by user (can override pitch article)
  humanFeedback: Annotation<string>, // "Approve" or "Reject" + notes
  selectedApp: Annotation<string>,  // Which article generation app to use
  manualTicker: Annotation<string>,  // Manual ticker input for WGO when no ticker is detected
  finalArticle: Annotation<string>,  // The output from your app
});

// 2. Define the Nodes (The Workers)

// NODE A: The Analyst
// Scans Benzinga news and creates a pitch.
const analystNode = async (state: typeof AgentState.State) => {
  const searchType = state.prOnly ? 'press releases' : 'news';
  console.log(`\n🕵️  ANALYST: Scanning ${searchType} for "${state.topic}"...`);
  
  // Use PR API key if prOnly is true, otherwise use regular API key
  const usePRKey = state.prOnly === true;
  const benzingaApiKey = usePRKey 
    ? process.env.BENZINGA_PR_API_KEY 
    : process.env.BENZINGA_API_KEY;
  
  if (benzingaApiKey) {
    try {
      // Use Benzinga API to fetch real news or press releases
      const result = await generatePitchFromBenzinga(state.topic, benzingaApiKey, usePRKey);
      // generatePitchFromBenzinga returns { pitch, articles, selectedArticle }
      // Map to match state annotation
      return {
        pitch: result.pitch,
        newsArticles: result.articles || [],
        selectedArticle: result.selectedArticle || null
      };
    } catch (error) {
      console.error("Error fetching from Benzinga:", error);
      // Fallback to mock pitch if API fails
    }
  } else {
    const keyName = usePRKey ? "BENZINGA_PR_API_KEY" : "BENZINGA_API_KEY";
    console.warn(`⚠️  ${keyName} not set. Using mock pitch.`);
  }
  
  // Fallback mock pitch if no API key or API fails
  // Word count will be determined by the selected app's prompts
  const pitch = `Proposed Article: Why ${state.topic} is booming in 2025. 

Angle: Focus on the new tech stack.`;
  
  return { pitch, newsArticles: [], selectedArticle: null };
};

// NODE B: Human Approval (The Logic)
// This node triggers the interrupt. 
const humanReviewNode = async (state: typeof AgentState.State) => {
  console.log("\n✋  SYSTEM: Pausing for Human Review.");
  console.log(`   Current Pitch: ${state.pitch}`);

  // INTERRUPT: The graph stops here and saves state to the Checkpointer.
  // If humanFeedback doesn't exist yet, pause and wait for human input.
  if (!state.humanFeedback || state.humanFeedback === "") {
    interrupt({
      query: "Do you approve this pitch?",
      pitch: state.pitch
    });
    // Execution stops here until resumed
    return {};
  }

  // If we have feedback (resumed), continue
  console.log(`   Received feedback: ${state.humanFeedback}`);
  return {};
};

// NODE C: Trello Pitch (Create Trello Card)
// Creates a Trello card instead of immediately generating articles
const trelloPitchNode = async (state: typeof AgentState.State) => {
  console.log(`\n📌 TRELLO: Creating pitch card...`);
  
  try {
    const trello = new TrelloService();
    // Use WGO-specific list ID if set, otherwise fall back to default
    // This allows different agents to use different Trello lists
    const listId = process.env.TRELLO_LIST_ID_WGO || process.env.TRELLO_LIST_ID;
    
    if (!listId) {
      console.error("❌ TRELLO_LIST_ID or TRELLO_LIST_ID_WGO not set in environment variables");
      return { finalArticle: "Error: TRELLO_LIST_ID not configured" };
    }

    // Extract headline from pitch (first line usually contains it)
    const pitchLines = state.pitch.split('\n');
    const headline = pitchLines[0]?.replace('Proposed Article:', '').trim() || state.topic || 'Untitled Story';
    
    // Build summary from pitch
    const summary = state.pitch || 'No summary available';
    
    // Get source URL from selected article if available
    const selectedArticle = state.selectedArticle || (state.newsArticles && state.newsArticles.length > 0 ? state.newsArticles[0] : null);
    const sourceUrl = selectedArticle?.url || selectedArticle?.link || 'No URL available';
    
    // Extract additional info
    const ticker = selectedArticle?.ticker || state.topic || null;
    const date = selectedArticle?.created 
      ? new Date(selectedArticle.created * 1000).toLocaleDateString()
      : new Date().toLocaleDateString();

    // Create Trello card
    const card = await trello.createCardFromNews(
      listId,
      headline,
      summary,
      sourceUrl,
      {
        ticker: ticker,
        date: date,
        topic: state.topic,
        pitch: state.pitch.substring(0, 500) // Include full pitch in additional info
      }
    );

    console.log(`✅ Trello card created: ${card.url}`);
    return { 
      finalArticle: `✅ Story pitched to Trello!\n\nCard: ${headline}\nURL: ${card.url}\n\nYou can review and approve this story in Trello before generating the article.` 
    };
  } catch (error: any) {
    console.error("Error creating Trello card:", error);
    return { 
      finalArticle: `Error creating Trello card: ${error.message}\n\nPlease check your Trello configuration in .env file.` 
    };
  }
};

// NODE D: The Writer (Your External App)
// Only runs if approved (manually triggered from Trello or API)
const writerNode = async (state: typeof AgentState.State) => {
  const feedback = state.humanFeedback; // This will be the value from the interrupt

  if (typeof feedback === 'string' && feedback.toLowerCase().includes("no")) {
    console.log("❌ WRITER: Pitch rejected. Ending process.");
    return { finalArticle: "Rejected" };
  }

  const selectedApp = state.selectedApp || "default";
  console.log(`\n✍️  WRITER: Pitch Approved! Using app: ${selectedApp}`);
  console.log(`   Sending payload to External App...`);
  
  try {
    // Call your existing article generation app with the selected app
    // Pass topic and news articles for better ticker extraction and WGO with news
    const newsArticles = state.newsArticles || [];
    console.log(`   News articles available: ${newsArticles.length}`);
    if (newsArticles.length > 0) {
      console.log(`   First article: ${newsArticles[0].title || newsArticles[0].headline || 'No title'}`);
    }
    
    // Use the user-selected article if available, otherwise use the one from the pitch
    const articleToUse = state.selectedArticle || (newsArticles && newsArticles.length > 0 ? newsArticles[0] : null);
    
    const article = await generateArticle(
      state.pitch, 
      selectedApp,
      state.topic,
      newsArticles,
      articleToUse, // Pass the specific article (user-selected or pitch default)
      state.manualTicker // Pass manual ticker if provided
    );
    return { finalArticle: article };
  } catch (error: any) {
    console.error("Error generating article:", error);
    // Return error message if generation fails
    return { 
      finalArticle: `Error generating article: ${error.message}\n\nPlease check your article generation app configuration in .env file.` 
    };
  }
};

// 3. Build the Graph
// Updated workflow: Analyst -> Trello Pitch -> End
// Trello is used for approval, so articles are generated manually from Trello cards
// Writer node is removed since we use Trello for approval workflow
const workflow = new StateGraph(AgentState)
  .addNode("analyst", analystNode)
  .addNode("trello_pitch", trelloPitchNode)
  .addEdge(START, "analyst")
  .addEdge("analyst", "trello_pitch")
  .addEdge("trello_pitch", END);

// 4. Persistence (Required for pausing)
const checkpointer = new MemorySaver();

export const graph = workflow.compile({ checkpointer });

// ==========================================
// 5. SIMULATION SCRIPT (Run this to test)
// ==========================================
async function runDemo() {
  // A unique thread ID separates different article workflows
  const config = { configurable: { thread_id: "article-job-1" } };

  console.log("--- STARTING WORKFLOW ---");
  
  // STEP 1: Kickoff
  // The graph will run until it hits the 'interrupt' inside humanReviewNode
  await graph.invoke({ topic: "AI Agents" }, config);

  console.log("\n--- ☕ USER IS AWAY (Graph is Paused/Saved) ---");
  
  // In a real app, you would inspect the state here to see what needs approval.
  const snapshot = await graph.getState(config);
  console.log("Current State Status:", snapshot.next); // Should say 'human_review'

  console.log("\n--- 🧑‍💻 USER RETURNS AND APPROVES ---");

  // STEP 2: Resume
  // We send a Command to resume the thread. 
  // The 'resume' value is what the 'interrupt()' function returns to the code.
  await graph.invoke(
    new Command({ resume: "Yes, looks good!" }), 
    config
  );
  
  console.log("\n--- WORKFLOW FINISHED ---");
}

// Uncomment to run directly in terminal:
// runDemo();

