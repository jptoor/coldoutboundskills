/**
 * Deepline port of playbook-social-posts
 *
 * Original: skills/playbooks/playbook-social-posts/SKILL.md (inferred)
 * Output: social_post_line
 *
 * Signal: Recent LinkedIn posts from target person
 * Source: HarvestAPI profile posts
 *
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'social-posts',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('social_post_line', async (row: any) => {
        if (!row.linkedin_url) return '';

        try {
          const posts = await ctx.tools.execute({
            id: 'linkedin_posts',
            tool: 'harvestapi_get_profile_posts',
            input: { profile: row.linkedin_url, limit: 5 },
            description: 'Fetch recent LinkedIn posts',
          });

          const postsList = posts.data?.posts || [];
          if (postsList.length === 0) return '';

          // Generate line about their posting activity
          const result = await ctx.tools.execute({
            id: 'social_post_line_writer',
            tool: 'deeplineagent',
            input: {
              prompt: `Write a short clause about someone's LinkedIn posting activity. Facts: ${JSON.stringify({ recent_posts: postsList.slice(0, 2) })}. Rules: lowercase start, no period, under 80 chars, mention topic if clear.`,
              jsonSchema: {
                type: 'object',
                properties: { social_post_line: { type: 'string' } },
              },
            },
            description: 'Generate social post line',
          });

          return result.data?.social_post_line || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.email || row.linkedin_url || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Produces a copy-ready clause about someone\'s recent LinkedIn posts.',
    billing: { maxCreditsPerRun: 100 },
  }
);
