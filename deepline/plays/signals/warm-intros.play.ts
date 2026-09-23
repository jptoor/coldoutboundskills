/**
 * Deepline port of playbook-warm-intros
 *
 * Original: skills/playbooks/playbook-warm-intros/SKILL.md (inferred)
 * Output: mutual_connection
 *
 * Signal: Mutual LinkedIn connections for warm intro
 * Source: Person enrichment → mutual connections
 *
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'warm-intros',
  async (ctx, input: { csv: string; your_linkedin_url: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('mutual_connection', async (row: any) => {
        if (!row.linkedin_url) return '';

        try {
          const mutuals = await ctx.tools.execute({
            id: 'mutual_connections',
            tool: 'leadmagic_profile_search', // or similar tool with mutual connections
            input: {
              linkedin_url: row.linkedin_url,
              your_linkedin_url: input.your_linkedin_url,
            },
            description: 'Find mutual LinkedIn connections',
          });

          const connections = mutuals.data?.mutual_connections || [];
          if (connections.length === 0) return '';

          // Return first mutual connection name
          return connections[0].name || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.email || row.linkedin_url || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Finds mutual LinkedIn connections for warm intro angles.',
    billing: { maxCreditsPerRun: 100 },
  }
);
