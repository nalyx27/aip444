import { ChromaClient, type EmbeddingFunction } from 'chromadb';
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

class OpenRouterEmbeddingFunction implements EmbeddingFunction {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'openai/text-embedding-3-small') {
    this.model = model;
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generate(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts,
    });
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }
}

const client = new ChromaClient({
  host: 'localhost',
  port: 8000,
});

const { OPENROUTER_API_KEY } = process.env;
if (!OPENROUTER_API_KEY) {
  console.error('Missing OPENROUTER_API_KEY environment variable');
  process.exit(1);
}
const embeddingFunction = new OpenRouterEmbeddingFunction(OPENROUTER_API_KEY);

async function main() {
  const args = process.argv.slice(2);
  const query = args.join(' ');
  if (!query) {
    console.error('Please provide a query string.');
    process.exit(1);
  }

  const collection = await client.getCollection({
    name: 'node-docs',
    embeddingFunction,
  });

  console.log(`Querying for: "${query}"...`);
  const results = await collection.query({
    queryTexts: [query],
    nResults: 5,
  });

  if (results.distances && results.documents && results.metadatas) {
      for (let i = 0; i < results.distances[0].length; i++) {
        const distance = results.distances[0][i];
        if (distance === null) continue;
        const similarity = 1 - distance;
        const metadata = results.metadatas[0][i] as any;
        const document = results.documents[0][i] as string;

        console.log(`\n--- Result ${i + 1} (Similarity: ${similarity.toFixed(4)}) ---`);
        console.log(`Breadcrumbs: ${metadata.breadcrumb}`);
        console.log(`Source: ${metadata.source}`);
        console.log(`Preview: ${document ? document.substring(0, 150).replace(/\n/g, ' ') + '...' : ''}`);
      }
  } else {
      console.log('No results found.');
  }
}

main().catch(console.error);
