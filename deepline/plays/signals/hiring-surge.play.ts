/**
 * Deepline port of playbook-hiring-surge
 *
 * Original: skills/playbooks/playbook-hiring-surge/SKILL.md (inferred - not in provided files)
 * Output: hiring_line
 *
 * Signal: Company is hiring aggressively (headcount growth + active job postings)
 * Source chain: Job posting aggregator → headcount growth trend → model line writer
 *
 * Abstain = empty string.
 */

import { definePlay } from 'deepline';
import type { DeeplinePlayRuntimeContext } from 'deepline';

type HiringRow = {
  domain: string;
  company_name?: string;
  hiring_line: string;
  open_positions_count?: number;
  headcount_growth_6mo?: number;
  hiring_confidence: 'high' | 'low';
};

async function generateHiringLine(
  ctx: DeeplinePlayRuntimeContext,
  facts: {
    company_name: string;
    open_positions_count: number;
    headcount_growth_6mo?: number;
    key_roles?: string[];
  }
): Promise<{ hiring_line: string; confidence: string }> {
  const prompt = `You write one short clause about a company's hiring activity for a cold email.

You will be given verified facts about hiring. Your only job is wording. Do not add facts.

Return JSON only, exactly these keys:
{"hiring_line": "...", "confidence": "high|low"}

Rules:
- The clause must read grammatically inside this sentence: "Saw <hiring_line>."
- Start with a lowercase letter. No trailing period. No em dashes. No quote marks.
- 5th-grade reading level. Under 80 characters.
- Use the open positions count exactly. Say "hiring for X roles" or similar.
- If headcount growth is given and meaningful (>10%), mention rapid growth.
- If key roles are given, name 1-2 of them naturally.
- Never name specific numbers for headcount growth unless very clear.
- Never say "recently" or name a month/date.

Examples:
Input: {"company_name":"Attio","open_positions_count":23,"headcount_growth_6mo":45,"key_roles":["Sales Engineer","SDR"]}
Output: {"hiring_line":"you're hiring for 23 roles including Sales Engineers","confidence":"high"}
Input: {"company_name":"Northwind","open_positions_count":5,"key_roles":["VP Operations"]}
Output: {"hiring_line":"you posted 5 open roles including a VP Operations","confidence":"high"}
Input: {"company_name":"Acme","open_positions_count":0}
Output: {"hiring_line":"","confidence":"low"}

PER-ROW DATA
${JSON.stringify(facts)}`;

  try {
    const result = await ctx.tools.execute({
      id: 'hiring_line_writer',
      tool: 'deeplineagent',
      input: {
        prompt,
        jsonSchema: {
          type: 'object',
          properties: {
            hiring_line: { type: 'string' },
            confidence: { type: 'string', enum: ['high', 'low'] },
          },
          required: ['hiring_line', 'confidence'],
        },
        maxCompletionTokens: 2000,
      },
      description: 'Generate hiring surge copy-ready clause',
    });

    return result.data || { hiring_line: '', confidence: 'low' };
  } catch (error) {
    return { hiring_line: '', confidence: 'low' };
  }
}

export default definePlay(
  'hiring-surge',
  async (
    ctx: DeeplinePlayRuntimeContext,
    input: { csv: string }
  ): Promise<{ rows: unknown }> => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('hiring_line', async (row: any) => '')
      .withColumn('open_positions_count', async (row: any) => 0)
      .withColumn('hiring_confidence', async (row: any) => 'low')
      .withColumn('_hiring_enriched', async (row: any) => {
        if (!row.domain) {
          return {
            hiring_line: '',
            open_positions_count: 0,
            hiring_confidence: 'low',
          };
        }

        const domain = String(row.domain).toLowerCase().trim();

        // TODO: Use actual Deepline job posting aggregator
        // Expected tools: crustdata job postings, or similar
        let jobData: any = null;
        try {
          const jobLookup = await ctx.tools.execute({
            id: 'job_postings_lookup',
            tool: 'crustdata_companydb_search', // or job postings API
            input: { domain },
            description: `Look up active job postings for ${domain}`,
          });

          jobData = jobLookup.data;
        } catch (error) {
          return {
            hiring_line: '',
            open_positions_count: 0,
            hiring_confidence: 'low',
          };
        }

        if (!jobData || !jobData.open_positions) {
          return {
            hiring_line: '',
            open_positions_count: 0,
            hiring_confidence: 'low',
          };
        }

        const openPositionsCount = Number(jobData.open_positions_count || 0);
        if (openPositionsCount === 0) {
          // No hiring activity
          return {
            hiring_line: '',
            open_positions_count: 0,
            hiring_confidence: 'low',
          };
        }

        // Extract key roles (e.g., top 2-3 titles)
        const keyRoles = Array.isArray(jobData.key_roles)
          ? jobData.key_roles.slice(0, 3)
          : [];

        const facts = {
          company_name: row.company_name || jobData.name || domain,
          open_positions_count: openPositionsCount,
          headcount_growth_6mo: jobData.headcount_growth_6mo,
          key_roles: keyRoles,
        };

        const result = await generateHiringLine(ctx, facts);

        return {
          hiring_line: result.hiring_line || '',
          open_positions_count: openPositionsCount,
          hiring_confidence: result.confidence || 'low',
        };
      })
      .withColumn('hiring_line', async (row: any) => row._hiring_enriched?.hiring_line || '')
      .withColumn('open_positions_count', async (row: any) => row._hiring_enriched?.open_positions_count || 0)
      .withColumn('hiring_confidence', async (row: any) => row._hiring_enriched?.hiring_confidence || 'low')
      .run({ key: (row: any) => row.domain || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description:
      'Produces a copy-ready clause about a company hiring aggressively. Signal: active job postings + headcount growth. Output: hiring_line = "you\'re hiring for 23 roles including Sales Engineers". Abstain = empty string.',
    billing: { maxCreditsPerRun: 100 },
  }
);
