const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldStr = `<div class="buttons player-buttons">
                            <button id="prev-btn" class="control-btn" disabled>← Prev</button>
                            <span id="step-counter">Step: 0 / 0</span>
                            <button id="next-btn" class="control-btn">Next →</button>
                        </div>

                        <div class="autoplay-row">
                            <button id="autoplay-btn" class="control-btn autoplay-btn" disabled>▶ Auto-play</button>
                            <label for="autoplay-speed" class="speed-label">Speed:</label>
                            <select id="autoplay-speed" class="speed-select">
                                <option value="500">Fast (0.5s)</option>
                                <option value="1000" selected>Normal (1s)</option>
                                <option value="2000">Slow (2s)</option>
                            </select>
                            <button id="download-json-btn" class="control-btn download-json-btn" disabled>Download JSON</button>
                        </div>`;

const newStr = `<div class="player-controls-minimal">
                            <div class="minimal-left">
                                <button id="prev-btn" class="icon-btn control-btn-mini" disabled title="Previous Step">⏮</button>
                                <button id="autoplay-btn" class="icon-btn control-btn-mini autoplay-btn" disabled title="Auto-play">▶️</button>
                                <button id="next-btn" class="icon-btn control-btn-mini" title="Next Step">⏭</button>
                                <span id="step-counter" class="minimal-counter">Step: 0 / 0</span>
                            </div>
                            
                            <div class="minimal-right">
                                <label for="autoplay-speed" class="speed-label" style="display:none;">Speed:</label>
                                <select id="autoplay-speed" class="speed-select-minimal" title="Playback Speed">
                                    <option value="500">0.5s</option>
                                    <option value="1000" selected>1.0s</option>
                                    <option value="2000">2.0s</option>
                                </select>
                                <button id="download-json-btn" class="icon-btn control-btn-mini download-json-btn" disabled title="Download JSON">💾</button>
                            </div>
                        </div>`;

html = html.replace(oldStr, newStr);

// Also change "Skip AI" to "AI On/Off"
html = html.replace('Skip AI Commentary to generate trace faster', 'Toggle AI Commentary');
html = html.replace('> Skip AI\n', '> AI On/Off\n');

fs.writeFileSync('index.html', html);
console.log("Fixed right pane!");
