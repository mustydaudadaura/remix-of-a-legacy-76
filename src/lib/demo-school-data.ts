// Complete School Data with Sessions and Terms per Session
// Fully aligned with Nigerian NERDC, Federal Ministry of Education, and National single-page A4 standard formats

export interface DemoSubjectScore {
  id: string;
  subject_id: string;
  subjects: { name: string; code: string };
  ca1: number;
  ca2: number;
  ca_total: number;
  exam: number;
  total: number;
  first_term_total?: number;
  second_term_total?: number;
  third_term_total?: number;
  session_average?: number;
  grade: string;
  remark: string;
  subject_position: number;
  class_avg: number;
}

export interface DemoReportCard {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  session: "2024/2025" | "2025/2026";
  term: "first" | "second" | "third";
  total_score: number;
  total_obtainable: number;
  average: number;
  gpa: number;
  position: number;
  class_size: number;
  published: boolean;
  verification_code: string;
  days_total: number;
  days_present: number;
  days_absent: number;
  term_beginning: string;
  term_ending: string;
  next_resumption_date: string;
  teacher_name: string;
  teacher_remark: string;
  principal_name: string;
  principal_remark: string;
  status_verdict: string;
  affective: Record<string, number>;
  psychomotor: Record<string, number>;
  created_at: string;
  schools: any;
  students: any;
  classes: any;
  assessments: DemoSubjectScore[];
}

export const DEMO_SCHOOL_PROFILE = {
  id: "af91ff67-95eb-4b62-93a0-5617d23a2f1d",
  name: "EduERP National Academy",
  code: "EDUERAP",
  motto: "EXCELLENCE AND INTEGRITY",
  address: "",
  phone: "",
  email: "",
  website: "",
  branch_name: "",
  principal_name: "Head Teacher / Principal",
  logo_url: "",
  stamp_url: "",
  principal_signature_url: "",
  current_session: "2025/2026",
  current_term: "third",
  theme_color: "#1e3a8a",
  report_template: {
    template_type: "eduerp_national",
    border: "navy",
    heading: "navy",
    table: "navy",
    positions: "both",
  },
};

export const DEMO_STUDENTS = [
  {
    id: "19589251-064f-48d3-8483-735002ff7886",
    admission_no: "03/1643",
    first_name: "KIRIKU VICTORY",
    middle_name: "",
    last_name: "ENORENSE",
    gender: "male",
    dob: "2004-02-02",
    club: "SCRABBLE, JETS, DEBATE",
    house: "Diamond House",
    class_id: "class-2a-id",
    class_name: "CLASS 2A",
    class_level: "Primary",
    photo_url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&h=240&fit=crop&crop=faces",
  },
  {
    id: "student-zainab-bello",
    admission_no: "ALG/2025/001",
    first_name: "Zainab",
    middle_name: "Khadija",
    last_name: "Bello",
    gender: "female",
    dob: "2014-06-12",
    club: "PRESS & LITERARY CLUB",
    house: "Emerald House",
    class_id: "class-pri5-id",
    class_name: "Primary 5 Gold",
    class_level: "Primary",
    photo_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=240&fit=crop&crop=faces",
  },
  {
    id: "student-farouk-bello",
    admission_no: "ALG/2025/002",
    first_name: "Farouk",
    middle_name: "Ahmed",
    last_name: "Bello",
    gender: "male",
    dob: "2012-09-20",
    club: "JETS & STEM CLUB",
    house: "Emerald House",
    class_id: "class-jss1-id",
    class_name: "JSS 1 Diamond",
    class_level: "JSS 1",
    photo_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=240&fit=crop&crop=faces",
  },
  {
    id: "student-chukwudi-adeleke",
    admission_no: "ALG/2025/003",
    first_name: "Chukwudi",
    middle_name: "Ibrahim",
    last_name: "Adeleke",
    gender: "male",
    dob: "2010-04-15",
    club: "DEBATING & QUIZ SOCIETY",
    house: "Ruby House",
    class_id: "class-ss1-id",
    class_name: "SS 1 Science",
    class_level: "SSS 1",
    photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=240&fit=crop&crop=faces",
  },
];

