# Analyst Email Monitor Setup

## Email Access Requirements

The Email Monitor Agent needs access to your email inbox to fetch analyst notes. Here are the options:

### Option 1: Gmail API (Recommended - Most Secure)

**Required Information:**
1. **Gmail Account** - The email address that receives analyst notes
2. **OAuth 2.0 Credentials** - Generated from Google Cloud Console
   - Client ID
   - Client Secret
   - Refresh Token

**Setup Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable "Gmail API"
4. Create OAuth 2.0 credentials (OAuth client ID)
5. Use OAuth 2.0 Playground to generate refresh token

**Environment Variables Needed:**
```env
EMAIL_TYPE=gmail
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
EMAIL_CLIENT_SECRET=your-client-secret
EMAIL_REFRESH_TOKEN=your-refresh-token
```

**Pros:** 
- Most secure (OAuth tokens)
- No password needed
- Works with 2FA enabled
- Can revoke access anytime

**Cons:**
- More setup steps required

---

### Option 2: IMAP (Simple but Less Secure)

**Required Information:**
1. **Email Address**
2. **IMAP Server** (e.g., `imap.gmail.com`, `imap.outlook.com`)
3. **IMAP Port** (usually 993 for SSL, 143 for non-SSL)
4. **Email Password** (or App Password if 2FA enabled)

**Environment Variables Needed:**
```env
EMAIL_TYPE=imap
EMAIL_ADDRESS=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_IMAP_SECURE=true
```

**Gmail App Password:**
- If 2FA is enabled, you need an "App Password"
- Go to Google Account → Security → App Passwords
- Generate password for "Mail" app

**Pros:**
- Simple setup
- Works with most email providers

**Cons:**
- Less secure (password in env file)
- Gmail requires App Password (2FA accounts)

---

### Option 3: Microsoft 365 / Outlook (OAuth Recommended)

Similar to Gmail, but uses Microsoft Graph API.

**Environment Variables Needed:**
```env
EMAIL_TYPE=outlook
EMAIL_ADDRESS=your-email@outlook.com
EMAIL_TENANT_ID=your-tenant-id
EMAIL_CLIENT_ID=your-client-id
EMAIL_CLIENT_SECRET=your-client-secret
EMAIL_REFRESH_TOKEN=your-refresh-token
```

---

## Email Filtering Configuration

The agent needs to know which emails contain analyst notes. You'll configure:

**Environment Variables:**
```env
# Filter by sender (comma-separated)
EMAIL_FILTER_FROM=analyst@firm.com,notes@research.com

# Filter by subject keywords (comma-separated)
EMAIL_FILTER_SUBJECT=analyst note,research report,price target

# Filter by label/folder (Gmail only)
EMAIL_FILTER_LABEL=Analyst Notes

# How often to check (in minutes)
EMAIL_CHECK_INTERVAL=5
```

---

## Which Option Should You Use?

- **Gmail** → Use Gmail API (OAuth)
- **Outlook/Office 365** → Use Microsoft Graph API (OAuth)
- **Other providers** → Use IMAP
- **Need simplicity** → Use IMAP with App Password

---

## Security Notes

- **Never commit** `.env.local` to git
- Use **App Passwords** instead of main password when possible
- **OAuth tokens** are more secure than passwords
- Consider using environment variable secrets in production




