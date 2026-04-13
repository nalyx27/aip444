import { z } from 'zod';

/**
 * Schema for structured Job Posting data
 */
export const JobPostingSchema = z.object({
  jobTitle: z.string().nullish().default('Unknown Title'),
  companyName: z.string().nullish().default('Unknown Company'),
  location: z.string().nullish().describe('City, State, or Remote/Hybrid status'),
  skillsRequired: z.array(z.string()).default([]).describe('List of mandatory hard skills/technologies'),
  skillsPreferred: z.array(z.string()).default([]).describe('List of preferred or nice-to-have skills'),
  experienceLevel: z.string().nullish().describe('Years of experience or seniority level'),
  educationRequirements: z.string().nullish().describe('Minimum degree or specific education required'),
  salaryRange: z.string().nullish().describe('Salary range if listed, otherwise null'),
  responsibilities: z.array(z.string()).default([]).describe('Key job responsibilities and duties'),
  companyResearch: z.object({
    size: z.string().nullish(),
    industry: z.string().nullish(),
    recentNews: z.array(z.string()).default([]).describe('Recent company developments or news'),
    cultureSignals: z.array(z.string()).default([]).describe('Insights into company culture from reviews/blogs'),
    additionalContext: z.string().nullish()
  }).nullish().optional()
});

export type JobPosting = z.infer<typeof JobPostingSchema>;

/**
 * Schema for structured Resume data
 */
export const ResumeSchema = z.object({
  fullName: z.string().nullish().default('Unknown Name'),
  hardSkills: z.array(z.string()).default([]).describe('Programming languages, frameworks, tools, platforms'),
  softSkills: z.array(z.string()).default([]).describe('Communication, leadership, problem-solving'),
  workExperience: z.array(z.object({
    role: z.string().nullish(),
    company: z.string().nullish(),
    duration: z.string().nullish(),
    achievements: z.array(z.string()).default([])
  })).default([]),
  education: z.array(z.object({
    degree: z.string().nullish(),
    institution: z.string().nullish(),
    graduationDate: z.string().nullish()
  })).default([]),
  certifications: z.array(z.string()).default([]),
  projects: z.array(z.object({
    name: z.string().nullish(),
    description: z.string().nullish(),
    outcome: z.string().nullish()
  })).default([]),
  domainExpertise: z.array(z.string()).default([]).describe('Industry terminology, methodologies like Agile, CI/CD, etc.')
});

export type Resume = z.infer<typeof ResumeSchema>;

/**
 * Schema for Gap Analysis
 */
export const GapTriageLevelSchema = z.enum(['Quick win', 'Short-term', 'Medium-term', 'Long-term']);

export const GapAnalysisSchema = z.object({
  strengths: z.array(z.any().transform(v => typeof v === 'string' ? v : JSON.stringify(v))).default([]),
  gaps: z.array(z.union([
    z.object({
      skill: z.string().default('Unknown Skill'),
      triageLevel: GapTriageLevelSchema.default('Short-term'),
      actionPlan: z.string().default('No action plan provided.')
    }),
    z.string().transform(v => ({
      skill: v,
      triageLevel: 'Short-term' as const,
      actionPlan: 'No action plan provided.'
    }))
  ])).default([]),
  uniqueValue: z.array(z.any().transform(v => typeof v === 'string' ? v : JSON.stringify(v))).default([])
});

export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;
