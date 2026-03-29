// Prompt Optimizer - JavaScript/WebAssembly version for browser

// Common English stopwords
const STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
    'by', 'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each',
    'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here',
    'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
    'its', 'itself', 'just', 'me', 'might', 'more', 'most', 'myself', 'my', 'no', 'nor', 'not',
    'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over',
    'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
    'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'to',
    'too', 'under', 'until', 'up', 'we', 'were', 'what', 'when', 'where', 'which', 'while',
    'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

// Approximate token counter (based on OpenAI's tiktoken heuristic)
function countTokens(text) {
    // Rough approximation: 1 token ≈ 4 characters on average
    // This is a heuristic; actual tiktoken may differ
    const words = text.trim().split(/\s+/);
    let tokenCount = 0;
    
    words.forEach(word => {
        // Heuristic: average word is ~0.75 tokens, with minimum of 1
        tokenCount += Math.max(1, Math.ceil(word.length / 4));
    });
    
    return tokenCount;
}

// TF-IDF based keyword extraction
function extractKeywords(text, topN = 10) {
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = [...new Set(words)];
    
    // Calculate term frequency
    const tf = {};
    uniqueWords.forEach(word => {
        tf[word] = (tf[word] || 0) + 1;
    });
    
    // Calculate IDF (inverse document frequency) - simplified version
    const totalWords = uniqueWords.length;
    const idf = {};
    uniqueWords.forEach(word => {
        // Simple heuristic: less common words get higher IDF
        const frequency = tf[word] / uniqueWords.length;
        idf[word] = Math.log(1 / (frequency + 0.0001));
    });
    
    // Calculate TF-IDF score
    const scores = uniqueWords.map(word => ({
        word: word,
        score: tf[word] * idf[word]
    }));
    
    // Sort by score and return top N
    return scores
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map(item => [item.word, item.score]);
}

// Model pricing configuration (per 1k tokens)
const MODELS = {
    "gemini-1.5-flash": {
        name: "Google Gemini 1.5 Flash",
        input_cost_per_1k: 0.000125,
    },
    "gemini-1.5-pro": {
        name: "Google Gemini 1.5 Pro",
        input_cost_per_1k: 0.00125,
    },
    "gemini-2.0": {
        name: "Google Gemini 2.0",
        input_cost_per_1k: 0.002,
    },
    "gpt-4o-mini": {
        name: "OpenAI GPT-4o Mini",
        input_cost_per_1k: 0.00015,
    },
    "gpt-4o": {
        name: "OpenAI GPT-4o",
        input_cost_per_1k: 0.005,
    },
    "gpt-5.3": {
        name: "OpenAI GPT-5.3",
        input_cost_per_1k: 0.05,
    },
    "gpt-5.4": {
        name: "OpenAI GPT-5.4",
        input_cost_per_1k: 0.06,
    },
    "gpt-4": {
        name: "OpenAI GPT-4",
        input_cost_per_1k: 0.03,
    },
    "claude-3.5-haiku": {
        name: "Anthropic Claude 3.5 Haiku",
        input_cost_per_1k: 0.00080,
    },
    "claude-3.5-sonnet": {
        name: "Anthropic Claude 3.5 Sonnet",
        input_cost_per_1k: 0.003,
    },
    "claude-3.5-opus": {
        name: "Anthropic Claude 3.5 Opus",
        input_cost_per_1k: 0.015,
    },
    "claude-opus-4.6": {
        name: "Anthropic Claude Opus 4.6",
        input_cost_per_1k: 0.02,
    },
    "mistral-large": {
        name: "Mistral Large",
        input_cost_per_1k: 0.008,
    },
    "llama-2-7b": {
        name: "Open Source - Llama 2 7B",
        input_cost_per_1k: 0.0,
    },
};

