# Analyst Notes Feature - Setup Summary

This document summarizes everything needed to set up the Analyst Notes monitoring and story generation feature.

---

## Architecture Overview

**Two Separate Agents:**

1. **Email Monitor Agent** (`email-analyst-agent.ts`)
   - Monitors email inbox
   - Extracts analyst notes from emails
   - Creates Trello cards in "Analyst Notes" list

2. **Analyst Story Generator Agent** (`analyst-story-agent.ts`)
   - Reads analyst notes from Trello cards
   - Uses scraping tool (wiim-project-v2)
   - Uses story generator tool (wiim-project-v2)
   - Updates Trello cards with generated stories

---

## Setup Checklist

### ✅ Step 1: Email Access Setup

**Choose your email method:**
- [ ] **Gmail API** (OAuth - Recommended) → See `ANALYST_EMAIL_SETUP.md`
- [ ] **IMAP** (Simple) → See `ANALYST_EMAIL_SETUP.md`
- [ ] **Outlook/365** (OAuth) → See `ANALYST_EMAIL_SETUP.md`

**Required Information:**
- Email address that receives analyst notes
- Email credentials (API keys or password)
- Email filtering rules (sender, subject keywords)

**Files to Review:**
- `ANALYST_EMAIL_SETUP.md` - Complete email setup guide

---

### ✅ Step 2: Trello Configuration

**Action Items:**
1. [ ] Run `npm run get-trello-ids` to get your "Analyst Notes" List ID
2. [ ] Add `TRELLO_LIST_ID_ANALYST_NOTES` to `.env.local`
3. [ ] Verify `TRELLO_LIST_ID_IN_PROGRESS` is set (for story generation workflow)
4. [ ] Verify `TRELLO_LIST_ID_SUBMITTED` is set (for completed stories)

**Environment Variables to Add:**
```env
TRELLO_LIST_ID_ANALYST_NOTES=your-list-id-here
```

**Files to Review:**
- `ANALYST_TRELLO_SETUP.md` - Complete Trello setup guide

---

### ✅ Step 3: wiim-project-v2 Tools Integration

**Action Items:**
1. [ ] Identify scraping tool endpoint in `wiim-project-v2`
2. [ ] Identify story generator endpoint in `wiim-project-v2`
3. [ ] Test both endpoints are working
4. [ ] Add URLs to `.env.local`

**Environment Variables to Add:**
```env
ANALYST_SCRAPER_URL=http://localhost:3002/api/analyst/scrape
ANALYST_STORY_GENERATOR_URL=http://localhost:3002/api/analyst/generate-story
```

**Files to Review:**
- `ANALYST_TOOLS_INTEGRATION.md` - Complete integration guide

---

## Environment Variables Summary

After completing all steps, your `.env.local` should include:

```env
# Existing Trello Configuration
TRELLO_API_KEY=your-api-key
TRELLO_TOKEN=your-token
TRELLO_BOARD_ID=your-board-id

# Existing Lists
TRELLO_LIST_ID=...
TRELLO_LIST_ID_PR=...
TRELLO_LIST_ID_WGO=...
TRELLO_LIST_ID_IN_PROGRESS=...
TRELLO_LIST_ID_SUBMITTED=...

# NEW: Analyst Notes List
TRELLO_LIST_ID_ANALYST_NOTES=your-analyst-notes-list-id

# Email Configuration (choose one method)
# Option 1: Gmail API
EMAIL_TYPE=gmail
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_CLIENT_ID=...
EMAIL_CLIENT_SECRET=...
EMAIL_REFRESH_TOKEN=...

# Option 2: IMAP
# EMAIL_TYPE=imap
# EMAIL_ADDRESS=your-email@gmail.com
# EMAIL_PASSWORD=your-app-password
# EMAIL_IMAP_HOST=imap.gmail.com
# EMAIL_IMAP_PORT=993
# EMAIL_IMAP_SECURE=true

# Email Filtering
EMAIL_FILTER_FROM=analyst@firm.com,notes@research.com
EMAIL_FILTER_SUBJECT=analyst note,research report
EMAIL_CHECK_INTERVAL=5

# Analyst Tools (wiim-project-v2)
ANALYST_SCRAPER_URL=http://localhost:3002/api/analyst/scrape
ANALYST_STORY_GENERATOR_URL=http://localhost:3002/api/analyst/generate-story
```

---

## Workflow

### Email Monitoring Flow:
1. Email Monitor Agent polls inbox every 5 minutes
2. Finds emails matching filter criteria
3. Extracts analyst note content
4. Creates Trello card in "Analyst Notes" list
5. Stores full email data in card description

### Story Generation Flow:
1. User clicks "Generate Story" button in Trello card
2. Story Generator Agent reads card data
3. Moves card to "In Progress"
4. Calls scraping tool → extracts structured data
5. Calls story generator tool → generates story
6. Updates Trello card with story link
7. Moves card to "Submitted" list

---

## Next Steps

Once you've completed the setup:

1. **Review the setup guides:**
   - `ANALYST_EMAIL_SETUP.md` - Email configuration
   - `ANALYST_TRELLO_SETUP.md` - Trello list setup
   - `ANALYST_TOOLS_INTEGRATION.md` - Tool integration details

2. **Provide the following information:**
   - Email access method and credentials
   - Trello "Analyst Notes" List ID (from `npm run get-trello-ids`)
   - Scraping tool endpoint details
   - Story generator endpoint details

3. **Ready for coding!**
   - I'll create both agents
   - Set up server endpoints
   - Integrate with your tools
   - Test the full workflow

---

## Questions?

If you need clarification on any step:
- Check the individual setup guides
- Test your endpoints/tools first
- Share any specific requirements or constraints

**Ready when you are!** 🚀




