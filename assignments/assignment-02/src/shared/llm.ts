import axios from 'axios';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function callLLM(prompt: string, model: string = 'google/gemini-2.0-flash-001', jsonMode: boolean = true) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in .env');
  }

  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] LLM call: ${model} (JSON: ${jsonMode})`);
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: jsonMode ? { type: 'json_object' } : undefined,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/antigravity-ai-assistant',
          'X-Title': 'Job Search Assistant',
        },
      }
    );

    const content = response.data.choices[0].message.content;
    
    if (jsonMode) {
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error('[DEBUG] Failed to parse JSON from LLM response.');
        throw new Error('Invalid JSON response from LLM');
      }
    }

    return content;
  } catch (error: any) {
    console.error(`[ERROR] LLM call failed: ${error.response?.data?.error?.message || error.message}`);
    throw error;
  }
}
