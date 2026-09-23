/**
 * Deepline port of playbook-case-study-page
 *
 * Output: case_study_line
 * Signal: Find + extract case studies from website (customer stories, use cases)
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'case-study-page',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('case_study_line', async (row: any) => {
        if (!row.domain) return '';

        try {
          // Search for case studies on their site
          const search = await ctx.tools.execute({
            id: 'case_study_search',
            tool: 'exa_search',
            input: {
              query: `site:${row.domain} case study OR customer story`,
              num_results: 3,
            },
            description: 'Search for case studies',
          });

          const results = search.extractedLists?.results?.get() || [];
          if (results.length === 0) return '';

          // Extract case study content
          const caseStudyUrl = results[0]?.url;
          const content = await ctx.tools.execute({
            id: 'scrape_case_study',
            tool: 'exa_get_contents',
            input: { ids: [caseStudyUrl] },
            description: 'Scrape case study',
          });

          const text = content.data?.results?.[0]?.text || '';
          if (!text) return '';

          // Generate line about their case studies
          const result = await ctx.tools.execute({
            id: 'case_study_line_writer',
            tool: 'deeplineagent',
            input: {
              prompt: `Analyze this case study and extract ONE insight about their customer base or use cases. Content: ${text.slice(0, 2000)}. Return a short clause (under 80 chars, lowercase start, no period).`,
              jsonSchema: {
                type: 'object',
                properties: { case_study_line: { type: 'string' } },
              },
            },
            description: 'Extract case study insight',
          });

          return result.data?.case_study_line || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.domain || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Extracts insights from customer case studies and success stories.',
    billing: { maxCreditsPerRun: 100 },
  }
);