// Main optimization function
function optimizePrompt(prompt, targetTokens = 50, alpha = 0.1, model = "gemini-1.5-flash") {
    // 1. Clean text - remove stopwords and punctuation
    const cleanedWords = prompt
        .toLowerCase()
        .split(/\s+/)
        .filter(word => {
            // Remove if stopword or pure punctuation
            const isStopword = STOPWORDS.has(word.replace(/[^\w]/g, ''));
            const isPunctuation = /^[^\w]+$/.test(word);
            return !isStopword && !isPunctuation;
        });
    
    const cleanedText = cleanedWords.join(' ');
    
    if (cleanedWords.length === 0) {
        return {
            optimized_prompt: "",
            metrics: {
                input_tokens: 0,
                final_tokens: 0,
                target_threshold: targetTokens,
                alpha: alpha,
                model: model,
                model_name: MODELS[model]?.name || "Unknown",
                cents_saved: 0,
                reduction_percent: 0,
                is_estimate: true,
            }
        };
    }
    
    // 2. Extract keywords using TF-IDF
    const keywords = extractKeywords(cleanedText, cleanedWords.length);
    const saliencyMap = {};
    keywords.forEach(([word, score]) => {
        saliencyMap[word] = score;
    });
    
    // 3. Unconstrained objective optimization
    const selected = [];
    let currentTokens = 0;
    const wordBonus = 0.05;
    
    // Get original words (case-preserved)
    const originalWords = prompt.split(/\s+/);
    
    // Create candidates with metadata
    const candidates = [];
    originalWords.forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
        const wordTokens = countTokens(word);
        const saliency = saliencyMap[cleanWord] || 0;
        
        candidates.push({
            word: word,
            cleanWord: cleanWord,
            tokens: wordTokens,
            saliency: saliency,
            valueDensity: saliency / Math.max(wordTokens, 1)
        });
    });
    
    // Sort by value density
    candidates.sort((a, b) => b.valueDensity - a.valueDensity);
    
    // Select words using exponential penalty
    candidates.forEach(candidate => {
        const penalty = Math.exp(alpha * (currentTokens + candidate.tokens - targetTokens));
        const utility = (candidate.saliency + wordBonus) - penalty;
        
        if (utility > 0) {
            selected.push(candidate);
            currentTokens += candidate.tokens;
        }
    });
    
    // Sort selected words back to original order
    const selectedSet = new Set(selected.map((_, i) => originalWords.indexOf(selected[i].word)));
    const optimizedWords = originalWords.filter((_, i) => {
        for (let s of selected) {
            if (s.word === originalWords[i]) {
                selected.shift();
                return true;
            }
        }
        return false;
    });
    
    // Reconstruct maintaining original order
    const selectedIndices = [];
    selected.forEach(s => {
        for (let i = 0; i < originalWords.length; i++) {
            if (originalWords[i] === s.word && !selectedIndices.includes(i)) {
                selectedIndices.push(i);
                break;
            }
        }
    });
    selectedIndices.sort((a, b) => a - b);
    const optimizedPrompt = selectedIndices.map(i => originalWords[i]).join(' ');
    
    // 4. Calculate savings
    const inputTokens = countTokens(prompt);
    const savedTokens = inputTokens - currentTokens;
    
    const modelInfo = MODELS[model] || MODELS["gemini-1.5-flash"];
    const costPer1k = modelInfo.input_cost_per_1k;
    
    const originalCost = (inputTokens / 1000) * costPer1k * 100; // in cents
    const optimizedCost = (currentTokens / 1000) * costPer1k * 100; // in cents
    const centsSaved = originalCost - optimizedCost;
    
    const reductionPercent = inputTokens > 0 ? Math.round((savedTokens / inputTokens * 100) * 10) / 10 : 0;
    
    return {
        optimized_prompt: optimizedPrompt,
        metrics: {
            input_tokens: inputTokens,
            final_tokens: currentTokens,
            target_threshold: targetTokens,
            alpha: alpha,
            model: model,
            model_name: modelInfo.name,
            cents_saved: Math.round(centsSaved * 10000) / 10000,
            reduction_percent: reductionPercent,
            is_estimate: true,
        }
    };
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { optimizePrompt, countTokens, extractKeywords, MODELS };
}
