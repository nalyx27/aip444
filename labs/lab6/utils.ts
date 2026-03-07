import { readFile } from 'fs/promises';

export function serializeProduct(product: any): string {
  const parts = [
    `Title: ${product.title}`,
    `Category: ${product.category}`,
    `Description: ${product.description}`,
    `Tags: ${product.tags ? product.tags.join(', ') : ''}`,
    `Brand: ${product.brand}`
  ];
  return parts.join(' | ');
}

export function dotProduct(vecA: number[], vecB: number[]): number {
  return vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
}

export async function loadDatabase() {
  // 1. Read the JSON file
  const productsData = await readFile('products.json', 'utf-8');
  const products = JSON.parse(productsData);

  // 2. Read the TSV file
  const vectorsData = await readFile('vectors.tsv', 'utf-8');
  const lines = vectorsData.trim().split('\n');

  // 3. Attach vectors to products
  // We assume Line 0 of vectors.tsv matches products[0]
  const productsWithEmbeddings = products.map((product: any, index: number) => {
    const vectorString = lines[index];
    if (!vectorString) return { ...product, embedding: [] };
    // Convert tab-separated values to a list of float numbers
    const vector = vectorString.split('\t').map(Number);
    return { ...product, embedding: vector };
  });

  return productsWithEmbeddings;
}

export async function searchProducts(
  queryEmbedding: number[], // Pass the embedding directly to make it cleaner
  products: any[],
  minScore: number = 0.30
): Promise<any[]> {
  const scoredProducts = products.map(product => ({
    ...product,
    score: dotProduct(queryEmbedding, product.embedding)
  }));

  const filteredProducts = scoredProducts.filter(p => p.score >= minScore);

  filteredProducts.sort((a, b) => b.score - a.score);

  return filteredProducts.slice(0, 5);
}
