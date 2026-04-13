# Phase 3: Evaluation Evidence

This document summarizes the evaluation of the Phase 3 Job Advisor, covering test cases, consistency checks, and specific performance examples.

## 1. What was Tested

I spot-checked the following job postings to evaluate extraction accuracy and advisor relevance:

| Job Posting File | Role & Company | Fit Level |
|------------------|----------------|-----------|
| `Data Scientist - ...` | Data Scientist @ Momentum Financial | Low (25-35%) |
| `Data Analyst - ...` | Data Analyst @ COSMO | Low (30%) |
| `IT Business_Systems...` | IT Systems Analyst @ CWB Group | Medium (55%) |

**Methodology**:
- For each posting, I ran the full pipeline: Phase 1 (Data Extraction/Research) -> Phase 2 (Gap Analysis) -> Phase 3 (Advisor).
- I compared the generated `application_report.md` against the original resume to ensure no experience was hallucinated.

## 2. Consistency Check

I ran the Phase 3 advisor on the **Momentum Data Scientist** posting twice to check for output stability.

**Findings**:
- **Numerical Score Variance**: Run 1 gave a **35%** fit, while Run 2 gave a **25%** fit.
- **Triage Tone**: Run 1 was slightly more optimistic ("Consider applying with targeted adaptation"), while Run 2 was more conservative ("Application highly discouraged without significant upskilling").
- **Content Consistency**: Both runs correctly identified the exact same technical gaps (SQL, Python, R, ML) and correctly referenced the company's mission.
- **Verdict**: The 10% score variance is acceptable for a "ballpark" assessment, but it highlights that users should focus on the **qualitative advice** (how to adapt) rather than the exact number.

## 3. What Worked and What Didn't

### Example 1: Personalized Culture Signals (Worked)
- **Scenario**: Momentum Financial Services.
- **Result**: The advisor used news data from Tavily to mention Momentum's commitment to **ethical AI and AIDA compliance**.
- **Analysis**: This was a huge success. The job posting itself didn't mention these specifics, but by injecting research into the advisor's context, the cover letter advice became significantly more personal/professional.

### Example 2: Fit Score Stochasticity (Surprising)
- **Scenario**: Consistency check on the Momentum role.
- **Result**: The "Fit Score" changed by 10% despite identical inputs.
- **Analysis**: This is likely due to the LLM's temperature and the complex reasoning required to assign a numeric value to a qualitative gap. It suggests that a "range" or "category" (e.g., Low, Medium, High) would be more reliable than a single integer.

### Example 3: Extraction Robustness Fix (Surprising/Technical)
- **Scenario**: Initial run on the CWB Systems Analyst role.
- **Result**: The LLM returned the extracted job data wrapped in a JSON array `[...]` instead of a flat object `{...}`, which initially caused a Zod validation error.
- **Analysis**: I had to implement a robustness check in `jobExtractor.ts` (the "cleanExtractedData" block) to automatically flatten arrays. This fixed the reliability of the advisor's ingestion phase.

## 4. Overall Take

The system is **Highly Reliable** for generating strategic advice (resume tailoring, interview prep) and identifying technical gaps. It effectively synthesizes market data, company research, and resume content into a coherent strategy.

**Human Double-Check Required**:
- **Fit Scores**: Humans should interpret the fit score as a general indicator of difficulty rather than an absolute rule.
- **Action Plans**: The current `gap_analysis.md` occasionally provides sparse action plans (e.g., "No action plan provided"). A human should verify and expand these remediation steps before starting their upskilling journey.

---
**Evaluation Artifacts Reference**:
- [Momentum Run 1 Report](file:///c:/Users/nalyx/Documents/aip444/assignments/assignment-02/reports/evaluation_momentum_1.md)
- [Momentum Run 2 Report](file:///c:/Users/nalyx/Documents/aip444/assignments/assignment-02/reports/evaluation_momentum_2.md)
- [Data Analyst Report](file:///c:/Users/nalyx/Documents/aip444/assignments/assignment-02/reports/evaluation_data_analyst.md)
- [Systems Analyst Report](file:///c:/Users/nalyx/Documents/aip444/assignments/assignment-02/reports/evaluation_systems_analyst.md)
