// visualize.js — animation/player only, reads from localStorage

// Global state
let animationData = null;
let currentStep = 0;
let autoplayTimer = null;
let autoplayActive = false;

const LS_AUTOPLAY_SPEED = 'dsa-viz-autoplay-speed';

// DOM references
const messageBox = document.getElementById('message-box');
const stepCounter = document.getElementById('step-counter');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const autoplayBtn = document.getElementById('autoplay-btn');
const autoplaySpeed = document.getElementById('autoplay-speed');
const stepSlider = document.getElementById('step-slider');
const downloadJsonBtn = document.getElementById('download-json-btn');
const stepListPanel = document.getElementById('step-list-panel');
const stepListEl = document.getElementById('step-list');
const arrayContainer = document.getElementById('array-container');
const stackContainer = document.getElementById('stack-container');

// ── Utilities ────────────────────────────────────────────────────────────────

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

function goToStep(step) {
    if (!animationData) return;
    const max = animationData.steps.length;
    currentStep = Math.max(0, Math.min(step, max));
    render();
}

// ── Code Viewer ───────────────────────────────────────────────────────────────

function buildCodeViewer() {
    const code = window.instrumentedCodeStr || '';
    const container = document.getElementById('code-viewer-container');
    if (!container) return;
    container.innerHTML = '';
    if (!code) {
        container.innerHTML = '<div style="color: var(--text-muted); padding: 12px;">No code available.</div>';
        return;
    }
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

function highlightCodeLine(lineNum) {
    const container = document.getElementById('code-viewer-container');
    if (!container) return;

    const highlighted = container.querySelectorAll('.code-line-wrapper.highlight');
    highlighted.forEach(el => el.classList.remove('highlight'));

    if (!lineNum) return;

    const activeLine = document.getElementById(`code-line-wrapper-${lineNum}`);
    if (activeLine) {
        activeLine.classList.add('highlight');
        activeLine.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// ── Timeline Heatmap ─────────────────────────────────────────────────────────

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
            return;
        }
        heatmap.appendChild(tick);
    });
}

// ── Step List ────────────────────────────────────────────────────────────────

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

// ── Load Trace ────────────────────────────────────────────────────────────────

