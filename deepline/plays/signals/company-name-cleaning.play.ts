/**
 * Company Name Cleaning Play
 * 
 * Port of: skills/playbooks/playbook-company-name-cleaning/clay-workflow.md
 * 
 * Cleans company names to spoken form for cold email greetings.
 * 
 * Node 2: Placeholder guard on input
 * Node 3: Agent cleans the name  
 * Node 4: Placeholder guard on output + invented-word guard
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';
import { normalize, isPlaceholder } from '../../lib/utils';

interface Input {
  company_name: string;
  domain?: string;
}

interface Output {
  company_clean: string;
  changed: boolean;
  confidence: 'high' | 'low';
}

// Placeholder set - from SKILL.md §7
const BLOCK = new Set([
  'n/a', 'none', 'unknown', 'test', 'tbd', 'null', 'confidential',
  'private', 'self employed', 'selfemployed', 'self-employed',
  'retired', 'freelance', 'consultant', 'independent'
]);

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 214-290) - VERBATIM, graded at 95/100 (mini) / 98/100 (nano default)
// Model: gpt-4o-mini in Clay, gpt-5-nano with default effort outside Clay
// Cache: 1,716 tokens, ~1,300 cached after first call
// DO NOT PARAPHRASE. Model was graded on this exact text with 22 examples.
// ============================================================================
const LOCKED_PROMPT_COMPANY_CLEANING = `You clean company names so they sound like a person saying the name out loud in an email.

You will be given one raw company name string from a CRM, plus the company's website domain when we have it. Return the short, human, spoken form of that company's name.

Return JSON only, exactly these keys:
{"company_clean": "...", "changed": true, "confidence": "high"}

Rules:
1. Drop legal suffixes and the punctuation attached to them: Inc, Inc., LLC, L.L.C., Ltd, Limited, Corp, Corporation, Co, Co., Company (only when it reads as a legal suffix), PLC, LLP, PC, PA, GmbH, AG, BV, NV, SA, SAS, SARL, SRL, SpA, Pty, Pty Ltd, AB, A/S, Oy, KK, Sdn Bhd, Private Limited.
2. Drop trademark and copyright marks: (R), (TM), (C), and their symbol forms.
3. Drop taglines, service lists, and descriptors that follow a separator such as a pipe, a dash with spaces around it, a colon, or a comma, when what follows describes the business instead of naming it.
4. Drop parenthetical descriptors such as (Startup), (formerly X), (a Division of X), (Private).
5. Drop a parenthetical acronym or short form of the same name.
6. Keep parentheses, brackets, and the characters inside them when they are part of the name itself rather than a comment on it. A number in parentheses at the front of a name is part of the name and stays, brackets included.
7. When the string has a legal entity plus a trading name (dba, d/b/a, doing business as), keep the trading name only.
8. Drop a trailing city, region, or country qualifier that was appended to the brand.
9. When the string repeats the name in a second language or script, keep the English form only.
10. Casing, and read this rule twice. Protect initialisms: a token of 2 to 6 letters that is not an ordinary English word stays exactly as written, so ARI stays ARI, ATC stays ATC, AMTC stays AMTC. That protection covers the initialism only. Ordinary words shouted in capitals get Title Case even when they sit next to a protected initialism, so TECH becomes Tech, GROUP becomes Group, SERVICES becomes Services, SOLUTIONS becomes Solutions, GLOBAL becomes Global, USA stays USA. An all-lowercase name made of ordinary words becomes Title Case.
11. Keep deliberate brand casing exactly as written: adGreetz, iRobot, eBay, 4medica, AmhFOLIO.
12. Keep an ampersand if the brand uses one. Keep numbers and dots that are part of the brand. Drop a .com only when the brand is clearly not named after its web address.
13. Never invent, translate, expand, or abbreviate a name. Every word you output must already appear in the input. If you would have to add a word, do not add it.
14. Never add a trailing period, comma, or quotation marks.
15. Keep it under 40 characters when the input allows that without cutting the brand.
16. No em dashes anywhere in the output.
17. If the input is empty, is a placeholder such as N/A, None, Unknown, or Test, or is not a company name at all, return "" for company_clean.
18. "changed" is true when company_clean differs from the input, and false when it is identical.
19. "confidence" is "low" when you had to guess which part of the string was the brand, and "high" otherwise.

The output must read correctly inside this sentence, with no edits: "Noticed COMPANY_CLEAN is hiring."

Work fast. This is a formatting job, not a research job. Do not look anything up and do not reason at length.

Examples:
Input: name="AAA Rent A Van, dba State Van Rental" domain="statevanrental.com"
Output: {"company_clean": "State Van Rental", "changed": true, "confidence": "high"}
Input: name="A Advanced Services | Septic and Construction" domain="aadvancedservices.com"
Output: {"company_clean": "A Advanced Services", "changed": true, "confidence": "high"}
Input: name="ADP" domain="adp.com"
Output: {"company_clean": "ADP", "changed": false, "confidence": "high"}
Input: name="Aquaserv, Inc." domain="aquaserv.com"
Output: {"company_clean": "Aquaserv", "changed": true, "confidence": "high"}
Input: name="ARI" domain=""
Output: {"company_clean": "ARI", "changed": false, "confidence": "high"}
Input: name="Absolute Robot (ARI)" domain="absoluterobot.com"
Output: {"company_clean": "Absolute Robot", "changed": true, "confidence": "high"}
Input: name="4IRE - Blockchain development & Consulting Company" domain="4irelabs.com"
Output: {"company_clean": "4IRE", "changed": true, "confidence": "high"}
Input: name="Ace Hardware Home Services - Southwest Ohio" domain="acehardware.com"
Output: {"company_clean": "Ace Hardware Home Services", "changed": true, "confidence": "high"}
Input: name="ACCRO | text in another language" domain="accro.fr"
Output: {"company_clean": "ACCRO", "changed": true, "confidence": "high"}
Input: name="American Pop Corn Company (JOLLY TIME Pop Corn)" domain="jollytime.com"
Output: {"company_clean": "American Pop Corn", "changed": true, "confidence": "low"}
Input: name="99pro media gmbh" domain="99pro-media.de"
Output: {"company_clean": "99pro media", "changed": true, "confidence": "high"}
Input: name="Aero Rubber Company(R)" domain="aerorubber.com"
Output: {"company_clean": "Aero Rubber", "changed": true, "confidence": "high"}
Input: name="Abc Mechanical Llc" domain="abcmechanical.com"
Output: {"company_clean": "Abc Mechanical", "changed": true, "confidence": "high"}
Input: name="ABC MECHANICAL SERVICES" domain="abcmechanical.com"
Output: {"company_clean": "ABC Mechanical Services", "changed": true, "confidence": "high"}
Input: name="AMTC TECH GROUP LLC" domain="amtctech.com"
Output: {"company_clean": "AMTC Tech Group", "changed": true, "confidence": "high"}
Input: name="(319) Auto Body" domain="319autobody.com"
Output: {"company_clean": "(319) Auto Body", "changed": false, "confidence": "high"}
Input: name="alamo environmental" domain="alamoenv.com"
Output: {"company_clean": "Alamo Environmental", "changed": true, "confidence": "high"}
Input: name="Alex Umo-Etuk - State Farm Insurance Agent" domain=""
Output: {"company_clean": "State Farm", "changed": true, "confidence": "low"}
Input: name="Apogee Compliance LLC" domain="apogeecompliance.com"
Output: {"company_clean": "Apogee Compliance", "changed": true, "confidence": "high"}
Input: name="3MD Relocation Services (Commercial Moving, Storage, Installation)" domain="3mdinc.com"
Output: {"company_clean": "3MD Relocation Services", "changed": true, "confidence": "high"}
Input: name="N/A" domain=""
Output: {"company_clean": "", "changed": true, "confidence": "high"}
Input: name="America's CAR-MART, Inc." domain="car-mart.com"
Output: {"company_clean": "America's CAR-MART", "changed": true, "confidence": "high"}

Company to clean:`;

export const companyNameCleaningPlay = definePlay<Input, Output>({
  name: 'company-name-cleaning',
  version: '1.0.0',
  description: 'Cleans company names to spoken form with 22-example graded prompt',
  
  inputSchema: {
    type: 'object',
    required: ['company_name'],
    properties: {
      company_name: { type: 'string' },
      domain: { type: 'string' }
    }
  },
  
  outputSchema: {
    type: 'object',
    properties: {
      company_clean: { type: 'string' },
      changed: { type: 'boolean' },
      confidence: { type: 'string', enum: ['high', 'low'] }
    }
  },
  
  async run(ctx: PlayContext<Input>): Promise<PlayOutput<Output>> {
    const { company_name, domain } = ctx.input;
    
    // Node 2: Placeholder guard on INPUT
    const norm = normalize(company_name);
    if (!company_name || BLOCK.has(norm) || norm.startsWith('selfemployed')) {
      ctx.log('Placeholder blocked on input');
      return {
        data: {
          company_clean: '',
          changed: true,
          confidence: 'high'
        },
        metadata: { abstained: true, reason: 'placeholder_input' }
      };
    }
    
    // Node 3: Agent cleans the name with LOCKED PROMPT
    const userMessage = `name="${company_name}" domain="${domain || ''}"`;
    
    const result = await ctx.tools.ai<Output>({
      systemPrompt: LOCKED_PROMPT_COMPANY_CLEANING,
      userPrompt: userMessage,
      jsonMode: true,
      jsonSchema: {
        type: 'object',
        required: ['company_clean', 'changed', 'confidence'],
        properties: {
          company_clean: { type: 'string' },
          changed: { type: 'boolean' },
          confidence: { type: 'string', enum: ['high', 'low'] }
        }
      },
      maxTokens: 200, // mini
      // For nano: maxTokens: 2000, reasoning_effort: "default"
      retries: 3
    });
    
    // Node 4: Placeholder guard on OUTPUT + invented-word guard
    const cleanNorm = normalize(result.company_clean);
    if (BLOCK.has(cleanNorm) || cleanNorm.startsWith('selfemployed')) {
      ctx.log('Placeholder blocked on output');
      return {
        data: {
          company_clean: '',
          changed: true,
          confidence: 'high'
        },
        metadata: { abstained: true, reason: 'placeholder_output' }
      };
    }
    
    // Invented-word guard: normalize(output) must be substring of normalize(input)
    const inputNorm = normalize(company_name);
    if (cleanNorm && !inputNorm.includes(cleanNorm)) {
      ctx.log('Invented word detected, quarantine');
      return {
        data: {
          company_clean: '',
          changed: true,
          confidence: 'high'
        },
        metadata: { abstained: true, reason: 'invented_word', quarantine: true }
      };
    }
    
    return {
      data: result,
      metadata: { 
        confidence: result.confidence,
        abstained: !result.company_clean
      }
    };
  }
});

export default companyNameCleaningPlay;
