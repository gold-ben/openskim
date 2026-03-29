import math
from pydantic import BaseModel
import tiktoken
from keybert import KeyBERT
import spacy
import json
import sys
import os

# 1. Silence TensorFlow/HuggingFace logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

import warnings
warnings.filterwarnings("ignore")

# 2. Redirect ALL library startup 'print' statements to stderr
# so they don't corrupt the final output
class SuppressStdout:
    def __enter__(self):
        self._original_stdout = sys.stdout
        sys.stdout = sys.stderr

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout = self._original_stdout

with SuppressStdout():
    nlp = spacy.load("en_core_web_sm", disable=["ner", "parser", "lemmatizer"])
    kw_model = KeyBERT()
    tokenizer = tiktoken.get_encoding("cl100k_base")

# Model pricing configuration (per 1k tokens)
# These are estimates - actual costs may vary based on rate changes
MODELS = {
    "gemini-1.5-flash": {
        "name": "Google Gemini 1.5 Flash",
        "input_cost_per_1k": 0.000125,
    },
    "gpt-4o-mini": {
        "name": "OpenAI GPT-4o Mini",
        "input_cost_per_1k": 0.00015,
    },
    "gpt-4": {
        "name": "OpenAI GPT-4",
        "input_cost_per_1k": 0.03,
    },
    "claude-3.5-haiku": {
        "name": "Anthropic Claude 3.5 Haiku",
        "input_cost_per_1k": 0.00080,
    },
    "claude-3.5-sonnet": {
        "name": "Anthropic Claude 3.5 Sonnet",
        "input_cost_per_1k": 0.003,
    },
    "llama-2-7b": {
        "name": "Open Source - Llama 2 7B",
        "input_cost_per_1k": 0.0,
    },
}

class PromptRequest(BaseModel):
    prompt: str
    target_tokens: int = 50
    alpha: float = 0.1
    model: str = "gemini-1.5-flash" 

def optimize_unconstrained(req: PromptRequest):
    doc = nlp(req.prompt)

    # 1. Extraction & Scoring
    tokens = [t for t in doc if (not t.is_stop or t.dep_ == "neg") and not t.is_punct and t.pos_ != "INTJ"]
    text_cleaned = " ".join([t.text for t in tokens])

    if not tokens:
        return {"optimized_prompt": "", "metrics": {"input_tokens": 0, "final_tokens": 0}}

    keywords = kw_model.extract_keywords(text_cleaned, top_n=len(tokens))
    saliency_map = {kw[0].lower(): kw[1] for kw in keywords}

    # 2. Unconstrained Objective Optimization
    selected = []
    current_tokens = 0
    word_bonus = 0.05 # Encourages maximizing word count

    # Sort by Value Density
    candidates = sorted(tokens, key=lambda t: saliency_map.get(t.text.lower(), 0) / max(len(tokenizer.encode(t.text)), 1), reverse=True)

    for t in candidates:
        w_len = len(tokenizer.encode(t.text))
        saliency = saliency_map.get(t.text.lower(), 0)

        # Exponential Penalty (Normalizing to the same scale as Saliency)
        # Saliency is 0-1, so we want penalty to start small and cross 1.0 at target
        penalty = math.exp(req.alpha * (current_tokens + w_len - req.target_tokens))

        # Normalized Objective
        utility = (saliency + word_bonus) - penalty

        if utility > 0:
            selected.append(t)
            current_tokens += w_len

    selected.sort(key=lambda t: t.i)
    optimized_prompt = " ".join([t.text for t in selected])

    # 3. Savings Calculation
    input_tokens = len(tokenizer.encode(req.prompt))
    saved_tokens = input_tokens - current_tokens

    # Get model pricing
    model_info = MODELS.get(req.model, MODELS["gemini-1.5-flash"])
    cost_per_1k = model_info["input_cost_per_1k"]

    original_cost = (input_tokens / 1000) * cost_per_1k * 100  # in cents
    optimized_cost = (current_tokens / 1000) * cost_per_1k * 100  # in cents
    cents_saved = original_cost - optimized_cost

    reduction_percent = round((saved_tokens / input_tokens * 100), 1) if input_tokens > 0 else 0

    return {
        "optimized_prompt": optimized_prompt,
        "metrics": {
            "input_tokens": input_tokens,
            "final_tokens": current_tokens,
            "target_threshold": req.target_tokens,
            "alpha": req.alpha,
            "model": req.model,
            "model_name": model_info["name"],
            "cents_saved": round(cents_saved, 4),
            "reduction_percent": reduction_percent,
            "is_estimate": True,
        }
    }

if __name__ == "__main__":
    try:
        raw_input = sys.argv[1]
        input_data = json.loads(raw_input)

        # FIX: Ensure we extract the string from the dict if needed
        if isinstance(input_data, dict):
            prompt_text = input_data.get("prompt", "")
            target_tokens = input_data.get("target_tokens", 50)
            alpha = input_data.get("alpha", 0.1)
            model = input_data.get("model", "gemini-1.5-flash")
        else:
            prompt_text = input_data
            target_tokens = 50
            alpha = 0.1
            model = "gemini-1.5-flash"

        req = PromptRequest(prompt=prompt_text, target_tokens=target_tokens, alpha=alpha, model=model)
        result = optimize_unconstrained(req)

        # Use sys.stdout.write to avoid extra newlines
        sys.stdout.write(json.dumps(result))

    except Exception as e:
        sys.stderr.write(f"Runtime Error: {str(e)}")
        sys.exit(1)
        