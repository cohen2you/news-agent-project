/**
 * Examples of how to integrate your existing article generation apps
 * Copy the relevant example into the writerNode function in agent.ts
 */

import { exec } from "child_process";
import { promisify } from "util";
import { spawn } from "child_process";

const execAsync = promisify(exec);

// ==========================================
// EXAMPLE 1: Python Script (CLI)
// ==========================================
export async function callPythonScript(pitch: string): Promise<string> {
  try {
    // Replace with your actual Python script path
    const scriptPath = "/path/to/your/article_generator.py";
    
    // Execute Python script with pitch as argument
    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${pitch}"`
    );
    
    if (stderr) {
      console.error("Python script stderr:", stderr);
    }
    
    return stdout.trim();
  } catch (error) {
    console.error("Error calling Python script:", error);
    throw error;
  }
}

// ==========================================
// EXAMPLE 2: HTTP API Call
// ==========================================
export async function callArticleAPI(pitch: string): Promise<string> {
  try {
    // Replace with your actual API endpoint
    const apiUrl = "http://localhost:5000/generate";
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pitch: pitch,
        // Add any other parameters your API expects
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    return data.article || data.content || JSON.stringify(data);
  } catch (error) {
    console.error("Error calling article API:", error);
    throw error;
  }
}

// ==========================================
// EXAMPLE 3: Node.js Module/Function
// ==========================================
// If your app is a Node.js module, import it like this:
// import { generateArticle } from "./your-article-generator";

export async function callNodeModule(pitch: string): Promise<string> {
  try {
    // Example: If you have a module that exports a generateArticle function
    // const { generateArticle } = require("./your-article-generator");
    // return await generateArticle(pitch);
    
    // For now, this is a placeholder
    return `[Article generated from Node module based on: ${pitch}]`;
  } catch (error) {
    console.error("Error calling Node module:", error);
    throw error;
  }
}

// ==========================================
// EXAMPLE 4: Long-running Process with Stream
// ==========================================
export async function callLongRunningProcess(pitch: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Replace with your actual command
    const process = spawn("python3", [
      "/path/to/your/long_running_generator.py",
      pitch,
    ]);
    
    let output = "";
    let errorOutput = "";
    
    process.stdout.on("data", (data) => {
      output += data.toString();
    });
    
    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });
    
    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code ${code}: ${errorOutput}`));
      } else {
        resolve(output.trim());
      }
    });
    
    process.on("error", (error) => {
      reject(error);
    });
  });
}

// ==========================================
// HOW TO USE IN agent.ts
// ==========================================
/*
In your agent.ts file, replace the writerNode function with:

import { callPythonScript } from "./app-integration-examples";

const writerNode = async (state: typeof AgentState.State) => {
  const feedback = state.humanFeedback;

  if (typeof feedback === 'string' && feedback.toLowerCase().includes("no")) {
    console.log("❌ WRITER: Pitch rejected. Ending process.");
    return { finalArticle: "Rejected" };
  }

  console.log(`\n✍️  WRITER: Pitch Approved! Sending payload to External App...`);
  
  // Use one of the integration examples above
  const article = await callPythonScript(state.pitch);
  
  return { finalArticle: article };
};
*/

