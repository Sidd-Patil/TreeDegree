// scripts/generateMajorCourseJson.ts
import fs from "node:fs";
import path from "node:path";

/** ---------- Your UI types ---------- */
type CourseStatus = "completed" | "available" | "locked";

type SampleCourse = {
  id: string;                 // e.g. "pstat_120a"
  label: string;              // e.g. "PSTAT 120A"
  title: string;              // from catalog
  units: number;              // from catalog
  status: CourseStatus;       // computed from completed list
  prerequisites: string[];    // course IDs (NOT labels)
  unlocksCount?: number;
  prerequisiteCount?: number; // number of prerequisites remaining (no transcript => total prereqs)
};

/** ---------- Catalog JSON ---------- */
type CatalogCourse = {
  subject: string;
  number: string;
  code: string; // "PSTAT 5A"
  title: string;
  units: string; // "5"
  prerequisites_raw: string | null;
};

/** ---------- Major requirements JSON (minimal, typed) ---------- */
type MajorRequirementsFile = MajorRequirementDoc[];

type MajorRequirementDoc = {
  program: { major_name: string };
  requirements: RequirementNode[];
};

type RequirementNode =
  | { type: "requirement_group"; id?: string; operator: "AND" | "OR"; title?: string; children: RequirementNode[] }
  | { type: "course"; course_id: string; units?: number }
  | { type: "course_list"; courses: string[]; title?: string }
  | { type: "course_sequence"; subject: string; courses: string[] }
  | { type: "choose_units"; from: { courses?: string[]; rule?: string; subject?: string } }
  | { type: "choose_one"; from: string[] }
  | { type: "choose_one_sequence"; options: Array<{ type: "course_sequence"; subject: string; courses: string[] }> }
  | { type: "choose_courses"; from: { courses?: string[]; either?: Array<{ courses?: string[]; ref_requirement_id?: string }> } };

/** ---------- Normalization helpers ---------- */
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
const normReqCourseId = (id: string) => norm(id.replace("-", " ")); // "PSTAT-120A" -> "PSTAT 120A"

const courseIdFromCode = (code: string) => {
  // "PSTAT 120A" -> "pstat_120a"
  const t = norm(code);
  return t.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "");
};

function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

/** ---------- Collect courses referenced by major requirements ---------- */
function collectCoursesFromReq(node: RequirementNode, out: Set<string>) {
  switch (node.type) {
    case "course":
      out.add(normReqCourseId(node.course_id));
      return;

    case "course_list":
      node.courses.forEach((c) => out.add(normReqCourseId(c)));
      return;

    case "course_sequence":
      node.courses.forEach((num) => out.add(norm(`${node.subject} ${num}`)));
      return;

    case "choose_units":
      node.from.courses?.forEach((c) => out.add(normReqCourseId(c)));
      return;

    case "choose_one":
      node.from.forEach((c) => out.add(normReqCourseId(c)));
      return;

    case "choose_one_sequence":
      node.options.forEach((opt) => collectCoursesFromReq(opt, out));
      return;

    case "choose_courses":
      node.from.courses?.forEach((c) => out.add(normReqCourseId(c)));
      node.from.either?.forEach((opt) => opt.courses?.forEach((c) => out.add(normReqCourseId(c))));
      return;

    case "requirement_group":
      node.children.forEach((child) => collectCoursesFromReq(child, out));
      return;

    default: {
      const _exhaustive: never = node;
      return _exhaustive;
    }
  }
}

/** ---------- Prereq parsing (MVP) ----------
 * Extracts course codes like "MATH 3A", "PSTAT 120A" from prerequisites_raw.
 * (Doesn't represent AND/OR logic; it just links all mentioned courses.)
 */
function extractPrereqCodes(text: string, validCodes: Set<string>) {
  const t = norm(text);
  const re = /\b([A-Z&]{2,10})\s+(\d{1,3}[A-Z]{0,3})\b/g;

  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const code = norm(`${m[1]} ${m[2]}`);
    if (validCodes.has(code)) out.add(code);
  }
  return [...out];
}

