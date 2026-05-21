// using built-in fetch

async function run() {
    console.log("1. Fetching problem from LeetCode...");
    const leetcodeRes = await fetch('http://localhost:3005/leetcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: "https://leetcode.com/problems/median-of-two-sorted-arrays/" })
    });
    
    if (!leetcodeRes.ok) {
        console.error("Failed to fetch problem", await leetcodeRes.text());
        return;
    }
    const problemData = await leetcodeRes.json();
    console.log("Problem fetched:", problemData.title);
    console.log("Concepts found:", problemData.concepts.map(c => c.name));
    
    if (problemData.concepts.length === 0) {
        console.error("No concepts returned.");
        return;
    }
    
    const concept = problemData.concepts[0];
    console.log("\\n2. Generating solution for concept:", concept.name);
    
    const solveRes = await fetch('http://localhost:3005/leetcode/solve-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: problemData.title,
            difficulty: problemData.difficulty,
            content: problemData.content,
            cppSnippet: problemData.cppSnippet,
            conceptId: concept.id,
            conceptName: concept.name,
            conceptSummary: concept.summary,
            array: problemData.array
        })
    });
    
    if (!solveRes.ok) {
        console.error("Failed to solve concept", await solveRes.text());
        return;
    }
    
    const solveData = await solveRes.json();
    console.log("Code generation response received.");
    console.log("solveData:", solveData);
    if (!solveData.instrumentedCode) {
        console.error("No instrumentedCode in response!");
        return;
    }
    console.log("Instrumented code length:", solveData.instrumentedCode.length);
    console.log("Array input:", solveData.array);
    
    console.log("\\n3. Running the generated code to trace execution...");
    const generateRes = await fetch('http://localhost:3005/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: solveData.instrumentedCode,
            array: solveData.array,
            noAI: false
        })
    });
    
    if (!generateRes.ok) {
        console.error("Failed to generate trace", await generateRes.text());
        return;
    }
    
    // We expect a stream of text or JSON
    const text = await generateRes.text();
    console.log("Trace generation response received. Length:", text.length);
    if (text.includes("Error:") || text.includes("error")) {
        console.error("Found errors in trace output:");
        // Extract error lines
        const lines = text.split('\\n').filter(l => l.toLowerCase().includes('error'));
        lines.forEach(l => console.error("   ", l));
    } else {
        console.log("Success! Trace output seems to have generated without explicitly saying 'error'.");
        try {
            const data = JSON.parse(text);
            if (data.steps) {
                console.log(`Generated ${data.steps.length} trace steps.`);
                if (data.steps.length > 0 && data.steps[0].message) {
                    console.log(`First message: ${data.steps[0].message}`);
                }
            } else if (data.error) {
                console.error("Parsed error JSON:", data.error);
            }
        } catch (e) {
            console.log("Output is not purely JSON. First 500 chars:", text.substring(0, 500));
        }
    }
}

run().catch(console.error);
