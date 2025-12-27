/**
 * Trello Service
 * Handles authentication and card creation for Trello API
 */

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  url: string;
}

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

interface TrelloList {
  id: string;
  name: string;
  idBoard: string;
}

export class TrelloService {
  private apiKey: string;
  private token: string;
  private baseUrl = 'https://api.trello.com/1';

  constructor(apiKey?: string, token?: string) {
    this.apiKey = apiKey || process.env.TRELLO_API_KEY || '';
    this.token = token || process.env.TRELLO_TOKEN || '';

    if (!this.apiKey || !this.token) {
      throw new Error('TRELLO_API_KEY and TRELLO_TOKEN must be set in environment variables');
    }
  }

  /**
   * Get authentication query parameters for Trello API
   */
  private getAuthParams(): string {
    return `key=${this.apiKey}&token=${this.token}`;
  }

  /**
   * Attach a file to a Trello card
   * @param cardId - The ID of the card to attach the file to
   * @param fileBuffer - The file buffer to attach
   * @param filename - The name of the file
   * @param mimeType - The MIME type of the file (default: application/pdf)
   * @returns The attachment object
   */
  async attachFileToCard(
    cardId: string,
    fileBuffer: Buffer,
    filename: string,
    mimeType: string = 'application/pdf'
  ): Promise<any> {
    try {
      const url = `${this.baseUrl}/cards/${cardId}/attachments?${this.getAuthParams()}`;
      
      // Use axios for better form-data support (more reliable than native fetch)
      // Dynamic import to avoid requiring axios as a hard dependency if not needed
      const axios = await import('axios');
      const FormData = require('form-data');
      const formData = new FormData();
      
      // Append file with proper options
      formData.append('file', fileBuffer, {
        filename: filename,
        contentType: mimeType,
      });
      
      // Trello API also accepts a 'name' parameter for the attachment name
      formData.append('name', filename);
      
      // Use axios which handles form-data streams properly
      const response = await axios.default.post(url, formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxBodyLength: Infinity, // Allow large file uploads
        maxContentLength: Infinity,
      });

      console.log(`   📎 Attached file to card: ${filename} (${fileBuffer.length} bytes)`);
      return response.data;
    } catch (error: any) {
      console.error('Error attaching file to Trello card:', error);
      // Log more details for debugging
      if (error.response) {
        console.error(`   Trello API response: ${error.response.status} ${error.response.statusText}`);
        console.error(`   Response data: ${JSON.stringify(error.response.data)}`);
      } else if (error.message) {
        console.error(`   Error details: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get all boards for the authenticated user
   */
  async getBoards(): Promise<TrelloBoard[]> {
    try {
      const url = `${this.baseUrl}/members/me/boards?${this.getAuthParams()}&filter=open`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const boards = await response.json() as TrelloBoard[];
      return boards;
    } catch (error: any) {
      console.error('Error fetching Trello boards:', error);
      throw error;
    }
  }

  /**
   * Get all lists for a specific board
   */
  async getLists(boardId: string): Promise<TrelloList[]> {
    try {
      const url = `${this.baseUrl}/boards/${boardId}/lists?${this.getAuthParams()}&filter=open`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const lists = await response.json() as TrelloList[];
      return lists;
    } catch (error: any) {
      console.error(`Error fetching lists for board ${boardId}:`, error);
      throw error;
    }
  }

  /**
   * Get all cards in a specific list
   * @param listId - The ID of the list to get cards from
   * @returns Array of cards in the list
   */
  async getCardsInList(listId: string): Promise<Array<{ id: string; name: string; desc: string }>> {
    try {
      const url = `${this.baseUrl}/lists/${listId}/cards?${this.getAuthParams()}&fields=id,name,desc`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const cards = await response.json() as Array<{ id: string; name: string; desc: string }>;
      return cards;
    } catch (error: any) {
      console.error(`Error fetching cards from list ${listId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new card on a specific list
   * @param listId - The ID of the list to create the card in
   * @param name - The title/name of the card (news headline)
   * @param desc - The description of the card (summary + source URL)
   * @returns The created card
   */
  async createCard(listId: string, name: string, desc: string): Promise<TrelloCard> {
    try {
      // Always use 'top' as string - Trello's API supports this and it's the most reliable way
      // Note: If Trello list has a UI sort order set, that will override API position
      // Trello automation rules (Butler) can also move cards to top when added - this works well with pos: "top"
      const topPosition = 'top';
      
      const url = `${this.baseUrl}/cards?${this.getAuthParams()}`;
      
      const body = new URLSearchParams({
        idList: listId,
        name: name,
        desc: desc,
        pos: topPosition
      });
      
      console.log(`   📍 Creating card with position: "${topPosition}" (Trello API)`);
      console.log(`   💡 NOTE: Trello automation rules can also move cards to top - check your board rules`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const card = await response.json() as TrelloCard;
      console.log(`✅ Created Trello card: ${card.name} (${card.url})`);
      console.log(`   💡 If card is not at top, check Trello list sort settings (may need to disable UI sort)`);
      
      return card;
    } catch (error: any) {
      console.error('Error creating Trello card:', error);
      throw error;
    }
  }

  /**
   * Create a card from a news article/PR
   * @param listId - The ID of the list to create the card in
   * @param headline - The news headline
   * @param summary - Brief summary of the article
   * @param sourceUrl - Original source URL
   * @param additionalInfo - Optional additional information (ticker, date, etc.)
   */
  async createCardFromNews(
    listId: string,
    headline: string,
    summary: string,
    sourceUrl: string,
    additionalInfo?: { ticker?: string; date?: string; [key: string]: any }
  ): Promise<TrelloCard> {
    // Build description with summary and source URL
    let desc = summary || 'No summary available';
    
    if (additionalInfo) {
      desc += '\n\n---\n';
      if (additionalInfo.ticker) {
        desc += `**Ticker:** ${additionalInfo.ticker}\n`;
      }
      if (additionalInfo.date) {
        desc += `**Date:** ${additionalInfo.date}\n`;
      }
      // Add any other additional info
      Object.keys(additionalInfo).forEach(key => {
        if (key !== 'ticker' && key !== 'date' && additionalInfo[key]) {
          desc += `**${key}:** ${additionalInfo[key]}\n`;
        }
      });
      desc += '\n';
    }
    
    desc += `\n**Source:** [View Original](${sourceUrl})`;

    return await this.createCard(listId, headline, desc);
  }

  /**
   * Move a card to a different list
   * @param cardId - The ID of the card to move
   * @param listId - The ID of the destination list
   */
  async moveCardToList(cardId: string, listId: string): Promise<TrelloCard> {
    try {
      const url = `${this.baseUrl}/cards/${cardId}?${this.getAuthParams()}`;
      
      const body = new URLSearchParams({
        idList: listId
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const card = await response.json() as TrelloCard;
      console.log(`✅ Moved Trello card "${card.name}" to new list`);
      return card;
    } catch (error: any) {
      console.error('Error moving Trello card:', error);
      throw error;
    }
  }

  /**
   * Create a card from news with a "Generate Article" link
   * @param listId - The ID of the list to create the card in
   * @param headline - The news headline
   * @param summary - Brief summary of the article
   * @param sourceUrl - Original source URL
   * @param cardId - Optional card ID to include in the generate link (will be set after creation)
   * @param additionalInfo - Optional additional information (ticker, date, etc.)
   */
  async createCardFromNewsWithGenerateLink(
    listId: string,
    headline: string,
    summary: string,
    sourceUrl: string,
    generateArticleUrl: string,
    additionalInfo?: { ticker?: string; date?: string; [key: string]: any },
    prData?: any // Store full PR data for later retrieval
  ): Promise<TrelloCard> {
    // Clean summary: decode HTML entities and remove HTML tags
    function cleanText(text: string): string {
      if (!text) return '';
      
      // Decode common HTML entities
      let cleaned = text
        .replace(/&#34;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
          try {
            const char = String.fromCharCode(parseInt(hex, 16));
            // Only allow printable ASCII and common unicode characters
            return (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) || char.charCodeAt(0) > 127 ? char : ' ';
          } catch {
            return ' ';
          }
        })
        .replace(/&#(\d+);/g, (match, dec) => {
          try {
            const char = String.fromCharCode(parseInt(dec, 10));
            // Only allow printable ASCII and common unicode characters
            return (char.charCodeAt(0) >= 32 && char.charCodeAt(0) <= 126) || char.charCodeAt(0) > 127 ? char : ' ';
          } catch {
            return ' ';
          }
        });
      
      // Remove HTML tags
      cleaned = cleaned.replace(/<[^>]+>/g, ' ');
      
      // Remove control characters (except newlines, tabs, carriage returns)
      cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
      
      // Normalize whitespace (but preserve intentional line breaks)
      cleaned = cleaned.replace(/[ \t]+/g, ' '); // Collapse spaces and tabs
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
      
      return cleaned.trim();
    }
    
    // Build description with summary and source URL
    let desc = cleanText(summary) || 'No summary available';
    
    // Limit description length (Trello has 16,384 char limit, but we'll be conservative)
    // Reserve space for additional info, links, and PR data
    const maxDescLength = 7000; // More conservative limit to leave room for all additions
    if (desc.length > maxDescLength) {
      desc = desc.substring(0, maxDescLength) + '...';
    }
    
    // Build additional info section
    let additionalInfoText = '';
    if (additionalInfo) {
      additionalInfoText += '\n\n---\n';
      if (additionalInfo.ticker) {
        additionalInfoText += `**Ticker:** ${cleanText(String(additionalInfo.ticker))}\n`;
      }
      if (additionalInfo.date) {
        additionalInfoText += `**Date:** ${cleanText(String(additionalInfo.date))}\n`;
      }
      additionalInfoText += '\n';
    }
    
    // Build links section (Generate Article button moved to top, so only source link here)
    const linksText = `\n**Source:** [View Original](${sourceUrl})`;
    
    // Generate Article button will be added at the top of description
    const generateArticleButton = `**[Generate Article](${generateArticleUrl})**\n\n---\n\n`;
    
    // Store PR data as base64-encoded JSON at the very end (hidden in HTML comment)
    // HTML comments are truly hidden in Trello and don't clutter the visible description
    let prDataSection = '';
    if (prData) {
      try {
        // Create a copy to avoid modifying the original
        const prDataCopy = { ...prData };
        
        // Ensure ticker from additionalInfo overrides ticker in prData
        // This is critical for WGO articles where the intended ticker (from card) should override
        // any ticker in the original article's stocks array
        if (additionalInfo && additionalInfo.ticker) {
          prDataCopy.ticker = additionalInfo.ticker;
          // Also ensure stocks array reflects the intended ticker
          if (prDataCopy.stocks && Array.isArray(prDataCopy.stocks)) {
            // Put the intended ticker first in stocks array
            const intendedTicker = String(additionalInfo.ticker).toUpperCase().trim();
            const otherStocks = prDataCopy.stocks.filter((stock: any) => {
              const stockTicker = typeof stock === 'string' ? stock : (stock?.ticker || stock?.symbol || '');
              return String(stockTicker).toUpperCase().trim() !== intendedTicker;
            });
            prDataCopy.stocks = [intendedTicker, ...otherStocks];
          } else {
            prDataCopy.stocks = [String(additionalInfo.ticker).toUpperCase().trim()];
          }
        }
        
        // Truncate large body/teaser fields to prevent description from being too long
        // Keep essential fields but limit content size
        const maxBodyLength = 5000; // Limit body to 5000 chars
        const maxTeaserLength = 1000; // Limit teaser to 1000 chars
        
        if (prDataCopy.body && prDataCopy.body.length > maxBodyLength) {
          prDataCopy.body = prDataCopy.body.substring(0, maxBodyLength) + '...';
        }
        if (prDataCopy.teaser && prDataCopy.teaser.length > maxTeaserLength) {
          prDataCopy.teaser = prDataCopy.teaser.substring(0, maxTeaserLength) + '...';
        }
        if (prDataCopy.content && prDataCopy.content.length > maxBodyLength) {
          prDataCopy.content = prDataCopy.content.substring(0, maxBodyLength) + '...';
        }
        
        const prDataJson = JSON.stringify(prDataCopy);
        const prDataBase64 = Buffer.from(prDataJson).toString('base64');
        
        // Check if PR data section would make description too long
        const prDataSectionTest = `\n\n<!-- PR_DATA:${prDataBase64} -->`;
        const totalLength = desc.length + additionalInfoText.length + linksText.length + prDataSectionTest.length;
        
        // Trello limit is 16,384 chars, but be conservative and use 12,000
        const maxTotalLength = 12000;
        
        if (totalLength > maxTotalLength) {
          // If PR data is too large, truncate it further or remove less essential fields
          console.warn(`⚠️  PR data too large (${prDataBase64.length} chars base64), truncating...`);
          
          // Remove or truncate less essential fields
          const essentialFields = {
            id: prDataCopy.id,
            title: prDataCopy.title || prDataCopy.headline,
            url: prDataCopy.url || prDataCopy.link,
            ticker: prDataCopy.ticker,
            stocks: prDataCopy.stocks,
            created: prDataCopy.created,
            prId: prDataCopy.prId,
            // Keep teaser but truncate body
            teaser: prDataCopy.teaser ? prDataCopy.teaser.substring(0, 500) : '',
            body: prDataCopy.body ? prDataCopy.body.substring(0, 2000) : ''
          };
          
          const essentialJson = JSON.stringify(essentialFields);
          const essentialBase64 = Buffer.from(essentialJson).toString('base64');
          prDataSection = `\n\n<!-- PR_DATA:${essentialBase64} -->`;
          
          // Final check - if still too long, just store minimal data
          const finalLength = desc.length + additionalInfoText.length + linksText.length + prDataSection.length;
          if (finalLength > maxTotalLength) {
            const minimalFields = {
              id: prDataCopy.id,
              title: prDataCopy.title || prDataCopy.headline,
              url: prDataCopy.url || prDataCopy.link,
              ticker: prDataCopy.ticker,
              stocks: prDataCopy.stocks,
              created: prDataCopy.created
            };
            const minimalJson = JSON.stringify(minimalFields);
            const minimalBase64 = Buffer.from(minimalJson).toString('base64');
            prDataSection = `\n\n<!-- PR_DATA:${minimalBase64} -->`;
            console.warn(`⚠️  Using minimal PR data due to size constraints`);
          }
        } else {
          prDataSection = prDataSectionTest;
        }
      } catch (error) {
        console.warn('Failed to encode PR data for Trello card:', error);
      }
    }
    
    // Combine all parts (Generate Article button at top)
    desc = generateArticleButton + desc + additionalInfoText + linksText + prDataSection;
    
    // Final check: ensure description doesn't exceed Trello's limit (16,384 chars)
    // Be conservative and limit to 12,000 to leave room for updates and encoding overhead
    if (desc.length > 12000) {
      console.warn(`⚠️  Description too long (${desc.length} chars), truncating to 12000 chars`);
      // Try to preserve PR data at the end if possible (check both HTML comment and old code block format)
      const prDataMatchHtml = desc.match(/<!--\s*PR_DATA:([^>]+)\s*-->/);
      const prDataMatchCode = desc.match(/```metadata[^`]*PR_DATA:([^\n`]+)[^`]*```/);
      const prDataMatch = prDataMatchHtml || prDataMatchCode;
      if (prDataMatch) {
        // Use HTML comment format for hidden storage
        const prDataBlock = `\n\n<!-- PR_DATA:${prDataMatch[1]} -->`;
        const availableLength = 12000 - prDataBlock.length - additionalInfoText.length - linksText.length - 50; // Leave buffer
        // Find where metadata starts (either HTML comment or code block)
        const metadataIndex = Math.max(
          desc.indexOf('<!-- PR_DATA:'),
          desc.indexOf('<!-- NOTE_DATA:'),
          desc.indexOf('```metadata')
        );
        // Remove generateArticleButton from desc if it's already there (to calculate correctly)
        const descWithoutButton = desc.replace(/^\*\*\[Generate Article\]\([^)]+\)\*\*\n\n---\n\n/, '');
        const mainDesc = metadataIndex > 0 ? descWithoutButton.substring(0, metadataIndex) : descWithoutButton;
        if (availableLength > 0) {
          desc = generateArticleButton + mainDesc.substring(0, availableLength) + additionalInfoText + linksText + prDataBlock;
        } else {
          // If even PR data makes it too long, just use essential parts
          desc = generateArticleButton + mainDesc.substring(0, 11000) + '...' + linksText + prDataBlock;
        }
      } else {
        // No PR data, just truncate main description (remove button first to calculate correctly)
        const descWithoutButton = desc.replace(/^\*\*\[Generate Article\]\([^)]+\)\*\*\n\n---\n\n/, '');
        const truncateAt = 12000 - generateArticleButton.length - additionalInfoText.length - linksText.length - 10;
        desc = generateArticleButton + descWithoutButton.substring(0, truncateAt) + '...' + additionalInfoText + linksText;
      }
    }
    
    // Final sanitization: remove any remaining problematic characters
    // Replace any control characters that might have slipped through
    desc = desc.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    const card = await this.createCard(listId, headline, desc);
    
    // Update the card with the generate link that includes the actual card ID
    const updatedGenerateUrl = generateArticleUrl.replace('{cardId}', card.id);
    if (updatedGenerateUrl !== generateArticleUrl) {
      // Update card description with the correct card ID in the link
      desc = desc.replace(generateArticleUrl, updatedGenerateUrl);
      await this.updateCardDescription(card.id, desc);
    }
    
    return card;
  }
  
  /**
   * Get full card data including list ID
   */
  async getCard(cardId: string): Promise<{ id: string; name: string; desc: string; idList: string; url: string }> {
    try {
      const url = `${this.baseUrl}/cards/${cardId}?${this.getAuthParams()}&fields=id,name,desc,idList,url`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const card = await response.json() as { id: string; name: string; desc: string; idList: string; url: string };
      return card;
    } catch (error: any) {
      console.error(`Error fetching card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Get PR data from card description (stored as base64-encoded JSON in HTML comment)
   */
  async getCardData(cardId: string): Promise<{ name: string; desc: string; prData?: any; noteData?: any }> {
    try {
      const url = `${this.baseUrl}/cards/${cardId}?${this.getAuthParams()}&fields=name,desc`;
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const card = await response.json() as { name: string; desc: string };
      
      // Extract PR data or NOTE data from description
      // Try both formats: HTML comment (old) and markdown code block (new)
      let prData: any = undefined;
      let noteData: any = undefined;
      
      // NEW format: HTML comment (truly hidden in Trello) - PRIORITY CHECK FIRST
      // Pattern: <!-- PR_DATA:base64data -->
      let prDataMatch = card.desc.match(/<!--\s*PR_DATA:\s*([^>]+)\s*-->/);
      if (!prDataMatch) {
        // Old format: markdown code block with metadata label (backward compatibility)
        // Pattern: ```metadata\nPR_DATA:base64data\n```
        prDataMatch = card.desc.match(/```metadata\s*\n\s*PR_DATA:\s*([^\n`]+)\s*\n\s*```/);
      }
      if (!prDataMatch) {
        // Try without newlines after PR_DATA:
        prDataMatch = card.desc.match(/```metadata[^`]*PR_DATA:\s*([^\n`]+)[^`]*```/);
      }
      if (!prDataMatch) {
        // Alternative: code block without metadata label (backward compatibility)
        prDataMatch = card.desc.match(/```[^`]*PR_DATA:\s*([^\n`]+)[^`]*```/s);
      }
      
      if (prDataMatch) {
        try {
          const prDataBase64 = prDataMatch[1].trim();
          const prDataJson = Buffer.from(prDataBase64, 'base64').toString('utf-8');
          prData = JSON.parse(prDataJson);
          console.log(`✅ Successfully extracted PR data from card ${cardId}`);
        } catch (error) {
          console.warn(`Failed to decode PR data from card ${cardId}:`, error);
          // Log the actual match to debug
          console.log(`   Match found but decode failed. Base64 length: ${prDataMatch[1].trim().length}`);
          console.log(`   Base64 preview: ${prDataMatch[1].trim().substring(0, 100)}...`);
        }
      } else {
        // Debug: check if description contains any PR_DATA markers
        const metadataMarker = '```metadata';
        if (card.desc.includes('PR_DATA')) {
          const prDataIndex = card.desc.indexOf('PR_DATA');
          const snippet = card.desc.substring(Math.max(0, prDataIndex - 100), Math.min(card.desc.length, prDataIndex + 300));
          console.log(`⚠️  Card ${cardId} contains 'PR_DATA' but regex didn't match. Description snippet: ...${snippet}...`);
        } else if (card.desc.includes(metadataMarker)) {
          const metadataIndex = card.desc.indexOf(metadataMarker);
          const snippet = card.desc.substring(Math.max(0, metadataIndex - 50), Math.min(card.desc.length, metadataIndex + 200));
          console.log(`⚠️  Card ${cardId} contains 'metadata' code block but no PR_DATA found. Description snippet: ...${snippet}...`);
        }
      }
      
      // Also try to extract NOTE_DATA (for analyst notes)
      // NEW format: HTML comment (truly hidden) - PRIORITY CHECK FIRST
      let noteDataMatch = card.desc.match(/<!--\s*NOTE_DATA:\s*([^>]+)\s*-->/);
      if (!noteDataMatch) {
        // Old format: markdown code block (backward compatibility)
        noteDataMatch = card.desc.match(/```metadata\s*\n\s*NOTE_DATA:\s*([^\n`]+)\s*\n\s*```/);
      }
      if (!noteDataMatch) {
        noteDataMatch = card.desc.match(/```metadata[^`]*NOTE_DATA:\s*([^\n`]+)[^`]*```/);
      }
      
      if (noteDataMatch) {
        try {
          const noteDataBase64 = noteDataMatch[1].trim();
          const noteDataJson = Buffer.from(noteDataBase64, 'base64').toString('utf-8');
          noteData = JSON.parse(noteDataJson);
          console.log(`✅ Successfully extracted NOTE data from card ${cardId}`);
        } catch (error) {
          console.warn(`Failed to decode NOTE data from card ${cardId}:`, error);
        }
      }

      return { ...card, prData, noteData };
    } catch (error: any) {
      console.error(`Error fetching card ${cardId}:`, error);
      throw error;
    }
  }

  /**
   * Update a card's description
   */
  async updateCardDescription(cardId: string, description: string): Promise<TrelloCard> {
    try {
      const url = `${this.baseUrl}/cards/${cardId}?${this.getAuthParams()}`;
      
      const body = new URLSearchParams({
        desc: description
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json() as TrelloCard;
    } catch (error: any) {
      console.error('Error updating Trello card description:', error);
      throw error;
    }
  }

  /**
   * Update a card's position in its list
   * @param cardId - The ID of the card to update
   * @param position - The new position (smaller numbers = higher/top position)
   */
  async updateCardPosition(cardId: string, position: number | string): Promise<TrelloCard> {
    try {
      const url = `${this.baseUrl}/cards/${cardId}?${this.getAuthParams()}`;
      
      const body = new URLSearchParams({
        pos: String(position)
      });

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const card = await response.json() as TrelloCard;
      return card;
    } catch (error: any) {
      console.error(`Error updating card position:`, error);
      throw error;
    }
  }

  /**
   * Get the current member (bot) ID
   * @returns The member ID of the authenticated user
   */
  async getMemberId(): Promise<string> {
    try {
      const url = `${this.baseUrl}/members/me?${this.getAuthParams()}&fields=id`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const member = await response.json() as { id: string };
      return member.id;
    } catch (error: any) {
      console.error('Error fetching member ID:', error);
      throw error;
    }
  }

  /**
   * Get comments (actions) from a card
   * @param cardId - The ID of the card to get comments from
   * @returns Array of comment actions, sorted by date (newest first)
   */
  async getCardComments(cardId: string): Promise<Array<{ id: string; data: { text: string }; date: string; idMemberCreator: string }>> {
    try {
      const url = `${this.baseUrl}/cards/${cardId}/actions?${this.getAuthParams()}&filter=commentCard&limit=100`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const actions = await response.json() as Array<{ id: string; data: { text: string }; date: string; idMemberCreator: string }>;
      // Sort by date (newest first)
      actions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return actions;
    } catch (error: any) {
      console.error('Error fetching comments from Trello card:', error);
      throw error;
    }
  }

  /**
   * Add a comment to a card
   * @param cardId - The ID of the card
   * @param text - The comment text
   */
  async addComment(cardId: string, text: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/cards/${cardId}/actions/comments?${this.getAuthParams()}`;
      
      const body = new URLSearchParams({
        text: text
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trello API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const comment = await response.json();
      console.log(`✅ Added comment to Trello card ${cardId}`);
      return comment;
    } catch (error: any) {
      console.error('Error adding comment to Trello card:', error);
      throw error;
    }
  }
}

