/**
 * Deepline port of playbook-google-site-search
 *
 * Output: site_search_result
 * Signal: `site:domain.com` Google search operator for specific pages/content
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'google-site-search',
  async (
    ctx,
    input: {
      csv: string;
      search_query: string; // e.g., "case study" or "pricing" or "customer"
    }
  ) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('site_search_result', async (row: any) => {
        if (!row.domain) return '';

        try {
          // Use Exa search with site: operator
          const search = await ctx.tools.execute({
            id: 'google_site_search',
            tool: 'exa_search',
            input: {
              query: `site:${row.domain} ${input.search_query}`,
              num_results: 5,
            },
            description: `Search ${row.domain} for ${input.search_query}`,
          });

          const results = search.extractedLists?.results?.get() || [];
          if (results.length === 0) return '';

          // Return first result URL (or analyze content)
          return results[0]?.url || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.domain || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Performs site:domain.com Google search for specific content.',
    billing: { maxCreditsPerRun: 50 },
  }
);
