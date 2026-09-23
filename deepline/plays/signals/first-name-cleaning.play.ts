/**
 * Deepline port of playbook-first-name-cleaning
 *
 * Output: clean_first_name
 * Signal: Strip middle names, initials, nicknames, titles
 * Abstain = empty string (but should always produce something if input exists).
 */

import { definePlay } from 'deepline';

function deterministicCleanFirstName(name: string): string {
  let clean = name.trim();

  // Remove titles (Mr., Mrs., Dr., etc.)
  clean = clean.replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+/i, '');

  // Split on whitespace
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';

  // Take first part only (drops middle names, initials)
  let firstName = parts[0];

  // Remove trailing punctuation (e.g., "John," → "John")
  firstName = firstName.replace(/[,.]$/, '');

  // Remove nicknames in quotes
  firstName = firstName.replace(/["']/g, '');

  return firstName;
}

export default definePlay(
  'first-name-cleaning',
  async (ctx, input: { csv: string }) => {
    const rows = await ctx.csv(input.csv).run();

    const enriched = await rows
      .withColumn('clean_first_name', async (row: any) => {
        if (!row.first_name) return '';

        return deterministicCleanFirstName(row.first_name);
      })
      .run({ key: (row: any) => row.email || String(Math.random()) });

    return { rows: enriched };
  },
  {
    description: 'Cleans first names: strips middle names, initials, nicknames, titles.',
    billing: { maxCreditsPerRun: 10 },
  }
);
