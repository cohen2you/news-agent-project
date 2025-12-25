/**
 * Editor Agent
 * Reviews writer-generated articles, validates against source material and prompt,
 * implements retry loop (max 3 revisions), and escalates to human review after 3 failures.
 */

import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { generateArticle } from "./article-generator-integration";
import { TrelloService } from "./trello-service";

// Editor Agent State
const EditorAgentState = Annotation.Root({
  // Inputs
  cardId: Annotation<string>,                    // Trello card ID
  articleId: Annotation<string>,                 // Generated article ID (for viewing)
  articleContent: Annotation<string>,            // Generated article HTML
  sourceMaterial: Annotation<any>,              // Original PR/news/analyst note
  originalPrompt: Annotation<string>,           // Original pitch/prompt
  
  // Editor State
  revisionCount: Annotation<number>,            // 0-3, tracks revision attempts
  revisionFeedback: Annotation<string>,         // Feedback from editor to writer
  reviewResult: Annotation<string>,             // "approved" | "needs_revision" | "escalated"
  reviewNotes: Annotation<string>,              // Editor's detailed review notes
  reviewIssues: Annotation<string[]>,           // List of specific issues found
  allRevisionFeedback: Annotation<string[]>,    // History of all revision feedback
  reviewSummary: Annotation<string>,            // Summary of review checks performed
  
  // Writer Integration
  writerApp: Annotation<string>,                // Which writer app to use for regeneration
  writerConfig: Annotation<any>,                // Writer configuration (ticker, etc.)
  
  // Output
  finalArticle: Annotation<string | null>,      // Final approved article (or null if escalated)
  escalationReason: Annotation<string>,         // Why it was escalated
});

// Initialize LLM for editor reviews
const getEditorLLM = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set in environment variables");
  }
  
  const model = process.env.EDITOR_LLM_MODEL || "gpt-4-turbo-preview";
  
  return new ChatOpenAI({
    modelName: model,
    temperature: 0, // Low temperature for consistent, factual reviews
    openAIApiKey: apiKey,
  });
};

