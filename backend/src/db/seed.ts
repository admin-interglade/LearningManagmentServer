import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { pool, query, queryOne } from './pool';
import { runMigrations } from './migrate';

type Complexity = 'low' | 'medium' | 'high';
type BankQ = [Complexity, string, [string, string, string, string], number, string];

const GK: BankQ[] = [
  ['low', 'What is the capital of India?', ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'], 1, 'New Delhi is the capital of India.'],
  ['low', 'How many days are there in a leap year?', ['365', '366', '364', '360'], 1, 'A leap year has 366 days.'],
  ['low', 'Which planet is known as the Red Planet?', ['Venus', 'Jupiter', 'Mars', 'Saturn'], 2, 'Mars appears red due to iron oxide.'],
  ['low', 'What is the national animal of India?', ['Lion', 'Elephant', 'Tiger', 'Peacock'], 2, 'The Bengal tiger is the national animal.'],
  ['low', 'How many continents are there?', ['5', '6', '7', '8'], 2, 'There are seven continents.'],
  ['low', 'Which gas do plants absorb from the air?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], 1, 'Plants use CO₂ for photosynthesis.'],
  ['medium', 'Who wrote the national anthem of India?', ['Bankim Chandra Chatterjee', 'Rabindranath Tagore', 'Sarojini Naidu', 'Subramania Bharati'], 1, 'Jana Gana Mana was written by Rabindranath Tagore.'],
  ['medium', 'Which is the longest river in India?', ['Yamuna', 'Godavari', 'Ganga', 'Brahmaputra'], 2, 'The Ganga is the longest river flowing within India.'],
  ['medium', 'What is the chemical symbol for gold?', ['Go', 'Gd', 'Au', 'Ag'], 2, 'Au comes from the Latin "aurum".'],
  ['medium', 'Which organ purifies blood in the human body?', ['Heart', 'Kidney', 'Lungs', 'Stomach'], 1, 'Kidneys filter waste from the blood.'],
  ['medium', 'In which year did India become independent?', ['1945', '1947', '1950', '1942'], 1, 'India became independent on 15 August 1947.'],
  ['high', 'Who was the first Indian to win a Nobel Prize?', ['C. V. Raman', 'Rabindranath Tagore', 'Mother Teresa', 'Amartya Sen'], 1, 'Tagore won the Nobel Prize in Literature in 1913.'],
  ['high', 'What is the SI unit of electric current?', ['Volt', 'Ohm', 'Ampere', 'Watt'], 2, 'Current is measured in amperes.'],
  ['high', 'Which article of the Indian Constitution abolishes untouchability?', ['Article 14', 'Article 17', 'Article 21', 'Article 32'], 1, 'Article 17 abolishes untouchability.'],
  ['high', 'Which is the smallest unit of life?', ['Tissue', 'Organ', 'Cell', 'Atom'], 2, 'The cell is the basic unit of life.'],
];

const ENGLISH: BankQ[] = [
  ['low', 'Choose the plural of "child".', ['Childs', 'Children', 'Childes', 'Childrens'], 1, '"Children" is the irregular plural.'],
  ['low', 'Which word is a noun?', ['Run', 'Happy', 'Table', 'Quickly'], 2, 'A table is a thing — a noun.'],
  ['low', 'Pick the opposite of "hot".', ['Warm', 'Cold', 'Boil', 'Heat'], 1, 'Cold is the antonym of hot.'],
  ['low', 'Fill in: She ___ to school every day.', ['go', 'goes', 'going', 'gone'], 1, 'Third person singular takes "goes".'],
  ['low', 'Which is a vowel?', ['B', 'C', 'E', 'D'], 2, 'A, E, I, O, U are vowels.'],
  ['medium', 'Choose the synonym of "brave".', ['Coward', 'Courageous', 'Weak', 'Afraid'], 1, 'Courageous means brave.'],
  ['medium', 'Identify the adverb: "He ran quickly to the bus."', ['He', 'ran', 'quickly', 'bus'], 2, '"Quickly" describes how he ran.'],
  ['medium', 'Fill in: I have lived here ___ 2015.', ['for', 'since', 'from', 'by'], 1, '"Since" is used with a point in time.'],
  ['medium', 'Which sentence is correct?', ['He don\'t like tea.', 'He doesn\'t likes tea.', 'He doesn\'t like tea.', 'He not like tea.'], 2, 'Use "doesn\'t" + base verb.'],
  ['medium', 'Choose the correctly spelt word.', ['Recieve', 'Receive', 'Receeve', 'Receve'], 1, '"I before E except after C".'],
  ['high', 'Choose the meaning of the idiom "break the ice".', ['To start a conversation', 'To break something', 'To feel cold', 'To stop talking'], 0, 'It means to ease tension and start talking.'],
  ['high', 'Change to passive: "They built this bridge."', ['This bridge is built by them.', 'This bridge was built by them.', 'This bridge has built by them.', 'This bridge were built by them.'], 1, 'Simple past passive: was/were + past participle.'],
  ['high', 'Choose the antonym of "benevolent".', ['Kind', 'Generous', 'Malevolent', 'Charitable'], 2, 'Malevolent means wishing harm.'],
  ['high', 'Identify the figure of speech: "The wind whispered."', ['Simile', 'Metaphor', 'Personification', 'Hyperbole'], 2, 'Human qualities are given to the wind.'],
  ['high', 'Fill in: If I ___ you, I would apologise.', ['am', 'was', 'were', 'be'], 2, 'Subjunctive "were" in hypothetical conditionals.'],
];

const SCIENCE: BankQ[] = [
  ['low', 'Which part of the plant makes food?', ['Root', 'Stem', 'Leaf', 'Flower'], 2, 'Leaves make food by photosynthesis.'],
  ['low', 'Water freezes at what temperature (°C)?', ['0', '10', '100', '-10'], 0, 'Pure water freezes at 0 °C.'],
  ['low', 'Which sense organ is used to smell?', ['Eyes', 'Nose', 'Ears', 'Tongue'], 1, 'We smell with the nose.'],
  ['low', 'What do we call animals that eat only plants?', ['Carnivores', 'Omnivores', 'Herbivores', 'Decomposers'], 2, 'Herbivores eat only plants.'],
  ['low', 'Which is the closest star to the Earth?', ['Sirius', 'The Sun', 'Polaris', 'Alpha Centauri'], 1, 'The Sun is our nearest star.'],
  ['medium', 'What is the boiling point of water at sea level (°C)?', ['90', '100', '110', '120'], 1, 'Water boils at 100 °C at sea level.'],
  ['medium', 'Which blood cells help fight infection?', ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma'], 1, 'White blood cells defend the body.'],
  ['medium', 'Which gas is most abundant in the Earth\'s atmosphere?', ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], 2, 'Air is about 78% nitrogen.'],
  ['medium', 'What is the unit of force?', ['Joule', 'Newton', 'Watt', 'Pascal'], 1, 'Force is measured in newtons.'],
  ['medium', 'Which planet has the most prominent rings?', ['Mars', 'Jupiter', 'Saturn', 'Mercury'], 2, 'Saturn\'s rings are the most visible.'],
  ['high', 'What is the chemical formula of common salt?', ['KCl', 'NaCl', 'CaCO3', 'NaOH'], 1, 'Sodium chloride is NaCl.'],
  ['high', 'Which organelle is called the powerhouse of the cell?', ['Nucleus', 'Ribosome', 'Mitochondrion', 'Golgi body'], 2, 'Mitochondria release energy.'],
  ['high', 'Speed of light in vacuum is about?', ['3 × 10^5 m/s', '3 × 10^8 m/s', '3 × 10^10 m/s', '3 × 10^6 m/s'], 1, 'About 300,000 km/s.'],
  ['high', 'Which lens is used to correct short-sightedness?', ['Convex', 'Concave', 'Bifocal', 'Cylindrical'], 1, 'A concave lens diverges light for myopia.'],
  ['high', 'What is the pH of pure water at 25 °C?', ['5', '7', '9', '14'], 1, 'Pure water is neutral, pH 7.'],
];

const COMPUTERS: BankQ[] = [
  ['low', 'Which device is used to type text?', ['Mouse', 'Keyboard', 'Monitor', 'Speaker'], 1, 'Text is typed with a keyboard.'],
  ['low', 'Which of these is an output device?', ['Scanner', 'Keyboard', 'Printer', 'Microphone'], 2, 'A printer produces output.'],
  ['low', 'What is the brain of the computer?', ['RAM', 'CPU', 'Hard disk', 'Monitor'], 1, 'The CPU processes instructions.'],
  ['low', 'Which key removes the character to the left of the cursor?', ['Delete', 'Backspace', 'Shift', 'Enter'], 1, 'Backspace deletes to the left.'],
  ['low', 'Which of these is a web browser?', ['Windows', 'Chrome', 'Excel', 'Paint'], 1, 'Chrome is a web browser.'],
  ['medium', 'How many bits make one byte?', ['4', '8', '16', '32'], 1, 'One byte is 8 bits.'],
  ['medium', 'What does "URL" stand for?', ['Uniform Resource Locator', 'Universal Response Link', 'Unified Routing Line', 'User Resource Login'], 0, 'URL = Uniform Resource Locator.'],
  ['medium', 'Which memory is lost when the power is switched off?', ['ROM', 'RAM', 'Hard disk', 'Pen drive'], 1, 'RAM is volatile.'],
  ['medium', 'Which file extension is used for a web page?', ['.exe', '.html', '.mp3', '.jpg'], 1, 'Web pages use .html.'],
  ['medium', 'Ctrl + C is used to?', ['Cut', 'Copy', 'Paste', 'Close'], 1, 'Ctrl + C copies the selection.'],
  ['high', 'What is 1010 in binary equal to in decimal?', ['8', '10', '12', '5'], 1, '8 + 2 = 10.'],
  ['high', 'Which of these is not a programming language?', ['Python', 'Java', 'HTML', 'C++'], 2, 'HTML is a markup language.'],
  ['high', 'What does "CPU" stand for?', ['Central Processing Unit', 'Computer Power Unit', 'Core Program Utility', 'Central Program Unit'], 0, 'CPU = Central Processing Unit.'],
  ['high', 'Which protocol secures web traffic?', ['HTTP', 'FTP', 'HTTPS', 'SMTP'], 2, 'HTTPS encrypts traffic with TLS.'],
  ['high', 'Which data structure works on First-In-First-Out?', ['Stack', 'Queue', 'Tree', 'Graph'], 1, 'A queue is FIFO.'],
];

const days = (n: number) => new Date(Date.now() + n * 86_400_000);
const hours = (n: number) => new Date(Date.now() + n * 3_600_000);

type Cx = 'low' | 'medium' | 'high';
/** [category, complexity, questionCount, marksPerQuestion] */
type SectionSeed = [string, Cx, number, number];
interface LevelSeed { name: string; attempts: number; duration: number; pass: number; sections: SectionSeed[]; slots: [Date, Date, number][] }

async function seed() {
  await runMigrations();

  // Admin
  const hash = await bcrypt.hash(env.adminPassword, 10);
  await query(
    `INSERT INTO users (role, full_name, email, password_hash) VALUES ('admin', 'Interglade Admin', $1, $2)
     ON CONFLICT (email) DO NOTHING`,
    [env.adminEmail.toLowerCase(), hash],
  );

  // Categories are created by migration 002; look them up by name.
  const cats = await query<{ id: string; name: string }>('SELECT id, name FROM question_categories');
  const catIds: Record<string, string> = Object.fromEntries(cats.map((c) => [c.name, c.id]));

  // Question bank: fill each bank category that is still empty.
  for (const [cat, list] of [['General Knowledge', GK], ['English', ENGLISH], ['Science', SCIENCE], ['Computers', COMPUTERS]] as const) {
    const have = await queryOne<{ n: number }>('SELECT count(*) AS n FROM questions WHERE category_id = $1', [catIds[cat]]);
    if (have!.n > 0) continue;
    for (const [cx, text, options, correct, explanation] of list) {
      await query(
        'INSERT INTO questions (category_id, complexity, text, options, correct_index, explanation) VALUES ($1,$2,$3,$4,$5,$6)',
        [catIds[cat], cx, text, JSON.stringify(options), correct, explanation],
      );
    }
  }

  // Demo exams (only when none exist): one in progress, one future, one completed.
  const examCount = await queryOne<{ n: number }>('SELECT count(*) AS n FROM exams');
  if (examCount!.n === 0) {
    const demo: {
      title: string; award: string; description: string; ageMin: number | null; ageMax: number | null;
      regStart: Date; regEnd: Date; examStart: Date; examEnd: Date; fee: number; levels: LevelSeed[];
    }[] = [
      {
        title: 'Interglade Maths Olympiad 2026', award: 'Gold medal + ₹10,000 scholarship for the top scorer',
        description: 'A three-level maths challenge for school students. Clear each level to unlock the next.',
        ageMin: 8, ageMax: 16, regStart: days(-10), regEnd: days(20), examStart: days(-1), examEnd: days(30), fee: 499,
        levels: [
          { name: 'Level 1 — Foundation', attempts: 5, duration: 30, pass: 40,
            sections: [['Mathematics', 'low', 10, 1], ['Logical Reasoning', 'low', 5, 1]],
            slots: [[hours(-1), days(15), 500], [days(15), days(30), 500]] },
          { name: 'Level 2 — Intermediate', attempts: 3, duration: 30, pass: 50,
            sections: [['Mathematics', 'medium', 10, 2]],
            slots: [[hours(-1), days(15), 500], [days(15), days(30), 500]] },
          { name: 'Level 3 — Advanced', attempts: 2, duration: 45, pass: 0,
            sections: [['Mathematics', 'high', 10, 2], ['Logical Reasoning', 'high', 5, 2]],
            slots: [[days(2), days(30), 500]] },
        ],
      },
      {
        title: 'Young Minds Aptitude Challenge', award: 'Certificates + trophies for top 10',
        description: 'Reasoning, general knowledge and science for curious young minds.',
        ageMin: null, ageMax: null, regStart: days(-2), regEnd: days(40), examStart: days(45), examEnd: days(50), fee: 299,
        levels: [
          { name: 'Level 1 — Reasoning', attempts: 3, duration: 20, pass: 50,
            sections: [['Logical Reasoning', 'low', 10, 1], ['General Knowledge', 'low', 5, 1]],
            slots: [[days(45), days(46), 200], [days(46), days(47), 200]] },
          { name: 'Level 2 — Knowledge', attempts: 2, duration: 25, pass: 0,
            sections: [['General Knowledge', 'medium', 5, 2], ['Science', 'medium', 5, 2], ['English', 'medium', 5, 2]],
            slots: [[days(48), days(50), 200]] },
        ],
      },
      {
        title: 'Interglade Science & Computers Quiz — Summer 2026', award: '₹5,000 for the winner',
        description: 'A one-level quiz on science and computers.',
        ageMin: 10, ageMax: 18, regStart: days(-60), regEnd: days(-35), examStart: days(-30), examEnd: days(-25), fee: 0,
        levels: [
          { name: 'Level 1 — Quiz', attempts: 2, duration: 20, pass: 40,
            sections: [['Science', 'low', 5, 1], ['Computers', 'low', 5, 1]],
            slots: [[days(-30), days(-25), 300]] },
        ],
      },
    ];

    for (const e of demo) {
      const exam = await queryOne<{ id: string }>(
        `INSERT INTO exams (title, description, age_min, age_max, registration_start, registration_end, exam_start, exam_end,
           duration_minutes, fee, award, practice_attempts, practice_question_count, is_published)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,30,$9,$10,3,10,true) RETURNING id`,
        [e.title, e.description, e.ageMin, e.ageMax, e.regStart, e.regEnd, e.examStart, e.examEnd, e.fee, e.award],
      );
      for (const [i, l] of e.levels.entries()) {
        const level = await queryOne<{ id: string }>(
          `INSERT INTO exam_levels (exam_id, level_number, name, max_attempts, pass_percentage, duration_minutes)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [exam!.id, i + 1, l.name, l.attempts, l.pass, l.duration],
        );
        for (const [j, [cat, cx, count, marks]] of l.sections.entries()) {
          await query(
            `INSERT INTO level_sections (level_id, position, category_id, complexity, question_count, marks_per_question)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [level!.id, j + 1, catIds[cat], cx, count, marks],
          );
        }
        for (const [start, end, cap] of l.slots) {
          await query('INSERT INTO exam_slots (exam_id, level_id, start_at, end_at, capacity) VALUES ($1,$2,$3,$4,$5)',
            [exam!.id, level!.id, start, end, cap]);
        }
      }
    }
    await query(
      `INSERT INTO discounts (code, label, type, value, valid_from, valid_to, max_uses)
       VALUES ('EARLY20', 'Early bird 20% off', 'percent', 20, now(), now() + interval '60 days', 500)`,
    );
  }

  console.log(`Seed complete. Admin login: ${env.adminEmail} / ${env.adminPassword}`);
}

seed()
  .then(() => pool.end())
  .catch((err) => { console.error(err); process.exit(1); });
