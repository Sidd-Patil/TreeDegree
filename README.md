## 🌳 TreeDegree

### Inspiration

TreeDegree started from a very real frustration: trying to plan an interdisciplinary path at UCSB when majors like Computer Science, Statistics, Mathematics, and Electrical Engineering are tangled together by a web of prerequisites, hidden “OR” clauses, and catalog footnotes. On paper, it looks manageable. In practice, one missed prerequisite can push graduation back by a year.

What made this worse was that even the official catalogs flatten everything into long paragraphs:

> “PSTAT 120A; CS 9 or CS 16; and Math 4A, all with letter grade C or better…”

Humans can read that. Computers cannot.

We wanted something that showed the _structure_ of a major — not as text, but as a living dependency graph — so a student could see exactly how one course unlocks another and where alternate paths exist. That idea became TreeDegree.

---

## What it does

TreeDegree turns UCSB’s course catalog and major requirements into an interactive **skill tree**:

- Each course is a node
- Each prerequisite is an edge
- ANDs and ORs are represented explicitly
- Bottleneck courses (ones that unlock many others) are highlighted
- Completed courses automatically unlock new ones

It lets students explore:

- “If I take **MATH 3A instead of 2A**, what changes?”
- “Which course is my biggest bottleneck?”
- “Can I reach this upper-division class through multiple paths?”

The result is a visual roadmap for majors across **Computer Science, Electrical Engineering, Statistics, Mathematics, and Economics**.

---

## How we built it

TreeDegree has three layers: **data**, **logic**, and **visualization**.

### 1. Data ingestion

We start with two real university sources:

- `catalog.json` — scraped UCSB course catalog
- `major-requirements.json` — structured extraction of degree PDFs

The problem: prerequisites are written in natural language.
Example:

> `ECE 137A-B with a minimum grade of C-; open to EE majors only.`

So we built a pipeline:

[
\text{Raw Text} ;\xrightarrow{\text{LLM}}; \text{Logical Prerequisite Tree}
]

Using a local LLM (via Ollama, `gptos:20b`), we convert every prerequisite into **Disjunctive Normal Form**:

[
\text{ECE 130A-B or (MATH 4A and PHYS 7A)}
;;\Rightarrow;;
[[\text{ECE 130A}, \text{ECE 130B}], [\text{MATH 4A}, \text{PHYS 7A}]]
]

This becomes `prerequisites_dnf` inside `clean-catalog.json`.

We then validate all outputs against the actual catalog to eliminate hallucinated courses.

---

### 2. Major graph generation

From `major-requirements.json`, we extract:

- Required courses
- Optional OR paths
- Elective pools (collapsed into buckets)

We combine that with `clean-catalog.json` to produce:

```
generated-majors/computer-science.json
generated-majors/electrical-engineering.json
...
```

Each file is a clean list of nodes:

- Required courses
- Support prerequisites
- Elective buckets

Each node includes:

```ts
{
  id: "ECE 145A",
  title: "Communication Electronics",
  units: 5,
  prerequisites_dnf: [["ECE 137A", "ECE 137B"]],
}
```

---

### 3. Visual graph engine

On the frontend we use **React Flow** to render the dependency graph.

To make OR logic visible, we generate **logic gates**:

- Single prereq → direct edge
- AND prereqs → AND gate
- OR prereqs → OR gate

So a rule like:

[
(A \wedge B) ;\vee; C
]

becomes

```
A ─┐
   ├─ AND ─┐
B ─┘        ├─ OR ──> Course
C ─────────┘
```

That’s how TreeDegree makes the hidden structure of majors visible.

---

## Challenges we ran into

### 1. Natural language is messy

Catalog prerequisites include:

- grade minimums
- major restrictions
- prose
- hyphenated sequences
- cross-listed courses

We had to isolate **just the logical course structure** and ignore everything else.

### 2. OR logic breaks naive graphs

Traditional prerequisite trees assume everything is an AND.
But real majors use OR everywhere:

- CS 9 **or** CS 16
- Math 2A–2B **or** 3A–3B

Without gates, graphs become misleading.

### 3. Noise vs clarity

If we include every elective and every possible option, the graph becomes unreadable.
So we built **collapsed elective buckets** that preserve rules but don’t overwhelm the UI.

---

## Accomplishments that we're proud of

- A full **LLM-powered prerequisite compiler**
- A **DNF-based logical representation** of real university rules
- A **visual OR/AND gate system** inside a ReactFlow UI
- Support for **five real UCSB majors**
- Detection of **bottleneck courses** that control large parts of the degree

Most importantly: this system works on _real university data_, not toy examples.

---

## What we learned

We learned that:

- University curricula are actually **formal logic systems** disguised as prose.
- LLMs are extremely powerful when used as **structured translators**, not generators.
- Visualizing logic makes planning dramatically easier for humans.

We also learned that good data modeling matters more than flashy UI.

---

## What's next for TreeDegree

Next we plan to add:

- 📜 Transcript upload → automatic “what’s unlocked?”
- 📊 Graduation timeline simulation
- 🔀 “What-if” path comparisons
- 🎓 Advisor mode for counselors
- 🧠 Major-to-major overlap analysis

TreeDegree is evolving into a **navigation system for education** — helping students see not just what they must take, but _why_, _when_, and _how_ it all fits together.
