// Global data
let animationData = null;
let currentStep = 0;
let autoplayTimer = null;
let autoplayActive = false;
let testCaseResults = [];
let activeTestCaseIndex = 0;

const API_BASE = window.location.origin;
const LS_SKIP_AI = 'dsa-viz-skip-ai';
const LS_AUTOPLAY_SPEED = 'dsa-viz-autoplay-speed';

// Prebuilt demo trace (no backend required)
const DEMO_TRACE = {
    array: [4, 2, 5],
    steps: [
        { step: 1, action: "focus_array", index: 0, value: 4, message: "Focusing on index 0 (Value: 4). Stack is empty." },
        { step: 2, action: "push_stack", index: 0, value: 4, message: "Pushed index 0 to stack." },
        { step: 3, action: "focus_array", index: 1, value: 2, message: "Focusing on index 1 (Value: 2)." },
        { step: 4, action: "compare", stackTopIndex: 0, stackTopValue: 4, arrayIndex: 1, arrayValue: 2, message: "2 is not greater than 4. Cannot resolve Next Greater Element yet." },
        { step: 5, action: "push_stack", index: 1, value: 2, message: "Pushed index 1 to stack." },
        { step: 6, action: "focus_array", index: 2, value: 5, message: "Focusing on index 2 (Value: 5)." },
        { step: 7, action: "compare", stackTopIndex: 1, stackTopValue: 2, arrayIndex: 2, arrayValue: 5, message: "5 is greater than 2! Found Next Greater Element for index 1." },
        { step: 8, action: "pop_stack", index: 1, message: "Popped index 1. Recorded its NGE as 5." },
        { step: 9, action: "resolve", index: 1, resolvedValue: 5, message: "Resolved index 1 with value 5." },
        { step: 10, action: "compare", stackTopIndex: 0, stackTopValue: 4, arrayIndex: 2, arrayValue: 5, message: "5 is greater than 4! Found Next Greater Element for index 0." },
        { step: 11, action: "pop_stack", index: 0, message: "Popped index 0. Recorded its NGE as 5." },
        { step: 12, action: "resolve", index: 0, resolvedValue: 5, message: "Resolved index 0 with value 5." },
        { step: 13, action: "push_stack", index: 2, value: 5, message: "Pushed index 2 to stack." },
        { step: 14, action: "finish", message: "Finished traversing array. Elements left in stack have no NGE (returns -1)." }
    ]
};

// DOM Elements
const arrayContainer = document.getElementById('array-container');
const stackContainer = document.getElementById('stack-container');
const messageBox = document.getElementById('message-box');
const stepCounter = document.getElementById('step-counter');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const autoplayBtn = document.getElementById('autoplay-btn');
const autoplaySpeed = document.getElementById('autoplay-speed');

// AI Input Elements
const generateBtn = document.getElementById('generate-btn');
const instrumentBtn = document.getElementById('instrument-btn');
const instrumentStatus = document.getElementById('instrument-status');
const demoBtn = document.getElementById('demo-btn');
const arrayInput = document.getElementById('array-input');
const sessionIdInput = document.getElementById('session-id-input');
const codeInput = document.getElementById('code-input');
const loadingSpinner = document.getElementById('loading-spinner');
const algoSelect = document.getElementById('algo-select');
const leetcodeUrlInput = document.getElementById('leetcode-url');
const importLcBtn = document.getElementById('import-lc-btn');
const copyCodeBtn = document.getElementById('copy-code-btn');
const resetCodeBtn = document.getElementById('reset-code-btn');
const skipAiCheckbox = document.getElementById('skip-ai-checkbox');
const lcImportNotice = document.getElementById('lc-import-notice');
const stepSlider = document.getElementById('step-slider');
const stepListPanel = document.getElementById('step-list-panel');
const stepListEl = document.getElementById('step-list');
const testCasesInput = document.getElementById('test-cases-input');
const runAllBtn = document.getElementById('run-all-btn');
const batchProgress = document.getElementById('batch-progress');
const testCaseTabs = document.getElementById('test-case-tabs');
const downloadJsonBtn = document.getElementById('download-json-btn');

function shortStepLabel(step) {
    if (!step) return '';
    const action = step.action || '';
    const msg = (step.message || '').trim();
    if (msg.length > 48) return `${action}: ${msg.slice(0, 45)}…`;
    if (msg) return `${action}: ${msg}`;
    return action;
}

function syncStepSlider(maxSteps) {
    if (!stepSlider) return;
    stepSlider.min = '0';
    stepSlider.max = String(maxSteps);
    stepSlider.value = String(currentStep);
    stepSlider.disabled = !animationData;
}

function updateStepList() {
    if (!stepListEl || !stepListPanel) return;
    if (!animationData || !animationData.steps?.length) {
        stepListPanel.classList.add('hidden');
        stepListEl.innerHTML = '';
        return;
    }
    stepListPanel.classList.remove('hidden');
    stepListEl.innerHTML = '';
    animationData.steps.forEach((step, i) => {
        const li = document.createElement('li');
        li.className = 'step-list-item' + (i + 1 === currentStep ? ' active' : '');
        li.textContent = `${i + 1}. ${shortStepLabel(step)}`;
        li.addEventListener('click', () => {
            stopAutoplay();
            currentStep = i + 1;
            render();
        });
        stepListEl.appendChild(li);
    });
}

function goToStep(step) {
    if (!animationData) return;
    const max = animationData.steps.length;
    currentStep = Math.max(0, Math.min(step, max));
    render();
}

function loadTraceData(data, testInput) {
    stopAutoplay();
    animationData = data;
    currentStep = 0;
    if (testInput !== undefined) arrayInput.value = testInput;
    buildCodeViewer();
    buildTimelineHeatmap();
    render();
    
    // Extract and display the execution result if present
    const resultPanel = document.getElementById('execution-results-panel');
    const resultContent = document.getElementById('execution-results-content');
    if (resultPanel && resultContent && data && data.steps) {
        const resultStep = data.steps.find(s => s.action === 'result');
        if (resultStep && resultStep.value !== undefined) {
            resultPanel.classList.remove('hidden');
            resultContent.textContent = typeof resultStep.value === 'object' ? JSON.stringify(resultStep.value) : String(resultStep.value);
        } else {
            resultPanel.classList.add('hidden');
            resultContent.textContent = 'No output yet.';
        }
    }
}

function injectGraphAdjacency(code, graphNodes, graphEdges) {
    if (!code.includes('// @GRAPH_ADJ_BUILD')) return code;
    const n = graphNodes || 0;
    const edgeLines = (graphEdges || [])
        .map(([u, v]) => `        adj[${u}].push_back(${v});`)
        .join('\n');
    return code
        .replace('// @GRAPH_NODE_COUNT', String(n))
        .replace('// @GRAPH_ADJ_BUILD', edgeLines || '        // no edges');
}

async function fetchTrace(code, arrayStr, skipAI, sessionId, attempt) {
    const payload = {
        code,
        array: arrayStr,
        is2D: window.is2DProblem,
        isGraph: window.isGraphProblem,
        graphNodes: window.graphNodes,
        graphEdges: window.graphEdges,
        noAI: skipAI,
        sessionId: sessionId,
        attempt: attempt
    };
    const parsed = parseTestInput(arrayStr);
    let preparedCode = injectGraphAdjacency(code, parsed.graphNodes, parsed.graphEdges);
    const { array, is2D, isGraph, graphNodes, graphEdges } = parsed;

    if (!isGraph && (!array || array.length === 0)) {
        throw new Error('Invalid test input. Use: 4, 2, 5 | [[1,0],[0,1]] | [[0,1],[1,2]] graph edges | 4; 0,1; 0,2');
    }
    if (isGraph && graphEdges.length === 0) {
        throw new Error('Invalid graph edges. Example: [[0,1],[1,2],[0,2]]');
    }

    const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: preparedCode,
            array: isGraph ? graphEdges : array,
            is2D,
            isGraph,
            graphNodes: isGraph ? graphNodes : undefined,
            graphEdges: isGraph ? graphEdges : undefined,
            noAI: skipAI,
            sessionId: sessionId,
            attempt: attempt,
            title: window.currentProblemTitle || "Custom Problem",
            content: window.currentProblemContent || ""
        })
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.details || `Server error: ${response.status}`);
    }
    return response.json();
}

function renderTestCaseTabs() {
    if (!testCaseTabs) return;
    testCaseTabs.innerHTML = '';
    if (testCaseResults.length <= 1) {
        testCaseTabs.classList.add('hidden');
        return;
    }
    testCaseTabs.classList.remove('hidden');
    testCaseResults.forEach((result, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'test-case-tab' + (idx === activeTestCaseIndex ? ' active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', idx === activeTestCaseIndex ? 'true' : 'false');
        const label = result.input.length > 24 ? `${result.input.slice(0, 21)}…` : result.input;
        btn.textContent = result.error ? `Case ${idx + 1} ✗` : `Case ${idx + 1}: ${label}`;
        btn.title = result.error || result.input;
        btn.addEventListener('click', () => {
            activeTestCaseIndex = idx;
            const r = testCaseResults[idx];
            if (r.trace) {
                loadTraceData(r.trace, r.input);
            } else {
                messageBox.innerText = `Case ${idx + 1} failed: ${r.error}`;
            }
            renderTestCaseTabs();
        });
        testCaseTabs.appendChild(btn);
    });
}

function loadPreferences() {
    try {
        const skip = localStorage.getItem(LS_SKIP_AI);
        if (skip !== null && skipAiCheckbox) skipAiCheckbox.checked = skip === 'true';
        const speed = localStorage.getItem(LS_AUTOPLAY_SPEED);
        if (speed && autoplaySpeed) autoplaySpeed.value = speed;
    } catch (_) { /* ignore */ }
}

function savePreferences() {
    try {
        if (skipAiCheckbox) localStorage.setItem(LS_SKIP_AI, String(skipAiCheckbox.checked));
        if (autoplaySpeed) localStorage.setItem(LS_AUTOPLAY_SPEED, autoplaySpeed.value);
    } catch (_) { /* ignore */ }
}

function stopAutoplay() {
    if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
    }
    autoplayActive = false;
    if (autoplayBtn) {
        autoplayBtn.textContent = '▶ Auto-play';
    }
}

function startAutoplay() {
    stopAutoplay();
    const delay = parseInt(autoplaySpeed.value, 10) || 1000;
    autoplayActive = true;
    autoplayBtn.textContent = '⏸ Pause';
    autoplayTimer = setInterval(() => {
        if (!animationData || currentStep >= animationData.steps.length) {
            stopAutoplay();
            return;
        }
        currentStep++;
        render();
        syncStepSlider(animationData.steps.length);
        if (currentStep >= animationData.steps.length) {
            stopAutoplay();
        }
    }, delay);
}

function sdkHintsForCode(code) {
    const hints = [];
    if (/stack\s*</i.test(code) || /\bstack\b/.test(code)) {
        hints.push('Use stack<int> st; — pushes/pops are traced automatically. Add compare(i,j) and resolve(idx,val) for NGE-style problems.');
    }
    if (/queue\s*</i.test(code) || /\bqueue\b/.test(code)) {
        hints.push('Use queue<int> — enqueue/dequeue steps are logged automatically.');
    }
    if (/deque\s*</i.test(code) || /\bdeque\b/.test(code)) {
        hints.push('Use deque<int> — push_back / pop_front / pop_back are traced.');
    }
    if (/TreeNode/i.test(code)) {
        hints.push('Call visit(node) when visiting a node in traversal.');
    }
    if (/ListNode/i.test(code)) {
        hints.push('Use focus_node(ptr, "label") and update_next(from, to) when rewiring pointers.');
    }
    if (/vector\s*<\s*vector/i.test(code)) {
        hints.push('Use focus_cell(r,c) and update_cell(r,c,val) for grid algorithms.');
    }
    if (/priority_queue/i.test(code)) {
        hints.push('Use priority_queue<int> for index heaps — push/pop emit push_heap / pop_heap steps.');
    }
    if (/unordered_map|VisualizerMap/i.test(code)) {
        hints.push('Use VisualizerMap with put(key,val), get(key), and erase(key) for hash map tracing.');
    }
    if (/VISUALIZER_GRAPH|visit_graph|graph_init/i.test(code)) {
        hints.push('Mark graph solutions with // VISUALIZER_GRAPH; call visit_graph(node) and focus_graph_edge(u,v).');
    }
    if (/focus_pointer/i.test(code)) {
        hints.push('Use focus_pointer("left", i) and focus_pointer("right", j) for two-pointer algorithms.');
    }
    if (hints.length === 0) {
        hints.push('Instrument your solution with compare(), resolve(), visit(), focus_cell(), or focus_node() — see README SDK section.');
    }
    return hints;
}

function showLcImportNotice(code) {
    const hints = sdkHintsForCode(code);
    lcImportNotice.innerHTML = `
        <strong>LeetCode code imported.</strong> Raw stubs are not visualized until you add SDK calls
        (<code>compare</code>, <code>resolve</code>, <code>visit</code>, etc.).
        <a href="README.md" target="_blank" rel="noopener">Read the SDK section in README</a>.
        <ul>${hints.map((h) => `<li>${h}</li>`).join('')}</ul>
    `;
    lcImportNotice.classList.remove('hidden');
}

