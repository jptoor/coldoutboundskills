/**
 * Deepline port of playbook-ad-library
 *
 * Original: skills/playbooks/playbook-ad-library/SKILL.md (inferred)
 * Output: ad_library_line
 *
 * Signal: Facebook/Meta Ad Library - active ad campaigns reveal GTM strategy
 * Source: Meta Ad Library API → ad copy analysis
 *
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'ad-library',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('ad_library_line', async (row: any) => {
        if (!row.company_name && !row.domain) return '';

        try {
          // Search Meta Ad Library
          // TODO: Use actual Meta Ad Library API or scraper
          const ads = await ctx.tools.execute({
            id: 'meta_ad_search',
            tool: 'generic_http_request', // or dedicated Meta Ad Library tool if available
            input: {
              url: 'https://www.facebook.com/ads/library/api/',
              method: 'GET',
              params: {
                search_terms: row.company_name || row.domain,
                ad_type: 'ALL',
                search_page_ids: '',
                ad_reached_countries: 'US',
              },
            },
            description: 'Search Meta Ad Library',
          });

          const adsData = ads.data?.data || [];
          if (adsData.length === 0) return '';

          // Analyze ad copy for messaging/positioning
          const result = await ctx.tools.execute({
            id: 'ad_copy_analyzer',
            tool: 'deeplineagent',
            input: {
              prompt: `Analyze these Facebook ads and extract ONE insight about their messaging or target audience. Ads: ${JSON.stringify(adsData.slice(0, 3))}. Return a short clause (under 80 chars, lowercase start, no period).`,
              jsonSchema: {
                type: 'object',
                properties: {
                  ad_library_line: { type: 'string' },
                },
              },
            },
            description: 'Extract ad library insight',
          });

          return result.data?.ad_library_line || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.domain || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Extracts GTM insights from Meta/Facebook Ad Library campaigns.',
    billing: { maxCreditsPerRun: 100 },
  }
);
