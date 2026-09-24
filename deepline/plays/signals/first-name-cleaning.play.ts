/**
 * First Name Cleaning Play
 * 
 * Port of: skills/playbooks/playbook-first-name-cleaning/clay-workflow.md
 * 
 * Cleans first names for email greetings with 6 deterministic guards.
 * 
 * Node 2: Six guards (G1-G6) - CODE
 * Node 3: Agent cleans the name - LOCKED PROMPT with 30 examples
 */

import { definePlay, PlayContext, PlayOutput } from '../../types/play';
import { normalize } from '../../lib/utils';

interface Input {
  first_name: string;
  last_name: string;
  company_name: string;
}

interface Output {
  first_name_clean: string;
  changed: boolean;
  confidence: 'high' | 'low';
  flags: string[]; // QC flags for review
}

// Guard 1: Placeholder set
const BLOCK = new Set([
  'admin', 'info', 'sales', 'support', 'team', 'owner', 'manager',
  'hr', 'office', 'contact', 'n/a', 'none', 'unknown', 'test', 'tbd'
]);

// Guard 3: Caps acronym test - 2-4 chars ALL-CAPS with NO vowel
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']);

// Guard 5: Non-Latin script regex
const LATIN_REGEX = /^[a-zA-Z0-9\s\-'.()]+$/;

// ============================================================================
// LOCKED PROMPT from SKILL.md §6 (lines 240-318) - VERBATIM, graded at 96/100
// Model: gpt-4o-mini in Clay, gpt-5-nano with default effort outside Clay
// Cache: 2,436 tokens, ~2,100 cached after first call
// DO NOT PARAPHRASE. Model was graded on this exact text with 30 examples.
// ============================================================================
const LOCKED_PROMPT_FIRST_NAME_CLEANING = `You clean the first-name field on a sales lead so it can be dropped straight into the greeting line of a cold email.

You will be given the raw first-name string from a CRM, plus that row's last-name string and company name for context. Return the single name this person would be greeted by in a friendly business email.

Return JSON only, exactly these keys:
{"first_name_clean": "...", "changed": true, "confidence": "high"}

Rules:
1. Drop honorifics and titles at the front: Dr, Dr., Mr, Mrs, Ms, Miss, Prof, Professor, Rev, Fr, Capt, Sir, Dame, Lord, Sr, Sra, Hr, Ing, Eng, Adv.
2. Drop credential and qualification suffixes wherever they appear: MD, DO, DDS, DMD, RN, NP, PA-C, PhD, Ph.D, EdD, JD, Esq, Esquire, CPA, CFA, CFP, MBA, MSc, MA, BSc, PE, PMP, CISSP, CSM, MCIPS, FCA, ACCA, and the punctuation attached to them.
3. Drop emoji, stars, arrows, bullets, check marks, crowns, and any other decoration: the leading and trailing ornaments people add to a LinkedIn name. Keep only the letters of the name.
4. Fix shouting and whispering, and do it LAST, after you have picked the name out of the field. An ALL-CAPS ordinary name becomes Title Case, so PAUL becomes Paul and SUSHMA becomes Sushma. An all-lowercase ordinary name becomes Title Case, so javonne becomes Javonne and alan becomes Alan. The name you return is always Title Case unless rule 5 or rule 12 says otherwise.
5a. A trailing 'S or 's on the first-name field is a possessive artifact from a business listing, not part of the name. Drop it. Rosa'S becomes Rosa. This applies only at the very end of the field, never to an apostrophe inside the name.
5b. Keep deliberate internal capitals and punctuation that belong to the name: DeAndrea, McCurry, O'Brien, D'Anza, T'Kia, Jean-Paul, Yi-Hsuan, Anne-Maud. Never remove a hyphen and never remove an apostrophe from inside a name, and never split a hyphenated name into one half.
6. When a nickname or short form follows the name in parentheses or quotes, return the nickname, because that is what the person goes by. Kathryn (Katie) becomes Katie. Lazaro (Laz) becomes Laz.
7. When the parenthetical is not a short form of the outer name, keep the outer name and drop the parenthetical. Disa(Xiaobing) becomes Disa.
8. When two names are separated by a slash, return the second one if it is the everyday English short form, otherwise the first. Mihir/Mike becomes Mike.
9. When the first-name field holds the whole name and its last word repeats the last-name field, drop that repeated word. Robert wilkie with last name Wilkie becomes Robert.
10. Keep a genuine two-part given name intact: Jose Ramon, Guðmundur Ragnar, Yong Shuan, Marie-Laure. Do not shorten a name that is simply long.
11. Drop appended job titles, taglines, hiring notices, and company text that someone typed into the name field. Keep only the given name.
12. Keep names written in a non-Latin script exactly as they are. Never transliterate, never translate, never romanize. If the field mixes a native-script name with a Latin-script name, return the Latin-script one.
13. Never invent, expand, translate, or guess a name. Every letter you output must already appear in the first-name field. If you would have to add a letter, do not add it.
14. Never add a trailing period, comma, or quotation marks. Never return a leading or trailing space.
15. No em dashes anywhere in the output.
15b. When one ALL-CAPS token looks like two names run together, do NOT split it, because splitting invents a word boundary. Title Case it as one word and set confidence to "low" so a human checks the row.
16. Return "" for first_name_clean when the field is empty, when it is a placeholder or a mailbox role such as Admin, Info, Sales, Support, Team, Owner, Manager, HR, Office, Contact, N/A, None, Unknown, Test, TBD, when it holds a company name instead of a person, when the first-name field and the last-name field read together as the company name in the company field, or when it is a single letter or a single initial that cannot be greeted.
17. Multi-letter initials that a person actually goes by are fine and stay as written: J.D., K.C., J.C. A single initial such as O. or H. or C is not greetable, so return "".
18. "changed" is true when first_name_clean differs from the raw first-name field, and false when it is identical.
19. "confidence" is "low" when you had to judge whether the string was a person at all, or which part was the given name, and "high" otherwise.

The output must read correctly inside this greeting, with no edits: "Hi FIRST_NAME_CLEAN,"

Work fast. This is a formatting job, not a research job. Do not look anything up and do not reason at length. Do not output your reasoning, only the JSON.

Examples:
Input: first="Dr Ruba" last="Maatouk" company="Metropolitan Dental Care"
Output: {"first_name_clean": "Ruba", "changed": true, "confidence": "high"}
Input: first="Capt. Jehan" last="Alam" company="Fletcher International Exports Pty"
Output: {"first_name_clean": "Jehan", "changed": true, "confidence": "high"}
Input: first="Philip" last="Pickard, MBA" company="Dow"
Output: {"first_name_clean": "Philip", "changed": false, "confidence": "high"}
Input: first="Dr. Marie Y." last="Lemelle, MBA, PhD" company="Platinum Star Public Relations"
Output: {"first_name_clean": "Marie", "changed": true, "confidence": "high"}
Input: first="PAUL" last="Harlin" company=""
Output: {"first_name_clean": "Paul", "changed": true, "confidence": "high"}
Input: first="javonne" last="morgan" company="All Seasons"
Output: {"first_name_clean": "Javonne", "changed": true, "confidence": "high"}
Input: first="DeAndrea (Dee)" last="Davis" company="LyondellBasell"
Output: {"first_name_clean": "Dee", "changed": true, "confidence": "high"}
Input: first="Kathryn (Katie)" last="Connors" company="BrightFarms"
Output: {"first_name_clean": "Katie", "changed": true, "confidence": "high"}
Input: first="Disa(Xiaobing)" last="WU" company="Cordis"
Output: {"first_name_clean": "Disa", "changed": true, "confidence": "high"}
Input: first="Jean-Paul" last="Beleshay" company="Strata Clean Energy"
Output: {"first_name_clean": "Jean-Paul", "changed": false, "confidence": "high"}
Input: first="Anne-Maud" last="Boyard" company="CLARTEIS"
Output: {"first_name_clean": "Anne-Maud", "changed": false, "confidence": "high"}
Input: first="D'Anza" last="Alexander" company="NCTC"
Output: {"first_name_clean": "D'Anza", "changed": false, "confidence": "high"}
Input: first="Rosa'S" last="Delgado" company="Riverside Health"
Output: {"first_name_clean": "Rosa", "changed": true, "confidence": "low"}
Input: first="MARYELLEN" last="Boyd" company=""
Output: {"first_name_clean": "Maryellen", "changed": true, "confidence": "low"}
Input: first="Blue Ridge" last="Roofing" company="Blue Ridge Roofing"
Output: {"first_name_clean": "", "changed": true, "confidence": "high"}
Input: first="👋 James" last="Sansbury" company="Tugboat"
Output: {"first_name_clean": "James", "changed": true, "confidence": "high"}
Input: first="★ Marc" last="Deinum ★" company="MetroStation.nl"
Output: {"first_name_clean": "Marc", "changed": true, "confidence": "high"}
Input: first="Robert wilkie" last="Wilkie" company="RJ's Burgers & Ice Cream Co."
Output: {"first_name_clean": "Robert", "changed": true, "confidence": "high"}
Input: first="Jose Ramon" last="Carrasco" company="RC Innovations"
Output: {"first_name_clean": "Jose Ramon", "changed": false, "confidence": "high"}
Input: first="Guðmundur Ragnar" last="Guðmundsson" company="Prentmet Oddi"
Output: {"first_name_clean": "Guðmundur Ragnar", "changed": false, "confidence": "high"}
Input: first="J.D." last="Dougherty" company="Jeff's Bagel Run"
Output: {"first_name_clean": "J.D.", "changed": false, "confidence": "high"}
Input: first="O." last="Murdock" company="Murdock Chevrolet"
Output: {"first_name_clean": "", "changed": true, "confidence": "high"}
Input: first="珊" last="苏" company="Axine Water Technologies"
Output: {"first_name_clean": "珊", "changed": false, "confidence": "high"}
Input: first="王小明ken" last="Wang" company="Sunrise Optics"
Output: {"first_name_clean": "Ken", "changed": true, "confidence": "low"}
Input: first="Mihir/Mike" last="Parikh" company="FreshLime"
Output: {"first_name_clean": "Mike", "changed": true, "confidence": "high"}
Input: first="Dr Sean Li We Are Actively Hiring At Antai Global" last="Inc" company="Antai Global"
Output: {"first_name_clean": "Sean", "changed": true, "confidence": "low"}
Input: first="AAA" last="Upholstery" company="AAA Upholstery"
Output: {"first_name_clean": "", "changed": true, "confidence": "high"}
Input: first="Admin" last="E-Gree" company="e-gree"
Output: {"first_name_clean": "", "changed": true, "confidence": "high"}
Input: first="" last="Awhaitey" company="Healthy Kingdom"
Output: {"first_name_clean": "", "changed": false, "confidence": "high"}
Input: first="Gowinder " last="Singh" company="Mainfreight"
Output: {"first_name_clean": "Gowinder", "changed": true, "confidence": "high"}

Name to clean:`;
    const companyNorm = normalize(company_name);
    if (fullName === companyNorm) {
      flags.push('G2_company_overlap');
    }
    
    // G3: Caps acronym (2-4 chars ALL-CAPS with NO vowel) - FLAG
    if (clean.length >= 2 && clean.length <= 4 && clean === clean.toUpperCase() && !hasVowel(clean)) {
      flags.push('G3_caps_acronym');
    }
    
    // G4: Run-together shout (one ALL-CAPS token of 9+ chars) - FLAG
    if (clean.length >= 9 && clean === clean.toUpperCase()) {
      flags.push('G4_run_together_shout');
    }
    
    // G5: Non-Latin script - FLAG, never abstain (keep the name, let downstream gate exclude it)
    if (clean && !LATIN_REGEX.test(clean)) {
      flags.push('G5_non_latin_script');
    }
    
    // G6: Invented letters (normalize(output) must be substring of normalize(input))
    // Strip accents for this check per SKILL.md §6
    const inputNorm = normalize(first_name);
    if (clean && !inputNorm.includes(cleanNorm)) {
      ctx.log('G6: Invented letters detected, quarantine');
      return {
        data: { first_name_clean: '', changed: true, confidence: 'high', flags: ['G6_invented'] },
        metadata: { abstained: true, reason: 'invented_letters', quarantine: true }
      };
    }
    
    return {
      data: {
        first_name_clean: clean,
        changed: result.changed,
        confidence: result.confidence,
        flags
      },
      metadata: {
        confidence: result.confidence,
        abstained: !clean,
        flags: flags.length > 0 ? flags : undefined
      }
    };
  }
});

export default firstNameCleaningPlay;
