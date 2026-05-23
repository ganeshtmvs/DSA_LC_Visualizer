'use strict';

// LLM Router — supports Groq, OpenAI, Anthropic, and Ollama (fallback).
//
// Priority order when no explicit provider is requested:
//   1. Provider named by LLM_PROVIDER env var
//   2. First available keyed provider (Groq → OpenAI → Anthropic)
//   3. Ollama (local, only when no API keys are configured)
//
// Per-request override: pass { provider, model } in the opts argument.

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';

const PROVIDER_DEFAULTS = {
    ollama:    { url: OLLAMA_URL,                                        model: process.env.OLLAMA_MODEL || 'llama3' },
    groq:      { url: 'https://api.groq.com/openai/v1/chat/completions', model: process.env.GROQ_MODEL  || 'llama-3.1-8b-instant' },
    openai:    { url: 'https://api.openai.com/v1/chat/completions',      model: process.env.OPENAI_MODEL    || 'gpt-4o-mini' },
    anthropic: { url: ANTHROPIC_URL,                                     model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001' },
};

// Metadata exposed to the frontend via /llm/providers
const PROVIDER_CATALOG = [
    {
        id: 'openai',
        label: 'OpenAI',
        requiresKey: true,
        envKey: 'OPENAI_API_KEY',
        models: [
            { id: 'gpt-4o-mini',  label: 'GPT-4o Mini' },
            { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
            { id: 'gpt-5.1-mini', label: 'GPT-5.1 Mini' },
        ],
    },
    {
        id: 'anthropic',
        label: 'Anthropic',
        requiresKey: true,
        envKey: 'ANTHROPIC_API_KEY',
        models: [
            { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku (fast)' },
            { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6' },
            { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7' },
        ],
    },
    {
        id: 'groq',
        label: 'Groq',
        requiresKey: true,
        envKey: 'GROQ_API_KEY',
        models: [
            { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B (fast)' },
            { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
            { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B' },
            { id: 'gemma2-9b-it',            label: 'Gemma 2 9B' },
        ],
    },
    {
        id: 'ollama',
        label: 'Ollama (Local)',
        requiresKey: false,
        models: [
            { id: 'llama3',    label: 'Llama 3 8B' },
            { id: 'llama3:70b', label: 'Llama 3 70B' },
            { id: 'mistral',   label: 'Mistral 7B' },
            { id: 'codellama', label: 'Code Llama' },
            { id: 'phi3',      label: 'Phi-3 Mini' },
        ],
    },
];

// Returns the catalog annotated with which providers are currently configured.
// envKey is intentionally omitted — only a boolean availability flag is sent to the frontend.
function getProviderStatus() {
    return PROVIDER_CATALOG.map(({ id, label, models, requiresKey, envKey }) => ({
        id,
        label,
        models,
        available: !requiresKey || !!process.env[envKey],
    }));
}

// --- provider implementations ---

async function queryOllama(model, prompt, systemPrompt, formatJson) {
    const body = { model, prompt, system: systemPrompt, stream: false };
    if (formatJson) body.format = 'json';

    const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    return data.response;
}

async function queryOpenAICompat(url, apiKey, model, prompt, systemPrompt, formatJson) {
    const body = {
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: prompt },
        ],
    };
    if (formatJson) body.response_format = { type: 'json_object' };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
}

async function queryAnthropic(apiKey, model, prompt, systemPrompt, formatJson) {
    const userContent = formatJson ? `${prompt}\n\nRespond with valid JSON only.` : prompt;

    const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userContent }],
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Anthropic HTTP ${res.status}: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data.content[0].text;
}

// --- router ---

// opts: { provider?: string, model?: string }
async function runLLM(prompt, systemPrompt, formatJson = false, opts = {}) {
    const errors = [];

    const requestedProvider = opts.provider || '';
    const requestedModel    = opts.model    || '';

    // If an explicit provider is requested, try it first, then fall back.
    const queue = buildQueue(requestedProvider);

    for (const providerId of queue) {
        const defaultModel = PROVIDER_DEFAULTS[providerId].model;
        const model = (requestedProvider === providerId && requestedModel)
            ? requestedModel
            : defaultModel;

        try {
            const text = await callProvider(providerId, model, prompt, systemPrompt, formatJson);
            console.log(`[LLM] ${providerId} / ${model}`);
            return text;
        } catch (e) {
            errors.push(`${providerId}: ${e.message}`);
            console.warn(`[LLM] ${providerId} failed — ${e.message}`);
        }
    }

    throw new Error(`All LLM providers failed:\n${errors.join('\n')}`);
}

function buildQueue(requestedProvider) {
    const envDefault = (process.env.LLM_PROVIDER || '').toLowerCase();

    // Keyed providers in priority order
    const available = ['groq', 'openai', 'anthropic'].filter(id => {
        const catalog = PROVIDER_CATALOG.find(p => p.id === id);
        return !!process.env[catalog.envKey];
    });
    // Ollama is last-resort fallback only when no API keys are configured
    if (available.length === 0) available.push('ollama');

    // Move explicit request to front
    const primary = requestedProvider || envDefault;
    if (primary && available.includes(primary)) {
        return [primary, ...available.filter(id => id !== primary)];
    }
    return available;
}

async function callProvider(providerId, model, prompt, systemPrompt, formatJson) {
    switch (providerId) {
        case 'ollama':
            return queryOllama(model, prompt, systemPrompt, formatJson);
        case 'groq':
            return queryOpenAICompat(
                PROVIDER_DEFAULTS.groq.url,
                process.env.GROQ_API_KEY,
                model, prompt, systemPrompt, formatJson
            );
        case 'openai':
            return queryOpenAICompat(
                PROVIDER_DEFAULTS.openai.url,
                process.env.OPENAI_API_KEY,
                model, prompt, systemPrompt, formatJson
            );
        case 'anthropic':
            return queryAnthropic(
                process.env.ANTHROPIC_API_KEY,
                model, prompt, systemPrompt, formatJson
            );
        default:
            throw new Error(`Unknown provider: ${providerId}`);
    }
}

module.exports = { runLLM, getProviderStatus };
