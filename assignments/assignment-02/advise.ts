import fs from 'fs';
import path from 'path';
import { generateApplicationReport } from './src/advisor/advisorEngine';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log('Usage: npx ts-node advise.ts <new_job_posting_pdf_or_txt>');
    process.exit(1);
  }

  const newJobPath = path.resolve(args[0]);
  if (!fs.existsSync(newJobPath)) {
    console.error(`Error: New job posting not found at ${newJobPath}`);
    process.exit(1);
  }

  const marketReportPath = path.join(__dirname, 'reports/market_analysis.md');
  const resumeJsonPath = path.join(__dirname, 'data/resume/resume.json');
  const gapJsonPath = path.join(__dirname, 'data/analysis/gap_analysis.json');
  const reportPath = path.join(__dirname, 'reports/application_report.md');

  // Validate context availability
  if (!fs.existsSync(marketReportPath) || !fs.existsSync(resumeJsonPath) || !fs.existsSync(gapJsonPath)) {
    console.error('Error: Required context (market report, resume data, or gap analysis) missing.');
    console.error('Please ensure you have run Phase 1 and Phase 2 successfully.');
    process.exit(1);
  }

  console.log('Loading context and advising on the new application...');

  try {
    const marketAnalysis = fs.readFileSync(marketReportPath, 'utf-8');
    const resume = JSON.parse(fs.readFileSync(resumeJsonPath, 'utf-8'));
    const gapAnalysis = JSON.parse(fs.readFileSync(gapJsonPath, 'utf-8'));

    const finalReport = await generateApplicationReport(newJobPath, resume, marketAnalysis, gapAnalysis);
    
    fs.writeFileSync(reportPath, finalReport);
    console.log(`[Phase 3] Application Advisor Report saved to ${reportPath}`);
  } catch (error: any) {
    console.error(`[Phase 3] Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
