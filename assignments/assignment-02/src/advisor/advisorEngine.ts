import { JobPosting, Resume, GapAnalysis } from '../shared/schemas';
import { callLLM } from '../shared/llm';
import { performWebSearch } from '../shared/search';
import { processJobPosting } from '../extract/jobExtractor';

export async function generateApplicationReport(
  newJobPath: string,
  resume: Resume,
  marketAnalysis: string,
  gapAnalysis: GapAnalysis
): Promise<string> {
  if (process.env.LOG_LEVEL === 'debug') {
    console.error(`[DEBUG] Advising on new job: ${newJobPath}`);
  }

  // 1. Extract and research the new job posting
  const jobData = await processJobPosting(newJobPath);

  // 2. Prepare the prompt for the comprehensive report
  const advisorPrompt = `
    You are an expert Job Search Advisor. Generate a comprehensive application report for the following job using the provided context.
    
    New Job Posting (JSON):
    ${JSON.stringify(jobData, null, 2)}
    
    Applicant Resume (JSON):
    ${JSON.stringify(resume, null, 2)}
    
    Overall Market Analysis (Markdown):
    ---
    ${marketAnalysis}
    ---
    
    Recent Gap Analysis (JSON):
    ${JSON.stringify(gapAnalysis, null, 2)}
    
    Your report MUST include these four sections in Markdown:
    
    1. FIT ASSESSMENT
       - Provide a fit score (0-100%).
       - Breakdown of requirements met vs. gaps.
       - Clear recommendation (e.g., "80%+ Strong Fit", "50-80% Good Fit", etc.).
       - ENCOURAGE applying if there is a reasonable match.
    
    2. RESUME ADAPTATION
       - Specific, concrete suggestions for tailoring the resume to this specific posting.
       - Focus on reordering, reframing, or emphasizing specific experiences.
    
    3. COVER LETTER GUIDANCE
       - Key points to hit in a cover letter.
       - What to emphasize about background.
       - How to address specific needs discovered in company research.
    
    4. INTERVIEW PREP
       - Likely interview questions based on the requirements and background.
       - Specific skills to brush up on.
       - Potential talking points.
    
    The report should be visually polished and professional.
  `;

  if (process.env.LOG_LEVEL === 'debug') {
    console.error('[DEBUG] Calling LLM to generate advisor report...');
  }

  const report = await callLLM(advisorPrompt, 'google/gemini-2.0-flash-001', false);
  return report;
}
