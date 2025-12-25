# Manual Card Processing Setup

This guide explains how to manually create Trello cards for article generation.

## Overview

You can manually add cards to either the **PR-Related Stories** or **WGO/WIIM Stories** lists and have them processed for AI article generation.

## How to Create Manual Cards

### Step 1: Create a Card
1. Go to your Trello board
2. Create a new card in either:
   - **PR-Related Stories** list (for press releases)
   - **WGO/WIIM Stories** list (for news articles)

### Step 2: Set Card Title (Optional but Recommended)
- If you know the stock ticker, prefix the title: `MSFT... Article Title Here`
- Example: `MSFT... Company Announces New Product`
- The ticker prefix helps ensure the correct ticker is used for generation

### Step 3: Add URL to Description
Add the Benzinga article URL to the card description. You can use any of these formats:

**Format 1: Markdown Link**
```
[Article Title](https://www.benzinga.com/news/...)
```

**Format 2: Plain URL**
```
https://www.benzinga.com/news/...
```

**Format 3: Source Format**
```
**Source:** [View Original](https://www.benzinga.com/news/...)
```

### Step 4: "Process For AI" Button (Automatic!)

**🎉 Good News:** The "Process For AI" button is **automatically added** to your card!

The system runs a background check every 30 seconds that:
- Scans all cards in "PR-Related Stories" and "WGO/WIIM Stories" lists
- Detects cards with URLs in the description
- Automatically adds the "Process For AI" button if missing

**Just wait up to 30 seconds** after saving a URL in the card description, and the button will appear automatically!

**Manual Option:** If you want to add the button immediately, you can manually add it to the card description:

```
---
**[Process For AI](http://localhost:3001/trello/process-card/CARD_ID)**
```

**Note:** Replace `CARD_ID` with the actual Trello card ID. You can find the card ID by:
- Clicking on the card
- Looking at the URL: `https://trello.com/c/CARD_ID/card-name`
- Or using the card's permalink

**Alternative:** You can also use the helper endpoint to add buttons to all cards in a list at once:
```
http://localhost:3001/trello/add-process-buttons/YOUR_LIST_ID
```

### Step 5: Click "Process For AI"
1. Click the "Process For AI" button in the card
2. The system will:
   - Fetch the article content from Benzinga
   - Extract article metadata (ticker, date, summary)
   - Update the card with article information
   - Replace "Process For AI" with "Generate Article" button

### Step 6: Generate Article
1. After processing, click the **"Generate Article"** button
2. The article generation process will begin
3. The card will move to "In Progress" while generating
4. Once complete, the card will move to "Submitted" with the generated article link

## Automatic Processing (Alternative)

If you create a card with a URL but forget to add the "Process For AI" button, the system will automatically detect it when you try to generate an article and will add the button for you. However, you'll still need to click it to process the card first.

## Example Card Format

**Title:**
```
MSFT... Microsoft Announces New AI Partnership
```

**Description:**
```
https://www.benzinga.com/news/25/12/12345678/microsoft-announces-new-ai-partnership

---
**[Process For AI](http://localhost:3001/trello/process-card/abc123def456)**
```

## Troubleshooting

**Problem:** "Process For AI" button doesn't work
- **Solution:** Make sure the card ID in the URL matches the actual Trello card ID

**Problem:** Processing fails with "Article not found"
- **Solution:** Ensure the URL is a valid Benzinga article URL. The system extracts the article ID from the URL format.

**Problem:** Wrong ticker used in generated article
- **Solution:** Add ticker prefix to card title (e.g., `MSFT... Title`) before processing

**Problem:** Card not in correct list
- **Solution:** Make sure the card is in either "PR-Related Stories" or "WGO/WIIM Stories" list. The system determines article type based on which list the card is in.

