import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { ArrowLeft, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CourseNode } from "@/components/CourseNode";
import { SkillTreeLegend } from "@/components/SkillTreeLegend";
import type { CourseNodeData } from "@/data/sampleCourseData";
import { majorCoursesToFlow, type GeneratedCourse } from "@/data/majorToFlow";
import { toSlug, buildCoursesForMajorSlug } from "@/data/buildMajorGraph";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type CourseStatus = "completed" | "available" | "locked";

const nodeTypes = { course: CourseNode };

function prereqClosure(targetNodeIds: string[], edges: Edge[]) {
  const { parents } = buildAdjacency(edges); // you already have this helper
  const closure = new Set<string>();

  const stack = [...targetNodeIds];
  while (stack.length) {
    const cur = stack.pop()!;
    if (closure.has(cur)) continue;
    closure.add(cur);
    const ps = parents.get(cur);
    if (!ps) continue;
    for (const p of ps) stack.push(p);
  }
  return closure;
}


function getNodeStatus(n: Node<any>): CourseStatus {
  const s = (n.data as any)?.status;
  return s === "completed" || s === "available" || s === "locked" ? s : "locked";
}

function splitByGroup(courses: GeneratedCourse[]) {
  const lower = courses.filter((c) => (c.division ?? "lower") === "lower");
  const upper = courses.filter((c) => c.division === "upper");
  const electives = courses.filter((c) => c.division === "elective" || c.division === "electives");
  return { lower, upper, electives };
}

function pruneDanglingEdges(nodes: Node<any>[], edges: Edge[]) {
  const ids = new Set(nodes.map((n) => n.id));
  return edges.filter((e) => ids.has(e.source) && ids.has(e.target));
}

function offsetNodes<T>(nodes: Node<T>[], dx: number, dy = 0): Node<T>[] {
  return nodes.map((n) => ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }));
}

/** Prefix IDs so graphs never collide; rewrite edges too. */
function prefixFlow<T>(
  nodes: Node<T>[],
  edges: Edge[],
  prefix: "L:" | "U:" | "E:"
): { nodes: Node<T>[]; edges: Edge[] } {
  const mapId = (id: string) => `${prefix}${id}`;
  return {
    nodes: nodes.map((n) => ({ ...n, id: mapId(n.id) })),
    edges: edges.map((e) => ({
      ...e,
      id: `${prefix}${e.id}`,
      source: mapId(e.source),
      target: mapId(e.target),
    })),
  };
}

function computeBounds(nodes: Node<any>[]) {
  if (nodes.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const n of nodes) {
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxY = Math.max(maxY, n.position.y);
  }
  return { minX, maxX, minY, maxY };
}

/* ---------------- Branch highlight helpers ---------------- */

type Branch = {
  selected: string;
  ancestors: Set<string>;
  descendants: Set<string>;
  edgesInBranch: Set<string>;
};

function buildAdjacency(edges: Edge[]) {
  const parents = new Map<string, Set<string>>(); // node -> prereqs
  const children = new Map<string, Set<string>>(); // node -> unlocks
  for (const e of edges) {
    if (!parents.has(e.target)) parents.set(e.target, new Set());
    parents.get(e.target)!.add(e.source);

    if (!children.has(e.source)) children.set(e.source, new Set());
    children.get(e.source)!.add(e.target);
  }
  return { parents, children };
}

function walk(start: string, next: (id: string) => Iterable<string>, max = 5000) {
  const out = new Set<string>();
  const stack = [start];
  let steps = 0;

  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of next(cur)) {
      if (out.has(n)) continue;
      out.add(n);
      stack.push(n);
      steps += 1;
      if (steps > max) return out;
    }
  }
  return out;
}

