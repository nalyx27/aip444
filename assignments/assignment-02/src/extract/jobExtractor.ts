import { JobPosting, JobPostingSchema } from '../shared/schemas';
import { callLLM } from '../shared/llm';
import { performWebSearch } from '../shared/search';
import { extractTextFromFile } from '../shared/pdf';
import fs from 'fs';
import path from 'path';

export async function processJobPosting(filePath: string): Promise<JobPosting> {
  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Processing job posting: ${path.basename(filePath)}`);
  }

  let text = await extractTextFromFile(filePath);
  const baseName = path.parse(filePath).name;
  
  // Clean Indeed-specific noise
  text = text.replace(/WhatJob title, keywords, or com.*?Find Jobs/gs, '');
  text = text.replace(/Apply now.*?Job details/gs, '');
  text = text.replace(/Here’s how the job details align with your profile\./g, '');
  text = text.replace(/https:\/\/ca\.indeed\.com\/viewjob\?jk=.*?desktop_copy\d\/\d/g, '');
  
  const extractionPrompt = `
    You are an expert recruitment assistant. Extract data from the following job posting text.
    
    ### CRITICAL:
    - IDENTIFY THE JOB TITLE AND COMPANY NAME. They are usually at the very beginning. 
    - If you are unsure about the company, look for keywords like "at [Company]" or "About [Company]".
    - If the text looks like an Indeed job page, the title is usually the first line.
    - Fallback: The filename is "${baseName}". Use it if the text is unclear.
    
    ### Job Posting Text:
    ---
    ${text.substring(0, 10000)}
    ---
    
    Respond STRICTLY with a JSON object follows this schema:
    {
      "jobTitle": string,
      "companyName": string,
      "location": string | null,
      "skillsRequired": string[],
      "skillsPreferred": string[],
      "experienceLevel": string | null,
      "educationRequirements": string | null,
      "salaryRange": string | null,
      "responsibilities": string[]
    }
  `;

  const extractedData = await callLLM(extractionPrompt);
  
  // Validate with Zod
  const jobResult = JobPostingSchema.parse(extractedData);
  
  // Perform company research only if we have a valid company name
  if (jobResult.companyName && jobResult.companyName !== 'Unknown Company') {
    const searchQuery = `${jobResult.companyName} company size industry culture values news Toronto`;
    const searchResults = await performWebSearch(searchQuery);
    
    const researchPrompt = `
      Based on the following web search results, provide structured research data for the company "${jobResult.companyName}".
      Focus on providing a single summary for THIS SPECIFIC COMPANY.
      
      Search Results:
      ${JSON.stringify(searchResults)}
      
      Respond STRICTLY with a SINGLE JSON object (not an array) matching this structure:
      {
        "size": string | null,
        "industry": string | null,
        "recentNews": string[],
        "cultureSignals": string[],
        "additionalContext": string | null
      }
    `;
    
    try {
      const researchData = await callLLM(researchPrompt);
      // If LLM returned an array (hallucination), take the first element if it's an object
      const researchObject = Array.isArray(researchData) ? researchData[0] : researchData;
      jobResult.companyResearch = researchObject;
    } catch (e: any) {
      console.error(`[Phase 1] Research failed for ${jobResult.companyName}: ${e.message}`);
    }
  }

  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Extracted ${jobResult.skillsRequired.length} required skills for ${jobResult.companyName}`);
  }

  return jobResult;
}
