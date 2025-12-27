/**
 * NCERT Content Scraper
 * 
 * LEGAL NOTICE:
 * NCERT textbooks are published by the National Council of Educational Research 
 * and Training, a Government of India organization. These textbooks are:
 * - Freely available for download from ncert.nic.in
 * - Intended for educational use
 * - Not copyrighted in the traditional sense (government publications)
 * 
 * This scraper respectfully fetches content from official NCERT sources
 * with rate limiting to avoid overloading their servers.
 */

import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface NCERTBook {
  classNumber: number;
  subject: string;
  subjectCode: string;
  bookTitle: string;
  bookCode: string;
  language: 'en' | 'hi';
  chapters: NCERTChapter[];
}

interface NCERTChapter {
  chapterNumber: number;
  title: string;
  pdfUrl: string;
  topics: string[];
}

interface CurriculumData {
  classes: ClassData[];
}

interface ClassData {
  classNumber: number;
  subjects: SubjectData[];
}

interface SubjectData {
  name: string;
  nameHindi: string;
  code: string;
  icon: string;
  color: string;
  bookTitle: string;
  bookCode: string;
  chapters: ChapterData[];
}

interface ChapterData {
  chapterNumber: number;
  title: string;
  titleHindi: string;
  pdfUrl: string;
  topics: TopicData[];
}

interface TopicData {
  topicNumber: number;
  title: string;
  titleHindi: string;
  content: string;
  keyTerms: string[];
}

