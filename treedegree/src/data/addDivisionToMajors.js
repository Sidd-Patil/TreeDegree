import fs from "fs";
import path from "path";

const MAJORS_DIR = "./generated-majors";

/**
 * Extracts the numeric part from a label like:
 *  "CMPSC 130A" -> 130
 *  "PSTAT 8"   -> 8
 *  "ECE 154B"  -> 154
 */
function getCourseNumber(label) {
  const match = label.match(/(\d+)/);
  if (!match) return null;
  return match[1]; // string of digits
}

/**
 * Decide division based on digit count
 */
function getDivision(label) {
  const num = getCourseNumber(label);
  if (!num) return "lower"; // safe default

  return num.length === 3 ? "upper" : "lower";
}

// Loop through all JSON files
const files = fs.readdirSync(MAJORS_DIR).filter(f => f.endsWith(".json"));

for (const file of files) {
  const filePath = path.join(MAJORS_DIR, file);
  const raw = fs.readFileSync(filePath, "utf8");
  const courses = JSON.parse(raw);

  const updated = courses.map(course => {
    return {
      ...course,
      division: getDivision(course.label)
    };
  });

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  console.log(`Updated ${file}`);
}

console.log("All majors updated with division field.");
