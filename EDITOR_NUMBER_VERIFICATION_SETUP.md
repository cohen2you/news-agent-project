# Editor Number Verification Setup

## Overview

The Editor Number Verification Agent automatically checks numerical accuracy when a card is moved to the "Submitted" list. It compares numbers (dollar amounts, percentages, counts, dates) between the source material and the generated article, then updates the Trello card with verification results.

## How It Works

1. **Trigger**: When a card is moved to the "Submitted" list (via Trello webhook)
2. **Extraction**: Extracts article content and source material from the card
3. **Verification**: Uses GPT-4 to compare all numbers between source and article
4. **Reporting**: Updates the Trello card with verification results (no formatting changes)

## Environment Variables

Add these to your `.env.local` file:

```env
# Enable number verification
EDITOR_NUMBER_VERIFICATION_ENABLED=true

# OpenAI API key for number verification LLM
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Specify which model to use (defaults to gpt-4-turbo-preview)
EDITOR_LLM_MODEL=gpt-4-turbo-preview

# Trello list ID for "Submitted" list (required for webhook trigger)
TRELLO_LIST_ID_SUBMITTED=your_submitted_list_id_here
```

## Verification Process

### What Gets Checked

- **Dollar amounts**: $1.2B, $500 million, $50.5M
- **Percentages**: 45%, 12.5%, 3.2 percent
- **Counts/Quantities**: 1,000 units, 25 employees, 10 stores
- **Dates with numbers**: December 2024, Q3 2025
- **Financial metrics**: revenue, earnings, growth rates

### What Gets Reported

The Trello card will be updated with a section like:

```
---
## 🔢 Number Verification

**Status:** ✅ Verified
**Summary:** Verified 15 numbers, all match
**Verified Numbers:** 15
**Verified:** 12/24/2024, 3:45:00 PM
```

Or if discrepancies are found:

```
---
## 🔢 Number Verification

**Status:** ⚠️ Discrepancies Found
**Summary:** Verified 12 numbers, found 2 discrepancies
**Verified Numbers:** 12
**Verified:** 12/24/2024, 3:45:00 PM

### ⚠️ Discrepancies Found

1. Source: $1.2B, Article: $2.1B (Total revenue for Q4)
2. Source: 45%, Article: 50% (Year-over-year growth rate)
```

## Trello Webhook Setup

The verification triggers automatically via Trello webhooks when cards are moved to "Submitted". Make sure your Trello webhook is set up:

1. **For local development**: Use ngrok to expose your server:
   ```bash
   ngrok http 3001
   ```

2. **Create Trello webhook**:
   ```bash
   POST https://api.trello.com/1/tokens/YOUR_TOKEN/webhooks/?key=YOUR_API_KEY
   Body: {
     "description": "News Agent - Card Updates",
     "callbackURL": "https://YOUR_NGROK_URL/trello/webhook",
     "idModel": "YOUR_BOARD_ID"
   }
   ```

3. See `TRELLO_WEBHOOK_SETUP.md` for detailed instructions

## What Happens When a Card is Moved to Submitted

1. Webhook detects the move
2. System extracts:
   - Article content (from stored articles or card description)
   - Source material (from PR_DATA or NOTE_DATA metadata)
3. Number verification agent compares all numbers
4. Card description is updated with verification results
5. A comment is added to the card with summary

## Notes

- **No formatting changes**: The verification agent only adds a verification section - it doesn't modify the article content
- **No revisions**: Unlike the full editor agent, this only reports discrepancies - it doesn't request article revisions
- **Automatic**: Runs automatically when `EDITOR_NUMBER_VERIFICATION_ENABLED=true` and card moves to Submitted
- **Error handling**: If verification fails (e.g., missing source material), an error message is logged but the card isn't blocked

## Troubleshooting

### Verification Not Triggering

1. Check `EDITOR_NUMBER_VERIFICATION_ENABLED=true` in `.env.local`
2. Verify `TRELLO_LIST_ID_SUBMITTED` is set correctly
3. Check that Trello webhook is configured and working
4. Look for webhook logs in server console

### "Source material not available" Error

- The card must have PR_DATA or NOTE_DATA metadata
- Or the article must be in storage (prGeneratedArticles or analystGeneratedStories)
- Check card description for article view URLs

### "Article content not available" Error

- Article must be generated and stored
- Or article HTML must be in card description
- Check that article generation completed successfully

