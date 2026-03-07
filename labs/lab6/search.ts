import axios from 'axios';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { loadDatabase, searchProducts } from './utils';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function getEmbedding(text: string) {
  const response = await axios.post(
    'https://openrouter.ai/api/v1/embeddings',
    {
      model: EMBEDDING_MODEL,
      input: [text],
    },
    {
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data.data[0].embedding;
}

async function main() {
  console.log('Loading database...');
  const products = await loadDatabase();
  console.log('Database loaded. Semantic Search is ready!');

  const ask = () => {
    rl.question('\nWhat are you looking for? (or type "exit" to quit): ', async (query) => {
      if (query.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        const queryEmbedding = await getEmbedding(query);
        const results = await searchProducts(queryEmbedding, products);

        if (results.length > 0) {
          console.log(`Found ${results.length} matches:`);
          results.forEach((p, i) => {
            console.log(`${i + 1}. [Score: ${p.score.toFixed(2)}] ${p.title} - $${p.price}`);
          });
        } else {
          console.log("I'm sorry, we don't have anything like that in stock.");
        }
      } catch (error: any) {
        console.error('Error during search:', error.response?.data || error.message);
      }

      ask();
    });
  };

  ask();
}

main();
