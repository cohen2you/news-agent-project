/**
 * Helper script to create .env file from .env.example
 * Run: node create-env.js
 */

const fs = require('fs');
const path = require('path');

const envExample = `# Benzinga API Configuration
BENZINGA_API_KEY=your_benzinga_api_key_here

# Article Generation App Configuration
# Choose one of the following integration methods:

# Option 1: HTTP API (Recommended for TypeScript apps)
ARTICLE_GEN_TYPE=http
ARTICLE_GEN_API_URL=http://localhost:5000/generate

# Option 2: TypeScript Script (Run with tsx)
# ARTICLE_GEN_TYPE=typescript
# ARTICLE_GEN_TSX_PATH=C:\\path\\to\\your\\generate.ts

# Option 3: Node.js Module (Import directly)
# ARTICLE_GEN_TYPE=node
# ARTICLE_GEN_MODULE_PATH=../your-app/src/generator

# Option 4: Python Script (if you have Python apps)
# ARTICLE_GEN_TYPE=python
# ARTICLE_GEN_PYTHON_PATH=C:\\path\\to\\your\\article_generator.py

# Option 5: GitHub Repository (cloned locally)
# ARTICLE_GEN_TYPE=github
# ARTICLE_GEN_REPO_PATH=C:\\path\\to\\cloned\\repo
# ARTICLE_GEN_SCRIPT=generate_article.ts
`;

const envPath = path.join(__dirname, '.env');
const examplePath = path.join(__dirname, '.env.example');

// Create .env.example
fs.writeFileSync(examplePath, envExample);
console.log('✅ Created .env.example');

// Create .env if it doesn't exist
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envExample);
  console.log('✅ Created .env file');
  console.log('📝 Please edit .env and add your API keys and configuration');
} else {
  console.log('ℹ️  .env file already exists, skipping...');
}

