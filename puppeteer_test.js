const puppeteer = require('puppeteer');

async function run() {
    console.log("Launching browser...");
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log("Navigating to http://localhost:3005 ...");
    await page.goto('http://localhost:3005');
    
    console.log("Entering LeetCode URL...");
    await page.type('#leetcode-url', 'https://leetcode.com/problems/median-of-two-sorted-arrays/');
    await page.click('#import-lc-btn');
    
    console.log("Waiting for problem to load (max 30s)...");
    await page.waitForSelector('#concept-cards-container .concept-card', { timeout: 30000 });
    console.log("Problem loaded! Clicking the first concept...");
    
    // Click the first concept card
    const conceptCards = await page.$$('#concept-cards-container .concept-card');
    if (conceptCards.length > 0) {
        await conceptCards[0].click();
    } else {
        throw new Error("No concept cards found!");
    }
    
    console.log("Waiting for AI C++ code to generate (max 60s)...");
    // The code editor gets populated when solveData returns. We can check if code-input has value.
    await page.waitForFunction(() => {
        const code = document.getElementById('code-input').value;
        return code.length > 10;
    }, { timeout: 60000 });
    console.log("Code generated!");
    
    console.log("Clicking Generate Trace (Animation)...");
    await page.click('#generate-btn');
    
    console.log("Waiting for animation to load...");
    // Wait for the timeline container to appear, meaning trace was parsed
    await page.waitForSelector('#timeline-container', { timeout: 60000 });
    console.log("Animation trace loaded successfully!");
    
    // Verify there are steps
    const stepsLength = await page.evaluate(() => {
        return window.steps ? window.steps.length : 0;
    });
    console.log("Number of animation steps:", stepsLength);
    
    console.log("Checking if Test Case Output is visible...");
    const testCaseOutput = await page.evaluate(() => {
        const pre = document.getElementById('execution-result-pre');
        return pre ? pre.textContent : null;
    });
    console.log("Test Case Output:", testCaseOutput);
    
    await browser.close();
    console.log("Success! UI test passed.");
}

run().catch(err => {
    console.error("UI Test Failed:", err);
    process.exit(1);
});
