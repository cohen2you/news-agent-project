/**
 * Email Analyst Agent
 * Monitors email inbox for analyst notes and creates Trello cards
 */

import {
  StateGraph,
  Annotation,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { EmailService, EmailFilter } from "./email-service";
import { TrelloService } from "./trello-service";
import { formatPubDate } from "./date-utils";
import { extractPDFText } from "./analyst-tools-integration";

// Email Analyst Agent State
const EmailAnalystAgentState = Annotation.Root({
  emailMessages: Annotation<any[]>,  // Fetched email messages
  extractedNotes: Annotation<any[]>, // Extracted analyst notes from emails
  trelloCards: Annotation<string[]>, // Created Trello card URLs
});

// NODE A: Email Monitor - Fetch emails from inbox
const emailMonitorNode = async (state: typeof EmailAnalystAgentState.State) => {
  console.log(`\n📧 EMAIL MONITOR: Fetching analyst notes from email inbox...`);

  try {
    const emailService = new EmailService();

    // Build filter from environment variables
    const filter: EmailFilter = {
      unreadOnly: true, // Only fetch unread emails
    };

    // Add sender filter if configured
    const fromFilter = process.env.EMAIL_FILTER_FROM;
    if (fromFilter) {
      filter.from = fromFilter.split(',').map(s => s.trim());
      console.log(`   📋 Filtering by sender: ${filter.from.join(', ')}`);
    }

    // Add subject filter if configured
    const subjectFilter = process.env.EMAIL_FILTER_SUBJECT;
    if (subjectFilter) {
      filter.subject = subjectFilter.split(',').map(s => s.trim());
      console.log(`   📋 Filtering by subject keywords: ${filter.subject.join(', ')}`);
    }

    // Fetch emails
    const emails = await emailService.fetchEmails(filter);
    console.log(`   ✅ Found ${emails.length} matching email(s)`);

    emailService.disconnect();

    return {
      emailMessages: emails || [],
    };
  } catch (error: any) {
    console.error("❌ Error fetching emails:", error);
    return {
      emailMessages: [],
    };
  }
};

// NODE B: Extract Analyst Notes - Parse emails and extract note information
const extractNotesNode = async (state: typeof EmailAnalystAgentState.State) => {
  console.log(`\n🔍 EXTRACT NOTES: Processing ${state.emailMessages.length} email(s)...`);

  const extractedNotes: any[] = [];

  for (let i = 0; i < state.emailMessages.length; i++) {
    const email = state.emailMessages[i];
    try {
      console.log(`\n   📧 Processing email ${i + 1}/${state.emailMessages.length}: ${email.subject?.substring(0, 50) || 'No subject'}...`);
      
      // Find ALL PDF attachments (not just the first one)
      const pdfAttachments: any[] = [];
      if (email.attachments && email.attachments.length > 0) {
        const pdfAtts = email.attachments.filter((att: any) => 
          att.contentType === 'application/pdf' || 
          att.filename?.toLowerCase().endsWith('.pdf')
        );
        
        console.log(`   📎 Found ${pdfAtts.length} PDF attachment(s) in email`);
        
        for (const pdfAtt of pdfAtts) {
          if (pdfAtt && pdfAtt.content) {
            pdfAttachments.push({
              filename: pdfAtt.filename || 'analyst-note.pdf',
              contentType: pdfAtt.contentType || 'application/pdf',
              size: pdfAtt.size || pdfAtt.content.length,
              content: pdfAtt.content, // Store PDF buffer for attachment to Trello card
            });
          }
        }
      }
      
      // If no PDFs found, create one note from email content
      // If PDFs found, create one note per PDF
      const notesToProcess = pdfAttachments.length > 0 ? pdfAttachments : [null];
      
      for (let pdfIndex = 0; pdfIndex < notesToProcess.length; pdfIndex++) {
        const pdfAttachment = notesToProcess[pdfIndex];
        let extractedPdfText: string | null = null;
        
        if (pdfAttachment) {
          console.log(`   📎 Processing PDF ${pdfIndex + 1}/${notesToProcess.length}: ${pdfAttachment.filename} (${pdfAttachment.size} bytes)`);
          
          // Extract PDF text immediately (before ticker extraction so we can search PDF for ticker)
          // Use direct pdf-parse library - no HTTP calls, no FormData/Blob issues
          try {
            console.log(`   🔄 Extracting text from PDF before creating card...`);
            extractedPdfText = await extractPDFText(pdfAttachment.content, pdfAttachment.filename);
            console.log(`   ✅ PDF text extracted: ${extractedPdfText.length} characters`);
          } catch (error: any) {
            console.error(`   ⚠️  Failed to extract PDF text:`, error);
            console.log(`   ⚠️  Will use email text content as fallback`);
            // Continue with email text content as fallback
          }
        } else {
          console.log(`   📝 No PDF attachments found, using email content`);
        }

        // Determine content to use: extracted PDF text > email text > email HTML
        let noteContent = '';
        if (extractedPdfText && extractedPdfText.trim().length > 0) {
          noteContent = extractedPdfText;
          console.log(`   📝 Using extracted PDF text as content (${noteContent.length} characters)`);
        } else {
          // Clean up email HTML/text
          const emailText = email.text || email.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          noteContent = emailText;
          console.log(`   📝 Using email text/HTML as content (${noteContent.length} characters)`);
          
          // Log warning if content is very short (might indicate PDF extraction failed)
          if (noteContent.length < 200 && pdfAttachment) {
            console.warn(`   ⚠️  WARNING: Content is very short (${noteContent.length} chars) but PDF was found. PDF extraction may have failed.`);
          }
        }

        // Extract ticker from PDF content (if available) or email subject/body
        // Common patterns: "TSLA", "[TSLA]", "TSLA:", "Tesla (TSLA)", "NYSE:TSLA", "NASDAQ:TSLA"
        // Prioritize patterns that are more likely to be actual tickers (in brackets, parentheses, or after exchange names)
        const tickerRegex = /(?:NYSE|NASDAQ|AMEX|OTC)[:\s]+([A-Z]{1,5})\b|\[([A-Z]{1,5})\]|\(([A-Z]{1,5})\)|(?<![A-Z])\b([A-Z]{2,5})\b(?![A-Z])/gi;
        let ticker: string | null = null;
      
      // Common false positives to filter out
      const falsePositives = new Set([
        // Common English words (very frequent in documents)
        'THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'DAY', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'TWO', 'WAY', 'WHO', 'BOY', 'DID', 'LET', 'PUT', 'SAY', 'SHE', 'TOO', 'USE',
        'OF', 'TO', 'IN', 'ON', 'AT', 'BY', 'AS', 'IS', 'IT', 'AN', 'BE', 'DO', 'GO', 'IF', 'MY', 'NO', 'OR', 'SO', 'UP', 'WE',
        // Common words that appear capitalized in PDFs (critical false positives)
        'ANY', 'BUY', 'SELL', 'HOLD', 'WITH', 'THIS', 'THAT', 'WHICH', 'FROM', 'OVER', 'UNDER', 'ABOUT', 'AFTER', 'BEFORE', 'ABOVE', 'BELOW',
        'COM', 'NET', 'APP', 'WEB', 'API', 'URL', 'PDF', 'DOC', 'TXT', 'CSV', 'XML', 'JSON',
        // Company suffixes
        'INC', 'CORP', 'LTD', 'LLC', 'CO', 'LP', 'LLP', 'PLC',
        // Common abbreviations in financial documents
        'ASV', 'FY', 'Q1', 'Q2', 'Q3', 'Q4', 'EPS', 'EBITDA', 'GAAP', 'NON', 'PRO', 'PRE', 'POST',
        // Financial metrics and time periods (basis points, year over year, etc.)
        'BPS', 'YOY', 'QOQ', 'MOM', 'YTD', 'MTD', 'WTD', 'NAV', 'AUM', 'PEG', 'ROA', 'ROE', 'ROI',
        // Other common false positives
        'USD', 'CAD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'NZD',
        'CEO', 'CFO', 'CTO', 'COO', 'VP', 'SVP', 'EVP',
        'IPO', 'M&A', 'P/E', 'P/B', 'EV',
        'SEC', 'IRS', 'FDA', 'EPA', 'FTC', 'DOJ',
        'EST', 'PST', 'GMT', 'UTC',
        'AM', 'PM', 'ET', 'PT', 'CT', 'MT'
      ]);
      
        // First, try to extract from PDF content (if available) - this is more reliable
        if (noteContent && noteContent.trim().length > 0) {
        const contentMatches = Array.from(noteContent.matchAll(tickerRegex));
        if (contentMatches.length > 0) {
          // Count occurrences of each potential ticker
          const tickerCounts = new Map<string, number>();
          const tickerContexts = new Map<string, string[]>();
          
          for (const match of contentMatches) {
            // Prioritize exchange-prefixed matches (match[1]), then bracketed (match[2]), then parenthesized (match[3]), then standalone (match[4])
            const potentialTicker = (match[1] || match[2] || match[3] || match[4] || '').trim().toUpperCase();
            if (potentialTicker.length >= 2 && potentialTicker.length <= 5 && !falsePositives.has(potentialTicker)) {
              // Get context around the match (20 chars before and after)
              const matchIndex = match.index || 0;
              const contextStart = Math.max(0, matchIndex - 20);
              const contextEnd = Math.min(noteContent.length, matchIndex + match[0].length + 20);
              const context = noteContent.substring(contextStart, contextEnd).toLowerCase();
              
              tickerCounts.set(potentialTicker, (tickerCounts.get(potentialTicker) || 0) + 1);
              
              if (!tickerContexts.has(potentialTicker)) {
                tickerContexts.set(potentialTicker, []);
              }
              tickerContexts.get(potentialTicker)!.push(context);
            }
          }
          
          // Score tickers based on:
          // 1. Frequency (but penalize if too frequent - likely a common word)
          // 2. Context (appearing near financial terms, company names, or in brackets/parentheses)
          // 3. Pattern type (exchange-prefixed > bracketed > parenthesized > standalone)
          // 4. Relative frequency (tickers shouldn't appear hundreds of times)
          let bestTicker: string | null = null;
          let bestScore = 0;
          const documentLength = noteContent.length;
          const estimatedWordCount = documentLength / 5; // Rough estimate: ~5 chars per word
          
          // Collect all candidates with scores, then sort and pick the best
          const candidatesWithScores: Array<{ticker: string, score: number, count: number}> = [];
          
          for (const [candidate, count] of tickerCounts.entries()) {
            // Skip if it appears too frequently relative to document size (likely a common word)
            // If a ticker appears more than 5% of estimated words, it's probably not a ticker
            const frequencyRatio = count / estimatedWordCount;
            if (frequencyRatio > 0.05) {
              continue; // Skip silently - too frequent
            }
            
            // Base score starts lower and increases with context, not just frequency
            // This prevents common words from winning just because they appear often
            let score = Math.min(count, 10); // Cap base score at 10 to prevent frequency from dominating
            
            // Boost score if it appears in brackets or parentheses (more likely to be a ticker)
            const contexts = tickerContexts.get(candidate) || [];
            const hasBrackets = contexts.some(ctx => ctx.includes('[') || ctx.includes(']'));
            const hasParentheses = contexts.some(ctx => ctx.includes('(') || ctx.includes(')'));
            const hasExchange = contexts.some(ctx => ctx.includes('nyse') || ctx.includes('nasdaq') || ctx.includes('amex'));
            
            // Length-based filtering: prefer 3-4 chars; allow 5+ only with strong context
            if (candidate.length > 4 && !hasExchange && !hasBrackets && !hasParentheses) {
              continue; // Too long and no strong context
            }
            
            if (hasExchange) score += 20; // Highest priority - exchange-prefixed is almost certainly a ticker
            if (hasBrackets) score += 10; // Bracketed is very likely a ticker
            if (hasParentheses) score += 5; // Parenthesized is likely a ticker
            
            // Length preferences
            if (candidate.length === 3) score += 3;
            else if (candidate.length === 4) score += 1;
            else if (candidate.length === 5 && !hasExchange && !hasBrackets && !hasParentheses) score -= 5;
            
            // Boost if it appears near financial terms
            const hasFinancialContext = contexts.some(ctx => 
              ctx.includes('revenue') || ctx.includes('earnings') || ctx.includes('profit') || 
              ctx.includes('growth') || ctx.includes('target') || ctx.includes('rating') ||
              ctx.includes('price') || ctx.includes('stock') || ctx.includes('share') ||
              ctx.includes('delivered') || ctx.includes('reported') || ctx.includes('announced') ||
              ctx.includes('quarter') || ctx.includes('results') || ctx.includes('guidance')
            );
            if (hasFinancialContext) score += 3;
            
            // Penalize if it appears near company suffixes (likely part of company name)
            const nearCompanySuffix = contexts.some(ctx => 
              ctx.includes(' inc') || ctx.includes(' corp') || ctx.includes(' ltd') || 
              ctx.includes(' llc') || ctx.includes(' company') || ctx.includes(' systems')
            );
            if (nearCompanySuffix && !hasBrackets && !hasParentheses && !hasExchange) {
              score -= 10; // Strong penalty if it's likely part of a company name
            }
            
            // Penalize very short tickers (2 letters) unless they have strong context
            if (candidate.length === 2 && !hasBrackets && !hasParentheses && !hasExchange && !hasFinancialContext) {
              score -= 5; // 2-letter tickers need strong evidence
            }
            
            // Only add candidates with positive scores
            if (score > 0) {
              candidatesWithScores.push({ ticker: candidate, score, count });
            }
          }
          
          // Sort by score (highest first), then prefer shorter tickers, then higher count
          candidatesWithScores.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (a.ticker.length !== b.ticker.length) return a.ticker.length - b.ticker.length;
            return b.count - a.count;
          });
          
          // Only log top 3 candidates for debugging
          if (candidatesWithScores.length > 0) {
            const topCandidates = candidatesWithScores.slice(0, 3);
            console.log(`   🔍 Top ticker candidates: ${topCandidates.map(c => `${c.ticker} (score: ${c.score}, count: ${c.count})`).join(', ')}`);
            bestTicker = topCandidates[0].ticker;
            bestScore = topCandidates[0].score;
          }
          
          if (bestTicker) {
            ticker = bestTicker;
            console.log(`   📊 Extracted ticker from PDF content: ${ticker} (score: ${bestScore}, occurrences: ${tickerCounts.get(ticker)})`);
          }
        }
      }
      
        // Fallback: extract from email subject/text if not found in PDF
        if (!ticker) {
          const searchText = `${email.subject} ${email.text}`.toUpperCase();
          const matches = Array.from(searchText.matchAll(tickerRegex));
          
          if (matches.length > 0) {
            // Try to find a ticker-like match (prioritize bracketed/parenthesized)
            for (const match of matches) {
              const potentialTicker = (match[1] || match[2] || match[3] || match[4] || '').trim().toUpperCase();
              if (potentialTicker.length >= 2 && potentialTicker.length <= 5 && !falsePositives.has(potentialTicker)) {
                ticker = potentialTicker;
                console.log(`   📊 Extracted ticker from email subject/text: ${ticker}`);
                break;
              }
            }
          }
        }

        // Extract analyst firm from email sender or body
        const fromEmail = email.from.match(/<(.+)>/)?.[1] || email.from;
        const firmMatch = email.text.match(/(?:firm|analyst|research|from)\s+([A-Z][A-Za-z\s&]+)/i);
        const firm = firmMatch?.[1]?.trim() || fromEmail.split('@')[1]?.split('.')[0] || 'Unknown Firm';

        // Extract analyst name from email
        const nameMatch = email.from.match(/^([^<]+)</)?.[1]?.trim();
        const analyst = nameMatch || 'Unknown Analyst';
        
        // Ensure we have some content
        if (!noteContent || noteContent.trim().length === 0) {
          noteContent = 'No content available from email or PDF.';
          console.warn(`   ⚠️  WARNING: No content extracted from email or PDF.`);
        }

        // Build note object - include PDF filename in subject if multiple PDFs
        const noteSubject = pdfAttachment && notesToProcess.length > 1 
          ? `${email.subject} - ${pdfAttachment.filename}`
          : email.subject;

        // Build note object
        // Store email ID as both string (for reference) and number (for marking as read)
        const emailIdNum = typeof email.id === 'string' ? parseInt(email.id, 10) : email.id;
        const note = {
          emailId: email.id, // String ID for reference
          emailUid: isNaN(emailIdNum) ? null : emailIdNum, // Numeric UID for marking as read
          subject: noteSubject,
          from: email.from,
          date: email.date,
          ticker: ticker,
          firm: firm,
          analyst: analyst,
          content: noteContent, // Use extracted PDF text or email text
          html: email.html,
          pdfAttachment: pdfAttachment, // PDF metadata (no content)
          extractedPdfText: extractedPdfText, // Store extracted text separately for reference
          originalEmail: email,
        };

        extractedNotes.push(note);
        console.log(`   ✅ Extracted note ${pdfIndex + 1}/${notesToProcess.length} from email ${i + 1}/${state.emailMessages.length}: ${ticker || 'No ticker'} - ${noteSubject?.substring(0, 50) || 'No subject'}...`);
      } // End of PDF loop

    } catch (error: any) {
      console.error(`   ❌ Error extracting note from email ${i + 1}/${state.emailMessages.length} (ID: ${email.id}):`, error);
      console.error(`   ⚠️  Continuing with next email...`);
      // Continue processing other emails even if one fails
    }
  }
  
  console.log(`\n   ✅ Completed processing ${state.emailMessages.length} email(s), extracted ${extractedNotes.length} note(s)`);
  console.log(`   📋 Notes ready for Trello card creation:`);
  extractedNotes.slice(0, 5).forEach((note, i) => {
    console.log(`      ${i + 1}. ${note.ticker || 'No ticker'} - ${note.subject?.substring(0, 50)}...`);
  });
  if (extractedNotes.length > 5) {
    console.log(`      ... and ${extractedNotes.length - 5} more`);
  }

  console.log(`   🔄 Returning ${extractedNotes.length} extracted notes to next node (trello_cards)...`);

  return {
    extractedNotes: extractedNotes,
  };
};

