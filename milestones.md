# Antigravity DSA LeetCode Visualizer — Project Milestones

This document tracks completed milestones, active work items, and future feature expansion tracks for the **Antigravity DSA LeetCode Visualizer**. Use this as the live checklists to verify features.

---

## 🎯 Project Overview & Vision
The **Antigravity DSA LeetCode Visualizer** is a high-fidelity, interactive sandbox application. It allows developers to:
1. Fetch any arbitrary LeetCode problem description and C++ starter snippet dynamically.
2. Generate optimal solutions under several conceptual approaches (Two-Pointers, Hash Map, Stack, Sliding Window, DFS/BFS, Tree/Graph, Heaps).
3. Auto-instrument solutions with our **C++ Visualizer Tracing Macros** via LLM.
4. Execute the C++ code inside a sandboxed runner, compile it locally, and stream exact execution frame states.
5. Replay arrays, matrices, heaps, hash maps, binary trees, deques, and graphs alongside a modern LeetCode-like split-pane view with real-time AI explanations and Big-O curves.

---

## 🟢 Phase 1: Sandboxed Execution Engine
**Status:** Completed & Fully Stable  
*Robust backend compiler pipeline for local execution.*

- [x] **Local `g++` Sandbox Pipeline**: Set up dynamic wrapping of code into `runner.cpp`, compile via `g++ -std=c++17`, and execute with a strict 10s security timeout.
- [x] **Failsafe Compiler Fallback**: Implemented a fallback mechanism where, if instrumented compilation fails, the code falls back gracefully or reports detailed linting/compiler errors back to the editor console.
- [x] **Tracing Macro Core (`runner.cpp`)**: Added explicit C++ macros:
  * `compare(i, j)` - Array index/value comparison highlighting.
  * `resolve(i, val)` - Result resolution mapping.
  * `visit(node)` - Tree node traversal.
  * `focus_pointer(label, idx)` - Left/right/mid pointer badge tracking.
  * `focus_cell(r, c)` & `update_cell(r, c, v)` - 2D grid highlights.
  * `focus_node(node, label)` & `update_next(from, to)` - Linked list/tree edge tracking.
  * `VisualizerMap` / `VisualizerPriorityQueue` - Wrap std STL containers to emit structural updates implicitly.
- [x] **Trace JSON Output**: Standardized streaming trace output stored in `latest_trace.json` containing detailed chronologies of stack, array, pointer, queue, and node changes.

---

## 🟢 Phase 2: Dual-Container UI Shell & Panels
**Status:** Completed & Fully Stable  
*High-end interactive dashboard matching modern dark UI aesthetics.*

- [x] **LeetCode-Inspired Split Pane Layout**:
  * **Left Side**: Collapsible Tabs for Problem Description, Dynamic Editorial, and Alternative Concepts.
  * **Right Side**: Monaco Code Editor (Top-right) and Dynamic Animation Panel (Bottom-right).
- [x] **Visual Representation Panels**:
  * **Array Panel**: Renders horizontal memory cell arrays with dual pointer badges floating below.
  * **Stack/Queue/Deque Panel**: Vertical container showcasing pushes, pops, and deque double-ended shifts.
  * **Binary Tree Panel**: SVGs/HTML structures visualizing preorder/postorder traversal and current visitor focus.
  * **2D Grid Panel**: 2D heat-mapped visual matrices for DFS/BFS path finding.
  * **Linked List Panel**: Pointer chains (`A -> B -> C`) dynamically adjusting as references rewire.
  * **Priority Heap Panel**: Standard tree hierarchy representing priority queue element shifts.
  * **Hash Map Panel**: Key-value lookup slots highlighting inserts and lookups.
  * **Graph Panel**: Visual force/adjacency edge diagrams showing node traversals.
- [x] **Scrubber Playback Controls**:
  * **Prev / Next step buttons** with direct keyboard arrow support (`Right`/`Left`).
  * **Jump to start / End** with arrow hotkeys (`Home`/`End`).
  * **Autoplay loop** with continuous range slider for adjusting delay intervals (saved in `localStorage`).
  * **Step List panel**: Collapsible sidebar listing all generated actions for immediate jump-to-step.

---

## 🟢 Phase 3: AI Commentary & Local Pipelines
**Status:** Completed & Fully Stable  
*Bridging raw C++ execution traces with human-readable learning logs.*

- [x] **Dual AI Backend Support**:
  * Local **Ollama** (`llama3`) setup for offline usage.
  * Remote **Groq API** key connection (`.env` configuration) for instant, cloud-accelerated inference.
