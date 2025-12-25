# News Agent Project

An AI-powered editorial agent that monitors news feeds, pitches article ideas, and generates articles with human-in-the-loop approval using LangGraph and TypeScript.

## Architecture

This system implements a three-stage pipeline:

1. **The Analyst**: Monitors news sources and generates article pitches
2. **The Editor (You)**: Reviews and approves/rejects pitches via web dashboard
3. **The Writer**: Generates full articles using your existing article generation apps

## Features

- 🤖 AI-powered news analysis and pitch generation
- ⏸️ Human-in-the-loop approval workflow
- 🌐 Web-based dashboard for pitch review
- 🔄 Stateful workflow with pause/resume capability
- 🔌 Easy integration with existing article generation apps

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Your existing article generation apps (Python scripts, APIs, etc.)

## Installation

1. Install dependencies:

```bash
npm install
```

## Running the System

### 1. Start the API Server

**For development (recommended - auto-reloads on file changes):**

```bash
npm run dev
```

**For production (single run):**

```bash
npm start
```

The server will start on `http://localhost:3001` (or the port specified in the PORT environment variable)

### 2. Open the Dashboard

Open `index.html` in your web browser (double-click the file or use a local server).

**Note**: For best results, serve the HTML file through a local server to avoid CORS issues:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .

# Then open http://localhost:8000/index.html
# Note: Make sure the API_URL in index.html matches your server port (default: 3001)
```

## Usage

1. **Start a Pitch**: Enter a topic in the dashboard (e.g., "AI Agents in Finance")
2. **Review**: The agent will generate a pitch and pause for your approval
3. **Approve/Reject**: Click "Approve & Generate" or "Reject"
4. **View Result**: If approved, the generated article will appear

## API Endpoints

### POST `/start`

Starts the agent workflow for a given topic.

**Request:**
```json
{
  "topic": "AI Trends in 2025"
}
```

**Response:**
```json
{
  "status": "paused_for_review",
  "threadId": "run_1234567890",
  "pitch": "Proposed Article: Why AI Trends in 2025..."
}
```

### POST `/approve`

Resumes the workflow with your decision.

**Request:**
```json
{
  "threadId": "run_1234567890",
  "decision": "yes"
}
```

**Response:**
```json
{
  "status": "completed",
  "finalArticle": "[Generated Article Body...]"
}
```

### GET `/health`

Health check endpoint.

## Integrating Your Existing Apps

To connect your existing article generation apps, modify the `writerNode` function in `agent.ts`:

### Option 1: Python Script

```typescript
import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

// Inside writerNode...
const { stdout } = await execAsync(`python3 /path/to/your/app.py "${state.pitch}"`);
return { finalArticle: stdout };
```

### Option 2: HTTP API

```typescript
// Inside writerNode...
const response = await fetch('http://localhost:5000/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pitch: state.pitch })
});
const data = await response.json();
return { finalArticle: data.article };
```

### Option 3: Node.js Module

```typescript
import { generateArticle } from './your-article-generator';

// Inside writerNode...
const article = await generateArticle(state.pitch);
return { finalArticle: article };
```

## Customizing the Analyst

To connect real news feeds, modify the `analystNode` function in `agent.ts`:

### Using NewsAPI

```typescript
const analystNode = async (state: typeof AgentState.State) => {
  const response = await fetch(
    `https://newsapi.org/v2/everything?q=${state.topic}&apiKey=YOUR_API_KEY`
  );
  const data = await response.json();
  
  // Process articles and generate pitch
  const pitch = `Proposed Article: ${data.articles[0].title}...`;
  return { pitch };
};
```

### Using RSS Feeds

```typescript
import Parser from 'rss-parser';
const parser = new Parser();

const analystNode = async (state: typeof AgentState.State) => {
  const feed = await parser.parseURL('https://example.com/rss');
  // Process feed and generate pitch
  return { pitch };
};
```

## Project Structure

```
news-agent-project/
├── agent.ts          # LangGraph workflow definition
├── server.ts         # Express API server
├── index.html        # Web dashboard
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript configuration
└── README.md         # This file
```

## Development

### Testing the Agent Directly

You can test the agent workflow without the API:

```bash
npm run agent
```

This runs the demo function in `agent.ts`.

### TypeScript Compilation

```bash
npx tsc
```

## Troubleshooting

### CORS Errors

If you see CORS errors when opening `index.html` directly:
- Use a local server (see "Open the Dashboard" section above)
- Or modify the `API_URL` in `index.html` to match your server URL

### Port Already in Use

If port 3001 is already in use:
- Set a different port: `PORT=3002 npm run dev`
- Update the `API_URL` in `index.html` to match
- Or modify the PORT in `server.ts`

### LangGraph Interrupt Issues

If the interrupt doesn't work as expected:
- Ensure you're using the latest version of `@langchain/langgraph`
- Check that the checkpointer is properly configured
- Verify thread IDs are unique for each workflow run

## Next Steps

- [ ] Connect real news feeds (RSS, NewsAPI, etc.)
- [ ] Add email/Slack notifications for new pitches
- [ ] Implement article quality scoring
- [ ] Add batch processing for multiple topics
- [ ] Create a database to store pitch history
- [ ] Add authentication for the dashboard

## License

MIT

