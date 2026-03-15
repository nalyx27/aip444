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

const openai = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const embeddingFunction = new OpenRouterEmbeddingFunction(OPENROUTER_API_KEY);

async function main() {
  const args = process.argv.slice(2);
  const question = args.join(' ');
  if (!question) {
    console.error('Please provide a question.');
    process.exit(1);
  }

  // 1. Retrieve
  const collection = await client.getCollection({
    name: 'node-docs',
    embeddingFunction,
  });

  const results = await collection.query({
    queryTexts: [question],
    nResults: 5, // Get top 5 relevant chunks
  });

  if (!results.documents || results.documents[0].length === 0) {
      console.error('No context found.');
      process.exit(1);
  }

  // 2. Augment Context
  let contextXml = `<context>\n`;
  const metadatas = results.metadatas![0];
  const documents = results.documents![0];

  for (let i = 0; i < documents.length; i++) {
    const doc = documents[i];
    const meta = metadatas[i] as any;
    console.error(`[Retrieved Context Source: ${meta.source} (${meta.breadcrumb})]`);
    contextXml += `  <doc source="${meta.source}" breadcrumb="${meta.breadcrumb}">\n`;
    contextXml += `    ${doc}\n`;
    contextXml += `  </doc>\n`;
  }
  contextXml += `</context>`;

  // 3. Generate
  const systemPrompt = `You are ask-node, an expert node.js assistant that answers questions about Node.js.

Here is some context from the official documentation:

${contextXml}

Instructions:
1. Answer the user's question based ONLY on the provided context.
2. If the answer is not in the context, say "I don't have enough information to answer that."
3. Cite the source file(s) (e.g., fs.md) for your information.`;

  console.error('\nThinking...\n');

  const response = await openai.chat.completions.create({
    model: 'google/gemini-3.1-flash-lite-preview',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question }
    ]
  });

  // 4. Output
  console.log(response.choices[0].message.content);
}

main().catch(console.error);
