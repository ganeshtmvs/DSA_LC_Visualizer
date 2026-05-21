const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const leftPaneStart = html.indexOf('<div class="pane-scroll-container">');
const rightPaneStart = html.indexOf('<!-- RIGHT PANEL: Split between Editor (top) and Visualizer (bottom) -->');

let before = html.substring(0, leftPaneStart);
let after = html.substring(rightPaneStart);

let newLeftPane = `<div class="pane-scroll-container">
                <!-- Tab Pane: Description -->
                <div id="pane-description" class="tab-pane-content">
                    <div id="problem-header" class="problem-header">
                        <h1 id="problem-title">DSA Visualizer</h1>
                        <div class="problem-tags">
                            <span id="problem-difficulty" class="difficulty-badge" style="display: none;"></span>
                            <span class="problem-tag">Concepts</span>
                            <span class="problem-tag">Dry Run</span>
                        </div>
                    </div>
                    
                    <div id="problem-description" class="problem-description-content">
                        <!-- Populated Dynamically -->
                    </div>

                    <div class="pane-divider"></div>

                    <!-- Control Forms Section (Moved to Description) -->
                    <section class="left-forms-section">
                        <h3 class="subsection-title">🛠️ Input Configuration</h3>
                        
                        <div class="input-group">
                            <label for="leetcode-url">Import from LeetCode URL</label>
                            <div class="import-flex">
                                <input type="text" id="leetcode-url" placeholder="https://leetcode.com/problems/...">
                                <button id="import-lc-btn" class="control-btn accent-btn">Fetch</button>
                            </div>
                            <div id="lc-import-notice" class="lc-import-notice hidden" role="status"></div>
                        </div>

                        <div id="template-select-group" class="input-group">
                            <label for="algo-select">Choose pre-loaded Template</label>
                            <select id="algo-select">
                                <option value="" disabled selected>-- Select a Template --</option>
                                <option value="nge">Next Greater Element (Monotonic Stack)</option>
                                <option value="daily_temperatures">Daily Temperatures (Monotonic Stack)</option>
                                <option value="tree_preorder">Binary Tree Preorder Traversal (Tree DFS)</option>
                                <option value="grid_dfs">2D Grid Island Traversal (Matrix DFS)</option>
                                <option value="list_reverse">Reverse Linked List (Linked List)</option>
                                <option value="heap_top_k">Top K Elements (Priority Heap)</option>
                                <option value="hashmap_two_sum">Two Sum (Hash Map)</option>
                                <option value="binary_search">Binary Search (Two Pointers)</option>
                                <option value="sliding_window_max">Sliding Window Maximum (Deque)</option>
                                <option value="valid_parentheses">Valid Parentheses (Stack)</option>
                                <option value="graph_bfs">Graph BFS (Adjacency)</option>
                                <option value="twopointer_container">Container With Most Water (Two Pointers)</option>
                            </select>
                        </div>

                        <div class="input-group">
                            <label for="array-input">Test Case Input (array, grid, or edges)</label>
                            <input type="text" id="array-input" value="" placeholder="e.g. 4,2,5 or [[0,1],[1,2]]">
                        </div>

                        <!-- Collapsible advanced batch testcases -->
                        <details class="advanced-inputs-details">
                            <summary>📁 Advanced Batch Test Cases</summary>
                            <div class="input-group" style="margin-top: 10px;">
                                <label for="test-cases-input">Batch test cases (one per line):</label>
                                <textarea id="test-cases-input" rows="3" placeholder="4, 2, 5&#10;1, 2, 3"></textarea>
                            </div>
                        </details>

                        <div class="action-row" style="margin-top: 15px;">
                            <button id="run-all-btn" class="control-btn" style="flex: 1;">Run all cases</button>
                            <button id="demo-btn" class="control-btn" style="flex: 1;">Load demo trace</button>
                        </div>

                        <!-- Loaders & Indicators -->
                        <div id="instrument-status" class="status-indicator hidden"></div>
                        <div id="loading-spinner" class="spinner hidden">⚡ Compiling Sandbox & Generating AI Commentary...</div>
                        <div id="diagnostics-output"></div>
                        
                        <div id="batch-progress-container" class="hidden" style="margin-top:10px;">
                            <div class="batch-status-text">Running Test Cases...</div>
                            <div class="progress-bar-bg">
                                <div id="batch-progress-bar" class="progress-bar-fill"></div>
                            </div>
                        </div>

                        <div id="test-case-tabs" class="test-case-tabs hidden" role="tablist"></div>

                        <!-- AI Diagnostics Panel -->
                        <div id="diagnostics-panel" class="diagnostics-panel hidden">
                            <div class="diagnostics-header">⚠️ Sandbox Compilation Failed</div>
                            <div id="diagnostics-explanation" class="diagnostics-explanation"></div>
                            <button id="one-click-fix-btn" class="one-click-fix-btn">✨ Apply AI Corrected Fix</button>
                        </div>

                        <!-- AI Suggested Edge Cases -->
                        <div id="edge-cases-panel" class="edge-cases-panel hidden">
                            <h4>💡 AI Suggested Edge Cases</h4>
                            <div id="edge-cases-container" class="edge-cases-container"></div>
                        </div>
                    </section>
                </div>

                <!-- Tab Pane: Editorial -->
                <div id="pane-editorial" class="tab-pane-content hidden">
                    <div class="editorial-header">
                        <h2>💡 Solution Strategy & Intuition</h2>
                    </div>
                    <div id="problem-editorial" class="problem-editorial-content">
                        <!-- Populated Dynamically -->
                    </div>
                </div>

                <!-- Tab Pane: Solutions / Concepts -->
                <div id="pane-solutions" class="tab-pane-content hidden">
                    <div id="lc-concepts-panel" class="lc-concepts-panel">
                        <label class="section-label">Select a Solution Concept to Visualize:</label>
                        <div id="lc-concepts-container" class="lc-concepts-container">
                            <div class="no-concepts-placeholder">No alternative concepts loaded yet. Import a LeetCode problem above to see AI concept cards!</div>
                        </div>
                    </div>
                </div>

                <!-- Tab Pane: AI Analysis -->
                <div id="pane-analysis" class="tab-pane-content hidden">
                    <!-- ANALYTICS PANEL (Extra depth details below animations) -->
                    <section id="post-analysis-area" class="post-analysis-area">
                        <!-- Recursive Call Stack Visualizer -->
                        <div id="recursive-stack-section" class="section recursive-stack-section hidden glass-panel">
                            <h3>Recursive Call Stack (3D view)</h3>
                            <div id="recursive-stack-container" class="recursive-stack-container"></div>
                        </div>

                        <!-- AI Big-O & Growth Curve Analyzer -->
                        <div id="complexity-section" class="section complexity-section hidden glass-panel">
                            <h3>AI Complexity Analysis</h3>
                            <div class="complexity-grid">
                                <div class="complexity-stat glass-panel">
                                    <span class="label">Time Complexity</span>
                                    <span id="time-complexity-value" class="value">O(?)</span>
                                </div>
                                <div class="complexity-stat glass-panel">
                                    <span class="label">Space Complexity</span>
                                    <span id="space-complexity-value" class="value">O(?)</span>
                                </div>
                            </div>
                            <div class="complexity-details glass-panel">
                                <h4>Bottlenecks & Dynamic Allocations</h4>
                                <div id="complexity-bottlenecks"></div>
                                <h4 style="margin-top: 15px; color: var(--neon-blue);">💡 AI Judge & Optimization Steering</h4>
                                <div id="ai-judgement"></div>
                            </div>
                            <div class="complexity-chart-wrapper glass-panel">
                                <h4>Interactive Growth Curve</h4>
                                <svg id="complexity-chart" viewBox="0 0 400 200" width="100%" height="200"></svg>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </aside>

        `;

fs.writeFileSync('index.html', before + newLeftPane + after);
console.log("Fixed left pane!");