// NODE 1: Review Article - Uses LLM to review the article
const reviewArticleNode = async (state: typeof EditorAgentState.State) => {
  console.log(`\n📝 EDITOR: Reviewing article (Revision ${state.revisionCount + 1} of 3)`);
  
  try {
    const llm = getEditorLLM();
    
    // Format source material for review - prioritize body over teaser for completeness
    let sourceText = '';
    let sourceTitle = '';
    let keyTerms: string[] = [];
    
    if (typeof state.sourceMaterial === 'string') {
      sourceText = state.sourceMaterial;
    } else if (state.sourceMaterial) {
      // Extract title/headline for key term checking
      sourceTitle = state.sourceMaterial.title || state.sourceMaterial.headline || '';
      
      // Extract key terms from title (split by common separators like semicolons, commas, "and")
      if (sourceTitle) {
        keyTerms = sourceTitle
          .split(/[;,&|]/)
          .map(term => term.trim())
          .filter(term => term.length > 0 && term.length < 100) // Filter out very long segments
          .slice(0, 10); // Limit to top 10 terms
      }
      
      // Build source text - prioritize full body content
      const bodyText = state.sourceMaterial.body || '';
      const contentText = state.sourceMaterial.content || '';
      const teaserText = state.sourceMaterial.teaser || '';
      
      // If we have body, prioritize it; otherwise use content, then teaser
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
      
      // Add structured data as context if available
      if (state.sourceMaterial.ticker) sourceText += `\n\nTicker: ${state.sourceMaterial.ticker}`;
      if (state.sourceMaterial.date) sourceText += `\n\nDate: ${state.sourceMaterial.date}`;
      if (state.sourceMaterial.url) sourceText += `\n\nSource URL: ${state.sourceMaterial.url}`;
    }
    
    // Check for source link in HTML (before stripping HTML)
    const hasSourceLink = /<a\s+[^>]*href\s*=\s*["'][^"']+["'][^>]*>.*Read the full source article/i.test(state.articleContent);
    const hasPlainTextSourceLink = /Read the full source article:/i.test(state.articleContent);
    const sourceUrlInContent = state.sourceMaterial?.url || state.sourceMaterial?.link || '';
    
    // Clean article content (remove HTML for review, but keep original)
    const articleText = state.articleContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Extract key information from headline to check if it's mentioned in article
    let keyInfoCheck = '';
    if (keyTerms.length > 0) {
      keyInfoCheck = `\n\nCRITICAL CHECK: The source headline/title mentions these key topics: ${keyTerms.join(', ')}. 
Please verify that these topics are addressed or mentioned in the generated article. If major topics from the headline are completely missing, this is a significant completeness issue.`;
    }
    
    // Add source link check if source URL is available
    let sourceLinkCheck = '';
    if (sourceUrlInContent && !hasSourceLink) {
      sourceLinkCheck = `\n\n⚠️ FORMATTING ISSUE: The source article URL is available (${sourceUrlInContent.substring(0, 80)}${sourceUrlInContent.length > 80 ? '...' : ''}), but the generated article ${hasPlainTextSourceLink ? 'has the link text but it is NOT formatted as a clickable HTML hyperlink. It appears as plain text instead of <a href="..."> tags.' : 'is missing the required "Read the full source article" link entirely.'} For WGO articles, a properly formatted HTML hyperlink must be included at the end of the article.`;
    }
    
    // Build review prompt
    const reviewPrompt = `You are an expert editor reviewing an AI-generated article.

SOURCE MATERIAL:
Title/Headline: ${sourceTitle}
${sourceText.substring(0, 8000)}${sourceText.length > 8000 ? '... (truncated)' : ''}

ORIGINAL PROMPT/ANGLE:
${state.originalPrompt.substring(0, 2000)}${state.originalPrompt.length > 2000 ? '... (truncated)' : ''}

GENERATED ARTICLE:
${articleText.substring(0, 6000)}${articleText.length > 6000 ? '... (truncated)' : ''}

REVISION ATTEMPT: ${state.revisionCount + 1} of 3
${state.revisionCount > 0 ? `\nPREVIOUS REVISION FEEDBACK:\n${state.allRevisionFeedback?.join('\n\n') || state.revisionFeedback}` : ''}

Please review this article with a balanced approach. APPROVE the article if it meets these criteria (it doesn't need to be perfect):
1. **Accuracy**: Does it reasonably represent the source material? Minor factual inaccuracies or simplifications are acceptable if the overall narrative is sound.
2. **Completeness**: Does it cover the main points from the source? **CRITICAL**: If the headline/title mentions specific major topics (like "Bank of Japan", "Interest Rate", "Inflation Data", "Oracle-TikTok Deal"), these should be addressed or at least mentioned in the article. Missing major topics from the headline is a significant completeness issue.
3. **Formatting & Links**: Does the article include proper formatting as instructed? **CRITICAL**: For WGO articles, the article MUST include a clickable hyperlink to the source article at the end in the format: [HTML anchor tag with href attribute pointing to source-url and containing "Read the full source article: [article-title]"]. The link should be properly formatted HTML (using <a href="..."> tags), not plain text. The article should also use proper HTML paragraph tags (<p>) and structure.
4. **Prompt Adherence**: Does it generally follow the original prompt/angle? Minor deviations are acceptable if the article is still relevant and useful.
5. **Factual Consistency**: Are major claims consistent? Minor inconsistencies that don't affect the core message are acceptable.
6. **Quality**: Is the writing quality acceptable (grammar, flow, clarity, structure)? Good quality is sufficient - it doesn't need to be perfect.
${keyInfoCheck}
${sourceLinkCheck}

IMPORTANT GUIDANCE:
- Only request revisions for SIGNIFICANT issues that materially affect the article's usefulness or accuracy
- **MISSING MAJOR TOPICS FROM HEADLINE**: If the headline mentions specific major topics (e.g., "Bank of Japan Raises Interest Rate", "Oracle-TikTok Deal") and these are completely absent from the article, this is a significant issue that should trigger a revision
- **MISSING OR MALFORMED SOURCE LINK**: For WGO articles, if the source article link is missing or is plain text instead of a clickable HTML hyperlink (using anchor tag with href attribute), this is a significant formatting issue that should trigger a revision. The link must be proper HTML, not just text.
- Approve articles that are "good enough" even if they're not perfect
- Minor factual errors, missing minor details, or slight deviations from the prompt should NOT prevent approval
- Focus on whether the article is publishable, not whether it's flawless

CRITICAL: Only mark "approved": false if there are SIGNIFICANT issues that make the article unpublishable. However, if major topics from the headline are completely missing OR if the required source link is missing/malformed, these ARE significant issues. If the article is generally good and useful despite minor flaws, mark it as "approved": true.

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "approved": true,
  "reviewNotes": "Your balanced review explanation",
  "revisionFeedback": "",
  "issues": []
}
OR if SIGNIFICANT issues exist:
{
  "approved": false,
  "reviewNotes": "Detailed explanation - be balanced and fair",
  "revisionFeedback": "Specific, actionable feedback for MAJOR issues only. Minor issues should not prevent approval.",
  "issues": ["significant", "issue", "only"]
}`;

    const response = await llm.invoke(reviewPrompt);
    const responseText = response.content.toString();
    
    // Parse JSON response (handle markdown code blocks if present)
    let reviewResult: any;
    try {
      // Try to extract JSON from response (might be wrapped in markdown)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reviewResult = JSON.parse(jsonMatch[0]);
      } else {
        reviewResult = JSON.parse(responseText);
      }
    } catch (parseError: any) {
      console.error(`   ⚠️  Error parsing LLM response:`, parseError);
      console.error(`   📄 Response text:`, responseText.substring(0, 500));
      // Default to needing revision if parsing fails
      reviewResult = {
        approved: false,
        reviewNotes: `Error parsing review response: ${parseError.message}`,
        revisionFeedback: "Please regenerate the article with careful attention to accuracy and completeness.",
        issues: ["Review parsing error"]
      };
    }
    
    console.log(`   📊 Review Result: ${reviewResult.approved ? '✅ APPROVED' : '❌ NEEDS REVISION'}`);
    console.log(`   📝 Issues Found: ${reviewResult.issues?.length || 0}`);
    
    // Determine next step
    let reviewResultStatus: string;
    if (reviewResult.approved) {
      reviewResultStatus = "approved";
    } else if (state.revisionCount >= 2) { // 0-indexed, so 2 means 3rd attempt
      reviewResultStatus = "escalated";
    } else {
      reviewResultStatus = "needs_revision";
    }
    
    // Update revision feedback history
    const allFeedback = state.allRevisionFeedback || [];
    if (reviewResult.revisionFeedback) {
      allFeedback.push(`Revision ${state.revisionCount + 1}: ${reviewResult.revisionFeedback}`);
    }
    
    // Build review summary
    const reviewSummary = `Review completed: ${reviewResult.approved ? '✅ APPROVED' : '❌ NEEDS REVISION'}
Revision Attempt: ${state.revisionCount + 1} of 3
Issues Found: ${reviewResult.issues?.length || 0}

Review Checks Performed:
• Accuracy: Article checked against source material for factual accuracy
• Completeness: Verified all key points from source are covered
• Prompt Adherence: Confirmed article follows original prompt/angle
• Factual Consistency: Checked for contradictions or inconsistencies
• Quality: Assessed writing quality (grammar, flow, clarity, structure)`;

    return {
      reviewResult: reviewResultStatus,
      reviewNotes: reviewResult.reviewNotes || '',
      reviewIssues: reviewResult.issues || [],
      reviewSummary: reviewSummary,
      revisionFeedback: reviewResult.revisionFeedback || '',
      allRevisionFeedback: allFeedback,
      revisionCount: state.revisionCount,
      finalArticle: reviewResult.approved ? state.articleContent : null,
      escalationReason: reviewResultStatus === "escalated" 
        ? `Failed review after ${state.revisionCount + 1} revision attempts. Issues: ${reviewResult.issues?.join(', ') || 'See review notes'}`
        : '',
    };
  } catch (error: any) {
    console.error(`   ❌ Error in review:`, error);
    // On error, escalate to human review
    return {
      reviewResult: "escalated",
      reviewNotes: `Editor review error: ${error.message}`,
      reviewIssues: ['Editor review system error'],
      reviewSummary: `Review Error: ${error.message}`,
      revisionFeedback: '',
      escalationReason: `Editor review failed: ${error.message}`,
    };
  }
};

