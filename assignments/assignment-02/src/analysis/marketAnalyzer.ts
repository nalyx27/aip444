import { JobPosting } from '../shared/schemas';
import { callLLM } from '../shared/llm';

export async function generateMarketAnalysis(jobs: JobPosting[]): Promise<string> {
  const analysisPrompt = `
    Based on the following structured data from multiple job postings, generate a comprehensive market analysis report in Markdown format.
    
    Job Postings Data:
    ${JSON.stringify(jobs, null, 2)}
    
    The report should include:
    1. Most commonly required skills and technologies.
    2. Typical experience levels and education requirements.
    3. Salary ranges (where available).
    4. Common responsibilities and role patterns.
    5. Notable trends or observations about these companies/roles.
    
    Keep the Markdown report professional and actionable for a job seeker.
  `;

  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Aggregating ${jobs.length} postings for market analysis...`);
  }

  const report = await callLLM(analysisPrompt, 'google/gemini-2.0-flash-001', false);
  return report;
}
