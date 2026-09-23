/**
 * Deepline port of playbook-tech-on-website
 *
 * Output: tech_stack_line
 * Signal: BuiltWith-style tech detection (analytics, CRM, martech stack)
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'tech-on-website',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('tech_stack_line', async (row: any) => {
        if (!row.domain) return '';

        try {
          // TODO: Use actual tech detection tool (BuiltWith API, Wappalyzer, or similar)
          // For now, this is a STUB showing the contract
          const tech = await ctx.tools.execute({
            id: 'tech_detection',
            tool: 'generic_http_request', // or builtwith_api if available in Deepline
            input: {
              url: `https://api.builtwith.com/v20/api.json`,
              params: {
                KEY: 'BUILTWITH_API_KEY', // TODO: Add to env
                LOOKUP: row.domain,
              },
            },
            description: 'Detect tech stack',
          });

          const technologies = tech.data?.Results?.[0]?.Result?.Paths?.[0]?.Technologies || [];
          if (technologies.length === 0) return '';

          // Filter to relevant categories (CRM, analytics, martech)
          const relevantTech = technologies
            .filter((t: any) =>
              ['CRM', 'Analytics', 'Marketing', 'Email', 'Sales'].some((cat) =>
                t.Categories?.includes(cat)
              )
            )
            .map((t: any) => t.Name);

          if (relevantTech.length === 0) return '';

          // Generate line about their tech stack
          const result = await ctx.tools.execute({
            id: 'tech_stack_line_writer',
            tool: 'deeplineagent',
            input: {
              prompt: `Write a short clause mentioning this company's tech stack. Technologies: ${relevantTech.join(', ')}. Rules: lowercase start, no period, under 80 chars, mention 1-2 tools naturally.`,
              jsonSchema: {
                type: 'object',
                properties: { tech_stack_line: { type: 'string' } },
              },
            },
            description: 'Generate tech stack line',
          });

          return result.data?.tech_stack_line || '';
        } catch (error) {
          return '';
        }
      })
      .run({ key: (row: any) => row.domain || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Detects tech stack on website (BuiltWith-style) and generates copy line.',
    billing: { maxCreditsPerRun: 100 },
  }
);
