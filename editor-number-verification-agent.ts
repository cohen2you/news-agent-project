/**
 * Editor Number Verification Agent
 * Verifies numerical data (percentages, dollar amounts, dates, counts) between
 * source material and generated article. No revisions - only reports discrepancies.
 */

import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { TrelloService } from "./trello-service";

// Editor Number Verification State
const NumberVerificationState = Annotation.Root({
  // Inputs
  cardId: Annotation<string>,                    // Trello card ID
  articleContent: Annotation<string>,            // Generated article HTML/text
  sourceMaterial: Annotation<any>,              // Original PR/news/analyst note
  
  // Verification Results
  verificationStatus: Annotation<string>,        // "verified" | "discrepancies_found" | "error"
  verificationSummary: Annotation<string>,       // Summary of verification
  verifiedNumbers: Annotation<number>,           // Count of matching numbers
  discrepancies: Annotation<string[]>,           // List of discrepancies found (format: "Source: X, Article: Y, Context: ...")
  verificationNotes: Annotation<string>,         // Detailed verification notes
});

// Initialize LLM for number verification
const getVerificationLLM = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set in environment variables");
  }
  
  const model = process.env.EDITOR_LLM_MODEL || "gpt-4-turbo-preview";
  
  return new ChatOpenAI({
    modelName: model,
    temperature: 0, // Low temperature for consistent, factual verification
    openAIApiKey: apiKey,
  });
};

