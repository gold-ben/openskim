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

// Main optimization function with selectable methods
// method: 'saliency' (default) or 'every-nth' (every Nth word)
function optimizePrompt(prompt, targetTokens = 50, alpha = 0.1, model = "gemini-1.5-flash", method = "saliency") {
    // 1. Split by whitespace - keep all tokens including punctuation
    const originalWords = prompt.split(/\s+/);
    
    // 2. Create metadata for each word
    const wordMetadata = originalWords.map((word, idx) => {
        const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
        const isPunctuation = /^[^\w]+$/.test(cleanWord); // Pure punctuation
        const isNumber = /^\d+$/.test(cleanWord); // Pure numbers
        return {
            original: word,
            cleaned: cleanWord,
            index: idx,
            isPunctuation: isPunctuation,
            isNumber: isNumber
        };
    });
    
    // 3. Extract cleaned text for keyword analysis (excluding pure punctuation and numbers)
    const cleanedWordsForAnalysis = wordMetadata
        .filter(w => !w.isPunctuation && !w.isNumber)
        .map(w => w.cleaned);
    
    if (cleanedWordsForAnalysis.length === 0) {
        return {
            optimized_prompt: prompt, // Return original if no words to process
            metrics: {
                input_tokens: countTokens(prompt),
                final_tokens: countTokens(prompt),
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
    
    // 4. Extract keywords using TF-IDF from non-punctuation words
    const cleanedText = cleanedWordsForAnalysis.join(' ');
    const keywords = extractKeywords(cleanedText, cleanedWordsForAnalysis.length);
    const saliencyMap = {};
    keywords.forEach(([word, score]) => {
        saliencyMap[word] = score;
    });
    
    // 5. Create candidate words (only non-punctuation, non-number words for selection)
    const candidates = [];
    wordMetadata.forEach(meta => {
        if (meta.isPunctuation || meta.isNumber) return; // Skip punctuation and numbers in selection
        
        const wordTokens = countTokens(meta.original);
        const saliency = saliencyMap[meta.cleaned] || 0;
        
        candidates.push({
            word: meta.original,
            cleanWord: meta.cleaned,
            tokens: wordTokens,
            saliency: saliency,
            valueDensity: saliency / Math.max(wordTokens, 1),
            index: meta.index
        });
    });
    
    // 6. Sort by value density
    candidates.sort((a, b) => b.valueDensity - a.valueDensity);
    
    // 7. Select words using chosen method
    const selected = [];
    let currentTokens = 0;
    const wordBonus = 0.05;
    
    if (method === "every-nth") {
        // Every Nth word method: select every Nth word to reach target tokens
        let n = Math.max(1, Math.floor(candidates.length / Math.max(1, targetTokens / 5)));
        for (let i = 0; i < candidates.length; i += n) {
            selected.push(candidates[i]);
            currentTokens += candidates[i].tokens;
        }
    } else {
        // Default saliency method: exponential penalty based on importance
        candidates.forEach(candidate => {
            const penalty = Math.exp(alpha * (currentTokens + candidate.tokens - targetTokens));
            const utility = (candidate.saliency + wordBonus) - penalty;
            
            if (utility > 0) {
                selected.push(candidate);
                currentTokens += candidate.tokens;
            }
        });
    }
    
    // 8. Reconstruct maintaining original order (include ALL punctuation and numbers)
    const selectedIndices = new Set();
    
    // Add selected word indices
    selected.forEach(s => {
        selectedIndices.add(s.index);
    });
    
    // Always add punctuation and number indices
    wordMetadata.forEach(meta => {
        if (meta.isPunctuation || meta.isNumber) {
            selectedIndices.add(meta.index);
        }
    });
    
    // Sort indices and reconstruct
    const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);
    const optimizedPrompt = sortedIndices.map(i => originalWords[i]).join(' ');
    
    // 9. Calculate savings
    const inputTokens = countTokens(prompt);
    const savedTokens = inputTokens - currentTokens;
    
    const modelInfo = MODELS[model] || MODELS["gemini-1.5-flash"];
    
    const reductionPercent = inputTokens > 0 ? Math.round((savedTokens / inputTokens * 100) * 10) / 10 : 0;
    
    return {
        optimized_prompt: optimizedPrompt,
        metrics: {
            input_tokens: inputTokens,
            final_tokens: currentTokens,
            saved_tokens: savedTokens,
            target_threshold: targetTokens,
            alpha: alpha,
            model: model,
            model_name: modelInfo.name,
            reduction_percent: reductionPercent,
            is_estimate: true,
        }
    };
}

// Helper function to calculate every-Nth interval
function calculateEveryNthInterval(totalWords, targetTokens) {
    // Try to keep roughly targetTokens worth of words by calculating interval
    if (totalWords <= targetTokens) return 1;
    const reductionRatio = totalWords / targetTokens;
    return Math.max(1, Math.floor(reductionRatio * 0.8)); // 0.8 factor for slight over-selection
}

// Export for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { optimizePrompt, countTokens, extractKeywords, MODELS, calculateEveryNthInterval };
}
