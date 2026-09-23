/**
 * Deepline port of playbook-lookalikes
 *
 * Output: lookalike_companies (array of similar companies)
 * Signal: Exa/CrustData similar company discovery
 * Abstain = empty array.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'lookalikes',
  async (
    ctx,
    input: {
      seed_companies: string[]; // Array of seed domains or names
      num_results?: number; // Default: 10
    }
  ) => {
    const numResults = input.num_results || 10;

    let allLookalikes: any[] = [];

    for (const seedCompany of input.seed_companies) {
      try {
        // Use Exa similar company search or CrustData lookalikes
        const lookalikes = await ctx.tools.execute({
          id: 'lookalike_search',
          tool: 'exa_find_similar',
          input: {
            url: `https://${seedCompany}`,
            num_results: numResults,
          },
          description: `Find companies similar to ${seedCompany}`,
        });

        const results = lookalikes.extractedLists?.results?.get() || [];
        allLookalikes = allLookalikes.concat(results);
      } catch (error) {
        // Skip this seed if it fails
        continue;
      }
    }

    // Dedupe and return as dataset
    const uniqueLookalikes = Array.from(
      new Map(allLookalikes.map((item) => [item.url, item])).values()
    );

    const rows = await ctx.dataset('lookalike_companies', uniqueLookalikes).run({
      key: (row: any, index: number) => `lookalike_${index}`,
    });

    return { rows };
  },
  {
    description:
      'Discovers similar companies using Exa similar-link search or CrustData lookalikes.',
    billing: { maxCreditsPerRun: 100 },
  }
);
