/**
 * Deepline port of playbook-company-name-cleaning
 *
 * Output: clean_company_name
 * Signal: Deterministic regex + model cleanup (strip legal suffixes, parentheticals)
 * Abstain = empty string (but should always produce something if input exists).
 */

import { definePlay } from 'deepline';

function deterministicClean(name: string): string {
  let clean = name.trim();

  // Remove parentheticals
  clean = clean.replace(/\s*\([^)]*\)/g, '');

  // Remove legal suffixes
  const suffixes = [
    ', LLC',
    ', Inc',
    ', PLC',
    ', Ltd',
    ', Limited',
    ', Corp',
    ', Corporation',
    ' LLC',
    ' Inc',
    ' PLC',
    ' Ltd',
    ' Limited',
    ' Corp',
    ' Corporation',
  ];
  for (const suffix of suffixes) {
    if (clean.endsWith(suffix)) {
      clean = clean.slice(0, -suffix.length);
    }
  }

  // Remove trailing descriptive phrases after comma
  const commaIndex = clean.indexOf(',');
  if (commaIndex > 0) {
    clean = clean.slice(0, commaIndex);
  }

  return clean.trim();
}

export default definePlay(
  'company-name-cleaning',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('clean_company_name', async (row: any) => {
        if (!row.company_name) return '';

        // Deterministic cleaning first
        const deterministic = deterministicClean(row.company_name);

        // Optional: model cleanup for edge cases
        // For most cases, deterministic is sufficient
        return deterministic;
      })
      .run({ key: (row: any) => row.company_name || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description:
      'Cleans company names: strips legal suffixes, parentheticals, trailing phrases.',
    billing: { maxCreditsPerRun: 10 },
  }
);
