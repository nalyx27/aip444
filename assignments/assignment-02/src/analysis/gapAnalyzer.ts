import { Resume, GapAnalysis, GapAnalysisSchema } from '../shared/schemas';
import { callLLM } from '../shared/llm';

export async function performGapAnalysis(resume: Resume, marketAnalysis: string): Promise<GapAnalysis> {
  const analysisPrompt = `
    Compare the following resume data against the job market analysis provided.
    
    Resume Data (JSON):
    ${JSON.stringify(resume, null, 2)}
    
    Market Analysis (Markdown):
    ---
    ${marketAnalysis}
    ---
    
    Tasks:
    1. Identify Strengths: Skills you have that are in high demand.
    2. Identify Gaps: Skills missing or underrepresented that are frequently requested.
    3. Identify Unique Value: Qualifications you have that aren't common in the market.
    4. Triage Gaps: Categorize each gap as 'Quick win', 'Short-term', 'Medium-term', or 'Long-term', and provide a specific, actionable plan.
    
    Respond STRICTLY with a JSON object.
  `;

  if (process.env.LOG_LEVEL === 'debug') {
    console.error('[DEBUG] Performing gap analysis between resume and market report...');
  }

  const result = await callLLM(analysisPrompt);
  
  // Validate with Zod
  return GapAnalysisSchema.parse(result);
}

export function generateGapReportMarkdown(analysis: GapAnalysis): string {
  let md = `# Resume Gap Analysis Report\n\n`;
  
  md += `## Strengths\n`;
  analysis.strengths.forEach(s => md += `- ${s}\n`);
  
  md += `\n## Gaps and Triage\n`;
  analysis.gaps.forEach(g => {
    md += `### ${g.skill} [**${g.triageLevel}**]\n`;
    md += `**Action Plan:** ${g.actionPlan}\n\n`;
  });
  
  md += `## Unique Value\n`;
  analysis.uniqueValue.forEach(v => md += `- ${v}\n`);
  
  return md;
}
