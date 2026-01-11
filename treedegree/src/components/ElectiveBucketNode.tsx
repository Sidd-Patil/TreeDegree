import { useMemo } from "react";
import type { NodeProps, Node } from "@xyflow/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type CourseStatus = "completed" | "available" | "locked";

type Item = {
  id: string;
  label: string;
  title?: string;
  status?: CourseStatus;
};

export type ElectiveBucketData = {
  label: string;
  title?: string;
  items: Item[];
  onOpenCourse?: (courseId: string) => void;
};

const statusStyles: Record<CourseStatus, { bg: string; border: string; text: string }> = {
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

export type ElectiveBucketNodeType = Node<ElectiveBucketData>;

export function ElectiveBucketNode({ data }: NodeProps<ElectiveBucketNodeType>) {
  const sorted = useMemo(() => {
    const items = Array.isArray(data.items) ? data.items : [];
    return [...items].sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
  }, [data.items]);

  return (
    <div
      className={cn(
        "rounded-2xl border-2 border-muted bg-card/90 backdrop-blur-md shadow-sm",
        "px-4 py-3 w-[520px] min-h-[180px]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display font-extrabold text-3xl">{data.label}</div>
          {data.title ? (
            <div className="text-sm text-muted-foreground">{data.title}</div>
          ) : null}
          <div className="mt-1 text-lg text-muted-foreground">
            {sorted.length} elective{sorted.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="flex items-center gap-2 text-lg font-semibold text-water hover:opacity-90">
            <ChevronDown className="h-4 w-4 text-lg" />
            Show electives
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3">
            <div
              className="max-h-[260px] overflow-auto rounded-xl border border-muted bg-background/60 p-2 space-y-2"
              onWheelCapture={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              onPointerMoveCapture={(e) => e.stopPropagation()}
              onPointerUpCapture={(e) => e.stopPropagation()}
            >
              {sorted.map((it) => {
                const status: CourseStatus = it.status ?? "locked";
                const s = statusStyles[status];

                const clickable = typeof data.onOpenCourse === "function";

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onOpenCourse?.(it.id);
                    }}
                    disabled={!clickable}
                    className={cn(
                      "w-full text-left rounded-2xl border-2 p-3 backdrop-blur-sm",
                      s.bg,
                      s.border,
                      clickable ? "hover:opacity-95 transition" : ""
                    )}
                    title={clickable ? `Open ${it.label}` : it.title ? `${it.label} — ${it.title}` : it.label}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={cn("text-sm font-semibold truncate", s.text)}>
                          {it.label}
                        </div>
                        {it.title ? (
                          <div className="text-xs text-foreground/80 line-clamp-1">
                            {it.title}
                          </div>
                        ) : null}
                      </div>

                      {it.status ? (
                        <div className={cn("text-xs capitalize", s.text, "opacity-80")}>
                          {it.status}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
