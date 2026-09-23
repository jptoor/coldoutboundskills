/**
 * Deepline port of playbook-ai-specificity
 *
 * Output: specific_line
 * Signal: Transform generic copy into specific, fact-based copy
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'ai-specificity',
  async (
    ctx,
    input: {
      csv: string;
      generic_line_column: string; // Name of column with generic copy
    }
  ) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('specific_line', async (row: any) => {
        const genericLine = row[input.generic_line_column];
        if (!genericLine) return '';

        try {
          // Use deeplineagent to make line more specific
          const result = await ctx.tools.execute({
            id: 'specificity_enhancer',
            tool: 'deeplineagent',
            input: {
              prompt: `Rewrite this generic line to be more specific and fact-based. Generic: "${genericLine}". Available facts: ${JSON.stringify(row)}. Rules: keep under 90 chars, lowercase start, no period, no em dashes.`,
              jsonSchema: {
                type: 'object',
                properties: { specific_line: { type: 'string' } },
              },
            },
            description: 'Make copy more specific',
          });

          return result.data?.specific_line || genericLine;
        } catch (error) {
          return genericLine; // Fallback to generic
        }
      })
      .run({ key: (row: any) => row.email || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Transforms generic copy into specific, fact-based copy using AI.',
    billing: { maxCreditsPerRun: 100 },
  }
);
