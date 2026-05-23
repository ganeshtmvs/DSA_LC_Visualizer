

async function runTest() {
    console.log("1. Fetching problem data from /leetcode...");
    const lcRes = await fetch("http://localhost:3005/leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://leetcode.com/problems/median-of-two-sorted-arrays/" })
    });
    const lcData = await lcRes.json();
    if (!lcRes.ok) {
        console.error("Failed /leetcode", lcData);
        return;
    }
    console.log("Fetched problem:", lcData.title);
    const concept = lcData.concepts[0]; // pick first concept
    console.log("Selected concept:", concept.name);

    console.log("\n2. Getting C++ code from /leetcode/solve-concept...");
    const solveRes = await fetch("http://localhost:3005/leetcode/solve-concept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            title: lcData.title,
            difficulty: lcData.difficulty,
            content: lcData.content,
            cppSnippet: lcData.cppSnippet,
            conceptId: concept.id,
            conceptName: concept.name,
            conceptSummary: concept.summary,
            array: "1, 3, 5, 7, 9\n2, 4, 6, 8, 10" // Example two arrays
        })
    });
    const solveData = await solveRes.json();
    if (!solveRes.ok) {
        console.error("Failed /solve-concept", solveData);
        return;
    }
    console.log("Generated C++ Code!");
    
    console.log("\n3. Generating visualizer trace from /generate...");
    const genRes = await fetch("http://localhost:3005/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            code: solveData.code,
            array: `[[1, 3, 5, 7, 9], [2, 4, 6, 8, 10]]`,
            is2D: false, // Median of Two Sorted Arrays is not 2D matrix
            isGraph: false,
            noAI: false,
            skipAI: false, // Use AI instrumentation
            sessionId: "test-median",
            attempt: 0,
            title: lcData.title,
            content: lcData.content
        })
    });
    const genData = await genRes.json();
    if (!genRes.ok) {
        console.error("Failed /generate", genData);
        return;
    }
    
    console.log("Trace generated successfully!");
    console.log("Step count:", genData.trace.length);
    if (genData.result) {
        console.log("Execution Result:", genData.result);
    } else {
        console.log("No execution result captured.");
    }
}

runTest().catch(console.error);
