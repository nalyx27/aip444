import fs from 'fs';
import path from 'path';
import { processResume } from './src/extract/resumeParser';
import { performGapAnalysis, generateGapReportMarkdown } from './src/analysis/gapAnalyzer';

async function main() {
  const resumeDir = path.join(__dirname, 'raw_data/resume');
  const marketReportPath = path.join(__dirname, 'reports/market_analysis.md');
  const outputDir = path.join(__dirname, 'data/resume');
  const reportPath = path.join(__dirname, 'reports/gap_analysis.md');

  if (!fs.existsSync(marketReportPath)) {
    console.error(`Error: Market Analysis Report not found at ${marketReportPath}. Please run Phase 1 first.`);
    process.exit(1);
  }

  const resumeFiles = fs.readdirSync(resumeDir).filter(f => f.endsWith('.pdf') || f.endsWith('.txt'));

  if (resumeFiles.length === 0) {
    console.log('No resume found in raw_data/resume. Please add your resume (PDF or .txt).');
    return;
  }

  // Use the first resume found
  const resumeFile = resumeFiles[0];
  console.log(`Processing resume: ${resumeFile}...`);

  try {
    const resumeData = await processResume(path.join(resumeDir, resumeFile));
    const resumeJsonPath = path.join(outputDir, 'resume.json');
    fs.writeFileSync(resumeJsonPath, JSON.stringify(resumeData, null, 2));
    console.log(`[Phase 2] Resume data saved to ${resumeJsonPath}`);

    const marketAnalysis = fs.readFileSync(marketReportPath, 'utf-8');
    const gapAnalysis = await performGapAnalysis(resumeData, marketAnalysis);
    
    const gapReport = generateGapReportMarkdown(gapAnalysis);
    fs.writeFileSync(reportPath, gapReport);
    console.log(`[Phase 2] Gap Analysis Report saved to ${reportPath}`);

    // Also save the gap analysis as JSON for future use
    const gapJsonPath = path.join(__dirname, 'data/analysis/gap_analysis.json');
    fs.writeFileSync(gapJsonPath, JSON.stringify(gapAnalysis, null, 2));

  } catch (error: any) {
    console.error(`[Phase 2] Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
