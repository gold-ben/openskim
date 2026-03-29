# OpenSkim - Browser-Based Prompt Optimizer

A web application that reduces your prompts locally to save tokens and cut API costs. Everything runs in your browser—no data is ever sent to any server.

## Features

- **Local Processing**: All optimization happens in your browser using pure JavaScript/WebAssembly
- **No Dependencies**: Runs entirely client-side, perfect for GitHub Pages
- **Cost Calculator**: Shows estimated savings based on current LLM pricing
- **TF-IDF Keyword Extraction**: Intelligent word importance scoring
- **Customizable Parameters**: 
  - Target token threshold
  - Intensity (alpha) for optimization aggressiveness
  - Multiple LLM models for cost calculation

## How It Works

`optimizer.js` provides a JavaScript implementation of the saliency-based prompt optimization algorithm:

1. **Text Cleaning**: Removes stopwords and punctuation while preserving important words
2. **Keyword Extraction**: Uses TF-IDF scoring to determine word importance
3. **Optimization**: Applies an exponential penalty function to balance word importance with target token length
4. **Cost Calculation**: Estimates savings in cents based on selected LLM's pricing

## Local Development

```bash
# Start local development server
npm run dev
# or
python -m http.server 8000
```

Visit `http://localhost:8000` in your browser.

## Deployment to GitHub Pages

The app is ready to deploy to GitHub Pages with no build step:

1. Push files to your GitHub repository
2. Enable GitHub Pages in repository settings (source: main branch, folder: root)
3. Access your app at `https://<username>.github.io/<repo-name>/`

### Files Structure

- `index.html` - Web UI with form and results display
- `optimizer.js` - Core optimization algorithm (pure JavaScript/WebAssembly compatible)
- `package.json` - Project metadata
- `wrangler.toml` - Optional Cloudflare Workers configuration

## Algorithm Details

The optimizer uses a **value density** approach:

```
utility = (saliency + word_bonus) - exp(α * (current_tokens - target_tokens))
```

- **saliency**: TF-IDF score indicating word importance
- **word_bonus**: Small constant (0.05) encouraging word preservation
- **α (alpha)**: Parameter controlling optimization aggressiveness
  - Low values (e.g., 0.01): Conservative, preserves more words
  - High values (e.g., 1.0): Aggressive, reduces to target size more strictly

## Model Support

Supports pricing calculations for:
- Google Gemini (1.5 Flash, 1.5 Pro, 2.0)
- OpenAI GPT (4o mini, 4o, 4, 5.3, 5.4)
- Anthropic Claude (3.5 Haiku, 3.5 Sonnet, 3.5 Opus, Opus 4.6)
- Mistral Large
- Open Source (Llama 2)

## Token Counting

Uses a heuristic approximation (~1 token per 4 characters) for TikToken-compatible counting. For exact counts, integrate `tiktoken.js` or sync with your API's tokenizer.

## Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge) that support:
- ES6 JavaScript
- Local event handling
- Clipboard API

## Privacy

✅ No data collection
✅ No server requests
✅ All processing local to your machine
✅ GitHub Pages friendly (static hosting only)