export const DEMO_CORE_SUBJECTS = [
  { name: "AGRICULTURAL SCIENCE", code: "AGR", baseAvg: 64.5 },
  { name: "BASIC SCIENCE", code: "BSC", baseAvg: 64.3 },
  { name: "BASIC TECHNOLOGY", code: "BST", baseAvg: 63.3 },
  { name: "CIVIC EDUCATION", code: "CIV", baseAvg: 63.1 },
  { name: "CULTURAL & CREATIVE ARTS", code: "CCA", baseAvg: 61.5 },
  { name: "ENGLISH STUDIES", code: "ENG", baseAvg: 62.4 },
  { name: "FRENCH", code: "FRN", baseAvg: 61.3 },
  { name: "HOME ECONOMICS", code: "HEC", baseAvg: 64.5 },
  { name: "INFO. & COMM. TECHNOLOGY", code: "ICT", baseAvg: 63.9 },
  { name: "MATHEMATICS", code: "MTH", baseAvg: 63.4 },
  { name: "PHONICS", code: "PHO", baseAvg: 63.3 },
  { name: "PHYSICAL & HEALTH EDUCATION", code: "PHE", baseAvg: 63.1 },
  { name: "RELIGIOUS STUDIES", code: "IRS", baseAvg: 63.1 },
  { name: "SECURITY EDUCATION", code: "SEC", baseAvg: 64.4 },
  { name: "SOCIAL STUDIES", code: "SOS", baseAvg: 63.5 },
  { name: "YORUBA LANGUAGE", code: "YOR", baseAvg: 64.0 },
];

function getGradeAndRemark(total: number): { grade: string; remark: string } {
  if (total >= 95) return { grade: "A+", remark: "EXCEPTIONAL" };
  if (total >= 90) return { grade: "A", remark: "DISTINCTION" };
  if (total >= 85) return { grade: "A-", remark: "EXCELLENT" };
  if (total >= 80) return { grade: "B+", remark: "VERY GOOD" };
  if (total >= 75) return { grade: "B", remark: "UPPER CREDIT" };
  if (total >= 70) return { grade: "B-", remark: "BELOW STANDARD" };
  if (total >= 60) return { grade: "C+", remark: "GOOD" };
  if (total >= 40) return { grade: "D", remark: "AVERAGE" };
  return { grade: "F", remark: "PASS" };
}

