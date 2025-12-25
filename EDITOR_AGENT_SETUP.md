# Editor Agent Setup Guide

## Overview

The Editor Agent has been successfully implemented! It reviews generated articles, validates them against source material, implements a retry loop (max 3 revisions), and escalates to human review after 3 failures.

## What Was Built

✅ **Editor Agent** (`editor-agent.ts`)
- Reviews articles using OpenAI GPT-4
- Checks accuracy, completeness, prompt adherence
- Loops back to writer with feedback (max 3 attempts)
- Escalates to "Needs Review" after 3 failures

✅ **Integration Points**
- Integrated into PR/WGO story generation (`/trello/generate-article/:cardId`)
- Integrated into Analyst story generation (`/analyst-story/generate/:cardId`)

✅ **Human Review Endpoints**
- `GET /editor/approve/:cardId` - Approve article from "Needs Review"
- `GET /editor/request-revision/:cardId` - Request more revisions

## Environment Variables Required

Add these to your `.env.local` file:

```env
# OpenAI API Key (for Editor Agent)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional: Specify GPT-4 model (defaults to gpt-4-turbo-preview)
EDITOR_LLM_MODEL=gpt-4-turbo-preview

# Trello "Needs Review" List ID (you already created this column)
TRELLO_LIST_ID_NEEDS_REVIEW=your-needs-review-list-id-here
```

### Getting the "Needs Review" List ID

Run the helper script:
```bash
npm run get-trello-ids
```

Look for the list named "Needs Review" and copy its ID.

## How It Works

### Workflow

1. **Writer Generates Article** → Article is created
2. **Editor Reviews** → GPT-4 checks the article
3. **Decision:**
   - ✅ **Approved** → Moves directly to "Submitted"
   - ❌ **Needs Revision** → Sends feedback to writer, regenerates (loop up to 3 times)
   - ⚠️ **After 3 Failures** → Moves to "Needs Review" for human review

### Review Criteria

The editor checks:
- **Accuracy**: Does it accurately represent the source material?
- **Completeness**: Are all key points from source covered?
- **Prompt Adherence**: Does it follow the original prompt/angle?
- **Factual Consistency**: Are claims consistent with source?
- **Quality**: Is the writing quality acceptable?

### Human Review Flow

When a card moves to "Needs Review":

1. Card includes:
   - Generated article link
   - Editor's review notes
   - Revision history (all 3 attempts)
   - Source material reference

2. Human can click:
   - **"Approve & Submit"** → Moves to "Submitted"
   - **"Request More Revisions"** → Moves back to "In Progress" (for manual regeneration)

## Testing

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Generate an article** via Trello:
   - Click "Generate Article" on any PR/WGO/Analyst card
   - Watch the terminal logs for editor review process

3. **Check terminal logs:**
   - `📝 EDITOR: Reviewing article (Revision X of 3)`
   - `📊 Review Result: ✅ APPROVED` or `❌ NEEDS REVISION`
   - If revision needed: `✍️ EDITOR: Requesting revision`

4. **If article needs review:**
   - Card moves to "Needs Review" list
   - Click "Approve & Submit" or "Request More Revisions" buttons

## Configuration

### Customizing Review Model

You can change the GPT model used for reviews:

```env
EDITOR_LLM_MODEL=gpt-4o  # or gpt-4-turbo, gpt-4, etc.
```

Default: `gpt-4-turbo-preview`

### Adjusting Revision Limit

To change the max revision attempts (currently 3), edit `editor-agent.ts`:

```typescript
// In reviewArticleNode function
if (state.revisionCount >= 2) { // Change 2 to N-1 for N revisions
  reviewResultStatus = "escalated";
}
```

## Troubleshooting

### Editor Agent Not Running

**Check:**
- ✅ `OPENAI_API_KEY` is set in `.env.local`
- ✅ API key is valid and has credits
- ✅ Check terminal for errors

### Articles Not Being Reviewed

**Check:**
- ✅ Editor Agent is being called (check logs for `📝 Calling Editor Agent`)
- ✅ No errors in terminal
- ✅ Article generation completed successfully

### Cards Not Moving to "Needs Review"

**Check:**
- ✅ `TRELLO_LIST_ID_NEEDS_REVIEW` is set correctly
- ✅ List ID matches the actual Trello list
- ✅ Check terminal for Trello API errors

## Cost Considerations

Each article review cycle uses:
- **1 GPT-4 call per review** (cheaper models available)
- **1-4 writer calls** (1 initial + up to 3 revisions)

Example costs (approximate):
- GPT-4 Turbo: ~$0.01-0.03 per review
- 3 revisions: ~$0.04-0.12 per article (if all revisions needed)

## Next Steps

1. ✅ Add `OPENAI_API_KEY` to `.env.local`
2. ✅ Add `TRELLO_LIST_ID_NEEDS_REVIEW` to `.env.local`
3. ✅ Test with a sample article
4. ✅ Monitor logs and adjust review criteria if needed

The Editor Agent is now ready to use! 🎉




