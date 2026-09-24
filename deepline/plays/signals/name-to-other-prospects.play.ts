/**
 * Deepline port of playbook-name-to-other-prospects
 *
 * Output: other_prospects (array of coworkers at same domain)
 * Signal: Find coworkers at same domain (account-based selling)
 * Abstain = empty array.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'name-to-other-prospects',
  async (ctx, input: { csv: string; titles_to_find?: string[] }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('other_prospects', async (row: any) => {
        if (!row.company_domain) return [];

        try {
          // Search for other people at the same company
          const search = await ctx.tools.execute({
            id: 'coworker_search',
            tool: 'prospeo_search_person',
            input: {
              company_domain: row.company_domain,
              person_job_title: input.titles_to_find
                ? { include: input.titles_to_find }
                : undefined,
            },
            description: `Find other prospects at ${row.company_domain}`,
          });

          const results = search.data?.results || [];

          // Filter out the original person
          const others = results.filter(
            (r: any) =>
              r.person?.email !== row.email && r.person?.linkedin_url !== row.linkedin_url
          );

          return others.map((r: any) => ({
            first_name: r.person?.first_name,
            last_name: r.person?.last_name,
            title: r.person?.current_title,
            email: r.person?.email,
            linkedin_url: r.person?.linkedin_url,
          }));
        } catch (error) {
          return [];
        }
      })
      .run({ key: (row: any) => row.email || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Finds coworkers at the same domain for account-based selling.',
    billing: { maxCreditsPerRun: 100 },
  }
);
