import type { Node, Edge } from "@xyflow/react";
import type { CourseStatus } from "@/components/CourseNode";

export interface CourseNodeData extends Record<string, unknown> {
  label: string;
  title: string;
  status: CourseStatus;
  units: number;
  unlocksCount?: number;
  prerequisiteCount?: number;
}

// Sample CS curriculum data for demonstration
export const sampleCourses: Array<{
  id: string;
  label: string;
  title: string;
  units: number;
  status: CourseStatus;
  prerequisites: string[];
}> = [
  // Foundation Tier
  { id: "cs8", label: "CMPSC 8", title: "Intro to Computer Science", units: 4, status: "completed", prerequisites: [] },
  { id: "cs16", label: "CMPSC 16", title: "Problem Solving I", units: 4, status: "completed", prerequisites: ["cs8"] },
  { id: "math3a", label: "MATH 3A", title: "Calculus with Applications I", units: 4, status: "completed", prerequisites: [] },
  { id: "math3b", label: "MATH 3B", title: "Calculus with Applications II", units: 4, status: "completed", prerequisites: ["math3a"] },
  
  // Core Tier
  { id: "cs24", label: "CMPSC 24", title: "Problem Solving II", units: 4, status: "completed", prerequisites: ["cs16"] },
  { id: "cs32", label: "CMPSC 32", title: "Object-Oriented Design", units: 4, status: "available", prerequisites: ["cs24"] },
  { id: "cs64", label: "CMPSC 64", title: "Computer Organization", units: 4, status: "available", prerequisites: ["cs16"] },
  { id: "math4a", label: "MATH 4A", title: "Linear Algebra", units: 4, status: "available", prerequisites: ["math3b"] },
  { id: "math4b", label: "MATH 4B", title: "Differential Equations", units: 4, status: "locked", prerequisites: ["math4a"] },
  
  // Intermediate Tier
  { id: "cs130a", label: "CMPSC 130A", title: "Data Structures & Algorithms I", units: 4, status: "locked", prerequisites: ["cs24", "cs64"] },
  { id: "cs130b", label: "CMPSC 130B", title: "Data Structures & Algorithms II", units: 4, status: "locked", prerequisites: ["cs130a"] },
  { id: "cs138", label: "CMPSC 138", title: "Automata & Formal Languages", units: 4, status: "locked", prerequisites: ["cs64", "math4a"] },
  { id: "cs154", label: "CMPSC 154", title: "Computer Architecture", units: 4, status: "locked", prerequisites: ["cs64"] },
  { id: "cs170", label: "CMPSC 170", title: "Operating Systems", units: 4, status: "locked", prerequisites: ["cs130a"] },
  
  // Advanced Tier
  { id: "cs165a", label: "CMPSC 165A", title: "Artificial Intelligence", units: 4, status: "locked", prerequisites: ["cs130a"] },
  { id: "cs165b", label: "CMPSC 165B", title: "Machine Learning", units: 4, status: "locked", prerequisites: ["cs165a", "math4a"] },
  { id: "cs171", label: "CMPSC 171", title: "Distributed Systems", units: 4, status: "locked", prerequisites: ["cs170"] },
  { id: "cs174a", label: "CMPSC 174A", title: "Computer Graphics", units: 4, status: "locked", prerequisites: ["cs130a", "math4a"] },
  { id: "cs176a", label: "CMPSC 176A", title: "Computer Networks", units: 4, status: "locked", prerequisites: ["cs130a"] },
  { id: "cs180", label: "CMPSC 180", title: "Computer Security", units: 4, status: "locked", prerequisites: ["cs170", "cs176a"] },
];

// Calculate which courses unlock the most others
const calculateUnlockCounts = () => {
  const counts: Record<string, number> = {};
  sampleCourses.forEach((course) => {
    course.prerequisites.forEach((prereq) => {
      counts[prereq] = (counts[prereq] || 0) + 1;
    });
  });
  return counts;
};

const unlockCounts = calculateUnlockCounts();

// Position courses in a tree layout
const tierX: Record<number, number> = {
  0: 50,
  1: 300,
  2: 550,
  3: 800,
  4: 1050,
};

const getTier = (courseId: string): number => {
  const tiers: Record<string, number> = {
    cs8: 0, math3a: 0,
    cs16: 1, math3b: 1,
    cs24: 2, cs64: 2, math4a: 2, cs32: 2,
    cs130a: 3, cs138: 3, cs154: 3, math4b: 3, cs170: 3,
    cs130b: 4, cs165a: 4, cs165b: 4, cs171: 4, cs174a: 4, cs176a: 4, cs180: 4,
  };
  return tiers[courseId] ?? 2;
};

// Generate nodes
export const generateNodes = (): Node<CourseNodeData>[] => {
  const tierCounts: Record<number, number> = {};
  
  return sampleCourses.map((course) => {
    const tier = getTier(course.id);
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    const yOffset = tierCounts[tier] * 120;
    
    return {
      id: course.id,
      type: "course",
      position: { x: tierX[tier] || 300, y: yOffset },
      data: {
        label: course.label,
        title: course.title,
        status: course.status,
        units: course.units,
        unlocksCount: unlockCounts[course.id] || 0,
      },
    };
  });
};

// Generate edges with styled paths
export const generateEdges = (): Edge[] => {
  const edges: Edge[] = [];
  
  sampleCourses.forEach((course) => {
    course.prerequisites.forEach((prereq) => {
      const sourceStatus = sampleCourses.find((c) => c.id === prereq)?.status || "locked";
      const targetStatus = course.status;
      
      let strokeColor = "hsl(220, 10%, 35%)"; // Locked grey
      let animated = false;
      
      if (sourceStatus === "completed" && targetStatus === "completed") {
        strokeColor = "hsl(45, 100%, 55%)"; // Gold
      } else if (sourceStatus === "completed" && targetStatus === "available") {
        strokeColor = "hsl(195, 90%, 50%)"; // Water blue
        animated = true;
      }
      
      edges.push({
        id: `${prereq}-${course.id}`,
        source: prereq,
        target: course.id,
        style: { stroke: strokeColor, strokeWidth: 2 },
        animated,
      });
    });
  });
  
  return edges;
};
