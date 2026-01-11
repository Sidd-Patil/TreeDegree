import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const majors = [
  { value: "computer-science", label: "Computer Science (B.S.)" },
  { value: "electrical-engineering", label: "Electrical Engineering (B.S.)" },
  { value: "mathematics", label: "Mathematics (B.S.)" },
  { value: "physics", label: "Physics (B.S.)" },
  { value: "statistics-and-data-science", label: "Statistics & Data Science (B.S.)" },
  { value: "economics", label: "Economics (B.A.)" },
];

interface MajorSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export const MajorSelect = ({ value, onChange }: MajorSelectProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="w-full max-w-md"
    >
      <label className="block text-sm font-medium text-muted-foreground mb-2">
        Select Your Major
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-12 bg-card/50 backdrop-blur-sm border-2 border-muted-foreground/30 hover:border-fire/50 focus:border-fire transition-colors">
          <SelectValue placeholder="Choose your major..." />
        </SelectTrigger>
        <SelectContent className="bg-card/95 backdrop-blur-md border-2 border-muted">
          {majors.map((major) => (
            <SelectItem
              key={major.value}
              value={major.value}
              className="focus:bg-fire/20 focus:text-foreground cursor-pointer"
            >
              {major.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </motion.div>
  );
};
