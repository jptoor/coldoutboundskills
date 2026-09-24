/**
 * Deepline port of playbook-creative-ideas
 *
 * Output: creative_angles (array of campaign ideas)
 * Signal: Multi-angle campaign brainstorming from ICP + value prop
 * Abstain = empty array.
 */

import { definePlay } from 'deepline';

export default definePlay(
  'creative-ideas',
  async (
    ctx,
    input: {
      icp_description: string;
      value_proposition: string;
      num_angles?: number; // Default: 10
    }
  ) => {
    const numAngles = input.num_angles || 10;

    try {
      // Generate creative campaign angles
      const result = await ctx.tools.execute({
        id: 'creative_brainstorm',
        tool: 'deeplineagent',
        input: {
          prompt: `Generate ${numAngles} creative cold email campaign angles.

ICP: ${input.icp_description}
Value Prop: ${input.value_proposition}

Return JSON with an array of campaign ideas. Each idea should have:
- angle: short name (2-4 words)
- hook: opening line strategy
- value_prop_twist: how to position the value prop for this angle
- signal: what triggers qualification (e.g., "raised Series A", "hiring 5+ engineers")

Return JSON: {"creative_angles": [...]}`,
          jsonSchema: {
            type: 'object',
            properties: {
              creative_angles: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    angle: { type: 'string' },
                    hook: { type: 'string' },
                    value_prop_twist: { type: 'string' },
                    signal: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        description: 'Brainstorm creative campaign angles',
      });

      const angles = result.data?.creative_angles || [];

      const rows = await ctx.dataset('creative_angles', angles).run({
        key: (_row: any, index: number) => `angle_${index}`,
      });

      return { rows };
    } catch (error) {
      return { rows: await ctx.dataset('creative_angles', []).run() };
    }
  },
  {
    description: 'Generates creative campaign angles from ICP + value proposition.',
    billing: { maxCreditsPerRun: 50 },
  }
);