function render() {
    // Premium integrations: Synchronized code viewer rendering
    const codeViewerContainer = document.getElementById('code-viewer-container');
    if (animationData) {
        codeInput.classList.add('hidden');
        if (codeViewerContainer) {
            codeViewerContainer.classList.remove('hidden');
            if (codeViewerContainer.children.length === 0) {
                buildCodeViewer();
            }
        }
    } else {
        codeInput.classList.remove('hidden');
        if (codeViewerContainer) {
            codeViewerContainer.classList.add('hidden');
            codeViewerContainer.innerHTML = '';
        }
    }

    if (!animationData) {
        arrayContainer.innerHTML = '';
        stackContainer.innerHTML = '';
        const containers = ['tree-container', 'grid-container', 'list-container', 'heap-container', 'map-container', 'graph-container', 'recursive-stack-container'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        messageBox.innerText = 'No trace loaded. Pick a template, click Generate, or use Load demo trace for instant playback.';
        stepCounter.innerText = 'Step: 0 / 0';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
        if (autoplayBtn) autoplayBtn.disabled = true;
        if (downloadJsonBtn) downloadJsonBtn.disabled = true;
        syncStepSlider(0);
        updateStepList();
        return;
    }

    const maxSteps = animationData.steps.length;

    // 1. Check problem type and toggle panel visibilities
    const treeSection = document.getElementById('tree-section');
    const stackSection = document.getElementById('stack-section');
    const arraySection = document.getElementById('array-section');
    const gridSection = document.getElementById('grid-section');
    const listSection = document.getElementById('list-section');
    const heapSection = document.getElementById('heap-section');
    const mapSection = document.getElementById('map-section');
    const graphSection = document.getElementById('graph-section');

    const steps = animationData.steps || [];
    const isTreeProblem = steps.some(s => s.action === 'init_tree');
    const isGridProblem = steps.some(s => s.action === 'init_grid');
    const isListProblem = steps.some(s => s.action === 'init_list');
    const isGraphProblem = steps.some(s => s.action === 'init_graph');
    const isHeapProblem = steps.some(s => s.action === 'init_heap' || s.action === 'push_heap' || s.action === 'pop_heap');
    const isMapProblem = steps.some(s => s.action === 'init_map' || (s.action && s.action.startsWith('map_')));
    const hasArrayPointers = steps.some(s => s.action === 'focus_pointer');
    const isStackProblem = steps.some(s => s.action.includes('stack') || s.action.includes('queue') || s.action.includes('deque'));

    [heapSection, mapSection, graphSection].forEach((el) => { if (el) el.classList.add('hidden'); });

    if (isGraphProblem) {
        graphSection.classList.remove('hidden');
        listSection.classList.add('hidden');
        gridSection.classList.add('hidden');
        arraySection.classList.add('hidden');
        stackSection.classList.add('hidden');
        treeSection.classList.add('hidden');
        if (isHeapProblem) heapSection.classList.remove('hidden');
        if (isMapProblem) mapSection.classList.remove('hidden');
    } else if (isListProblem) {
        listSection.classList.remove('hidden');
        gridSection.classList.add('hidden');
        arraySection.classList.add('hidden');
        stackSection.classList.add('hidden');
        treeSection.classList.add('hidden');
    } else if (isGridProblem) {
        listSection.classList.add('hidden');
        gridSection.classList.remove('hidden');
        arraySection.classList.add('hidden');
        stackSection.classList.add('hidden');
        treeSection.classList.add('hidden');
    } else {
        listSection.classList.add('hidden');
        gridSection.classList.add('hidden');
        if (isTreeProblem) {
            treeSection.classList.remove('hidden');
        } else {
            treeSection.classList.add('hidden');
        }

        if (isHeapProblem) heapSection.classList.remove('hidden');
        if (isMapProblem) mapSection.classList.remove('hidden');

        if (isStackProblem) {
            stackSection.classList.remove('hidden');
            const isQueue = steps.some(s => s.action.includes('queue') && !s.action.includes('heap'));
            const isDeque = steps.some(s => s.action.includes('deque'));
            document.getElementById('stack-header').textContent = isQueue ? 'Queue' : (isDeque ? 'Deque' : 'Stack');
        } else {
            if (isTreeProblem || isHeapProblem) {
                stackSection.classList.add('hidden');
            } else {
                stackSection.classList.remove('hidden');
                document.getElementById('stack-header').textContent = 'Stack';
            }
        }
    }

    // 2. Simulate state up to currentStep
    let stack = [];
    const dataArray = animationData.array || [];
    let resolvedNGEs = new Array(Math.max(dataArray.length, 1)).fill("?");

    // Transient UI state for the *current* frame
    let focusedIndex = -1;
    let comparingStackIndex = -1;
    let comparingArrayIndex = -1;

    // Tree visited nodes list
    let visitedTreeNodes = new Set();
    let focusedTreeNodePtr = null;

    // Grid tracking state
    let gridRows = 0;
    let gridCols = 0;
    let gridCells = {};
    let visitedGridCells = new Set();
    let focusedGridCell = null;

    // Linked List tracking state
    let listNodesMap = {};
    let initialOrder = [];
    let focusedListNodePtr = null;
    let pointerLabels = {}; // label -> ptr (linked list)

    // Heap / map / graph / two-pointer / recursion state
    let heap = [];
    let mapState = {};
    let erasedMapKeys = new Set();
    let focusedMapKey = null;
    let graphNodeCount = 0;
    let graphEdges = [];
    let visitedGraphNodes = new Set();
    let focusedGraphNode = null;
    let focusedGraphEdge = null;
    let arrayPointerLabels = {}; // label -> index
    let focusedHeapIndex = -1;
    let activeFrames = [];

    for (let i = 0; i < currentStep; i++) {
        const stepData = steps[i];
        if (!stepData) continue;

        // Apply persistent state changes
        if (stepData.action === "push_stack" || stepData.action === "push_queue" || stepData.action === "push_back_deque") {
            stack.push(stepData.index);
        } else if (stepData.action === "pop_stack" || stepData.action === "pop_queue" || stepData.action === "pop_back_deque") {
            stack.pop();
        } else if (stepData.action === "resolve") {
            resolvedNGEs[stepData.index] = stepData.resolvedValue;
        } else if (stepData.action === "visit_tree_node") {
            visitedTreeNodes.add(stepData.ptr);
        } else if (stepData.action === "init_grid") {
            gridRows = stepData.rows;
            gridCols = stepData.cols;
        } else if (stepData.action === "grid_cell") {
            gridCells[`${stepData.row},${stepData.col}`] = stepData.val;
        } else if (stepData.action === "update_cell") {
            gridCells[`${stepData.row},${stepData.col}`] = stepData.val;
            visitedGridCells.add(`${stepData.row},${stepData.col}`);
        } else if (stepData.action === "focus_cell") {
            visitedGridCells.add(`${stepData.row},${stepData.col}`);
        } else if (stepData.action === "init_list") {
            listNodesMap = {};
            initialOrder = [];
            pointerLabels = {};
        } else if (stepData.action === "list_node") {
            listNodesMap[stepData.ptr] = { val: stepData.val, next: stepData.next };
            if (!initialOrder.includes(stepData.ptr)) {
                initialOrder.push(stepData.ptr);
            }
        } else if (stepData.action === "update_next") {
            if (listNodesMap[stepData.from]) {
                listNodesMap[stepData.from].next = stepData.to;
            }
        } else if (stepData.action === "focus_node") {
            pointerLabels[stepData.label] = stepData.ptr;
        } else if (stepData.action === "push_heap") {
            heap.push({ index: stepData.index, value: stepData.value });
        } else if (stepData.action === "pop_heap") {
            heap.pop();
        } else if (stepData.action === "map_put") {
            mapState[stepData.key] = stepData.val;
            erasedMapKeys.delete(stepData.key);
        } else if (stepData.action === "map_get") {
            focusedMapKey = stepData.key;
        } else if (stepData.action === "map_erase") {
            delete mapState[stepData.key];
            erasedMapKeys.add(stepData.key);
        } else if (stepData.action === "init_graph") {
            graphNodeCount = stepData.nodes;
            graphEdges = [];
            visitedGraphNodes = new Set();
        } else if (stepData.action === "graph_edge") {
            graphEdges.push({ u: stepData.u, v: stepData.v });
        } else if (stepData.action === "visit_graph_node") {
            visitedGraphNodes.add(stepData.node);
        } else if (stepData.action === "focus_pointer") {
            arrayPointerLabels[stepData.label] = stepData.index;
        } else if (stepData.action === "push_frame") {
            activeFrames.push({ name: stepData.name, args: stepData.args });
        } else if (stepData.action === "pop_frame") {
            activeFrames.pop();
        }

        // Apply transient state ONLY if it's the exact current step we are viewing
        if (i === currentStep - 1) {
            if (stepData.action === "focus_array") {
                focusedIndex = stepData.index;
            } else if (stepData.action === "compare") {
                comparingStackIndex = stepData.stackTopIndex;
                comparingArrayIndex = stepData.arrayIndex;
            } else if (stepData.action === "push_stack" || stepData.action === "push_queue") {
                focusedIndex = stepData.index;
            } else if (stepData.action === "pop_stack" || stepData.action === "pop_queue") {
                focusedIndex = stepData.index;
            } else if (stepData.action === "resolve") {
                focusedIndex = stepData.index;
            } else if (stepData.action === "visit_tree_node") {
                focusedTreeNodePtr = stepData.ptr;
            } else if (stepData.action === "focus_cell") {
                focusedGridCell = { row: stepData.row, col: stepData.col };
            } else if (stepData.action === "update_cell") {
                focusedGridCell = { row: stepData.row, col: stepData.col };
            } else if (stepData.action === "focus_node") {
                focusedListNodePtr = stepData.ptr;
            } else if (stepData.action === "update_next") {
                focusedListNodePtr = stepData.from;
            } else if (stepData.action === "push_heap" || stepData.action === "pop_heap") {
                focusedHeapIndex = stepData.index;
            } else if (stepData.action === "map_get" || stepData.action === "map_put") {
                focusedMapKey = stepData.key;
            } else if (stepData.action === "visit_graph_node") {
                focusedGraphNode = stepData.node;
            } else if (stepData.action === "focus_edge") {
                focusedGraphEdge = { u: stepData.u, v: stepData.v };
            } else if (stepData.action === "focus_pointer") {
                arrayPointerLabels[stepData.label] = stepData.index;
            }
        }
    }

    if (isGraphProblem && animationData.graphEdges && graphEdges.length === 0) {
        animationData.graphEdges.forEach(([u, v]) => graphEdges.push({ u, v }));
    }
    if (isGraphProblem && animationData.graphNodes && !graphNodeCount) {
        graphNodeCount = animationData.graphNodes;
    }

    // 3. Draw Array
    arrayContainer.innerHTML = '';
    const arrSource = animationData.array || [];
    const filteredArray = arrSource.filter(x => x !== null);
    if (filteredArray.length > 0 && !isGridProblem && !isGraphProblem) {
        arraySection.classList.remove('hidden');
        arrSource.forEach((val, idx) => {
            if (val === null) return;
            const box = document.createElement('div');
            box.className = 'array-box';
            if (hasArrayPointers) box.classList.add('has-pointer');
            box.innerText = val;

            if (hasArrayPointers) {
                const badges = document.createElement('div');
                badges.className = 'array-pointer-badges';
                Object.keys(arrayPointerLabels).forEach((label) => {
                    if (arrayPointerLabels[label] === idx) {
                        const badge = document.createElement('div');
                        badge.className = `array-pointer-badge ${label === 'right' ? 'right' : ''}`;
                        badge.innerText = label;
                        badges.appendChild(badge);
                    }
                });
                box.appendChild(badges);
            }

            const idxLabel = document.createElement('div');
            idxLabel.className = 'index-label';
            idxLabel.innerText = `[${idx}]`;
            box.appendChild(idxLabel);

            const ngeLabel = document.createElement('div');
            ngeLabel.className = 'nge-label';
            ngeLabel.innerText = `Result: ${resolvedNGEs[idx]}`;
            box.appendChild(ngeLabel);

            if (resolvedNGEs[idx] !== "?") {
                box.classList.add('resolved');
            }
            if (idx === focusedIndex) {
                box.classList.add('focused');
            }
            if (idx === comparingArrayIndex) {
                box.classList.add('comparing');
            }

            arrayContainer.appendChild(box);
        });
    } else {
        arraySection.classList.add('hidden');
    }

    // 4. Draw Stack / Queue
    stackContainer.innerHTML = '';
    if (stack.length > 0 || steps.some(s => s.action === 'push_stack' || s.action === 'pop_stack' || s.action === 'push_queue' || s.action === 'pop_queue')) {
        if (stackSection) stackSection.classList.remove('hidden');
        stack.forEach((idx) => {
            const item = document.createElement('div');
            item.className = 'stack-item';

            const idxSpan = document.createElement('span');
            idxSpan.className = 'index-val';
            idxSpan.innerText = `idx: ${idx}`;

            const valSpan = document.createElement('span');
            valSpan.className = 'actual-val';
            valSpan.innerText = `(val: ${arrSource[idx]})`;

            item.appendChild(idxSpan);
            item.appendChild(valSpan);

            if (idx === comparingStackIndex) {
                item.classList.add('comparing');
            }

            stackContainer.appendChild(item);
        });
    } else {
        if (stackSection) stackSection.classList.add('hidden');
    }

    // 5. Draw Binary Tree
    if (isTreeProblem) {
        const treeContainer = document.getElementById('tree-container');
        treeContainer.innerHTML = '';

        const rootStep = steps.find(s => s.action === 'init_tree');
        const rootPtr = rootStep ? rootStep.root : null;

        if (rootPtr) {
            const treeNodes = steps.filter(s => s.action === 'tree_node');
            const nodeMap = {};
            treeNodes.forEach(node => {
                nodeMap[node.ptr] = {
                    val: node.val,
                    left: node.left !== 'null' ? node.left : null,
                    right: node.right !== 'null' ? node.right : null,
                    x: 0,
                    y: 0
                };
            });

            // Compute layout coordinates
            const containerWidth = treeContainer.clientWidth || 550;
            function assignCoordinates(ptr, depth, left, right) {
                if (!ptr || !nodeMap[ptr]) return;
                const node = nodeMap[ptr];
                const x = (left + right) / 2;
                const y = depth * 75 + 40;
                node.x = x;
                node.y = y;

                assignCoordinates(node.left, depth + 1, left, x);
                assignCoordinates(node.right, depth + 1, x, right);
            }
            assignCoordinates(rootPtr, 0, 0, containerWidth);

            // Create SVG line elements
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.position = 'absolute';
            svg.style.left = '0';
            svg.style.top = '0';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '1';
            treeContainer.appendChild(svg);

            // Draw connection lines
            Object.keys(nodeMap).forEach(ptr => {
                const node = nodeMap[ptr];

                if (node.left && nodeMap[node.left]) {
                    const child = nodeMap[node.left];
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', node.x);
                    line.setAttribute('y1', node.y);
                    line.setAttribute('x2', child.x);
                    line.setAttribute('y2', child.y);
                    line.setAttribute('class', 'tree-edge');
                    if (visitedTreeNodes.has(node.left) && visitedTreeNodes.has(ptr)) {
                        line.classList.add('highlighted');
                    }
                    svg.appendChild(line);
                }

                if (node.right && nodeMap[node.right]) {
                    const child = nodeMap[node.right];
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', node.x);
                    line.setAttribute('y1', node.y);
                    line.setAttribute('x2', child.x);
                    line.setAttribute('y2', child.y);
                    line.setAttribute('class', 'tree-edge');
                    if (visitedTreeNodes.has(node.right) && visitedTreeNodes.has(ptr)) {
                        line.classList.add('highlighted');
                    }
                    svg.appendChild(line);
                }
            });

            // Create HTML circle elements
            Object.keys(nodeMap).forEach(ptr => {
                const node = nodeMap[ptr];
                const circle = document.createElement('div');
                circle.className = 'tree-node-circle';
                circle.textContent = node.val;
                circle.style.left = `${node.x - 23}px`;
                circle.style.top = `${node.y - 23}px`;

                if (ptr === focusedTreeNodePtr) {
                    circle.classList.add('focused');
                }
                if (visitedTreeNodes.has(ptr)) {
                    circle.classList.add('visited');
                }

                treeContainer.appendChild(circle);
            });
        }
    }

    // 5.5 Draw 2D Grid
    if (isGridProblem) {
        const gridContainer = document.getElementById('grid-container');
        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${gridCols}, 45px)`;

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                const cellValue = gridCells[`${r},${c}`] !== undefined ? gridCells[`${r},${c}`] : 0;

                cell.innerText = cellValue;

                // Color standard '0' vs '1' or others beautifully
                if (cellValue === 0 || cellValue === '#') {
                    cell.classList.add('wall');
                }

                const key = `${r},${c}`;
                if (focusedGridCell && focusedGridCell.row === r && focusedGridCell.col === c) {
                    cell.classList.add('focused');
                } else if (visitedGridCells.has(key)) {
                    cell.classList.add('visited');
                }

                gridContainer.appendChild(cell);
            }
        }
    }

    // 5.6 Draw Linked List
    if (isListProblem) {
        const listContainer = document.getElementById('list-container');
        listContainer.innerHTML = '';

        // 1. Create nodes in DOM so they get placed by CSS flex layout
        const nodeElementsMap = {};
        initialOrder.forEach((ptr) => {
            const nodeData = listNodesMap[ptr];
            if (!nodeData) return;

            const outerWrapper = document.createElement('div');
            outerWrapper.style.position = 'relative';
            outerWrapper.style.display = 'inline-block';

            const nodeDiv = document.createElement('div');
            nodeDiv.className = 'list-node';
            nodeDiv.innerText = nodeData.val;

            if (ptr === focusedListNodePtr) {
                nodeDiv.classList.add('focused');
            }

            // Create pointer badges above this node
            const badgesContainer = document.createElement('div');
            badgesContainer.className = 'pointer-labels-container';

            Object.keys(pointerLabels).forEach((label) => {
                if (pointerLabels[label] === ptr) {
                    const badge = document.createElement('div');
                    badge.className = `pointer-badge ${label === 'prev' ? 'prev' : (label === 'temp' ? 'temp' : '')}`;
                    badge.innerText = label;
                    badgesContainer.appendChild(badge);
                }
            });

            outerWrapper.appendChild(badgesContainer);
            outerWrapper.appendChild(nodeDiv);
            listContainer.appendChild(outerWrapper);

            nodeElementsMap[ptr] = nodeDiv;
        });

        // 2. Add an SVG canvas overlay to draw lines between nodes
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'list-svg-canvas');
        svg.style.width = `${listContainer.scrollWidth}px`;
        svg.style.height = `${listContainer.scrollHeight}px`;
        listContainer.appendChild(svg);

        // Add standard arrow markers definition for vector heads
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

        // Marker 1: Standard gray arrow
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        const markerPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        markerPath.setAttribute('d', 'M 0 1.5 L 8 5 L 0 8.5 z');
        markerPath.setAttribute('fill', 'rgba(255, 255, 255, 0.25)');
        marker.appendChild(markerPath);
        defs.appendChild(marker);

        // Marker 2: Active neon-blue arrow
        const activeMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        activeMarker.setAttribute('id', 'arrow-active');
        activeMarker.setAttribute('viewBox', '0 0 10 10');
        activeMarker.setAttribute('refX', '8');
        activeMarker.setAttribute('refY', '5');
        activeMarker.setAttribute('markerWidth', '6');
        activeMarker.setAttribute('markerHeight', '6');
        activeMarker.setAttribute('orient', 'auto-start-reverse');
        const activePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        activePath.setAttribute('d', 'M 0 1.5 L 8 5 L 0 8.5 z');
        activePath.setAttribute('fill', '#38bdf8');
        activeMarker.appendChild(activePath);
        defs.appendChild(activeMarker);

        // Marker 3: Reassigned neon-pink arrow
        const reassignedMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        reassignedMarker.setAttribute('id', 'arrow-reassigned');
        reassignedMarker.setAttribute('viewBox', '0 0 10 10');
        reassignedMarker.setAttribute('refX', '8');
        reassignedMarker.setAttribute('refY', '5');
        reassignedMarker.setAttribute('markerWidth', '6');
        reassignedMarker.setAttribute('markerHeight', '6');
        reassignedMarker.setAttribute('orient', 'auto-start-reverse');
        const reassignedPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        reassignedPath.setAttribute('d', 'M 0 1.5 L 8 5 L 0 8.5 z');
        reassignedPath.setAttribute('fill', '#f472b6');
        reassignedMarker.appendChild(reassignedPath);
        defs.appendChild(reassignedMarker);

        svg.appendChild(defs);

        // 3. Draw arrows dynamically using the elements' absolute bounds relative to container
        const containerRect = listContainer.getBoundingClientRect();
        initialOrder.forEach((ptr) => {
            const nodeData = listNodesMap[ptr];
            if (!nodeData || nodeData.next === 'null' || !listNodesMap[nodeData.next]) return;

            const fromEl = nodeElementsMap[ptr];
            const toEl = nodeElementsMap[nodeData.next];
            if (!fromEl || !toEl) return;

            const fromRect = fromEl.getBoundingClientRect();
            const toRect = toEl.getBoundingClientRect();

            // Source (center of right edge)
            const x1 = (fromRect.left + fromRect.width) - containerRect.left + listContainer.scrollLeft;
            const y1 = (fromRect.top + fromRect.height / 2) - containerRect.top + listContainer.scrollTop;

            // Target (center of left edge)
            const x2 = toRect.left - containerRect.left + listContainer.scrollLeft;
            const y2 = (toRect.top + toRect.height / 2) - containerRect.top + listContainer.scrollTop;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'list-arrow');

            // Draw a curved arc if target is far away or reversed (x2 <= x1)
            let d;
            if (x2 <= x1) {
                const curveOffset = 60; // loop above
                d = `M ${x1} ${y1} C ${x1 + 30} ${y1 - curveOffset}, ${x2 - 30} ${y2 - curveOffset}, ${x2} ${y2}`;
            } else {
                d = `M ${x1} ${y1} L ${x2} ${y2}`;
            }
            path.setAttribute('d', d);

            // Highlight state
            const currentStepData = currentStep > 0 ? steps[currentStep - 1] : null;
            if (currentStepData && currentStepData.action === 'update_next' && currentStepData.from === ptr) {
                path.classList.add('reassigned');
                path.setAttribute('marker-end', 'url(#arrow-reassigned)');
            } else if (ptr === focusedListNodePtr) {
                path.classList.add('active');
                path.setAttribute('marker-end', 'url(#arrow-active)');
            } else {
                path.setAttribute('marker-end', 'url(#arrow)');
            }

            svg.appendChild(path);
        });
    }

    // 5.7 Draw priority heap
    if (isHeapProblem) {
        const heapContainer = document.getElementById('heap-container');
        if (heapContainer) {
            heapContainer.innerHTML = '';
            heap.forEach((item) => {
                const el = document.createElement('div');
                el.className = 'heap-item';
                el.innerText = `idx ${item.index} (val ${item.value ?? item.index})`;
                if (item.index === focusedHeapIndex) el.classList.add('focused');
                heapContainer.appendChild(el);
            });
        }
    }

    // 5.8 Draw hash map
    if (isMapProblem) {
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.innerHTML = '';
            Object.keys(mapState).sort((a, b) => Number(a) - Number(b)).forEach((key) => {
                const chip = document.createElement('div');
                chip.className = 'map-chip';
                chip.innerText = `${key} → ${mapState[key]}`;
                if (Number(key) === Number(focusedMapKey)) chip.classList.add('focused');
                mapContainer.appendChild(chip);
            });
            erasedMapKeys.forEach((key) => {
                const chip = document.createElement('div');
                chip.className = 'map-chip erased';
                chip.innerText = `${key} (erased)`;
                mapContainer.appendChild(chip);
            });
        }
    }

    // 5.9 Draw graph
    if (isGraphProblem) {
        const graphContainer = document.getElementById('graph-container');
        if (graphContainer) {
            graphContainer.innerHTML = '';
            let n = graphNodeCount;
            if (!n && graphEdges.length > 0) {
                n = Math.max(...graphEdges.flatMap((e) => [e.u, e.v])) + 1;
            }
            if (!n) n = 1;
            const w = graphContainer.clientWidth || 480;
            const h = graphContainer.clientHeight || 340;
            const cx = w / 2;
            const cy = h / 2;
            const radius = Math.min(w, h) * 0.35;
            const positions = {};
            for (let i = 0; i < n; i++) {
                const angle = (2 * Math.PI * i) / n - Math.PI / 2;
                positions[i] = {
                    x: cx + radius * Math.cos(angle),
                    y: cy + radius * Math.sin(angle)
                };
            }

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.position = 'absolute';
            svg.style.left = '0';
            svg.style.top = '0';
            svg.style.pointerEvents = 'none';
            graphContainer.appendChild(svg);

            graphEdges.forEach((edge) => {
                const p1 = positions[edge.u];
                const p2 = positions[edge.v];
                if (!p1 || !p2) return;
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', p1.x);
                line.setAttribute('y1', p1.y);
                line.setAttribute('x2', p2.x);
                line.setAttribute('y2', p2.y);
                line.setAttribute('class', 'graph-edge');
                if (focusedGraphEdge && focusedGraphEdge.u === edge.u && focusedGraphEdge.v === edge.v) {
                    line.classList.add('focused');
                }
                svg.appendChild(line);
            });

            for (let i = 0; i < n; i++) {
                const pos = positions[i];
                const nodeEl = document.createElement('div');
                nodeEl.className = 'graph-node';
                nodeEl.innerText = String(i);
                nodeEl.style.left = `${pos.x - 22}px`;
                nodeEl.style.top = `${pos.y - 22}px`;
                if (visitedGraphNodes.has(i)) nodeEl.classList.add('visited');
                if (focusedGraphNode === i) nodeEl.classList.add('focused');
                graphContainer.appendChild(nodeEl);
            }
        }
    }

    // 6. Update Controls & Message
    if (currentStep === 0) {
        messageBox.innerText = "AI Trace Generated! Press 'Next' to start tracking.";
    } else {
        const currentStepData = steps[currentStep - 1];
        messageBox.innerText = currentStepData.message || `Executing step ${currentStep}...`;
    }

    stepCounter.innerText = `Step: ${currentStep} / ${maxSteps}`;
    syncStepSlider(maxSteps);
    updateStepList();

    prevBtn.disabled = currentStep === 0;
    nextBtn.disabled = currentStep === maxSteps;
    if (autoplayBtn) {
        autoplayBtn.disabled = false;
        if (currentStep === maxSteps && autoplayActive) {
            stopAutoplay();
        }
    }
    if (downloadJsonBtn) downloadJsonBtn.disabled = false;

    // Premium integrations: synchronized code line highlighting
    const activeStep = steps[currentStep - 1];
    if (activeStep && activeStep.userLine) {
        highlightCodeLine(activeStep.userLine);
    } else {
        highlightCodeLine(null);
    }

    // Premium integrations: 3D Call Stack Rendering
    const recSection = document.getElementById('recursive-stack-section');
    const recContainer = document.getElementById('recursive-stack-container');
    if (recSection && recContainer) {
        const hasFrames = steps.some(s => s.action === 'push_frame');
        if (hasFrames) {
            recSection.classList.remove('hidden');
            recContainer.innerHTML = '';
            activeFrames.forEach((frame, idx) => {
                const el = document.createElement('div');
                el.className = 'stack-frame-3d';
                if (idx === activeFrames.length - 1) {
                    el.classList.add('active');
                }

                const nameEl = document.createElement('span');
                nameEl.className = 'stack-frame-name';
                nameEl.textContent = frame.name;

                const argsEl = document.createElement('span');
                argsEl.className = 'stack-frame-args';
                argsEl.textContent = frame.args || '()';

                el.appendChild(nameEl);
                el.appendChild(argsEl);
                recContainer.appendChild(el);
            });
            if (activeFrames.length === 0) {
                recContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">Stack is currently empty (base case or finished).</div>';
            }
        } else {
            recSection.classList.add('hidden');
        }
    }

    // (Premium integrations rendering is handled at the top of render)
}

// Templates
const templates = {
    "nge": {
        "array": "4, 2, 5, 1, 8",
        "code": "class Solution {\npublic:\n    vector<int> nextGreaterElements(vector<int>& nums) {\n        int n = nums.size();\n        vector<int> res(n, -1);\n        stack<int> st;\n        for (int i = 0; i < n; i++) {\n            // Compare elements visually\n            while (!st.empty() && compare(st.top(), i)) {\n                int poppedIdx = st.top();\n                st.pop();\n                res[poppedIdx] = nums[i];\n                resolve(poppedIdx, nums[i]);\n            }\n            st.push(i);\n        }\n        return res;\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    vector<int> nextGreaterElements(vector<int>& nums) {\n        int n = nums.size();\n        vector<int> res(n, -1);\n        stack<int> st;\n        for (int i = 0; i < n; i++) {\n            while (!st.empty() && nums[st.top()] < nums[i]) {\n                int poppedIdx = st.top();\n                st.pop();\n                res[poppedIdx] = nums[i];\n            }\n            st.push(i);\n        }\n        return res;\n    }\n};"
    },
    "daily_temperatures": {
        "array": "73, 74, 75, 71, 69, 72, 76, 73",
        "code": "class Solution {\npublic:\n    vector<int> dailyTemperatures(vector<int>& temperatures) {\n        int n = temperatures.size();\n        vector<int> res(n, 0);\n        stack<int> st;\n        for (int i = 0; i < n; i++) {\n            // Compare temperatures visually\n            while (!st.empty() && compare(st.top(), i)) {\n                int poppedIdx = st.top();\n                st.pop();\n                res[poppedIdx] = i - poppedIdx;\n                resolve(poppedIdx, i - poppedIdx);\n            }\n            st.push(i);\n        }\n        return res;\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    vector<int> dailyTemperatures(vector<int>& temperatures) {\n        int n = temperatures.size();\n        vector<int> res(n, 0);\n        stack<int> st;\n        for (int i = 0; i < n; i++) {\n            while (!st.empty() && temperatures[st.top()] < temperatures[i]) {\n                int poppedIdx = st.top();\n                st.pop();\n                res[poppedIdx] = i - poppedIdx;\n            }\n            st.push(i);\n        }\n        return res;\n    }\n};"
    },
    "tree_preorder": {
        "array": "1, null, 2, 3",
        "code": "class Solution {\npublic:\n    void preorder(TreeNode* root) {\n        if (!root) return;\n        \n        // Highlight this node visually on our circular tree layout!\n        visit(root);\n        \n        preorder(root->left);\n        preorder(root->right);\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    void preorder(TreeNode* root) {\n        if (!root) return;\n        preorder(root->left);\n        preorder(root->right);\n    }\n};"
    },
    "grid_dfs": {
        "array": "[[1, 1, 0, 0], [1, 1, 0, 1], [0, 0, 1, 1], [0, 0, 1, 1]]",
        "code": "class Solution {\npublic:\n    void dfs(vector<vector<int>>& grid, int r, int c) {\n        int rows = grid.size();\n        int cols = grid[0].size();\n        if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] != 1) {\n            return;\n        }\n        \n        // Focus & Update grid cell visually using our SDK\n        focus_cell(r, c);\n        grid[r][c] = 8; // Change visited value\n        update_cell(r, c, 8);\n        \n        dfs(grid, r + 1, c);\n        dfs(grid, r - 1, c);\n        dfs(grid, r, c + 1);\n        dfs(grid, r, c - 1);\n    }\n\n    void islandTraversal(vector<vector<int>>& grid) {\n        if (grid.empty()) return;\n        dfs(grid, 0, 0);\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    void dfs(vector<vector<int>>& grid, int r, int c) {\n        int rows = grid.size();\n        int cols = grid[0].size();\n        if (r < 0 || r >= rows || c < 0 || c >= cols || grid[r][c] != 1) {\n            return;\n        }\n        grid[r][c] = 8; // Change visited value\n        dfs(grid, r + 1, c);\n        dfs(grid, r - 1, c);\n        dfs(grid, r, c + 1);\n        dfs(grid, r, c - 1);\n    }\n    void islandTraversal(vector<vector<int>>& grid) {\n        if (grid.empty()) return;\n        dfs(grid, 0, 0);\n    }\n};"
    },
    "heap_top_k": {
        "array": "3, 1, 5, 12, 2, 7, 10",
        "code": "class Solution {\npublic:\n    vector<int> topK(vector<int>& nums) {\n        priority_queue<int> pq;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            pq.push(i);\n        }\n        vector<int> res;\n        while (!pq.empty()) {\n            int idx = pq.top();\n            pq.pop();\n            res.push_back(nums[idx]);\n        }\n        return res;\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    vector<int> topK(vector<int>& nums) {\n        priority_queue<int> pq;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            pq.push(i);\n        }\n        vector<int> res;\n        while (!pq.empty()) {\n            int idx = pq.top();\n            pq.pop();\n            res.push_back(nums[idx]);\n        }\n        return res;\n    }\n};"
    },
    "hashmap_two_sum": {
        "array": "2, 7, 11, 15",
        "code": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums) {\n        int target = 9;\n        VisualizerMap seen;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            int need = target - nums[i];\n            if (seen.count(need)) {\n                return { seen.get(need), i };\n            }\n            seen.put(nums[i], i);\n        }\n        return {};\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums) {\n        int target = 9;\n        unordered_map<int, int> seen;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            int need = target - nums[i];\n            if (seen.count(need)) {\n                return { seen[need], i };\n            }\n            seen[nums[i]] = i;\n        }\n        return {};\n    }\n};"
    },
    "binary_search": {
        "array": "1, 3, 5, 7, 9, 11, 13",
        "code": "class Solution {\npublic:\n    int search(vector<int>& nums) {\n        int target = 9;\n        int l = 0, r = (int)nums.size() - 1;\n        while (l <= r) {\n            int m = l + (r - l) / 2;\n            focus_pointer(\"mid\", m);\n            if (nums[m] == target) return m;\n            if (nums[m] < target) l = m + 1;\n            else r = m - 1;\n        }\n        return -1;\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    int search(vector<int>& nums) {\n        int target = 9;\n        int l = 0, r = (int)nums.size() - 1;\n        while (l <= r) {\n            int m = l + (r - l) / 2;\n            if (nums[m] == target) return m;\n            if (nums[m] < target) l = m + 1;\n            else r = m - 1;\n        }\n        return -1;\n    }\n};"
    },
    "sliding_window_max": {
        "array": "1, 3, -1, -3, 5, 3, 6, 7",
        "code": "class Solution {\npublic:\n    vector<int> maxSlidingWindow(vector<int>& nums) {\n        int k = 3;\n        deque<int> dq;\n        vector<int> res;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            while (!dq.empty() && dq.front() <= i - k) dq.pop_front();\n            while (!dq.empty() && nums[dq.back()] < nums[i]) dq.pop_back();\n            dq.push_back(i);\n            focus_pointer(\"left\", max(0, i - k + 1));\n            focus_pointer(\"right\", i);\n            if (i >= k - 1) res.push_back(nums[dq.front()]);\n        }\n        return res;\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    vector<int> maxSlidingWindow(vector<int>& nums) {\n        int k = 3;\n        deque<int> dq;\n        vector<int> res;\n        for (int i = 0; i < (int)nums.size(); i++) {\n            while (!dq.empty() && dq.front() <= i - k) dq.pop_front();\n            while (!dq.empty() && nums[dq.back()] < nums[i]) dq.pop_back();\n            dq.push_back(i);\n            if (i >= k - 1) res.push_back(nums[dq.front()]);\n        }\n        return res;\n    }\n};"
    },
    "valid_parentheses": {
        "array": "1, 2, 3, 4, 5, 6",
        "code": "class Solution {\npublic:\n    bool isValid(vector<int>& nums) {\n        stack<int> st;\n        auto open = [](int t) { return t == 1 || t == 3 || t == 5; };\n        auto matches = [](int openT, int closeT) {\n            return (openT == 1 && closeT == 2) || (openT == 3 && closeT == 4) || (openT == 5 && closeT == 6);\n        };\n        for (int i = 0; i < (int)nums.size(); i++) {\n            int c = nums[i];\n            if (open(c)) {\n                st.push(c);\n            } else {\n                if (st.empty()) return false;\n                int top = st.top();\n                st.pop();\n                if (!matches(top, c)) return false;\n            }\n        }\n        return st.empty();\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    bool isValid(vector<int>& nums) {\n        stack<int> st;\n        auto open = [](int t) { return t == 1 || t == 3 || t == 5; };\n        auto matches = [](int openT, int closeT) {\n            return (openT == 1 && closeT == 2) || (openT == 3 && closeT == 4) || (openT == 5 && closeT == 6);\n        };\n        for (int i = 0; i < (int)nums.size(); i++) {\n            int c = nums[i];\n            if (open(c)) {\n                st.push(c);\n            } else {\n                if (st.empty()) return false;\n                int top = st.top();\n                st.pop();\n                if (!matches(top, c)) return false;\n            }\n        }\n        return st.empty();\n    }\n};"
    },
    "graph_bfs": {
        "array": "4; 0,1; 0,2; 1,3; 2,3",
        "code": "// VISUALIZER_GRAPH\n// VISUALIZER_ENTRY: bfsDemo\nclass Solution {\npublic:\n    void bfsDemo() {\n        int n = // @GRAPH_NODE_COUNT;\n        vector<vector<int>> adj(n);\n        // @GRAPH_ADJ_BUILD\n        vector<bool> seen(n, false);\n        queue<int> q;\n        visit_graph(0);\n        seen[0] = true;\n        q.push(0);\n        while (!q.empty()) {\n            int u = q.front();\n            q.pop();\n            for (int v : adj[u]) {\n                if (seen[v]) continue;\n                focus_graph_edge(u, v);\n                visit_graph(v);\n                seen[v] = true;\n                q.push(v);\n            }\n        }\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    void bfsDemo() {\n        int n = // @GRAPH_NODE_COUNT;\n        vector<vector<int>> adj(n);\n        // @GRAPH_ADJ_BUILD\n        vector<bool> seen(n, false);\n        queue<int> q;\n        visit_graph(0);\n        seen[0] = true;\n        q.push(0);\n        while (!q.empty()) {\n            int u = q.front();\n            q.pop();\n            for (int v : adj[u]) {\n                if (seen[v]) continue;\n                focus_graph_edge(u, v);\n                visit_graph(v);\n                seen[v] = true;\n                q.push(v);\n            }\n        }\n    }\n};"
    },
    "twopointer_container": {
        "array": "1, 2, 3, 4, 5, 6",
        "code": "class Solution {\npublic:\n    int maxArea(vector<int>& height) {\n        int l = 0, r = (int)height.size() - 1;\n        int best = 0;\n        while (l < r) {\n            focus_pointer(\"left\", l);\n            focus_pointer(\"right\", r);\n            best = max(best, min(height[l], height[r]) * (r - l));\n            if (height[l] < height[r]) l++;\n            else r--;\n        }\n        return best;\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    int maxArea(vector<int>& height) {\n        int l = 0, r = (int)height.size() - 1;\n        int best = 0;\n        while (l < r) {\n            best = max(best, min(height[l], height[r]) * (r - l));\n            if (height[l] < height[r]) l++;\n            else r--;\n        }\n        return best;\n    }\n};"
    },
    "list_reverse": {
        "array": "1, 2, 3, 4, 5",
        "code": "class Solution {\npublic:\n    ListNode* reverseList(ListNode* head) {\n        ListNode* prev = nullptr;\n        ListNode* curr = head;\n        \n        while (curr != nullptr) {\n            ListNode* temp = curr->next;\n            \n            // Visual pointers update using our custom Linked List SDK!\n            focus_node(curr, \"curr\");\n            if (prev) focus_node(prev, \"prev\");\n            if (temp) focus_node(temp, \"temp\");\n            \n            // Perform link reassignment in C++\n            curr->next = prev;\n            \n            // Log pointer update step\n            update_next(curr, prev);\n            \n            // Move pointer references\n            prev = curr;\n            curr = temp;\n        }\n        return prev;\n    }\n};",
        "cleanCode": "class Solution {\npublic:\n    ListNode* reverseList(ListNode* head) {\n        ListNode* prev = nullptr;\n        ListNode* curr = head;\n        while (curr != nullptr) {\n            ListNode* temp = curr->next;\n            if (prev)\n            if (temp)\n            curr->next = prev;\n            prev = curr;\n            curr = temp;\n        }\n        return prev;\n    }\n};"
    }
};

algoSelect.addEventListener('change', (e) => {
    const val = e.target.value;

    if (!val) {
        arrayInput.value = '';
        codeInput.value = '';
        const titleEl = document.getElementById('problem-title');
        if (titleEl) titleEl.innerText = 'DSA Visualizer';
        animationData = null;
        currentStep = 0;
        render();
        return;
    }

    if (templates[val]) {
        arrayInput.value = templates[val].array;
        codeInput.value = templates[val].cleanCode || templates[val].code;
        window.instrumentedCode = templates[val].code;
        const titleEl = document.getElementById('problem-title');
        if (titleEl && templates[val].title) {
            titleEl.innerText = templates[val].title;
        }

        // Clear LeetCode inputs and concepts to prevent state pollution
        if (leetcodeUrlInput) leetcodeUrlInput.value = '';
        const conceptsPanel = document.getElementById('lc-concepts-panel');
        if (conceptsPanel) {
            conceptsPanel.classList.add('hidden');
            const conceptsContainer = document.getElementById('lc-concepts-container');
            if (conceptsContainer) conceptsContainer.innerHTML = '';
        }

        // Hide premium panels
        const edgePanel = document.getElementById('edge-cases-panel');
        if (edgePanel) edgePanel.classList.add('hidden');
        const compSection = document.getElementById('complexity-section');
        if (compSection) compSection.classList.add('hidden');
        const diagPanel = document.getElementById('diagnostics-panel');
        if (diagPanel) diagPanel.classList.add('hidden');

        // Hide standard templates notice if visible
        if (typeof lcImportNotice !== 'undefined' && lcImportNotice) {
            lcImportNotice.classList.add('hidden');
        }

        // Reset trace & playback state
        animationData = null;
        currentStep = 0;
        render();
    }
});

// Trigger change on load to populate default template
algoSelect.dispatchEvent(new Event('change'));

// Reset LeetCode concepts / Restore Template selector if input is cleared
leetcodeUrlInput.addEventListener('input', () => {
    if (!leetcodeUrlInput.value.trim()) {
        const templateSelectGroup = document.getElementById('template-select-group');
        const conceptsPanel = document.getElementById('lc-concepts-panel');
        if (templateSelectGroup) {
            templateSelectGroup.classList.remove('hidden');
        }
        if (conceptsPanel) {
            conceptsPanel.classList.add('hidden');
            const conceptsContainer = document.getElementById('lc-concepts-container');
            if (conceptsContainer) conceptsContainer.innerHTML = '';
        }

        // Hide premium panels
        const edgePanel = document.getElementById('edge-cases-panel');
        if (edgePanel) edgePanel.classList.add('hidden');
        const compSection = document.getElementById('complexity-section');
        if (compSection) compSection.classList.add('hidden');
        const diagPanel = document.getElementById('diagnostics-panel');
        if (diagPanel) diagPanel.classList.add('hidden');

        // Hide standard templates notice if visible
        if (typeof lcImportNotice !== 'undefined' && lcImportNotice) {
            lcImportNotice.classList.add('hidden');
        }
    }
});

importLcBtn.addEventListener('click', async () => {
    const url = leetcodeUrlInput.value.trim();
    if (!url) {
        alert("Please paste a LeetCode problem URL.");
        return;
    }

    // Clear previous trace & visualizer playback state
    animationData = null;
    currentStep = 0;
    if (arrayInput) arrayInput.value = '';
    render();

    // Set editor/message placeholders immediately to prevent racing compilation
    if (codeInput) {
        codeInput.value = '// Discovering problem and generating solution approach...';
    }
    if (messageBox) {
        messageBox.innerHTML = '<span class="loading-dots" style="color: var(--neon-blue);">AI is formulating optimal solution concepts & instrumented traces...</span>';
    }

    // Hide previous premium/diagnostics panels to prevent old data visibility
    const edgePanel = document.getElementById('edge-cases-panel');
    if (edgePanel) edgePanel.classList.add('hidden');
    const compSection = document.getElementById('complexity-section');
    if (compSection) compSection.classList.add('hidden');
    const diagPanel = document.getElementById('diagnostics-panel');
    if (diagPanel) diagPanel.classList.add('hidden');

    importLcBtn.disabled = true;
    importLcBtn.innerHTML = '<span class="loading-dots">Discovering...</span>';

    try {
        const response = await fetch(`${API_BASE}/leetcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Failed to fetch problem concepts`);
        }

        const data = await response.json();

        window.currentProblemTitle = data.title;
        window.currentProblemContent = data.content;

        // Dynamically update problem panel header and description!
        const titleEl = document.getElementById('problem-title');
        const difficultyEl = document.getElementById('problem-difficulty');
        const descriptionEl = document.getElementById('problem-description');
        const editorialEl = document.getElementById('problem-editorial');

        if (titleEl && data.title) titleEl.textContent = data.title;
        if (difficultyEl && data.difficulty) {
            difficultyEl.textContent = data.difficulty;
            difficultyEl.className = `difficulty-badge ${data.difficulty.toLowerCase()}`;
        }
        if (descriptionEl && data.content) descriptionEl.innerHTML = data.content;

        // Auto-generate dynamic Editorial tab content based on the problem title
        if (editorialEl && data.title) {
            const diffLower = data.difficulty.toLowerCase();
            editorialEl.innerHTML = `
                <div class="premium-editorial-card">
                    <div class="editorial-header-banner">
                        <span class="editorial-icon">✨</span>
                        <div class="editorial-titles">
                            <h3>Dynamic AI Solved Strategy</h3>
                            <span class="editorial-subtitle">AI-Powered Algorithm Analysis</span>
                        </div>
                    </div>
                    
                    <div class="editorial-content-body">
                        <div class="problem-status-bar">
                            <span class="status-label">Analyzing:</span>
                            <strong class="problem-name-glow">${data.title}</strong>
                            <span class="difficulty-badge ${diffLower}">${data.difficulty}</span>
                        </div>
                        
                        <div class="instruction-box">
                            <div class="instruction-icon">👉</div>
                            <div class="instruction-text">
                                <p>Select any of the conceptual approach cards under the <strong>Concepts</strong> tab to:</p>
                                <ul>
                                    <li>Load its optimal C++ code into the editor</li>
                                    <li>View Big-O complexity metrics</li>
                                    <li>Auto-run the visual animation tracing engine</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Auto-switch to Description tab so user sees problem statement immediately!
        const descTabBtn = document.getElementById('tab-btn-description');
        if (descTabBtn) descTabBtn.click();

        // Hide "Or choose a Template" select group to avoid layout congestion
        const templateSelectGroup = document.getElementById('template-select-group');
        if (templateSelectGroup) {
            templateSelectGroup.classList.add('hidden');
        }

        // 1. Populate standard default Array Input and C++ snippet immediately
        if (data.cppSnippet) {
            codeInput.value = data.cppSnippet;
            window.originalCppSnippet = data.cppSnippet;
        }
        if (data.array) {
            arrayInput.value = data.array;
        }

        // 2. Render Solution Concept Selector cards
        const conceptsPanel = document.getElementById('lc-concepts-panel');
        const conceptsContainer = document.getElementById('lc-concepts-container');

        if (conceptsPanel && conceptsContainer) {
            conceptsPanel.classList.remove('hidden');
            conceptsContainer.innerHTML = '';

            if (data.concepts && Array.isArray(data.concepts) && data.concepts.length > 0) {
                data.concepts.forEach(c => {
                    const card = document.createElement('div');

                    // Match complexity category for glowing neon left-borders
                    let compClass = 'complexity-linear';
                    const tc = (c.timeComplexity || '').toLowerCase();
                    if (tc.includes('log') && tc.includes('n')) compClass = 'complexity-linearithmic';
                    else if (tc.includes('2') || tc.includes('^2')) compClass = 'complexity-quadratic';
                    else if (tc.includes('log')) compClass = 'complexity-logarithmic';
                    else if (tc.includes('1')) compClass = 'complexity-constant';
                    else if (tc.includes('n')) compClass = 'complexity-linear';

                    card.className = `lc-concept-card ${compClass}`;

                    const header = document.createElement('div');
                    header.className = 'lc-concept-header';

                    const name = document.createElement('div');
                    name.className = 'lc-concept-name';
                    name.textContent = c.name;

                    const badge = document.createElement('div');
                    badge.className = 'lc-concept-badge';
                    badge.textContent = `${c.timeComplexity} | ${c.spaceComplexity}`;

                    header.appendChild(name);
                    header.appendChild(badge);

                    const summary = document.createElement('div');
                    summary.className = 'lc-concept-summary';
                    summary.textContent = c.summary;

                    card.appendChild(header);
                    card.appendChild(summary);

                    // Concept Card Click: Fetch the dynamic solved and instrumented Solution C++ code!
                    card.addEventListener('click', async () => {
                        // Mark active loading indicator on clicked card
                        card.style.opacity = '0.7';
                        badge.innerHTML = '<span class="loading-dots">Coding...</span>';

                        // Disable manual action buttons during active AI generation to prevent race condition compilation
                        if (generateBtn) generateBtn.disabled = true;
                        if (instrumentBtn) instrumentBtn.disabled = true;
                        if (importLcBtn) importLcBtn.disabled = true;
                        if (messageBox) {
                            messageBox.innerHTML = '<span class="loading-dots" style="color: var(--neon-blue);">AI is writing and auto-instrumenting the chosen concept solution...</span>';
                        }

                        try {
                            const solveRes = await fetch(`${API_BASE}/leetcode/solve-concept`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    title: data.title,
                                    difficulty: data.difficulty,
                                    content: data.content,
                                    cppSnippet: data.cppSnippet,
                                    conceptId: c.id,
                                    conceptName: c.name,
                                    conceptSummary: c.summary,
                                    array: data.array || arrayInput.value
                                })
                            });

                            if (!solveRes.ok) {
                                const solveErr = await solveRes.json();
                                throw new Error(solveErr.error || "Failed to generate solution code.");
                            }

                            const solveData = await solveRes.json();

                            // Load C++ code to editor
                            if (solveData.code) {
                                codeInput.value = solveData.code;
                            }
                            // Do not set window.instrumentedCode here. The code needs to be sent to /generate for auto-instrumentation.
                            window.instrumentedCode = '';
                            if (solveData.array) {
                                arrayInput.value = solveData.array;
                            }

                            // Load Complexity
                            const timeVal = document.getElementById('time-complexity-value');
                            const spaceVal = document.getElementById('space-complexity-value');
                            const bottlenecksEl = document.getElementById('complexity-bottlenecks');
                            const compSection = document.getElementById('complexity-section');

                            if (timeVal && spaceVal && bottlenecksEl && compSection) {
                                compSection.classList.remove('hidden');
                                timeVal.textContent = solveData.timeComplexity || c.timeComplexity;
                                spaceVal.textContent = solveData.spaceComplexity || c.spaceComplexity;
                                bottlenecksEl.textContent = solveData.bottlenecks || '';
                                renderComplexityChart(compClass.replace('complexity-', ''));
                            }

                            // Load Edge cases
                            const edgePanel = document.getElementById('edge-cases-panel');
                            const edgeContainer = document.getElementById('edge-cases-container');

                            if (edgePanel && edgeContainer) {
                                edgePanel.classList.remove('hidden');
                                edgeContainer.innerHTML = '';

                                if (solveData.edgeCases && Array.isArray(solveData.edgeCases)) {
                                    solveData.edgeCases.forEach(ec => {
                                        const eCard = document.createElement('div');
                                        eCard.className = 'edge-case-card';

                                        const eDetails = document.createElement('div');
                                        eDetails.className = 'edge-case-details';

                                        const eTitle = document.createElement('div');
                                        eTitle.className = 'edge-case-title';
                                        eTitle.textContent = ec.caseName;

                                        const eDesc = document.createElement('div');
                                        eDesc.className = 'edge-case-desc';
                                        eDesc.textContent = `Input: ${ec.input}`;
                                        
                                        const eExp = document.createElement('div');
                                        eExp.className = 'edge-case-expected';
                                        eExp.style.fontSize = '11px';
                                        eExp.style.color = 'var(--text-secondary)';
                                        eExp.style.marginTop = '4px';
                                        eExp.textContent = `Expected LLM Output: ${ec.expectedOutput || 'N/A'}`;

                                        eDetails.appendChild(eTitle);
                                        eDetails.appendChild(eDesc);
                                        eDetails.appendChild(eExp);

                                        const eBtn = document.createElement('button');
                                        eBtn.className = 'edge-case-load-btn';
                                        eBtn.textContent = 'Load & Run';

                                        eCard.appendChild(eDetails);
                                        eCard.appendChild(eBtn);

                                        eCard.addEventListener('click', () => {
                                            arrayInput.value = ec.input;
                                            generateBtn.click();
                                        });

                                        edgeContainer.appendChild(eCard);
                                    });
                                }
                            }

                            // Let user manually trigger Visualizer Execution when ready

                        } catch (err) {
                            console.error(err);
                            alert(`Failed to build concept solution: ${err.message || err}`);
                        } finally {
                            // Restore manual action buttons
                            if (generateBtn) generateBtn.disabled = false;
                            if (instrumentBtn) instrumentBtn.disabled = false;
                            if (importLcBtn) importLcBtn.disabled = false;
                            card.style.opacity = '1';
                            badge.textContent = `${c.timeComplexity} | ${c.spaceComplexity}`;
                        }
                    });

                    conceptsContainer.appendChild(card);
                });

                // Do not automatically trigger the first concept card; let the user select or paste their own code.
            } else {
                conceptsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">No alternative concepts discovered for this problem.</div>';
            }
        }

    } catch (error) {
        console.error(error);
        alert(`Failed to discover problem concepts: ${error.message || error}`);
    } finally {
        importLcBtn.disabled = false;
        importLcBtn.innerText = "Fetch";
    }
});

