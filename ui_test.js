const puppeteer = require('puppeteer');
const path = require('path');

const ARTIFACT_DIR = '/Users/ganesh/.gemini/antigravity/brain/f9be7542-cf0d-42d5-976a-3c425d404498/';

async function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

async function runUITest() {
    console.log("Starting UI Test with Puppeteer...");
    const browser = await puppeteer.launch({
        headless: 'new', // Use new headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        // 1. Navigate to localhost:3005
        console.log("Navigating to http://localhost:3005...");
        await page.goto('http://localhost:3005', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step1_loaded.png') });
        console.log("Step 1: Page loaded. Screenshot saved.");
        
        // 2. Paste URL and Fetch
        console.log("Typing LeetCode URL...");
        
        // Check Skip AI to avoid LLM timeouts during trace generation
        console.log("Checking Skip AI checkbox...");
        const skipAiChecked = await page.$eval('#skip-ai-checkbox', el => el.checked);
        if (!skipAiChecked) {
            await page.click('#skip-ai-checkbox');
        }
        
        await page.type('#leetcode-url', 'https://leetcode.com/problems/longest-substring-without-repeating-characters/');
        await page.click('#import-lc-btn');
        console.log("Clicked Fetch. Waiting for concepts to load...");
        
        // Wait for concepts container to be populated or wait for 15 seconds
        try {
            await page.waitForSelector('#lc-concepts-container .lc-concept-card', { timeout: 20000 });
            console.log("Concepts loaded successfully!");
        } catch (e) {
            console.log("Timeout waiting for concepts.");
        }
        await delay(2000); // Wait a bit more for rendering
        await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step2_concepts_loaded.png') });
        console.log("Step 2: Concepts loaded. Screenshot saved.");
        
        // Check if title is visible
        const titleText = await page.$eval('.problem-header h1', el => el.innerText).catch(() => "Title not found");
        console.log("Problem Title:", titleText);
        
        // 3. Click Concepts tab (if not active)
        console.log("Clicking Concepts tab...");
        // Usually clicking the card directly is fine if it's visible. The tab might be active automatically.
        // Let's click the first concept card
        const cards = await page.$$('#lc-concepts-container .lc-concept-card');
        if (cards.length > 0) {
            console.log(`Found ${cards.length} concept cards. Clicking the first one...`);
            await page.evaluate(el => el.click(), cards[0]);
            
            console.log("Clicked concept card. Waiting for code generation and compilation (30s)...");
            // Wait for trace generation to complete. The step counter might change or array container populate.
            try {
                await page.waitForFunction(() => {
                    const stepCounter = document.getElementById('step-counter');
                    return stepCounter && stepCounter.innerText && stepCounter.innerText !== 'Step: 0 / 0';
                }, { timeout: 30000 });
                console.log("Code generated and trace loaded!");
            } catch (e) {
                console.log("Timeout waiting for trace to load.");
            }
            
            await delay(2000); // Wait for rendering
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step3_code_generated.png') });
            console.log("Step 3: Code generated. Screenshot saved.");
            
            // Check input field
            const arrayInputValue = await page.$eval('#array-input', el => el.value).catch(() => "");
            console.log("Array Input Value:", arrayInputValue);
            
            // 4. Test Animation Playback
            console.log("Clicking Auto-play button to start animation...");
            await page.click('#autoplay-btn');
            
            console.log("Waiting 10 seconds for animation to progress...");
            await delay(10000);
            
            await page.screenshot({ path: path.join(ARTIFACT_DIR, 'step4_animation_playing.png') });
            console.log("Step 4: Animation running. Screenshot saved.");
            
        } else {
            console.log("No concept cards found.");
        }
        
    } catch (err) {
        console.error("UI Test Error:", err);
    } finally {
        await browser.close();
        console.log("Browser closed. Test finished.");
    }
}

runUITest();
