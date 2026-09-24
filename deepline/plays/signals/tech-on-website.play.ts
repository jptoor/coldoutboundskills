/**
 * Tech On Website Play
 * 
 * Port of: skills/playbooks/playbook-tech-on-website/clay-workflow.md
 * 
 * Graph:
 * 1. Trigger: domain + target_tech
 * 2. Tool: scrape-website
 * 3. CODE: blocked detection
 * 4. CODE: fingerprint match + platform grading
 * 5. CODE: verdict + confidence
 * 
 * NO AGENT PROMPT - All code nodes with fingerprint matching
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';

interface Input {
  domain: string;
  target_tech: string;
}

interface Output {
  tech_confirmed: boolean;
  tech_confidence: 'high' | 'unconfirmed' | 'negative' | 'blocked';
  tech_stack_verified: string[];
  tech_evidence: string;
  blocked_reason: string;
}

// Blocked HTTP statuses from clay-workflow.md L58
const BLOCKED_STATUSES = new Set([401, 403, 405, 429, 503]);

// FINGERPRINTS map from clay-workflow.md L87-101
// kind: platform -> needs header or oracle evidence to be CONFIRMED
// kind: embed -> dropped before model entirely
// kind: infra/analytics -> noise, never a verdict
const FINGERPRINTS: Record<string, {
  kind: 'platform' | 'app' | 'embed' | 'infra';
  html: string[];
  oracle?: string;
}> = {
  'Shopify': {
    kind: 'platform',
    html: ['cdn\\.shopify\\.com', '[a-z0-9-]+\\.myshopify\\.com'],
    oracle: '/products.json'
  },
  'WordPress': {
    kind: 'platform',
    html: ['/wp-content/', '/wp-includes/'],
    oracle: '/wp-json/'
  },
  'Klaviyo': {
    kind: 'app',
    html: ['static\\.klaviyo\\.com', 'klaviyo\\.js']
  },
  'Gorgias': {
    kind: 'app',
    html: ['config\\.gorgias\\.chat']
  }
  // Add more technologies as needed
  // NEVER add bare vendor domain like /klaviyo\.com/ - matches every page that links to vendor
};

export const techOnWebsitePlay = definePlay<Input, Output>({
  name: 'tech-on-website',
  version: '1.0.0',
  description: 'Technology detection via fingerprint matching with oracle verification',
  
  inputSchema: {
    type: 'object',
    required: ['domain', 'target_tech'],
    properties: {
      domain: { type: 'string' },
      target_tech: { type: 'string', description: 'Technology name to verify (e.g., "Shopify")' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      tech_confirmed: { type: 'boolean' },
      tech_confidence: { type: 'string', enum: ['high', 'unconfirmed', 'negative', 'blocked'] },
      tech_stack_verified: { type: 'array', items: { type: 'string' } },
      tech_evidence: { type: 'string' },
      blocked_reason: { type: 'string' }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { domain, target_tech } = ctx.input;
    
    // Node 2: Tool - scrape website (use scrape-website, NOT http-api-v2)
    const fetch = await ctx.tools.scrapeWebsite(`https://${domain}`);
    
    // Node 3: CODE - blocked detection (clay-workflow.md L58-77)
    const status = fetch.status || 0;
    const body = fetch.content || '';
    const err = fetch.error;
    
    let blocked = false;
    let blockedReason = '';
    
    if (err) {
      blocked = true;
      blockedReason = 'transport_error';
    } else if (BLOCKED_STATUSES.has(status)) {
      blocked = true;
      blockedReason = `http_${status}`;
    } else if (status >= 400) {
      blocked = true;
      blockedReason = `http_${status}`;
    } else if (body.length < 2000) {
      // Bot wall that returns HTTP 200 - catches challenge pages
      blocked = true;
      blockedReason = 'body_too_small';
    }
    
    if (blocked) {
      ctx.log(`Blocked: ${blockedReason}`);
      return {
        data: {
          tech_confirmed: false,
          tech_confidence: 'blocked',
          tech_stack_verified: [],
          tech_evidence: '',
          blocked_reason: blockedReason
        },
        metadata: { abstained: true, reason: blockedReason }
      };
    }
    
    // Node 4: CODE - fingerprint match + platform grading (clay-workflow.md L80-128)
    const detected: string[] = [];
    const htmlOnly: string[] = [];
    let evidence = '';
    
    // Check for oracle endpoints for platforms
    const oracleResults: Record<string, boolean> = {};
    for (const [name, fp] of Object.entries(FINGERPRINTS)) {
      if (fp.oracle) {
        try {
          const oracleCheck = await ctx.tools.http({
            url: `https://${domain}${fp.oracle}`,
            method: 'GET'
          });
          oracleResults[name] = oracleCheck.status === 200;
        } catch {
          oracleResults[name] = false;
        }
      }
    }
    
    for (const [name, fp] of Object.entries(FINGERPRINTS)) {
      // Check if any HTML pattern matches
      const htmlMatches = fp.html.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(body);
      });
      
      if (!htmlMatches) continue;
      
      if (fp.kind === 'embed') {
        // A Buy Button is not a storefront
        continue;
      }
      
      if (fp.kind === 'platform') {
        // HTML strings for a platform appear on every agency portfolio, every
        // app-review roundup and every B2B site with an embedded widget.
        // Require an oracle (or a header, if your fetch exposes them).
        if (oracleResults[name] === true) {
          detected.push(name);
          evidence = evidence || fp.oracle || '';
        } else {
          // -> "unconfirmed", NOT a negative
          htmlOnly.push(name);
        }
      } else {
        // app, infra, etc.
        detected.push(name);
      }
    }
    
    // Node 5: CODE - verdict (clay-workflow.md L130-158)
    const t = (target_tech || '').trim().toLowerCase();
    if (!t) {
      throw new Error('target_tech is required per row');
    }
    
    // EXACT element match. "Shopify Buy Button".includes("Shopify") is true,
    // and that is exactly how a B2B software company gets a storefront clause.
    const confirmed = detected.some(x => x.trim().toLowerCase() === t);
    const unconf = htmlOnly.some(x => x.trim().toLowerCase() === t);
    
    return {
      data: {
        tech_confirmed: confirmed,
        tech_confidence: confirmed ? 'high' : (unconf ? 'unconfirmed' : 'negative'),
        tech_stack_verified: detected,
        tech_evidence: evidence,
        blocked_reason: ''
      },
      metadata: {
        confidence: confirmed ? 'high' : 'low',
        abstained: !confirmed && !unconf
      }
    };
  }
});

export default techOnWebsitePlay;
