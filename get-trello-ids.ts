/**
 * Script to fetch Trello Board ID and List ID
 * Run this script to find your Board and List IDs for the .env file
 * 
 * Usage: tsx get-trello-ids.ts
 */

import dotenv from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
import { TrelloService } from "./trello-service";

// Load environment variables
const envLocalPath = join(process.cwd(), ".env.local");
const envPath = join(process.cwd(), ".env");

if (existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log("✅ Loaded environment variables from .env.local");
} else if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ Loaded environment variables from .env");
} else {
  console.warn("⚠️  No .env.local or .env file found");
}

async function main() {
  try {
    console.log("\n🔍 Fetching Trello Boards and Lists...\n");

    const trello = new TrelloService();

    // Get all boards
    console.log("📋 Fetching your boards...");
    const boards = await trello.getBoards();

    if (boards.length === 0) {
      console.log("❌ No boards found. Make sure your Trello API key and token are correct.");
      return;
    }

    console.log(`\n✅ Found ${boards.length} board(s):\n`);
    
    // Display boards
    boards.forEach((board, index) => {
      console.log(`${index + 1}. ${board.name}`);
      console.log(`   Board ID: ${board.id}`);
      console.log(`   URL: ${board.url}\n`);
    });

    // Check if user specified a board name via command line argument
    const boardNameFilter = process.argv[2];
    
    let targetBoard: TrelloBoard | undefined;
    
    if (boardNameFilter) {
      // Find board by name (case-insensitive partial match)
      targetBoard = boards.find(board => 
        board.name.toLowerCase().includes(boardNameFilter.toLowerCase())
      );
      
      if (!targetBoard) {
        console.log(`\n❌ No board found matching "${boardNameFilter}"`);
        console.log("\nAvailable boards:");
        boards.forEach((board, index) => {
          console.log(`   ${index + 1}. ${board.name}`);
        });
        return;
      }
      
      console.log(`\n🎯 Found board: "${targetBoard.name}"`);
    } else if (boards.length === 1) {
      // If only one board, use it automatically
      targetBoard = boards[0];
    } else {
      // Multiple boards - try to find "Editorial AI Project" or similar
      targetBoard = boards.find(board => 
        board.name.toLowerCase().includes('editorial') ||
        board.name.toLowerCase().includes('content') ||
        board.name.toLowerCase().includes('idea')
      ) || boards[0]; // Fallback to first board
      
      console.log(`\n💡 Multiple boards found. Using: "${targetBoard.name}"`);
      console.log("   (To specify a different board, run: npm run get-trello-ids \"Board Name\")");
    }

    // Fetch lists for the target board
    if (targetBoard) {
      console.log(`\n📋 Fetching lists for "${targetBoard.name}"...\n`);
      const lists = await trello.getLists(targetBoard.id);

      if (lists.length === 0) {
        console.log("❌ No lists found in this board.");
        return;
      }

      console.log(`✅ Found ${lists.length} list(s):\n`);
      lists.forEach((list, index) => {
        console.log(`${index + 1}. ${list.name}`);
        console.log(`   List ID: ${list.id}\n`);
      });

      // Find "Content Ideas" list if it exists
      const contentIdeasList = lists.find(
        list => list.name.toLowerCase().includes('content') || 
                list.name.toLowerCase().includes('idea') ||
                list.name.toLowerCase().includes('pitch')
      );

      if (contentIdeasList) {
        console.log("\n🎯 Found potential 'Content Ideas' list:");
        console.log(`   Name: ${contentIdeasList.name}`);
        console.log(`   List ID: ${contentIdeasList.id}\n`);
      }

      // Display .env format
      console.log("\n📝 Add these to your .env.local file:\n");
      console.log(`TRELLO_BOARD_ID=${targetBoard.id}`);
      console.log(`TRELLO_LIST_ID=${contentIdeasList?.id || lists[0].id}`);
      if (contentIdeasList) {
        console.log(`# Using "${contentIdeasList.name}" list`);
      } else {
        console.log(`# Using "${lists[0].name}" list (first list found)`);
      }
    }

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.message.includes('TRELLO_API_KEY') || error.message.includes('TRELLO_TOKEN')) {
      console.error("\n💡 Make sure you have set TRELLO_API_KEY and TRELLO_TOKEN in your .env.local file");
    }
    process.exit(1);
  }
}

// Run the script
main();

