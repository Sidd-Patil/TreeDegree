import express from "express";
import cors from "cors";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/recommender", async (req, res) => {
  try {
    const { majorSlug, userMessage, courses } = req.body;

    const prompt = `
Major: ${majorSlug}
User intent: ${userMessage}

Available courses (IDs must be used exactly):
${JSON.stringify(courses, null, 2)}

Return which courses form the best path for the user's goal.
    `.trim();

const response = await openai.responses.parse({
  model: "gpt-4o-mini",
  input: [
    { role: "system", content: "Return only JSON that matches the schema." },
    { role: "user", content: prompt },
  ],
  text: {
    format: {
      type: "json_schema",
      name: "course_recommender",
      strict: true,
      schema: {
        type: "object",
        properties: {
          message: { type: "string" },
          targets: { type: "array", items: { type: "string" } },
        },
        required: ["message", "targets"],
        additionalProperties: false,
      },
    },
  },
});

const data = response.output_parsed;
res.json(data);

  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ message: "AI error", targets: [] });
  }
});

app.get("/health", async (req, res) => {
  res.json({ status: "ok" });
});

app.listen(3001, () => {
  console.log("AI recommender server running on http://localhost:3001");
});
