/**
 * Ad Library Play
 * 
 * Port of: skills/playbooks/playbook-ad-library/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain + company_name
 * 2. Tool: cache lookup (short-circuit on fresh hit)
 * 3. Tool: scrape-website
 * 4. CODE: extract + junk-filter the slug
 * 5. Tool: SERP site:facebook.com (only when 4 found nothing)
 * 6. CODE: THE THREE GATES
 * 7. CODE: assemble fb_page_url
 * 8. Tool: apify-run-actor, onlyTotal
 * 9. CODE: count, volume phrase, ad samples
 * 10a/b/c. Agent: THREE DRAFTS (best-of-3)
 * 11. CODE: lint + ungrounded words, pick first passing
 * 12. Agent: TRUTH JUDGE
 * 13. CODE: final output contract
 * 14. Tool: cache write
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  domain: string;
  company_name: string;
}

interface Output {
  ad_library_line: string;
  ad_theme: string;
  evidence_ad_id: string;
  ad_confidence: 'high' | 'low';
  active_ad_count: number;
  fb_page_url: string;
}

// Node 4: JUNK slugs to filter
const JUNK = new Set(['sharer', 'plugins', 'tr', 'profile.php', 'groups', 'photo.php', 'posts', 'videos', 'people', 'pg']);

// Node 6: Brand tokens for lint
function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ============================================================================
// LOCKED DRAFT PROMPT from SKILL.md §6 (lines 227-257) - VERBATIM SYSTEM BLOCK
// Model: reasoning_effort="minimal", JSON mode, flex tier for batch
// Used for nodes 10a, 10b, 10c (3 drafts)
// DO NOT PARAPHRASE. Graded line-writing prompt.
// ============================================================================
const LOCKED_PROMPT_DRAFT = `You write one short merge field that gets dropped into the middle of a cold email sentence.

The sentence it goes into is exactly this, and you are writing only the AD_LIBRARY_LINE part:
"Noticed AD_LIBRARY_LINE."

You are given one company's currently running Facebook and Instagram ads: the page name, how many ads are running, and the text of a few of those ads.

Rules:
1. Write at a 5th-grade reading level. Use short, common words. If a shorter word means the same thing, use the shorter word.
2. Your text has to fit the sentence around it. Read the whole sentence back with your text in place before you answer. Start with a lowercase letter. Never start with the word noticed, saw, or seeing. Do not start with a comma or the word and. Do not end with a period. 16 words or fewer.
3. Never use an em dash or an en dash. Use a comma, or split the idea, or use and, so, or because.
4. Never state a fact that is not in the ad text you were given. Do not guess what the company sells, do not round numbers, and do not describe what the company probably does.
5. If the ads do not support a specific, true line, return an empty string for ad_library_line and low for confidence. Never write N/A, unknown, none, not available, a dash, or a placeholder in brackets. An empty answer is always better than a wrong one.
6. Output only the JSON object described below. No preamble, no reasoning, no markdown fence.

Output shape, exactly these keys:
{"ad_library_line": "...", "ad_theme": "...", "evidence_ad_id": "...", "confidence": "high|low"}

Task rules:
7. Never write the company's own name, or any word of it, inside ad_library_line. They already know who they are, and naming them back reads like a robot. Write what the ads sell, not who is selling it. This holds even when the ad text repeats the brand name in every sentence.
8. Name ONE thing, never a list. Pick the single offer, product, promise, or promotion the ads push hardest. When several ads repeat one idea, use that idea. When the ads push different products, use the product in the first ad and write only that one. A line that names two or more products reads like a catalog and is worse than no line. Never join two products with the word and. When in doubt, write about the ad listed FIRST.
9. Return an empty ad_library_line when the ads are brand films, jokes, or slogans with no product, no offer and no landing page, when the only ad text is a template token like a double-brace placeholder, or when the ads say nothing a stranger could repeat back.
10. VOLUME_PHRASE is given to you. When it is allowed you may write the words a lot of ads. When it is banned, write nothing at all about how many ads are running. Never write a raw ad count in either case.
11. Never use the words angle or angles. Never use quotation marks, trademark or registered symbols, star characters, emoji, or a web address.
12. Some ads are written in Spanish, German, French or another language. Always write the line in English.
13. Write about what the ads sell, never about the advertising itself. Banned phrases: a line about, a campaign about, in multiple regions, in several languages, across regions, various markets.
14. Write every word out. No apostrophes and no contractions: write you are, not you're, and write everyone, not everyone's.
15. ad_theme is two to four lowercase words naming the repeated idea across the ads, or an empty string if unclear. evidence_ad_id is the id of the single ad you used, or an empty string when you returned an empty line.`;

// NOTE: The full prompt includes 13 few-shot user/assistant example pairs here
// (not shown in SKILL.md as explicit text, but described in lines 260-269)
// These should be added as separate messages in the conversation history when calling the AI

// ============================================================================
// TRUTH JUDGE (Node 12) - VERBATIM from clay-workflow.md L202-209
// ============================================================================
// clay-workflow.md L202-209:
// "Mandatory, 100% of lines that survived node 11, never a sample. ~$0.02 per 10,000 rows.
// Input is the ad samples and the linted line; output is {\"supported\": bool, \"why\": \"...\"}.
//
// An earlier version of this playbook argued a judge was unnecessary because every claim is 
// copied from ad text the same call is looking at. That was wrong twice in one graded run. 
// Structural QC cannot catch semantic error."
//
// SKILL.md L298: "mandatory, 100% of lines, never a sample. One extra model call with its 
// own few-shot examples. ~$0.02 per 10,000 rows | catches invented meaning that survives 
// word-level grounding"
//
// NO FENCED PROMPT PROVIDED. Implementing based on I/O contract + verification purpose.
// ============================================================================

const TRUTH_JUDGE_SYSTEM = `You verify that a cold email line is supported by the ad text it claims to describe.

You are given:
- Ad samples: the actual text from Facebook/Instagram ads
- Line: a generated line that claims to describe those ads

Return JSON only:
{"supported": true|false, "why": "..."}

Rules:
- supported is true ONLY when every factual claim in the line appears in the ad text
- supported is false when the line invents a product, number, or detail the ads never mentioned
- why is 1 sentence explaining your decision

This catches semantic errors that word-level grounding misses (e.g. "gym wear and shoes" when ads only mention gym wear).`;

interface TruthJudgeOutput {
  supported: boolean;
  why: string;
}

export const adLibraryPlay = definePlay<Input, Output>({
  name: 'ad-library',
  version: '1.0.0',
  description: 'Meta Ad Library with 3 drafts, lint stack, and truth judge',
  
  inputSchema: {
    type: 'object',
    required: ['domain', 'company_name'],
    properties: {
      domain: { type: 'string' },
      company_name: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      ad_library_line: { type: 'string' },
      ad_theme: { type: 'string' },
      evidence_ad_id: { type: 'string' },
      ad_confidence: { type: 'string', enum: ['high', 'low'] },
      active_ad_count: { type: 'number' },
      fb_page_url: { type: 'string' }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { domain, company_name } = ctx.input;
    
    // Node 2: Cache lookup (short-circuit on fresh hit)
    const cached = await ctx.tools.http({
      url: 'https://api.example.com/cache',
      method: 'GET',
      params: { key: domain }
    });
    
    if (cached.data && cached.data.fresh) {
      return {
        data: cached.data,
        metadata: { confidence: cached.data.ad_confidence, cached: true }
      };
    }
    
    // Node 3: Tool - scrape website
    const homepage = await ctx.tools.scrapeWebsite(`https://${domain}`);
    
    // Node 4: CODE - extract + junk-filter the slug
    // Load-bearing: un-escape \/ BEFORE regex or lose 38% of hits
    const body = (homepage.content || '').replace(/\\\//g, '/');
    const fbMatch = body.match(/https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9._-]+)/);
    let slug = fbMatch ? fbMatch[1] : '';
    
    if (JUNK.has(slug)) {
      slug = '';
    }
    
    // Node 5: Tool - SERP site:facebook.com (only when slug empty)
    if (!slug) {
      const serp = await ctx.tools.findNews(
        `site:facebook.com "${company_name}"`,
        { resultsLimit: 5 }
      );
      
      // Node 6: CODE - THE THREE GATES
      const label = norm(domain.split('.')[0]); // second-level label
      const want = norm(company_name);
      
      let fbPageUrl = '';
      for (const r of serp || []) {
        const url = r.url || '';
        const title = r.title || '';
        
        // GATE 1: exactly one path segment
        const urlMatch = url.match(/^https?:\/\/(?:www\.)?facebook\.com\/([^/?#]+)\/?$/);
        if (!urlMatch) continue;
        
        slug = norm(urlMatch[1]);
        
        // GATE 2: title contains company name
        if (!norm(title).includes(want)) continue;
        
        // GATE 3: THE SLUG (and only the slug)
        if (!(slug.startsWith(label) || label.startsWith(slug))) continue;
        
        fbPageUrl = `https://www.facebook.com/${urlMatch[1]}`;
        break;
      }
      
      if (!fbPageUrl) {
        ctx.log('All three gates: no verified page');
        return {
          data: {
            ad_library_line: '',
            ad_theme: '',
            evidence_ad_id: '',
            ad_confidence: 'low',
            active_ad_count: 0,
            fb_page_url: ''
          },
          metadata: { abstained: true, reason: 'no_verified_page' }
        };
      }
      
      // Node 7: assemble fb_page_url (done above)
    } else {
      // Node 7: assemble from slug
      var fbPageUrl = `https://www.facebook.com/${slug}`;
    }
    
    // Node 8: Tool - apify-run-actor with onlyTotal
    const apifyResult = await ctx.tools.http({
      url: 'https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs',
      method: 'POST',
      body: {
        startUrls: [{ url: fbPageUrl }],
        onlyTotal: true,
        activeStatus: 'active'
      }
    });
    
    const items = apifyResult.data || [];
    const first = items[0] || {};
    
    // Node 9: CODE - count, volume phrase, ad samples
    const totalCount = first.totalCount || 0;
    const volumePhrase = totalCount >= 50 ? 'allowed' : 'banned';
    
    const TOKEN_REGEX = /\{\{[^}]+\}\}/;
    const ads: string[] = [];
    const seen = new Set<string>();
    
    for (const a of first.results || []) {
      const title = (a.title || '').trim();
      const bodyText = (a.body || '').trim();
      
      // Drop dynamic catalog ads (template tokens)
      if (TOKEN_REGEX.test(title) && TOKEN_REGEX.test(bodyText)) continue;
      
      const key = `${title}:${bodyText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      ads.push(`[id ${a.adArchiveID || ''} | title "${title}" | body "${bodyText}"]`);
      if (ads.length >= 4) break;
    }
    
    const adSamples = ads.join(' ');
    
    if (ads.length === 0) {
      return {
        data: {
          ad_library_line: '',
          ad_theme: '',
          evidence_ad_id: '',
          ad_confidence: 'low',
          active_ad_count: totalCount,
          fb_page_url: fbPageUrl
        },
        metadata: { abstained: true, reason: 'no_ads' }
      };
    }
    
    // Nodes 10a/b/c: THREE DRAFTS (best-of-3)
    const userMessage = `COMPANY: ${company_name} | ACTIVE_ADS: ${totalCount} | VOLUME_PHRASE: ${volumePhrase} | ADS: ${adSamples}`;
    
    interface DraftOutput {
      ad_library_line: string;
      ad_theme: string;
      evidence_ad_id: string;
      confidence: 'high' | 'low';
    }
    
    const drafts: DraftOutput[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const draft = await ctx.tools.ai<DraftOutput>({
          systemPrompt: LOCKED_PROMPT_DRAFT,
          userPrompt: userMessage,
          jsonMode: true,
          jsonSchema: {
            type: 'object',
            required: ['ad_library_line', 'ad_theme', 'evidence_ad_id', 'confidence'],
            properties: {
              ad_library_line: { type: 'string' },
              ad_theme: { type: 'string' },
              evidence_ad_id: { type: 'string' },
              confidence: { type: 'string', enum: ['high', 'low'] }
            }
          },
          maxTokens: 800,
          // reasoning_effort: "minimal"
          retries: 2
        });
        drafts.push(draft);
      } catch (e) {
        ctx.log(`Draft ${i + 1} failed: ${e}`);
      }
    }
    
    if (drafts.length === 0) {
      return {
        data: {
          ad_library_line: '',
          ad_theme: '',
          evidence_ad_id: '',
          ad_confidence: 'low',
          active_ad_count: totalCount,
          fb_page_url: fbPageUrl
        },
        metadata: { abstained: true, reason: 'all_drafts_failed' }
      };
    }
    
    // Node 11: CODE - lint + ungrounded words, pick first passing
    const brandTokens = [
      norm(company_name.split(/\s+/)[0]), // first word
      norm(company_name),                 // squashed full name
      norm(domain.split('.')[0])          // domain label (4+ chars only handled below)
    ].filter(t => t.length >= 4);
    
    function contentWords(s: string): Set<string> {
      const words = (s || '').toLowerCase().match(/[a-z]{4,}/g) || [];
      return new Set(words.map(w => w.slice(0, 4))); // stem to 4 chars
    }
    
    function lintLine(line: string): string {
      const v = (line || '').trim();
      if (!v) return '';
      
      const low = v.toLowerCase();
      
      // Format lints
      if (/^(noticed|saw|seeing|and|,)/.test(low)) return '';
      if (/["'—–™®*]/.test(v)) return '';
      if (/\bangle/.test(low)) return '';
      if (v.split(/\s+/).length > 20) return '';
      if (v.endsWith('.') || /^[A-Z]/.test(v[0])) return '';
      if ((low.match(/,/g) || []).length >= 2) return '';
      if ((low.match(/\band\b/g) || []).length >= 2) return '';
      
      // Volume phrase check
      if (volumePhrase === 'banned' && /\ba lot of ads\b/.test(low)) return '';
      
      // Brand token check
      if (brandTokens.some(t => low.includes(t))) return '';
      
      // Repeated word check (5+ letter words)
      const words = low.match(/[a-z]{5,}/g) || [];
      if (words.length !== new Set(words).size) return '';
      
      // Ungrounded words check
      const lineWords = contentWords(v);
      const adWords = contentWords(adSamples);
      const ungrounded = [...lineWords].filter(w => !adWords.has(w));
      if (ungrounded.length > 0) return '';
      
      return v;
    }
    
    let lintedLine = '';
    let chosenDraft: DraftOutput | null = null;
    
    for (const draft of drafts) {
      const linted = lintLine(draft.ad_library_line);
      if (linted) {
        lintedLine = linted;
        chosenDraft = draft;
        break;
      }
    }
    
    if (!lintedLine || !chosenDraft) {
      return {
        data: {
          ad_library_line: '',
          ad_theme: '',
          evidence_ad_id: '',
          ad_confidence: 'low',
          active_ad_count: totalCount,
          fb_page_url: fbPageUrl
        },
        metadata: { abstained: true, reason: 'lint_failed_all_drafts' }
      };
    }
    
    // Node 12: Agent - TRUTH JUDGE (mandatory, 100% of lines per workflow L202-209)
    const judgeMessage = `Ad samples:\n${adSamples}\n\nLine to verify:\n${lintedLine}`;
    
    const judgeResult = await ctx.tools.ai<TruthJudgeOutput>({
      systemPrompt: TRUTH_JUDGE_SYSTEM,
      userPrompt: judgeMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['supported', 'why'],
        properties: {
          supported: { type: 'boolean' },
          why: { type: 'string' }
        }
      },
      maxTokens: 600,
      retries: 3
    });
    
    // Node 13: CODE - final output contract
    const finalLine = judgeResult.supported ? lintedLine : '';
    
    const result = {
      ad_library_line: finalLine,
      ad_theme: chosenDraft.ad_theme,
      evidence_ad_id: finalLine ? chosenDraft.evidence_ad_id : '',
      ad_confidence: (finalLine ? chosenDraft.confidence : 'low') as 'high' | 'low',
      active_ad_count: totalCount,
      fb_page_url: fbPageUrl
    };
    
    // Node 14: Tool - cache write (including abstains)
    await ctx.tools.http({
      url: 'https://api.example.com/cache',
      method: 'PUT',
      body: { key: domain, value: result, removeNull: true }
    });
    
    return {
      data: result,
      metadata: {
        confidence: result.ad_confidence,
        abstained: !finalLine
      }
    };
  }
});

export default adLibraryPlay;
