/**
 * Analyst Tools Integration
 * Connects to wiim-project-v2 tools for scraping and story generation
 */

import pdf from 'pdf-parse';

export interface AnalystNoteData {
  ticker?: string;
  firm?: string;
  analyst?: string;
  content: string; // May contain extracted PDF text (if PDF was processed upfront)
  html?: string;
  subject?: string;
  date?: Date;
  emailId?: string;
  extractedPdfText?: string | null; // PDF text extracted upfront (new workflow)
  pdfAttachment?: {
    filename: string;
    contentType: string;
    content?: Buffer; // Optional - may be missing if stored in Trello (too large)
    size?: number;
  };
  [key: string]: any;
}

export interface ExtractedData {
  ticker?: string;
  firm?: string;
  analyst?: string;
  priceTarget?: number;
  rating?: string;
  summary?: string;
  keyPoints?: string[];
  extractedText?: string; // Text extracted from PDF
  [key: string]: any;
}

export interface GeneratedStory {
  story: string;          // HTML or markdown story content
  title?: string;
  metadata?: {
    wordCount?: number;
    generatedAt?: string;
    [key: string]: any;
  };
}

/**
 * Extract text from PDF file directly using pdf-parse library
 * No HTTP calls - processes PDF in memory for speed and reliability
 */
export async function extractPDFText(pdfBuffer: Buffer | undefined | null, filename: string): Promise<string> {
  // Validate PDF buffer
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    throw new Error(`Invalid PDF buffer provided for ${filename}. Buffer is ${pdfBuffer === null ? 'null' : pdfBuffer === undefined ? 'undefined' : 'not a Buffer'}`);
  }

  if (pdfBuffer.length === 0) {
    throw new Error(`PDF buffer is empty for ${filename}`);
  }

  console.log(`📄 Extracting text from PDF: ${filename} (${pdfBuffer.length} bytes)`);
  console.log(`   📍 Using direct pdf-parse library (no HTTP calls)`);

  try {
    // Extract text directly from PDF buffer using pdf-parse
    const data = await pdf(pdfBuffer);
    
    const extractedText = data.text || '';
    console.log(`   ✅ PDF extracted (${extractedText.length} characters)`);
    if (data.numpages) {
      console.log(`   📄 PDF has ${data.numpages} page(s)`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error(`No text could be extracted from PDF ${filename}. The PDF might be image-based or encrypted.`);
    }

    return extractedText;

  } catch (error: any) {
    console.error('❌ Error extracting PDF:', error);
    throw error;
  }
}

/**
 * Re-fetch PDF from email using emailId
 */
async function refetchPDFFromEmail(emailId: string): Promise<Buffer | null> {
  try {
    console.log(`   📧 Re-fetching PDF from email (emailId: ${emailId})...`);
    const { EmailService } = await import('./email-service');
    const emailService = new EmailService();
    
    // Fetch the specific email by ID
    // Note: This requires the email to still be in the mailbox
    const emails = await emailService.fetchEmails(
      { unreadOnly: false },
      process.env.EMAIL_MAILBOX || 'INBOX'
    );
    
    const email = emails.find(e => e.id === emailId);
    if (!email) {
      console.warn(`   ⚠️  Email ${emailId} not found in mailbox`);
      return null;
    }
    
    // Find PDF attachment
    if (email.attachments && email.attachments.length > 0) {
      const pdfAtt = email.attachments.find(att => 
        att.contentType === 'application/pdf' || 
        att.filename?.toLowerCase().endsWith('.pdf')
      );
      if (pdfAtt && pdfAtt.content) {
        console.log(`   ✅ Re-fetched PDF: ${pdfAtt.filename} (${pdfAtt.content.length} bytes)`);
        emailService.disconnect();
        return pdfAtt.content;
      }
    }
    
    console.warn(`   ⚠️  No PDF attachment found in email ${emailId}`);
    emailService.disconnect();
    return null;
  } catch (error: any) {
    console.error(`   ❌ Error re-fetching PDF from email:`, error);
    // Try to disconnect even on error
    try {
      const { EmailService } = await import('./email-service');
      const emailService = new EmailService();
      emailService.disconnect();
    } catch {}
    return null;
  }
}

