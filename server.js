require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3005;
const EXEC_TIMEOUT_MS = 10000;
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `
You are an expert algorithm explainer. 
You are given a mathematically perfect JSON trace of an algorithm's execution steps.
Your ONLY job is to write a beginner-friendly "message" string for each step explaining what happened.

CRITICAL RULES:
1. DO NOT return the original JSON. 
2. Return ONLY a JSON object with a single key "messages" containing an array of strings.
3. The array of strings MUST have exactly the same length as the number of steps in the provided trace.
4. Return ONLY valid JSON, no markdown formatting blocks, no conversational text.
`;

function messageFromAction(step) {
    const a = step.action;
    switch (a) {
        case 'focus_array':
            return `Focusing on index ${step.index} (value ${step.value}).`;
        case 'push_stack':
            return `Pushed index ${step.index} onto the stack (value ${step.value ?? step.index}).`;
        case 'pop_stack':
            return `Popped index ${step.index} from the stack.`;
        case 'compare':
            return `Comparing stack top index ${step.stackTopIndex} (value ${step.stackTopValue}) with array index ${step.arrayIndex} (value ${step.arrayValue}).`;
        case 'resolve':
            return `Resolved index ${step.index} with value ${step.resolvedValue}.`;
        case 'push_queue':
            return `Enqueued index ${step.index} (value ${step.value ?? step.index}).`;
        case 'pop_queue':
            return `Dequeued index ${step.index}.`;
        case 'push_back_deque':
            return `Pushed index ${step.index} to the back of the deque.`;
        case 'pop_front_deque':
            return `Popped index ${step.index} from the front of the deque.`;
        case 'pop_back_deque':
            return `Popped index ${step.index} from the back of the deque.`;
        case 'init_tree':
            return 'Initialized binary tree structure.';
        case 'tree_node':
            return `Tree node with value ${step.val}.`;
        case 'visit_tree_node':
            return `Visiting tree node (value ${step.val}).`;
        case 'init_grid':
            return `Initialized ${step.rows}×${step.cols} grid.`;
        case 'grid_cell':
            return `Grid cell (${step.row}, ${step.col}) = ${step.val}.`;
        case 'focus_cell':
            return `Focusing on cell (${step.row}, ${step.col}).`;
        case 'update_cell':
            return `Updated cell (${step.row}, ${step.col}) to ${step.val}.`;
        case 'init_list':
            return 'Initialized linked list structure.';
        case 'list_node':
            return `List node with value ${step.val}.`;
        case 'focus_node':
            return `Pointer "${step.label}" at node ${step.ptr}.`;
        case 'update_next':
            return `Updated next pointer from ${step.from} to ${step.to}.`;
        case 'init_heap':
            return 'Initialized priority heap (min-heap by index).';
        case 'push_heap':
            return `Pushed index ${step.index} onto heap (value ${step.value ?? step.index}).`;
        case 'pop_heap':
            return `Popped index ${step.index} from heap.`;
        case 'init_map':
            return 'Initialized hash map.';
        case 'map_put':
            return `Map put: key ${step.key} → value ${step.val}.`;
        case 'map_get':
            return `Map get: key ${step.key} (value ${step.val}).`;
        case 'map_erase':
            return `Map erased key ${step.key}.`;
        case 'init_graph':
            return `Initialized graph with ${step.nodes} node(s).`;
        case 'graph_edge':
            return `Added edge ${step.u} → ${step.v}.`;
        case 'visit_graph_node':
            return `Visiting graph node ${step.node} (value ${step.val}).`;
        case 'focus_edge':
            return `Focusing on edge (${step.u}, ${step.v}).`;
        case 'focus_pointer':
            return `Pointer "${step.label}" at index ${step.index}.`;
        case 'push_frame':
            return `Entering recursive frame: ${step.name}(${step.args || ''}).`;
        case 'pop_frame':
            return `Exiting recursive frame.`;
        case 'finish':
            return 'Algorithm finished.';
        default:
            return `Executed action: ${a}.`;
    }
}

function applyStepMessages(steps, messages) {
    if (!messages || !Array.isArray(messages) || messages.length !== steps.length) {
        console.warn(
            `LLM message count mismatch: expected ${steps.length}, got ${messages?.length ?? 0}. Using deterministic fallback.`
        );
        steps.forEach((step) => {
            step.message = messageFromAction(step);
        });
        return;
    }
    steps.forEach((step, idx) => {
        const msg = messages[idx];
        step.message = (typeof msg === 'string' && msg.trim()) ? msg.trim() : messageFromAction(step);
    });
}

// Unified LLM Query Helper supporting Ollama (llama3) and falling back to Groq
async function runLLM(prompt, systemPrompt, formatJson = false) {
    let responseText = "";
    try {
        const body = {
            model: 'llama3',
            prompt: prompt,
            system: systemPrompt,
            stream: false
        };
        if (formatJson) body.format = 'json';

        const ollamaRes = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!ollamaRes.ok) throw new Error("Ollama failed or not running");
        const data = await ollamaRes.json();
        responseText = data.response;
        console.log("Successfully queried local Ollama (Llama 3)!");
    } catch (e) {
        console.log("Local Ollama not available or failed. Using Groq API fallback...");
        if (!GROQ_API_KEY) {
            throw new Error("No LLM key or Ollama available");
        }
        const body = {
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ]
        };
        if (formatJson) {
            body.response_format = { type: "json_object" };
        }
        const groqRes = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(body)
        });
        if (!groqRes.ok) {
            const errData = await groqRes.json();
            throw new Error(`Groq API Error: ${errData.error?.message || groqRes.statusText}`);
        }
        const data = await groqRes.json();
        responseText = data.choices[0].message.content;
        console.log("Successfully queried Groq API (llama-3.1-8b)!");
    }
    return responseText;
}

function balanceBraces(code) {
    let openBraces = 0;
    const lines = code.split('\n');
    let cleanCode = '';
    for (let line of lines) {
        const commentIdx = line.indexOf('//');
        if (commentIdx !== -1) {
            line = line.substring(0, commentIdx);
        }
        cleanCode += line + '\n';
    }

    for (let char of cleanCode) {
        if (char === '{') openBraces++;
        else if (char === '}') openBraces--;
    }

    if (openBraces > 0) {
        let suffix = '';
        for (let i = 0; i < openBraces; i++) {
            if (i === openBraces - 1 && code.includes('class Solution')) {
                suffix += '\n};';
            } else {
                suffix += '\n}';
            }
        }
        console.log(`[balanceBraces] Added ${openBraces} missing closing brace(s).`);
        return code + suffix;
    }
    return code;
}

