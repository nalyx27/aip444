import fs from 'fs';
import path from 'path';
import { processJobPosting } from './src/extract/jobExtractor';
import { generateMarketAnalysis } from './src/analysis/marketAnalyzer';
import { JobPosting } from './src/shared/schemas';

async function main() {
  const jobsDir = path.join(__dirname, 'raw_data/jobs');
  const outputDir = path.join(__dirname, 'data/jobs');
  const reportPath = path.join(__dirname, 'reports/market_analysis.md');

  if (!fs.existsSync(jobsDir)) {
    console.error(`Error: Job directory not found at ${jobsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(jobsDir).filter(f => f.endsWith('.pdf') || f.endsWith('.txt'));

  if (files.length === 0) {
    console.log('No job postings found in raw_data/jobs. Please add some PDFs or .txt files.');
    return;
  }

  console.log(`Found ${files.length} job postings. Processing...`);

  const processedJobs: JobPosting[] = [];

  for (const file of files) {
    const baseName = path.parse(file).name;
    const outputPath = path.join(outputDir, `${baseName}.json`);

    if (fs.existsSync(outputPath)) {
      console.log(`[Phase 1] Skipping ${file} (already processed).`);
      processedJobs.push(JSON.parse(fs.readFileSync(outputPath, 'utf-8')));
      continue;
    }

    try {
      const jobData = await processJobPosting(path.join(jobsDir, file));
      fs.writeFileSync(outputPath, JSON.stringify(jobData, null, 2));
      processedJobs.push(jobData);
      console.log(`[Phase 1] Processed ${file}`);
    } catch (error: any) {
      console.error(`[Phase 1] Error processing ${file}: ${error.message}`);
    }
  }

  if (processedJobs.length > 0) {
    console.log('Generating Market Analysis Report...');
    const report = await generateMarketAnalysis(processedJobs);
    fs.writeFileSync(reportPath, report);
    console.log(`[Phase 1] Market Analysis Report saved to ${reportPath}`);
  } else {
    console.log('No jobs were successfully processed.');
  }
}

main().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
