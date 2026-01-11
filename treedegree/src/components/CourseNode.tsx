import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Lock, Flame, Star } from "lucide-react";

export type CourseStatus = "completed" | "available" | "locked";

export interface CourseNodeData extends Record<string, unknown> {
  label: string;
  title: string;
  status: CourseStatus;
  units: number;
  unlocksCount?: number;
}

const statusStyles: Record<CourseStatus, {
  bg: string;
  border: string;
  glow: string;
  icon: React.ReactNode;
}> = {
  completed: {
    bg: "bg-gradient-to-br from-gold/90 to-completed/90",
    border: "border-gold-glow",
    glow: "shadow-[0_0_25px_hsl(45,100%,55%/0.6)]",
    icon: <Star className="h-4 w-4 text-gold-glow animate-pulse" />,
  },
  available: {
    bg: "bg-gradient-to-br from-water/90 to-water-glow/70",
    border: "border-water-glow",
    glow: "shadow-[0_0_25px_hsl(195,90%,50%/0.6)]",
    icon: <Flame className="h-4 w-4 text-water-glow animate-pulse" />,
  },
  locked: {
    bg: "bg-gradient-to-br from-locked/80 to-muted/60",
    border: "border-locked",
    glow: "",
    icon: <Lock className="h-4 w-4 text-muted-foreground" />,
  },
};

export const CourseNode = memo(({ data }: NodeProps) => {
  const nodeData = data as unknown as CourseNodeData;
  const { label, title, status, units, unlocksCount } = nodeData;
  const styles = statusStyles[status];
  

  

  return (
    
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05, zIndex: 10 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`
        relative rounded-xl border-2 p-3 min-w-[140px] backdrop-blur-sm
        ${styles.bg} ${styles.border} ${styles.glow}
        cursor-pointer transition-all duration-300
      `}
    >
      {/* Handles for connections */}
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

      {/* Status icon */}
      <div className="absolute -top-2 -right-2 rounded-full bg-background/80 p-1">
        {styles.icon}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1">
        <div className="font-display font-bold text-2xl text-foreground tracking-wide">
          {label}
        </div>
        <div className="text-base text-foreground/80 line-clamp-2 font-body">
          {title}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-foreground/60 font-medium">
            {units} units
          </span>
          {unlocksCount && unlocksCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-background/30 text-foreground/80">
              Unlocks {unlocksCount}
            </span>
          )}
        </div>
      </div>

      {/* Lock overlay for locked courses */}
      {status === "locked" && (
        <div className="absolute inset-0 rounded-xl bg-background/40 backdrop-blur-[1px] flex items-center justify-center">
          <Lock className="h-6 w-6 text-muted-foreground/60" />
        </div>
      )}
    </motion.div>
  );
});

CourseNode.displayName = "CourseNode";
