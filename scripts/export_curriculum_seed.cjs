const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const defaultOutput = path.join(root, 'supabase', 'private-import', 'curriculum')
const outputDir = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length) ?? defaultOutput
const chunkSize = Number(process.argv.find(arg => arg.startsWith('--chunk-size='))?.slice('--chunk-size='.length) ?? 80)

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  module._compile(compiled, filename)
}

const { lessonTemplates: hsk20 } = require(path.join(root, 'src', 'data', 'curriculum.ts'))
const { hsk30LessonTemplates: hsk30 } = require(path.join(root, 'src', 'data', 'hsk30Curriculum.ts'))
const lessons = [...hsk20, ...hsk30].map(lesson => ({
  ...lesson,
  standard_code: lesson.system === '2.0' ? 'hsk20' : 'hsk30',
  level_category: lesson.officialLevelCategory,
  course_level: lesson.level,
  chapter_order: lesson.chapter,
  lesson_part: lesson.part,
  duration_minutes: lesson.minutes,
}))

const sqlText = value => `'${String(value).replaceAll("'", "''")}'`
const jsonSql = value => `${sqlText(JSON.stringify(value))}::jsonb`
const textArraySql = value => `array[${value.map(sqlText).join(', ')}]::text[]`
const rows = lessons.map(lesson => `  (
    ${sqlText(lesson.id)}, ${sqlText(lesson.standard_code)}, ${lesson.course_level},
    ${sqlText(lesson.level_category)}, ${lesson.chapter_order}, ${lesson.lesson_part},
    ${sqlText(lesson.title)}, ${textArraySql(lesson.keywords)},
    ${jsonSql(lesson.grammar)}, ${lesson.duration_minutes}
  )`)

const blueprints = []
const addBlueprint = (standard, level, counts, parts, minutes) => {
  blueprints.push({
    exam_key: standard === 'hsk30' && level === '7-9' ? 'hsk30-7-9' : `${standard}-${level}`,
    standard_code: standard,
    level_category: String(level),
    section_counts: counts,
    section_parts: parts,
    duration_minutes: minutes,
    is_combined_band: level === '7-9',
    assessment_note: 'Original HanziPath practice questions follow the publicly listed section format. This is a training mock, not an official CTI exam paper; Chinese responses marked for review need a teacher or fluent-speaker check.',
  })
}
const formats = [
  [1, 20, [5, 5, 5, 5], 20, [5, 5, 5, 5], 0, [], 35],
  [2, 35, [10, 10, 10, 5], 25, [5, 5, 5, 10], 0, [], 50],
  [3, 40, [10, 10, 10, 10], 30, [10, 10, 10], 10, [5, 5], 85],
  [4, 45, [10, 15, 20], 40, [10, 10, 20], 15, [10, 5], 100],
  [5, 45, [20, 25], 45, [15, 10, 20], 10, [8, 2], 120],
  [6, 50, [15, 15, 20], 50, [10, 10, 10, 20], 1, [1], 135],
]
for (const standard of ['hsk20', 'hsk30']) {
  for (const [level, listening, listeningParts, reading, readingParts, writing, writingParts, minutes] of formats) {
    addBlueprint(standard, level, { listening, reading, writing, translation: 0, speaking: 0 }, { listening: listeningParts, reading: readingParts, writing: writingParts, translation: [], speaking: [] }, minutes)
  }
}
addBlueprint('hsk30', '7-9', { listening: 40, reading: 40, writing: 2, translation: 4, speaking: 5 }, {
  listening: [10, 12, 18], reading: [21, 5, 14], writing: [1, 1], translation: [2, 2], speaking: [1, 3, 1],
}, 200)

const blueprintRows = blueprints.map(exam => `  (
    ${sqlText(exam.exam_key)}, ${sqlText(exam.standard_code)}, ${sqlText(exam.level_category)},
    ${jsonSql(exam.section_counts)}, ${jsonSql(exam.section_parts)}, ${exam.duration_minutes},
    ${exam.is_combined_band}, ${sqlText(exam.assessment_note)}
  )`)

fs.mkdirSync(outputDir, { recursive: true })
for (const name of fs.readdirSync(outputDir)) {
  if (/^lessons-\d+\.sql$|^exam-blueprints\.sql$/.test(name)) fs.rmSync(path.join(outputDir, name))
}
for (let offset = 0, part = 1; offset < rows.length; offset += chunkSize, part += 1) {
  const chunk = rows.slice(offset, offset + chunkSize)
  const sql = `-- Private candidate seed: ${offset + 1}-${offset + chunk.length} of ${rows.length} original lessons.
insert into public.curriculum_lessons (
  lesson_key, standard_code, course_level, level_category, chapter_order, lesson_part,
  title, keywords, grammar, duration_minutes, source_id, is_publishable
)
select r.lesson_key, r.standard_code, r.course_level, r.level_category, r.chapter_order,
       r.lesson_part, r.title, r.keywords, r.grammar, r.duration_minutes,
       source.id, false
from (values
${chunk.join(',\n')}
) as r(lesson_key, standard_code, course_level, level_category, chapter_order, lesson_part, title, keywords, grammar, duration_minutes)
cross join public.data_sources as source
where source.name = 'HanziPath original curriculum'
  and source.source_url = 'https://github.com/SUHROB06/HanziPath'
on conflict (lesson_key) do update set
  standard_code = excluded.standard_code,
  course_level = excluded.course_level,
  level_category = excluded.level_category,
  chapter_order = excluded.chapter_order,
  lesson_part = excluded.lesson_part,
  title = excluded.title,
  keywords = excluded.keywords,
  grammar = excluded.grammar,
  duration_minutes = excluded.duration_minutes,
  source_id = excluded.source_id,
  is_publishable = false,
  updated_at = now();
`
  fs.writeFileSync(path.join(outputDir, `lessons-${String(part).padStart(2, '0')}.sql`), sql, 'utf8')
}

const examsSql = `-- Private candidate seed: original mock-exam blueprints, not official papers.
insert into public.course_exam_blueprints (
  exam_key, standard_code, level_category, section_counts, section_parts,
  duration_minutes, is_combined_band, assessment_note, source_id, is_publishable
)
select r.exam_key, r.standard_code, r.level_category, r.section_counts,
       r.section_parts, r.duration_minutes, r.is_combined_band, r.assessment_note,
       source.id, false
from (values
${blueprintRows.join(',\n')}
) as r(exam_key, standard_code, level_category, section_counts, section_parts, duration_minutes, is_combined_band, assessment_note)
cross join public.data_sources as source
where source.name = 'HanziPath original curriculum'
  and source.source_url = 'https://github.com/SUHROB06/HanziPath'
on conflict (exam_key) do update set
  section_counts = excluded.section_counts,
  section_parts = excluded.section_parts,
  duration_minutes = excluded.duration_minutes,
  is_combined_band = excluded.is_combined_band,
  assessment_note = excluded.assessment_note,
  source_id = excluded.source_id,
  is_publishable = false,
  updated_at = now();
`
fs.writeFileSync(path.join(outputDir, 'exam-blueprints.sql'), examsSql, 'utf8')

console.log(JSON.stringify({ outputDir, hsk20Lessons: hsk20.length, hsk30Lessons: hsk30.length, lessonFiles: Math.ceil(rows.length / chunkSize), examBlueprints: blueprints.length }))
