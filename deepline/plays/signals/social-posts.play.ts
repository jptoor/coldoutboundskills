/**
 * Social Posts Play
 * 
 * Port of: skills/playbooks/playbook-social-posts/clay-workflow.md
 * 
 * NO §6 IN SKILL.MD. Workflow L70-97 + SKILL L30-42 define skip filter verbatim.
 * 
 * Graph:
 * 1-5. Async scrape pattern (start, poll, read)
 * 6a-c. Skip filter agents (one per post, FAIL CLOSED)
 * 7. CODE: choose first non-skip
 * 8. (Optional) personalization line
 * 9. CODE: output contract
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  profile_url: string; // Company page or person
  want_line?: boolean; // Optional personalization line
}

interface Output {
  social_post_text: string;
  social_post_url: string;
  social_post_days_ago: number;
  social_post_author_type: string;
  social_post_line: string; // Only when want_line=true
}

// ============================================================================
// SKIP FILTER SPECIFICATION (VERBATIM from SKILL.md L30-42 + clay-workflow.md L70-79)
//
// SKILL.md L30-42:
// "3. The content skip filter is mandatory and fails closed.
//
// Skip `personal`, `political`, `bereavement`, and `charged` (religious or geopolitical 
// flashpoints).
//
// - A skip takes the NEXT post. It is not an abstain.
// - Error, bad parse, or a missing `skip` key all mean SKIP. Only a literal 
//   \"skip\": false keeps the post.
// - Never disable it to raise fill.
//
// Ordinary business content passes: memes, polls, job ads, volunteering, work 
// anniversaries, regulation commentary."
//
// clay-workflow.md L72-79:
// "One agent per post, same prompt, JSON out {\"skip\": true|false, \"category\": \"...\", 
// \"reason\": \"...\"}.
//
// Skip categories: `personal`, `political`, `bereavement`, `charged` (religious or 
// geopolitical flashpoints). Ordinary business content passes — memes, polls, job ads, 
// volunteering, work anniversaries, regulation commentary.
//
// Low reasoning effort is load-bearing. At default effort this filter hung past 180 
// seconds. finish_reason=length with empty content means retry with double the cap, never 
// an abstain."
// ============================================================================

const SKIP_FILTER_SYSTEM = `You decide whether a LinkedIn post should be skipped for use in a cold email.

Skip categories (SKIP if any apply):
- personal: personal life updates, family, health, vacation, hobbies unrelated to work
- political: political opinions, elections, government criticism
- bereavement: death, mourning, condolences
- charged: religious or geopolitical flashpoints that could offend

Ordinary business content PASSES:
- memes, polls, job ads, volunteering, work anniversaries, regulation commentary
- product launches, company news, professional advice, industry commentary

Return JSON only:
{"skip": true|false, "category": "personal|political|bereavement|charged|business", "reason": "..."}

FAIL CLOSED: If you are uncertain, skip it. Only return skip: false when you are confident the post is safe business content.`;

export const socialPostsPlay = definePlay<Input, Output>({
  name: 'social-posts',
  version: '1.0.0',
  description: 'Social posts with verbatim skip filter (SKILL L30-42 + workflow L72-79)',
  
  inputSchema: {
    type: 'object',
    required: ['profile_url'],
    properties: {
      profile_url: { type: 'string' },
      want_line: { type: 'boolean', default: false }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      social_post_text: { type: 'string' },
      social_post_url: { type: 'string' },
      social_post_days_ago: { type: 'number' },
      social_post_author_type: { type: 'string' },
      social_post_line: { type: 'string' }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { profile_url, want_line = false } = ctx.input;
    
    // Nodes 1-5: Async scrape pattern (start, poll, read)
    const scrapeJob = await ctx.tools.http({
      url: 'https://api.example.com/linkedin-posts/start',
      method: 'POST',
      body: {
        profile_url,
        maxPosts: 3,
        window_days: 90,
        reposts: false,
        quote_posts: true
      }
    });
    
    const jobId = scrapeJob.job_id;
    
    // Poll for completion
    let posts: any[] = [];
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const status = await ctx.tools.http({
        url: `https://api.example.com/linkedin-posts/status/${jobId}`,
        method: 'GET'
      });
      
      if (status.status === 'completed') {
        posts = status.data || [];
        break;
      } else if (status.status === 'failed') {
        return {
          data: { social_post_text: '', social_post_url: '', social_post_days_ago: 0, social_post_author_type: '', social_post_line: '' },
          metadata: { abstained: true, reason: 'scrape_failed' }
        };
      }
    }
    
    if (posts.length === 0) {
      return {
        data: { social_post_text: '', social_post_url: '', social_post_days_ago: 0, social_post_author_type: '', social_post_line: '' },
        metadata: { abstained: true, reason: 'no_posts' }
      };
    }
    
    // Nodes 6a-c: Skip filter (one per post, FAIL CLOSED per SKILL L35-37)
    let chosen: any = null;
    let skipped = 0;
    
    for (const post of posts) {
      const userMessage = `Post text:\n${post.text}`;
      
      let verdict: any;
      try {
        verdict = await ctx.tools.ai<{skip: boolean; category: string; reason: string}>({
          systemPrompt: SKIP_FILTER_SYSTEM,
          userPrompt: userMessage,
          jsonMode: true,
          jsonSchema: {
            type: 'object',
            required: ['skip', 'category', 'reason'],
            properties: {
              skip: { type: 'boolean' },
              category: { type: 'string' },
              reason: { type: 'string' }
            }
          },
          maxTokens: 600,
          // reasoning_effort: "low" (load-bearing per workflow L78)
          retries: 2
        });
      } catch (e) {
        // FAIL CLOSED: error means SKIP (SKILL L35-37)
        verdict = { skip: true, category: 'error', reason: 'Filter error' };
      }
      
      // Node 7: FAIL CLOSED (workflow L90-97)
      // "an error, a bad parse, or a missing skip key all mean SKIP.
      // Only a literal False keeps the post."
      if (typeof verdict.skip !== 'boolean' || verdict.skip !== false) {
        skipped++;
        continue; // Skip takes NEXT post (SKILL L34)
      }
      
      chosen = post;
      break;
    }
    
    // Node 9: Output contract (workflow L102-120)
    if (!chosen) {
      // "Blank, never invented. No guess, no \"N/A\", and NO sequencer-side fallback value"
      return {
        data: {
          social_post_text: '',
          social_post_url: '',
          social_post_days_ago: 0,
          social_post_author_type: '',
          social_post_line: ''
        },
        metadata: { abstained: true, reason: 'all_skipped' }
      };
    }
    
    const output: Output = {
      social_post_text: chosen.text, // "THE PRODUCT" per workflow L113
      social_post_url: chosen.url,
      social_post_days_ago: chosen.days_ago || 0,
      social_post_author_type: chosen.author_type || '',
      social_post_line: ''
    };
    
    // Node 8: Optional personalization line
    if (want_line && chosen.text) {
      // This would call another agent for the line
      // Stubbed for now as it's optional
    }
    
    return {
      data: output,
      metadata: {
        confidence: 'high',
        abstained: false
      }
    };
  }
});

export default socialPostsPlay;