function parseTestInput(arrayStr) {
    let array = [];
    let is2D = false;
    let isGraph = false;
    let graphNodes = 0;
    let graphEdges = [];
    const trimmed = arrayStr.trim();

    // Robust check for string literals (e.g. "abcabcbb" or 'abcabcbb' or just a word abcabcbb)
    const unwrapped = trimmed.replace(/^['"]|['"]$/g, '');
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return { array: unwrapped, is2D: false, isGraph: false, graphNodes: 0, graphEdges: [] };
    }
    if (/^[a-zA-Z0-9_]+$/.test(unwrapped)) {
        return { array: unwrapped, is2D: false, isGraph: false, graphNodes: 0, graphEdges: [] };
    }

    if (/^\d+\s*;/.test(trimmed)) {
        const parts = trimmed.split(';').map((s) => s.trim()).filter(Boolean);
        graphNodes = parseInt(parts[0], 10);
        isGraph = true;
        for (let i = 1; i < parts.length; i++) {
            const pair = parts[i].split(',').map((x) => parseInt(x.trim(), 10));
            if (pair.length === 2 && !pair.some(Number.isNaN)) graphEdges.push(pair);
        }
        array = graphEdges;
        return { array, is2D, isGraph, graphNodes, graphEdges };
    }

    try {
        let cleanStr = trimmed.replace(/'/g, '"').replace(/\bnull\b/ig, 'null');
        try {
            array = JSON.parse(cleanStr);
        } catch (e1) {
            cleanStr = '[' + cleanStr + ']';
            array = JSON.parse(cleanStr);
        }

        if (array.length > 0 && Array.isArray(array[0])) {
            is2D = true;
        }
    } catch (e) {
        array = trimmed.split(',').map((s) => {
            const v = s.trim().toLowerCase();
            return (v === 'null' || v === 'nil') ? null : parseInt(v, 10);
        }).filter((x) => x !== undefined && (!Number.isNaN(x) || x === null));
    }

    return { array, is2D, isGraph, graphNodes, graphEdges };
}

// Event Listeners for Generation
if (instrumentBtn) {
    const focusModeBtn = document.getElementById('focus-mode-btn');
    if (focusModeBtn) {
        focusModeBtn.addEventListener('click', () => {
            const workspace = document.querySelector('.workspace');
            workspace.classList.toggle('focus-mode');
            if (workspace.classList.contains('focus-mode')) {
                focusModeBtn.innerHTML = '⬅️ Exit Focus Mode';
                focusModeBtn.style.color = '#38bdf8';
            } else {
                focusModeBtn.innerHTML = '🔍 Focus Mode';
                focusModeBtn.style.color = '';
            }
        });
    }

    codeInput.addEventListener('input', () => {
        window.instrumentedCode = null;
    });

    instrumentBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        if (!code) {
            alert('Please paste some raw C++ code first to auto-instrument.');
            return;
        }

        instrumentBtn.disabled = true;
        generateBtn.disabled = true;
        if (runAllBtn) runAllBtn.disabled = true;

        instrumentStatus.classList.remove('hidden', 'success', 'error');
        instrumentStatus.classList.add('loading');
        instrumentStatus.innerHTML = '✨ AI Auto-Instrumenting & Verifying in C++ Sandbox... (Might take up to 20s if compiling retries are needed)';

        try {
            const res = await fetch('http://localhost:3005/instrument', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code,
                    title: window.currentProblemTitle || "Custom Problem",
                    content: window.currentProblemContent || ""
                })
            });

            const data = await res.json();
            if (!res.ok || data.success === false) {
                if (data && data.success === false) {
                    codeInput.value = data.code; // Original code preserved
                    instrumentStatus.classList.remove('loading');
                    instrumentStatus.classList.add('error');
                    instrumentStatus.innerHTML = `
                        <div class="diagnostics-panel" style="margin-top:10px; display:block;">
                            <div class="diagnostics-header">⚠️ AI Auto-Instrumentation failed to compile</div>
                            <div class="diagnostics-explanation">
                                Kept your original C++ code so you can still run it or adjust it manually.
                                <br><br>
                                <strong>Compiler Error details:</strong><br>
                                <pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; overflow-x:auto; font-size:0.85em; margin-top:5px; color:#f87171; white-space: pre-wrap;">${data.details}</pre>
                            </div>
                        </div>
                    `;
                    return;
                }
                throw new Error(data.details || data.error || 'Failed to auto-instrument');
            }

            window.instrumentedCode = data.code;

            instrumentStatus.classList.remove('loading');
            instrumentStatus.classList.add('success');
            instrumentStatus.innerHTML = '🎉 Success! Code auto-instrumented (Hidden for your convenience) & sandboxed compiled!';

            // Clear status after 5s
            setTimeout(() => {
                instrumentStatus.classList.add('hidden');
            }, 5000);

        } catch (error) {
            console.error('Auto-instrumentation failed:', error);
            instrumentStatus.classList.remove('loading');
            instrumentStatus.classList.add('error');
            instrumentStatus.innerHTML = `❌ Auto-Instrumentation Failed:\n\n${error.message}`;
        } finally {
            instrumentBtn.disabled = false;
            generateBtn.disabled = false;
            if (runAllBtn) runAllBtn.disabled = false;
        }
    });
}

