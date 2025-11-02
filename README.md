# CitationTrack Fragment Tracker

Lightweight JavaScript tracker for tracking text fragments and AI citations on your website.

## 📦 Installation

Add this script to your website's `<head>` section:

```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/citationtrack-tracker@v1.0.0/fragment-tracker.js" 
        data-api-key="YOUR_API_KEY" 
        async></script>
```

Replace:
- `YOUR_USERNAME` with your GitHub username (or use CitationTrack's CDN when available)
- `YOUR_API_KEY` with your CitationTrack API key from the dashboard

## 🔑 Get Your API Key

1. Sign up at [CitationTrack.com](https://citationtrack.com)
2. Add your website domain
3. Copy your API key from the dashboard

## 📖 How It Works

The tracker automatically:
- ✅ Detects text fragments from AI citations (`#:~:text=...`)
- ✅ Identifies traffic source (Google AI, ChatGPT, Perplexity, etc.)
- ✅ Sends tracking events to CitationTrack analytics
- ✅ Works with Navigation Timing API for maximum reliability

## 🌐 CDN

This tracker is distributed via [jsDelivr CDN](https://www.jsdelivr.com) for fast global delivery.

**CDN URL:**
```
https://cdn.jsdelivr.net/gh/YOUR_USERNAME/citationtrack-tracker@VERSION/fragment-tracker.js
```

**Latest version:**
Replace `@VERSION` with latest tag (e.g., `@v1.0.0`)

## 🔧 Configuration

### Basic Usage (with data attribute):
```html
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/citationtrack-tracker@v1.0.0/fragment-tracker.js" 
        data-api-key="your_api_key_here" 
        async></script>
```

### Advanced Usage (with global variable):
```html
<script>
  window.CITATIONTRACK_API_KEY = 'your_api_key_here';
  window.CITATIONTRACK_DEBUG = false; // Enable debug logging
</script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/citationtrack-tracker@v1.0.0/fragment-tracker.js" async></script>
```

### Custom Endpoint (Enterprise):
```html
<script>
  window.CITATIONTRACK_API_KEY = 'your_api_key_here';
  window.CITATIONTRACK_ENDPOINT = 'https://your-custom-endpoint.com/track';
</script>
<script src="https://cdn.jsdelivr.net/gh/YOUR_USERNAME/citationtrack-tracker@v1.0.0/fragment-tracker.js" async></script>
```

## 📊 What Gets Tracked

- Text fragments from AI citations
- Traffic source (AI, Search, Social, Direct, Referral)
- AI source identification (Google AI Overview, ChatGPT, Perplexity, etc.)
- Page URL and referrer
- Browser metadata (viewport, language, user agent)

## 🔒 Privacy & Security

- ✅ No personal data collected
- ✅ No cookies used
- ✅ API key validates through server
- ✅ All tracking is opt-in (requires API key)

## 📝 Version History

- **v1.0.0** - Initial release with Navigation Timing API support

## 📄 License

This code is **NOT open source**. See [LICENSE](LICENSE) for details.

Copyright (c) 2025 CitationTrack.com - All Rights Reserved

## 🆘 Support

- Documentation: [CitationTrack.com/docs](https://citationtrack.com/docs)
- Support: contact@citationtrack.com
- Issues: [GitHub Issues](https://github.com/YOUR_USERNAME/citationtrack-tracker/issues)