// NODE 2: Request Revision - Sends feedback back to writer for regeneration
const requestRevisionNode = async (state: typeof EditorAgentState.State) => {
  console.log(`\n✍️  EDITOR: Requesting revision (Attempt ${state.revisionCount + 1})`);
  console.log(`   📋 Feedback: ${state.revisionFeedback.substring(0, 100)}...`);
  
  try {
    // Build enhanced prompt with revision feedback
    const enhancedPrompt = `${state.originalPrompt}

--- REVISION REQUEST ---
Editor Feedback (Revision ${state.revisionCount + 1}):
${state.revisionFeedback}

Please regenerate the article addressing the feedback above while maintaining accuracy to the source material.`;

    // Regenerate article using the writer
    const regeneratedArticle = await generateArticle(
      enhancedPrompt,
      state.writerApp || "story",
      state.writerConfig?.ticker,
      state.writerConfig?.newsArticles,
      state.writerConfig?.selectedArticle,
      state.writerConfig?.manualTicker
    );
    
    console.log(`   ✅ Article regenerated (length: ${regeneratedArticle.length} chars)`);
    
    return {
      articleContent: regeneratedArticle,
      revisionCount: state.revisionCount + 1,
    };
  } catch (error: any) {
    console.error(`   ❌ Error regenerating article:`, error);
    // If regeneration fails, escalate
    return {
      reviewResult: "escalated",
      escalationReason: `Article regeneration failed: ${error.message}`,
    };
  }
};