app.post('/leetcode', async (req, res) => {
    try {
        const { url } = req.body;
        const match = url.match(/problems\/([^\/]+)/);
        if (!match) return res.status(400).json({ error: "Invalid LeetCode URL" });
        const titleSlug = match[1];

        // 1. Fetch extensive problem metadata from LeetCode public GraphQL
        const query = {
            operationName: "questionData",
            variables: { titleSlug },
            query: `query questionData($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionId
                    title
                    content
                    difficulty
                    exampleTestcases
                    codeSnippets {
                        langSlug
                        code
                    }
                }
            }`
        };
        
        const lcRes = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(query)
        });
        const data = await lcRes.json();
        
        if (!data.data || !data.data.question) {
            return res.status(404).json({ error: "LeetCode question not found" });
        }
        
        const question = data.data.question;
        const cppSnippet = question.codeSnippets.find(s => s.langSlug === 'cpp')?.code || "";
        const testcases = question.exampleTestcases ? question.exampleTestcases.split('\n') : [];
        let firstTest = testcases[0] || "";
        firstTest = firstTest.replace('[', '').replace(']', '').replace(/,/g, ', ').trim();

        // 2. Query LLM to discover standard C++ solution approaches/concepts for this problem
        const systemPrompt = `You are a world-class DSA professor.
You are given a LeetCode problem description, C++ starter snippet, and example test cases.
Your task is to identify 2 to 4 distinct conceptual approaches (e.g. Naive Brute Force, Monotonic Stack, Two Pointers, Hash Map, Binary Search, Heap) that are commonly used to solve this problem.
Return a valid JSON object matching the following structure:
{
  "concepts": [
    {
      "id": "A unique lowercase id like brute_force, monotonic_stack, etc.",
      "name": "The standard name of the concept (e.g., 'Monotonic Stack (Optimal)')",
      "summary": "1-2 sentences explaining the main idea of this approach.",
      "timeComplexity": "Big-O time complexity (e.g., 'O(N)')",
      "spaceComplexity": "Big-O space complexity (e.g., 'O(N)')"
    }
  ]
}`;

        const prompt = `Problem Title: ${question.title}
Difficulty: ${question.difficulty}
Problem Statement: ${question.content.replace(/<[^>]*>/g, '')}
C++ Starter Snippet:
\`\`\`cpp
${cppSnippet}
\`\`\`
Example Test Case: ${question.exampleTestcases}`;

        console.log(`Discovering solution concepts for LeetCode problem "${question.title}"...`);
        const llmResponse = await runLLM(prompt, systemPrompt, true);
        
        let result;
        try {
            result = JSON.parse(llmResponse);
        } catch (parseError) {
            console.error("LLM concept discovery parse error, attempting regex...", parseError);
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Failed to parse LLM response as JSON");
            }
        }

        res.json({
            title: question.title,
            difficulty: question.difficulty,
            content: question.content,
            cppSnippet: cppSnippet,
            array: firstTest,
            concepts: result.concepts || []
        });
    } catch (error) {
        console.error("LeetCode fetch/concepts error:", error);
        res.status(500).json({ error: "Failed to fetch problem details from LeetCode" });
    }
});

app.post('/leetcode/solve-concept', async (req, res) => {
    try {
        const {
            title,
            difficulty,
            content,
            cppSnippet,
            conceptId,
            conceptName,
            conceptSummary,
            array
        } = req.body;

        if (!title || !cppSnippet || !conceptId) {
            return res.status(400).json({ error: "Missing required solve parameters." });
        }

        const cleanContent = (content || '').replace(/<[^>]*>/g, '');

        const systemPrompt = `You are a master C++ compiler, DSA expert, and visualizer refactoring engine.
You are given a LeetCode problem, C++ starter snippet, and a specific chosen conceptual approach.
Your task is to write a complete working solution in C++17 matching the selected concept, and refactor it by injecting our high-fidelity C++ Visualizer Tracing Macros.

CRITICAL: You MUST write the complete, compileable \`class Solution\` template containing the solution function logic. DO NOT write a main() function. DO NOT write any driver program. ONLY output the \`class Solution\` block exactly as LeetCode standard C++ expects.

INTERCEPTED CONTAINERS:
- If your solution uses std::stack, std::queue, std::deque, or std::priority_queue, declare them normally! They are automatically wrapped by visualizer wrappers to track operations (push, pop, top, empty, size).

EXPLICIT VISUALIZER MACROS (CRITICAL: Match the exact signatures and arity below):
- compare(i, j): Log index comparison or element comparison. ONLY takes exactly TWO arguments (index1, index2).
- resolve(i, val): Log answer resolution (e.g. found answer for index i, or updated maximum/result). ONLY takes exactly TWO arguments (index, value). Do NOT call resolve(val) with one argument!
- visit(n): Log selection/traversal of index/element/node n. Takes exactly ONE argument (index or node).
- focus_pointer(label, idx): Track dual-pointers (e.g., left/right, low/high, slow/fast). CRITICAL: If this is a sliding window or two-pointer problem, you MUST call focus_pointer("left", left) and focus_pointer("right", right) in every iteration of the loop to highlight the active window!
- focus_cell(r, c) & update_cell(r, c, val): Grid operations. DO NOT use these unless the problem is a 2D matrix/grid problem!
- focus_node(node, label) & update_next(from, to): Linked List node focus and pointer adjustments. DO NOT use these unless it is a ListNode/LinkedList problem!
- visualizer_push_frame(name, args) & visualizer_pop_frame(): Recursive DFS stack frames. DO NOT use unless it is recursive.

CRITICAL MACRO WARNINGS & RULES:
1. Never call \`resolve(val)\` or \`resolve()\` with one or zero arguments. It MUST be called as \`resolve(index, val)\` with exactly TWO arguments.
2. Never call \`focus_pointer(idx)\` with one argument. It MUST be called as \`focus_pointer(label, idx)\` with exactly TWO arguments, e.g. \`focus_pointer("left", left)\` or \`focus_pointer("right", right)\`.
3. Never perform assignments inside a macro call, e.g. do NOT do \`update_cell(0, left, "oldLeft" = charIndexMap[c]);\` or \`resolve(0, left, "label" = value)\`. Perform assignments on separate lines, and pass simple variables/expressions to the macros.
4. Do NOT use \`focus_cell\`, \`update_cell\`, \`focus_node\`, \`update_next\` macros unless the problem explicitly uses that structure (matrix/grid for cells, ListNode for nodes).

C++ COMPILATION & SLIDING WINDOW RULES:
1. Do NOT use unordered_map iterator ranges like 'mp.erase(mp.begin(), prev(mp.end()))' or 'std::prev(mp.end())' because unordered_map iterators are only forward iterators and lack bidirectional traversal support, causing static assertion compile failures.
2. In sliding windows or string character count maps, standard lookup and individual erase is preferred:
   - Use 'mp.erase(s[left])' inside a sliding window loop as 'left' increments.
3. For 'compare(i, j)', make sure 'i' and 'j' are valid integer indices within array boundaries.

EXAMPLE OF INSTRUMENTED TWO-POINTERS / SLIDING-WINDOW SOLUTION:
\`\`\`cpp
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        int n = s.length();
        int left = 0, maxLength = 0;
        unordered_map<char, int> charIndex;
        for (int right = 0; right < n; right++) {
            focus_pointer("left", left);
            focus_pointer("right", right);
            visit(right);
            if (charIndex.count(s[right])) {
                compare(left, charIndex[s[right]]);
                // Shift left pointer past the last seen index of the duplicate
                left = max(left, charIndex[s[right]] + 1);
            }
            charIndex[s[right]] = right;
            maxLength = max(maxLength, right - left + 1);
            resolve(right, maxLength);
        }
        return maxLength;
    }
};
\`\`\`

IMPORTANT FOR CODE INTEGRITY:
- Write correct, optimal, fully compileable C++ code. Do not omit namespaces or headers that might be needed.
- CRITICAL: Use proper '\\n' newline characters in the JSON string for the code. Do NOT output the code as a single line.
- CRITICAL: Do NOT use single-line comments (//). Use multi-line comments (/* */) instead to prevent accidental truncation if newlines are stripped.
- CRITICAL: You MUST fully implement the algorithm logic. DO NOT return a stub. DO NOT return comments like /* your logic here */. The code must actually solve the problem.
- Return a valid JSON object matching the following structure:
{
  "cleanCode": "The fully implemented standard class Solution C++ block without any visualizer macros.",
  "instrumentedCode": "The fully implemented and instrumented complete class Solution C++ block containing the visualizer macros like focus_pointer, visit, resolve, compare, etc. Make sure to include all necessary helper headers like #include <vector>, <unordered_map>, <algorithm>, etc.",
  "array": "Formatted test case input string (e.g., '2, 7, 11, 15' or 'abcabcbb').",
  "problemType": "Detect which active visualizer container to display: 'array', 'stack', 'heap', 'tree', 'grid', 'list', 'map', 'graph'.",
  "timeComplexity": "Big-O time complexity string (e.g., 'O(N)').",
  "spaceComplexity": "Big-O space complexity string (e.g., 'O(N)').",
  "bottlenecks": "Detailed explanation of core algorithm bottlenecks and allocations.",
  "edgeCases": [
    { "caseName": "Edge Case Name 1", "input": "Input values formatted for visualizer" },
    { "caseName": "Edge Case Name 2", "input": "Input values formatted for visualizer" }
  ]
}`;

        const prompt = `Problem Title: ${title}
Difficulty: ${difficulty}
Problem Statement: ${cleanContent}
Chosen Conceptual Approach to implement: "${conceptName}" - ${conceptSummary}
C++ Starter Snippet:
\`\`\`cpp
${cppSnippet}
\`\`\`
First sample input default: ${array}`;

        console.log(`Generating C++ solution for "${title}" using concept "${conceptName}"...`);
        const llmResponse = await runLLM(prompt, systemPrompt, true);

        let result;
        try {
            result = JSON.parse(llmResponse);
        } catch (parseError) {
            console.error("LLM solve response parse error, attempting regex...", parseError);
            const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("Failed to parse LLM solve response as JSON");
            }
        }

        let sanitizedCleanCode = result.cleanCode || cppSnippet;
        sanitizedCleanCode = sanitizedCleanCode.replace(/```(cpp|c\+\+|c)?/gi, '').replace(/```/g, '').trim();
        if (sanitizedCleanCode.endsWith(',')) {
            sanitizedCleanCode = sanitizedCleanCode.slice(0, -1).trim();
        }
        sanitizedCleanCode = balanceBraces(sanitizedCleanCode);

        let sanitizedInstrumentedCode = result.instrumentedCode || result.code || cppSnippet;
        sanitizedInstrumentedCode = sanitizedInstrumentedCode.replace(/```(cpp|c\+\+|c)?/gi, '').replace(/```/g, '').trim();
        if (sanitizedInstrumentedCode.endsWith(',')) {
            sanitizedInstrumentedCode = sanitizedInstrumentedCode.slice(0, -1).trim();
        }
        sanitizedInstrumentedCode = balanceBraces(sanitizedInstrumentedCode);

        res.json({
            code: sanitizedCleanCode, // Return clean code to the editor
            instrumentedCode: sanitizedInstrumentedCode, // Send the instrumented code separately
            array: result.array || array,
            problemType: result.problemType || 'array',
            timeComplexity: result.timeComplexity || 'O(N)',
            spaceComplexity: result.spaceComplexity || 'O(N)',
            bottlenecks: result.bottlenecks || 'Standard implementation.',
            edgeCases: result.edgeCases || []
        });
    } catch (error) {
        console.error("Solve concept backend error:", error);
        res.status(500).json({ error: "Failed to generate C++ code for selected solution concept" });
    }
});

