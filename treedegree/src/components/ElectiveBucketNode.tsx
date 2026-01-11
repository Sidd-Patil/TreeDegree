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
          <div className="font-display font-extrabold text-lg">{data.label}</div>
          {data.title ? (
            <div className="text-sm text-muted-foreground">{data.title}</div>
          ) : null}
          <div className="mt-1 text-xs text-muted-foreground">
            {sorted.length} elective{sorted.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold text-water hover:opacity-90">
            <ChevronDown className="h-4 w-4" />
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

              {sorted.map((it) => (
                <div
                  key={it.id}
                  className="rounded-lg border border-muted bg-background px-2 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold">{it.label}</div>
                    {it.status ? (
                      <div className="text-xs text-muted-foreground">{it.status}</div>
                    ) : null}
                  </div>
                  {it.title ? (
                    <div className="text-xs text-muted-foreground">{it.title}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