- [x] **No-AI Deterministic Fallbacks**: Implemented `messageFromAction()` so that the visualizer functions flawlessly with zero API key configuration (`noAI: true` / **Skip AI commentary** option).
- [x] **Commentary Merger**: Backend merges LLM explanation vectors matching the trace step indices, with fallback safeguards in case of LLM array length mismatch.

---

## 🟢 Phase 4: Dynamic LeetCode Importer & Selector
**Status:** Completed & Fully Stable  
*Dynamic problem fetching and concept-based automatic code refactoring.*

- [x] **LeetCode GraphQL Fetcher**: Backend extracts question slug from pasted URL and pulls official description, constraints, and standard inputs directly from LeetCode.
- [x] **Multi-Concept Discovery**: Rather than generating a single solution, the backend discovers 2-4 standard conceptual approaches (e.g. Brute Force, Hash Map, Optimized Two-Pointers) and presents them as rich selectable cards.
- [x] **Interactive Concept Cards**: Clicking a card makes an API request to solve and auto-instrument that specific conceptual approach, populating the Monaco editor instantly.
- [x] **Difficulty Badging**: Dynamic "Easy", "Medium", and "Hard" status indicators adapting to the imported problem's metadata.

---

## 🟢 Phase 5: Complexities Dashboard & String Traces
**Status:** Completed & Fully Stable  
*Advanced metadata analytics and robust handling of non-integer string visual arrays.*

- [x] **Neon Complexity Cards**: Renders dynamic O(Time) and O(Space) badging with glowing neon borders based on time complexity types:
  * Constant (`O(1)`) - Teal glow
  * Logarithmic (`O(log N)`) - Cyan glow
  * Linear (`O(N)`) - Green glow
  * Linearithmic (`O(N log N)`) - Yellow/Gold glow
  * Quadratic (`O(N^2)`) - Orange glow
  * Exponential (`O(2^N)`) - Crimson/Red glow
- [x] **Neon Growth Curve Chart**: Renders standard comparison charts showing where the chosen algorithm stands in the hierarchy of computational growth curves.
- [x] **String-to-ASCII Auto-detection**:
  * Auto-detects C++ string problems (e.g., `lengthOfLongestSubstring`).
  * Converts input string characters to their decimal ASCII codes in the sandboxed C++ executor (`nums` vector).
  * Automatically maps decimal codes back to readable characters in the browser's array panel, enabling full visualization of sliding window string problems like "abcabcbb".
- [x] **Viewport Adjustment & Responsive Bounds**: Ensure zero congestion when description panel and code panel change in widths.

---

## 🔵 Phase 6: Batch Verification & Test Suites
**Status:** Future Work  
*Enabling batch executions, multi-test comparisons, and exports.*

- [ ] **Multi-case Tabs**: Enable concurrent visual trace tracking where a user can toggle between different input test cases seamlessly.
- [ ] **Download / Import Trace Cache**: Allow exporting the generated traces to a `.json` file and importing them back offline without requiring the server or `g++` compilers.
- [ ] **Local Code Preserves**: Store local editor changes in the browser's storage so that closing the tab preserves the user's manual instrumentations.

---

## 📋 Daily Task Tracker (Granular Progress)

### Bug Fixes & Refinements (Completed)
- [x] **Invisible Problem Name**: Removed the solid white background on `.problem-header h1` and styled it with clean, high-contrast typography fitting our dark theme.
- [x] **Editor & Playback Sync**: Fixed the `render()` logic so that when a new LeetCode URL is fetched, the old highlighted trace viewer is hidden, the editable text area is restored, and all visual containers are thoroughly cleared/reset.
- [x] **Auto-select Concept Card**: Automatically select and trigger the click of the first approach card on successful fetch. This prevents code/input mismatches and immediately kicks off sandboxed compilation for the correct problem.
- [x] **Consolidated State Clears**: Reset visualizer states when templates are changed or the URL input is cleared.
- [x] **Safe C++ Variable & Vector Initializations**: Formatted C++ main entry scaffolds to dynamically cast non-numeric values to clean numeric integer counterparts or empty structures when not executing active lists, preventing compilation breakages like `use of undeclared identifier 'abcabcbb'`.

### High Priority
- [x] Create comprehensive `milestones.md` track file.
- [x] Update `README.md` to document the new **LeetCode Importer** and **Conceptual approaches** UI.
- [x] Update `architecture.md` to detail the **String-to-ASCII** trace mapping engine.
- [x] Spin up and verify the server visually using the sliding window string template to confirm CSS margins are clean.
- [x] Ensure non-congested display for standard sliding-window margins on smaller screens.

### Documentation Upkeep
- [x] Document all visualizer action enums added for heap/maps and pointers.
- [x] Link `milestones.md` directly into the README.
