# Analyst Notes Environment Variables

Add these to your `.env.local` file:

```env
# Analyst Notes Trello List
TRELLO_LIST_ID_ANALYST_NOTES=6947da04746b1474227ba3f4

# Email Configuration (Gmail IMAP)
EMAIL_TYPE=imap
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_IMAP_SECURE=true

# Email Filtering (Optional)
EMAIL_FILTER_FROM=analyst@firm.com,research@company.com
EMAIL_FILTER_SUBJECT=analyst note,research report,price target
EMAIL_CHECK_INTERVAL=5

# Analyst Tools (wiim-project-v2)
# Base URL for wiim-project-v2 (adjust port if different)
ANALYST_BASE_URL=http://localhost:3002

# Optional: AI Provider for article generation (if your endpoint requires it)
# ANALYST_AI_PROVIDER=openai
```

## Notes:

- **ANALYST_BASE_URL**: Base URL for your wiim-project-v2 app. The agent will use:
  - `${ANALYST_BASE_URL}/api/extract-pdf` for PDF extraction
  - `${ANALYST_BASE_URL}/api/generate/analyst-article` for article generation

- If your wiim-project-v2 runs on a different port, update `ANALYST_BASE_URL` accordingly




