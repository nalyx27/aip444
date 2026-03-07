import axios from 'axios';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';
import { serializeProduct } from './utils';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const DUMMY_JSON_URL = 'https://dummyjson.com/products?limit=200';
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

async function main() {
  try {
    console.log('Fetching products...');
    const response = await axios.get(DUMMY_JSON_URL);
    const products = response.data.products;

    console.log(`Fetched ${products.length} products. Saving to products.json...`);
    await fs.writeFile('products.json', JSON.stringify(products, null, 2));

    console.log('Serializing products...');
    const serializedProducts = products.map(serializeProduct);

    console.log('Generating embeddings...');
    const embeddingResponse = await axios.post(
      'https://openrouter.ai/api/v1/embeddings',
      {
        model: EMBEDDING_MODEL,
        input: serializedProducts,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const embeddings = embeddingResponse.data.data.map((item: any) => item.embedding);

    console.log('Saving vectors.tsv...');
    const vectorLines = embeddings.map((vector: number[]) => vector.join('\t')).join('\n');
    await fs.writeFile('vectors.tsv', vectorLines);

    console.log('Saving metadata.tsv...');
    const metadataHeader = 'Title\tCategory';
    const metadataLines = products.map((p: any) => {
      // Remove any \t or \n characters as per instructions
      const title = p.title.replace(/[\t\n]/g, ' ');
      const category = p.category.replace(/[\t\n]/g, ' ');
      return `${title}\t${category}`;
    });
    await fs.writeFile('metadata.tsv', [metadataHeader, ...metadataLines].join('\n'));

    console.log('Indexing complete!');
  } catch (error: any) {
    console.error('Error during indexing:', error.response?.data || error.message);
  }
}

main();