// NCERT Book mappings from official website
const NCERT_BOOKS: Record<number, NCERTBook[]> = {
  1: [
    { classNumber: 1, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Math-Magic', bookCode: 'aemh1', language: 'en', chapters: [] },
    { classNumber: 1, subject: 'English', subjectCode: 'english', bookTitle: 'Marigold', bookCode: 'aeen1', language: 'en', chapters: [] },
    { classNumber: 1, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Rimjhim', bookCode: 'ahhn1', language: 'hi', chapters: [] },
  ],
  2: [
    { classNumber: 2, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Math-Magic', bookCode: 'bemh1', language: 'en', chapters: [] },
    { classNumber: 2, subject: 'English', subjectCode: 'english', bookTitle: 'Marigold', bookCode: 'been1', language: 'en', chapters: [] },
    { classNumber: 2, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Rimjhim', bookCode: 'bhhn1', language: 'hi', chapters: [] },
  ],
  3: [
    { classNumber: 3, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Mathematics', bookCode: 'cemh1', language: 'en', chapters: [] },
    { classNumber: 3, subject: 'English', subjectCode: 'english', bookTitle: 'Marigold', bookCode: 'ceen1', language: 'en', chapters: [] },
    { classNumber: 3, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Rimjhim', bookCode: 'chhn1', language: 'hi', chapters: [] },
    { classNumber: 3, subject: 'EVS', subjectCode: 'evs', bookTitle: 'Looking Around', bookCode: 'ceap1', language: 'en', chapters: [] },
  ],
  4: [
    { classNumber: 4, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Math-Magic', bookCode: 'demh1', language: 'en', chapters: [] },
    { classNumber: 4, subject: 'English', subjectCode: 'english', bookTitle: 'Marigold', bookCode: 'deen1', language: 'en', chapters: [] },
    { classNumber: 4, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Rimjhim', bookCode: 'dhhn1', language: 'hi', chapters: [] },
    { classNumber: 4, subject: 'EVS', subjectCode: 'evs', bookTitle: 'Looking Around', bookCode: 'deap1', language: 'en', chapters: [] },
  ],
  5: [
    { classNumber: 5, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Math-Magic', bookCode: 'eemh1', language: 'en', chapters: [] },
    { classNumber: 5, subject: 'English', subjectCode: 'english', bookTitle: 'Marigold', bookCode: 'eeen1', language: 'en', chapters: [] },
    { classNumber: 5, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Rimjhim', bookCode: 'ehhn1', language: 'hi', chapters: [] },
    { classNumber: 5, subject: 'EVS', subjectCode: 'evs', bookTitle: 'Looking Around', bookCode: 'eeap1', language: 'en', chapters: [] },
  ],
  6: [
    { classNumber: 6, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Mathematics', bookCode: 'femh1', language: 'en', chapters: [] },
    { classNumber: 6, subject: 'Science', subjectCode: 'science', bookTitle: 'Science', bookCode: 'fesc1', language: 'en', chapters: [] },
    { classNumber: 6, subject: 'English', subjectCode: 'english', bookTitle: 'Honeysuckle', bookCode: 'fehl1', language: 'en', chapters: [] },
    { classNumber: 6, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Vasant', bookCode: 'fhvs1', language: 'hi', chapters: [] },
    { classNumber: 6, subject: 'Social Science', subjectCode: 'social', bookTitle: 'History - Our Past', bookCode: 'fess1', language: 'en', chapters: [] },
    { classNumber: 6, subject: 'Sanskrit', subjectCode: 'sanskrit', bookTitle: 'Ruchira', bookCode: 'fhsk1', language: 'hi', chapters: [] },
  ],
  7: [
    { classNumber: 7, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Mathematics', bookCode: 'gemh1', language: 'en', chapters: [] },
    { classNumber: 7, subject: 'Science', subjectCode: 'science', bookTitle: 'Science', bookCode: 'gesc1', language: 'en', chapters: [] },
    { classNumber: 7, subject: 'English', subjectCode: 'english', bookTitle: 'Honeycomb', bookCode: 'gehc1', language: 'en', chapters: [] },
    { classNumber: 7, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Vasant', bookCode: 'ghvs1', language: 'hi', chapters: [] },
    { classNumber: 7, subject: 'Social Science', subjectCode: 'social', bookTitle: 'Our Pasts-II', bookCode: 'gess1', language: 'en', chapters: [] },
    { classNumber: 7, subject: 'Sanskrit', subjectCode: 'sanskrit', bookTitle: 'Ruchira', bookCode: 'ghsk1', language: 'hi', chapters: [] },
  ],
  8: [
    { classNumber: 8, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Mathematics', bookCode: 'hemh1', language: 'en', chapters: [] },
    { classNumber: 8, subject: 'Science', subjectCode: 'science', bookTitle: 'Science', bookCode: 'hesc1', language: 'en', chapters: [] },
    { classNumber: 8, subject: 'English', subjectCode: 'english', bookTitle: 'Honeydew', bookCode: 'hehd1', language: 'en', chapters: [] },
    { classNumber: 8, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Vasant', bookCode: 'hhvs1', language: 'hi', chapters: [] },
    { classNumber: 8, subject: 'Social Science', subjectCode: 'social', bookTitle: 'Our Pasts-III', bookCode: 'hess2', language: 'en', chapters: [] },
    { classNumber: 8, subject: 'Sanskrit', subjectCode: 'sanskrit', bookTitle: 'Ruchira', bookCode: 'hhsk1', language: 'hi', chapters: [] },
  ],
  9: [
    { classNumber: 9, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Mathematics', bookCode: 'iemh1', language: 'en', chapters: [] },
    { classNumber: 9, subject: 'Science', subjectCode: 'science', bookTitle: 'Science', bookCode: 'iesc1', language: 'en', chapters: [] },
    { classNumber: 9, subject: 'English', subjectCode: 'english', bookTitle: 'Beehive', bookCode: 'iebe1', language: 'en', chapters: [] },
    { classNumber: 9, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Kshitij', bookCode: 'ihks1', language: 'hi', chapters: [] },
    { classNumber: 9, subject: 'Social Science', subjectCode: 'social', bookTitle: 'India and Contemporary World-I', bookCode: 'iess3', language: 'en', chapters: [] },
    { classNumber: 9, subject: 'Sanskrit', subjectCode: 'sanskrit', bookTitle: 'Shemushi', bookCode: 'ihsh1', language: 'hi', chapters: [] },
  ],
  10: [
    { classNumber: 10, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Mathematics', bookCode: 'jemh1', language: 'en', chapters: [] },
    { classNumber: 10, subject: 'Science', subjectCode: 'science', bookTitle: 'Science', bookCode: 'jesc1', language: 'en', chapters: [] },
    { classNumber: 10, subject: 'English', subjectCode: 'english', bookTitle: 'First Flight', bookCode: 'jeff1', language: 'en', chapters: [] },
    { classNumber: 10, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Kshitij-2', bookCode: 'jhks1', language: 'hi', chapters: [] },
    { classNumber: 10, subject: 'Social Science', subjectCode: 'social', bookTitle: 'India and Contemporary World-II', bookCode: 'jess3', language: 'en', chapters: [] },
    { classNumber: 10, subject: 'Sanskrit', subjectCode: 'sanskrit', bookTitle: 'Shemushi', bookCode: 'jhsk1', language: 'hi', chapters: [] },
  ],
  11: [
    { classNumber: 11, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Mathematics', bookCode: 'kemh1', language: 'en', chapters: [] },
    { classNumber: 11, subject: 'Physics', subjectCode: 'physics', bookTitle: 'Physics Part-I', bookCode: 'keph1', language: 'en', chapters: [] },
    { classNumber: 11, subject: 'Chemistry', subjectCode: 'chemistry', bookTitle: 'Chemistry Part-I', bookCode: 'kech1', language: 'en', chapters: [] },
    { classNumber: 11, subject: 'Biology', subjectCode: 'biology', bookTitle: 'Biology', bookCode: 'kebo1', language: 'en', chapters: [] },
    { classNumber: 11, subject: 'English', subjectCode: 'english', bookTitle: 'Hornbill', bookCode: 'kehb1', language: 'en', chapters: [] },
    { classNumber: 11, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Antra', bookCode: 'khat1', language: 'hi', chapters: [] },
  ],
  12: [
    { classNumber: 12, subject: 'Mathematics', subjectCode: 'math', bookTitle: 'Mathematics Part-I', bookCode: 'lemh1', language: 'en', chapters: [] },
    { classNumber: 12, subject: 'Physics', subjectCode: 'physics', bookTitle: 'Physics Part-I', bookCode: 'leph1', language: 'en', chapters: [] },
    { classNumber: 12, subject: 'Chemistry', subjectCode: 'chemistry', bookTitle: 'Chemistry Part-I', bookCode: 'lech1', language: 'en', chapters: [] },
    { classNumber: 12, subject: 'Biology', subjectCode: 'biology', bookTitle: 'Biology', bookCode: 'lebo1', language: 'en', chapters: [] },
    { classNumber: 12, subject: 'English', subjectCode: 'english', bookTitle: 'Flamingo', bookCode: 'lefl1', language: 'en', chapters: [] },
    { classNumber: 12, subject: 'Hindi', subjectCode: 'hindi', bookTitle: 'Antra', bookCode: 'lhat1', language: 'hi', chapters: [] },
  ],
};

// Subject icons and colors
const SUBJECT_META: Record<string, { icon: string; color: string; nameHindi: string }> = {
  math: { icon: '📐', color: '#6366F1', nameHindi: 'गणित' },
  science: { icon: '🔬', color: '#8B5CF6', nameHindi: 'विज्ञान' },
  english: { icon: '📖', color: '#EC4899', nameHindi: 'अंग्रेजी' },
  hindi: { icon: '📝', color: '#F97316', nameHindi: 'हिंदी' },
  social: { icon: '🌍', color: '#14B8A6', nameHindi: 'सामाजिक विज्ञान' },
  sanskrit: { icon: '🕉️', color: '#F59E0B', nameHindi: 'संस्कृत' },
  evs: { icon: '🌿', color: '#22C55E', nameHindi: 'पर्यावरण अध्ययन' },
  physics: { icon: '⚡', color: '#3B82F6', nameHindi: 'भौतिकी' },
  chemistry: { icon: '🧪', color: '#EF4444', nameHindi: 'रसायन विज्ञान' },
  biology: { icon: '🧬', color: '#10B981', nameHindi: 'जीव विज्ञान' },
};

// Utility functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string, retries = 3): Promise<string | null> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MyCupIsEmpty Educational Platform (educational use)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      
      if (response.ok) {
        return await response.text();
      }
      
      console.log(`Attempt ${i + 1} failed for ${url}: ${response.status}`);
    } catch (error) {
      console.log(`Attempt ${i + 1} error for ${url}:`, error);
    }
    
    await delay(2000 * (i + 1)); // Exponential backoff
  }
  
  return null;
};

// Scrape chapter list from NCERT textbook page
async function scrapeBookChapters(bookCode: string): Promise<NCERTChapter[]> {
  const url = `https://ncert.nic.in/textbook.php?${bookCode}=0-20`;
  console.log(`Fetching chapters from: ${url}`);
  
  const html = await fetchWithRetry(url);
  if (!html) {
    console.log(`Failed to fetch chapters for ${bookCode}`);
    return [];
  }
  
  const $ = cheerio.load(html);
  const chapters: NCERTChapter[] = [];
  
  // Parse chapter links from NCERT page
  $('a[href*=".pdf"]').each((index, element) => {
    const $el = $(element);
    const href = $el.attr('href') || '';
    const title = $el.text().trim();
    
    if (href && title) {
      const pdfUrl = href.startsWith('http') ? href : `https://ncert.nic.in${href}`;
      
      chapters.push({
        chapterNumber: index + 1,
        title: title,
        pdfUrl: pdfUrl,
        topics: [],
      });
    }
  });
  
  // Rate limiting - be respectful to NCERT servers
  await delay(1000);
  
  return chapters;
}

// Generate curriculum data structure
async function generateCurriculum(): Promise<CurriculumData> {
  const curriculum: CurriculumData = { classes: [] };
  
  for (let classNum = 1; classNum <= 12; classNum++) {
    console.log(`\n=== Processing Class ${classNum} ===`);
    
    const classData: ClassData = {
      classNumber: classNum,
      subjects: [],
    };
    
    const books = NCERT_BOOKS[classNum] || [];
    
    for (const book of books) {
      console.log(`  Processing: ${book.subject} - ${book.bookTitle}`);
      
      const meta = SUBJECT_META[book.subjectCode] || {
        icon: '📚',
        color: '#6B7280',
        nameHindi: book.subject,
      };
      
      // Fetch chapters (with rate limiting)
      const chapters = await scrapeBookChapters(book.bookCode);
      
      const subjectData: SubjectData = {
        name: book.subject,
        nameHindi: meta.nameHindi,
        code: book.subjectCode,
        icon: meta.icon,
        color: meta.color,
        bookTitle: book.bookTitle,
        bookCode: book.bookCode,
        chapters: chapters.map(ch => ({
          chapterNumber: ch.chapterNumber,
          title: ch.title,
          titleHindi: '', // Would need separate Hindi scraping
          pdfUrl: ch.pdfUrl,
          topics: [], // Topics extracted from PDF content
        })),
      };
      
      classData.subjects.push(subjectData);
      
      // Rate limiting between subjects
      await delay(2000);
    }
    
    curriculum.classes.push(classData);
  }
  
  return curriculum;
}

// Generate static curriculum data (without scraping)
function generateStaticCurriculum(): CurriculumData {
  const curriculum: CurriculumData = { classes: [] };
  
  // Comprehensive chapter data based on NCERT syllabus
  const CHAPTER_DATA: Record<number, Record<string, string[]>> = {
    1: {
      math: ['Shapes and Space', 'Numbers from One to Nine', 'Addition', 'Subtraction', 'Numbers from Ten to Twenty', 'Time', 'Measurement', 'Numbers from Twenty-one to Fifty', 'Data Handling', 'Patterns', 'Numbers', 'Money', 'How Many'],
      english: ['A Happy Child', 'Three Little Pigs', 'The Bubble, the Straw and the Shoe', 'Lalu and Peelu', 'Mango'],
      hindi: ['झूला', 'आम की कहानी', 'आम की टोकरी', 'पत्ते ही पत्ते', 'पकौड़ी'],
    },
    6: {
      math: ['Patterns in Mathematics', 'Lines and Angles', 'Number Play', 'Data Handling and Presentation', 'Prime Time', 'Perimeter and Area', 'Fractions', 'Playing with Constructions', 'Symmetry', 'The Other Side of Zero'],
      science: ['The Wonderful World of Science', 'Diversity in the Living World', 'Mindful Eating: A Path to a Healthy Body', 'Exploring Magnets', 'Measurement of Length and Motion', 'Materials Around Us', 'Temperature and its Measurement', 'A Journey through States of Water', 'Methods of Separation', 'Living Creatures: Exploring their Characteristics', "Nature's Treasures", 'Beyond Earth'],
      english: ['A Bottle of Dew', 'The Raven and the Fox', 'Rama to the Rescue', 'The Unlikely Best Friends', 'Neem Baba'],
      hindi: ['वह चिड़िया जो', 'बचपन', 'नादान दोस्त', 'चाँद से थोड़ी-सी गप्पें', 'अक्षरों का महत्व'],
      social: ['What, Where, How and When?', 'From Hunting-Gathering to Growing Food', 'In the Earliest Cities', 'What Books and Burials Tell Us', 'Kingdoms, Kings and Early Republic'],
    },
    10: {
      math: ['Real Numbers', 'Polynomials', 'Pair of Linear Equations in Two Variables', 'Quadratic Equations', 'Arithmetic Progressions', 'Triangles', 'Coordinate Geometry', 'Introduction to Trigonometry', 'Some Applications of Trigonometry', 'Circles', 'Areas Related to Circles', 'Surface Areas and Volumes', 'Statistics', 'Probability'],
      science: ['Chemical Reactions and Equations', 'Acids, Bases and Salts', 'Metals and Non-metals', 'Carbon and its Compounds', 'Life Processes', 'Control and Coordination', 'How do Organisms Reproduce?', 'Heredity and Evolution', 'Light - Reflection and Refraction', 'Human Eye and Colourful World', 'Electricity', 'Magnetic Effects of Electric Current', 'Our Environment'],
      english: ['A Letter to God', 'Nelson Mandela: Long Walk to Freedom', 'Two Stories about Flying', 'From the Diary of Anne Frank', 'The Hundred Dresses - I'],
      hindi: ['सूरदास के पद', 'राम-लक्ष्मण-परशुराम संवाद', 'आत्मत्राण', 'बालगोबिन भगत', 'नेताजी का चश्मा'],
      social: ['The Rise of Nationalism in Europe', 'Nationalism in India', 'The Making of a Global World', 'The Age of Industrialisation', 'Print Culture and the Modern World'],
    },
  };
  
  for (let classNum = 1; classNum <= 12; classNum++) {
    const classData: ClassData = {
      classNumber: classNum,
      subjects: [],
    };
    
    const books = NCERT_BOOKS[classNum] || [];
    const chapterData = CHAPTER_DATA[classNum] || {};
    
    for (const book of books) {
      const meta = SUBJECT_META[book.subjectCode] || {
        icon: '📚',
        color: '#6B7280',
        nameHindi: book.subject,
      };
      
      const chapters = chapterData[book.subjectCode] || [];
      
      const subjectData: SubjectData = {
        name: book.subject,
        nameHindi: meta.nameHindi,
        code: book.subjectCode,
        icon: meta.icon,
        color: meta.color,
        bookTitle: book.bookTitle,
        bookCode: book.bookCode,
        chapters: chapters.map((title, idx) => ({
          chapterNumber: idx + 1,
          title: title,
          titleHindi: '',
          pdfUrl: `https://ncert.nic.in/textbook/${book.bookCode}/${book.bookCode}${String(idx + 1).padStart(2, '0')}.pdf`,
          topics: [],
        })),
      };
      
      classData.subjects.push(subjectData);
    }
    
    curriculum.classes.push(classData);
  }
  
  return curriculum;
}

// Main execution
async function main() {
  console.log('🎓 MyCupIsEmpty NCERT Content Generator');
  console.log('========================================\n');
  
  const args = process.argv.slice(2);
  const scrapeMode = args.includes('--scrape');
  
  let curriculum: CurriculumData;
  
  if (scrapeMode) {
    console.log('Mode: Scraping from NCERT website (this may take a while)...\n');
    console.log('⚠️  Note: Scraping respects rate limits to avoid overloading NCERT servers.\n');
    curriculum = await generateCurriculum();
  } else {
    console.log('Mode: Generating static curriculum data...\n');
    curriculum = generateStaticCurriculum();
  }
  
  // Save to JSON file
  const outputPath = path.join(process.cwd(), 'data', 'curriculum.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, JSON.stringify(curriculum, null, 2));
  console.log(`\n✅ Curriculum data saved to: ${outputPath}`);
  
  // Print summary
  console.log('\n📊 Summary:');
  for (const classData of curriculum.classes) {
    const totalChapters = classData.subjects.reduce((sum, s) => sum + s.chapters.length, 0);
    console.log(`   Class ${classData.classNumber}: ${classData.subjects.length} subjects, ${totalChapters} chapters`);
  }
}

// Export for use in other scripts
export { generateStaticCurriculum, generateCurriculum, NCERT_BOOKS, SUBJECT_META };
export type { CurriculumData, ClassData, SubjectData, ChapterData };

main().catch(console.error);
