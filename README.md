# AI Powered DSA LeetCode Visualizer

Step-by-step interactive visualizer for LeetCode-style C++ algorithms. Your solution runs in an **instrumented C++ sandbox** that compiles locally and emits a high-fidelity JSON event trace; an optional LLM (Ollama/Groq) adds beginner-friendly messages; the browser replays the trace frame by frame.

---

## 🚀 Key Features

*   **Dynamic LeetCode Importer**: Paste any LeetCode problem URL to fetch official descriptions, constraints, default test cases, and starter templates.
*   **AI-Orchestrated Concept Discovery**: Discovers 2-4 distinct conceptual approaches for each problem (e.g., Two Pointers, Monotonic Stack, Heap, DFS) and lists them as interactive cards.
*   **Automatic Tracer Auto-Instrumentation**: Click any concept card to generate optimal C++ code fully instrumented with Visualizer Tracing Macros.
*   **Neon Complexity Analytics**: Dynamic O(Time) and O(Space) glows matching computational growth curves (Constant, Logarithmic, Linear, Linearithmic, Quadratic, Exponential) alongside an active growth chart and detailed allocations breakdown.
*   **Advanced String-to-ASCII Translation**: Seamlessly visualizes non-integer arrays by auto-converting strings into ASCII integer codes for standard C++ compilation, then mapping them back to characters inside browser cells.
*   **Split-Pane View**: Non-congested, LeetCode-inspired panels displaying code execution stacks, variables, commentaries, and data structures.

---

## 🛠️ Prerequisites

- **Node.js** 18+
- **g++** with C++17 (`g++ --version`)
- **Optional:** [Ollama](https://ollama.com) with `llama3` for local commentary
- **Optional:** [Groq API key](https://console.groq.com) in `.env` as `GROQ_API_KEY` if Ollama is not running (if a key was ever committed to git, rotate it in the Groq console)

---

## 🏃‍♂️ Quick Start

```bash
npm install
cp .env.example .env   # optional: set GROQ_API_KEY and/or PORT
npm start
```

Open **http://localhost:3005** (or `http://localhost:$PORT` if you set `PORT` in `.env`). One command serves both the UI and API.

For detailed tracking of active development checkpoints, see [milestones.md](file:///Users/ganesh/Desktop/DSA_LC_Visualizer/milestones.md).

---

## 📖 Usage Workflow

1.  **Paste LeetCode URL**: Put any problem URL (e.g., `https://leetcode.com/problems/longest-substring-without-repeating-characters/`) in the input box and click **Fetch**.
2.  **Select Conceptual Approach**:
    *   Once fetched, alternative concepts populate the **Concepts** tab on the left.
    *   Review their respective summaries and time/space complexities.
    *   Click a concept card to auto-generate the instrumented C++ code in the Monaco Editor and populate the Complexity Dashboard.
3.  **Run Simulation**: Click **Generate Trace & AI Commentary** (or select **Skip AI commentary** for instant deterministic text).
4.  **Replay Frames**:
    *   Use **Prev / Next** or the **step scrubber** slider to trace pointers, stack, queue, map, heap, tree, or grid modifications.
    *   Collapsible **Step List** provides a tabular log of all actions.
    *   Use keyboard arrows (**Left/Right**) or **Home/End** to jump steps.
5.  **Manual Code Editing**: Modify the code as needed. Make sure you use the Visualizer SDK macros where necessary if you write custom logic.

---

## 🧰 Visualizer SDK (C++ Macros)

Standard C++ `stack`, `queue`, `deque`, `priority_queue`, and `unordered_map` are macro-wrapped. Use the following explicit helpers inside the `class Solution` code:

| Helper | Use Case |
| :--- | :--- |
| `compare(i, j)` | Highlight array index comparison |
| `resolve(idx, value)` | Mark index as resolved (e.g., assigned answer) |
| `visit(node)` | Highlight tree/list traversal |
| `focus_cell(r, c)` / `update_cell(r, c, val)` | Grid DFS/BFS coordinates |
| `focus_node(ptr, "label")` / `update_next(from, to)` | Linked list nodes & pointer re-wiring |
| `priority_queue<int>` / `VisualizerPriorityQueue` | Priority heap push/pop |
| `VisualizerMap` | Hash map operations (`map_put`, `map_get`, `map_erase`) |
| `focus_pointer("label", index)` | Float a pointer badge (e.g. "left", "right") under array cells |

---

## 📈 Complexity Glow Metrics

Algorithms are annotated with glowing neon borders indicating growth speed:
*   🟢 **Teal / O(1)**: Constant Complexity
*   🔵 **Cyan / O(log N)**: Logarithmic Complexity
*   🟢 **Green / O(N)**: Linear Complexity
*   🟡 **Yellow / O(N log N)**: Linearithmic Complexity
*   🟠 **Orange / O(N²)**: Quadratic Complexity
*   🔴 **Crimson / O(2ᴺ)**: Exponential Complexity

---

## 🔌 API Endpoints

### `POST /leetcode`
*   **Body**: `{ "url": "https://leetcode.com/problems/..." }`
*   **Description**: Pulls problem details from LeetCode GraphQL and invokes the LLM to return standard alternative concepts.

### `POST /leetcode/solve-concept`
*   **Body**: `{ "title", "difficulty", "content", "cppSnippet", "conceptId", "conceptName", "conceptSummary", "array" }`
*   **Description**: Generates fully-coded, trace-instrumented C++ solutions matching the selected concept, default visualizer input format, complexities, and expected edge cases.

### `POST /generate`
*   **Body**: `{ "code", "array", "is2D?", "isGraph?", "graphNodes?", "graphEdges?", "noAI?" }`
*   **Description**: Injects C++ solution into the sandbox `runner.cpp`, compiles it using `g++`, runs the compiled executable to stream a state trace, and optional merges AI commentaries.

---

## 🛡️ Security Note

The `/generate` endpoint compiles and executes arbitrary C++ code inside a local subprocess with a 10s execution cap. This server should only be run **locally** or inside a strictly sandboxed, isolated container environment.
