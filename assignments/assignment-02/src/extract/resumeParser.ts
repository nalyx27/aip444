import { Resume, ResumeSchema } from '../shared/schemas';
import { callLLM } from '../shared/llm';
import { extractTextFromFile } from '../shared/pdf';
import path from 'path';

export async function processResume(filePath: string): Promise<Resume> {
  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Parsing resume: ${path.basename(filePath)}`);
  }

  let text = await extractTextFromFile(filePath);
  
  // Clean potential noise (dates, URLs at end)
  text = text.replace(/https:\/\/.*?\.pdf/g, '');
  
  const extractionPrompt = `
    You are an expert resume parser. Extract data from the following resume text.
    
    ### CRITICAL:
    - IDENTIFY THE FULL NAME OF THE CANDIDATE. It is usually the first line or strongest text at the top.
    - Extract Hard Skills (Technologies, Tools, Languages) and Soft Skills separately.
    - Extract Work Experience, Education, Certifications, and Projects into their respective arrays.
    - Identify Domain Expertise areas (e.g., Financial Services, Cloud Computing).
    
    ### Resume Text:
    ---
    ${text.substring(0, 10000)}
    ---
    
    Respond STRICTLY with a JSON object follows the required schema. Ensure all fields (fullName, hardSkills, softSkills, workExperience, education, certifications, projects, domainExpertise) are present.
  `;

  const extractedData = await callLLM(extractionPrompt);
  
  // Validate with Zod
  const resumeResult = ResumeSchema.parse(extractedData);

  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Extracted resume data for ${resumeResult.fullName}`);
  }

  return resumeResult;
}
