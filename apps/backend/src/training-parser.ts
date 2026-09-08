export type TrainingParse = { result: 'PASSED' | 'FAILED' | 'UNKNOWN'; items: { type: 'EXAM' | 'LECTURE'; description: string; status: 'COMPLETED' | 'FAILED' | 'UNKNOWN' }[] };

function status(value: string): 'COMPLETED' | 'FAILED' | 'UNKNOWN' { const text = value.toLowerCase(); if (/❌|не\s+сдан|не\s+сдал/.test(text)) return 'FAILED'; if (/✅|☑|успешно\s+сдан|\bсдан\b|\bсдал\b/.test(text)) return 'COMPLETED'; return 'UNKNOWN'; }

/** First Discord mention is the instructor; second is the student. Each checklist line is an exam only when it contains "экзамен", otherwise it is a lecture/training activity. */
export function parseTrainingMessage(text: string): TrainingParse { const items = text.split(/\r?\n/).flatMap((line) => { const match = /^\s*(.+?)\s*:\s*(.+?)\s*$/.exec(line); if (!match) return []; const description = match[1].trim(); return [{ type: /экзамен/i.test(description) ? 'EXAM' as const : 'LECTURE' as const, description, status: status(match[2]) }]; }); const exam = items.find((item) => item.type === 'EXAM'); return { result: exam?.status === 'COMPLETED' ? 'PASSED' : exam?.status === 'FAILED' ? 'FAILED' : 'UNKNOWN', items }; }
