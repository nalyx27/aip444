# Assignment 2 Reflection: Job Search Assistant

## Architecture: Workflow, Agent, or Hybrid?
The project is structured as a **deterministic workflow pipeline**. Each phase builds on the structured data produced by the previous one (Phase 1 JSON -> Phase 2 Gap Analysis -> Phase 3 Advice). This ensures reliability and allows for easier debugging of extraction issues before advice is generated.

## Prompt Engineering & Extraction Consistency
The most significant improvement came from **Indeed-specific noise cleaning** (regex-based) and providing the **filename as a fallback** for the job title/company. This prevented the LLM from hallucinating names from general page headers.

## Structured Output Schemas
I used **Zod schemas** to strictly enforce the shape of data extracted from job postings and company research. This allowed the system to catch "hallucinated" arrays or missing fields early, preventing crashes in the comparison logic.

## Fit Scoring System
The scoring system was designed to be **optimistic**. For example, even with a low score like **30% for the Momentum Data Scientist role** (as seen in the generated `application_report.md`), the system still provides constructive advice. This ensures that the user is encouraged to apply while remaining realistic about the work needed to bridge technical gaps.

## Models and Cost
I used **Gemini 2.0 Flash 001** via OpenRouter. It provided the best balance of context window (important for long Job Posting PDFs) and cost efficiency, allowing for repeated runs without significant expense.

## Coding Agent Process (Phase 3)
I used **Antigravity**. During Phase 3 implementation, the agent initially failed to account for a common LLM hallucination where a search result summary was wrapped in an array instead of a single object. I had to manually add a type-check fix in `jobExtractor.ts` (lines 79-80) to ensure the `companyResearch` field was correctly processed regardless of the wrapper.

## Other AI Tools
I used **Tavily** for company research, which worked exceptionally well for providing "Culture Signals" that weren't present in the job postings themselves. In the final report for Momentum Financial Services, this allowed the system to specifically mention their commitment to **ethical AI and AIDA**, making the cover letter advice feel much more personalized.

## Evaluation & Current Limitations
Following the full pipeline execution, a few key findings emerged:
- **Market Validation:** The `market_analysis.md` report correctly identified SQL and Python as the most critical skills for the Toronto market, vindicating the focus of the extraction logic.
- **Action Plan Sparse Data:** The `gap_analysis.md` currently defaults to "No action plan provided" for many identified gaps. This suggests that while the system is excellent at *identifying* gaps, the logic for *remediating* them needs more robust prompt instruction or a secondary lookup for learning resources.
- **Accuracy:** The system successfully avoided hallucinating experience that wasn't on the resume, correctly identifying that the candidate is transitioning from a non-data background.
