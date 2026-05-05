/**
 * interests-injector — given a word problem template + the student's
 * top interests, swap generic placeholders for personalized ones.
 *
 * Templates use plain string placeholders:
 *   {{HOBBY}}, {{SPORT}}, {{FOOD}}, {{PERSON}}
 *
 * The injector picks from the student's interests using simple categorization.
 * If no relevant interest matches, the placeholder stays generic.
 */

interface Interest {
  interest: string;
  weight: number;
}

const SPORT_KEYWORDS = ['cricket', 'football', 'soccer', 'basketball', 'badminton', 'tennis', 'kabaddi', 'hockey', 'chess'];
const HOBBY_KEYWORDS = ['drawing', 'painting', 'reading', 'gaming', 'coding', 'singing', 'dancing', 'photography'];
const FOOD_KEYWORDS = ['biryani', 'chocolate', 'pizza', 'mango', 'samosa', 'noodles', 'cookies'];
const PERSON_KEYWORDS = ['bts', 'taylor swift', 'virat kohli', 'dhoni', 'shah rukh khan', 'einstein'];

function pickByKeywords(interests: Interest[], keywords: string[]): string | null {
  const matches = interests
    .filter((i) => keywords.some((k) => i.interest.toLowerCase().includes(k)))
    .sort((a, b) => b.weight - a.weight);
  return matches[0]?.interest || null;
}

export function injectInterests(template: string, interests: Interest[]): string {
  let out = template;
  const sport = pickByKeywords(interests, SPORT_KEYWORDS);
  const hobby = pickByKeywords(interests, HOBBY_KEYWORDS);
  const food  = pickByKeywords(interests, FOOD_KEYWORDS);
  const person = pickByKeywords(interests, PERSON_KEYWORDS);

  if (sport)  out = out.replace(/\{\{SPORT\}\}/g, sport);
  if (hobby)  out = out.replace(/\{\{HOBBY\}\}/g, hobby);
  if (food)   out = out.replace(/\{\{FOOD\}\}/g, food);
  if (person) out = out.replace(/\{\{PERSON\}\}/g, person);

  // Generic fallbacks
  out = out.replace(/\{\{SPORT\}\}/g, 'cricket')
           .replace(/\{\{HOBBY\}\}/g, 'reading')
           .replace(/\{\{FOOD\}\}/g, 'mangoes')
           .replace(/\{\{PERSON\}\}/g, 'a friend');

  return out;
}