if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
        if (!codeInput.value) return;
        navigator.clipboard.writeText(codeInput.value).then(() => {
            const originalText = copyCodeBtn.innerText;
            copyCodeBtn.innerText = '✅';
            setTimeout(() => {
                copyCodeBtn.innerText = originalText;
            }, 1500);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    });
}

if (resetCodeBtn) {
    resetCodeBtn.addEventListener('click', () => {
        if (algoSelect && algoSelect.value && templates[algoSelect.value]) {
            if (confirm('Reset to original template code? All changes will be lost.')) {
                codeInput.value = templates[algoSelect.value].cleanCode || templates[algoSelect.value].code;
                window.instrumentedCode = templates[algoSelect.value].code;
                if (typeof buildCodeViewer === 'function') buildCodeViewer();
            }
        } else if (window.originalCppSnippet) {
            if (confirm('Are you sure you want to reset the code to the original snippet? All changes will be lost.')) {
                codeInput.value = window.originalCppSnippet;
                window.instrumentedCode = null; // Clear auto-instrumented cache so it uses the clean code on next run
                if (typeof buildCodeViewer === 'function') buildCodeViewer();
            }
        } else {
            alert('No original snippet found to reset to. Please fetch a problem first.');
        }
    });
}

generateBtn.addEventListener('click', async () => {
    const code = window.instrumentedCode || codeInput.value.trim();
    const arrayStr = arrayInput.value.trim();

    if (!code || !arrayStr) {
        alert('Please provide both the code and the test array.');
        return;
    }

    generateBtn.disabled = true;
    if (runAllBtn) runAllBtn.disabled = true;
    loadingSpinner.classList.remove('hidden');
    messageBox.innerText = 'Requesting trace from local AI...';
    savePreferences();

    let autoRetries = parseInt(generateBtn.dataset.retries || '0');

    // Allow manual session ID override for debugging
    const manualSessionId = sessionIdInput && sessionIdInput.value.trim();
    if (manualSessionId) {
        window.currentSessionId = manualSessionId;
    } else if (autoRetries === 0 || !window.currentSessionId) {
        window.currentSessionId = `Run_${Date.now()}`;
        // Automatically populate the input so the user knows what session is running
        if (sessionIdInput) sessionIdInput.value = window.currentSessionId;
    }

    try {
        const data = await fetchTrace(code, arrayStr, skipAiCheckbox.checked, window.currentSessionId, autoRetries);
        testCaseResults = [{ input: arrayStr, trace: data, error: null }];
        activeTestCaseIndex = 0;

        // Hide compiler diagnostics if active
        const diagPanel = document.getElementById('diagnostics-panel');
        if (diagPanel) diagPanel.classList.add('hidden');

        loadTraceData(data);
        renderTestCaseTabs();

        // Fetch premium AI additions asynchronously
        runAIComplexityAnalysis();
        fetchEdgeCaseSuggestions();

        generateBtn.dataset.retries = '0';

    } catch (error) {
        let autoRetries = parseInt(generateBtn.dataset.retries || '0');
        console.error('Failed to generate trace:', error);
        messageBox.innerText = 'Error: Failed to generate trace.';

        // AI diagnostics call
        const diagPanel = document.getElementById('diagnostics-panel');
        const diagExpl = document.getElementById('diagnostics-explanation');
        if (diagPanel && diagExpl) {
            diagPanel.classList.remove('hidden');
            diagExpl.innerHTML = `<p style="color: #f87171; font-family: monospace; white-space: pre-wrap;">${error.message}</p><p>🔍 Calling AI compiler diagnostic helper...</p>`;
            try {
                const diagRes = await fetch(`${API_BASE}/diagnose`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: codeInput.value,
                        compilerError: error.message,
                        title: window.currentProblemTitle || "Custom Problem",
                        content: window.currentProblemContent || ""
                    })
                });
                if (!diagRes.ok) throw new Error("Diagnostics failed");
                const diagData = await diagRes.json();

                diagExpl.innerHTML = `
                    <div style="font-size: 0.95rem; margin-bottom: 12px; color: #cbd5e1; line-height: 1.5; white-space: pre-wrap;">${diagData.errorExplanation}</div>
                `;

                const fixBtn = document.getElementById('one-click-fix-btn');
                if (fixBtn && diagData.suggestedCode) {
                    fixBtn.classList.remove('hidden');
                    fixBtn.onclick = () => {
                        codeInput.value = diagData.suggestedCode;
                        if (window.editor) window.editor.setValue(diagData.suggestedCode);
                        diagPanel.classList.add('hidden');
                        generateBtn.click();
                    };

                    if (autoRetries < 3) {
                        generateBtn.dataset.retries = (autoRetries + 1).toString();
                        console.log(`Auto-applying AI fix (Attempt ${autoRetries + 1}/3)...`);
                        messageBox.innerText = `Auto-fixing compiler error (Attempt ${autoRetries + 1}/3)...`;
                        setTimeout(() => fixBtn.click(), 500);
                        return; // Prevent clearing loading spinner
                    }
                } else if (fixBtn) {
                    fixBtn.classList.add('hidden');
                }
            } catch (diagErr) {
                diagExpl.innerHTML = `<p style="color: #f87171; font-family: monospace; white-space: pre-wrap;">${error.message}</p><p style="font-size: 0.8rem; color: var(--text-muted);">AI diagnostic helper was unable to compile a detailed fix description.</p>`;
            }
        } else {
            alert(`Compilation or Execution Error:\n\n${error.message}`);
        }
    } finally {
        generateBtn.disabled = false;
        if (runAllBtn) runAllBtn.disabled = false;
        loadingSpinner.classList.add('hidden');
        if (batchProgress) batchProgress.classList.add('hidden');
    }
});