// NODE 1: Verify Numbers - Extracts and compares numbers from source vs article
const verifyNumbersNode = async (state: typeof NumberVerificationState.State) => {
  console.log(`\n🔢 NUMBER VERIFICATION: Checking numbers in article against source...`);
  
  try {
    const llm = getVerificationLLM();
    
    // Format source material for comparison
    let sourceText = '';
    let sourceTitle = '';
    
    if (typeof state.sourceMaterial === 'string') {
      sourceText = state.sourceMaterial;
    } else if (state.sourceMaterial) {
      sourceTitle = state.sourceMaterial.title || state.sourceMaterial.headline || '';
      
      // Build source text - prioritize full body content
      const bodyText = state.sourceMaterial.body || '';
      const contentText = state.sourceMaterial.content || '';
      const teaserText = state.sourceMaterial.teaser || '';
      
      if (bodyText && bodyText.length > 0) {
        sourceText = bodyText;
        console.log(`   📄 Using full body content (${bodyText.length} chars)`);
      } else if (contentText && contentText.length > 0) {
        sourceText = contentText;
        console.log(`   ⚠️  Body not available, using content (${contentText.length} chars)`);
      } else if (teaserText && teaserText.length > 0) {
        sourceText = teaserText;
        console.log(`   ⚠️  Body/content not available, using teaser (${teaserText.length} chars)`);
      }
    }
    
    // Clean article content (remove HTML for comparison)
    const articleText = state.articleContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (!sourceText || sourceText.trim().length === 0) {
      console.warn(`   ⚠️  No source text available for comparison`);
      return {
        verificationStatus: "error",
        verificationSummary: "Unable to verify: Source material not available",
        verifiedNumbers: 0,
        discrepancies: [],
        verificationNotes: "Source material was empty or could not be extracted from the card.",
      };
    }
    
    if (!articleText || articleText.trim().length === 0) {
      console.warn(`   ⚠️  No article text available for comparison`);
      return {
        verificationStatus: "error",
        verificationSummary: "Unable to verify: Article content not available",
        verifiedNumbers: 0,
        discrepancies: [],
        verificationNotes: "Generated article content was empty or could not be extracted.",
      };
    }
    
    // Build verification prompt
    const verificationPrompt = `You are a fact-checker verifying numerical accuracy between a source document and a generated article.

SOURCE MATERIAL:
Title/Headline: ${sourceTitle || 'N/A'}
${sourceText.substring(0, 10000)}${sourceText.length > 10000 ? '... (truncated)' : ''}

GENERATED ARTICLE:
${articleText.substring(0, 8000)}${articleText.length > 8000 ? '... (truncated)' : ''}

TASK: Extract all numerical data from both documents and compare them for accuracy. Focus on:
1. **Dollar amounts** (e.g., $1.2B, $500 million, $50.5M)
2. **Percentages** (e.g., 45%, 12.5%, 3.2 percent)
3. **Counts/Quantities** (e.g., 1,000 units, 25 employees, 10 stores)
4. **Dates** (if mentioned with specific numbers, e.g., "December 2024", "Q3 2025")
5. **Financial metrics** (revenue, earnings, growth rates, etc.)

IMPORTANT:
- Handle different formats: "$1.2B" = "$1.2 billion" = "1.2 billion dollars" (these match)
- Handle rounding: 45.2% vs 45% (these match if close)
- Ignore ordinal numbers (first, second, third) unless they represent a specific count
- Ignore page numbers, section numbers, or formatting numbers
- Only flag actual discrepancies where the numbers don't match

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "status": "verified" | "discrepancies_found",
  "summary": "Brief summary (e.g., 'Verified 15 numbers, all match' or 'Verified 12 numbers, found 2 discrepancies')",
  "verifiedCount": 0,
  "discrepancies": [
    {
      "sourceValue": "exact value from source (e.g., '$1.2B')",
      "articleValue": "exact value from article (e.g., '$2.1B')",
      "context": "brief context about what this number represents (e.g., 'Total revenue for Q4')"
    }
  ],
  "notes": "Detailed notes about the verification process and any patterns noticed"
}`;

    const response = await llm.invoke(verificationPrompt);
    const responseText = response.content.toString();
    
    // Parse JSON response
    let verificationResult: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        verificationResult = JSON.parse(jsonMatch[0]);
      } else {
        verificationResult = JSON.parse(responseText);
      }
    } catch (parseError: any) {
      console.error(`   ⚠️  Error parsing verification response:`, parseError);
      console.error(`   📄 Response text:`, responseText.substring(0, 500));
      return {
        verificationStatus: "error",
        verificationSummary: `Verification error: ${parseError.message}`,
        verifiedNumbers: 0,
        discrepancies: [],
        verificationNotes: `Error parsing verification response: ${parseError.message}`,
      };
    }
    
    // Format discrepancies for display
    const discrepanciesList: string[] = [];
    if (verificationResult.discrepancies && Array.isArray(verificationResult.discrepancies)) {
      verificationResult.discrepancies.forEach((disc: any) => {
        if (disc.sourceValue && disc.articleValue) {
          const context = disc.context ? ` (${disc.context})` : '';
          discrepanciesList.push(`Source: ${disc.sourceValue}, Article: ${disc.articleValue}${context}`);
        }
      });
    }
    
    const status = verificationResult.status === "verified" ? "verified" : 
                   discrepanciesList.length > 0 ? "discrepancies_found" : "verified";
    
    console.log(`   📊 Verification Result: ${status === "verified" ? '✅ VERIFIED' : '⚠️ DISCREPANCIES FOUND'}`);
    console.log(`   🔢 Verified Numbers: ${verificationResult.verifiedCount || 0}`);
    console.log(`   ⚠️  Discrepancies: ${discrepanciesList.length}`);
    
    return {
      verificationStatus: status,
      verificationSummary: verificationResult.summary || `Verified ${verificationResult.verifiedCount || 0} numbers`,
      verifiedNumbers: verificationResult.verifiedCount || 0,
      discrepancies: discrepanciesList,
      verificationNotes: verificationResult.notes || '',
    };
  } catch (error: any) {
    console.error(`   ❌ Error in number verification:`, error);
    return {
      verificationStatus: "error",
      verificationSummary: `Verification error: ${error.message}`,
      verifiedNumbers: 0,
      discrepancies: [],
      verificationNotes: `Error during verification: ${error.message}`,
    };
  }
};

