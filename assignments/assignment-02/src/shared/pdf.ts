import fs from 'fs';
const pdf = require('pdf-parse');

/**
 * Utility to extract text from a PDF file.
 * Falls back to reading as plain text if it's not a PDF.
 */
export async function extractTextFromFile(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  
  if (filePath.toLowerCase().endsWith('.pdf')) {
    try {
      const data = await pdf(fileBuffer);
      return data.text;
    } catch (error: any) {
      console.error(`[ERROR] PDF parsing failed for ${filePath}: ${error.message}`);
      throw new Error(`Failed to parse PDF: ${filePath}`);
    }
  }
  
  // Assume text file for other extensions
  return fileBuffer.toString('utf-8');
}
