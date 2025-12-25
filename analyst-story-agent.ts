/**
 * Analyst Story Generator Agent
 * Reads analyst notes from Trello cards and generates stories using wiim-project-v2 tools
 */

import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { TrelloService } from "./trello-service";
import { scrapeAnalystNote, generateAnalystStory, AnalystNoteData } from "./analyst-tools-integration";

// Analyst Story Generator Agent State
const AnalystStoryAgentState = Annotation.Root({
  cardId: Annotation<string>,          // Trello card ID
  noteData: Annotation<AnalystNoteData | null>, // Extracted note data from Trello
  extractedData: Annotation<any | null>, // Data from scraping tool
  generatedStory: Annotation<string>,   // Generated story HTML/content
  storyTitle: Annotation<string>,       // Story title
  storyId: Annotation<string | null>,  // Story ID for viewing (generated in updateTrelloNode)
});

// NODE A: Read Trello Card - Extract analyst note data from Trello card
const readTrelloCardNode = async (state: typeof AnalystStoryAgentState.State) => {
  console.log(`\n📋 READ TRELLO CARD: Reading card ${state.cardId}...`);

  try {
    const trello = new TrelloService();
    const cardData = await trello.getCardData(state.cardId);

    // Extract note data from card description
    // The note data is stored as base64-encoded JSON in a code block
    let noteData: AnalystNoteData | null = null;

    // Try noteData first (analyst notes), then prData (for compatibility)
    if (cardData.noteData) {
      noteData = cardData.noteData as AnalystNoteData;
      console.log(`   ✅ Extracted note data from card (noteData field)`);
    } else if (cardData.prData) {
      // For compatibility, also check if stored as prData (same format)
      noteData = cardData.prData as AnalystNoteData;
      console.log(`   ✅ Extracted note data from card (prData field - compatibility)`);
    }

    // If note data not found in metadata, try to parse from description
    if (!noteData) {
      // Fallback: extract from description text
      const firmMatch = cardData.desc.match(/\*\*Firm:\*\* ([^\n]+)/);
      const analystMatch = cardData.desc.match(/\*\*Analyst:\*\* ([^\n]+)/);
      const tickerMatch = cardData.desc.match(/\*\*Ticker:\*\* ([^\n]+)/);
      const dateMatch = cardData.desc.match(/\*\*Date:\*\* ([^\n]+)/);

      noteData = {
        ticker: tickerMatch?.[1]?.trim(),
        firm: firmMatch?.[1]?.trim(),
        analyst: analystMatch?.[1]?.trim(),
        content: cardData.desc.split('---')[0]?.trim() || cardData.desc,
        subject: cardData.name.replace(/^[A-Z]+\\.\\.\\.\s*/, ''), // Remove ticker prefix
        date: dateMatch?.[1] ? new Date(dateMatch[1]) : new Date(),
      };
    }

    // If noteData exists but content is missing (e.g., truncated to minimal), extract from description
    if (noteData && !noteData.content) {
      console.log(`   ⚠️  Note data found but content is missing, extracting from card description...`);
      // Extract content from description (everything before the first "---")
      const contentMatch = cardData.desc.split('---')[0]?.trim();
      if (contentMatch && contentMatch.length > 0) {
        noteData.content = contentMatch;
        console.log(`   ✅ Extracted ${contentMatch.length} characters from card description`);
      }
    }

    if (!noteData || !noteData.content) {
      console.error(`   ❌ Note data:`, noteData ? Object.keys(noteData) : 'null');
      console.error(`   ❌ Card description preview:`, cardData.desc.substring(0, 200));
      throw new Error('Could not extract note data from Trello card');
    }

    console.log(`   ✅ Extracted note: ${noteData.ticker || 'No ticker'} - ${noteData.subject?.substring(0, 50)}...`);

    return {
      noteData: noteData,
    };
  } catch (error: any) {
    console.error('❌ Error reading Trello card:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      cardId: state.cardId
    });
    throw error;
  }
};

// NODE B: Scrape Note - Call scraping tool to extract structured data
const scrapeNoteNode = async (state: typeof AnalystStoryAgentState.State) => {
  console.log(`\n🔍 SCRAPE NOTE: Extracting structured data...`);

  if (!state.noteData) {
    throw new Error('Note data not available for scraping');
  }

  try {
    const extractedData = await scrapeAnalystNote(state.noteData);
    console.log(`   ✅ Extracted data: ${extractedData.ticker || 'N/A'} - ${extractedData.firm || 'N/A'}`);

    return {
      extractedData: extractedData,
    };
  } catch (error: any) {
    console.error('❌ Error scraping note:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      noteData: state.noteData ? {
        ticker: state.noteData.ticker,
        firm: state.noteData.firm,
        hasContent: !!state.noteData.content,
        contentLength: state.noteData.content?.length || 0
      } : 'null'
    });
    throw error;
  }
};

// NODE C: Generate Story - Call story generator tool
const generateStoryNode = async (state: typeof AnalystStoryAgentState.State) => {
  console.log(`\n📝 GENERATE STORY: Generating analyst note story...`);

  if (!state.extractedData) {
    throw new Error('Extracted data not available for story generation');
  }

  try {
    const storyResult = await generateAnalystStory(state.extractedData, state.noteData || undefined);
    console.log(`   ✅ Story generated (${storyResult.story.length} chars)`);

    return {
      generatedStory: storyResult.story,
      storyTitle: storyResult.title || `${state.extractedData.firm || 'Analyst'} Updates ${state.extractedData.ticker || ''}`.trim(),
    };
  } catch (error: any) {
    console.error('❌ Error generating story:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      extractedData: state.extractedData ? {
        ticker: state.extractedData.ticker,
        firm: state.extractedData.firm,
        hasContent: !!state.extractedData.content,
        contentLength: state.extractedData.content?.length || 0
      } : 'null',
      analystBaseUrl: process.env.ANALYST_BASE_URL || 'http://localhost:3002'
    });
    throw error;
  }
};

