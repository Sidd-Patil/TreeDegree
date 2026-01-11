import { memo, useMemo, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type CourseStatus = "completed" | "available" | "locked";

export type StandaloneElectivesItem = {
  id: string;
  label: string;
  title: string;
  status: CourseStatus;
  units: number;
};

export type StandaloneElectivesNodeData = {
  label?: string;
  courses: StandaloneElectivesItem[];
  onOpenCourse?: (courseId: string) => void;
};

const statusStyles: Record<
  CourseStatus,
  { bg: string; border: string; text: string }
> = {
  completed: {
    bg: "bg-gradient-to-br from-gold/90 to-completed/90",
    border: "border-gold-glow",
    text: "text-foreground",
  },
  available: {
    bg: "bg-gradient-to-br from-water/90 to-water-glow/70",
    border: "border-water-glow",
    text: "text-foreground",
  },
  locked: {
    bg: "bg-gradient-to-br from-locked/80 to-muted/60",
    border: "border-locked",
    text: "text-foreground/90",
  },
};

export const StandaloneElectivesNode = memo(({ data }: NodeProps) => {
  const nodeData = (data ?? {}) as StandaloneElectivesNodeData;
  const [open, setOpen] = useState(false);

  const title = nodeData.label ?? "Stand-alone electives";

  const courses = useMemo(() => {
    const list = Array.isArray(nodeData.courses) ? nodeData.courses : [];
    return [...list].sort((a, b) => a.label.localeCompare(b.label));
  }, [nodeData.courses]);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.03, zIndex: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={[
        "relative rounded-xl border-2 border-muted p-3",
        "min-w-[360px] max-w-[460px]",
        "bg-card/85 backdrop-blur-sm",
        "shadow-sm",
      ].join(" ")}
    >
      {/* No meaningful edges, but keep handles consistent for layout */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-background"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-bold text-lg text-foreground tracking-wide">
            {title}
          </div>
          <div className="text-sm text-muted-foreground">
            {courses.length} course{courses.length === 1 ? "" : "s"}
          </div>
        </div>

        <button
          type="button"
          className={[
            "nodrag",
            "h-10 w-10 rounded-xl border-2",
            "bg-gradient-to-br from-water/90 to-water-glow/70",
            "border-water-glow",
            "shadow-[0_0_18px_hsl(195,90%,50%/0.35)]",
            "flex items-center justify-center",
            "hover:opacity-95 transition",
          ].join(" ")}
          aria-label={open ? "Collapse stand-alone electives" : "Expand stand-alone electives"}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <ChevronDown
            className={["h-5 w-5 text-foreground transition-transform", open ? "rotate-180" : ""].join(
              " "
            )}
          />
        </button>
      </div>

      {open && (
        <div className="nodrag mt-3">
          <ScrollArea className="h-[320px] min-h-[320px] max-h-[70vh] resize-y rounded-xl border border-muted bg-background/40">
            <div className="p-2 grid grid-cols-1 gap-2">
              {courses.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3">
                  No stand-alone electives found.
                </div>
              ) : (
                courses.map((c) => {
                  const s = statusStyles[c.status] ?? statusStyles.locked;
                  const clickable = typeof nodeData.onOpenCourse === "function";

                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={[
                        "text-left",
                        "rounded-2xl border-2 p-3",
                        "backdrop-blur-sm",
                        s.bg,
                        s.border,
                        clickable ? "hover:opacity-95 transition" : "",
                      ].join(" ")}
                      title={clickable ? `Open ${c.label}` : `${c.label} — ${c.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        nodeData.onOpenCourse?.(c.id);
                      }}
                      disabled={!clickable}
                    >
                      <div className={["text-sm font-semibold truncate", s.text].join(" ")}>{c.label}</div>
                      <div className="text-xs text-foreground/80 line-clamp-1">{c.title}</div>
                      <div className="mt-1 text-xs text-foreground/60">{c.units} units</div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </motion.div>
  );
});

StandaloneElectivesNode.displayName = "StandaloneElectivesNode";
