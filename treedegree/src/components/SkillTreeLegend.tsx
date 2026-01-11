import { motion } from "framer-motion";
import { Star, Flame, Lock } from "lucide-react";

const legendItems = [
  {
    label: "Completed",
    icon: <Star className="h-4 w-4" />,
    bgClass: "bg-gradient-to-r from-gold/80 to-completed/80",
    glowClass: "shadow-[0_0_15px_hsl(45,100%,55%/0.5)]",
  },
  {
    label: "Available",
    icon: <Flame className="h-4 w-4" />,
    bgClass: "bg-gradient-to-r from-water/80 to-water-glow/60",
    glowClass: "shadow-[0_0_15px_hsl(195,90%,50%/0.5)]",
  },
  {
    label: "Locked",
    icon: <Lock className="h-4 w-4" />,
    bgClass: "bg-gradient-to-r from-locked/80 to-muted/60",
    glowClass: "",
  },
];

export const SkillTreeLegend = () => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 left-4 z-10"
    >
      <div className="rounded-xl border-2 border-muted bg-card/90 backdrop-blur-md p-4">
        <h3 className="font-display font-semibold text-sm text-foreground mb-3">
          Course Status
        </h3>
        <div className="flex flex-col gap-2">
          {legendItems.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-2"
            >
              <div
                className={`
                  rounded-lg p-1.5 ${item.bgClass} ${item.glowClass}
                  flex items-center justify-center
                `}
              >
                {item.icon}
              </div>
              <span className="text-sm text-foreground/80 font-body">
                {item.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