// NODE D: Update Trello - Update card with generated story
const updateTrelloNode = async (state: typeof AnalystStoryAgentState.State) => {
  console.log(`\n📌 UPDATE TRELLO: Updating card with generated story...`);

  try {
    const trello = new TrelloService();
    
    // Move card to "In Progress" first
    const inProgressListId = process.env.TRELLO_LIST_ID_IN_PROGRESS;
    if (inProgressListId) {
      try {
        await trello.moveCardToList(state.cardId, inProgressListId);
        console.log(`   ✅ Moved card to In Progress list`);
      } catch (moveError: any) {
        console.warn(`   ⚠️  Error moving card to In Progress:`, moveError.message);
      }
    }

    // Get current card data
    const cardData = await trello.getCardData(state.cardId);
    let updatedDesc = cardData.desc || '';

    // Remove "Generate Story" button link
    updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Generate Story\]\([^)]+\)\*\*/g, '');

    // Add generated story section
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const storyId = `analyst_${state.cardId}_${Date.now()}`;
    const storyViewUrl = `${appUrl}/analyst-story/view/${storyId}`;

    updatedDesc += `\n\n---\n\n## ✅ Story Generated\n\n`;
    updatedDesc += `**Title:** ${state.storyTitle}\n\n`;
    updatedDesc += `**View Story:** [View Generated Story](${storyViewUrl})\n\n`;
    updatedDesc += `**Generated:** ${new Date().toLocaleString()}\n`;

    // Update card description
    await trello.updateCardDescription(state.cardId, updatedDesc);
    console.log(`   ✅ Updated Trello card with story link`);
    console.log(`   🔗 Story viewable at: ${storyViewUrl}`);

    // Add comment
    const storyPreview = state.generatedStory.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 500);
    const commentText = `**Story Generated Successfully!**\n\n**Title:** ${state.storyTitle}\n\n**Preview:** ${storyPreview}...\n\n[View Full Story](${storyViewUrl})`;
    
    try {
      await trello.addComment(state.cardId, commentText);
      console.log(`   ✅ Added comment to Trello card`);
    } catch (commentError: any) {
      console.warn(`   ⚠️  Could not add comment:`, commentError.message);
    }

    // Move card to "Submitted" list
    const submittedListId = process.env.TRELLO_LIST_ID_SUBMITTED;
    if (submittedListId) {
      try {
        await trello.moveCardToList(state.cardId, submittedListId);
        console.log(`   ✅ Moved card to Submitted list`);
        
        // Trigger number verification directly (since we moved it programmatically, webhook might not fire)
        const verificationEnabled = process.env.EDITOR_NUMBER_VERIFICATION_ENABLED === 'true';
        if (verificationEnabled && state.generatedStory && state.noteData) {
          console.log(`   🔢 Triggering number verification directly...`);
          (async () => {
            try {
              const { numberVerificationGraph } = await import("./editor-number-verification-agent");
              const verificationThreadId = `verification_${state.cardId}_${Date.now()}`;
              const verificationConfig = { configurable: { thread_id: verificationThreadId } };
              
              await numberVerificationGraph.invoke({
                cardId: state.cardId,
                articleContent: state.generatedStory,
                sourceMaterial: state.noteData,
                verificationStatus: '',
                verificationSummary: '',
                verifiedNumbers: 0,
                discrepancies: [],
                verificationNotes: '',
              }, verificationConfig);
              
              console.log(`   ✅ Number verification completed for card ${state.cardId}`);
            } catch (verifyError: any) {
              console.error(`   ❌ Error in number verification:`, verifyError);
              console.error(`   ❌ Error message: ${verifyError.message}`);
            }
          })();
        } else {
          if (!verificationEnabled) {
            console.log(`   ℹ️  Number verification is disabled (EDITOR_NUMBER_VERIFICATION_ENABLED not set to 'true')`);
          } else {
            console.log(`   ⚠️  Cannot verify: missing story content or note data`);
          }
        }
      } catch (moveError: any) {
        console.warn(`   ⚠️  Error moving card to Submitted:`, moveError.message);
      }
    }

    // Return storyId so it can be stored in server.ts
    return {
      storyId: storyId,
    };
  } catch (error: any) {
    console.error('❌ Error updating Trello:', error);
    throw error;
  }
};

// Build the Analyst Story Generator Agent Graph
const analystStoryWorkflow = new StateGraph(AnalystStoryAgentState)
  .addNode("read_trello_card", readTrelloCardNode)
  .addNode("scrape_note", scrapeNoteNode)
  .addNode("generate_story", generateStoryNode)
  .addNode("update_trello", updateTrelloNode)
  .addEdge(START, "read_trello_card")
  .addEdge("read_trello_card", "scrape_note")
  .addEdge("scrape_note", "generate_story")
  .addEdge("generate_story", "update_trello")
  .addEdge("update_trello", END);

// Persistence
const checkpointer = new MemorySaver();

export const graph = analystStoryWorkflow.compile({ checkpointer });

