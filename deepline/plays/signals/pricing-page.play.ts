/**
 * Deepline port of playbook-pricing-page
 *
 * Output: pricing_insight
 * Signal: Scrape + analyze pricing page structure (self-serve vs sales-led, pricing tiers)
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'pricing-page',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('pricing_insight', async (row: any) => {
        if (!row.domain) return '';

        try {
          // Find pricing page via site search
          const pricingUrl = `https://${row.domain}/pricing`;

          // Scrape pricing page
          const page = await ctx.tools.execute({
            id: 'scrape_pricing',
            tool: 'exa_get_contents',
            input: { ids: [pricingUrl] },
            description: 'Scrape pricing page',
          });

          const content = page.data?.results?.[0]?.text || '';
          if (!content) return '';

          // Analyze pricing structure
          const result = await ctx.tools.execute({
            id: 'pricing_analyzer',
            tool: 'deeplineagent',
            input: {
              prompt: `Analyze this pricing page and extract ONE insight about their pricing model (self-serve vs sales-led, tier structure, value prop). Content: ${content.slice(0, 2000)}. Return a short clause (under 80 chars, lowercase start, no period).`,
              jsonSchema: {
                type: 'object',
                properties: { pricing_insight: { type: 'string' } },
              },
            },
            description: 'Extract pricing insight',
          });

          return result.data?.pricing_insight || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.domain || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Analyzes pricing page structure for GTM insights.',
    billing: { maxCreditsPerRun: 100 },
  }
);
