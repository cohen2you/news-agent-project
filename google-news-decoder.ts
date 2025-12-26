/**
 * Google News URL Decoder
 * Decodes Google News Base64-encoded article URLs to get the real source URL
 * 
 * Google News changed their link structure in July 2024. They now use Base64-encoded
 * URLs that require calling Google's internal Batch Execute API to decode.
 */

import axios from 'axios';

/**
 * Decode Google News URL to get the original source URL
 * @param sourceUrl - The Google News URL from the RSS feed
 * @returns The decoded real source URL (e.g., fox6now.com, cnbc.com)
 */
export async function decodeGoogleNewsUrl(sourceUrl: string): Promise<string> {
  // If no URL provided, return as-is
  if (!sourceUrl) {
    return sourceUrl;
  }

  try {
    const url = new URL(sourceUrl);
    const path = url.pathname.split('/');

    // Check if it's a Google News article URL
    // Format: news.google.com/rss/articles/BASE64_ID
    if (url.hostname === 'news.google.com' && path.length > 1 && path[path.length - 2] === 'articles') {
      const base64Id = path[path.length - 1];
      console.log(`   🔍 Detected Google News article ID: ${base64Id.substring(0, 30)}...`);
      
      // Use Google's Batch Execute API to resolve this
      return await fetchDecodedBatchExecute(base64Id);
    } else {
      // Not a Google News article URL, return as-is
      return sourceUrl;
    }
  } catch (error: any) {
    // If URL parsing fails, return original
    console.log(`   ⚠️  Could not parse URL (${error.message}), using original`);
    return sourceUrl;
  }
}

/**
 * Fetch decoded URL using Google's Batch Execute API
 * This mimics the internal API call that Google's frontend uses
 */
async function fetchDecodedBatchExecute(base64Id: string): Promise<string> {
  // This is the specific RPC payload Google expects
  const payload = [
    ['Fbv4je', `["garturlreq",[["en-US","US",["FINANCE_TOP_INDICES","WEB_TEST_1_0_0"],null,null,1,1,"US:en",null,180,null,null,null,null,null,0,null,null,[1608992183,723341000]],"en-US","US",1,[2,3,4,8],1,0,"655000234",0,0,null,0],"${base64Id}"]`, null, 'generic']
  ];

  const body = 'f.req=' + encodeURIComponent(JSON.stringify([payload]));

  try {
    const response = await axios.post(
      'https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je',
      body,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          'Referer': 'https://news.google.com/'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    // The response is a messy string; we need to parse it manually
    const responseText = response.data;
    
    // Look for the "garturlres" key in the response
    const header = '[\\"garturlres\\",\\"';
    const footer = '\\",';

    if (!responseText.includes(header)) {
      // Fallback: If API fails, return the original Google link
      console.log(`   ⚠️  Could not find decoded URL in API response, using original Google URL`);
      return `https://news.google.com/rss/articles/${base64Id}`;
    }

    const start = responseText.indexOf(header) + header.length;
    const end = responseText.indexOf(footer, start);
    
    if (start <= header.length || end <= start) {
      console.log(`   ⚠️  Could not parse decoded URL from API response, using original Google URL`);
      return `https://news.google.com/rss/articles/${base64Id}`;
    }
    
    const decodedUrl = responseText.substring(start, end);
    
    // Clean up the URL (decode escape sequences)
    const cleanUrl = decodedUrl.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    
    console.log(`   ✅ Decoded to: ${cleanUrl.substring(0, 100)}...`);
    return cleanUrl;

  } catch (error: any) {
    console.error(`   ❌ Error decoding Google News URL: ${error.message}`);
    // Return original Google URL if decoding fails
    return `https://news.google.com/rss/articles/${base64Id}`;
  }
}

