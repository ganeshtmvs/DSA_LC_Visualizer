# Refactoring C++ Code Generation & Auto-Instrumentation

The current architecture for generating and retrying C++ code has a few fundamental flaws that lead to the LLM hallucinating placeholder strings (like we saw in the `12345/` logs) and failing to fix compiler errors.

## The Root Causes of the Issues

1. **JSON Placeholder Echoing in `/solve-concept`**: The system prompt for the `/solve-concept` endpoint asks the LLM to return a JSON object with both `code` (clean code) and `instrumentedCode`. To guide the LLM, the prompt includes a placeholder: `"instrumentedCode": "The fully implemented and instrumented complete class Solution..."`. Often, the LLM simply echoes this exact string back instead of writing actual code! 
2. **Context Loss in `/generate` Retries**: When the C++ runner fails to compile, `/generate` enters an auto-instrumentation retry loop. However, the retry prompt only provides the compiler error and the broken C++ code. It **completely lacks the original problem description and concept**. The LLM cannot fix the code if it doesn't know what problem it's trying to solve, leading to random hallucinations (like inventing `findKthElement` or missing headers).
3. **Blurred Responsibilities**: `/solve-concept` tries to do everything (generate clean code + instrument it), while `/generate` also tries to instrument code via its retry loop. This double-duty is fragile.

## Proposed Changes

We should refactor the backend C++ code generation pipeline to be more robust and context-aware.

### 1. Simplify `/solve-concept`
We will simplify the JSON schema requested in `/solve-concept`. It should only be responsible for generating the **clean, un-instrumented C++ code** along with metadata (complexities, edge cases). 
- We will completely remove the request for `instrumentedCode` from the JSON schema. This prevents the LLM from echoing the placeholder text.

### 2. Move Instrumentation entirely to `/generate`
The `/generate` endpoint will become the sole owner of code instrumentation. 
- The frontend will pass the clean `code`, the problem `title`, and `problem content` to `/generate`.
- `/generate` will perform a **First Pass Instrumentation**: It will take the clean code and the problem context and ask the LLM to inject visualizer macros.

### 3. Context-Aware Retry Loop
If the first pass fails to compile or crashes, the retry loop will now include the full context.
- The retry prompt will include:
  - The original problem description.
  - The original clean C++ code.
  - The failed instrumented code.
  - The compiler/runtime error logs.
- This ensures the LLM always knows *what* the code is supposed to do while fixing it.

## User Review Required

> [!WARNING]
> This requires changing both `server.js` (backend) and `app.js` (frontend) so they pass the problem title and description into the `/generate` endpoint. Are you okay with me modifying `app.js` to pass this additional context to the backend?

## Open Questions

- Do you want to keep the auto-instrumentation retry loop at a maximum of 3 attempts, or should we adjust this limit?
- Currently, if the retry loop exhausts all attempts, it fails. Should it fallback to just returning the clean code without animations, or is throwing an error the preferred behavior?

## Verification Plan

### Automated/Manual Testing
- Run `test_median.js` again to ensure it successfully generates and instruments the code.
- Test directly in the UI with a few problems to verify that the generated code is correct, the animations work, and no placeholder strings are returned.
