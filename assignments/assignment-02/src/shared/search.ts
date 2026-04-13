import { tavily } from '@tavily/core';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

export async function performWebSearch(query: string) {
  if (!TAVILY_API_KEY) {
    console.error('[WARNING] TAVILY_API_KEY is not set. Web search will be skipped.');
    return 'Search skipped: API key missing.';
  }

  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Tool call: web_search("${query}")`);
  }

  try {
    const tv = tavily({ apiKey: TAVILY_API_KEY });
    const results = await tv.search(query, {
      searchDepth: 'advanced',
      maxResults: 5,
    });
    
    if (process.env.LOG_LEVEL === 'debug') {
      console.error(`[DEBUG] Search returned ${results.results.length} results.`);
    }

    return results.results.map(r => ({
      title: r.title,
      url: r.url,
      content: r.content
    }));
  } catch (error: any) {
    console.error(`[ERROR] Web search failed: ${error.message}`);
    return `Search failed: ${error.message}`;
  }
}
