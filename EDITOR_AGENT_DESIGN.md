# Editor Agent - Complete Design Document

## Overview

An Editor Agent that reviews writer-generated articles, validates them against source material and prompts, implements a retry loop (max 3 revisions), and escalates to human review after 3 failures.

## Workflow Diagram

```
┌─────────────────┐
│  Writer Agent   │
│  Generates      │
│  Article        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Editor Agent   │
│  Reviews Article│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 ┌─────┐   ┌──────────┐
 │Pass │   │Needs Fix │
 └──┬──┘   └────┬─────┘
    │           │
    │           ▼
    │      ┌─────────────┐
    │      │Send Revision│
    │      │Feedback     │
    │      └──────┬──────┘
    │             │
    │             ▼
    │      ┌─────────────┐
    │      │Writer Regens│
    │      │with Feedback│
    │      └──────┬──────┘
    │             │
    │             ▼
    │      ┌─────────────┐
    │      │Editor Reviews│
    │      │Again (loop) │
    │      └──────┬──────┘
    │             │
    │      ┌──────┴──────┐
    │      │             │
    │      ▼             ▼
    │  ┌──────┐    ┌────────────┐
    │  │Pass  │    │Attempt 3/3?│
    │  └──┬───┘    └─────┬──────┘
    │     │              │
    │     │              ▼
    │     │       ┌──────────────┐
    │     │       │Escalate to   │
    │     │       │Human Review  │
    │     │       └──────┬───────┘
    │     │              │
    └─────┴──────────────┘
              │
              ▼
    ┌──────────────────┐
    │ Move to Submitted│
    │ (after approval) │
    └──────────────────┘
```

## State Definition

```typescript
const EditorAgentState = Annotation.Root({
  // Inputs
  cardId: Annotation<string>,                    // Trello card ID
  articleContent: Annotation<string>,            // Generated article HTML
  sourceMaterial: Annotation<any>,               // Original PR/news/analyst note
  originalPrompt: Annotation<string>,            // Original pitch/prompt
  
  // Editor State
  revisionCount: Annotation<number>,             // 0-3, tracks revision attempts
  revisionFeedback: Annotation<string>,          // Feedback from editor to writer
  reviewResult: Annotation<string>,              // "approved" | "needs_revision" | "escalated"
  reviewNotes: Annotation<string>,               // Editor's detailed review notes
  
  // Writer Integration
  writerApp: Annotation<string>,                 // Which writer app to use for regeneration
  writerConfig: Annotation<any>,                 // Writer configuration (ticker, etc.)
  
  // Output
  finalArticle: Annotation<string | null>,       // Final approved article (or null if escalated)
  escalationReason: Annotation<string>,          // Why it was escalated
});
```

## Node Functions

### 1. Review Article Node

Uses LLM to review the article:

**Prompt Template:**
```
You are an expert editor reviewing an AI-generated article.

SOURCE MATERIAL:
{sourceMaterial}

ORIGINAL PROMPT/ANGLE:
{originalPrompt}

GENERATED ARTICLE:
{articleContent}

REVISION ATTEMPT: {revisionCount} of 3

Please review this article and check:
1. **Accuracy**: Does it accurately represent the source material? Any factual errors?
2. **Completeness**: Are all key points from the source covered?
3. **Prompt Adherence**: Does it follow the original prompt/angle?
4. **Factual Consistency**: Are all claims consistent with the source?
5. **Quality**: Is the writing quality acceptable (grammar, flow, clarity)?

RESPOND IN JSON FORMAT:
{
  "approved": true/false,
  "reviewNotes": "Detailed explanation of your review",
  "revisionFeedback": "If not approved, specific feedback for the writer to improve the article",
  "issues": ["list", "of", "specific", "issues"]
}
```

**Logic:**
- If `approved: true` → Set `reviewResult: "approved"`, `finalArticle: articleContent`
- If `approved: false` and `revisionCount < 3` → Set `reviewResult: "needs_revision"`, increment `revisionCount`
- If `approved: false` and `revisionCount >= 3` → Set `reviewResult: "escalated"`

### 2. Request Revision Node

Sends feedback back to writer for regeneration:

**Actions:**
1. Call writer agent again with original prompt + revision feedback
2. Update `articleContent` with new version
3. Reset `revisionFeedback` for next iteration

