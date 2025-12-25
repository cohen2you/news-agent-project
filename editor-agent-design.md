# Editor Agent Design

## Overview

An Editor Agent that reviews writer output, checks accuracy against source material and prompt, and implements a retry loop before escalating to human review.

## Architecture

### Current Flow
```
Writer Generates Article → Moves directly to "Submitted" in Trello
```

### New Flow with Editor
```
Writer Generates Article → Editor Reviews → {
  ✅ Pass → Move to "Submitted"
  ❌ Fail → Send Revision Request to Writer (max 3 attempts)
    → After 3 failures → Move to "Needs Human Review" list
    → Human approves → Move to "Submitted"
}
```

## Editor Agent State

```typescript
const EditorAgentState = Annotation.Root({
  cardId: Annotation<string>,              // Trello card ID
  articleContent: Annotation<string>,      // Generated article HTML
  sourceMaterial: Annotation<any>,         // Original PR/news/analyst note
  originalPrompt: Annotation<string>,      // Original pitch/prompt used
  revisionCount: Annotation<number>,       // Number of revision attempts (0-3)
  revisionFeedback: Annotation<string>,    // Feedback from editor for writer
  reviewResult: Annotation<string>,        // "approved", "needs_revision", "escalated"
  reviewNotes: Annotation<string>,         // Editor's review notes
});
```

## Editor Agent Workflow

```
START → Review Article → {
  if (pass) → Approve → End
  if (fail && revisionCount < 3) → Request Revision → Call Writer Again → Review Article (loop)
  if (fail && revisionCount >= 3) → Escalate to Human Review → End
}
```

## Review Criteria

The editor checks:
1. **Accuracy**: Does the article accurately represent the source material?
2. **Completeness**: Are all key points from source covered?
3. **Prompt Adherence**: Does it follow the original prompt/angle?
4. **Factual Consistency**: Are claims consistent with source?
5. **Quality**: Is the writing quality acceptable?

## Integration Points

### 1. PR/WGO Stories (`/trello/generate-article/:cardId`)
- After article generation, call editor agent
- Editor reviews → if approved, move to Submitted
- If needs revision, regenerate with feedback
- After 3 failures, move to "Needs Review" list

### 2. Analyst Stories (`/analyst-story/generate/:cardId`)
- After story generation, call editor agent
- Same workflow as above

## Trello Lists

Need to add:
- `TRELLO_LIST_ID_NEEDS_REVIEW` - Cards that need human review after 3 failed revisions

## Human Review Flow

1. Card moves to "Needs Review" list with:
   - Generated article link
   - Editor's review notes
   - Revision history (what was tried)
   - Source material reference

2. Human can:
   - **Approve** → Moves to "Submitted" (via button/link)
   - **Request More Revisions** → Send back to writer with human feedback
   - **Reject** → Move to "Rejected" list (optional)

## Implementation Approach

### Option A: Separate Editor Agent (Recommended)
- Standalone `editor-agent.ts`
- Called after writer completes
- Handles review logic independently

### Option B: Integrated into Existing Agents
- Add editor node to `analyst-story-agent.ts`
- Add editor node to PR/WGO generation endpoints
- More tightly coupled

**Recommendation: Option A** - More modular, reusable across all story types.