export function generateDemoSessionsData(): DemoReportCard[] {
  const SESSIONS: Array<"2024/2025" | "2025/2026"> = ["2024/2025", "2025/2026"];
  const TERMS: Array<"first" | "second" | "third"> = ["first", "second", "third"];

  const results: DemoReportCard[] = [];

  for (const student of DEMO_STUDENTS) {
    for (const session of SESSIONS) {
      // Keep track of terms in session for cumulative calculation
      const termScoresMap = new Map<string, Record<string, number>>();

      for (const term of TERMS) {
        const isLatest = session === "2025/2026" && term === "third";
        const isKiriku = student.admission_no === "03/1643";
        const isZainab = student.admission_no === "ALG/2025/001";

        const termOffset = term === "first" ? 0 : term === "second" ? 2 : 4;
        const sessionOffset = session === "2024/2025" ? 0 : 3;
        const seedBase = student.first_name.charCodeAt(0) + termOffset + sessionOffset;

        const subjectAssessments: DemoSubjectScore[] = DEMO_CORE_SUBJECTS.map((subj, sIdx) => {
          let ca1 = 0;
          let exam = 0;
          let total = 0;

          if (isKiriku && isLatest) {
            // Exact sample matches from the national pupil performance report card sample
            const sampleExactScores: Record<string, { ca: number; exam: number; t3: number; t2: number; t1: number; pos: number }> = {
              "AGRICULTURAL SCIENCE": { ca: 26, exam: 21, t3: 47, t2: 47, t1: 48, pos: 9 },
              "BASIC SCIENCE": { ca: 30.5, exam: 34, t3: 64.5, t2: 61, t1: 59, pos: 8 },
              "BASIC TECHNOLOGY": { ca: 26, exam: 21, t3: 47, t2: 66, t1: 67, pos: 8 },
              "CIVIC EDUCATION": { ca: 23, exam: 43, t3: 66, t2: 66, t1: 70, pos: 4 },
              "CULTURAL & CREATIVE ARTS": { ca: 27, exam: 43, t3: 70, t2: 70, t1: 66, pos: 3 },
              "ENGLISH STUDIES": { ca: 22, exam: 43, t3: 65, t2: 53, t1: 51, pos: 8 },
              "FRENCH": { ca: 21, exam: 43, t3: 64, t2: 64, t1: 68, pos: 3 },
              "HOME ECONOMICS": { ca: 27, exam: 21, t3: 48, t2: 48, t1: 60, pos: 9 },
              "INFO. & COMM. TECHNOLOGY": { ca: 22, exam: 34, t3: 56, t2: 56, t1: 45, pos: 10 },
              "MATHEMATICS": { ca: 23, exam: 34, t3: 57, t2: 57, t1: 54, pos: 8 },
              "PHONICS": { ca: 23, exam: 21, t3: 44, t2: 44, t1: 42, pos: 10 },
              "PHYSICAL & HEALTH EDUCATION": { ca: 19, exam: 34, t3: 53, t2: 65, t1: 69, pos: 6 },
              "RELIGIOUS STUDIES": { ca: 23, exam: 43, t3: 66, t2: 66, t1: 65, pos: 5 },
              "SECURITY EDUCATION": { ca: 26, exam: 34, t3: 60, t2: 60, t1: 57, pos: 8 },
              "SOCIAL STUDIES": { ca: 23, exam: 43, t3: 66, t2: 47, t1: 48, pos: 10 },
              "YORUBA LANGUAGE": { ca: 25, exam: 34, t3: 59, t2: 59, t1: 56, pos: 8 },
            };

            const sample = sampleExactScores[subj.name] || { ca: 24, exam: 35, t3: 59, t2: 58, t1: 55, pos: 7 };
            ca1 = sample.ca;
            exam = sample.exam;
            total = sample.t3;
            const t1 = sample.t1;
            const t2 = sample.t2;
            const t3 = sample.t3;
            const sessionAvg = Number(((t1 + t2 + t3) / 3).toFixed(1));
            const gr = getGradeAndRemark(total);

            return {
              id: `assessment-${student.id}-${session}-${term}-${sIdx}`,
              subject_id: `subj-${subj.code.toLowerCase()}`,
              subjects: { name: subj.name, code: subj.code },
              ca1: Math.round(ca1 / 2),
              ca2: Math.round(ca1 / 2),
              ca_total: ca1,
              exam,
              total,
              first_term_total: t1,
              second_term_total: t2,
              third_term_total: t3,
              session_average: sessionAvg,
              grade: gr.grade,
              remark: gr.remark,
              subject_position: sample.pos,
              class_avg: subj.baseAvg,
            };
          }

          // Dynamic calculation for other terms / students
          const v = (seedBase * (sIdx + 3)) % 25;
          const highPerformer = isZainab;
          if (highPerformer) {
            ca1 = 16 + (v % 4);
            const ca2 = 17 + (v % 3);
            exam = 48 + (v % 11);
            total = ca1 + ca2 + exam;
          } else {
            ca1 = 12 + (v % 5);
            const ca2 = 13 + (v % 4);
            exam = 32 + (v % 18);
            total = ca1 + ca2 + exam;
          }

          const t1Score = Math.max(40, total - (term === "first" ? 0 : 4));
          const t2Score = Math.max(42, total - (term === "third" ? 2 : 0));
          const t3Score = total;
          const sessionAvg = Number(((t1Score + t2Score + t3Score) / 3).toFixed(1));
          const gr = getGradeAndRemark(total);

          const pos = highPerformer ? 1 + (sIdx % 3) : 3 + (v % 9);

          return {
            id: `assessment-${student.id}-${session}-${term}-${sIdx}`,
            subject_id: `subj-${subj.code.toLowerCase()}`,
            subjects: { name: subj.name, code: subj.code },
            ca1,
            ca2: Math.round(ca1 * 0.95),
            ca_total: ca1 + Math.round(ca1 * 0.95),
            exam,
            total,
            first_term_total: t1Score,
            second_term_total: t2Score,
            third_term_total: t3Score,
            session_average: sessionAvg,
            grade: gr.grade,
            remark: gr.remark,
            subject_position: pos,
            class_avg: subj.baseAvg,
          };
        });

        // Store term scores
        const scoreDict: Record<string, number> = {};
        subjectAssessments.forEach((sa) => {
          scoreDict[sa.subjects.name] = sa.total;
        });
        termScoresMap.set(term, scoreDict);

        const totalObtainable = subjectAssessments.length * 100;
        const totalScore = Number(subjectAssessments.reduce((acc, curr) => acc + curr.total, 0).toFixed(2));
        const average = Number((totalScore / subjectAssessments.length).toFixed(1));
        const gpa = Number((average / 20).toFixed(2));

        // Positions: Kiriku in sample is 12th out of 21 with 58.1% (928.83/1600)
        let position = 1;
        let classSize = 21;
        if (isKiriku && isLatest) {
          position = 12;
          classSize = 21;
        } else if (isZainab) {
          position = term === "third" ? 1 : 2;
          classSize = 30;
        } else {
          position = 5 + (seedBase % 8);
          classSize = 25;
        }

        const dateYear = session.split("/")[term === "third" ? 1 : 0];
        const termDates: Record<string, { start: string; end: string; next: string }> = {
          first: {
            start: `18/09/${dateYear}`,
            end: `15/12/${dateYear}`,
            next: `08/01/${parseInt(dateYear, 10) + 1}`,
          },
          second: {
            start: `09/01/${dateYear}`,
            end: `05/04/${dateYear}`,
            next: `25/04/${dateYear}`,
          },
          third: {
            start: `25/04/${dateYear}`,
            end: `22/07/${dateYear}`,
            next: `14/09/${dateYear}`,
          },
        };

        const reportId = `report-${student.id}-${session.replace("/", "_")}-${term}`;
        const verCode = `AK-${session.slice(2, 4)}${session.slice(7, 9)}-${term[0].toUpperCase()}-${student.admission_no.replace(/[^A-Za-z0-9]/g, "")}`;

        results.push({
          id: reportId,
          school_id: DEMO_SCHOOL_PROFILE.id,
          student_id: student.id,
          class_id: student.class_id,
          session,
          term,
          total_score: totalScore,
          total_obtainable: totalObtainable,
          average,
          gpa,
          position,
          class_size: classSize,
          published: true,
          verification_code: verCode,
          days_total: 134,
          days_present: 130 - (seedBase % 5),
          days_absent: 4 + (seedBase % 5),
          term_beginning: termDates[term].start,
          term_ending: termDates[term].end,
          next_resumption_date: termDates[term].next,
          teacher_name: "MR ADIGUN TIMILEYIN",
          teacher_remark:
            average >= 80
              ? "An exceptional and highly focused student. Consistently tops academic discussions and shows wonderful peer leadership."
              : average >= 60
              ? "A hardworking, diligent student. Demonstrates steady improvement and active curiosity in class."
              : "Kiriku is a diligent, studious student and always Funny. Always inquisitive and ready to learn..",
          principal_name: "MR OWOLABI BADMOS",
          principal_remark:
            average >= 75
              ? "Distinguished academic accomplishment. Keep up the high standard of excellence!"
              : average >= 55
              ? "A Very Good Result!!.. Keep it Up!"
              : "Fair progress made. Encourage more home reading and consistent revision.",
          status_verdict: term === "third" ? "PROMOTED TO NEXT CLASS" : "CONTINUING",
          affective: {
            Attentiveness: 5,
            Honesty: 5,
            Neatness: 4,
            Politeness: 4,
            "Punctuality/ Assembly": 5,
            "Self Control/ Calmness": 4,
            Obedience: 4,
            Reliability: 4,
            "Sense Of Responsibility": 4,
            "Relationship With Others": 3,
          },
          psychomotor: {
            "Handling Of Tools": 4,
            "Drawing/ Painting": 4,
            Handwriting: 4,
            "Public Speaking": 4,
            "Speech Fluency": 4,
            "Sports & Games": 3,
          },
          created_at: `${dateYear}-${term === "first" ? "12-15" : term === "second" ? "04-05" : "07-22"}T10:00:00.000Z`,
          schools: DEMO_SCHOOL_PROFILE,
          students: student,
          classes: {
            id: student.class_id,
            name: student.class_name,
            arm: "A",
            level: student.class_level,
            section: "primary",
          },
          assessments: subjectAssessments,
        });
      }
    }
  }

  return results;
}

export const ALL_DEMO_REPORT_CARDS = generateDemoSessionsData();

export function findDemoReportCard(id: string): DemoReportCard | undefined {
  const exact = ALL_DEMO_REPORT_CARDS.find((r) => r.id === id);
  if (exact) return exact;
  // If id is random UUID or unknown, return the third-term 2025/2026 Kiriku performance report card as realistic default
  return ALL_DEMO_REPORT_CARDS[0];
}