app.post('/generate', async (req, res) => {
    try {
        const {
            code,
            array,
            is2D,
            isGraph,
            graphNodes: reqGraphNodes,
            graphEdges: reqGraphEdges,
            noAI,
            skipAI
        } = req.body;
        const skipAi = noAI === true || skipAI === true;

        if (!code) {
            return res.status(400).json({ error: "Code is required." });
        }
        if (!array && !isGraph && !(reqGraphEdges && reqGraphEdges.length)) {
            return res.status(400).json({ error: "Test input (array or graph edges) is required." });
        }

        const isGraphProblem = isGraph === true
            || code.includes('VISUALIZER_GRAPH')
            || code.includes('graph_init')
            || code.includes('visit_graph');
        const isHeapProblem = code.includes('priority_queue') || code.includes('VisualizerPriorityQueue');
        const isMapProblem = code.includes('unordered_map') || code.includes('VisualizerMap');
        const isGridProblem = !isGraphProblem && (is2D || code.includes('vector<vector<int>>') || code.includes('vector<vector<int>>&'));
        const isListProblem = !isGraphProblem && (code.includes('ListNode*') || code.includes('ListNode *'));

        let graphEdges = reqGraphEdges || [];
        let graphNodeCount = reqGraphNodes || 0;
        let numsArray = Array.isArray(array) ? array : [];

        if (isGraphProblem) {
            if (graphEdges.length === 0 && Array.isArray(array) && array.length > 0) {
                if (Array.isArray(array[0])) {
                    graphEdges = array;
                } else if (array.length >= 2 && array.length % 2 === 0) {
                    for (let i = 0; i < array.length; i += 2) {
                        graphEdges.push([array[i], array[i + 1]]);
                    }
                }
            }
            if (!graphNodeCount && graphEdges.length > 0) {
                graphNodeCount = Math.max(...graphEdges.flat()) + 1;
            }
            if (!graphNodeCount) graphNodeCount = 4;
            numsArray = [];
        }

        console.log(
            `Building C++ Sandbox (isGraph: ${isGraphProblem}, isHeap: ${isHeapProblem}, isMap: ${isMapProblem}, isGrid: ${isGridProblem}, isList: ${isListProblem}, graphNodes: ${graphNodeCount}, edges: ${graphEdges.length})...`
        );

        // Detect function name and Solution class in user's C++ code
        let callStatement = 'nextGreaterElements(nums, stack, res);';
        const classMatch = code.includes('class Solution');
        const isTreeProblem = !isGraphProblem && (code.includes('TreeNode*') || code.includes('TreeNode *'));
        const isStringProblem = !isGraphProblem && (
            code.includes('string ') || 
            code.includes('std::string') || 
            code.includes('string&') || 
            code.includes('lengthOfLongestSubstring') ||
            (typeof array === 'string' && array.trim().startsWith('"') && array.trim().endsWith('"')) ||
            (typeof array === 'string' && /^[a-zA-Z]+$/.test(array.trim().replace(/['"]/g, '')))
        );
        
        let stringValue = '';
        if (isStringProblem) {
            if (typeof array === 'string') {
                stringValue = array.replace(/^['"]|['"]$/g, '');
            } else if (Array.isArray(array)) {
                stringValue = array.join('');
            } else {
                stringValue = String(array || '').replace(/^['"]|['"]$/g, '');
            }
        }
        
        let paramType = 'nums';
        if (isTreeProblem) paramType = 'root';
        else if (isGridProblem) paramType = 'grid';
        else if (isListProblem) paramType = 'listHead';
        else if (isStringProblem) paramType = 'strInput';

        const entryOverride = code.match(/\/\/\s*VISUALIZER_ENTRY:\s*([a-zA-Z0-9_]+)/);
        if (entryOverride) {
            const funcName = entryOverride[1];
            const entryCall = code.match(new RegExp(`\\b${funcName}\\s*\\(\\s*([^)]*)\\s*\\)`));
            const entryArgs = entryCall && entryCall[1].trim() ? entryCall[1].trim() : '';
            const entryParams = entryArgs ? entryArgs.split(',').map((a) => a.trim().split(/\s+/).pop()) : [];
            const entryArgValues = entryParams.map((p) => {
                if (p === 'nums' || p === 'grid' || p === 'root' || p === 'listHead') return p;
                if (p === 'height' || p === 'temperatures') return 'nums';
                return paramType;
            }).filter(Boolean).join(', ');
            const callArgs = entryArgValues || (entryParams.length === 0 ? '' : paramType);
            if (classMatch) {
                callStatement = `Solution sol;\n    sol.${funcName}(${callArgs});`;
            } else {
                callStatement = `${funcName}(${callArgs});`;
            }
        } else {
            // Match entrypoint that takes exactly one matching parameter (no commas in parameter list)
            const singleParamRegex = /(vector<int>|void|int|bool|vector<vector<int>>|ListNode\*)\s+([a-zA-Z0-9_]+)\s*\(\s*(vector<int>|TreeNode\*|TreeNode\s*\*|vector<vector<int>>|ListNode\*|string|const\s+string\s*&|std::string)\s*&?\s*[a-zA-Z0-9_]*\s*\)/;
            const funcMatch = code.match(singleParamRegex);

            if (funcMatch) {
                const funcName = funcMatch[2];
                if (classMatch) {
                    callStatement = `Solution sol;\n    sol.${funcName}(${paramType});`;
                } else {
                    callStatement = `${funcName}(${paramType});`;
                }
            } else {
                // Fallback simple class match
                const simpleClassMatch = code.match(/class\s+Solution[\s\S]*?(?:vector<int>|int|bool|void|vector<vector<int>>)\s+([a-zA-Z0-9_]+)\s*\(/);
                if (simpleClassMatch) {
                    const funcName = simpleClassMatch[1];
                    callStatement = `Solution sol;\n    sol.${funcName}(${paramType});`;
                }
            }
        }

        // 1. Build the C++ Runner
        const cppCode = `
#include <iostream>
#include <vector>
#include <stack>
#include <queue>
#include <deque>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <utility>
#include <algorithm>
#include <numeric>
#include <climits>
using namespace std;

// TreeNode definition matching LeetCode exactly
struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(NULL), right(NULL) {}
};

// ListNode definition matching LeetCode exactly
struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(NULL) {}
};

// Global tracking
vector<int> global_nums;
vector<int> graph_node_vals;
int stepCount = 0;
bool heap_initialized = false;

void check_step_limit() {
    if (stepCount >= 1000) {
        cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"finish\\\"}" << endl;
        cout << "]}" << endl;
        exit(0);
    }
}


template<typename T = int>
class VisualizerStack {
private:
    stack<T> s;
public:
    void push(const T& val) {
        s.push(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < global_nums.size()) ? global_nums[idx] : -1;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"push_stack\\",\\"index\\":" << idx << ",\\"value\\":" << value << "}," << endl;
    }
    void pop() {
        if (s.empty()) return;
        T val = s.top();
        s.pop();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"pop_stack\\",\\"index\\":" << idx << "}," << endl;
    }
    T top() { return s.top(); }
    bool empty() { return s.empty(); }
    size_t size() { return s.size(); }
};

template<typename T = int>
class VisualizerQueue {
private:
    queue<T> q;
public:
    void push(const T& val) {
        q.push(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < global_nums.size()) ? global_nums[idx] : -1;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"push_queue\\",\\"index\\":" << idx << ",\\"value\\":" << value << "}," << endl;
    }
    void pop() {
        if (q.empty()) return;
        T val = q.front();
        q.pop();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"pop_queue\\",\\"index\\":" << idx << "}," << endl;
    }
    T front() { return q.front(); }
    T back() { return q.back(); }
    bool empty() { return q.empty(); }
    size_t size() { return q.size(); }
};

template<typename T = int>
class VisualizerDeque {
private:
    deque<T> dq;
public:
    void push_back(const T& val) {
        dq.push_back(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < global_nums.size()) ? global_nums[idx] : -1;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"push_back_deque\\",\\"index\\":" << idx << ",\\"value\\":" << value << "}," << endl;
    }
    void push_front(const T& val) {
        dq.push_front(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < global_nums.size()) ? global_nums[idx] : -1;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"push_front_deque\\",\\"index\\":" << idx << ",\\"value\\":" << value << "}," << endl;
    }
    void pop_back() {
        if (dq.empty()) return;
        T val = dq.back();
        dq.pop_back();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"pop_back_deque\\",\\"index\\":" << idx << "}," << endl;
    }
    void pop_front() {
        if (dq.empty()) return;
        T val = dq.front();
        dq.pop_front();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"pop_front_deque\\",\\"index\\":" << idx << "}," << endl;
    }
    T front() { return dq.front(); }
    T back() { return dq.back(); }
    bool empty() { return dq.empty(); }
    size_t size() { return dq.size(); }
};

template<typename T = int, typename Container = vector<T>, typename Compare = less<T>>
class VisualizerPriorityQueue {
private:
    std::priority_queue<T, Container, Compare> pq;
    void logInit() {
        if (!heap_initialized) {
            heap_initialized = true;
            stepCount++;
        check_step_limit();
            cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"init_heap\\"}," << endl;
        }
    }
public:
    void push(const T& val) {
        logInit();
        pq.push(val);
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        int value = (idx >= 0 && idx < (int)global_nums.size()) ? global_nums[idx] : idx;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"push_heap\\",\\"index\\":" << idx << ",\\"value\\":" << value << "}," << endl;
    }
    void pop() {
        if (pq.empty()) return;
        T val = pq.top();
        pq.pop();
        stepCount++;
        check_step_limit();
        int idx = (int)val;
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"pop_heap\\",\\"index\\":" << idx << "}," << endl;
    }
    T top() { return pq.top(); }
    bool empty() { return pq.empty(); }
    size_t size() { return pq.size(); }
};

class VisualizerMap {
private:
    unordered_map<int, int> m;
    bool initialized = false;
    void ensureInit() {
        if (!initialized) {
            initialized = true;
            stepCount++;
        check_step_limit();
            cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"init_map\\"}," << endl;
        }
    }
public:
    void put(int key, int val) {
        ensureInit();
        m[key] = val;
        stepCount++;
        check_step_limit();
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"map_put\\",\\"key\\":" << key << ",\\"val\\":" << val << "}," << endl;
    }
    int get(int key) {
        ensureInit();
        int val = 0;
        auto it = m.find(key);
        if (it != m.end()) val = it->second;
        stepCount++;
        check_step_limit();
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"map_get\\",\\"key\\":" << key << ",\\"val\\":" << val << "}," << endl;
        return val;
    }
    void erase(int key) {
        ensureInit();
        m.erase(key);
        stepCount++;
        check_step_limit();
        cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"map_erase\\",\\"key\\":" << key << "}," << endl;
    }
    bool count(int key) { return m.count(key) > 0; }
    int& operator[](int key) {
        ensureInit();
        if (!m.count(key)) {
            m[key] = 0;
            stepCount++;
            check_step_limit();
            cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"map_put\\",\\"key\\":" << key << ",\\"val\\":0}," << endl;
        }
        return m[key];
    }
};

void graph_init(int n, const vector<int>& vals) {
    graph_node_vals = vals;
    if ((int)graph_node_vals.size() < n) {
        graph_node_vals.resize(n, 0);
    }
    stepCount++;
    check_step_limit();
    cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"init_graph\\",\\"nodes\\":" << n << "}," << endl;
}

void graph_add_edge(int u, int v) {
    stepCount++;
    check_step_limit();
    cout << "{\\"step\\":" << stepCount << ",\\"action\\":\\"graph_edge\\",\\"u\\":" << u << ",\\"v\\":" << v << "}," << endl;
}

void visit_graph_impl(int node, int line = 0) {
    stepCount++;
    check_step_limit();
    int val = (node >= 0 && node < (int)graph_node_vals.size()) ? graph_node_vals[node] : node;
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"visit_graph_node\\\",\\\"node\\\":" << node << ",\\\"val\\\":" << val << ",\\\"line\\\":" << line << "}," << endl;
}

void focus_graph_edge_impl(int u, int v, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"focus_edge\\\",\\\"u\\\":" << u << ",\\\"v\\\":" << v << ",\\\"line\\\":" << line << "}," << endl;
}

void focus_pointer_impl(const string& label, int idx, int line = 0) {
    stepCount++;
    check_step_limit();
    int value = (idx >= 0 && idx < (int)global_nums.size()) ? global_nums[idx] : -1;
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\":\\\"focus_pointer\\\",\\\"label\\\":\\\"" << label << "\\\",\\\"index\\\":" << idx << ",\\\"value\\\":" << value << ",\\\"line\\\":" << line << "}," << endl;
}

void resolve_impl(int idx, int resolvedValue, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\":\\\"resolve\\\",\\\"index\\\":" << idx << ",\\\"resolvedValue\\\":" << resolvedValue << ",\\\"line\\\":" << line << "}," << endl;
}

bool compare_impl(int idx1, int idx2, int line = 0) {
    stepCount++;
    check_step_limit();
    int val1 = global_nums[idx1];
    int val2 = global_nums[idx2];
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\":\\\"compare\\\",\\\"stackTopIndex\\\":" << idx1 << ",\\\"stackTopValue\\\":" << val1 << ",\\\"arrayIndex\\\":" << idx2 << ",\\\"arrayValue\\\":" << val2 << ",\\\"line\\\":" << line << "}," << endl;
    return val1 < val2;
}

void visit_impl(int val, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"focus_array\\\",\\\"index\\\":" << val << ",\\\"value\\\":" << (val >= 0 && val < (int)global_nums.size() ? global_nums[val] : -9999) << ",\\\"line\\\":" << line << "}," << endl;
}

// 2D Grid / Matrix SDK functions
void focus_cell_impl(int r, int c, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"focus_cell\\\",\\\"row\\\":" << r << ",\\\"col\\\":" << c << ",\\\"line\\\":" << line << "}," << endl;
}

void update_cell_impl(int r, int c, int val, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"update_cell\\\",\\\"row\\\":" << r << ",\\\"col\\\":" << c << ",\\\"val\\\":" << val << ",\\\"line\\\":" << line << "}," << endl;
}

// Recursive Call Stack Frame visualization SDK functions
void visualizer_push_frame_impl(const string& name, const string& args, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"push_frame\\\",\\\"name\\\":\\\"" << name << "\\\",\\\"args\\\":\\\"" << args << "\\\",\\\"line\\\":" << line << "}," << endl;
}

void visualizer_pop_frame_impl(int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"pop_frame\\\",\\\"line\\\":" << line << "}," << endl;
}

// Tree serialization and traversal logging
void serializeTree(TreeNode* root) {
    if (!root) return;
    queue<TreeNode*> q;
    q.push(root);
    cout << "{\\\"step\\\": 0, \\\"action\\\": \\\"init_tree\\\", \\"root\\": \\"" << root << "\\"}," << endl;
    while (!q.empty()) {
        TreeNode* curr = q.front();
        q.pop();
        cout << "{\\\"step\\\": 0, \\\"action\\\": \\"tree_node\\", \\"ptr\\": \\"" << curr << "\\", \\"val\\": " << curr->val;
        if (curr->left) {
            cout << ", \\"left\\": \\"" << curr->left << "\\"";
            q.push(curr->left);
        } else {
            cout << ", \\"left\\": \\"null\\"";
        }
        if (curr->right) {
            cout << ", \\"right\\": \\"" << curr->right << "\\"";
            q.push(curr->right);
        } else {
            cout << ", \\"right\\": \\"null\\"";
        }
        cout << "}," << endl;
    }
}

void visit_impl(TreeNode* node, int line = 0) {
    if (!node) return;
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"visit_tree_node\\\",\\\"ptr\\\":\\\"" << node << "\\\",\\\"val\\\":" << node->val << ",\\\"line\\\":" << line << "}," << endl;
}

TreeNode* buildTree(const vector<string>& arr) {
    if (arr.empty() || arr[0] == "null") return nullptr;
    TreeNode* root = new TreeNode(stoi(arr[0]));
    queue<TreeNode*> q;
    q.push(root);
    int i = 1;
    while (!q.empty() && i < arr.size()) {
        TreeNode* curr = q.front();
        q.pop();
        if (i < arr.size() && arr[i] != "null") {
            curr->left = new TreeNode(stoi(arr[i]));
            q.push(curr->left);
        }
        i++;
        if (i < arr.size() && arr[i] != "null") {
            curr->right = new TreeNode(stoi(arr[i]));
            q.push(curr->right);
        }
        i++;
    }
    return root;
}

// Linked List serialization and traversal logging
void serializeList(ListNode* head) {
    if (!head) return;
    ListNode* curr = head;
    cout << "{\\\"step\\\": 0, \\\"action\\\": \\\"init_list\\\", \\\"head\\\": \\\"" << head << "\\\"}," << endl;
    while (curr) {
        cout << "{\\\"step\\\": 0, \\\"action\\\": \\\"list_node\\\", \\\"ptr\\\": \\\"" << curr << "\\\", \\\"val\\\": " << curr->val;
        if (curr->next) {
            cout << ", \\\"next\\\": \\\"" << curr->next << "\\\"";
        } else {
            cout << ", \\\"next\\\": \\\"null\\\"";
        }
        cout << "}," << endl;
        curr = curr->next;
    }
}

void focus_node_impl(ListNode* node, string label, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"focus_node\\\",\\\"ptr\\\":\\\"" << node << "\\\",\\\"label\\\":\\\"" << label << "\\\",\\\"line\\\":" << line << "}," << endl;
}

void update_next_impl(ListNode* from, ListNode* to, int line = 0) {
    stepCount++;
    check_step_limit();
    cout << "{\\\"step\\\":" << stepCount << ",\\\"action\\\":\\\"update_next\\\",\\\"from\\\":\\\"" << from << "\\\",\\\"to\\\":\\\"" << to << "\\\",\\\"line\\\":" << line << "}," << endl;
}

ListNode* buildList(const vector<int>& arr) {
    if (arr.empty()) return nullptr;
    ListNode* head = new ListNode(arr[0]);
    ListNode* curr = head;
    for (size_t i = 1; i < arr.size(); i++) {
        curr->next = new ListNode(arr[i]);
        curr = curr->next;
    }
    return head;
}

// Preprocessor wrappers to transparently track standard C++ structures
#define stack VisualizerStack
#define queue VisualizerQueue
#define deque VisualizerDeque
#define priority_queue VisualizerPriorityQueue

// Visualizer SDK helper macro overrides for capturing __LINE__
#define compare(i, j) compare_impl(i, j, __LINE__)
#define resolve(i, v) resolve_impl(i, v, __LINE__)
#define visit(n) visit_impl(n, __LINE__)
#define focus_cell(r, c) focus_cell_impl(r, c, __LINE__)
#define update_cell(r, c, val) update_cell_impl(r, c, val, __LINE__)
#define focus_node(node, label) focus_node_impl(node, label, __LINE__)
#define update_next(from, to) update_next_impl(from, to, __LINE__)
#define visit_graph(node) visit_graph_impl(node, __LINE__)
#define focus_graph_edge(u, v) focus_graph_edge_impl(u, v, __LINE__)
#define focus_pointer(label, idx) focus_pointer_impl(label, idx, __LINE__)
#define visualizer_push_frame(name, args) visualizer_push_frame_impl(name, args, __LINE__)
#define visualizer_pop_frame() visualizer_pop_frame_impl(__LINE__)

// USER CODE BEGIN
${code}
// USER CODE END

int main() {
    string strInput = "${stringValue}";
    bool is_string_problem = ${isStringProblem ? 'true' : 'false'};
    vector<int> nums = {${isStringProblem ? stringValue.split('').map(c => c.charCodeAt(0)).join(', ') : (isGraphProblem ? '' : (isGridProblem ? '0' : numsArray.map(x => {
        if (x === null) return -9999;
        const parsedX = parseInt(x, 10);
        return isNaN(parsedX) ? 0 : parsedX;
    }).join(', ')))}};
    vector<string> tree_nodes = {${isStringProblem ? stringValue.split('').map(c => `"${c.replace(/"/g, '\\"')}"`).join(', ') : (isGraphProblem ? '""' : (isGridProblem ? '""' : numsArray.map(x => x === null ? `"null"` : `"${x}"`).join(', ')))}};
    global_nums = nums;
    bool is_tree_problem = ${isTreeProblem ? 'true' : 'false'};
    bool is_grid_problem = ${isGridProblem ? 'true' : 'false'};
    bool is_list_problem = ${isListProblem ? 'true' : 'false'};
    bool is_graph_problem = ${isGraphProblem ? 'true' : 'false'};
    bool is_heap_problem = ${isHeapProblem ? 'true' : 'false'};
    bool is_map_problem = ${isMapProblem ? 'true' : 'false'};
    
    vector<pair<int,int>> graph_edges = {
        ${isGraphProblem ? graphEdges.map(([u, v]) => `{${u}, ${v}}`).join(',\n        ') : ''}
    };
    vector<int> graph_vals(${graphNodeCount || 0}, 0);
    for (int gi = 0; gi < ${graphNodeCount || 0}; gi++) {
        if (gi < (int)nums.size()) graph_vals[gi] = nums[gi];
        else graph_vals[gi] = gi;
    }

    // Matrix Initialization
    vector<vector<int>> grid = {
        ${isGridProblem ? numsArray.map(row => `{${Array.isArray(row) ? row.map(x => {
            if (x === null) return 0;
            const parsedX = parseInt(x, 10);
            return isNaN(parsedX) ? 0 : parsedX;
        }).join(', ') : ((row === null || isNaN(parseInt(row, 10))) ? 0 : parseInt(row, 10))}}`).join(',\n        ') : '{}'}
    };
    
    TreeNode* root = nullptr;
    if (is_tree_problem) {
        root = buildTree(tree_nodes);
    }
    
    ListNode* listHead = nullptr;
    if (is_list_problem) {
        vector<int> list_nums = {${isGridProblem ? '0' : (isStringProblem ? '0' : numsArray.map(x => {
            if (x === null) return 0;
            const parsedX = parseInt(x, 10);
            return isNaN(parsedX) ? 0 : parsedX;
        }).join(', ') || '0')}};
        listHead = buildList(list_nums);
    }
    
    VisualizerStack<> stack;
    vector<int> res(nums.size(), -1);
    
    cout << "{\\"steps\\": [" << endl;
    
    // Serialize tree structure if it exists
    if (root) {
        serializeTree(root);
    }
    
    // Serialize list structure if it exists
    if (listHead) {
        serializeList(listHead);
    }
    
    if (is_graph_problem) {
        graph_init((int)graph_vals.size(), graph_vals);
        for (const auto& e : graph_edges) {
            graph_add_edge(e.first, e.second);
        }
    }

    // Serialize grid structure if it exists
    if (is_grid_problem) {
        cout << "{\\"step\\": 0, \\"action\\": \\"init_grid\\", \\"rows\\": " << grid.size() << ", \\"cols\\": " << (grid.empty() ? 0 : grid[0].size()) << "}," << endl;
        for (int r = 0; r < grid.size(); r++) {
            for (int c = 0; c < grid[r].size(); c++) {
                cout << "{\\"step\\": 0, \\"action\\": \\"grid_cell\\", \\"row\\": " << r << ", \\"col\\": " << c << ", \\"val\\": " << grid[r][c] << "}," << endl;
            }
        }
    }
    
    // Initial focus steps for array (not for grid or graph-only)
    if (!is_grid_problem && !is_graph_problem) {
        for (int i = 0; i < nums.size(); i++) {
            if (nums[i] != -9999) {
                cout << "{\\"step\\": 0, \\"action\\": \\"focus_array\\", \\"index\\": " << i << ", \\"value\\": " << nums[i] << "}," << endl;
            }
        }
    }
    
    ${callStatement}
    
    cout << "{\\"step\\":999,\\"action\\":\\"finish\\"}" << endl;
    cout << "]}" << endl;
    return 0;
}
`;

        fs.writeFileSync('runner.cpp', cppCode);
        
        // 2. Compile and Execute
        const execOpts = { maxBuffer: 1024 * 1024 * 5, timeout: EXEC_TIMEOUT_MS };
        console.log("Compiling runner.cpp...");
        execSync('g++ -std=c++17 runner.cpp -o runner', execOpts);
        console.log("Executing binary...");
        const stdout = execSync('./runner', execOpts).toString();
        
        // Ensure valid JSON (clean trailing commas if any, though the finish step handles the last one nicely)
        let rawTrace;
        try {
            rawTrace = JSON.parse(stdout);
        } catch (e) {
            console.error("Failed to parse C++ stdout:", stdout);
            return res.status(500).json({ error: "C++ binary produced invalid JSON." });
        }

        // Map compiler line numbers back to user's editor lines
        const cppCodeLines = cppCode.split('\n');
        const userCodeStartIndex = cppCodeLines.findIndex(l => l.includes('// USER CODE BEGIN'));
        const userCodeStartLineOffset = userCodeStartIndex + 2;

        rawTrace.steps.forEach((step) => {
            if (step.line) {
                step.userLine = step.line - userCodeStartLineOffset + 1;
            }
        });

        const stepCount = rawTrace.steps.length;
        if (skipAi) {
            console.log("Skipping AI commentary (noAI/skipAI). Using deterministic messages.");
            rawTrace.steps.forEach((step) => {
                step.message = messageFromAction(step);
            });
        } else {
            // 3. Send to LLM just for commentary
            const userPrompt = `
Here is the perfect JSON trace from the C++ compiler:
${JSON.stringify(rawTrace, null, 2)}

Please write a beginner-friendly "message" explaining what happened in each step.
The trace has exactly ${stepCount} steps. Your "messages" array MUST contain exactly ${stepCount} strings, one per step, in the same order.
Return ONLY a JSON object with a single key "messages" containing an array of strings in order.
`;
            try {
                const responseText = await runLLM(userPrompt, SYSTEM_PROMPT, true);
                if (responseText) {
                    const cleanJson = responseText.replace(/```json/ig, '').replace(/```/g, '').trim();
                    const llmOutput = JSON.parse(cleanJson);
                    applyStepMessages(rawTrace.steps, llmOutput.messages);
                } else {
                    applyStepMessages(rawTrace.steps, null);
                }
            } catch (llmErr) {
                console.warn("LLM commentary failed, using fallback.", llmErr.message);
                applyStepMessages(rawTrace.steps, null);
            }
        }

        
        const finalTrace = rawTrace;
        finalTrace.array = isGraphProblem ? [] : (isStringProblem ? stringValue.split('') : numsArray);
        if (isGraphProblem) {
            finalTrace.graphEdges = graphEdges;
            finalTrace.graphNodes = graphNodeCount;
        }
        
        fs.writeFileSync('latest_trace.json', JSON.stringify(finalTrace, null, 2));
        
        console.log("Successfully generated final trace! Saved to latest_trace.json");
        res.json(finalTrace);
    } catch (error) {
        console.error("Error generating trace:", error);
        res.status(500).json({ error: "Failed to generate trace", details: error.message });
    }
});

const INSTRUMENT_SYSTEM_PROMPT = `
You are an expert C++ developer and algorithm visualization tutor.
You are given raw C++ code. Your ONLY job is to inject visualizer tracking hooks into the code without changing the time/space complexity or logical correctness.

CRITICAL RULES:
1. Wrap collections:
   - "stack<int>" -> "stack<int>" (which is macro-wrapped automatically to VisualizerStack).
   - "queue<int>" -> "queue<int>" (macro-wrapped to VisualizerQueue).
   - "deque<int>" -> "deque<int>" (macro-wrapped to VisualizerDeque).
   - "priority_queue<...>" -> "priority_queue<...>" (macro-wrapped to VisualizerPriorityQueue).
   - "unordered_map<int, int>" -> "VisualizerMap". Make sure to use standard VisualizerMap methods:
     - Use .put(key, val) instead of [key] = val.
     - Use .get(key) instead of .find() or [key].
     - Use .count(key) and .erase(key).

2. Track Pointers (Two-Pointer / Binary Search):
   - Use "focus_pointer(string label, int index)" to highlight indices. Example: focus_pointer("left", l), focus_pointer("right", r), focus_pointer("mid", mid).

3. Track Comparisons & NGE:
   - Use "compare(int idx1, int idx2)" for element comparisons in array search/sort/stack.
   - Use "resolve(int index, int value)" to output resolved values (like NGE value at index).

4. Track DFS / BFS / Traversals:
   - 2D Grid DFS: Use "focus_cell(int r, int c)" when visiting, and "update_cell(int r, int c, int val)" on modification.
   - Tree DFS: Use "visit(TreeNode* node)" when visiting nodes.
   - Graph BFS/DFS: Use "visit_graph(int node)" when visiting, and "focus_graph_edge(int u, int v)" when crossing edges.

5. DO NOT touch the function name, arguments, or the Solution class wrapper. Ensure standard headers are NOT added inside the block.
6. Return ONLY the valid C++ code. Absolutely NO markdown block formatting, NO conversational text, NO explanations.
`;

app.post('/instrument', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Code is required" });

        let currentCode = code;
        let compilationError = "";
        let attempt = 0;
        const maxAttempts = 3;
        let success = false;

        while (attempt < maxAttempts && !success) {
            attempt++;
            console.log(`Auto-instrumentation attempt ${attempt} for C++ sandbox...`);
            
            const userPrompt = attempt === 1 
                ? `Please inject visualizer tracking hooks into this raw C++ code:\n\n${currentCode}\n\nReturn ONLY the clean instrumented C++ code.`
                : `Your previously instrumented code failed to compile with this error:\n${compilationError}\n\nHere is the code you produced:\n\n${currentCode}\n\nFix all compilation and syntax errors. Ensure standard structures are matched. Return ONLY the clean, corrected instrumented C++ code.`;

            let responseText = "";
            try {
                const ollamaRes = await fetch(OLLAMA_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: 'llama3',
                        prompt: userPrompt,
                        system: INSTRUMENT_SYSTEM_PROMPT,
                        stream: false
                    })
                });
                if (!ollamaRes.ok) throw new Error("Ollama returned an error");
                const data = await ollamaRes.json();
                responseText = data.response;
            } catch (e) {
                if (!GROQ_API_KEY) {
                    throw new Error("No LLM API keys available for instrumenting.");
                }
                const groqRes = await fetch(GROQ_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${GROQ_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'llama-3.1-8b-instant',
                        messages: [
                            { role: "system", content: INSTRUMENT_SYSTEM_PROMPT },
                            { role: "user", content: userPrompt }
                        ]
                    })
                });
                if (!groqRes.ok) {
                    const errData = await groqRes.json();
                    throw new Error(`Groq API Error: ${errData.error?.message || groqRes.statusText}`);
                }
                const data = await groqRes.json();
                responseText = data.choices[0].message.content;
            }

            if (!responseText) {
                throw new Error("Empty response from LLM.");
            }

            // Clean markdown blocks if any
            let cleanedCode = responseText.replace(/```cpp/ig, '').replace(/```/g, '').trim();
            
            // Syntax Verify: compile inside sandbox template
            const verificationCpp = `
#include <iostream>
#include <vector>
#include <stack>
#include <queue>
#include <deque>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <utility>
#include <algorithm>
#include <numeric>
#include <climits>
using namespace std;

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode(int x) : val(x), left(NULL), right(NULL) {}
};

struct ListNode {
    int val;
    ListNode *next;
    ListNode(int x) : val(x), next(NULL) {}
};

vector<int> global_nums;
vector<int> graph_node_vals;
int stepCount = 0;

template<typename T = int>
class VisualizerStack {
public:
    void push(const T& val) {}
    void pop() {}
    T top() { return T(); }
    bool empty() { return true; }
};

template<typename T = int>
class VisualizerQueue {
public:
    void push(const T& val) {}
    void pop() {}
    T front() { return T(); }
    bool empty() { return true; }
};

template<typename T = int>
class VisualizerDeque {
public:
    void push_back(const T& val) {}
    void push_front(const T& val) {}
    void pop_back() {}
    void pop_front() {}
    T front() { return T(); }
    T back() { return T(); }
    bool empty() { return true; }
};

template<typename T = int, typename Container = vector<T>, typename Compare = less<T>>
class VisualizerPriorityQueue {
public:
    void push(const T& val) {}
    void pop() {}
    T top() { return T(); }
    bool empty() { return true; }
};

class VisualizerMap {
public:
    void put(int key, int val) {}
    int get(int key) { return 0; }
    void erase(int key) {}
    bool count(int key) { return false; }
    int& operator[](int key) { static int dummy = 0; return dummy; }
};

void focus_pointer_impl(const string& label, int idx, int line = 0) {}
void resolve_impl(int idx, int resolvedValue, int line = 0) {}
bool compare_impl(int idx1, int idx2, int line = 0) { return false; }
void focus_cell_impl(int r, int c, int line = 0) {}
void update_cell_impl(int r, int c, int val, int line = 0) {}
void visit_impl(TreeNode* node, int line = 0) {}
void visit_impl(int val, int line = 0) {}
void visit_graph_impl(int node, int line = 0) {}
void focus_graph_edge_impl(int u, int v, int line = 0) {}
void visualizer_push_frame_impl(const string& name, const string& args, int line = 0) {}
void visualizer_pop_frame_impl(int line = 0) {}

#define stack VisualizerStack
#define queue VisualizerQueue
#define deque VisualizerDeque
#define priority_queue VisualizerPriorityQueue

#define compare(i, j) compare_impl(i, j, __LINE__)
#define resolve(i, v) resolve_impl(i, v, __LINE__)
#define visit(n) visit_impl(n, __LINE__)
#define focus_cell(r, c) focus_cell_impl(r, c, __LINE__)
#define update_cell(r, c, val) update_cell_impl(r, c, val, __LINE__)
#define focus_node(node, label) focus_node_impl(node, label, __LINE__)
#define update_next(from, to) update_next_impl(from, to, __LINE__)
#define visit_graph(node) visit_graph_impl(node, __LINE__)
#define focus_graph_edge(u, v) focus_graph_edge_impl(u, v, __LINE__)
#define focus_pointer(label, idx) focus_pointer_impl(label, idx, __LINE__)
#define visualizer_push_frame(name, args) visualizer_push_frame_impl(name, args, __LINE__)
#define visualizer_pop_frame() visualizer_pop_frame_impl(__LINE__)

${cleanedCode}

int main() {
    return 0;
}
            `;

            fs.writeFileSync('verify_instrument.cpp', verificationCpp);
            
            try {
                execSync('g++ -std=c++17 verify_instrument.cpp -o verify_instrument', { stdio: 'pipe' });
                // Clean up files
                try {
                    fs.unlinkSync('verify_instrument.cpp');
                    fs.unlinkSync('verify_instrument');
                } catch (_) {}
                
                success = true;
                currentCode = cleanedCode;
                console.log("Successfully auto-instrumented & sandbox-compiled user C++ code!");
            } catch (compileErr) {
                compilationError = compileErr.stderr ? compileErr.stderr.toString() : compileErr.message;
                currentCode = cleanedCode;
                console.warn(`Sandbox compile failed on attempt ${attempt}. Stderr:\n${compilationError}`);
            }
        }

        if (!success) {
            return res.json({ 
                success: false,
                error: "Auto-instrumented code failed to compile.", 
                details: compilationError,
                code: code // Keep original user code same as fallback
            });
        }

        res.json({ success: true, code: currentCode });
    } catch (err) {
        console.error("Auto-instrumentation error:", err);
        res.status(500).json({ error: "Failed to auto-instrument code", details: err.message });
    }
});

app.post('/diagnose', async (req, res) => {
    try {
        const { code, compilerError } = req.body;
        if (!code || !compilerError) {
            return res.status(400).json({ error: "Code and compilerError are required" });
        }
        
        const systemPrompt = `You are a helpful compiler diagnostic assistant.
The user's C++ code failed to compile inside our visualizer sandbox.
Analyze the error and propose a corrected version of the code.
You MUST return a JSON object with exactly two keys:
1. "errorExplanation": a plain English description of what caused the compile error (1-2 brief paragraphs max).
2. "suggestedCode": the complete, corrected C++ code block.
Return ONLY valid JSON. Absolutely no conversational filler or markdown blocks.`;

        const userPrompt = `USER CODE:\n${code}\n\nCOMPILER ERROR:\n${compilerError}`;
        const responseText = await runLLM(userPrompt, systemPrompt, true);
        const cleanJson = responseText.replace(/```json/ig, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        res.json(result);
    } catch (err) {
        console.error("Diagnosis error:", err);
        res.status(500).json({ error: "Failed to diagnose code", details: err.message });
    }
});

app.post('/suggest-cases', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Code is required" });
        
        const systemPrompt = `You are an expert algorithm educator.
Given the C++ solution, propose 3 distinct, highly effective boundary test cases that are critical for verifying this algorithm.
Each test case MUST have:
1. "input": the raw test case input string (e.g. "4, 2, 5" for arrays, "[[0,1]]" for grids, etc.) that can be directly loaded into the visualizer input box.
2. "title": a short name for the test case (e.g., "Sorted Input", "Duplicate Elements", "Empty/Single Value").
3. "description": an explanation of why this edge case is a crucial boundary test.
You MUST return a JSON object with a single key "cases" containing an array of exactly 3 objects.
Return ONLY valid JSON. Absolutely no conversational filler or markdown blocks.`;

        const userPrompt = `C++ CODE:\n${code}`;
        const responseText = await runLLM(userPrompt, systemPrompt, true);
        const cleanJson = responseText.replace(/```json/ig, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        res.json(result);
    } catch (err) {
        console.error("Suggest cases error:", err);
        res.status(500).json({ error: "Failed to suggest cases", details: err.message });
    }
});

app.post('/analyze-complexity', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "Code is required" });
        
        const systemPrompt = `You are an expert performance engineer and coding interviewer.
Given the C++ solution, perform a detailed time and space complexity analysis.
You MUST return a JSON object with exactly five keys:
1. "time": Time complexity string (e.g. "O(N)", "O(N log N)", "O(N^2)")
2. "space": Space complexity string (e.g. "O(N)", "O(1)")
3. "bottlenecks": A plain English description of where the primary bottlenecks or dynamic allocations are.
4. "complexityType": a string mapping to the growth curve type, choose exactly one from: ["constant", "logarithmic", "linear", "linearithmic", "quadratic", "exponential"]
5. "improvementSuggestion": If the code is sub-optimal or inefficient (e.g., O(N^2) when O(N) is possible), politely act as an interviewer, explain why it's inefficient, and steer the user towards a better algorithmic approach (without writing the full code). If it is already optimal, state that it's optimal and why.
Return ONLY valid JSON. Absolutely no conversational filler or markdown blocks.`;

        const userPrompt = `C++ CODE:\n${code}`;
        const responseText = await runLLM(userPrompt, systemPrompt, true);
        const cleanJson = responseText.replace(/```json/ig, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        res.json(result);
    } catch (err) {
        console.error("Complexity analysis error:", err);
        res.status(500).json({ error: "Failed to analyze complexity", details: err.message });
    }
});

const server = app.listen(PORT, () => {
    console.log(`DSA Visualizer running at http://localhost:${PORT}`);
    console.log("Open that URL in your browser. C++ sandbox active for trace generation.");
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\nPort ${PORT} is already in use.`);
        console.error(`Stop the other process (e.g. lsof -i :${PORT}) or set PORT in .env to a different value.\n`);
        process.exit(1);
    }
    throw err;
});
