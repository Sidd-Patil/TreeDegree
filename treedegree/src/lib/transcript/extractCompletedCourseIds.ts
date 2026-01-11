import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// Vite-friendly worker URL
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

// Matches e.g. "CMPSC 130A", "PSTAT-120A", "ECE 3", "MATH 3A"
const COURSE_REGEX = /\b([A-Z]{2,8})\s*[- ]\s*([0-9]{1,3}[A-Z]?)\b/g;

export function normalizeCourseId(subject: string, number: string): string {
  const s = subject.trim().toUpperCase();
  const n = number.trim().toUpperCase().replace(/\s+/g, "");
  return `${s}-${n}`;
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    // `item` typing in pdfjs is awkward in TS; this is safe for our use.
    text +=
      content.items
        .map((item) => (typeof (item as any)?.str === "string" ? (item as any).str : ""))
        .join(" ") + " ";
  }

  return text;
}

export async function extractCompletedCourseIds(file: File): Promise<string[]> {
  if (file.type !== "application/pdf") return [];

  const text = await extractPdfText(file);

  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = COURSE_REGEX.exec(text)) !== null) {
    const subject = match[1];
    const number = match[2];
    ids.add(normalizeCourseId(subject, number));
    // Mirror catalog indexing behavior for W-suffixed subjects (e.g. PSTATW -> PSTAT)
    if (subject.endsWith("W") && subject.length > 2) {
      ids.add(normalizeCourseId(subject.slice(0, -1), number));
    }
  }

  return Array.from(ids);
}