// NODE 3: Escalate to Human - Moves card to "Needs Review" list
const escalateToHumanNode = async (state: typeof EditorAgentState.State) => {
  console.log(`\n⚠️  EDITOR: Escalating to human review after ${state.revisionCount + 1} revision(s)`);
  
  try {
    const trello = new TrelloService();
    const needsReviewListId = process.env.TRELLO_LIST_ID_NEEDS_REVIEW;
    
    // Check if list ID is set and not a placeholder
    if (!needsReviewListId || needsReviewListId.toLowerCase().includes('your-') || needsReviewListId.length < 20) {
      console.error(`   ❌ TRELLO_LIST_ID_NEEDS_REVIEW not set or is placeholder: "${needsReviewListId}"`);
      console.error(`   ⚠️  Card will NOT be moved to "Needs Review" list - please set a valid list ID in .env.local`);
      // Continue anyway to update the description, but don't move the card
    }
    
    // Get current card data
    const cardData = await trello.getCardData(state.cardId);
    let updatedDesc = cardData.desc || '';
    
    // Extract and preserve PR_DATA or NOTE_DATA blocks (store in metadata section that we'll re-append)
    let preservedMetadata = '';
    const prDataMatch = updatedDesc.match(/```metadata\s*\n\s*PR_DATA:\s*([^\n`]+)\s*\n\s*```/);
    const noteDataMatch = updatedDesc.match(/```metadata\s*\n\s*NOTE_DATA:\s*([^\n`]+)\s*\n\s*```/);
    
    // Also check for old format HTML comments for backward compatibility
    const oldPrDataMatch = updatedDesc.match(/<!--\s*PR_DATA:\s*([^>]+)\s*-->/);
    const oldNoteDataMatch = updatedDesc.match(/<!--\s*NOTE_DATA:\s*([^>]+)\s*-->/);
    
    // Preserve metadata blocks (we'll re-append them at the end, hidden)
    if (prDataMatch) {
      preservedMetadata = `\n\n<!-- PR_DATA:${prDataMatch[1]} -->`;
    } else if (oldPrDataMatch) {
      preservedMetadata = `\n\n<!-- PR_DATA:${oldPrDataMatch[1]} -->`;
    } else if (noteDataMatch) {
      preservedMetadata = `\n\n<!-- NOTE_DATA:${noteDataMatch[1]} -->`;
    } else if (oldNoteDataMatch) {
      preservedMetadata = `\n\n<!-- NOTE_DATA:${oldNoteDataMatch[1]} -->`;
    }
    
    // Remove old "Generate Article" link if present
    updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Generate Article\]\([^)]+\)\*\*/g, '');
    updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Generate Story\]\([^)]+\)\*\*/g, '');
    
    // Remove old metadata blocks (code blocks and HTML comments) - we'll re-append as HTML comment
    updatedDesc = updatedDesc.replace(/```metadata[^`]*```/gs, '');
    updatedDesc = updatedDesc.replace(/<!--\s*(PR_DATA|NOTE_DATA):[^>]+-->/g, '');
    
    // Remove old approval/escalation sections if updating
    updatedDesc = updatedDesc.replace(/\n\n---\n\n## ✅ Editor Approved[\s\S]*?(?=\n\n---|$)/, '');
    updatedDesc = updatedDesc.replace(/\n\n---\n\n## ⚠️ Needs Human Review[\s\S]*?(?=\n\n---|$)/, '');
    
    // Helper function to clean text (same as trello-service.ts)
    const cleanText = (text: string): string => {
      if (!text) return '';
      // Decode common HTML entities
      let cleaned = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
      // Remove HTML tags
      cleaned = cleaned.replace(/<[^>]+>/g, '');
      // Normalize whitespace
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      // Remove control characters
      cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
      return cleaned;
    };
    
    // Build escalation section (with length limits to prevent Trello API errors)
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    const articleViewUrl = state.generatedArticleId 
      ? `${appUrl}/pr-auto-scan/articles/${state.generatedArticleId}`
      : state.articleId 
        ? `${appUrl}/pr-auto-scan/articles/${state.articleId}`
        : `${appUrl}/pr-auto-scan/articles`; // Fallback
    
    let escalationSection = `\n\n---\n\n## ⚠️ Needs Human Review\n\n`;
    escalationSection += `After ${state.revisionCount + 1} revision attempt(s), this article needs human review.\n\n`;
    
    // Add review summary (what was checked) - truncated
    if (state.reviewSummary) {
      const cleanSummary = cleanText(state.reviewSummary);
      escalationSection += `### 📋 Editor Review Summary\n\n`;
      escalationSection += `${cleanSummary.substring(0, 500)}${cleanSummary.length > 500 ? '...' : ''}\n\n`;
    }
    
    // Add review notes (detailed results) - truncated
    if (state.reviewNotes) {
      const cleanNotes = cleanText(state.reviewNotes);
      escalationSection += `### 📝 Editor's Detailed Review\n\n`;
      escalationSection += `${cleanNotes.substring(0, 800)}${cleanNotes.length > 800 ? '...' : ''}\n\n`;
    }
    
    // Add specific issues found - truncated list
    if (state.reviewIssues && state.reviewIssues.length > 0) {
      escalationSection += `### ⚠️ Issues Found\n\n`;
      state.reviewIssues.slice(0, 5).forEach((issue, idx) => {
        const cleanIssue = cleanText(issue);
        escalationSection += `${idx + 1}. ${cleanIssue.substring(0, 200)}${cleanIssue.length > 200 ? '...' : ''}\n`;
      });
      if (state.reviewIssues.length > 5) {
        escalationSection += `\n... and ${state.reviewIssues.length - 5} more issue(s)\n`;
      }
      escalationSection += `\n`;
    }
    
    // Revision history - truncated
    escalationSection += `### 🔄 Revision History\n\n`;
    if (state.allRevisionFeedback && state.allRevisionFeedback.length > 0) {
      state.allRevisionFeedback.slice(0, 3).forEach((feedback, idx) => {
        const cleanFeedback = cleanText(feedback);
        escalationSection += `**Revision ${idx + 1}:** ${cleanFeedback.substring(0, 300)}${cleanFeedback.length > 300 ? '...' : ''}\n\n`;
      });
      if (state.allRevisionFeedback.length > 3) {
        escalationSection += `... and ${state.allRevisionFeedback.length - 3} more revision(s)\n\n`;
      }
    } else {
      escalationSection += `No previous revisions attempted.\n\n`;
    }
    
    // Reason for escalation - truncated
    const escalationReason = cleanText(state.escalationReason || 'Multiple revision attempts failed');
    escalationSection += `**Reason for Escalation:**\n${escalationReason.substring(0, 300)}${escalationReason.length > 300 ? '...' : ''}\n\n`;
    
    // Article link and actions
    escalationSection += `**Generated Article:**\n[View Article](${articleViewUrl})\n\n`;
    escalationSection += `**Actions:**\n`;
    escalationSection += `- [Approve & Submit](${appUrl}/editor/approve/${state.cardId})\n`;
    escalationSection += `- [Request More Revisions](${appUrl}/editor/request-revision/${state.cardId})\n`;
    
    // Calculate available space (Trello limit is 16,384, we'll use 10,000 as conservative limit)
    const maxDescLength = 10000;
    const metadataLength = preservedMetadata.length;
    const escalationLength = escalationSection.length;
    const currentDescLength = updatedDesc.length;
    const totalLength = currentDescLength + escalationLength + metadataLength;
    
    // If description would be too long, truncate the base description first
    if (totalLength > maxDescLength) {
      const excess = totalLength - maxDescLength;
      const truncateAt = Math.max(0, currentDescLength - excess - 100); // Leave buffer
      updatedDesc = updatedDesc.substring(0, truncateAt) + '...';
      console.log(`   ⚠️  Description too long, truncated base description to fit escalation section`);
    }
    
    updatedDesc += escalationSection;
    
    // Re-append preserved metadata as HTML comment (truly hidden in Trello)
    updatedDesc += preservedMetadata;
    
    // Final length check and truncate escalation section if still too long
    if (updatedDesc.length > maxDescLength) {
      const excess = updatedDesc.length - maxDescLength;
      // Truncate escalation section, but keep essential parts (actions)
      const actionsMatch = escalationSection.match(/(\*\*Actions:\*\*[\s\S]+)/);
      if (actionsMatch) {
        const essentialPart = `\n\n---\n\n## ⚠️ Needs Human Review\n\nAfter ${state.revisionCount + 1} revision attempt(s), this article needs human review.\n\n**Generated Article:**\n[View Article](${articleViewUrl})\n\n${actionsMatch[1]}`;
        updatedDesc = updatedDesc.substring(0, updatedDesc.length - escalationSection.length) + essentialPart;
      }
      console.log(`   ⚠️  Final description still too long, truncated escalation section`);
    }
    
    // Remove any remaining control characters
    updatedDesc = updatedDesc.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // IMPORTANT: Move card FIRST, then update description
    // This ensures the card moves even if description update fails
    let cardMoved = false;
    if (needsReviewListId && !needsReviewListId.toLowerCase().includes('your-') && needsReviewListId.length >= 20) {
      try {
        await trello.moveCardToList(state.cardId, needsReviewListId);
        console.log(`   ✅ Moved card to "Needs Review" list`);
        cardMoved = true;
      } catch (moveError: any) {
        console.error(`   ❌ Failed to move card to "Needs Review" list:`, moveError.message);
        console.error(`   ⚠️  Card may still be in "In Progress" list - please move manually`);
        // Don't throw - we want to try updating description even if move fails
      }
    } else {
      console.warn(`   ⚠️  Cannot move card - TRELLO_LIST_ID_NEEDS_REVIEW is not set or invalid`);
      console.warn(`   💡 Update .env.local with a valid "Needs Review" list ID to enable automatic card movement`);
      console.warn(`   💡 Card is currently in "In Progress" - please move manually to "Needs Review"`);
    }
    
    // Update card description (after moving card, so card is in right place even if this fails)
    try {
      await trello.updateCardDescription(state.cardId, updatedDesc);
      console.log(`   ✅ Updated card description with escalation details (${updatedDesc.length} chars)`);
    } catch (descError: any) {
      console.error(`   ⚠️  Failed to update card description:`, descError.message);
      if (cardMoved) {
        console.log(`   ✅ Card was successfully moved to "Needs Review" list (description update failed)`);
      } else {
        console.error(`   ⚠️  Card description update failed and card was not moved`);
      }
      // Don't throw - card movement is more important than description update
    }
    
    // Add comment with review details
    let commentText = `⚠️ **Escalated to Human Review**\n\nEditor attempted ${state.revisionCount + 1} revision(s) but article still needs review.\n\n`;
    if (state.reviewIssues && state.reviewIssues.length > 0) {
      commentText += `**Issues Found:**\n`;
      state.reviewIssues.forEach((issue, idx) => {
        commentText += `${idx + 1}. ${issue}\n`;
      });
      commentText += `\n`;
    }
    if (state.reviewNotes) {
      commentText += `**Review Notes:** ${state.reviewNotes.substring(0, 400)}${state.reviewNotes.length > 400 ? '...' : ''}\n\n`;
    }
    commentText += `See card description for full review details.`;
    try {
      await trello.addComment(state.cardId, commentText);
    } catch (commentError: any) {
      console.warn(`   ⚠️  Could not add comment:`, commentError.message);
    }
    
    return {};
  } catch (error: any) {
    console.error(`   ❌ Error escalating to human:`, error);
    return {};
  }
};