if (runAllBtn) {
    runAllBtn.addEventListener('click', async () => {
        const code = codeInput.value.trim();
        const batchText = (testCasesInput?.value || '').trim();
        const lines = batchText
            ? batchText.split('\n').map((l) => l.trim()).filter(Boolean)
            : [arrayInput.value.trim()].filter(Boolean);

        if (!code || lines.length === 0) {
            alert('Provide C++ code and at least one test case (batch textarea or main input).');
            return;
        }

        generateBtn.disabled = true;
        runAllBtn.disabled = true;
        loadingSpinner.classList.remove('hidden');
        if (batchProgress) {
            batchProgress.classList.remove('hidden');
            batchProgress.textContent = `Running 0 / ${lines.length}…`;
        }
        savePreferences();

        testCaseResults = [];
        const noAI = skipAiCheckbox.checked;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (batchProgress) batchProgress.textContent = `Running ${i + 1} / ${lines.length}: ${line}`;
            try {
                const trace = await fetchTrace(code, line, noAI);
                testCaseResults.push({ input: line, trace, error: null });
            } catch (err) {
                testCaseResults.push({ input: line, trace: null, error: err.message });
            }
        }

        const firstOk = testCaseResults.findIndex((r) => r.trace);
        if (firstOk >= 0) {
            activeTestCaseIndex = firstOk;
            loadTraceData(testCaseResults[firstOk].trace, testCaseResults[firstOk].input);
        } else {
            messageBox.innerText = 'All cases failed. Check inputs and C++ code.';
        }
        renderTestCaseTabs();

        generateBtn.disabled = false;
        runAllBtn.disabled = false;
        loadingSpinner.classList.add('hidden');
        if (batchProgress) {
            const ok = testCaseResults.filter((r) => r.trace).length;
            batchProgress.textContent = `Done: ${ok} / ${lines.length} succeeded.`;
        }
    });
}


