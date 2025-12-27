// Simple script to set up Trello webhook for Render
const fs = require('fs');
const https = require('https');

const renderUrl = 'https://news-agent-project.onrender.com';
const envFile = '.env.local';

console.log('\n🔧 Setting up Trello webhook for Render\n');

// Read .env.local
if (!fs.existsSync(envFile)) {
  console.error('❌ Error: .env.local not found');
  process.exit(1);
}

const envContent = fs.readFileSync(envFile, 'utf8');
const lines = envContent.split('\n');

let apiKey = '';
let token = '';
let boardId = '';

lines.forEach(line => {
  const trimmed = line.trim();
  if (trimmed.startsWith('TRELLO_API_KEY=')) {
    apiKey = trimmed.substring('TRELLO_API_KEY='.length);
  } else if (trimmed.startsWith('TRELLO_TOKEN=')) {
    token = trimmed.substring('TRELLO_TOKEN='.length);
  } else if (trimmed.startsWith('TRELLO_BOARD_ID=')) {
    boardId = trimmed.substring('TRELLO_BOARD_ID='.length);
  }
});

if (!apiKey || !token || !boardId) {
  console.error('❌ Error: Missing required values in .env.local');
  console.error('   Need: TRELLO_API_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID');
  process.exit(1);
}

console.log('✅ Configuration loaded');
console.log(`\n📋 Webhook Configuration:`);
console.log(`   Callback URL: ${renderUrl}/trello/webhook`);
console.log(`   Board ID: ${boardId}`);
console.log(`   API Key: ${apiKey.substring(0, 8)}...\n`);

// Check existing webhooks
console.log('🔍 Checking for existing webhooks...');
const listUrl = `https://api.trello.com/1/tokens/${token}/webhooks?key=${apiKey}`;

function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

function makePostRequest(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function makeDeleteRequest(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'DELETE'
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    // Check existing webhooks
    const existingWebhooks = await makeRequest(listUrl);
    const existingWebhook = existingWebhooks.find(w => w.idModel === boardId);
    
    if (existingWebhook) {
      console.log('⚠️  Found existing webhook:');
      console.log(`   ID: ${existingWebhook.id}`);
      console.log(`   URL: ${existingWebhook.callbackURL}`);
      console.log('\n⚠️  Existing webhook found. Please delete it manually or update the script to handle deletion.');
      console.log('   You can delete it at: https://api.trello.com/1/webhooks/' + existingWebhook.id);
      process.exit(0);
    }

    // Create webhook
    console.log('\n🔨 Creating webhook...');
    const createUrl = `https://api.trello.com/1/tokens/${token}/webhooks?key=${apiKey}`;
    const webhook = await makePostRequest(createUrl, {
      description: 'News Agent - Render Webhook',
      callbackURL: `${renderUrl}/trello/webhook`,
      idModel: boardId
    });

    console.log('✅ Webhook created successfully!\n');
    console.log('📋 Webhook Details:');
    console.log(`   ID: ${webhook.id}`);
    console.log(`   Description: ${webhook.description}`);
    console.log(`   Callback URL: ${webhook.callbackURL}`);
    console.log(`   Board ID: ${webhook.idModel}`);
    console.log(`   Active: ${webhook.active}`);
    
    console.log('\n🎉 Setup Complete!');
    console.log('\nNow when you add a comment to the WGO Control Card, it will trigger instantly!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('already exists')) {
      console.error('\n⚠️  Webhook may already exist. Check existing webhooks at:');
      console.error(`   https://api.trello.com/1/tokens/${token}/webhooks?key=${apiKey}`);
    }
    process.exit(1);
  }
})();