function loadTraceData(data) {
    stopAutoplay();
    animationData = data;
    currentStep = 0;
    buildCodeViewer();
    buildTimelineHeatmap();
    render();

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

// ── Main Render ───────────────────────────────────────────────────────────────

function render() {
    if (!animationData) {
        if (arrayContainer) arrayContainer.innerHTML = '';
        if (stackContainer) stackContainer.innerHTML = '';
        const containers = ['tree-container', 'grid-container', 'list-container', 'heap-container', 'map-container', 'graph-container', 'recursive-stack-container'];
        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        if (messageBox) messageBox.innerText = 'No trace loaded — go back and run your code.';
        if (stepCounter) stepCounter.innerText = 'Step: 0 / 0';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (autoplayBtn) autoplayBtn.disabled = true;
        if (downloadJsonBtn) downloadJsonBtn.disabled = true;
        syncStepSlider(0);
        updateStepList();
        return;
    }

    const maxSteps = animationData.steps.length;

    // Determine problem type
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
        if (graphSection) graphSection.classList.remove('hidden');
        if (listSection) listSection.classList.add('hidden');
        if (gridSection) gridSection.classList.add('hidden');
        if (arraySection) arraySection.classList.add('hidden');
        if (stackSection) stackSection.classList.add('hidden');
        if (treeSection) treeSection.classList.add('hidden');
        if (isHeapProblem && heapSection) heapSection.classList.remove('hidden');
        if (isMapProblem && mapSection) mapSection.classList.remove('hidden');
    } else if (isListProblem) {
        if (listSection) listSection.classList.remove('hidden');
        if (gridSection) gridSection.classList.add('hidden');
        if (arraySection) arraySection.classList.add('hidden');
        if (stackSection) stackSection.classList.add('hidden');
        if (treeSection) treeSection.classList.add('hidden');
    } else if (isGridProblem) {
        if (listSection) listSection.classList.add('hidden');
        if (gridSection) gridSection.classList.remove('hidden');
        if (arraySection) arraySection.classList.add('hidden');
        if (stackSection) stackSection.classList.add('hidden');
        if (treeSection) treeSection.classList.add('hidden');
    } else {
        if (listSection) listSection.classList.add('hidden');
        if (gridSection) gridSection.classList.add('hidden');
        if (isTreeProblem) {
            if (treeSection) treeSection.classList.remove('hidden');
        } else {
            if (treeSection) treeSection.classList.add('hidden');
        }

        if (isHeapProblem && heapSection) heapSection.classList.remove('hidden');
        if (isMapProblem && mapSection) mapSection.classList.remove('hidden');

        if (isStackProblem) {
            if (stackSection) stackSection.classList.remove('hidden');
            const isQueue = steps.some(s => s.action.includes('queue') && !s.action.includes('heap'));
            const isDeque = steps.some(s => s.action.includes('deque'));
            const stackHeader = document.getElementById('stack-header');
            if (stackHeader) stackHeader.textContent = isQueue ? 'Queue' : (isDeque ? 'Deque' : 'Stack');
        } else {
            if (isTreeProblem || isHeapProblem) {
                if (stackSection) stackSection.classList.add('hidden');
            } else {
                if (stackSection) stackSection.classList.remove('hidden');
                const stackHeader = document.getElementById('stack-header');
                if (stackHeader) stackHeader.textContent = 'Stack';
            }
        }
    }

    // Simulate state up to currentStep
    let stack = [];
    const dataArray = animationData.array || [];
    let resolvedNGEs = new Array(Math.max(dataArray.length, 1)).fill("?");

    let focusedIndex = -1;
    let comparingStackIndex = -1;
    let comparingArrayIndex = -1;

    let visitedTreeNodes = new Set();
    let focusedTreeNodePtr = null;

    let gridRows = 0;
    let gridCols = 0;
    let gridCells = {};
    let visitedGridCells = new Set();
    let focusedGridCell = null;

    let listNodesMap = {};
    let initialOrder = [];
    let focusedListNodePtr = null;
    let pointerLabels = {};

    let heap = [];
    let mapState = {};
    let erasedMapKeys = new Set();
    let focusedMapKey = null;
    let graphNodeCount = 0;
    let graphEdges = [];
    let visitedGraphNodes = new Set();
    let focusedGraphNode = null;
    let focusedGraphEdge = null;
    let arrayPointerLabels = {};
    let focusedHeapIndex = -1;
    let activeFrames = [];

    for (let i = 0; i < currentStep; i++) {
        const stepData = steps[i];
        if (!stepData) continue;

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

    // Draw Array
    if (arrayContainer) {
        arrayContainer.innerHTML = '';
        const arrSource = animationData.array || [];
        const filteredArray = arrSource.filter(x => x !== null);
        if (filteredArray.length > 0 && !isGridProblem && !isGraphProblem) {
            if (arraySection) arraySection.classList.remove('hidden');
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
            if (arraySection) arraySection.classList.add('hidden');
        }
    }

    // Draw Stack / Queue
    if (stackContainer) {
        stackContainer.innerHTML = '';
        if (stack.length > 0 || steps.some(s => s.action === 'push_stack' || s.action === 'pop_stack' || s.action === 'push_queue' || s.action === 'pop_queue')) {
            if (stackSection) stackSection.classList.remove('hidden');
            const arrSource = animationData.array || [];
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
    }

    // Draw Binary Tree
    if (isTreeProblem) {
        const treeContainer = document.getElementById('tree-container');
        if (treeContainer) {
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

                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.position = 'absolute';
                svg.style.left = '0';
                svg.style.top = '0';
                svg.style.pointerEvents = 'none';
                svg.style.zIndex = '1';
                treeContainer.appendChild(svg);

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
    }

    // Draw 2D Grid
    if (isGridProblem) {
        const gridContainer = document.getElementById('grid-container');
        if (gridContainer) {
            gridContainer.innerHTML = '';
            gridContainer.style.gridTemplateColumns = `repeat(${gridCols}, 45px)`;

            for (let r = 0; r < gridRows; r++) {
                for (let c = 0; c < gridCols; c++) {
                    const cell = document.createElement('div');
                    cell.className = 'grid-cell';
                    const cellValue = gridCells[`${r},${c}`] !== undefined ? gridCells[`${r},${c}`] : 0;
                    cell.innerText = cellValue;

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
    }

    // Draw Linked List
    if (isListProblem) {
        const listContainer = document.getElementById('list-container');
        if (listContainer) {
            listContainer.innerHTML = '';

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

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'list-svg-canvas');
            svg.style.width = `${listContainer.scrollWidth}px`;
            svg.style.height = `${listContainer.scrollHeight}px`;
            listContainer.appendChild(svg);

            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

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

            const containerRect = listContainer.getBoundingClientRect();
            initialOrder.forEach((ptr) => {
                const nodeData = listNodesMap[ptr];
                if (!nodeData || nodeData.next === 'null' || !listNodesMap[nodeData.next]) return;

                const fromEl = nodeElementsMap[ptr];
                const toEl = nodeElementsMap[nodeData.next];
                if (!fromEl || !toEl) return;

                const fromRect = fromEl.getBoundingClientRect();
                const toRect = toEl.getBoundingClientRect();

                const x1 = (fromRect.left + fromRect.width) - containerRect.left + listContainer.scrollLeft;
                const y1 = (fromRect.top + fromRect.height / 2) - containerRect.top + listContainer.scrollTop;
                const x2 = toRect.left - containerRect.left + listContainer.scrollLeft;
                const y2 = (toRect.top + toRect.height / 2) - containerRect.top + listContainer.scrollTop;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('class', 'list-arrow');

                let d;
                if (x2 <= x1) {
                    const curveOffset = 60;
                    d = `M ${x1} ${y1} C ${x1 + 30} ${y1 - curveOffset}, ${x2 - 30} ${y2 - curveOffset}, ${x2} ${y2}`;
                } else {
                    d = `M ${x1} ${y1} L ${x2} ${y2}`;
                }
                path.setAttribute('d', d);

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
    }

    // Draw priority heap
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

    // Draw hash map
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

    // Draw graph
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

    // Update message and controls
    if (currentStep === 0) {
        if (messageBox) messageBox.innerText = 'Trace ready — use the controls below to step through.';
    } else {
        const currentStepData = steps[currentStep - 1];
        if (messageBox) messageBox.innerText = currentStepData.message || `Executing step ${currentStep}...`;
    }

    if (stepCounter) stepCounter.innerText = `Step: ${currentStep} / ${maxSteps}`;
    syncStepSlider(maxSteps);
    updateStepList();

    if (prevBtn) prevBtn.disabled = currentStep === 0;
    if (nextBtn) nextBtn.disabled = currentStep === maxSteps;
    if (autoplayBtn) {
        autoplayBtn.disabled = false;
        if (currentStep === maxSteps && autoplayActive) {
            stopAutoplay();
        }
    }
    if (downloadJsonBtn) downloadJsonBtn.disabled = false;

    // Highlight code line
    const activeStep = steps[currentStep - 1];
    if (activeStep && activeStep.userLine) {
        highlightCodeLine(activeStep.userLine);
    } else {
        highlightCodeLine(null);
    }

    // 3D Call Stack Rendering
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
}

// ── Event Listeners ───────────────────────────────────────────────────────────

if (nextBtn) {
    nextBtn.addEventListener('click', () => {
        stopAutoplay();
        if (animationData && currentStep < animationData.steps.length) {
            currentStep++;
            render();
        }
    });
}

if (prevBtn) {
    prevBtn.addEventListener('click', () => {
        stopAutoplay();
        if (currentStep > 0) {
            currentStep--;
            render();
        }
    });
}

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

if (autoplayBtn) {
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
}

if (autoplaySpeed) {
    autoplaySpeed.addEventListener('change', () => {
        try { localStorage.setItem(LS_AUTOPLAY_SPEED, autoplaySpeed.value); } catch(_) {}
        if (autoplayActive) startAutoplay();
    });
}

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

// ── Init: read from localStorage ──────────────────────────────────────────────

(function init() {
    // Restore autoplay speed preference
    try {
        const speed = localStorage.getItem(LS_AUTOPLAY_SPEED);
        if (speed && autoplaySpeed) autoplaySpeed.value = speed;
    } catch (_) {}

    let traceRaw = null;
    let codeStr = '';
    try {
        traceRaw = localStorage.getItem('dsa_trace_data');
        codeStr = localStorage.getItem('dsa_instrumented_code') || '';
    } catch (_) {}

    if (!traceRaw) {
        if (messageBox) messageBox.innerText = 'No trace loaded — go back and run your code.';
        render();
        return;
    }

    try {
        const data = JSON.parse(traceRaw);
        window.instrumentedCodeStr = codeStr;
        loadTraceData(data);
    } catch (e) {
        if (messageBox) messageBox.innerText = 'Failed to parse trace data. Go back and run again.';
        render();
    }
})();