// NODE C: Trello Card Creation - Create Trello cards for each analyst note
const trelloCardCreationNode = async (state: typeof EmailAnalystAgentState.State) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📌 TRELLO CARDS: Starting card creation for ${state.extractedNotes?.length || 0} note(s)...`);
  console.log(`${"=".repeat(60)}`);
  console.log(`   🔍 State check: extractedNotes = ${state.extractedNotes ? 'exists' : 'MISSING'}, length = ${state.extractedNotes?.length || 0}`);

  if (!state.extractedNotes || state.extractedNotes.length === 0) {
    console.warn(`   ⚠️  No extracted notes found in state, skipping card creation`);
    return {
      trelloCards: [],
    };
  }

  try {
    const trello = new TrelloService();
    const listId = process.env.TRELLO_LIST_ID_ANALYST_NOTES;

    console.log(`   📋 Trello List ID: ${listId || 'NOT SET'}`);
    if (!listId) {
      console.error("❌ TRELLO_LIST_ID_ANALYST_NOTES not set in environment variables");
      console.error("   💡 Add TRELLO_LIST_ID_ANALYST_NOTES to .env.local");
      return {
        trelloCards: [],
      };
    }
    console.log(`   ✅ Trello List ID configured: ${listId}`);

    const baseUrl = process.env.APP_URL || 'http://localhost:3001';
    const generateArticleUrl = `${baseUrl}/analyst-story/generate/{cardId}`;

    const createdCards: string[] = [];
    console.log(`   🔄 Processing ${state.extractedNotes.length} note(s) to create Trello cards...`);
    console.log(`   ⏱️  Rate limiting: Adding 200ms delay between cards to avoid Trello rate limits`);

    for (let i = 0; i < state.extractedNotes.length; i++) {
      const note = state.extractedNotes[i];
      console.log(`\n   📝 [${i + 1}/${state.extractedNotes.length}] Creating card for note: ${note.ticker || 'No ticker'} - ${note.subject?.substring(0, 50)}...`);
      
      // Rate limiting: Add delay between card creations to avoid hitting Trello's rate limits
      // Trello allows ~100 requests per 10 seconds, so 200ms delay = ~5 requests/second = safe
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      try {
        // Create card title with ticker prefix if available
        let title = note.subject;
        if (note.ticker) {
          title = `${note.ticker}... ${title}`;
        }
        
        // Format date and add timestamp prefix to title
        const noteDate = note.date || new Date();
        const datePrefix = formatPubDate(noteDate);
        title = `${datePrefix} ${title}`;
        
        console.log(`      📋 Card title: ${title.substring(0, 60)}...`);

        // Build card description
        // Start with the "Generate Story" button at the top for easy access
        // NOTE: The URL will be updated after card creation to include the actual card ID
        let description = `**[Generate Story](${generateArticleUrl})**\n\n`;
        description += `---\n\n`;
        
        console.log(`      🔗 Generate Story URL (before card creation): ${generateArticleUrl}`);
        
        // Show preview of content (PDF text if extracted, or email text as fallback)
        // Keep preview small to leave room for metadata and NOTE_DATA
        const contentPreviewLength = 1000; // Reduced from 2000 to leave more room for NOTE_DATA
        const contentPreview = note.content ? note.content.substring(0, contentPreviewLength) : 'No content available';
        const contentTruncated = note.content && note.content.length > contentPreviewLength;
        description += `${contentPreview}${contentTruncated ? '...' : ''}\n\n`;
        
        // Add indicator if PDF text was successfully extracted
        if (note.extractedPdfText && note.extractedPdfText.trim().length > 0) {
          description += `_✅ PDF content extracted (${note.extractedPdfText.length} chars). Full text stored in card data._\n\n`;
        } else if (note.pdfAttachment) {
          description += `_⚠️ Note: PDF attachment found but text extraction not available. Using email content._\n\n`;
        }

        description += `---\n\n`;
        description += `**Firm:** ${note.firm}\n`;
        description += `**Analyst:** ${note.analyst}\n`;
        if (note.ticker) {
          description += `**Ticker:** ${note.ticker}\n`;
        }
        description += `**Date:** ${note.date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZoneName: 'short'
        })}\n`;
        description += `**Source:** ${note.from}\n\n`;
        description += `**Source Email:** [View Original Email](${note.originalEmail.headers['message-id'] || '#'})\n\n`;

        // Store note data as base64 for later retrieval (hidden in HTML comment)
        // IMPORTANT: Remove PDF content and truncate large fields to prevent exceeding Trello's description limit
        try {
          // Create a copy to avoid modifying the original
          const noteDataCopy: any = {
            emailId: note.emailId,
            subject: note.subject,
            from: note.from,
            date: note.date,
            ticker: note.ticker,
            firm: note.firm,
            analyst: note.analyst,
            // Content is already extracted PDF text (not binary), so we can store more of it
            // But still truncate to prevent exceeding Trello's description limit
            content: note.content || '', // Full extracted text (PDF text already extracted upfront)
            html: note.html ? note.html.substring(0, 5000) + (note.html.length > 5000 ? '...' : '') : '',
            // Store PDF metadata (no binary content in NOTE_DATA - text already extracted and in 'content' field)
            // PDF buffer is stored separately in note.pdfAttachment.content for Trello attachment
            pdfAttachment: note.pdfAttachment ? {
              filename: note.pdfAttachment.filename,
              contentType: note.pdfAttachment.contentType,
              size: note.pdfAttachment.size || 0,
              // DO NOT include content in NOTE_DATA - it's too large and text is already in 'content' field
            } : undefined,
            // Store extracted PDF text reference (though it's also in 'content')
            extractedPdfText: note.extractedPdfText || null,
            // Store minimal original email data (just headers, not full content)
            originalEmail: {
              headers: note.originalEmail?.headers || {},
            },
          };
          
          const noteDataJson = JSON.stringify(noteDataCopy);
          const noteDataBase64 = Buffer.from(noteDataJson).toString('base64');
          
          // Check if NOTE data section would make description too long
          const noteDataSectionTest = `\n\n<!-- NOTE_DATA:${noteDataBase64} -->`;
          const totalLength = description.length + noteDataSectionTest.length;
          
          // Trello limit is 16,384 chars, but be conservative and use 12,000
          const maxTotalLength = 12000;
          
          if (totalLength > maxTotalLength) {
            // If NOTE data is too large, truncate it further or remove less essential fields
            console.warn(`⚠️  NOTE data too large (${noteDataBase64.length} chars base64), truncating...`);
            
            // Remove or truncate less essential fields
            const essentialFields = {
              emailId: noteDataCopy.emailId,
              subject: noteDataCopy.subject,
              from: noteDataCopy.from,
              date: noteDataCopy.date,
              ticker: noteDataCopy.ticker,
              firm: noteDataCopy.firm,
              analyst: noteDataCopy.analyst,
              // Content is already text (PDF extracted), keep more of it
              content: noteDataCopy.content ? noteDataCopy.content.substring(0, 10000) + (noteDataCopy.content.length > 10000 ? '...' : '') : '',
              // Remove HTML entirely if too large
              html: '',
              // Keep PDF metadata
              pdfAttachment: noteDataCopy.pdfAttachment,
            };
            
            const essentialJson = JSON.stringify(essentialFields);
            const essentialBase64 = Buffer.from(essentialJson).toString('base64');
            const essentialSection = `\n\n<!-- NOTE_DATA:${essentialBase64} -->`;
            
            // Final check - if still too long, just store minimal data
            const finalLength = description.length + essentialSection.length;
            if (finalLength > maxTotalLength) {
              // Calculate how much space we have for content
              const baseFields = {
                emailId: noteDataCopy.emailId,
                subject: noteDataCopy.subject,
                ticker: noteDataCopy.ticker,
                firm: noteDataCopy.firm,
                analyst: noteDataCopy.analyst,
              };
              const baseJson = JSON.stringify(baseFields);
              const baseBase64 = Buffer.from(baseJson).toString('base64');
              const baseSection = `\n\n<!-- NOTE_DATA:${baseBase64} -->`;
              const availableForContent = maxTotalLength - description.length - baseSection.length - 500; // 500 char buffer
              
              // Estimate max content length (base64 is ~1.33x original)
              const maxContentLength = availableForContent > 0 ? Math.floor(availableForContent / 1.4) : 0;
              
              const minimalFields: any = {
                ...baseFields,
                // CRITICAL: Include content even in minimal fallback (truncated to fit)
                // The content is the extracted PDF text which is essential for story generation
                content: noteDataCopy.content && maxContentLength > 0 
                  ? noteDataCopy.content.substring(0, maxContentLength) + (noteDataCopy.content.length > maxContentLength ? '...' : '')
                  : '', // If no space, content will be extracted from description
              };
              
              const minimalJson = JSON.stringify(minimalFields);
              const minimalBase64 = Buffer.from(minimalJson).toString('base64');
              const minimalSection = `\n\n<!-- NOTE_DATA:${minimalBase64} -->`;
              
              // Final check: if still too long, remove content entirely
              if (description.length + minimalSection.length > maxTotalLength) {
                console.warn(`⚠️  Still too long, removing content from NOTE_DATA (will extract from description)`);
                description += baseSection;
              } else {
                description += minimalSection;
                console.warn(`⚠️  Using minimal NOTE data with ${minimalFields.content.length} chars of content`);
              }
            } else {
              description += essentialSection;
            }
          } else {
            // Use HTML comment format - truly hidden in Trello (not displayed)
            description += noteDataSectionTest;
          }
        } catch (error) {
          console.warn('Failed to encode note data:', error);
        }

        // CRITICAL: Final safety check - Trello's hard limit is 16,384 characters
        // Truncate description if it exceeds the limit
        const TRELLO_MAX_LENGTH = 16384;
        if (description.length > TRELLO_MAX_LENGTH) {
          console.error(`❌ ERROR: Description too long (${description.length} chars). Truncating to ${TRELLO_MAX_LENGTH}...`);
          // Calculate how much we need to truncate
          const truncationNeeded = description.length - TRELLO_MAX_LENGTH + 100; // 100 char buffer
          // Truncate from the content preview section (not from NOTE_DATA which is essential)
          const contentPreviewEnd = description.indexOf('\n\n---\n\n**Firm:**');
          if (contentPreviewEnd > 0) {
            // Truncate the content preview section
            const beforeContent = description.substring(0, description.indexOf('\n\n---\n\n') + 7);
            const afterContent = description.substring(contentPreviewEnd);
            const maxContentLength = TRELLO_MAX_LENGTH - beforeContent.length - afterContent.length - 50; // 50 char buffer
            const truncatedContent = description.substring(description.indexOf('\n\n---\n\n') + 7, contentPreviewEnd).substring(0, maxContentLength);
            description = beforeContent + truncatedContent + '...\n\n[Content truncated due to Trello size limits]' + afterContent;
          } else {
            // Fallback: just truncate the whole thing
            description = description.substring(0, TRELLO_MAX_LENGTH - 100) + '\n\n[Description truncated due to Trello size limits]';
          }
        }
        
        // Final verification
        if (description.length > TRELLO_MAX_LENGTH) {
          console.error(`❌ CRITICAL: Description still too long after truncation (${description.length} chars). Force truncating...`);
          description = description.substring(0, TRELLO_MAX_LENGTH - 50) + '\n\n[Truncated]';
        }
        
        console.log(`      📏 Final description length: ${description.length} characters (Trello limit: ${TRELLO_MAX_LENGTH})`);
        
        // Create Trello card
        console.log(`      🔄 Calling trello.createCard()...`);
        console.log(`         - List ID: ${listId}`);
        console.log(`         - Title: ${title.substring(0, 60)}...`);
        const card = await trello.createCard(listId, title, description);
        console.log(`      ✅ Trello card created successfully!`);
        console.log(`         - Card ID: ${card.id}`);
        console.log(`         - Card URL: ${card.url}`);

        // Update card with generate link that includes actual card ID
        const updatedGenerateUrl = generateArticleUrl.replace('{cardId}', card.id);
        console.log(`      🔗 Generate Story URL (after card creation): ${updatedGenerateUrl}`);
        description = description.replace(generateArticleUrl, updatedGenerateUrl);
        
        // Verify the replacement worked
        if (description.includes('{cardId}')) {
          console.error(`      ⚠️  WARNING: Card ID replacement failed! Description still contains {cardId}`);
          // Try a more aggressive replacement
          description = description.replace(/\{cardId\}/g, card.id);
        }
        
        await trello.updateCardDescription(card.id, description);
        console.log(`      ✅ Updated card description with Generate Story button`);

        // Attach PDF file to the card if available
        if (note.pdfAttachment && note.pdfAttachment.content && Buffer.isBuffer(note.pdfAttachment.content)) {
          try {
            await trello.attachFileToCard(
              card.id,
              note.pdfAttachment.content,
              note.pdfAttachment.filename || 'analyst-note.pdf',
              note.pdfAttachment.contentType || 'application/pdf'
            );
            console.log(`   📎 PDF attached to Trello card: ${note.pdfAttachment.filename}`);
          } catch (error: any) {
            console.error(`   ⚠️  Failed to attach PDF to card:`, error);
            // Continue even if attachment fails - card is still created
          }
        }

        createdCards.push(card.url);
        console.log(`      ✅ [${i + 1}/${state.extractedNotes.length}] Successfully created card: ${title.substring(0, 50)}...`);

      } catch (error: any) {
        console.error(`\n      ❌ [${i + 1}/${state.extractedNotes.length}] ERROR creating Trello card:`);
        console.error(`         Error message: ${error.message || error}`);
        console.error(`         Error stack: ${error.stack || 'No stack trace'}`);
        if (error.response) {
          console.error(`         HTTP Status: ${error.response.status}`);
          console.error(`         Response: ${JSON.stringify(error.response.data || {}).substring(0, 300)}`);
        }
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📌 TRELLO CARDS: Completed card creation`);
    console.log(`   ✅ Successfully created: ${createdCards.length} card(s)`);
    console.log(`   ❌ Failed: ${state.extractedNotes.length - createdCards.length} card(s)`);
    if (createdCards.length > 0) {
      console.log(`   📋 Created card URLs:`);
      createdCards.slice(0, 5).forEach((url, i) => {
        console.log(`      ${i + 1}. ${url}`);
      });
      if (createdCards.length > 5) {
        console.log(`      ... and ${createdCards.length - 5} more`);
      }
    }
    console.log(`${"=".repeat(60)}\n`);

    // Mark emails as read after successful card creation
    // This prevents the same emails from being processed again
    // Only mark emails as read if ALL notes from that email were successfully processed
    if (createdCards.length > 0) {
      try {
        console.log(`\n📧 Marking processed emails as read...`);
        const emailService = new EmailService();
        
        // Collect unique email UIDs from all processed notes
        // We mark emails as read after processing to prevent them from being fetched again
        // (since we filter by unreadOnly: true)
        const processedEmailUids = new Set<number>();
        
        for (const note of state.extractedNotes) {
          // Get UID for this note's email
          let emailUid: number | null = null;
          
          if (note.emailUid && typeof note.emailUid === 'number') {
            emailUid = note.emailUid;
          } else if (note.emailId) {
            // Fallback: parse emailId string to number
            const emailIdNum = typeof note.emailId === 'string' ? parseInt(note.emailId, 10) : note.emailId;
            if (!isNaN(emailIdNum) && emailIdNum > 0) {
              emailUid = emailIdNum;
            }
          }
          
          if (emailUid !== null) {
            processedEmailUids.add(emailUid);
          }
        }
        
        if (processedEmailUids.size > 0) {
          const emailUidsArray = Array.from(processedEmailUids);
          console.log(`   📧 Marking ${emailUidsArray.length} email(s) as read (UIDs: ${emailUidsArray.slice(0, 5).join(', ')}${emailUidsArray.length > 5 ? '...' : ''})...`);
          await emailService.markAsRead(emailUidsArray);
          console.log(`   ✅ Marked ${emailUidsArray.length} email(s) as read - they won't be processed again`);
          console.log(`   💡 Note: If some cards failed to create, you can manually reprocess those emails`);
        } else {
          console.warn(`   ⚠️  No valid email UIDs found to mark as read`);
          console.warn(`   ⚠️  Sample note structure:`, JSON.stringify(state.extractedNotes[0] || {}, null, 2).substring(0, 300));
        }
        
        emailService.disconnect();
      } catch (markError: any) {
        console.error(`   ⚠️  Error marking emails as read:`, markError.message);
        console.error(`   ⚠️  Emails will be processed again on next run unless manually marked as read`);
        // Don't throw - card creation was successful, this is just cleanup
      }
    }

    return {
      trelloCards: createdCards,
    };
  } catch (error: any) {
    console.error(`\n${"=".repeat(60)}`);
    console.error("❌ FATAL ERROR in Trello card creation node:");
    console.error(`   Error message: ${error.message || error}`);
    console.error(`   Error stack: ${error.stack || 'No stack trace'}`);
    if (error.response) {
      console.error(`   HTTP Status: ${error.response.status}`);
      console.error(`   Response: ${JSON.stringify(error.response.data || {}).substring(0, 500)}`);
    }
    console.error(`${"=".repeat(60)}\n`);
    return {
      trelloCards: [],
    };
  }
};

// Build the Email Analyst Agent Graph
const emailAnalystWorkflow = new StateGraph(EmailAnalystAgentState)
  .addNode("email_monitor", emailMonitorNode)
  .addNode("extract_notes", extractNotesNode)
  .addNode("trello_cards", trelloCardCreationNode)
  .addEdge(START, "email_monitor")
  .addEdge("email_monitor", "extract_notes")
  .addEdge("extract_notes", "trello_cards")
  .addEdge("trello_cards", END);

// Persistence
const checkpointer = new MemorySaver();

export const graph = emailAnalystWorkflow.compile({ checkpointer });