demoBtn.addEventListener('click', () => {
    testCaseResults = [];
    activeTestCaseIndex = 0;
    if (testCaseTabs) testCaseTabs.classList.add('hidden');
    loadTraceData(JSON.parse(JSON.stringify(DEMO_TRACE)), DEMO_TRACE.array.join(', '));
    messageBox.innerText = 'Demo trace loaded (no compile). Press Next or Auto-play.';
});

// Event Listeners for Player
nextBtn.addEventListener('click', () => {
    stopAutoplay();
    if (animationData && currentStep < animationData.steps.length) {
        currentStep++;
        render();
    }
});

prevBtn.addEventListener('click', () => {
    stopAutoplay();
    if (currentStep > 0) {
        currentStep--;
        render();
    }
});

if (stepSlider) {
    stepSlider.addEventListener('input', () => {
        stopAutoplay();
        goToStep(parseInt(stepSlider.value, 10) || 0);
    });
}

if (downloadJsonBtn) {
    downloadJsonBtn.addEventListener('click', () => {
        if (!animationData) return;
        const blob = new Blob([JSON.stringify(animationData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trace.json';
        a.click();
        URL.revokeObjectURL(url);
    });
}

skipAiCheckbox?.addEventListener('change', savePreferences);
autoplaySpeed?.addEventListener('change', () => {
    savePreferences();
    if (autoplayActive) startAutoplay();
});

autoplayBtn.addEventListener('click', () => {
    if (!animationData) return;
    if (autoplayActive) {
        stopAutoplay();
    } else {
        if (currentStep >= animationData.steps.length) {
            currentStep = 0;
            render();
        }
        startAutoplay();
    }
});

autoplaySpeed.addEventListener('change', () => {
    if (autoplayActive) {
        startAutoplay();
    }
});

document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;

    if (e.key === 'ArrowRight') {
        e.preventDefault();
        stopAutoplay();
        if (animationData && currentStep < animationData.steps.length) {
            currentStep++;
            render();
        }
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stopAutoplay();
        if (currentStep > 0) {
            currentStep--;
            render();
        }
    } else if (e.key === 'Home') {
        e.preventDefault();
        stopAutoplay();
        goToStep(0);
    } else if (e.key === 'End') {
        e.preventDefault();
        if (animationData) {
            stopAutoplay();
            goToStep(animationData.steps.length);
        }
    }
});

// Premium visualizations: buildCodeViewer
function buildCodeViewer() {
    const code = codeInput.value;
    const container = document.getElementById('code-viewer-container');
    if (!container) return;
    container.innerHTML = '';
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const wrapper = document.createElement('div');
        wrapper.className = 'code-line-wrapper';
        wrapper.id = `code-line-wrapper-${lineNum}`;

        const numEl = document.createElement('span');
        numEl.className = 'code-line-number';
        numEl.textContent = lineNum;

        const contentEl = document.createElement('span');
        contentEl.className = 'code-line-content';
        contentEl.textContent = line;

        wrapper.appendChild(numEl);
        wrapper.appendChild(contentEl);
        container.appendChild(wrapper);
    });
}

