import type { IIntentClassifier, TaskIntent } from '../types';

interface IntentPattern {
  intent: TaskIntent;
  primary: RegExp[];
  secondary: RegExp[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'fix' as TaskIntent,
    primary: [/^fix\s/i, /^resolve\s/i, /^debug\s/i, /^repair\s/i, /^hotfix\s/i, /^correct\s/i, /^patch\s/i],
    secondary: [/\bfix(ing|es)?\s/i, /\b(resolve|debug)\s/i, /\bbug(fix)?\b/i],
  },
  {
    intent: 'refactor' as TaskIntent,
    primary: [/^refactor\s/i, /^clean\s(up\s)?/i, /^rewrite\s/i, /^optimize\s/i, /^improve\s/i, /^simplify\s/i, /^extract\s/i],
    secondary: [/\brefactor(ing|s)?\s/i, /\bclean(ing)?\s(up\s)?/i, /\brewrite\s/i, /\boptimize\s/i, /\bimprov(e|ing)\s/i],
  },
  {
    intent: 'test' as TaskIntent,
    primary: [/^test\s/i, /^add\s.*test/i, /^write\s.*test/i, /^unit\s.*test/i, /^integration\s.*test/i, /^spec\s/i],
    secondary: [/\btest(s|ing)?\s/i, /\btest(ing|ed)?\b/i, /\bspec(s)?\b/i],
  },
  {
    intent: 'docs' as TaskIntent,
    primary: [
      /^document\s/i, /^write\s.*(doc|readme|guide)/i, /^update\s.*(doc|readme|guide)/i,
      /^comment\s/i, /^annotate\s/i, /^add\s+code\s+comment/i,
    ],
    secondary: [/\bdocument(ation|ing)?\s/i, /\b(doc|docs|readme)\b/i, /\bcomment(s|ing)?\s/i],
  },
  {
    intent: 'deploy' as TaskIntent,
    primary: [/^deploy\s/i, /^release\s/i, /^publish\s/i, /^ship\s/i, /^roll\s*out/i],
    secondary: [/\bdeploy(s|ing|ment)?\s/i, /\brelease(s|ing)?\s/i, /\bpublish(s|ing)?\s/i],
  },
  {
    intent: 'analyze' as TaskIntent,
    primary: [/^analyze\s/i, /^investigate\s/i, /^review\s/i, /^check\s/i, /^audit\s/i, /^profile\s/i],
    secondary: [/\banalyz(e|ing|is)\s/i, /\binvestigat(e|ing)\s/i, /\breview(s|ing)?\s/i, /\bcheck(s|ing)?\s/i],
  },
];

export class ManualIntentDetector implements IIntentClassifier {
  classify(text: string): TaskIntent {
    if (!text || text.trim().length === 0) {
      return 'analyze' as TaskIntent;
    }

    const trimmed = text.trim();

    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.primary) {
        if (regex.test(trimmed)) return pattern.intent;
      }
    }

    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.secondary) {
        if (regex.test(trimmed)) return pattern.intent;
      }
    }

    if (/\b(perf|performance|memory|speed|slow)\b/i.test(trimmed)) return 'refactor' as TaskIntent;
    if (/\b(error|fail|broken|crash|panic|bug)\b/i.test(trimmed)) return 'fix' as TaskIntent;

    return 'analyze' as TaskIntent;
  }

  getConfidence(text: string, intent?: TaskIntent): number {
    if (!text || text.trim().length === 0) return 0;
    let maxScore = 0;
    for (const pattern of INTENT_PATTERNS) {
      if (intent && pattern.intent !== intent) continue;
      let score = 0;
      for (const regex of pattern.primary) if (regex.test(text)) score += 0.6;
      for (const regex of pattern.secondary) if (regex.test(text)) score += 0.3;
      const words = text.split(/\s+/).length;
      if (words >= 3) score += 0.1;
      if (words >= 5) score += 0.1;
      maxScore = Math.max(maxScore, Math.min(score, 1.0));
    }
    return maxScore;
  }
}
