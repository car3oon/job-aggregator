import { Category, WorkPreference } from "@prisma/client";
import { ScrapedJob } from "./types";

export interface ProcessedJob extends ScrapedJob {
  matchedCategories: string[]; // Names of categories (e.g. "React Frontend")
  matchedPreferences: string[]; // Names of preferences (e.g. "Remote")
}

export function isWholeWordMatch(content: string, word: string) {
  // Escape regex characters
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use negative lookbehind/lookahead to ensure it's not part of a larger word
  const regex = new RegExp(`(?<![a-z0-9])${escapedWord}(?![a-z0-9])`, 'i');
  return regex.test(content);
}

export function processJob(
  job: ScrapedJob,
  categories: Category[],
  preferences: WorkPreference[]
): ProcessedJob {
  // Combine all text related to the job into one searchable string
  const contentToSearch = `${job.title} ${job.rawContent}`.toLowerCase();
  
  const matchedCategories: string[] = [];
  const matchedPreferences: string[] = [];

  // 1. Process Categories
  for (const cat of categories) {
    // If the content contains ANY excluded word, we immediately skip this category
    const hasExcluded = cat.excluded.some(ex => ex.trim() && isWholeWordMatch(contentToSearch, ex.trim().toLowerCase()));
    if (hasExcluded) continue;

    // If it has ANY required keyword group, it's a match
    // Keyword group can be "react + node" which means BOTH must be present
    if (cat.keywords.length > 0) {
      const hasKeyword = cat.keywords.some(kwGroup => {
        if (!kwGroup.trim()) return false;
        // Split by '+' to require ALL words in this specific group
        const requiredWords = kwGroup.split("+").map(w => w.trim().toLowerCase());
        return requiredWords.every(word => isWholeWordMatch(contentToSearch, word));
      });
      
      if (hasKeyword) {
        matchedCategories.push(cat.name);
      }
    }
  }

  // 2. Process Work Preferences (Location / Remote)
  for (const pref of preferences) {
    if (!pref.isActive) continue; // Skip inactive preferences

    if (pref.keywords.length > 0) {
      const hasKeyword = pref.keywords.some(kwGroup => {
        if (!kwGroup.trim()) return false;
        const requiredWords = kwGroup.split("+").map(w => w.trim().toLowerCase());
        return requiredWords.every(word => isWholeWordMatch(contentToSearch, word));
      });

      if (hasKeyword) {
        matchedPreferences.push(pref.name);
      }
    }
  }

  return {
    ...job,
    matchedCategories,
    matchedPreferences
  };
}
