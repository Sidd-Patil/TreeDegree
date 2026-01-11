// src/data/majorGraphBuilder.ts
import type { GeneratedCourse } from "@/data/majorToFlow";

type MajorDoc = any;

type CatalogCourse = {
  subject: string;
  number: string;
  code?: string;
  title?: string;
  units?: string;
  prerequisites_raw?: string | null;
};

export function toSlug(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function canonCourseId(subject: string, number: string) {
  return `${subject.toUpperCase()}-${String(number).toUpperCase().replace(/\s+/g, "")}`;
}

const SUBJECT_NAME_TO_CODE: Record<string, string> = {
  math: "MATH",
  mathematics: "MATH",
  statistics: "PSTAT",
  "computer science": "CMPSC",
  econ: "ECON",
  economics: "ECON",
  physics: "PHYS",
  engr: "ENGR",
  engineering: "ENGR",
  ece: "ECE",
};

function unitsToNumber(units: string | undefined): number {
  if (!units) return 0;
  const m = units.match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!m) return 0;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return Math.max(a, b);
}

// Parses prereqs_raw into canonical IDs like "MATH-3A", "PSTAT-120A"
function parsePrereqsRaw(prereqsRaw: string | null | undefined) {
  if (!prereqsRaw) return [];
  const text = prereqsRaw;
  const found = new Set<string>();

  // "PSTAT 120A", "PSTATW 160A"
  for (const m of text.matchAll(/\b([A-Z]{2,7})\s*([0-9]{1,3}[A-Z]{0,2})\b/g)) {
    const subject = m[1];
    const number = m[2];
    found.add(canonCourseId(subject, number));
    if (subject.endsWith("W")) found.add(canonCourseId(subject.slice(0, -1), number));
  }

  // "Math 3C", "Computer Science 8", etc.
  for (const m of text.matchAll(
    /\b(Math|Mathematics|Statistics|Computer Science|Economics|Econ|Physics|Engr|Engineering|ECE)\s*([0-9]{1,3}[A-Z]{0,2})\b/gi
  )) {
    const name = m[1].toLowerCase();
    const number = m[2];
    const code = SUBJECT_NAME_TO_CODE[name];
    if (code) found.add(canonCourseId(code, number));
  }

  return [...found];
}

function inferDivision(courseId: string): "lower" | "upper" {
  const m = courseId.match(/-(\d+)/);
  const n = m ? Number(m[1]) : 0;
  return n >= 100 ? "upper" : "lower";
}

// ---- Major requirements traversal ----
// We want three “seed sets”: lower, upper required, electives list (choose_courses)
type SeedSets = {
  lower: Set<string>;
  upper: Set<string>;
  electives: Set<string>;
};

function addCourseId(set: Set<string>, id: unknown) {
  if (typeof id !== "string") return;
  set.add(id.toUpperCase());
}

function addCourseSequence(set: Set<string>, subject: unknown, courses: unknown) {
  if (typeof subject !== "string" || !Array.isArray(courses)) return;
  for (const num of courses) {
    if (typeof num === "string") set.add(canonCourseId(subject, num));
  }
}

// course list supports items like "CMPSC/ECE-153A" too — keep as-is, uppercase.
function addCourseList(set: Set<string>, list: unknown) {
  if (!Array.isArray(list)) return;
  for (const c of list) if (typeof c === "string") set.add(c.toUpperCase());
}

function isChooseElectives(node: any) {
  // treat choose_courses as “electives bucket”
  return node?.type === "choose_courses";
}

function walkRequirementTree(node: any, ctx: "lower" | "upper", seeds: SeedSets) {
  if (!node) return;

  // Lower/Upper structural split is done by which top-level requirement we are in.
  // Within upper, "choose_courses" is electives.
  if (node.type === "course") {
    addCourseId(ctx === "lower" ? seeds.lower : seeds.upper, node.course_id);
    return;
  }

  if (node.type === "course_sequence") {
    addCourseSequence(ctx === "lower" ? seeds.lower : seeds.upper, node.subject, node.courses);
    return;
  }

  if (node.type === "course_list") {
    // some docs store course_list as { courses: [...] } and sometimes { subject, courses: [...] }
    addCourseList(ctx === "lower" ? seeds.lower : seeds.upper, node.courses);
    return;
  }

  if (node.type === "choose_one" || node.type === "choose_courses") {
    // choose_courses = electives if we're in upper division
    const target =
      ctx === "upper" && isChooseElectives(node) ? seeds.electives : (ctx === "lower" ? seeds.lower : seeds.upper);

    // common shapes:
    // - { from: ["CMPSC-8", ...] }
    // - { from: { courses: [...] } }
    // - { from: { subject: "ECON", courses: [...] } }
    // - { from: { either: [ {ref_requirement_id}, {courses:[...]} ] } }
    if (Array.isArray(node.from)) {
      addCourseList(target, node.from);
      return;
    }

    const from = node.from;
    if (from?.courses) addCourseList(target, from.courses);

    if (from?.either && Array.isArray(from.either)) {
      for (const opt of from.either) {
        if (opt?.courses) addCourseList(target, opt.courses);
        // ref_requirement_id means “same set as something else”
        // We don’t resolve that here; easiest: ignore ref and rely on already collected D.
      }
    }

    return;
  }

  if (node.type === "choose_units") {
    // similar: treat explicit course lists inside as electives when in upper,
    // otherwise treat as required in lower (rare).
    const target = ctx === "upper" ? seeds.electives : seeds.lower;
    const from = node.from;
    if (from?.courses) addCourseList(target, from.courses);
    return;
  }

  // some docs use "choose_one_sequence" with "options"
  if (node.type === "choose_one_sequence" && Array.isArray(node.options)) {
    for (const opt of node.options) walkRequirementTree(opt, ctx, seeds);
    return;
  }

  // generic group recursion
  if (Array.isArray(node.children)) {
    for (const ch of node.children) walkRequirementTree(ch, ctx, seeds);
  }
}