function computeBranch(selectedId: string, edges: Edge[]): Branch {
  const { parents, children } = buildAdjacency(edges);
  const ancestors = walk(selectedId, (id) => parents.get(id) ?? []);
  const descendants = walk(selectedId, (id) => children.get(id) ?? []);

  const inSet = new Set<string>([selectedId, ...ancestors, ...descendants]);
  const edgesInBranch = new Set<string>();
  for (const e of edges) {
    if (inSet.has(e.source) && inSet.has(e.target)) edgesInBranch.add(e.id);
  }
  return { selected: selectedId, ancestors, descendants, edgesInBranch };
}

/* ---------------- Course Recommender Drawer ---------------- */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ---------------- Course Recommender Drawer ---------------- */

type ChatMsg = { role: "user" | "assistant"; content: string };

function CourseChat({
  majorSlug,
  courses,
  onHighlightTargets,
}: {
  majorSlug: string;
  courses: GeneratedCourse[];
  onHighlightTargets: (courseIds: string[], note?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Tell me what you want to do (e.g. **“I want to do machine learning”**) and I’ll highlight the recommended pathway.\n\n- I’ll return a short plan\n- And highlight the relevant nodes",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const courseIndex = useMemo(() => {
    // keep prompt smaller for the model
    return courses.map((c) => ({
      id: c.id,
      label: c.label,
      title: c.title,
      division: c.division ?? "unknown",
      prerequisites: c.prerequisites ?? [],
      status: c.status,
    }));
  }, [courses]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setMsgs((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/recommender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          majorSlug,
          userMessage: text, // ✅ USE THEIR INPUT (you were hardcoding ML before)
          courses: courseIndex,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { message: string; targets: string[] };

      const assistantMsg =
        typeof data?.message === "string" && data.message.trim().length
          ? data.message
          : "I didn’t get a usable response.";

      setMsgs((m) => [...m, { role: "assistant", content: assistantMsg }]);

      if (Array.isArray(data.targets) && data.targets.length) {
        onHighlightTargets(data.targets, assistantMsg);
      }
    } catch (e) {
      console.error(e);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Something went wrong calling the recommender.\n\n**Checklist:**\n- Is the server running?\n- Does `/api/recommender` respond?\n- Any CORS/proxy issues in the Vite console?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }
  const PANEL_W = 360;
  const TAB_W = 40;

  return (
    <div className="absolute top-0 right-0 z-30 h-full pointer-events-none">
      {/* Move TAB + PANEL together */}
      <motion.div
        className="pointer-events-auto h-full flex"
        initial={false}
        animate={{ x: open ? 0 : PANEL_W }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        style={{ width: PANEL_W + TAB_W }}
      >
        {/* Tab button (now it moves WITH the drawer) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={[
            "h-32 w-10 self-center",
            "rounded-l-xl border border-muted bg-card/90 backdrop-blur-md shadow-sm",
            "hover:bg-card transition",
            "flex items-center justify-center",
          ].join(" ")}
          aria-label="Toggle Course Recommender"
          title="Course Recommender"
          style={{ width: TAB_W }}
        >
          <span
            className="text-xs font-semibold text-muted-foreground"
            style={{
              writingMode: "vertical-rl",
              transform: "rotate(180deg)",
              letterSpacing: "0.08em",
            }}
          >
            COURSE RECOMMENDER
          </span>
        </button>

        {/* Drawer panel */}
        <div
          className="h-full border-l border-muted bg-card/92 backdrop-blur-md shadow-xl flex flex-col"
          style={{ width: PANEL_W }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-muted flex items-center justify-between">
            <div className="font-semibold">Course Recommender</div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground">
                {loading ? "Thinking…" : "AI"}
              </div>
              <Button variant="stone" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-auto px-3 py-3 space-y-2">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={[
                  "text-sm leading-relaxed rounded-xl px-3 py-2",
                  m.role === "user"
                    ? "bg-muted ml-10"
                    : "bg-background border border-muted mr-10",
                ].join(" ")}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:font-semibold">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span>{m.content}</span>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-muted flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder='e.g. "I want to do machine learning"'
              className="flex-1 h-10 rounded-xl border border-muted bg-background px-3 text-sm outline-none"
            />
            <Button variant="water" size="sm" onClick={send} disabled={loading}>
              Send
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------- Focus controls ---------------- */

function CanvasButtons({
  onFocusLower,
  onFocusUpper,
  onFocusElectives,
  onFocusAll,
}: {
  onFocusLower: () => void;
  onFocusUpper: () => void;
  onFocusElectives: () => void;
  onFocusAll: () => void;
}) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
      <div className="rounded-2xl border border-muted bg-card/80 backdrop-blur px-2 py-2 flex gap-2 shadow-sm">
        <Button variant="stone" size="sm" onClick={onFocusLower}>
          Lower Div
        </Button>
        <Button variant="stone" size="sm" onClick={onFocusUpper}>
          Upper Div
        </Button>
        <Button variant="stone" size="sm" onClick={onFocusElectives}>
          Electives
        </Button>
        <Button variant="water" size="sm" onClick={onFocusAll}>
          All
        </Button>
      </div>
    </div>
  );
}

/**
 * Focus buttons:
 * - fits view to lower/upper/electives/all (reliably)
 * - updates overlay title text
 */
function FocusControls({
  baseTitle,
  setViewTitle,
}: {
  baseTitle: string;
  setViewTitle: (t: string) => void;
}) {
  const { fitView, getNodes } = useReactFlow();

  const focusPrefix = useCallback(
    (prefix: "L:" | "U:" | "E:", titleText: string, maxZoom: number) => {
      const current = getNodes() as Node<any>[];
      const subset = current.filter((n) => n.id.startsWith(prefix));
      if (!subset.length) return;

      setViewTitle(titleText);
      requestAnimationFrame(() => {
        fitView({ nodes: subset, padding: 0.25, duration: 650, maxZoom });
      });
    },
    [fitView, getNodes, setViewTitle]
  );

  const focusLower = useCallback(() => focusPrefix("L:", "Lower Division Skill Tree", 1.2), [
    focusPrefix,
  ]);
  const focusUpper = useCallback(() => focusPrefix("U:", "Upper Division Skill Tree", 1.2), [
    focusPrefix,
  ]);
  const focusElectives = useCallback(() => focusPrefix("E:", "Electives Skill Tree", 1.2), [
    focusPrefix,
  ]);

  const focusAll = useCallback(() => {
    setViewTitle(`${baseTitle} Skill Tree`);
    requestAnimationFrame(() => fitView({ padding: 0.25, duration: 650, maxZoom: 1.1 }));
  }, [fitView, baseTitle, setViewTitle]);

  return (
    <CanvasButtons
      onFocusLower={focusLower}
      onFocusUpper={focusUpper}
      onFocusElectives={focusElectives}
      onFocusAll={focusAll}
    />
  );
}

/* ---------------- Main ---------------- */

function SkillTreeInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { majorSlug } = useParams<{ majorSlug: string }>();

  const slug = majorSlug ?? "computer-science";

  function canonizeCompletedId(raw: string): string {
    const s = raw.trim();
    const m = s.match(/^([A-Za-z]{2,8})\s*[-_ ]\s*([0-9]{1,3}[A-Za-z]{0,2})$/);
    if (m) return `${m[1].toUpperCase()}-${m[2].toUpperCase()}`;
    return s.toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
  }

  // completion state (local, mutable)
  const initialCompletedIds = useMemo(() => {
    const state = location.state as
      | { completedIds?: unknown; completedCourseIds?: unknown }
      | null;

    const ids = state?.completedIds ?? state?.completedCourseIds;
    if (!Array.isArray(ids)) return new Set<string>();
    return new Set(
      ids
        .filter((v): v is string => typeof v === "string")
        .map((v) => canonizeCompletedId(v))
    );
  }, [location.state]);

  const [completedIds, setCompletedIds] = useState<Set<string>>(initialCompletedIds);
  useEffect(() => setCompletedIds(initialCompletedIds), [initialCompletedIds]);

  // major courses (built from major-requirements + catalog via your helper)
  const [rawCourses, setRawCourses] = useState<GeneratedCourse[]>([]);

  // build rawCourses when slug changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const reqMod = await import("../data/major-requirements.json");
      const catalogMod = await import("../data/courses.json"); // adjust if your file name differs

      const majors = reqMod.default as any[];
      const catalog = catalogMod.default as any[];

      // this function should: take major requirements for slug, look up courses in catalog,
      // include prereqs found in catalog recursively, and classify division/electives
      const courses = buildCoursesForMajorSlug({ slug, majors, catalog });

      // optional sanity check: ensure slug exists
      const majorDoc =
        majors.find((m) => toSlug(m?.program?.major_name ?? "") === slug) ??
        majors.find((m) => toSlug(m?.program?.department ?? "") === slug);

      if (!majorDoc) throw new Error(`Major not found for slug: ${slug}`);

      if (cancelled) return;
      setRawCourses(courses);
    }

    load().catch((e) => {
      console.error("Failed to load major data:", e);
      navigate("/skill-tree/computer-science", { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  // recompute statuses when completion changes (cascades availability/locked)
  const coursesWithStatus = useMemo(() => {
    if (!rawCourses.length) return [];

    return rawCourses.map((c) => {
      if (completedIds.has(c.id)) {
        return { ...c, status: "completed" as const, prerequisiteCount: 0 };
      }

      const total =
        typeof c.prerequisiteCount === "number" ? c.prerequisiteCount : (c.prerequisites?.length ?? 0);

      const done = (c.prerequisites ?? []).filter((p) => completedIds.has(p)).length;
      const remaining = Math.max(0, total - done);

      return {
        ...c,
        prerequisiteCount: remaining,
        status: remaining === 0 ? ("available" as const) : ("locked" as const),
      };
    });
  }, [rawCourses, completedIds]);

  const pageTitle = useMemo(() => {
    return slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }, [slug]);

  const [viewTitle, setViewTitle] = useState<string>("");
  useEffect(() => setViewTitle(`${pageTitle} Skill Tree`), [pageTitle]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<any>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [baseNodes, setBaseNodes] = useState<Node<any>[]>([]);
  const [baseEdges, setBaseEdges] = useState<Edge[]>([]);

  const [visibleStatus, setVisibleStatus] = useState<Record<CourseStatus, boolean>>({
    completed: true,
    available: true,
    locked: true,
  });

  const highlightTargets = useCallback(
  (unprefixedCourseIds: string[], note?: string) => {
    // We have 3 graphs (L/U/E). Targets might exist in only one.
    // So we highlight any matching prefixed node IDs.
    const prefixedTargets: string[] = [];

    const allIds = new Set(baseNodes.map((n) => n.id));
    for (const id of unprefixedCourseIds) {
      for (const pref of ["L:", "U:", "E:"] as const) {
        const pid = `${pref}${id}`;
        if (allIds.has(pid)) prefixedTargets.push(pid);
      }
    }
    if (!prefixedTargets.length) return;

    // Build a “branch-like” selection (closure only)
    const closure = prereqClosure(prefixedTargets, baseEdges);
    const edgesInBranch = new Set<string>();
    for (const e of baseEdges) {
      if (closure.has(e.source) && closure.has(e.target)) edgesInBranch.add(e.id);
    }

    // Pick first target as “selected” for styling
    setBranch({
      selected: prefixedTargets[0],
      ancestors: new Set([...closure].filter((x) => x !== prefixedTargets[0])),
      descendants: new Set(), // optional: you can add unlocks too
      edgesInBranch,
    });

    // optional: zoom to closure
    // (If you want, we can also call fitView here via useReactFlow in a child controller)
  },
  [baseNodes, baseEdges]
);


  // node selection for modal
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  const activeNodeData = useMemo(() => {
    if (!activeCourseId) return null;
    // find *unprefixed* course in current status list
    const c = coursesWithStatus.find((x) => x.id === activeCourseId);
    return c ?? null;
  }, [activeCourseId, coursesWithStatus]);

  // branch highlight
  const [branch, setBranch] = useState<Branch | null>(null);

  // Build 3 graphs side-by-side whenever course set changes
  useEffect(() => {
    if (!coursesWithStatus.length) {
      setBaseNodes([]);
      setBaseEdges([]);
      return;
    }

    const { lower, upper, electives } = splitByGroup(coursesWithStatus);

    const lowerFlowRaw = majorCoursesToFlow(lower);
    const upperFlowRaw = majorCoursesToFlow(upper);
    const electivesFlowRaw = majorCoursesToFlow(electives);

    const lowerEdgesPruned = pruneDanglingEdges(lowerFlowRaw.nodes as any, lowerFlowRaw.edges);
    const upperEdgesPruned = pruneDanglingEdges(upperFlowRaw.nodes as any, upperFlowRaw.edges);
    const electivesEdgesPruned = pruneDanglingEdges(
      electivesFlowRaw.nodes as any,
      electivesFlowRaw.edges
    );

    const lowerFlow = prefixFlow(lowerFlowRaw.nodes as any, lowerEdgesPruned, "L:");
    const upperFlow = prefixFlow(upperFlowRaw.nodes as any, upperEdgesPruned, "U:");
    const electivesFlow = prefixFlow(electivesFlowRaw.nodes as any, electivesEdgesPruned, "E:");

    const gap = 560;

    // normalize lower to x≈0
    const lb = computeBounds(lowerFlow.nodes as any);
    const normalizeLowerX = -lb.minX;
    const lowerNodesNorm = offsetNodes(lowerFlow.nodes as any, normalizeLowerX, 0);

    const lowerBounds = computeBounds(lowerNodesNorm as any);
    const lowerWidth = lowerBounds.maxX - lowerBounds.minX;

    const upperNodesNorm = offsetNodes(
      upperFlow.nodes as any,
      normalizeLowerX + lowerWidth + gap,
      0
    );

    const ub = computeBounds(upperNodesNorm as any);
    const upperWidth = ub.maxX - ub.minX;

    const electivesNodesNorm = offsetNodes(
      electivesFlow.nodes as any,
      normalizeLowerX + lowerWidth + gap + upperWidth + gap,
      0
    );

    const combinedNodes = [...lowerNodesNorm, ...upperNodesNorm, ...electivesNodesNorm];
    const combinedEdges = [
      ...(lowerFlow.edges as any),
      ...(upperFlow.edges as any),
      ...(electivesFlow.edges as any),
    ];

    setBaseNodes(combinedNodes);
    setBaseEdges(combinedEdges);
  }, [coursesWithStatus]);

  // Apply status filters + branch highlight styling
  useEffect(() => {
    const filteredNodes = baseNodes.filter((n) => visibleStatus[getNodeStatus(n)]);
    const allowedIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = baseEdges.filter((e) => allowedIds.has(e.source) && allowedIds.has(e.target));

    if (branch && allowedIds.has(branch.selected)) {
      const isAncestor = (id: string) => branch.ancestors.has(id);
      const isDesc = (id: string) => branch.descendants.has(id);
      const isSelected = (id: string) => id === branch.selected;

      const styledNodes = filteredNodes.map((n) => {
        const id = n.id;
        const inBranch = isSelected(id) || isAncestor(id) || isDesc(id);
        const opacity = inBranch ? 1 : 0.18;

        let boxShadow: string | undefined;
        let outline: string | undefined;

        if (isSelected(id)) {
          outline = "3px solid hsl(195, 90%, 50%)";
          boxShadow = "0 0 0 6px rgba(56, 189, 248, 0.20)";
        } else if (isAncestor(id)) {
          outline = "2px solid hsl(45, 100%, 55%)";
        } else if (isDesc(id)) {
          outline = "2px solid hsl(0, 90%, 60%)";
        }

        return {
          ...n,
          style: { ...(n.style ?? {}), opacity, outline, boxShadow, borderRadius: 16 },
        };
      });

      const styledEdges = filteredEdges.map((e) => {
        const inBranch = branch.edgesInBranch.has(e.id);
        return {
          ...e,
          animated: inBranch,
          style: {
            ...(e.style ?? {}),
            opacity: inBranch ? 1 : 0.12,
            strokeWidth: inBranch ? 3 : 2,
          },
        };
      });

      setNodes(styledNodes);
      setEdges(styledEdges);
      return;
    }

    // no branch selection
    setNodes(
      filteredNodes.map((n) => ({
        ...n,
        style: { ...(n.style ?? {}), opacity: 1, outline: undefined, boxShadow: undefined },
      }))
    );
    setEdges(
      filteredEdges.map((e) => ({
        ...e,
        animated: false,
        style: { ...(e.style ?? {}), opacity: 1, strokeWidth: 2 },
      }))
    );
  }, [baseNodes, baseEdges, visibleStatus, branch, setNodes, setEdges]);

  const handleReset = useCallback(() => {
    setVisibleStatus({ completed: true, available: true, locked: true });
    setBranch(null);
    setViewTitle(`${pageTitle} Skill Tree`);
  }, [pageTitle]);

  const progress = useMemo(() => {
    const courseNodes = nodes.filter((n) => n.type === "course");
    let completed = 0,
      available = 0,
      locked = 0,
      totalUnits = 0;

    for (const n of courseNodes) {
      const status = (n.data as any)?.status as CourseStatus | undefined;
      const units = Number((n.data as any)?.units ?? 0);

      if (status === "completed") completed += 1;
      else if (status === "available") available += 1;
      else locked += 1;

      if (!Number.isNaN(units)) totalUnits += units;
    }

    return { completed, available, locked, totalUnits };
  }, [nodes]);

  const STATUS_OPTIONS: Array<[CourseStatus, string]> = [
    ["completed", "Completed"],
    ["available", "Available"],
    ["locked", "Locked"],
  ];

  // NOTE: one click should open modal; branch highlight uses that same click (after modal open)
const onNodeClick = useCallback(
  (_: any, node: Node<any>) => {
    if (!node?.id) return;
    // single click = highlight branch only
    setBranch((prev) => (prev?.selected === node.id ? null : computeBranch(node.id, edges)));
  },
  [edges]
);

const onNodeDoubleClick = useCallback(
  (_: any, node: Node<any>) => {
    if (!node?.id) return;

    // double click = open modal
    const courseId =
      (node.data as any)?.courseId ??
      node.id.replace(/^([LUE]:)/, ""); // fallback: strip prefix

    setActiveCourseId(courseId);
    setDialogOpen(true);
  },
  []
);


  const onPaneClick = useCallback(() => {
    setBranch(null);
  }, []);

  const markCompleted = useCallback(() => {
    if (!activeCourseId) return;
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.add(activeCourseId);
      return next;
    });
    setDialogOpen(false);
  }, [activeCourseId]);

  const unmarkCompleted = useCallback(() => {
    if (!activeCourseId) return;
    setCompletedIds((prev) => {
      const next = new Set(prev);
      next.delete(activeCourseId);
      return next;
    });
    setDialogOpen(false);
  }, [activeCourseId]);

  return (
    <div className="h-screen w-full bg-background relative overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-4 right-4 z-20 flex gap-2"
      >
        <Button variant="stone" size="sm" onClick={() => navigate("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Button variant="stone" size="sm" onClick={handleReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Reset Filters
        </Button>

        <Button variant="water" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </motion.div>

      {/* Overlay Title */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="px-10 py-4 rounded-2xl bg-card/70 backdrop-blur-xl border border-muted shadow-sm">
          <h1 className="font-display text-3xl font-extrabold text-gradient-dual text-center">
            {viewTitle}
          </h1>
        </div>
      </motion.div>

      {/* Status Filter Panel */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-16 right-4 z-20">
        <div className="rounded-xl border-2 border-muted bg-card/90 backdrop-blur-md p-3 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Show statuses</div>

          {STATUS_OPTIONS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <Checkbox
                checked={visibleStatus[key]}
                onCheckedChange={(v) => setVisibleStatus((prev) => ({ ...prev, [key]: Boolean(v) }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </motion.div>

      <SkillTreeLegend />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes as any}
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.25}
        maxZoom={1.6}
        className="bg-background"
        onInit={(rf) => {
          requestAnimationFrame(() => rf.fitView({ padding: 0.22, maxZoom: 1.1 }));
        }}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220, 15%, 20%)" />
        <Controls className="!bg-card/80 !backdrop-blur-md !border-2 !border-muted !rounded-xl [&>button]:!bg-transparent [&>button]:!border-muted [&>button:hover]:!bg-muted" />
        <MiniMap
          className="!bg-card/80 !backdrop-blur-md !border-2 !border-muted !rounded-xl"
          nodeColor={(node) => {
            const status = (node.data as any)?.status;
            // completed = GREEN
            if (status === "completed") return "hsl(142, 70%, 45%)";
            if (status === "available") return "hsl(195, 90%, 50%)";
            return "hsl(220, 10%, 35%)";
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
        />

        <FocusControls baseTitle={pageTitle} setViewTitle={setViewTitle} />
      </ReactFlow>

      {/* Node modal: mark completed + cascading availability */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{activeNodeData?.label ?? "Course"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <div className="text-muted-foreground">{activeNodeData?.title ?? ""}</div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Units:</span>
              <span className="font-medium">{activeNodeData?.units ?? 0}</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{(activeNodeData?.status as any) ?? "locked"}</span>
            </div>

            {activeNodeData?.prerequisiteCount != null && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Remaining prereqs:</span>
                <span className="font-medium">{activeNodeData.prerequisiteCount}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="stone" onClick={() => setDialogOpen(false)}>
              Close
            </Button>

            {completedIds.has(activeCourseId ?? "") ? (
              <Button variant="stone" onClick={unmarkCompleted}>
                Mark Not Completed
              </Button>
            ) : (
              <Button variant="water" onClick={markCompleted}>
                Mark Completed
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-4 left-4 z-20">
        <div className="rounded-xl border-2 border-muted bg-card/90 backdrop-blur-md p-4">
          <h3 className="font-display font-semibold text-sm text-foreground mb-3">Progress Summary</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col">
              <span className="text-gold font-bold text-lg">{progress.completed}</span>
              <span className="text-muted-foreground text-xs">Completed</span>
            </div>
            <div className="flex flex-col">
              <span className="text-water font-bold text-lg">{progress.available}</span>
              <span className="text-muted-foreground text-xs">Available</span>
            </div>
            <div className="flex flex-col">
              <span className="text-locked font-bold text-lg">{progress.locked}</span>
              <span className="text-muted-foreground text-xs">Locked</span>
            </div>
            <div className="flex flex-col">
              <span className="text-fire font-bold text-lg">{progress.totalUnits}</span>
              <span className="text-muted-foreground text-xs">Total Units</span>
            </div>
          </div>
        </div>
      </motion.div>
<CourseChat
  majorSlug={slug}
  courses={coursesWithStatus}
  onHighlightTargets={highlightTargets}
/>

    </div>
  );
}

export default function SkillTree() {
  return (
    <ReactFlowProvider>
      <SkillTreeInner />
    </ReactFlowProvider>
  );
}
