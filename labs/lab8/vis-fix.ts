import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { tavily } from '@tavily/core';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('Error: OPENROUTER_API_KEY is not set in .env');
  process.exit(1);
}

if (!TAVILY_API_KEY) {
  console.error('Error: TAVILY_API_KEY is not set in .env');
  // We'll proceed but warning might be needed if search is triggered
}

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: OPENROUTER_API_KEY,
});

const tv = tavily({ apiKey: TAVILY_API_KEY || '' });

const SYSTEM_PROMPT = `
You are an expert software debugger with advanced vision capabilities.
Your task is to analyze a screenshot of a terminal or IDE error message and provide a precise fix.

Rules:
1. Always analyze the code and error message in the screenshot carefully.
2. If you need more information about a library version, a specific error code, or modern documentation that might have changed, use the 'web_search' tool.
3. Provide a clear, step-by-step fix including code snippets where appropriate.
4. Be concise but thorough.
`;

/**
 * Step 1: Image Optimization Data Pipeline
 */
async function processImage(imagePath: string): Promise<{ base64: string; stats: any }> {
  const stats = fs.statSync(imagePath);
  const originalSizeKB = (stats.size / 1024).toFixed(2);

  const buffer = await sharp(imagePath)
    .resize(1024, 1024, { fit: 'inside' })
    .jpeg({ quality: 85 })
    .toBuffer();

  const optimizedSizeKB = (buffer.length / 1024).toFixed(2);
  const base64 = buffer.toString('base64');
  const base64SizeKB = (Buffer.from(base64).length / 1024).toFixed(2);

  console.error(`[Debug] Original: ${originalSizeKB}KB, Optimized: ${optimizedSizeKB}KB, Base64: ${base64SizeKB}KB`);

  return {
    base64,
    stats: {
      originalSizeKB,
      optimizedSizeKB,
      base64SizeKB,
    },
  };
}

/**
 * Step 2: Defining the Web Search Tool
 */
const webSearchSchema = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Searches the web for technical documentation, coding errors, and other details to help with debugging.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to use based on the screenshot',
        },
      },
      required: ['query'],
    },
  },
} as const;

async function web_search(query: string) {
  console.log(`[Tool] Searching web for: ${query}`);
  try {
    const results = await tv.search(query, {
      searchDepth: 'advanced',
      maxResults: 5,
    });
    return JSON.stringify(results);
  } catch (error: any) {
    console.error(`[Tool Error] Web search failed: ${error.message}`);
    return `Search failed: ${error.message}`;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: ts-node vis-fix.ts <image_path> [prompt]');
    process.exit(1);
  }

  const imagePath = path.resolve(args[0]);
  const userPrompt = args[1] || 'Analyze this screenshot and provide a fix for the error shown.';

  if (!fs.existsSync(imagePath)) {
    console.error(`Error: File not found at ${imagePath}`);
    process.exit(1);
  }

  const { base64, stats } = await processImage(imagePath);

  const messages: any[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${base64}`,
          },
        },
      ],
    },
  ];

  console.error('[Debug] Sending image to LLM...');

  let iteration = 0;
  const maxIterations = 5;

  while (iteration < maxIterations) {
    iteration++;
    console.error(`[Debug] Iteration ${iteration}: Calling LLM...`);
    const response = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      messages,
      tools: [webSearchSchema],
      tool_choice: 'auto',
    });

    const responseMessage = response.choices[0].message;
    console.error(`[Debug] Iteration ${iteration}: Received response from LLM.`);
    messages.push(responseMessage);

    if (responseMessage.tool_calls) {
      console.error(`[Debug] Iteration ${iteration}: LLM requested tool calls: ${responseMessage.tool_calls.length}`);
      for (const toolCall of responseMessage.tool_calls as any[]) {
        if (toolCall.function.name === 'web_search') {
          const args = JSON.parse(toolCall.function.arguments);
          const toolResult = await web_search(args.query);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
      }
      continue;
    }

    console.log('\n--- Final Analysis ---\n');
    console.log(responseMessage.content);
    console.log('\n--- Optimization Stats ---');
    console.log(`Original: ${stats.originalSizeKB}KB`);
    console.log(`Optimized: ${stats.optimizedSizeKB}KB`);
    console.log(`Base64: ${stats.base64SizeKB}KB`);
    break;
  }
}

main().catch((err) => {
  console.error('Fatal Error:', err.message);
  process.exit(1);
});