// Expand prereq closure from catalog
function buildClosure({
  seedIds,
  catalogById,
}: {
  seedIds: Set<string>;
  catalogById: Map<string, CatalogCourse>;
}) {
  const seen = new Set<string>();
  const stack = [...seedIds];

  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);

    const cat = catalogById.get(id);
    const prereqs = parsePrereqsRaw(cat?.prerequisites_raw);

    for (const p of prereqs) {
      // only follow prereqs that exist in our catalog index
      if (catalogById.has(p) && !seen.has(p)) stack.push(p);
    }
  }

  return seen;
}

export function buildCoursesForMajorSlug({
  slug,
  majors,
  catalog,
}: {
  slug: string;
  majors: MajorDoc[];
  catalog: CatalogCourse[];
}): GeneratedCourse[] {
  const majorDoc =
    majors.find((m) => toSlug(m?.program?.major_name ?? "") === slug) ??
    majors.find((m) => toSlug(m?.program?.department ?? "") === slug);

  if (!majorDoc) throw new Error(`Major not found for slug: ${slug}`);

  // index catalog by canonical ids + W aliases
  const catalogById = new Map<string, CatalogCourse>();
  for (const c of catalog) {
    const id = canonCourseId(c.subject, c.number);
    catalogById.set(id, c);
    const subj = c.subject.toUpperCase();
    if (subj.endsWith("W")) catalogById.set(canonCourseId(subj.slice(0, -1), c.number), c);
  }

  // seed sets from requirements
  const seeds: SeedSets = {
    lower: new Set(),
    upper: new Set(),
    electives: new Set(),
  };

  const reqs = majorDoc.requirements ?? [];

  // classify top-level blocks by id/title
  for (const r of reqs) {
    const id = String(r?.id ?? "");
    if (id.includes("pre_major") || id.includes("prep_for_major")) {
      walkRequirementTree(r, "lower", seeds);
    } else if (id.includes("upper_division") || id.includes("upper")) {
      walkRequirementTree(r, "upper", seeds);
    } else {
      // default: treat as lower
      walkRequirementTree(r, "lower", seeds);
    }
  }

  // electives should not duplicate required upper
  for (const id of seeds.upper) seeds.electives.delete(id);

  // closures
  const lowerClosure = buildClosure({ seedIds: seeds.lower, catalogById });
  const upperClosure = buildClosure({ seedIds: seeds.upper, catalogById });
  const electiveClosure = buildClosure({ seedIds: seeds.electives, catalogById });

  // Build GeneratedCourse list for each closure (and tag division)
  // If a course appears in multiple, prefer lower > upper > elective
  const divisionById = new Map<string, "lower" | "upper" | "elective">();
  for (const id of electiveClosure) divisionById.set(id, "elective");
  for (const id of upperClosure) divisionById.set(id, "upper");
  for (const id of lowerClosure) divisionById.set(id, "lower");

  const allIds = [...new Set([...lowerClosure, ...upperClosure, ...electiveClosure])];

  const coursesOut: GeneratedCourse[] = allIds.map((id) => {
    const cat = catalogById.get(id);

    const prereqs = parsePrereqsRaw(cat?.prerequisites_raw).filter((p) => divisionById.has(p));

    const subject = id.split("-")[0] ?? "COURSE";
    const number = id.split("-")[1] ?? "";

    const div = divisionById.get(id) ?? (inferDivision(id) === "upper" ? "upper" : "lower");

    return {
      id,
      label: `${subject} ${number}`,
      title: cat?.title ?? "Course",
      units: unitsToNumber(cat?.units),
      status: "locked",
      prerequisites: prereqs,
      unlocksCount: 0,
      prerequisiteCount: prereqs.length,
      division: div,
    };
  });

  // unlock counts
  const unlockCounts: Record<string, number> = {};
  for (const c of coursesOut) for (const p of c.prerequisites) unlockCounts[p] = (unlockCounts[p] ?? 0) + 1;
  for (const c of coursesOut) c.unlocksCount = unlockCounts[c.id] ?? 0;

  return coursesOut;
}