### 3. Escalate to Human Node

Moves card to "Needs Review" list in Trello:

**Actions:**
1. Move card to `TRELLO_LIST_ID_NEEDS_REVIEW`
2. Update card description with:
   - Editor's review notes
   - All revision attempts and feedback
   - Link to view article
   - Source material reference
3. Add "Approve" and "Request Revision" buttons for human

### 4. Approve Article Node

Final step - moves to Submitted:

**Actions:**
1. Move card to `TRELLO_LIST_ID_SUBMITTED`
2. Update card with approved article link

## Workflow Graph

```typescript
const editorWorkflow = new StateGraph(EditorAgentState)
  .addNode("review_article", reviewArticleNode)
  .addNode("request_revision", requestRevisionNode)
  .addNode("escalate_to_human", escalateToHumanNode)
  .addNode("approve_article", approveArticleNode)
  
  .addEdge(START, "review_article")
  
  .addConditionalEdges("review_article", (state) => {
    if (state.reviewResult === "approved") return "approve_article";
    if (state.reviewResult === "needs_revision") return "request_revision";
    if (state.reviewResult === "escalated") return "escalate_to_human";
    return "escalate_to_human"; // Default fallback
  })
  
  .addEdge("request_revision", "review_article") // Loop back
  .addEdge("approve_article", END)
  .addEdge("escalate_to_human", END);
```

## Integration Points

### Integration with PR/WGO Story Generation

In `/trello/generate-article/:cardId`:

```typescript
// After article generation:
const generatedArticle = await generateArticle(...);

// Instead of directly moving to Submitted:
// await editorGraph.invoke({
//   cardId,
//   articleContent: generatedArticle,
//   sourceMaterial: sourceData,
//   originalPrompt: pitch,
//   revisionCount: 0,
//   writerApp: appToUse,
//   writerConfig: { ticker, ... }
// }, config);
```

### Integration with Analyst Story Generation

In `/analyst-story/generate/:cardId`:

```typescript
// After story generation:
const generatedStory = state.values.generatedStory;

// Call editor agent:
await editorGraph.invoke({
  cardId,
  articleContent: generatedStory,
  sourceMaterial: state.values.noteData,
  originalPrompt: state.values.extractedData,
  revisionCount: 0,
  writerApp: "analyst-article",
  writerConfig: { ticker: state.values.noteData?.ticker }
}, config);
```

## Environment Variables

```env
# Editor Agent LLM Configuration
EDITOR_LLM_PROVIDER=openai  # or "anthropic", "google", etc.
EDITOR_LLM_MODEL=gpt-4-turbo-preview
EDITOR_LLM_API_KEY=sk-...

# Or use existing LLM keys if shared:
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# Trello Lists
TRELLO_LIST_ID_NEEDS_REVIEW=your-needs-review-list-id
```

## Human Review Interface

Cards in "Needs Review" list will have:

**Description:**
```
## ⚠️ Needs Human Review

After 3 revision attempts, this article still needs review.

### Editor's Notes:
{reviewNotes}

### Revision History:
- Attempt 1: {feedback1}
- Attempt 2: {feedback2}
- Attempt 3: {feedback3}

### Generated Article:
[View Article](link)

### Source Material:
[View Source](source_url)

---
[Approve & Submit](approve_link) | [Request More Revisions](revision_link)
```

## Implementation Steps

1. ✅ Create `editor-agent.ts` with state and nodes
2. ✅ Add LLM integration (LangChain ChatModel)
3. ✅ Add Trello integration for escalation
4. ✅ Create human review endpoints (`/editor/approve/:cardId`, `/editor/request-revision/:cardId`)
5. ✅ Integrate into PR/WGO generation endpoints
6. ✅ Integrate into Analyst story generation
7. ✅ Add `TRELLO_LIST_ID_NEEDS_REVIEW` to `.env.local`
8. ✅ Test with sample articles

## Considerations

1. **LLM Choice**: Use GPT-4 or Claude for best review quality
2. **Review Criteria**: Can be customized per story type (PR vs WGO vs Analyst)
3. **Performance**: Each revision adds latency (writer + editor), but improves quality
4. **Cost**: 3 revisions = 4 writer calls + 4 editor calls per article
5. **Human Override**: Humans can always approve/reject regardless of editor's decision