/** ---------- Generate one major ---------- */
function buildMajorCourses(params: {
  major: MajorRequirementDoc;
  catalog: CatalogCourse[];
  completed?: string[]; // list of course codes like "PSTAT 10"
  depthLimit?: number;
}) {
  const { major, catalog } = params;
  const depthLimit = params.depthLimit ?? 12;

  const completedSet = new Set((params.completed ?? []).map(norm));

  // catalog index
  const idx = new Map<string, CatalogCourse>();
  for (const c of catalog) idx.set(norm(c.code), c);
  const validCodes = new Set(idx.keys());

  // prereq map
  const prereqMap = new Map<string, string[]>();
  for (const code of validCodes) {
    const c = idx.get(code);
    prereqMap.set(code, c?.prerequisites_raw ? extractPrereqCodes(c.prerequisites_raw, validCodes) : []);
  }

  // required courses (from major reqs)
  const required = new Set<string>();
  major.requirements.forEach((r) => collectCoursesFromReq(r as RequirementNode, required));

  // expand prereq ancestors
  const all = new Set<string>(required);
  const prereqEdges: Array<{ from: string; to: string }> = [];

  function dfs(code: string, depth: number, stack: Set<string>) {
    if (depth > depthLimit) return;
    if (stack.has(code)) return;
    stack.add(code);

    const prereqs = prereqMap.get(code) ?? [];
    for (const p of prereqs) {
      all.add(p);
      prereqEdges.push({ from: p, to: code });
      dfs(p, depth + 1, stack);
    }
    stack.delete(code);
  }

  [...required].forEach((c) => dfs(c, 0, new Set()));

  // Build SampleCourse list
  const courses: SampleCourse[] = [];
  const codeToId = new Map<string, string>();
  for (const code of all) codeToId.set(code, courseIdFromCode(code));

  // Count unlocks for bottlenecks
  const unlockCounts: Record<string, number> = {};
  for (const e of prereqEdges) {
    const fromId = codeToId.get(e.from)!;
    unlockCounts[fromId] = (unlockCounts[fromId] ?? 0) + 1;
  }

  function computeStatus(code: string): CourseStatus {
    if (completedSet.has(code)) return "completed";
    const prereqs = prereqMap.get(code) ?? [];
    const missing = prereqs.filter((p) => !completedSet.has(p));
    if (missing.length === 0) return "available";
    return "locked";
  }

  for (const code of all) {
    const c = idx.get(code);

    const prereqCodes = prereqMap.get(code) ?? [];
    const prereqIds = prereqCodes.map((p) => codeToId.get(p)).filter((x): x is string => !!x);

    const id = codeToId.get(code)!;
    const baseStatus = computeStatus(code);

    courses.push({
      id,
      label: code, // already like "PSTAT 120A"
      title: c?.title ?? "",
      units: c?.units ? Number(c.units) : 0,
      status: baseStatus,
      prerequisites: prereqIds,
      unlocksCount: unlockCounts[id] ?? 0,
      prerequisiteCount: prereqIds.length,
    });
  }

  // Optional: stable ordering (nice diffs)
  courses.sort((a, b) => a.label.localeCompare(b.label));

  return courses;
}

function slugifyMajorName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** ---------- Main CLI ---------- */
function main() {
  const coursesPath = path.resolve("src/data/courses.json");
  const majorsPath = path.resolve("src/data/major-requirements.json");
  const outDir = path.resolve("src/data/generated-majors");

  const catalog = readJson<CatalogCourse[]>(coursesPath);
  const majors = readJson<MajorRequirementsFile>(majorsPath);

  fs.mkdirSync(outDir, { recursive: true });

  for (const major of majors) {
    const out = buildMajorCourses({
      major,
      catalog,
      completed: [], // later: wire transcript -> completed list
      depthLimit: 12,
    });

    const file = `${slugifyMajorName(major.program.major_name)}.json`;
    fs.writeFileSync(path.join(outDir, file), JSON.stringify(out, null, 2), "utf-8");
    console.log(`Wrote ${file} (${out.length} courses)`);
  }
}

main();