// NODE 2: Update Trello Card - Adds verification results to card description
const updateTrelloCardNode = async (state: typeof NumberVerificationState.State) => {
  console.log(`\n📝 Updating Trello card with number verification results...`);
  
  try {
    const trello = new TrelloService();
    
    // Get current card data
    const cardData = await trello.getCardData(state.cardId);
    let updatedDesc = cardData.desc || '';
    
    // Remove old verification sections if present
    updatedDesc = updatedDesc.replace(/\n\n---\n\n## 🔢 Number Verification[\s\S]*?(?=\n\n---|$)/g, '');
    
    // Extract and preserve PR_DATA or NOTE_DATA blocks
    let preservedMetadata = '';
    const prDataMatch = updatedDesc.match(/```metadata\s*\n\s*PR_DATA:\s*([^\n`]+)\s*\n\s*```/);
    const noteDataMatch = updatedDesc.match(/```metadata\s*\n\s*NOTE_DATA:\s*([^\n`]+)\s*\n\s*```/);
    const oldPrDataMatch = updatedDesc.match(/<!--\s*PR_DATA:\s*([^>]+)\s*-->/);
    const oldNoteDataMatch = updatedDesc.match(/<!--\s*NOTE_DATA:\s*([^>]+)\s*-->/);
    
    if (prDataMatch) {
      preservedMetadata = `\n\n<!-- PR_DATA:${prDataMatch[1]} -->`;
      updatedDesc = updatedDesc.replace(/```metadata[^`]*```/gs, '');
    } else if (oldPrDataMatch) {
      preservedMetadata = `\n\n<!-- PR_DATA:${oldPrDataMatch[1]} -->`;
      updatedDesc = updatedDesc.replace(/<!--\s*PR_DATA:[^>]+-->/g, '');
    } else if (noteDataMatch) {
      preservedMetadata = `\n\n<!-- NOTE_DATA:${noteDataMatch[1]} -->`;
      updatedDesc = updatedDesc.replace(/```metadata[^`]*```/gs, '');
    } else if (oldNoteDataMatch) {
      preservedMetadata = `\n\n<!-- NOTE_DATA:${oldNoteDataMatch[1]} -->`;
      updatedDesc = updatedDesc.replace(/<!--\s*NOTE_DATA:[^>]+-->/g, '');
    }
    
    // Build verification section
    let verificationSection = `\n\n---\n\n## 🔢 Number Verification\n\n`;
    verificationSection += `**Status:** ${state.verificationStatus === "verified" ? '✅ Verified' : state.verificationStatus === "discrepancies_found" ? '⚠️ Discrepancies Found' : '❌ Error'}\n\n`;
    verificationSection += `**Summary:** ${state.verificationSummary}\n\n`;
    verificationSection += `**Verified Numbers:** ${state.verifiedNumbers}\n\n`;
    verificationSection += `**Verified:** ${new Date().toLocaleString()}\n\n`;
    
    if (state.discrepancies && state.discrepancies.length > 0) {
      verificationSection += `### ⚠️ Discrepancies Found\n\n`;
      state.discrepancies.forEach((disc, idx) => {
        verificationSection += `${idx + 1}. ${disc}\n`;
      });
      verificationSection += `\n`;
    }
    
    if (state.verificationNotes) {
      verificationSection += `### 📝 Verification Notes\n\n`;
      verificationSection += `${state.verificationNotes}\n\n`;
    }
    
    // Append verification section
    updatedDesc += verificationSection;
    
    // Re-append preserved metadata
    updatedDesc += preservedMetadata;
    
    // Update card description
    await trello.updateCardDescription(state.cardId, updatedDesc);
    console.log(`   ✅ Updated card description with verification results`);
    
    // Add comment with verification summary
    let commentText = `🔢 **Number Verification Complete**\n\n`;
    commentText += `**Status:** ${state.verificationStatus === "verified" ? '✅ All numbers verified' : state.verificationStatus === "discrepancies_found" ? '⚠️ Discrepancies found' : '❌ Error'}\n\n`;
    commentText += `${state.verificationSummary}\n\n`;
    if (state.discrepancies && state.discrepancies.length > 0) {
      commentText += `**Discrepancies:** ${state.discrepancies.length}\n`;
      state.discrepancies.slice(0, 3).forEach((disc, idx) => {
        commentText += `${idx + 1}. ${disc}\n`;
      });
      if (state.discrepancies.length > 3) {
        commentText += `\n... and ${state.discrepancies.length - 3} more. See card description for full details.`;
      }
    }
    
    try {
      await trello.addComment(state.cardId, commentText);
      console.log(`   ✅ Added verification comment to card`);
    } catch (commentError: any) {
      console.warn(`   ⚠️  Could not add comment:`, commentError.message);
    }
    
    return {};
  } catch (error: any) {
    console.error(`   ❌ Error updating Trello card:`, error);
    return {};
  }
};

// Build the Number Verification Graph
const numberVerificationWorkflow = new StateGraph(NumberVerificationState)
  .addNode("verify_numbers", verifyNumbersNode)
  .addNode("update_trello", updateTrelloCardNode)
  
  .addEdge(START, "verify_numbers")
  .addEdge("verify_numbers", "update_trello")
  .addEdge("update_trello", END);

// Persistence
const checkpointer = new MemorySaver();

export const numberVerificationGraph = numberVerificationWorkflow.compile({ checkpointer });

