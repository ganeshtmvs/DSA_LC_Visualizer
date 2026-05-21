const fs = require('fs');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OLLAMA_URL = 'http://localhost:11434/api/generate';

const rawTrace = JSON.parse(fs.readFileSync('latest_trace.json', 'utf8'));

// Strip "message" field from rawTrace if it exists, to simulate the C++ output
if (rawTrace.steps) {
    rawTrace.steps.forEach(s => delete s.message);
}

const SYSTEM_PROMPT = `You are an expert algorithm explainer. You are given a mathematically perfect JSON trace of a generic Stack & Array or Tree algorithm.`;

const oldPrompt = `
Here is the perfect JSON trace from the C++ compiler:
${JSON.stringify(rawTrace, null, 2)}

Please return this exact same JSON, but add a beginner-friendly "message" string to each object explaining what happened in that step.
Return ONLY the valid JSON object with the "steps" array.
`;

const newPrompt = `
Here is the perfect JSON trace from the C++ compiler:
${JSON.stringify(rawTrace, null, 2)}

Please write a beginner-friendly "message" explaining what happened in each step.
Return ONLY a JSON array of strings, where each string corresponds to the message for that step in order. Do not return the original JSON, ONLY the array of strings. For example: ["Started visualization", "Pushed 1 to stack", ...]
`;

async function testGroq(name, model, prompt) {
    const start = Date.now();
    try {
        const res = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" }
            })
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Error with ${name}:`, err);
            return;
        }

        const data = await res.json();
        const time = Date.now() - start;
        console.log(`[${name}] Time: ${time}ms, Output length: ${data.choices[0].message.content.length} chars`);
        
    } catch (e) {
        console.error(`Failed ${name}:`, e.message);
    }
}

async function testOllama(name, prompt) {
    const start = Date.now();
    try {
        const res = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3',
                prompt: prompt,
                system: SYSTEM_PROMPT,
                stream: false,
                format: 'json'
            })
        });

        if (!res.ok) {
            console.error(`Error with ${name}`);
            return;
        }

        const data = await res.json();
        const time = Date.now() - start;
        console.log(`[${name}] Time: ${time}ms, Output length: ${data.response.length} chars`);
    } catch (e) {
        console.error(`Failed ${name} (Ollama might be offline):`, e.message);
    }
}

async function runTests() {
    console.log("Testing Old Prompt (Full JSON Rewrite)...");
    await testGroq('Old Prompt - 70b', 'llama-3.3-70b-versatile', oldPrompt);
    await testGroq('Old Prompt - 8b', 'llama-3.1-8b-instant', oldPrompt);
    await testOllama('Old Prompt - Local Llama3', oldPrompt);

    console.log("\\nTesting New Prompt (Only Messages Array)...");
    // For json_object response format, we should ask for a JSON object containing the array, e.g., {"messages": [...]}
    const newPromptFixed = newPrompt.replace("ONLY a JSON array of strings", "a JSON object with a single key 'messages' containing an array of strings");
    
    await testGroq('New Prompt - 70b', 'llama-3.3-70b-versatile', newPromptFixed);
    await testGroq('New Prompt - 8b', 'llama-3.1-8b-instant', newPromptFixed);
    await testOllama('New Prompt - Local Llama3', newPromptFixed);
}

runTests();
