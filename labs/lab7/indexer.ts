import path from 'path';
import fs from 'fs/promises';
import { ChromaClient, type EmbeddingFunction } from 'chromadb';
import OpenAI from 'openai';
import { chunkMarkdown } from './chunker.ts';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

// Custom embedding function using OpenRouter and the OpenAI text-embedding-3-small model
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

    // Sort by index to maintain order (API may return in different order)
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }
}

const client = new ChromaClient({
  // Connect to our chroma server.
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
  // 1. Initialize Chroma Collection
  // https://docs.trychroma.com/docs/collections/manage-collections#getting-collections
  const collection = await client.getOrCreateCollection({
    name: 'node-docs',
    embeddingFunction,
  });

  // 2. Read files
  const docsDir = path.join('.', 'docs');
  const files = await fs.readdir(docsDir);

  for (const file of files) {
    // Skip non-Markdown files
    if (!file.endsWith('.md')) {
      continue;
    }

    console.log(`Processing ${file}...`);
    const text = await fs.readFile(path.join(docsDir, file), 'utf-8');

    // 3. Chunk
    const chunks = chunkMarkdown(text, file);
    if (chunks.length === 0) {
      continue;
    }

    // 4. Embed & Store
    // - Generate embeddings for chunk.content using openai.embeddings.create
    // - Add to collection: ids, embeddings, metadatas, documents
    // https://docs.trychroma.com/docs/collections/add-data
    const ids = chunks.map((c) => c.id);
    const documents = chunks.map((c) => c.content);
    // metadata = { source, heading, breadcrumb }
    const metadatas = chunks.map((c) => c.metadata);

    // Add to collection (embeds automatically via embeddingFunction)
    // NOTE: you can also use `.upsert()` instead of `.add()` so that
    // it is safe to add the same item more than once.
    await collection.add({
      ids,
      documents,
      metadatas,
    });
  }

  console.log('Indexing complete!');
}

main();
