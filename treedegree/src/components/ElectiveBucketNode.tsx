import { useMemo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Item = {
  id: string;
  label: string;
  title?: string;
  status?: "completed" | "available" | "locked";
};

export type ElectiveBucketData = {
  label: string;
  title?: string;
  items: Item[];
  onOpenCourse?: (courseId: string) => void; // ✅ NEW
};

// inside ElectiveBucketNode (top-level in the file)
function statusColor(status?: "completed" | "available" | "locked") {
  // EXACTLY matches your SkillTree MiniMap mapping
  if (status === "completed") return "hsl(142, 70%, 45%)";
  if (status === "available") return "hsl(195, 90%, 50%)";
  return "hsl(220, 10%, 35%)";
}

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
            <div className="text-sm text-muted-foreground text-red-500">{data.title}</div>
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
              className="max-h-[260px] overflow-auto rounded-xl border border-muted bg-background/60 p-2 space-y-1"
              onWheelCapture={(e) => {
                // prevent ReactFlow from zooming/panning
                e.stopPropagation();
              }}
              onPointerDownCapture={(e) => {
                // prevent drag-pan starting from inside the list
                e.stopPropagation();
              }}
              onPointerMoveCapture={(e) => {
                e.stopPropagation();
              }}
              onPointerUpCapture={(e) => {
                e.stopPropagation();
              }}
            >
              {sorted.map((it) => {
                const done = it.status === "completed";
                const c = statusColor(it.status);

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // don't select bucket node / pan
                      data.onOpenCourse?.(it.id); // ✅ open modal
                    }}
                    className={cn(
                      "w-full text-left rounded-lg border px-6 py-4 transition",
                      done
                        ? [
                            // ✅ EXACT same color as the mapping
                            "bg-[hsl(142,70%,45%)]",
                            "border-[hsl(142,70%,45%)]",
                            // readable text on green background
                            "text-white",
                          ].join(" ")
                        : "border-muted bg-background hover:bg-muted/40"
                    )}
                    // keep map (helper) untouched; we only use it for optional accents
                    style={
                      done
                        ? undefined
                        : {
                            boxShadow: `inset 6px 0 0 0 ${c}`,
                          }
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={cn(
                          "font-semibold text-lg",
                          done ? "text-white" : "text-foreground"
                        )}
                      >
                        {it.label}
                      </div>

                      {it.status ? (
                        <div
                          className={cn(
                            "text-sm",
                            done ? "text-white/90" : "text-muted-foreground"
                          )}
                        >
                          {it.status}
                        </div>
                      ) : null}
                    </div>

                    {it.title ? (
                      <div
                        className={cn(
                          "text-sm",
                          done ? "text-white/80" : "text-muted-foreground"
                        )}
                      >
                        {it.title}
                      </div>
                    ) : null}
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
