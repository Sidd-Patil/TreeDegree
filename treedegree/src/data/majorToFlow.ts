import type { Node, Edge } from "@xyflow/react";
import type { CourseNodeData } from "@/data/sampleCourseData";
import type { CourseStatus } from "@/components/CourseNode";

export type GeneratedCourse = {
  id: string;
  label: string;
  title: string;
  units: number;
  status: CourseStatus | "bottleneck";
  prerequisites: string[];
  unlocksCount?: number;
  prerequisiteCount?: number;
  division?: string;
};

export function majorCoursesToFlow(courses: GeneratedCourse[]): {
  nodes: Node<CourseNodeData>[];
  edges: Edge[];
} {
  // Always return something valid
  if (!Array.isArray(courses) || courses.length === 0) {
    return { nodes: [], edges: [] };
  }

  // --- unlock counts (if missing) ---
  const unlockCounts: Record<string, number> = {};
  for (const c of courses) {
    for (const p of c.prerequisites ?? []) unlockCounts[p] = (unlockCounts[p] ?? 0) + 1;
  }

  const byId = new Map(courses.map((c) => [c.id, c]));

  // --- build edges + parents map (ignore prereqs not present) ---
  const parents = new Map<string, string[]>();
  for (const c of courses) parents.set(c.id, []);

  const edges: Edge[] = [];
  for (const c of courses) {
    for (const prereq of c.prerequisites ?? []) {
      if (!byId.has(prereq)) continue;
      parents.get(c.id)!.push(prereq);

      edges.push({
        id: `${prereq}-${c.id}`,
        source: prereq,
        target: c.id,
        type: "bezier",
        style: { strokeWidth: 2 },
        animated: false,
      });
    }
  }

  // --- depth (tier) via longest prereq chain (cycle-safe, max recursion guard) ---
  const memoDepth = new Map<string, number>();

  function depth(id: string, stack = new Set<string>()): number {
    if (memoDepth.has(id)) return memoDepth.get(id)!;

    // cycle guard
    if (stack.has(id)) {
      memoDepth.set(id, 0);
      return 0;
    }

    // hard safety: suggests corrupted prereq loops
    if (stack.size > 2000) {
      console.warn("[majorCoursesToFlow] depth recursion too deep, breaking at", id);
      memoDepth.set(id, 0);
      return 0;
    }

    stack.add(id);

    const ps = parents.get(id) ?? [];
    if (ps.length === 0) {
      memoDepth.set(id, 0);
      stack.delete(id);
      return 0;
    }

    let best = 0;
    for (const p of ps) {
      best = Math.max(best, depth(p, stack));
    }

    const d = best + 1;
    memoDepth.set(id, d);
    stack.delete(id);
    return d;
  }

  // --- group by tier ---
  const tierToIds = new Map<number, string[]>();
  let maxTier = 0;

  for (const c of courses) {
    const t = depth(c.id);
    maxTier = Math.max(maxTier, t);
    const arr = tierToIds.get(t) ?? [];
    arr.push(c.id);
    tierToIds.set(t, arr);
  }

  // --- layout knobs ---
  const x0 = 50;
  const colGap = 280;
  const rowGap = 120;

  const posById = new Map<string, { x: number; y: number }>();
  const yById = new Map<string, number>();

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  // Tier 0: stable ordering
  const tier0 = tierToIds.get(0) ?? [];
  tier0.sort((a, b) => {
    const ua = unlockCounts[a] ?? 0;
    const ub = unlockCounts[b] ?? 0;
    if (ub !== ua) return ub - ua;
    return a.localeCompare(b);
  });

  // Center around 0 (works even for 1 element)
  {
    const totalH0 = (tier0.length - 1) * rowGap;
    let cursorY = -totalH0 / 2;

    for (const id of tier0) {
      const x = x0;
      const y = cursorY;
      posById.set(id, { x, y });
      yById.set(id, y);
      cursorY += rowGap;
    }
  }

  // Remaining tiers
  for (let t = 1; t <= maxTier; t++) {
    const ids = tierToIds.get(t) ?? [];
    if (!ids.length) continue;

    // desiredY = avg parent Y (only parents already placed)
    const desiredY = new Map<string, number>();
    for (const id of ids) {
      const ps = parents.get(id) ?? [];
      const ys: number[] = [];
      for (const p of ps) {
        const py = yById.get(p);
        if (typeof py === "number" && Number.isFinite(py)) ys.push(py);
      }
      desiredY.set(id, avg(ys));
    }

    // sort by desiredY
    ids.sort((a, b) => {
      const da = desiredY.get(a) ?? 0;
      const db = desiredY.get(b) ?? 0;
      if (da !== db) return da - db;

      const ua = unlockCounts[a] ?? 0;
      const ub = unlockCounts[b] ?? 0;
      if (ub !== ua) return ub - ua;
      return a.localeCompare(b);
    });

    const center = avg(ids.map((id) => desiredY.get(id) ?? 0));
    const totalH = (ids.length - 1) * rowGap;
    let cursorY = center - totalH / 2;

    for (const id of ids) {
      const x = x0 + t * colGap;
      const y = cursorY;

      posById.set(id, { x, y });
      yById.set(id, y);

      cursorY += rowGap;
    }
  }

  // --- build nodes ---
  const nodes: Node<CourseNodeData>[] = courses.map((c) => {
    const status: CourseStatus = c.status === "bottleneck" ? "locked" : c.status;

    const prerequisiteCount =
      typeof c.prerequisiteCount === "number"
        ? c.prerequisiteCount
        : (c.prerequisites ?? []).length;

    const p = posById.get(c.id) ?? { x: x0, y: 0 };

    // final safety: ReactFlow hates NaN
    const safeX = Number.isFinite(p.x) ? p.x : x0;
    const safeY = Number.isFinite(p.y) ? p.y : 0;

    return {
      id: c.id,
      type: "course",
      position: { x: safeX, y: safeY },
      data: {
        label: c.label,
        title: c.title,
        status,
        units: c.units,
        unlocksCount: c.unlocksCount ?? unlockCounts[c.id] ?? 0,
        prerequisiteCount,
        courseId: c.id ,
      },
    };
  });

  // Debug if you still see blank (you’ll see this in console)
  if (nodes.length && edges.length === 0) {
    console.warn("[majorCoursesToFlow] edges=0; check that prerequisites match course ids");
  }

  return { nodes, edges };
}