/**
 * Call the scraping/extraction tool to extract text from analyst note (PDF or text)
 */
export async function scrapeAnalystNote(
  noteData: AnalystNoteData
): Promise<ExtractedData> {
  console.log(`🔍 Extracting analyst note content...`);

  let extractedText = '';

  try {
    // Check if PDF text was already extracted (new workflow: PDF text extracted upfront)
    if (noteData.extractedPdfText && noteData.extractedPdfText.trim().length > 0) {
      // PDF text was already extracted during email processing
      extractedText = noteData.extractedPdfText;
      console.log(`   ✅ Using pre-extracted PDF text (${extractedText.length} characters)`);
    } else if (noteData.pdfAttachment && noteData.pdfAttachment.contentType === 'application/pdf') {
      // Legacy workflow: PDF attachment exists but text not pre-extracted
      console.log(`   📎 Found PDF attachment: ${noteData.pdfAttachment.filename}`);
      console.log(`   ⚠️  PDF text not pre-extracted, attempting extraction...`);
      
      // Check if PDF content is available
      let pdfBuffer: Buffer | null = null;
      
      if (noteData.pdfAttachment.content && Buffer.isBuffer(noteData.pdfAttachment.content)) {
        // PDF content is available directly
        pdfBuffer = noteData.pdfAttachment.content;
        console.log(`   ✅ PDF content available in noteData (${pdfBuffer.length} bytes)`);
      } else if (noteData.emailId) {
        // PDF content is missing, try to re-fetch from email (fallback only)
        console.log(`   ⚠️  PDF content missing, attempting to re-fetch from email...`);
        pdfBuffer = await refetchPDFFromEmail(noteData.emailId);
      }
      
      if (pdfBuffer) {
        try {
          extractedText = await extractPDFText(pdfBuffer, noteData.pdfAttachment.filename);
        } catch (error: any) {
          console.error(`   ❌ Error extracting PDF text:`, error);
          console.log(`   ⚠️  Falling back to text content...`);
          // Fall through to use text content
        }
      } else {
        console.warn(`   ⚠️  PDF content not available and could not be re-fetched. Falling back to text content.`);
      }
    }
    
    // If PDF extraction failed or no PDF, use text content (which may already contain extracted PDF text)
    if (!extractedText && noteData.content) {
      // Use existing text content
      extractedText = noteData.content;
      console.log(`   📝 Using text content (${extractedText.length} characters)`);
    } else if (noteData.html) {
      // Convert HTML to text (simple strip)
      extractedText = noteData.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      console.log(`   📝 Converted HTML to text (${extractedText.length} characters)`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No content found in analyst note (no PDF, no text, no HTML)');
    }

    // Extract ticker from text if not already provided
    let ticker = noteData.ticker;
    if (!ticker) {
      const tickerRegex = /\b([A-Z]{1,5})\b/g;
      const matches = Array.from(extractedText.matchAll(tickerRegex));
      if (matches.length > 0) {
        // Use the first valid-looking ticker
        ticker = matches[0][1];
        console.log(`   🔍 Extracted ticker from content: ${ticker}`);
      }
    }

    // Return extracted data (the actual scraping/parsing happens in the story generator)
    return {
      ticker: ticker,
      firm: noteData.firm,
      analyst: noteData.analyst,
      extractedText: extractedText,
      // These will be extracted by the story generator if needed
    } as ExtractedData;

  } catch (error: any) {
    console.error('❌ Error scraping analyst note:', error);
    throw error;
  }
}

/**
 * Call the story generator tool to generate analyst note story
 * Uses /api/generate/analyst-article endpoint
 */
export async function generateAnalystStory(
  extractedData: ExtractedData,
  originalNote?: AnalystNoteData
): Promise<GeneratedStory> {
  // Build URL - use ANALYST_BASE_URL if set, or default to localhost:3002
  const baseUrl = process.env.ANALYST_BASE_URL || 'http://localhost:3002';
  const generatorUrl = `${baseUrl}/api/generate/analyst-article`;

  console.log(`📝 Calling story generator: ${generatorUrl}`);

  try {
    // Build request body according to /api/generate/analyst-article format
    // Expected: { analystNoteText, ticker, aiProvider, multipleNotes }
    const requestBody: any = {
      analystNoteText: extractedData.extractedText || extractedData.content || '',
    };

    // Add ticker if available
    if (extractedData.ticker) {
      requestBody.ticker = extractedData.ticker;
    } else if (originalNote?.ticker) {
      requestBody.ticker = originalNote.ticker;
    }

    // Add AI provider (default to whatever the endpoint expects, or omit if it has a default)
    // You can set ANALYST_AI_PROVIDER in .env.local if needed
    if (process.env.ANALYST_AI_PROVIDER) {
      requestBody.aiProvider = process.env.ANALYST_AI_PROVIDER;
    }

    // multipleNotes is optional - only include if we have multiple notes
    // For single notes, omit this field entirely (don't set to false)

    console.log(`   📦 Request body keys: ${Object.keys(requestBody).join(', ')}`);
    console.log(`   📊 Analyst note text length: ${requestBody.analystNoteText.length} characters`);
    if (requestBody.ticker) {
      console.log(`   📈 Ticker: ${requestBody.ticker}`);
    }

    const startTime = Date.now();
    console.log(`   ⏱️  Starting API call to story generator...`);
    
    // Add timeout to prevent hanging (5 minutes max)
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    let response: Response;
    try {
      response = await fetch(generatorUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`   ⏱️  API call completed in ${elapsed}s`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`   ❌ Story generator error: ${response.status} ${response.statusText}`);
        console.error(`   ❌ Error response: ${errorText.substring(0, 500)}`);
        throw new Error(`Story generator error: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
      }

      const data = await response.json() as any;
      console.log(`   ✅ Story generator response keys: ${Object.keys(data).join(', ')}`);

      // The endpoint returns: { article: string, headline: string }
      // The headline is extracted from the first line of the article
      return {
        story: data.article || data.story || data.content || data.html || '',
        title: data.headline || data.title || (extractedData.ticker 
          ? `${extractedData.firm || 'Analyst'} Updates ${extractedData.ticker}`
          : 'Analyst Note Story'),
        metadata: {
          wordCount: data.wordCount || (data.article?.length || 0) / 5, // Rough estimate
          generatedAt: new Date().toISOString(),
          ...data.metadata,
        },
      } as GeneratedStory;

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (fetchError.name === 'AbortError') {
        console.error(`   ❌ Story generator API call timed out after ${elapsed}s (${timeoutMs / 1000}s limit)`);
        throw new Error(`Story generator API call timed out after ${timeoutMs / 1000} seconds. The API may be slow or unresponsive.`);
      } else if (fetchError.message?.includes('ECONNREFUSED') || fetchError.message?.includes('ENOTFOUND')) {
        console.error(`   ❌ Story generator API is not accessible: ${fetchError.message}`);
        console.error(`   💡 Check that ANALYST_BASE_URL is correct: ${baseUrl}`);
        console.error(`   💡 Make sure the wiim-project-v2 server is running on that URL`);
        throw new Error(`Story generator API is not accessible at ${baseUrl}. Make sure the server is running.`);
      } else {
        console.error(`   ❌ Error calling story generator (after ${elapsed}s):`, fetchError);
        throw fetchError;
      }
    }
  } catch (error: any) {
    console.error('❌ Error in generateAnalystStory:', error);
    throw error;
  }
}

