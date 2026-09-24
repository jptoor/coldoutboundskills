/**
 * Deepline port of playbook-job-posting-language
 *
 * Original: skills/playbooks/playbook-job-posting-language/SKILL.md (inferred)
 * Output: job_posting_insight
 *
 * Signal: Parse job descriptions for GTM signals (tech stack, pain points, initiatives)
 * Source: Job postings → deeplineagent analysis
 *
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'job-posting-language',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('job_posting_insight', async (row: any) => {
        if (!row.domain) return '';

        try {
          // Fetch recent job postings
          const jobs = await ctx.tools.execute({
            id: 'job_postings',
            tool: 'crustdata_companydb_search', // or job postings API
            input: { domain: row.domain },
            description: 'Fetch job postings',
          });

          const postings = jobs.data?.job_postings || [];
          if (postings.length === 0) return '';

          // Analyze job posting language for GTM signals
          const result = await ctx.tools.execute({
            id: 'job_language_analyzer',
            tool: 'deeplineagent',
            input: {
              prompt: `Analyze these job postings and extract ONE insight about their GTM strategy, tech stack, or pain points. Job postings: ${JSON.stringify(postings.slice(0, 3))}. Return a short clause (under 80 chars, lowercase start, no period).`,
              jsonSchema: {
                type: 'object',
                properties: {
                  job_posting_insight: { type: 'string' },
                  confidence: { type: 'string', enum: ['high', 'low'] },
                },
              },
            },
            description: 'Extract GTM insight from job postings',
          });

          return result.data?.job_posting_insight || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.domain || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Extracts GTM insights from job posting language.',
    billing: { maxCreditsPerRun: 100 },
  }
);