// NODE 4: Approve Article - Final step, moves to Submitted
const approveArticleNode = async (state: typeof EditorAgentState.State) => {
  console.log(`\n✅ EDITOR: Approving article and moving to Submitted`);
  
  try {
    const trello = new TrelloService();
    const submittedListId = process.env.TRELLO_LIST_ID_SUBMITTED;
    
    if (!submittedListId) {
      console.error(`   ❌ TRELLO_LIST_ID_SUBMITTED not set`);
      return {};
    }
    
    // Get current card data
    const cardData = await trello.getCardData(state.cardId);
    let updatedDesc = cardData.desc || '';
    
    // Extract and preserve PR_DATA or NOTE_DATA blocks (store in metadata section that we'll re-append)
    let preservedMetadata = '';
    const prDataMatch = updatedDesc.match(/```metadata\s*\n\s*PR_DATA:\s*([^\n`]+)\s*\n\s*```/);
    const noteDataMatch = updatedDesc.match(/```metadata\s*\n\s*NOTE_DATA:\s*([^\n`]+)\s*\n\s*```/);
    
    // Also check for old format HTML comments for backward compatibility
    const oldPrDataMatch = updatedDesc.match(/<!--\s*PR_DATA:\s*([^>]+)\s*-->/);
    const oldNoteDataMatch = updatedDesc.match(/<!--\s*NOTE_DATA:\s*([^>]+)\s*-->/);
    
    // Preserve metadata blocks (we'll re-append them at the end, hidden)
    if (prDataMatch) {
      preservedMetadata = `\n\n<!-- PR_DATA:${prDataMatch[1]} -->`;
    } else if (oldPrDataMatch) {
      preservedMetadata = `\n\n<!-- PR_DATA:${oldPrDataMatch[1]} -->`;
    } else if (noteDataMatch) {
      preservedMetadata = `\n\n<!-- NOTE_DATA:${noteDataMatch[1]} -->`;
    } else if (oldNoteDataMatch) {
      preservedMetadata = `\n\n<!-- NOTE_DATA:${oldNoteDataMatch[1]} -->`;
    }
    
    // Remove old "Generate Article" links if present
    updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Generate Article\]\([^)]+\)\*\*/g, '');
    updatedDesc = updatedDesc.replace(/\n\n---\n\n\*\*\[Generate Story\]\([^)]+\)\*\*/g, '');
    
    // Remove old metadata blocks (code blocks and HTML comments) - we'll re-append as HTML comment
    updatedDesc = updatedDesc.replace(/```metadata[^`]*```/gs, '');
    updatedDesc = updatedDesc.replace(/<!--\s*(PR_DATA|NOTE_DATA):[^>]+-->/g, '');
    
    // Remove old approval/escalation sections if updating
    updatedDesc = updatedDesc.replace(/\n\n---\n\n## ✅ Editor Approved[\s\S]*?(?=\n\n---|$)/, '');
    updatedDesc = updatedDesc.replace(/\n\n---\n\n## ⚠️ Needs Human Review[\s\S]*?(?=\n\n---|$)/, '');
    
    // Get article view URL
    const appUrl = process.env.APP_URL || 'http://localhost:3001';
    console.log(`   🔗 Article ID from state: ${state.articleId || '(not set)'}`);
    const articleViewUrl = state.articleId 
      ? `${appUrl}/pr-auto-scan/articles/${state.articleId}`
      : `${appUrl}/pr-auto-scan/articles`;
    console.log(`   🔗 Article view URL: ${articleViewUrl}`);
    
    // Extract title from article
    let articleTitle = 'Generated Article';
    if (state.articleContent) {
      const titleMatch = state.articleContent.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
      if (titleMatch && titleMatch[1]) {
        articleTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }
    
    // Update with approval notice, article link, and detailed review information
    updatedDesc += `\n\n---\n\n## ✅ Editor Approved\n\n`;
    updatedDesc += `**Title:** ${articleTitle}\n\n`;
    updatedDesc += `**View Article:** [View Generated Article](${articleViewUrl})\n\n`;
    updatedDesc += `Article approved after ${state.revisionCount} revision(s).\n`;
    updatedDesc += `**Approved:** ${new Date().toLocaleString()}\n\n`;
    
    // Add review summary (what was checked)
    if (state.reviewSummary) {
      updatedDesc += `### 📋 Editor Review Summary\n\n`;
      updatedDesc += `\`\`\`\n${state.reviewSummary}\n\`\`\`\n\n`;
    }
    
    // Add review notes (detailed results)
    if (state.reviewNotes) {
      updatedDesc += `### 📝 Editor's Review Notes\n\n`;
      updatedDesc += `${state.reviewNotes}\n\n`;
    }
    
    // If there were previous revisions, show the history
    if (state.allRevisionFeedback && state.allRevisionFeedback.length > 0) {
      updatedDesc += `### 🔄 Revision History\n\n`;
      state.allRevisionFeedback.forEach((feedback, idx) => {
        updatedDesc += `**Revision ${idx + 1}:** ${feedback}\n\n`;
      });
    }
    
    // Update card description with all review information
    console.log(`   📝 Updating card description with article link and review notes...`);
    await trello.updateCardDescription(state.cardId, updatedDesc);
    console.log(`   ✅ Card description updated (length: ${updatedDesc.length} chars)`);
    
    // Add comment with review summary
    const articlePreview = state.articleContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
    let commentText = `**✅ Article Approved by Editor**\n\n**Title:** ${articleTitle}\n\n`;
    if (state.reviewNotes) {
      commentText += `**Review:** ${state.reviewNotes.substring(0, 300)}${state.reviewNotes.length > 300 ? '...' : ''}\n\n`;
    }
    commentText += `**Preview:** ${articlePreview}...\n\n[View Full Article](${articleViewUrl})`;
    try {
      await trello.addComment(state.cardId, commentText);
      console.log(`   ✅ Added approval comment to card`);
    } catch (commentError: any) {
      console.warn(`   ⚠️  Could not add comment:`, commentError.message);
    }
    
    // Move to Submitted (after updating description)
    console.log(`   📦 Moving card to Submitted list...`);
    await trello.moveCardToList(state.cardId, submittedListId);
    console.log(`   ✅ Moved card to Submitted list with article link and review notes`);
    
    return {
      finalArticle: state.articleContent,
    };
  } catch (error: any) {
    console.error(`   ❌ Error approving article:`, error);
    return {};
  }
};

