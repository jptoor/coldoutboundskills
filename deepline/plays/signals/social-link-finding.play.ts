/**
 * Deepline port of playbook-social-link-finding
 *
 * Output: linkedin_url
 * Signal: Resolve LinkedIn profile from name + company
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'social-link-finding',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('linkedin_url', async (row: any) => {
        if (!row.first_name || !row.last_name || !row.company_domain) return '';

        try {
          // Use person search to find LinkedIn profile
          const search = await ctx.tools.execute({
            id: 'linkedin_profile_search',
            tool: 'prospeo_search_person', // or leadmagic_profile_search
            input: {
              person_name: `${row.first_name} ${row.last_name}`,
              company_domain: row.company_domain,
            },
            description: 'Find LinkedIn profile',
          });

          const results = search.data?.results || [];
          if (results.length === 0) return '';

          // Return first match LinkedIn URL
          return results[0]?.person?.linkedin_url || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.email || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Resolves LinkedIn profile URL from name + company domain.',
    billing: { maxCreditsPerRun: 100 },
  }
);
