/**
 * Seed Script: Class 5 — West Bengal Board (WBBPE)
 *
 * West Bengal Board of Primary Education (WBBPE) Class 5 curriculum.
 * Subjects: Mathematics (Ganit Prabha), English (Bliss), Bengali (Sahaj Path / Amar Bangla),
 *           Amader Paribesh (EVS/Environmental Studies), Hindi, Health & Physical Education
 *
 * Usage: npx tsx scripts/seed-wb-class5.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// CLASS 5 WB BOARD — SUBJECTS
// ============================================

const WB_CLASS5_SUBJECTS = [
  {
    name: 'Mathematics',
    name_hindi: 'গণিত প্রভা',
    code: 'math',
    icon: '📐',
    color: '#6366F1',
    book_title: 'Ganit Prabha',
    book_code: 'WB-V-MATH',
    total_chapters: 14,
  },
  {
    name: 'Bengali',
    name_hindi: 'বাংলা',
    code: 'bengali',
    icon: '📖',
    color: '#EC4899',
    book_title: 'Sahaj Path / Amar Bangla Boi',
    book_code: 'WB-V-BEN',
    total_chapters: 12,
  },
  {
    name: 'English',
    name_hindi: 'ইংরেজি',
    code: 'english',
    icon: '📝',
    color: '#F97316',
    book_title: 'Bliss',
    book_code: 'WB-V-ENG',
    total_chapters: 10,
  },
  {
    name: 'Amader Paribesh (EVS)',
    name_hindi: 'আমাদের পরিবেশ',
    code: 'evs',
    icon: '🌿',
    color: '#22C55E',
    book_title: 'Amader Paribesh',
    book_code: 'WB-V-EVS',
    total_chapters: 12,
  },
  {
    name: 'Hindi',
    name_hindi: 'हिंदी',
    code: 'hindi',
    icon: '🕉️',
    color: '#8B5CF6',
    book_title: 'Sahitya Sagar',
    book_code: 'WB-V-HIN',
    total_chapters: 10,
  },
  {
    name: 'Health & Physical Education',
    name_hindi: 'স্বাস্থ্য ও শারীরশিক্ষা',
    code: 'health_pe',
    icon: '🏃',
    color: '#14B8A6',
    book_title: 'Swasthya O Sharir Shiksha',
    book_code: 'WB-V-HPE',
    total_chapters: 8,
  },
];

// ============================================
// MATHEMATICS — Ganit Prabha Class 5
// ============================================

const MATH_CHAPTERS = [
  {
    chapter_number: 1,
    name: 'Large Numbers',
    name_hindi: 'বড় সংখ্যা',
    description: 'Numbers up to 10 crore, Indian and International place value, reading & writing large numbers',
    difficulty_level: 2,
    estimated_duration_minutes: 120,
    topics: [
      { name: 'Indian Place Value System', order_index: 1, content: 'In the Indian system, we group digits as: ones, tens, hundreds, thousands, ten-thousands, lakhs, ten-lakhs, crores, ten-crores. For example, 5,47,83,216 is read as "five crore forty-seven lakh eighty-three thousand two hundred sixteen".' },
      { name: 'International Place Value System', order_index: 2, content: 'In the International system, we group digits in threes: ones, thousands, millions, billions. 54,783,216 is read as "fifty-four million seven hundred eighty-three thousand two hundred sixteen".' },
      { name: 'Comparing Large Numbers', order_index: 3, content: 'To compare large numbers, first check the number of digits. If equal, compare from the leftmost digit. The number with the greater leftmost digit is larger.' },
      { name: 'Ascending and Descending Order', order_index: 4, content: 'Ascending order means arranging from smallest to largest. Descending order means from largest to smallest.' },
      { name: 'Rounding Off Numbers', order_index: 5, content: 'Rounding to the nearest 10, 100, or 1000. If the digit is 5 or more, round up; if less than 5, round down.' },
    ],
  },
  {
    chapter_number: 2,
    name: 'Addition and Subtraction',
    name_hindi: 'যোগ ও বিয়োগ',
    description: 'Addition and subtraction of large numbers, word problems, estimation',
    difficulty_level: 2,
    estimated_duration_minutes: 100,
    topics: [
      { name: 'Addition of Large Numbers', order_index: 1, content: 'When adding large numbers, align the digits by place value. Start from the ones column and carry over when the sum exceeds 9.' },
      { name: 'Subtraction of Large Numbers', order_index: 2, content: 'Align digits by place value. Borrow from the next column when the top digit is smaller than the bottom digit.' },
      { name: 'Estimation in Addition', order_index: 3, content: 'Estimate sums by rounding each number to the nearest ten, hundred, or thousand before adding. This helps check if your answer is reasonable.' },
      { name: 'Word Problems on Addition and Subtraction', order_index: 4, content: 'Read the problem carefully. Identify keywords: "total", "sum", "altogether" mean addition. "Difference", "remaining", "left" mean subtraction.' },
    ],
  },
  {
    chapter_number: 3,
    name: 'Multiplication',
    name_hindi: 'গুণ',
    description: 'Multiplication of 4-5 digit numbers, properties of multiplication, word problems',
    difficulty_level: 3,
    estimated_duration_minutes: 120,
    topics: [
      { name: 'Multiplication by 2-digit Numbers', order_index: 1, content: 'To multiply by a 2-digit number, first multiply by the ones digit, then multiply by the tens digit (shifting one position left), then add both results.' },
      { name: 'Multiplication by 3-digit Numbers', order_index: 2, content: 'Extend the same method: multiply by ones, tens, and hundreds separately, then add all partial products.' },
      { name: 'Properties of Multiplication', order_index: 3, content: 'Commutative: a × b = b × a. Associative: (a × b) × c = a × (b × c). Distributive: a × (b + c) = (a × b) + (a × c). Identity: a × 1 = a. Zero property: a × 0 = 0.' },
      { name: 'Word Problems on Multiplication', order_index: 4, content: 'Keywords like "times", "product", "each", "every" indicate multiplication. Break complex problems into steps.' },
    ],
  },
  {
    chapter_number: 4,
    name: 'Division',
    name_hindi: 'ভাগ',
    description: 'Long division, division with remainders, divisibility rules',
    difficulty_level: 3,
    estimated_duration_minutes: 130,
    topics: [
      { name: 'Long Division Method', order_index: 1, content: 'Divide → Multiply → Subtract → Bring down. Repeat until all digits are used. The answer has a quotient and possibly a remainder.' },
      { name: 'Division by 2-digit Numbers', order_index: 2, content: 'When dividing by a 2-digit number, estimate how many times the divisor fits into the first few digits of the dividend.' },
      { name: 'Divisibility Rules', order_index: 3, content: 'By 2: last digit is even. By 3: sum of digits divisible by 3. By 5: last digit is 0 or 5. By 9: sum of digits divisible by 9. By 10: last digit is 0.' },
      { name: 'Checking Division: Dividend = Divisor × Quotient + Remainder', order_index: 4, content: 'Always verify your answer: Dividend = (Divisor × Quotient) + Remainder. The remainder must be less than the divisor.' },
      { name: 'Word Problems on Division', order_index: 5, content: 'Keywords: "share equally", "distribute", "split into groups", "how many groups" suggest division.' },
    ],
  },
  {
    chapter_number: 5,
    name: 'Factors and Multiples',
    name_hindi: 'গুণনীয়ক ও গুণিতক',
    description: 'Factors, multiples, prime numbers, HCF and LCM',
    difficulty_level: 3,
    estimated_duration_minutes: 140,
    topics: [
      { name: 'Factors of a Number', order_index: 1, content: 'Factors are numbers that divide a given number exactly (remainder 0). For example, factors of 12 are: 1, 2, 3, 4, 6, 12.' },
      { name: 'Multiples of a Number', order_index: 2, content: 'Multiples are obtained by multiplying a number by 1, 2, 3, etc. Multiples of 4: 4, 8, 12, 16, 20...' },
      { name: 'Prime and Composite Numbers', order_index: 3, content: 'Prime numbers have exactly 2 factors (1 and itself): 2, 3, 5, 7, 11, 13... Composite numbers have more than 2 factors. 1 is neither prime nor composite.' },
      { name: 'HCF — Highest Common Factor', order_index: 4, content: 'HCF is the largest number that divides two or more numbers. Find by listing factors or by prime factorization. HCF of 12 and 18: factors of 12 = {1,2,3,4,6,12}, factors of 18 = {1,2,3,6,9,18}. Common = {1,2,3,6}. HCF = 6.' },
      { name: 'LCM — Least Common Multiple', order_index: 5, content: 'LCM is the smallest number that is a multiple of two or more numbers. LCM of 4 and 6: multiples of 4 = {4,8,12,16...}, multiples of 6 = {6,12,18...}. LCM = 12.' },
    ],
  },
  {
    chapter_number: 6,
    name: 'Fractions',
    name_hindi: 'ভগ্নাংশ',
    description: 'Types of fractions, equivalent fractions, addition, subtraction, comparison',
    difficulty_level: 3,
    estimated_duration_minutes: 150,
    topics: [
      { name: 'Types of Fractions', order_index: 1, content: 'Proper fraction: numerator < denominator (3/5). Improper fraction: numerator ≥ denominator (7/4). Mixed number: whole part + fraction (1¾).' },
      { name: 'Equivalent Fractions', order_index: 2, content: 'Fractions that represent the same value. Multiply or divide both numerator and denominator by the same number. 1/2 = 2/4 = 3/6 = 4/8.' },
      { name: 'Comparing Fractions', order_index: 3, content: 'Same denominator: compare numerators. Different denominators: find LCM, convert to like fractions, then compare.' },
      { name: 'Addition of Fractions', order_index: 4, content: 'Like fractions: add numerators, keep denominator. Unlike fractions: find LCM of denominators, convert, then add.' },
      { name: 'Subtraction of Fractions', order_index: 5, content: 'Same method as addition but subtract numerators. Always simplify the final answer to lowest terms.' },
      { name: 'Word Problems on Fractions', order_index: 6, content: 'Real-life examples: sharing food equally, measuring ingredients, dividing land. Draw diagrams to visualize!' },
    ],
  },
  {
    chapter_number: 7,
    name: 'Decimals',
    name_hindi: 'দশমিক',
    description: 'Introduction to decimals, place value, conversion between fractions and decimals',
    difficulty_level: 3,
    estimated_duration_minutes: 130,
    topics: [
      { name: 'Understanding Decimals', order_index: 1, content: 'A decimal number has a whole part and a fractional part separated by a decimal point. In 3.75, 3 is the whole part and .75 is the decimal part.' },
      { name: 'Decimal Place Value', order_index: 2, content: 'Tenths (1/10), Hundredths (1/100), Thousandths (1/1000). In 4.567: 5 is in tenths place, 6 in hundredths, 7 in thousandths.' },
      { name: 'Converting Fractions to Decimals', order_index: 3, content: '1/2 = 0.5, 1/4 = 0.25, 3/4 = 0.75, 1/5 = 0.2. Divide numerator by denominator to convert any fraction.' },
      { name: 'Addition and Subtraction of Decimals', order_index: 4, content: 'Align the decimal points. Add zeros if needed to make same number of decimal places. Then add or subtract normally.' },
      { name: 'Comparing Decimals', order_index: 5, content: 'Compare from left to right. 3.45 > 3.42 because at the hundredths place, 5 > 2.' },
    ],
  },
  {
    chapter_number: 8,
    name: 'Measurement',
    name_hindi: 'পরিমাপ',
    description: 'Length, weight, capacity — conversion and word problems',
    difficulty_level: 2,
    estimated_duration_minutes: 110,
    topics: [
      { name: 'Units of Length', order_index: 1, content: '1 km = 1000 m, 1 m = 100 cm, 1 cm = 10 mm. To convert bigger to smaller: multiply. Smaller to bigger: divide.' },
      { name: 'Units of Weight', order_index: 2, content: '1 kg = 1000 g, 1 g = 1000 mg. A mango weighs about 200 g. A bag of rice is 5 kg = 5000 g.' },
      { name: 'Units of Capacity', order_index: 3, content: '1 litre = 1000 ml, 1 kl = 1000 litres. A glass of water is about 250 ml. A bucket is about 15 litres.' },
      { name: 'Word Problems on Measurement', order_index: 4, content: 'Convert all values to the same unit before adding or subtracting. Always write the unit in your answer.' },
    ],
  },
  {
    chapter_number: 9,
    name: 'Time',
    name_hindi: 'সময়',
    description: 'Reading time, 24-hour clock, duration, calendar calculations',
    difficulty_level: 2,
    estimated_duration_minutes: 90,
    topics: [
      { name: '12-hour and 24-hour Clock', order_index: 1, content: '12-hour uses AM/PM. 24-hour uses 0000 to 2359. 1:30 PM = 13:30. 9:00 AM = 09:00. Midnight = 00:00.' },
      { name: 'Duration and Elapsed Time', order_index: 2, content: 'To find how long something took: subtract start time from end time. If a movie starts at 3:15 PM and ends at 5:00 PM, duration = 1 hour 45 minutes.' },
      { name: 'Calendar Calculations', order_index: 3, content: 'Days in each month: Jan=31, Feb=28/29, Mar=31, Apr=30, May=31, Jun=30, Jul=31, Aug=31, Sep=30, Oct=31, Nov=30, Dec=31. Leap year: divisible by 4.' },
    ],
  },
  {
    chapter_number: 10,
    name: 'Geometry — Lines and Angles',
    name_hindi: 'জ্যামিতি — রেখা ও কোণ',
    description: 'Types of lines, angles, triangles, and basic constructions',
    difficulty_level: 3,
    estimated_duration_minutes: 120,
    topics: [
      { name: 'Types of Lines', order_index: 1, content: 'Parallel lines never meet (railway tracks). Perpendicular lines meet at 90°. Intersecting lines cross at a point.' },
      { name: 'Types of Angles', order_index: 2, content: 'Acute: < 90°. Right: exactly 90°. Obtuse: between 90° and 180°. Straight: exactly 180°. Reflex: between 180° and 360°.' },
      { name: 'Triangles — Types and Properties', order_index: 3, content: 'By sides: Equilateral (all equal), Isosceles (2 equal), Scalene (none equal). By angles: Acute, Right, Obtuse. Sum of angles = 180°.' },
      { name: 'Measuring Angles with Protractor', order_index: 4, content: 'Place the center of the protractor on the vertex. Align one arm with the 0° line. Read the angle where the other arm crosses the scale.' },
    ],
  },
  {
    chapter_number: 11,
    name: 'Perimeter and Area',
    name_hindi: 'পরিসীমা ও ক্ষেত্রফল',
    description: 'Perimeter and area of rectangles, squares, and composite shapes',
    difficulty_level: 3,
    estimated_duration_minutes: 120,
    topics: [
      { name: 'Perimeter of Rectangles and Squares', order_index: 1, content: 'Perimeter of rectangle = 2 × (length + breadth). Perimeter of square = 4 × side. Perimeter is measured in cm, m, km.' },
      { name: 'Area of Rectangles and Squares', order_index: 2, content: 'Area of rectangle = length × breadth. Area of square = side × side. Area is measured in sq. cm, sq. m.' },
      { name: 'Composite Shapes', order_index: 3, content: 'Break complex shapes into rectangles and squares. Find the area of each part and add them together.' },
      { name: 'Word Problems on Perimeter and Area', order_index: 4, content: 'Fencing a garden → perimeter. Painting a wall → area. Tiling a floor → area. Walking around a park → perimeter.' },
    ],
  },
  {
    chapter_number: 12,
    name: 'Patterns and Symmetry',
    name_hindi: 'নকশা ও প্রতিসাম্য',
    description: 'Number patterns, shape patterns, line symmetry, tessellations',
    difficulty_level: 2,
    estimated_duration_minutes: 90,
    topics: [
      { name: 'Number Patterns', order_index: 1, content: 'Find the rule: 2, 4, 6, 8... (add 2). 1, 3, 9, 27... (multiply by 3). 100, 90, 80... (subtract 10). Look for what changes between consecutive terms.' },
      { name: 'Shape Patterns', order_index: 2, content: 'Patterns made with shapes, colors, or sizes that repeat. Identify the repeating unit and predict the next shape.' },
      { name: 'Line Symmetry', order_index: 3, content: 'A shape has line symmetry if one half is the mirror image of the other. A square has 4 lines of symmetry. A circle has infinite lines of symmetry.' },
    ],
  },
  {
    chapter_number: 13,
    name: 'Data Handling',
    name_hindi: 'তথ্য সংগ্রহ',
    description: 'Collecting data, tally marks, bar graphs, pictographs',
    difficulty_level: 2,
    estimated_duration_minutes: 100,
    topics: [
      { name: 'Collecting and Organizing Data', order_index: 1, content: 'Data is raw information. Organize using tally marks and frequency tables. Example: favourite fruits of classmates.' },
      { name: 'Bar Graphs', order_index: 2, content: 'Bar graphs use rectangular bars to show data. The height of each bar represents the value. Always label axes and give a title.' },
      { name: 'Pictographs', order_index: 3, content: 'Pictographs use pictures/symbols. Each symbol represents a fixed number. A key tells us the value of each symbol.' },
      { name: 'Reading and Interpreting Graphs', order_index: 4, content: 'Answer questions like: which is the most/least popular? What is the total? How much more is A than B? Use the graph data to compare and calculate.' },
    ],
  },
  {
    chapter_number: 14,
    name: 'Money',
    name_hindi: 'টাকা',
    description: 'Indian currency, bills, budgeting, profit and loss basics',
    difficulty_level: 2,
    estimated_duration_minutes: 90,
    topics: [
      { name: 'Indian Currency — Rupees and Paise', order_index: 1, content: '1 Rupee = 100 Paise. Notes: ₹10, ₹20, ₹50, ₹100, ₹200, ₹500. Coins: ₹1, ₹2, ₹5, ₹10. Writing: ₹45.50 means 45 rupees and 50 paise.' },
      { name: 'Making Bills and Totals', order_index: 2, content: 'Add prices of items to find total. Calculate change: Change = Amount paid − Total cost. Always align the decimal points when adding money.' },
      { name: 'Simple Budgeting', order_index: 3, content: 'A budget helps plan spending. List income and expenses. Income − Expenses = Savings. Example: Pocket money ₹100, spent ₹65, saved ₹35.' },
      { name: 'Profit and Loss Basics', order_index: 4, content: 'Profit = Selling Price − Cost Price (when SP > CP). Loss = Cost Price − Selling Price (when CP > SP). If a toy costs ₹80 and is sold for ₹100, profit = ₹20.' },
    ],
  },
];

// ============================================
// BENGALI — Sahaj Path / Amar Bangla Boi Class 5
// ============================================

const BENGALI_CHAPTERS = [
  {
    chapter_number: 1, name: 'পায়ে চলার পথ (The Walking Path)', description: 'Poem about nature and journeys',
    difficulty_level: 2, estimated_duration_minutes: 60,
    topics: [
      { name: 'কবিতা পাঠ ও ব্যাখ্যা', order_index: 1, content: 'Read the poem aloud with proper rhythm. Understand the meaning of each stanza. Identify the mood and theme.' },
      { name: 'শব্দার্থ ও বাক্য রচনা', order_index: 2, content: 'Learn new words from the poem and their meanings. Make sentences using these words.' },
    ],
  },
  {
    chapter_number: 2, name: 'আমাজনের জঙ্গলে (In the Amazon Jungle)', description: 'Adventure story about the Amazon rainforest',
    difficulty_level: 2, estimated_duration_minutes: 80,
    topics: [
      { name: 'গল্প পাঠ ও বোধ', order_index: 1, content: 'Read the story about the Amazon jungle. Understand the characters, setting, and main events.' },
      { name: 'প্রশ্নোত্তর', order_index: 2, content: 'Answer questions about the story — who, what, when, where, why.' },
      { name: 'বিপরীত শব্দ ও সমার্থক শব্দ', order_index: 3, content: 'Opposites (বিপরীত) and synonyms (সমার্থক) from the chapter.' },
    ],
  },
  {
    chapter_number: 3, name: 'ছুটি (Holiday)', description: 'A story about school holidays and childhood',
    difficulty_level: 2, estimated_duration_minutes: 60,
    topics: [
      { name: 'গল্প বিশ্লেষণ', order_index: 1, content: 'Analyze the story structure — beginning, middle, end. Discuss the theme of holidays.' },
      { name: 'ব্যাকরণ — বিশেষ্য ও বিশেষণ', order_index: 2, content: 'Nouns (বিশেষ্য) and adjectives (বিশেষণ) from the chapter. Identify and practice.' },
    ],
  },
  {
    chapter_number: 4, name: 'পাহাড়ের চিঠি (Letter from the Hills)', description: 'Letter writing about mountain travels',
    difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'পত্র লেখা', order_index: 1, content: 'Learn the format of informal letters in Bengali. Address, salutation, body, closing.' },
      { name: 'বর্ণনামূলক রচনা', order_index: 2, content: 'Descriptive writing about places, nature, and travel experiences.' },
    ],
  },
  {
    chapter_number: 5, name: 'রান্নাঘরে বিজ্ঞান (Science in the Kitchen)', description: 'Informational text about science in daily cooking',
    difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'তথ্যমূলক রচনা পাঠ', order_index: 1, content: 'Reading informational text. Distinguishing facts from opinions.' },
      { name: 'শব্দভাণ্ডার বৃদ্ধি', order_index: 2, content: 'Building vocabulary related to cooking, food, and science.' },
    ],
  },
  {
    chapter_number: 6, name: 'পদ্য — ফুল ফোটানো (Poem — Making Flowers Bloom)', description: 'Poem about flowers and nature',
    difficulty_level: 2, estimated_duration_minutes: 50,
    topics: [
      { name: 'কবিতা আবৃত্তি', order_index: 1, content: 'Recitation with proper intonation and expression. Understanding poetic devices.' },
      { name: 'কবিতার মূলভাব', order_index: 2, content: 'Central idea of the poem. How does the poet describe nature?' },
    ],
  },
  {
    chapter_number: 7, name: 'সাগরের ডাক (Call of the Sea)', description: 'Story about ocean adventures',
    difficulty_level: 3, estimated_duration_minutes: 80,
    topics: [
      { name: 'গদ্য পাঠ', order_index: 1, content: 'Reading prose with comprehension. Identifying main ideas and supporting details.' },
      { name: 'সক্রিয় ও কর্মবাচ্য', order_index: 2, content: 'Active and passive voice in Bengali. Practice transforming sentences.' },
    ],
  },
  {
    chapter_number: 8, name: 'পরিবেশ রক্ষা (Protecting the Environment)', description: 'Environmental awareness essay',
    difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'রচনা লেখা', order_index: 1, content: 'Essay writing on environmental topics. Introduction, body paragraphs, conclusion.' },
      { name: 'বাগধারা ও প্রবাদ', order_index: 2, content: 'Bengali idioms and proverbs related to nature and life lessons.' },
    ],
  },
  {
    chapter_number: 9, name: 'বাংলার মুখ (The Face of Bengal)', description: 'Poetry about Bengal\'s beauty',
    difficulty_level: 2, estimated_duration_minutes: 60,
    topics: [
      { name: 'কবিতা পাঠ', order_index: 1, content: 'Read and appreciate the beauty of Bengal described in poetry.' },
      { name: 'ছন্দ ও অলংকার', order_index: 2, content: 'Basic poetic meter and literary ornaments in Bengali poetry.' },
    ],
  },
  {
    chapter_number: 10, name: 'বিশ্বের সেরা গল্প (Best Stories of the World)', description: 'Translated world literature',
    difficulty_level: 3, estimated_duration_minutes: 80,
    topics: [
      { name: 'অনুবাদ সাহিত্য', order_index: 1, content: 'Translated literature from world classics. Understanding different cultures through stories.' },
      { name: 'চরিত্র বিশ্লেষণ', order_index: 2, content: 'Character analysis — traits, motivations, and development throughout the story.' },
    ],
  },
  {
    chapter_number: 11, name: 'ব্যাকরণ অনুশীলন (Grammar Practice)', description: 'Bengali grammar revision',
    difficulty_level: 3, estimated_duration_minutes: 100,
    topics: [
      { name: 'পদ প্রকরণ', order_index: 1, content: 'Parts of speech: বিশেষ্য (noun), সর্বনাম (pronoun), বিশেষণ (adjective), ক্রিয়া (verb), অব্যয় (adverb).' },
      { name: 'কারক ও বিভক্তি', order_index: 2, content: 'Cases and case-endings in Bengali grammar. How nouns change based on their role in a sentence.' },
      { name: 'সন্ধি বিচ্ছেদ', order_index: 3, content: 'Sandhi — the joining and splitting of words. স্বরসন্ধি, ব্যঞ্জনসন্ধি, বিসর্গসন্ধি.' },
    ],
  },
  {
    chapter_number: 12, name: 'রচনা ও প্রবন্ধ (Composition and Essay)', description: 'Creative writing and essays',
    difficulty_level: 3, estimated_duration_minutes: 90,
    topics: [
      { name: 'অনুচ্ছেদ রচনা', order_index: 1, content: 'Paragraph writing on various topics: my school, my favourite festival, a rainy day.' },
      { name: 'গল্প রচনা', order_index: 2, content: 'Story writing with beginning, middle, and end. Using dialogue and description.' },
      { name: 'চিঠিপত্র', order_index: 3, content: 'Formal and informal letter writing. Application to headmaster, letter to a friend.' },
    ],
  },
];

// ============================================
// ENGLISH — Bliss Class 5
// ============================================

const ENGLISH_CHAPTERS = [
  {
    chapter_number: 1, name: 'The Lazy Frog', description: 'Poem about a lazy frog and daily habits',
    difficulty_level: 1, estimated_duration_minutes: 50,
    topics: [
      { name: 'Reading the Poem', order_index: 1, content: 'Read the poem with expression. Understand the rhyme scheme and rhythm. What makes this poem funny?' },
      { name: 'Vocabulary and Comprehension', order_index: 2, content: 'New words from the poem. Answer questions: Who is the lazy frog? What does he do all day?' },
      { name: 'Grammar: Nouns and Pronouns', order_index: 3, content: 'Identify nouns (naming words) and pronouns (he, she, it, they) in the poem.' },
    ],
  },
  {
    chapter_number: 2, name: 'My Mango Tree', description: 'Story about a child\'s love for a mango tree',
    difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'Story Comprehension', order_index: 1, content: 'Read the story carefully. Who planted the mango tree? What happened over the years?' },
      { name: 'Grammar: Adjectives', order_index: 2, content: 'Adjectives describe nouns. Find all adjectives in the story: big, green, sweet, old, tall.' },
      { name: 'Creative Writing: My Favourite Tree', order_index: 3, content: 'Write a short paragraph about your favourite tree. Describe its size, shape, and why you like it.' },
    ],
  },
  {
    chapter_number: 3, name: 'The Little Fir Tree', description: 'A fir tree that wished for different leaves',
    difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'Reading and Understanding', order_index: 1, content: 'The fir tree was unhappy with its needle-like leaves and wished for different ones. What lessons can we learn from this story?' },
      { name: 'Grammar: Tenses — Past Simple', order_index: 2, content: 'Past simple tense: used for completed actions. Add -ed to regular verbs: walk → walked, play → played. Irregular: go → went, come → came.' },
    ],
  },
  {
    chapter_number: 4, name: 'Rip Van Winkle', description: 'Classic tale of a man who slept for 20 years',
    difficulty_level: 2, estimated_duration_minutes: 80,
    topics: [
      { name: 'Story Discussion', order_index: 1, content: 'Rip Van Winkle fell asleep in the mountains and woke up 20 years later. Discuss: What had changed? How did he feel?' },
      { name: 'Grammar: Prepositions', order_index: 2, content: 'Prepositions show position/direction: in, on, at, under, behind, between, across, through, near.' },
      { name: 'Vocabulary: Describing People', order_index: 3, content: 'Words to describe people: old, young, kind, lazy, curious, surprised, confused.' },
    ],
  },
  {
    chapter_number: 5, name: 'The Story of Proserpine', description: 'Greek myth about Proserpine and the seasons',
    difficulty_level: 3, estimated_duration_minutes: 80,
    topics: [
      { name: 'Myth and Legend', order_index: 1, content: 'Understanding myths: stories that explain natural phenomena. This myth explains why we have seasons.' },
      { name: 'Grammar: Conjunctions', order_index: 2, content: 'Conjunctions join words or sentences: and, but, or, so, because, although, when, if.' },
    ],
  },
  {
    chapter_number: 6, name: 'The Merchant of Venice (Adapted)', description: 'Simplified Shakespeare story about friendship and justice',
    difficulty_level: 3, estimated_duration_minutes: 90,
    topics: [
      { name: 'Story Elements', order_index: 1, content: 'Characters: Antonio, Shylock, Portia, Bassanio. Setting: Venice. Conflict: the bond and the trial.' },
      { name: 'Grammar: Direct and Indirect Speech', order_index: 2, content: 'Direct: He said, "I am happy." Indirect: He said that he was happy. Practice changing between the two.' },
    ],
  },
  {
    chapter_number: 7, name: 'The Happy Prince', description: 'Oscar Wilde\'s tale of a statue and a swallow',
    difficulty_level: 2, estimated_duration_minutes: 80,
    topics: [
      { name: 'Reading Comprehension', order_index: 1, content: 'The Happy Prince statue gives away his jewels and gold to help the poor. The swallow helps him. What is the moral?' },
      { name: 'Grammar: Articles — a, an, the', order_index: 2, content: 'Use "a" before consonant sounds, "an" before vowel sounds. "The" for specific things. "A boy, an elephant, the sun."' },
    ],
  },
  {
    chapter_number: 8, name: 'Clouds', description: 'Poem about clouds and imagination',
    difficulty_level: 1, estimated_duration_minutes: 50,
    topics: [
      { name: 'Poetry Appreciation', order_index: 1, content: 'What shapes does the poet see in clouds? What do you see when you look at clouds? Understanding similes and metaphors.' },
      { name: 'Grammar: Adverbs', order_index: 2, content: 'Adverbs describe verbs: slowly, quickly, happily, loudly, yesterday, here, very. They tell how, when, where.' },
    ],
  },
  {
    chapter_number: 9, name: 'All About a Dog', description: 'Humorous story about a dog on a bus',
    difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'Humour in Stories', order_index: 1, content: 'How does the author create humour? Funny situations, unexpected events, and character reactions.' },
      { name: 'Grammar: Question Forms', order_index: 2, content: 'Wh-questions: Who, What, When, Where, Why, How. Yes/No questions start with do/does/is/are/can.' },
    ],
  },
  {
    chapter_number: 10, name: 'Revision and Practice', description: 'Grammar revision, comprehension practice, creative writing',
    difficulty_level: 3, estimated_duration_minutes: 100,
    topics: [
      { name: 'Grammar Revision', order_index: 1, content: 'Review all grammar topics: tenses, parts of speech, articles, prepositions, conjunctions, speech.' },
      { name: 'Comprehension Practice', order_index: 2, content: 'Unseen passages with questions. Practice finding main ideas, making inferences, and vocabulary in context.' },
      { name: 'Essay and Letter Writing', order_index: 3, content: 'Write essays on familiar topics. Write letters to friends and formal letters to the principal.' },
    ],
  },
];

// ============================================
// AMADER PARIBESH (EVS) — Class 5
// ============================================

const EVS_CHAPTERS = [
  {
    chapter_number: 1, name: 'Our Body — The Wonderful Machine', name_hindi: 'আমাদের শরীর',
    description: 'Human body systems: digestive, respiratory, circulatory',
    difficulty_level: 2, estimated_duration_minutes: 100,
    topics: [
      { name: 'Digestive System', order_index: 1, content: 'Food goes: Mouth → Esophagus → Stomach → Small intestine → Large intestine. Stomach acids break down food. Small intestine absorbs nutrients.' },
      { name: 'Respiratory System', order_index: 2, content: 'We breathe in oxygen and breathe out carbon dioxide. Air path: Nose → Windpipe → Lungs. Lungs have tiny air sacs called alveoli.' },
      { name: 'Circulatory System', order_index: 3, content: 'Heart pumps blood. Arteries carry blood away from heart. Veins bring blood back. Blood carries oxygen and nutrients to all body parts.' },
    ],
  },
  {
    chapter_number: 2, name: 'Food and Nutrition', name_hindi: 'খাদ্য ও পুষ্টি',
    description: 'Balanced diet, nutrients, food preservation',
    difficulty_level: 2, estimated_duration_minutes: 90,
    topics: [
      { name: 'Nutrients in Our Food', order_index: 1, content: 'Carbohydrates (energy): rice, roti. Proteins (growth): dal, fish, eggs. Fats (energy storage): oil, butter. Vitamins & Minerals: fruits, vegetables. Water: essential for all body functions.' },
      { name: 'Balanced Diet', order_index: 2, content: 'A balanced diet includes all nutrients in the right amounts. Eat plenty of fruits and vegetables. Avoid too much junk food.' },
      { name: 'Food Preservation', order_index: 3, content: 'Methods: refrigeration, drying (shutki/dried fish), pickling (achar), adding salt/sugar. Food spoils due to bacteria and fungi.' },
    ],
  },
  {
    chapter_number: 3, name: 'Plants Around Us', name_hindi: 'আমাদের চারপাশের গাছপালা',
    description: 'Plant parts, photosynthesis, types of plants',
    difficulty_level: 2, estimated_duration_minutes: 90,
    topics: [
      { name: 'Parts of a Plant', order_index: 1, content: 'Root (absorbs water), Stem (transports water and food), Leaves (make food), Flower (reproduction), Fruit (contains seeds), Seed (grows into new plant).' },
      { name: 'Photosynthesis', order_index: 2, content: 'Leaves make food using sunlight, water, and carbon dioxide. This process is called photosynthesis. It releases oxygen. That is why trees are so important!' },
      { name: 'Types of Plants', order_index: 3, content: 'Trees (tall, woody: neem, mango), Shrubs (medium, bushy: rose, tulsi), Herbs (small, soft: coriander, mint), Climbers (need support: money plant), Creepers (grow on ground: pumpkin).' },
    ],
  },
  {
    chapter_number: 4, name: 'Animals and Their Habitats', name_hindi: 'প্রাণী ও তাদের বাসস্থান',
    description: 'Animal habitats, adaptation, food chains',
    difficulty_level: 2, estimated_duration_minutes: 100,
    topics: [
      { name: 'Different Habitats', order_index: 1, content: 'Forest: tiger, deer, monkey. Water: fish, frog, dolphin. Desert: camel, snake. Polar: polar bear, penguin. Animals adapt to survive in their habitats.' },
      { name: 'Adaptation', order_index: 2, content: 'Camel has padded feet for sand. Fish has gills for breathing underwater. Polar bear has thick fur for cold. Bengal tiger has stripes for camouflage in Sundarbans.' },
      { name: 'Food Chains', order_index: 3, content: 'Grass → Grasshopper → Frog → Snake → Eagle. Every living thing depends on others for food. If one link breaks, the whole chain is affected.' },
    ],
  },
  {
    chapter_number: 5, name: 'Water — Our Lifeline', name_hindi: 'জল — আমাদের জীবনরেখা',
    description: 'Water cycle, water conservation, water pollution',
    difficulty_level: 2, estimated_duration_minutes: 80,
    topics: [
      { name: 'The Water Cycle', order_index: 1, content: 'Evaporation (water → vapor) → Condensation (vapor → clouds) → Precipitation (rain/snow) → Collection (rivers, oceans). The cycle repeats endlessly.' },
      { name: 'Water Conservation', order_index: 2, content: 'Turn off taps when not in use. Fix leaking pipes. Use bucket instead of shower. Rainwater harvesting. Every drop counts!' },
      { name: 'Water Pollution', order_index: 3, content: 'Factory waste, sewage, and plastic pollute our rivers. The Ganga and Hooghly face severe pollution. Clean water is essential for health.' },
    ],
  },
  {
    chapter_number: 6, name: 'Air and Weather', name_hindi: 'বায়ু ও আবহাওয়া',
    description: 'Composition of air, weather, climate of Bengal',
    difficulty_level: 2, estimated_duration_minutes: 80,
    topics: [
      { name: 'What is Air Made Of?', order_index: 1, content: 'Air = 78% Nitrogen + 21% Oxygen + 1% other gases (CO₂, water vapor, etc). We need oxygen to breathe. Plants need CO₂ for photosynthesis.' },
      { name: 'Weather and Climate', order_index: 2, content: 'Weather changes daily. Climate is the average weather over many years. West Bengal has tropical climate: hot summers, monsoon rains, mild winters.' },
      { name: 'Air Pollution', order_index: 3, content: 'Causes: vehicle smoke, factory emissions, burning garbage. Effects: breathing problems, global warming. Solutions: plant trees, use public transport, reduce burning.' },
    ],
  },
  {
    chapter_number: 7, name: 'Soil and Rocks', name_hindi: 'মাটি ও পাথর',
    description: 'Types of soil, soil formation, importance of soil',
    difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'Types of Soil', order_index: 1, content: 'Sandy soil: loose, drains fast (found near coasts). Clay soil: sticky, holds water (found in Bengal plains). Loamy soil: best for farming (mix of sand, clay, humus).' },
      { name: 'Soil Formation and Erosion', order_index: 2, content: 'Rocks break down over millions of years due to wind, water, and temperature to form soil. Soil erosion: removal of topsoil by wind/water. Trees prevent erosion.' },
    ],
  },
  {
    chapter_number: 8, name: 'Our State — West Bengal', name_hindi: 'আমাদের রাজ্য — পশ্চিমবঙ্গ',
    description: 'Geography, districts, culture, and heritage of West Bengal',
    difficulty_level: 2, estimated_duration_minutes: 100,
    topics: [
      { name: 'Geography of West Bengal', order_index: 1, content: 'Capital: Kolkata. Bordered by: Bangladesh (east), Bihar & Jharkhand (west), Nepal & Sikkim (north), Odisha (south-west), Bay of Bengal (south). Regions: Darjeeling hills, Gangetic plains, Sundarbans delta.' },
      { name: 'Districts and Rivers', order_index: 2, content: 'Major rivers: Ganga (Hooghly), Teesta, Damodar, Ajay. 23 districts. Important cities: Kolkata, Siliguri, Asansol, Durgapur, Howrah.' },
      { name: 'Culture and Festivals', order_index: 3, content: 'Durga Puja (biggest festival), Kali Puja, Poush Mela, Rath Yatra, Baul music, Rabindra Sangeet. Famous people: Rabindranath Tagore, Subhas Chandra Bose, Satyajit Ray.' },
    ],
  },
  {
    chapter_number: 9, name: 'Transport and Communication', name_hindi: 'পরিবহন ও যোগাযোগ',
    description: 'Means of transport, communication past and present',
    difficulty_level: 1, estimated_duration_minutes: 70,
    topics: [
      { name: 'Means of Transport', order_index: 1, content: 'Road: bus, car, auto, cycle. Rail: train, metro (Kolkata Metro — first in India!). Water: boat, steamer, ship. Air: aeroplane, helicopter.' },
      { name: 'Communication — Then and Now', order_index: 2, content: 'Past: letters, pigeons, drums. Present: telephone, mobile, email, internet. Kolkata has one of India\'s oldest postal systems.' },
    ],
  },
  {
    chapter_number: 10, name: 'Simple Machines', name_hindi: 'সরল যন্ত্র',
    description: 'Lever, pulley, wheel, inclined plane',
    difficulty_level: 2, estimated_duration_minutes: 80,
    topics: [
      { name: 'What are Simple Machines?', order_index: 1, content: 'Simple machines make work easier. Six types: lever, pulley, wheel and axle, inclined plane, screw, wedge.' },
      { name: 'Lever and Pulley', order_index: 2, content: 'Lever: a rod that turns on a fixed point (fulcrum). Examples: see-saw, scissors. Pulley: a wheel with a rope. Used to draw water from wells and lift heavy loads.' },
      { name: 'Inclined Plane and Wheel', order_index: 3, content: 'Inclined plane (ramp): easier to push a box up a ramp than to lift it straight up. Wheel: reduces friction. Used in vehicles, carts, suitcases.' },
    ],
  },
  {
    chapter_number: 11, name: 'Safety and First Aid', name_hindi: 'নিরাপত্তা ও প্রাথমিক চিকিৎসা',
    description: 'Road safety, fire safety, basic first aid',
    difficulty_level: 1, estimated_duration_minutes: 60,
    topics: [
      { name: 'Road Safety', order_index: 1, content: 'Walk on footpath. Cross at zebra crossing. Look both ways. Wear helmet on bikes. Follow traffic signals. Never play on roads.' },
      { name: 'First Aid Basics', order_index: 2, content: 'Cuts: wash with clean water, apply antiseptic, bandage. Burns: cool with water for 10 minutes. Nosebleed: sit upright, pinch nose. Emergency numbers: 100 (police), 101 (fire), 108 (ambulance).' },
    ],
  },
  {
    chapter_number: 12, name: 'Our Environment — Let\'s Protect It', name_hindi: 'আমাদের পরিবেশ — সুরক্ষিত রাখি',
    description: 'Pollution, conservation, sustainable living',
    difficulty_level: 2, estimated_duration_minutes: 80,
    topics: [
      { name: 'Types of Pollution', order_index: 1, content: 'Air pollution: smoke, dust. Water pollution: chemicals, sewage. Soil pollution: pesticides, plastic. Noise pollution: horns, factories.' },
      { name: 'Reduce, Reuse, Recycle', order_index: 2, content: 'Reduce: use less plastic and paper. Reuse: use cloth bags instead of plastic. Recycle: paper, glass, metal can be recycled. Composting: kitchen waste becomes fertilizer.' },
      { name: 'Protecting the Sundarbans', order_index: 3, content: 'The Sundarbans is the world\'s largest mangrove forest. Home to the Royal Bengal Tiger. Threatened by climate change and rising sea levels. We must protect this UNESCO World Heritage Site.' },
    ],
  },
];

// ============================================
// HINDI — Class 5
// ============================================

const HINDI_CHAPTERS = [
  { chapter_number: 1, name: 'कोयल', description: 'कोयल पक्षी पर कविता', difficulty_level: 1, estimated_duration_minutes: 50,
    topics: [
      { name: 'कविता पाठ', order_index: 1, content: 'कविता को ध्यान से पढ़ें। कोयल कैसे गाती है? कवि क्या कहना चाहते हैं?' },
      { name: 'शब्दार्थ और वाक्य रचना', order_index: 2, content: 'नए शब्द सीखें और उनसे वाक्य बनाएं।' },
    ],
  },
  { chapter_number: 2, name: 'ईमानदार लकड़हारा', description: 'ईमानदारी पर कहानी', difficulty_level: 1, estimated_duration_minutes: 60,
    topics: [
      { name: 'कहानी पठन', order_index: 1, content: 'एक गरीब लकड़हारा नदी में अपनी कुल्हाड़ी गिरा देता है। जल देवता उसकी ईमानदारी से खुश होते हैं।' },
      { name: 'नैतिक शिक्षा', order_index: 2, content: 'कहानी का सबक: ईमानदारी सबसे अच्छी नीति है।' },
    ],
  },
  { chapter_number: 3, name: 'पत्र लेखन', description: 'औपचारिक और अनौपचारिक पत्र', difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'अनौपचारिक पत्र', order_index: 1, content: 'मित्र या परिवार को पत्र। प्रारूप: दिनांक, संबोधन, विषय, अभिवादन, मुख्य भाग, समापन।' },
      { name: 'औपचारिक पत्र', order_index: 2, content: 'प्रधानाचार्य को छुट्टी का आवेदन। प्रारूप: सेवा में, विषय, महोदय/महोदया, मुख्य भाग, धन्यवाद।' },
    ],
  },
  { chapter_number: 4, name: 'हमारा भारत', description: 'भारत देश के बारे में', difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'गद्य पाठ', order_index: 1, content: 'भारत विविधताओं का देश है। अनेक भाषाएं, धर्म, त्योहार और संस्कृतियां।' },
      { name: 'निबंध लेखन', order_index: 2, content: 'मेरा देश भारत पर निबंध लिखें। भूगोल, संस्कृति, एकता।' },
    ],
  },
  { chapter_number: 5, name: 'विलोम शब्द और पर्यायवाची', description: 'विपरीत अर्थ वाले शब्द और समान अर्थ वाले शब्द', difficulty_level: 2, estimated_duration_minutes: 60,
    topics: [
      { name: 'विलोम शब्द', order_index: 1, content: 'विलोम = विपरीत अर्थ। दिन-रात, सुख-दुख, आना-जाना, अच्छा-बुरा, ऊपर-नीचे।' },
      { name: 'पर्यायवाची शब्द', order_index: 2, content: 'पर्यायवाची = समान अर्थ। सूर्य = दिनकर, भानु, रवि। जल = पानी, नीर, वारि। पृथ्वी = धरती, भूमि, वसुधा।' },
    ],
  },
  { chapter_number: 6, name: 'मुहावरे और लोकोक्तियाँ', description: 'हिंदी मुहावरे और कहावतें', difficulty_level: 3, estimated_duration_minutes: 70,
    topics: [
      { name: 'मुहावरे', order_index: 1, content: 'आँखों का तारा = बहुत प्रिय। नौ दो ग्यारह होना = भाग जाना। हाथ-पैर मारना = बहुत कोशिश करना।' },
      { name: 'लोकोक्तियाँ', order_index: 2, content: 'जैसा बोओगे वैसा काटोगे। अंधों में काना राजा। बंदर क्या जाने अदरक का स्वाद।' },
    ],
  },
  { chapter_number: 7, name: 'क्रिया और काल', description: 'क्रिया के प्रकार और काल', difficulty_level: 3, estimated_duration_minutes: 80,
    topics: [
      { name: 'क्रिया के प्रकार', order_index: 1, content: 'सकर्मक क्रिया: कर्म की जरूरत (राम फल खाता है)। अकर्मक क्रिया: कर्म नहीं (बच्चा रोता है)।' },
      { name: 'काल — भूत, वर्तमान, भविष्य', order_index: 2, content: 'वर्तमान काल: राम पढ़ता है। भूतकाल: राम ने पढ़ा। भविष्यकाल: राम पढ़ेगा।' },
    ],
  },
  { chapter_number: 8, name: 'अनुच्छेद लेखन', description: 'विभिन्न विषयों पर अनुच्छेद', difficulty_level: 2, estimated_duration_minutes: 60,
    topics: [
      { name: 'अनुच्छेद लेखन अभ्यास', order_index: 1, content: 'विषय: मेरा विद्यालय, होली का त्योहार, मेरी माँ, वर्षा ऋतु। परिचय, मुख्य भाग, निष्कर्ष।' },
    ],
  },
  { chapter_number: 9, name: 'संज्ञा और सर्वनाम', description: 'संज्ञा के प्रकार और सर्वनाम', difficulty_level: 2, estimated_duration_minutes: 70,
    topics: [
      { name: 'संज्ञा', order_index: 1, content: 'व्यक्तिवाचक: राम, कोलकाता। जातिवाचक: लड़का, नदी। भाववाचक: ईमानदारी, सुंदरता।' },
      { name: 'सर्वनाम', order_index: 2, content: 'संज्ञा के बदले प्रयोग: मैं, तू, वह, हम, तुम, वे, यह, कौन, कोई।' },
    ],
  },
  { chapter_number: 10, name: 'अपठित गद्यांश', description: 'अनदेखे अनुच्छेद पढ़कर प्रश्नोत्तर', difficulty_level: 3, estimated_duration_minutes: 60,
    topics: [
      { name: 'गद्यांश अभ्यास', order_index: 1, content: 'अनदेखे अनुच्छेद पढ़ें। मुख्य विचार पहचानें। प्रश्नों के उत्तर दें। नए शब्दों के अर्थ संदर्भ से समझें।' },
    ],
  },
];

// ============================================
// HEALTH & PHYSICAL EDUCATION — Class 5
// ============================================

const HEALTH_PE_CHAPTERS = [
  { chapter_number: 1, name: 'Personal Hygiene', description: 'Cleanliness, dental care, handwashing',
    difficulty_level: 1, estimated_duration_minutes: 40,
    topics: [
      { name: 'Daily Hygiene Habits', order_index: 1, content: 'Bath daily. Brush teeth twice. Wash hands before eating and after using toilet. Keep nails trimmed. Wear clean clothes.' },
      { name: 'Dental Care', order_index: 2, content: 'Brush with fluoride toothpaste. Avoid too many sweets. Visit dentist every 6 months. Rinse mouth after meals.' },
    ],
  },
  { chapter_number: 2, name: 'Healthy Eating Habits', description: 'Good food habits, junk food awareness',
    difficulty_level: 1, estimated_duration_minutes: 40,
    topics: [
      { name: 'Good Food Habits', order_index: 1, content: 'Eat at regular times. Chew food properly. Drink plenty of water. Eat fruits and vegetables daily. Avoid skipping breakfast.' },
      { name: 'Say No to Junk Food', order_index: 2, content: 'Chips, cold drinks, and candies have little nutrition. They cause obesity, tooth decay, and stomach problems. Choose healthy snacks.' },
    ],
  },
  { chapter_number: 3, name: 'Yoga and Exercise', description: 'Basic yoga poses, importance of exercise',
    difficulty_level: 2, estimated_duration_minutes: 50,
    topics: [
      { name: 'Importance of Exercise', order_index: 1, content: 'Exercise makes bones and muscles strong. Improves concentration. Keeps heart healthy. At least 60 minutes of physical activity daily.' },
      { name: 'Basic Yoga Asanas', order_index: 2, content: 'Tadasana (Mountain Pose), Vrikshasana (Tree Pose), Bhujangasana (Cobra Pose), Padmasana (Lotus Pose), Shavasana (Corpse Pose for relaxation).' },
    ],
  },
  { chapter_number: 4, name: 'Games and Sports of Bengal', description: 'Traditional and modern sports',
    difficulty_level: 1, estimated_duration_minutes: 50,
    topics: [
      { name: 'Traditional Games', order_index: 1, content: 'Kabaddi, Kho-Kho, Gollachhut, Lathi Khela, Ha-du-du (traditional kabaddi of Bengal). These games need no equipment and promote teamwork.' },
      { name: 'Modern Sports', order_index: 2, content: 'Cricket, Football (Bengal is passionate about football!), Badminton, Athletics. Famous Bengal sports stars: Sourav Ganguly, P.K. Banerjee.' },
    ],
  },
  { chapter_number: 5, name: 'Common Diseases and Prevention', description: 'Waterborne, airborne diseases, vaccination',
    difficulty_level: 2, estimated_duration_minutes: 50,
    topics: [
      { name: 'Common Diseases', order_index: 1, content: 'Cold, cough, fever, dengue, malaria, cholera, typhoid. Causes: germs (bacteria, viruses), mosquitoes, dirty water/food.' },
      { name: 'Prevention and Vaccination', order_index: 2, content: 'Wash hands frequently. Drink clean/boiled water. Use mosquito nets. Get vaccinated. Vaccines protect against polio, measles, tetanus.' },
    ],
  },
  { chapter_number: 6, name: 'Mental Health and Emotions', description: 'Understanding feelings, stress management',
    difficulty_level: 2, estimated_duration_minutes: 40,
    topics: [
      { name: 'Understanding Emotions', order_index: 1, content: 'It is okay to feel happy, sad, angry, or scared. Sharing feelings with parents or teachers helps. Deep breathing calms you down.' },
      { name: 'Being Kind and Helpful', order_index: 2, content: 'Help classmates. Be kind to animals. Say sorry when wrong. Share with others. Good behaviour makes everyone happy.' },
    ],
  },
  { chapter_number: 7, name: 'Posture and Body Movement', description: 'Correct sitting, standing, lifting posture',
    difficulty_level: 1, estimated_duration_minutes: 40,
    topics: [
      { name: 'Good Posture', order_index: 1, content: 'Sit straight while studying. Keep feet flat on the floor. Hold the book at arm\'s length. Don\'t slouch. Good posture prevents back pain.' },
      { name: 'Safe Movements', order_index: 2, content: 'Bend knees when lifting heavy objects. Don\'t carry overloaded schoolbags. Stretch before playing sports.' },
    ],
  },
  { chapter_number: 8, name: 'First Aid and Emergency', description: 'Basic first aid, emergency contacts',
    difficulty_level: 2, estimated_duration_minutes: 50,
    topics: [
      { name: 'Basic First Aid', order_index: 1, content: 'Cuts: clean and bandage. Bee sting: remove stinger, apply ice. Fracture: don\'t move the person, call for help. Burns: cool with running water.' },
      { name: 'Emergency Preparedness', order_index: 2, content: 'Know your home address and parents\' phone numbers. Emergency: 112 (unified). Fire: 101. Ambulance: 108. Police: 100.' },
    ],
  },
];

// ============================================
// SAMPLE QUESTIONS — Class 5 WB Board
// ============================================

const SAMPLE_QUESTIONS = {
  math: [
    { question_text: 'Write 54,78,321 in words (Indian system).', question_type: 'short_answer', bloom_level: 'remember', difficulty: 'easy', correct_answer: 'Fifty-four lakh seventy-eight thousand three hundred twenty-one', explanation: 'In the Indian system: 54,78,321 = 54 lakh, 78 thousand, 3 hundred, 21.', xp_value: 10 },
    { question_text: 'What is the HCF of 12 and 18?', question_type: 'mcq', bloom_level: 'apply', difficulty: 'medium', options: ['2', '3', '6', '12'], correct_answer: '6', explanation: 'Factors of 12: 1,2,3,4,6,12. Factors of 18: 1,2,3,6,9,18. Common: 1,2,3,6. Highest = 6.', xp_value: 25 },
    { question_text: 'A rectangle has length 12 cm and breadth 8 cm. What is its area?', question_type: 'mcq', bloom_level: 'apply', difficulty: 'easy', options: ['20 sq cm', '40 sq cm', '96 sq cm', '80 sq cm'], correct_answer: '96 sq cm', explanation: 'Area = length × breadth = 12 × 8 = 96 sq cm.', xp_value: 20 },
    { question_text: 'Convert 3/4 to a decimal.', question_type: 'mcq', bloom_level: 'understand', difficulty: 'easy', options: ['0.25', '0.5', '0.75', '0.34'], correct_answer: '0.75', explanation: '3 ÷ 4 = 0.75', xp_value: 15 },
    { question_text: 'If a shopkeeper buys a toy for ₹80 and sells it for ₹100, what is his profit?', question_type: 'mcq', bloom_level: 'apply', difficulty: 'easy', options: ['₹10', '₹20', '₹80', '₹180'], correct_answer: '₹20', explanation: 'Profit = SP - CP = ₹100 - ₹80 = ₹20.', xp_value: 20 },
  ],
  evs: [
    { question_text: 'Which organ pumps blood in our body?', question_type: 'mcq', bloom_level: 'remember', difficulty: 'easy', options: ['Brain', 'Heart', 'Lungs', 'Stomach'], correct_answer: 'Heart', explanation: 'The heart is a muscular organ that pumps blood throughout the body via arteries and veins.', xp_value: 10 },
    { question_text: 'What is the capital of West Bengal?', question_type: 'mcq', bloom_level: 'remember', difficulty: 'easy', options: ['Siliguri', 'Durgapur', 'Kolkata', 'Howrah'], correct_answer: 'Kolkata', explanation: 'Kolkata is the capital of West Bengal, located on the banks of the river Hooghly.', xp_value: 10 },
    { question_text: 'The Sundarbans is famous for which animal?', question_type: 'mcq', bloom_level: 'remember', difficulty: 'easy', options: ['Elephant', 'Lion', 'Royal Bengal Tiger', 'Rhinoceros'], correct_answer: 'Royal Bengal Tiger', explanation: 'The Sundarbans, the world\'s largest mangrove forest, is home to the Royal Bengal Tiger.', xp_value: 10 },
    { question_text: 'What are the three R\'s of waste management?', question_type: 'short_answer', bloom_level: 'remember', difficulty: 'easy', correct_answer: 'Reduce, Reuse, Recycle', explanation: 'The 3Rs help manage waste and protect our environment.', xp_value: 15 },
  ],
  english: [
    { question_text: 'Which article should be used: ___ elephant?', question_type: 'mcq', bloom_level: 'apply', difficulty: 'easy', options: ['a', 'an', 'the', 'no article'], correct_answer: 'an', explanation: '"Elephant" starts with a vowel sound, so we use "an".', xp_value: 10 },
    { question_text: 'Change to past tense: "She goes to school."', question_type: 'mcq', bloom_level: 'apply', difficulty: 'easy', options: ['She goed to school.', 'She went to school.', 'She gone to school.', 'She go to school.'], correct_answer: 'She went to school.', explanation: '"Go" is an irregular verb. Past tense = "went".', xp_value: 15 },
  ],
};

// ============================================
// SEEDING FUNCTION
// ============================================

async function main() {
  console.log('🚀 Seeding Class 5 — West Bengal Board...\n');

  try {
    // 1. Ensure Class 5 exists
    console.log('📚 Ensuring Class 5 exists...');
    const { data: classData, error: classErr } = await supabase
      .from('classes')
      .upsert({ class_number: 5, name: 'Class 5' }, { onConflict: 'class_number' })
      .select()
      .single();

    if (classErr) throw new Error(`Class error: ${classErr.message}`);
    console.log(`✅ Class 5 ready (id: ${classData.id})`);

    // 2. Ensure WB Board exists
    console.log('🏛️ Ensuring West Bengal Board exists...');
    const { data: boardData, error: boardErr } = await supabase
      .from('education_boards')
      .select('*')
      .eq('code', 'wb_board')
      .single();

    if (boardErr) throw new Error(`Board error: ${boardErr.message}. Run migration 005 first.`);
    console.log(`✅ WB Board ready (id: ${boardData.id})`);

    // 3. Seed subjects
    console.log('📖 Seeding subjects...');
    const subjectRecords: any[] = [];

    for (const sub of WB_CLASS5_SUBJECTS) {
      const { data, error } = await supabase
        .from('subjects')
        .upsert({
          class_id: classData.id,
          name: sub.name,
          name_hindi: sub.name_hindi,
          code: sub.code,
          icon: sub.icon,
          color: sub.color,
          book_title: sub.book_title,
          book_code: sub.book_code,
          total_chapters: sub.total_chapters,
          is_active: true,
        }, { onConflict: 'class_id,name' })
        .select()
        .single();

      if (error) {
        console.error(`  ❌ Subject "${sub.name}": ${error.message}`);
        continue;
      }
      subjectRecords.push({ ...data, code: sub.code });
      console.log(`  ✅ ${sub.name}`);
    }

    // 4. Create board_syllabus mappings
    console.log('📋 Creating board-syllabus mappings...');
    for (const sub of subjectRecords) {
      await supabase.from('board_syllabus').upsert({
        board_id: boardData.id,
        class_id: classData.id,
        subject_id: sub.id,
        syllabus_year: '2024-25',
        is_active: true,
      }, { onConflict: 'board_id,class_id,subject_id,syllabus_year' });
    }
    console.log(`✅ ${subjectRecords.length} syllabus mappings created`);

    // 5. Seed chapters and topics
    const chapterMaps: Record<string, { code: string; chapters: any[] }> = {
      Mathematics: { code: 'math', chapters: MATH_CHAPTERS },
      Bengali: { code: 'bengali', chapters: BENGALI_CHAPTERS },
      English: { code: 'english', chapters: ENGLISH_CHAPTERS },
      'Amader Paribesh (EVS)': { code: 'evs', chapters: EVS_CHAPTERS },
      Hindi: { code: 'hindi', chapters: HINDI_CHAPTERS },
      'Health & Physical Education': { code: 'health_pe', chapters: HEALTH_PE_CHAPTERS },
    };

    let totalChapters = 0;
    let totalTopics = 0;

    for (const sub of subjectRecords) {
      const map = chapterMaps[sub.name];
      if (!map) continue;

      console.log(`\n📑 Seeding ${sub.name} chapters...`);

      for (const ch of map.chapters) {
        // Insert chapter
        const { data: chData, error: chErr } = await supabase
          .from('chapters')
          .upsert({
            subject_id: sub.id,
            chapter_number: ch.chapter_number,
            name: ch.name,
            name_hindi: ch.name_hindi || null,
            description: ch.description,
            difficulty_level: ch.difficulty_level,
            estimated_duration_minutes: ch.estimated_duration_minutes,
          }, { onConflict: 'subject_id,chapter_number' })
          .select()
          .single();

        if (chErr) {
          console.error(`  ❌ Ch ${ch.chapter_number}: ${chErr.message}`);
          continue;
        }

        totalChapters++;

        // Insert topics
        if (ch.topics) {
          for (const topic of ch.topics) {
            const { error: topicErr } = await supabase
              .from('topics')
              .upsert({
                chapter_id: chData.id,
                name: topic.name,
                order_index: topic.order_index,
                content: topic.content,
              }, { onConflict: 'chapter_id,order_index' });

            if (!topicErr) totalTopics++;
          }
        }

        console.log(`  ✅ Ch ${ch.chapter_number}: ${ch.name} (${ch.topics?.length || 0} topics)`);
      }
    }

    // 6. Seed sample questions
    console.log('\n❓ Seeding sample questions...');
    let totalQuestions = 0;

    for (const [subCode, questions] of Object.entries(SAMPLE_QUESTIONS)) {
      const subject = subjectRecords.find(s => s.code === subCode);
      if (!subject) continue;

      // Get first chapter for this subject
      const { data: firstChapter } = await supabase
        .from('chapters')
        .select('id')
        .eq('subject_id', subject.id)
        .order('chapter_number')
        .limit(1)
        .single();

      if (!firstChapter) continue;

      for (const q of questions) {
        const { error: qErr } = await supabase
          .from('questions')
          .insert({
            chapter_id: firstChapter.id,
            question_text: q.question_text,
            question_type: q.question_type,
            bloom_level: q.bloom_level,
            difficulty: q.difficulty,
            options: (q as any).options || null,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            xp_value: q.xp_value,
          });

        if (!qErr) totalQuestions++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Class 5 West Bengal Board — Seeding Complete!');
    console.log('='.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   Board: West Bengal (WBBPE)`);
    console.log(`   Class: 5`);
    console.log(`   Subjects: ${subjectRecords.length}`);
    console.log(`   Chapters: ${totalChapters}`);
    console.log(`   Topics: ${totalTopics}`);
    console.log(`   Questions: ${totalQuestions}`);
    console.log(`   Syllabus Year: 2024-25`);

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
