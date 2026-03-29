# GitHub Pages Deployment Guide

## Quick Start

OpenSkim is ready to deploy to GitHub Pages with **zero build steps**. It's a pure static site with no build process needed.

### Step 1: Push to GitHub

If you haven't already, push your repository to GitHub:

```bash
git add .
git commit -m "Ready for GitHub Pages deployment"
git push origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** 
3. Under "Build and deployment":
   - **Source**: Select "Deploy from a branch"
   - **Branch**: Select `main` (or your default branch)
   - **Folder**: Select `/ (root)`
4. Click **Save**

GitHub will automatically detect that this is a static site and deploy it.

### Step 3: Access Your Site

Your app will be available at:
```
https://<your-github-username>.github.io/<repository-name>/
```

The deployment typically completes in 1-2 minutes. You'll see a checkmark in the Pages section when it's ready.

## How It Works

All files needed for deployment are already in the repository:

- `index.html` - Main app interface
- `optimizer.js` - Optimization algorithm (pure JavaScript/WASM compatible)
- `package.json` - Metadata (not needed for Pages, but good to keep)
- `README.md` - Documentation

**No build step required** because:
- The app runs entirely in the browser
- No Node.js dependencies are needed at runtime
- All assets are static files

## What NOT to Deploy

These files are **not** needed on GitHub Pages:

- `optimizer.py` - Python version (reference only, can't run in browser)
- `node_modules/` - Dependencies (ignored via .gitignore)
- `.wrangler/` - Cloudflare Workers cache (ignored via .gitignore)
- `.git/` - Version control (not deployed by GitHub)

## Environment-Specific Notes

### Local Development

Run locally before deploying:

```bash
# Using Python
python -m http.server 8000

# Or using Node.js (if you have a local server)
npx http-server
```

Then visit `http://localhost:8000`

### GitHub Pages

- ✅ No special configuration needed
- ✅ HTTPS automatically enabled
- ✅ Custom domains supported (if desired)
- ✅ Free hosting

## Troubleshooting

### Site not updating after push?

GitHub Pages may cache content. Try:
1. Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
2. Wait 2-3 minutes for deployment to complete
3. Check the "Actions" tab on GitHub to see deployment status

### Scripts not loading?

If you get console errors about missing scripts:
1. Open browser DevTools (F12)
2. Check the Console and Network tabs
3. Verify file paths match your repository structure

### 404 errors?

Ensure files are in the root of the repository-level (not in a subfolder), or update references in `index.html` accordingly.

## Custom Domain (Optional)

To use a custom domain:

1. In GitHub repo settings → Pages
2. Enter your domain in "Custom domain"
3. Update your domain's DNS records to point to GitHub Pages

See [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site) for details.

## Performance Notes

- Page loads fast: ~200KB total initial load (including this README file size as reference)
- No external API calls
- Works offline after first load (all assets cached)
- Optimization runs instantly in the browser

## Security & Privacy

- ✅ No telemetry or tracking
- ✅ No cookies or local storage used for personal data
- ✅ All processing happens locally in your browser
- ✅ HTTPS enforced by GitHub Pages

---

**Ready?** Just push to GitHub and enable Pages in Settings!