// Premium visualizations: highlightCodeLine
function highlightCodeLine(lineNum) {
    const container = document.getElementById('code-viewer-container');
    if (!container || container.classList.contains('hidden')) return;

    // Remove previous highlights
    const highlighted = container.querySelectorAll('.code-line-wrapper.highlight');
    highlighted.forEach(el => el.classList.remove('highlight'));

    if (!lineNum) return;

    const activeLine = document.getElementById(`code-line-wrapper-${lineNum}`);
    if (activeLine) {
        activeLine.classList.add('highlight');
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Premium visualizations: buildTimelineHeatmap
function buildTimelineHeatmap() {
    const heatmap = document.getElementById('timeline-heatmap');
    if (!heatmap || !animationData || !animationData.steps || animationData.steps.length === 0) {
        if (heatmap) heatmap.innerHTML = '';
        return;
    }
    heatmap.innerHTML = '';
    const steps = animationData.steps;
    const len = steps.length;
    steps.forEach((step, idx) => {
        const tick = document.createElement('div');
        const pct = len > 1 ? (idx / (len - 1)) * 100 : 0;
        tick.style.left = `calc(${pct}% - 1px)`;
        tick.className = 'timeline-tick';

        const action = step.action || '';
        if (action.includes('push_stack') || action.includes('push_queue') || action.includes('push_back_deque') || action.includes('push_heap')) {
            tick.classList.add('push');
        } else if (action.includes('pop') || action.includes('pop_stack') || action.includes('pop_queue') || action.includes('pop_back_deque') || action.includes('pop_heap')) {
            tick.classList.add('pop');
        } else if (action.includes('compare')) {
            tick.classList.add('compare');
        } else if (action.includes('resolve')) {
            tick.classList.add('resolve');
        } else if (action.includes('push_frame') || action.includes('pop_frame')) {
            tick.classList.add('frame');
        } else {
            return; // skip other actions to avoid overcrowding
        }
        heatmap.appendChild(tick);
    });
}

// Premium visualizations: renderComplexityChart
function renderComplexityChart(complexityType) {
    const svg = document.getElementById('complexity-chart');
    if (!svg) return;
    svg.innerHTML = '';

    // Draw gridlines
    for (let i = 1; i <= 4; i++) {
        const x = 40 + i * 68;
        const y = 170 - i * 30;
        // Vertical grid line
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', x);
        vLine.setAttribute('y1', 20);
        vLine.setAttribute('x2', x);
        vLine.setAttribute('y2', 170);
        vLine.setAttribute('class', 'chart-grid');
        svg.appendChild(vLine);

        // Horizontal grid line
        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', 40);
        hLine.setAttribute('y1', y);
        hLine.setAttribute('x2', 380);
        hLine.setAttribute('y2', y);
        hLine.setAttribute('class', 'chart-grid');
        svg.appendChild(hLine);
    }

    // Draw Axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', 40);
    xAxis.setAttribute('y1', 170);
    xAxis.setAttribute('x2', 380);
    xAxis.setAttribute('y2', 170);
    xAxis.setAttribute('class', 'chart-axis');
    svg.appendChild(xAxis);

    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', 40);
    yAxis.setAttribute('y1', 20);
    yAxis.setAttribute('x2', 40);
    yAxis.setAttribute('y2', 170);
    yAxis.setAttribute('class', 'chart-axis');
    svg.appendChild(yAxis);

    // Axis Labels
    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', 340);
    xLabel.setAttribute('y', 185);
    xLabel.setAttribute('class', 'chart-label');
    xLabel.textContent = 'Input (N)';
    svg.appendChild(xLabel);

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', 15);
    yLabel.setAttribute('y', 15);
    yLabel.setAttribute('class', 'chart-label');
    yLabel.textContent = 'Ops';
    svg.appendChild(yLabel);

    // Functions definitions helper
    function getPoints(type) {
        let pts = [];
        for (let n = 0; n <= 100; n += 2) {
            const x = 40 + (n / 100) * 340;
            let ops = 0;
            if (type === 'constant') {
                ops = 15;
            } else if (type === 'logarithmic') {
                ops = 15 * Math.log2(n + 1);
            } else if (type === 'linear') {
                ops = n * 0.85;
            } else if (type === 'linearithmic') {
                ops = 0.13 * n * Math.log2(n + 1);
            } else if (type === 'quadratic') {
                ops = (n * n) * 0.009;
            } else if (type === 'exponential') {
                ops = Math.pow(2, n / 15) * 1.5;
            }
            // Clamp ops to 100
            ops = Math.min(ops, 100);
            const y = 170 - (ops / 100) * 150;
            pts.push(`${x},${y}`);
        }
        return pts.join(' ');
    }

    // Draw other background standard curves (dashed)
    const types = ['constant', 'logarithmic', 'linear', 'linearithmic', 'quadratic', 'exponential'];
    types.forEach(t => {
        if (t === complexityType) return;
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.setAttribute('points', getPoints(t));
        poly.setAttribute('class', 'chart-line-bg');
        svg.appendChild(poly);
    });

    // Draw the active highlighted curve
    const activePoly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    activePoly.setAttribute('points', getPoints(complexityType));
    activePoly.setAttribute('class', 'chart-line');
    activePoly.setAttribute('stroke', 'url(#chart-glow-gradient)');
    // Define gradient and glow in SVG
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <linearGradient id="chart-glow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8" />
            <stop offset="100%" stop-color="#f472b6" />
        </linearGradient>
    `;
    svg.appendChild(defs);

    // Add glowing stroke style
    activePoly.style.stroke = 'url(#chart-glow-gradient)';
    activePoly.style.filter = 'drop-shadow(0px 0px 5px rgba(56, 189, 248, 0.75))';
    svg.appendChild(activePoly);

    // Add active label indicator
    const activeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    activeText.setAttribute('x', 50);
    activeText.setAttribute('y', 35);
    activeText.setAttribute('fill', '#f472b6');
    activeText.setAttribute('style', 'font-family: Outfit, sans-serif; font-size: 10px; font-weight: 700;');
    activeText.textContent = `⭐ Solution: O(${complexityType === 'linearithmic' ? 'N log N' : (complexityType === 'quadratic' ? 'N²' : (complexityType === 'logarithmic' ? 'log N' : (complexityType === 'constant' ? '1' : (complexityType === 'linear' ? 'N' : '2ⁿ'))))})`;
    svg.appendChild(activeText);
}

// Premium AI features: runAIComplexityAnalysis
async function runAIComplexityAnalysis() {
    const code = codeInput.value;
    const timeVal = document.getElementById('time-complexity-value');
    const spaceVal = document.getElementById('space-complexity-value');
    const bottlenecksEl = document.getElementById('complexity-bottlenecks');
    const aiJudgementEl = document.getElementById('ai-judgement');
    const section = document.getElementById('complexity-section');

    if (!timeVal || !spaceVal || !bottlenecksEl || !section) return;

    try {
        section.classList.remove('hidden');
        timeVal.textContent = 'Analyzing...';
        spaceVal.textContent = 'Analyzing...';
        bottlenecksEl.textContent = 'Analyzing solution complexity patterns...';
        if (aiJudgementEl) aiJudgementEl.innerHTML = '<em>Consulting AI Judge...</em>';

        const res = await fetch(`${API_BASE}/analyze-complexity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        if (!res.ok) throw new Error("Complexity API call failed");

        const data = await res.json();
        timeVal.textContent = data.time || 'O(?)';
        spaceVal.textContent = data.space || 'O(?)';
        bottlenecksEl.textContent = data.bottlenecks || '';
        if (aiJudgementEl) aiJudgementEl.textContent = data.improvementSuggestion || 'Code appears optimal or no suggestion provided.';

        // Render Chart
        const cType = data.complexityType || 'linear';
        renderComplexityChart(cType);
    } catch (err) {
        console.warn("Complexity analysis failed:", err);
        timeVal.textContent = 'O(?)';
        spaceVal.textContent = 'O(?)';
        bottlenecksEl.textContent = 'AI Complexity analysis was skipped or encountered an error.';
        if (aiJudgementEl) aiJudgementEl.textContent = 'Could not consult AI Judge.';
        renderComplexityChart('linear');
    }
}

// Premium AI features: fetchEdgeCaseSuggestions
async function fetchEdgeCaseSuggestions() {
    const code = codeInput.value;
    const panel = document.getElementById('edge-cases-panel');
    const container = document.getElementById('edge-cases-container');

    if (!panel || !container) return;

    try {
        panel.classList.remove('hidden');
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9rem;">AI is thinking of edge cases...</div>';

        const res = await fetch(`${API_BASE}/suggest-cases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        if (!res.ok) throw new Error("Edge cases API call failed");

        const data = await res.json();
        container.innerHTML = '';
        if (data.cases && Array.isArray(data.cases)) {
            data.cases.forEach(c => {
                const card = document.createElement('div');
                card.className = 'edge-case-card';

                const details = document.createElement('div');
                details.className = 'edge-case-details';

                const title = document.createElement('div');
                title.className = 'edge-case-title';
                title.textContent = c.title;

                const desc = document.createElement('div');
                desc.className = 'edge-case-desc';
                desc.textContent = c.description;

                details.appendChild(title);
                details.appendChild(desc);

                const btn = document.createElement('button');
                btn.className = 'edge-case-load-btn';
                btn.textContent = 'Load Case';

                card.appendChild(details);
                card.appendChild(btn);

                card.addEventListener('click', () => {
                    arrayInput.value = c.input;
                    // Trigger click on generate trace button to immediately visualize it!
                    generateBtn.click();
                });

                container.appendChild(card);
            });
        }
    } catch (err) {
        console.warn("Failed to suggest edge cases:", err);
        panel.classList.add('hidden');
    }
}

loadPreferences();
// Initial Render (Empty state)
render();

// Dynamic Problem metadata dictionary for pre-loaded templates
const templateProblemInfo = {
    nge: {
        title: "Next Greater Element I",
        difficulty: "Easy",
        description: `
            <p>Given an array of integers <code>nums</code>, find the <strong>Next Greater Element</strong> for each element. The Next Greater Element of an element <code>x</code> is the first greater element to its right. If it does not exist, return <code>-1</code>.</p>
            <p><strong>Example:</strong></p>
            <pre>Input: nums = [4, 2, 5, 1, 8]\nOutput: [5, 5, 8, 8, -1]</pre>
        `,
        editorial: `
            <h3>Monotonic Stack Approach</h3>
            <p>This problem can be solved optimally in <code>O(N)</code> time using a <strong>Monotonic Decreasing Stack</strong>.</p>
            <p><strong>Algorithm:</strong></p>
            <ul>
                <li>Iterate through the array from left to right.</li>
                <li>While the stack is not empty and the current element is greater than the element represented by the index at the top of the stack:
                    <ul>
                        <li>We have found the next greater element for the element at index <code>stack.top()</code>.</li>
                        <li>Pop the index and resolve its next greater element value.</li>
                    </ul>
                </li>
                <li>Push the current index onto the stack.</li>
            </ul>
            <p><strong>Complexity Analysis:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(N)</code> - Each element is pushed and popped from the stack at most once.</li>
                <li><strong>Space Complexity:</strong> <code>O(N)</code> - In the worst case, the stack stores all elements.</li>
            </ul>
        `
    },
    daily_temperatures: {
        title: "Daily Temperatures",
        difficulty: "Medium",
        description: `
            <p>Given an array of integers <code>temperatures</code> representing the daily temperatures, return an array <code>answer</code> such that <code>answer[i]</code> is the number of days you have to wait after the <code>i</code>-th day to get a warmer temperature. If there is no future day for which this is possible, keep <code>answer[i] == 0</code>.</p>
            <p><strong>Example:</strong></p>
            <pre>Input: temperatures = [73, 74, 75, 71, 69, 72, 76, 73]\nOutput: [1, 1, 4, 2, 1, 1, 0, 0]</pre>
        `,
        editorial: `
            <h3>Monotonic Stack Strategy</h3>
            <p>We traverse the temperatures and use a stack to keep track of indexes of days that have not yet seen a warmer temperature.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(N)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(N)</code></li>
            </ul>
        `
    },
    tree_preorder: {
        title: "Binary Tree Preorder Traversal",
        difficulty: "Easy",
        description: `
            <p>Given the <code>root</code> of a binary tree, return the preorder traversal of its nodes' values. Preorder traversal visits the root first, then the left subtree, and finally the right subtree.</p>
        `,
        editorial: `
            <h3>Depth-First Search (DFS) Traversal</h3>
            <p>Preorder traversal visits nodes in the order: <strong>Root ➔ Left ➔ Right</strong>.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(N)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(H)</code> where H is the height of the tree.</li>
            </ul>
        `
    },
    grid_dfs: {
        title: "Number of Islands (Matrix DFS)",
        difficulty: "Medium",
        description: `
            <p>Given an <code>m x n</code> 2D binary grid <code>grid</code> which represents a map of <code>'1'</code>s (land) and <code>'0'</code>s (water), return the number of islands.</p>
            <p>An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.</p>
        `,
        editorial: `
            <h3>DFS Grid Traversal</h3>
            <p>Whenever we encounter a land cell <code>'1'</code>, we increment our island count and trigger a DFS to recursively sink all connected land cells to water <code>'0'</code>.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(R * C)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(R * C)</code> in case of full grid recursion.</li>
            </ul>
        `
    },
    list_reverse: {
        title: "Reverse Linked List",
        difficulty: "Easy",
        description: `
            <p>Given the <code>head</code> of a singly linked list, reverse the list, and return the reversed list.</p>
        `,
        editorial: `
            <h3>Iterative Pointer Reversal</h3>
            <p>We keep track of three pointers: <code>prev</code>, <code>curr</code>, and <code>nextTemp</code>. In each step, we update <code>curr->next</code> to point to <code>prev</code>, then advance <code>prev</code> and <code>curr</code> forward.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(N)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(1)</code></li>
            </ul>
        `
    },
    heap_top_k: {
        title: "Top K Frequent Elements",
        difficulty: "Medium",
        description: `
            <p>Given an integer array <code>nums</code> and an integer <code>k</code>, return the <code>k</code> most frequent elements. You may return the answer in any order.</p>
        `,
        editorial: `
            <h3>Min-Heap Strategy</h3>
            <p>Count frequencies using a Hash Map, then maintain a Min-Heap of size <code>k</code>. This ensures that the overall time complexity is kept to <code>O(N log K)</code>, which is faster than full sorting.</p>
        `
    },
    hashmap_two_sum: {
        title: "Two Sum",
        difficulty: "Easy",
        description: `
            <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return indices of the two numbers such that they add up to <code>target</code>.</p>
        `,
        editorial: `
            <h3>One-Pass Hash Map</h3>
            <p>For each element, we check if its complement (<code>target - nums[i]</code>) exists in the hash map. If yes, we return the stored index and the current index. Otherwise, we insert the element into the hash map.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(N)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(N)</code></li>
            </ul>
        `
    },
    binary_search: {
        title: "Binary Search",
        difficulty: "Easy",
        description: `
            <p>Given an array of integers <code>nums</code> which is sorted in ascending order, and an integer <code>target</code>, write a function to search <code>target</code> in <code>nums</code>.</p>
        `,
        editorial: `
            <h3>Divide and Conquer</h3>
            <p>Maintain two pointers: <code>left</code> and <code>right</code>. At each step, calculate the midpoint and discard half of the search range depending on whether the target is larger or smaller than the mid-value.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(log N)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(1)</code></li>
            </ul>
        `
    },
    sliding_window_max: {
        title: "Sliding Window Maximum",
        difficulty: "Hard",
        description: `
            <p>Given an array of integers <code>nums</code>, there is a sliding window of size <code>k</code> which is moving from the very left of the array to the very right. Return the maximum element in the sliding window at each position.</p>
        `,
        editorial: `
            <h3>Monotonic Deque Approach</h3>
            <p>Maintain a Deque that stores indices of elements in the current window such that their values are in decreasing order. The maximum value for each window will always be at the front of the Deque.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(N)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(K)</code></li>
            </ul>
        `
    },
    valid_parentheses: {
        title: "Valid Parentheses",
        difficulty: "Easy",
        description: `
            <p>Given a string <code>s</code> containing just the characters <code>'('</code>, <code>')'</code>, <code>'{'</code>, <code>'}'</code>, <code>'['</code> and <code>']'</code>, determine if the input string is valid.</p>
        `,
        editorial: `
            <h3>Stack-Based Validation</h3>
            <p>Push opening parentheses onto a stack. When encountering a closing parenthesis, verify if it matches the opening parenthesis at the top of the stack. If it does, pop it; otherwise, the string is invalid.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(N)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(N)</code></li>
            </ul>
        `
    },
    graph_bfs: {
        title: "Adjacency Graph BFS (Shortest Path)",
        difficulty: "Medium",
        description: `
            <p>Given a graph defined by nodes and edges, perform a Breadth-First Search (BFS) to traverse all reachable nodes or find the shortest path from a source node to all other nodes.</p>
        `,
        editorial: `
            <h3>Level-by-Level Queue Traversal</h3>
            <p>BFS uses a Queue to explore neighbors of nodes layer-by-layer. We track visited nodes in a set to avoid processing the same node multiple times.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(V + E)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(V)</code></li>
            </ul>
        `
    },
    twopointer_container: {
        title: "Container With Most Water",
        difficulty: "Medium",
        description: `
            <p>Given <code>n</code> non-negative integers <code>height</code> representing vertical lines, find two lines that form a container that stores the maximum amount of water.</p>
        `,
        editorial: `
            <h3>Two Pointer Greedy Sweep</h3>
            <p>Place pointers at the left and right extremities. Calculate the container area, then greedily move the pointer that points to the shorter line inward, attempting to find a taller boundary.</p>
            <p><strong>Complexity:</strong></p>
            <ul>
                <li><strong>Time Complexity:</strong> <code>O(N)</code></li>
                <li><strong>Space Complexity:</strong> <code>O(1)</code></li>
            </ul>
        `
    }
};

// Update Problem Metadata in Left Pane
function updateProblemMetadata(key) {
    const info = templateProblemInfo[key];
    if (!info) return;

    const titleEl = document.getElementById('problem-title');
    const difficultyEl = document.getElementById('problem-difficulty');
    const descriptionEl = document.getElementById('problem-description');
    const editorialEl = document.getElementById('problem-editorial');

    if (titleEl) titleEl.textContent = info.title;
    if (difficultyEl) {
        difficultyEl.textContent = info.difficulty;
        difficultyEl.className = `difficulty-badge ${info.difficulty.toLowerCase()}`;
    }
    if (descriptionEl) descriptionEl.innerHTML = info.description;
    if (editorialEl) editorialEl.innerHTML = info.editorial;
}

// Tab Switcher Controller
document.querySelectorAll('.lc-tab').forEach(btn => {
    btn.addEventListener('click', () => {
        // Toggle tab button active classes
        document.querySelectorAll('.lc-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle visibility of panels
        const paneId = btn.getAttribute('data-pane');
        document.querySelectorAll('.tab-pane-content').forEach(p => p.classList.add('hidden'));
        const activePane = document.getElementById(paneId);
        if (activePane) activePane.classList.remove('hidden');
    });
});

// Update change listener on select dropdown
algoSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (templates[val]) {
        arrayInput.value = templates[val].array;
        codeInput.value = templates[val].cleanCode || templates[val].code;
        window.instrumentedCode = templates[val].code;
        updateProblemMetadata(val);

        // Clear LeetCode inputs and concepts to prevent state pollution
        if (leetcodeUrlInput) leetcodeUrlInput.value = '';
        const conceptsPanel = document.getElementById('lc-concepts-panel');
        if (conceptsPanel) {
            conceptsPanel.classList.add('hidden');
            const conceptsContainer = document.getElementById('lc-concepts-container');
            if (conceptsContainer) conceptsContainer.innerHTML = '';
        }

        // Hide premium panels
        const edgePanel = document.getElementById('edge-cases-panel');
        if (edgePanel) edgePanel.classList.add('hidden');
        const compSection = document.getElementById('complexity-section');
        if (compSection) compSection.classList.add('hidden');
        const diagPanel = document.getElementById('diagnostics-panel');
        if (diagPanel) diagPanel.classList.add('hidden');

        // Hide standard templates notice if visible
        if (typeof lcImportNotice !== 'undefined' && lcImportNotice) {
            lcImportNotice.classList.add('hidden');
        }

        // Reset trace & playback state
        animationData = null;
        currentStep = 0;
        render();
    }
});

// Reset LeetCode concepts / Restore Template selector if input is cleared
leetcodeUrlInput.addEventListener('input', () => {
    if (!leetcodeUrlInput.value.trim()) {
        const templateSelectGroup = document.getElementById('template-select-group');
        const conceptsPanel = document.getElementById('lc-concepts-panel');
        if (templateSelectGroup) {
            templateSelectGroup.classList.remove('hidden');
        }
        if (conceptsPanel) {
            conceptsPanel.classList.add('hidden');
            const conceptsContainer = document.getElementById('lc-concepts-container');
            if (conceptsContainer) conceptsContainer.innerHTML = '';
        }

        // Hide premium panels
        const edgePanel = document.getElementById('edge-cases-panel');
        if (edgePanel) edgePanel.classList.add('hidden');
        const compSection = document.getElementById('complexity-section');
        if (compSection) compSection.classList.add('hidden');
        const diagPanel = document.getElementById('diagnostics-panel');
        if (diagPanel) diagPanel.classList.add('hidden');

        // Hide standard templates notice if visible
        if (typeof lcImportNotice !== 'undefined' && lcImportNotice) {
            lcImportNotice.classList.add('hidden');
        }

        // Restore selected template metadata and synchronize editor code/inputs
        algoSelect.dispatchEvent(new Event('change'));
    }
});

// Automatically trigger update on load
setTimeout(() => {
    updateProblemMetadata(algoSelect.value);
}, 50);