// Build the Editor Agent Graph
const editorWorkflow = new StateGraph(EditorAgentState)
  .addNode("review_article", reviewArticleNode)
  .addNode("request_revision", requestRevisionNode)
  .addNode("escalate_to_human", escalateToHumanNode)
  .addNode("approve_article", approveArticleNode)
  
  .addEdge(START, "review_article")
  
  .addConditionalEdges(
    "review_article",
    (state) => {
      const result = state.reviewResult?.toLowerCase() || '';
      console.log(`   🔀 Routing based on reviewResult: "${state.reviewResult}"`);
      
      if (result === "approved") {
        return "approved";
      }
      if (result === "needs_revision") {
        return "needs_revision";
      }
      if (result === "escalated") {
        return "escalated";
      }
      
      // Default fallback - if reviewResult is empty or unknown, escalate
      console.warn(`   ⚠️  Unknown reviewResult value: "${state.reviewResult}", escalating to human review`);
      return "escalated";
    },
    {
      approved: "approve_article",
      needs_revision: "request_revision",
      escalated: "escalate_to_human",
    }
  )
  
  .addEdge("request_revision", "review_article") // Loop back to review
  .addEdge("approve_article", END)
  .addEdge("escalate_to_human", END);

// Persistence
const checkpointer = new MemorySaver();

export const editorGraph = editorWorkflow.compile({ checkpointer });

