/**
 * CitationTrack Fragment Tracker
 * Lightweight script to track citations and text fragments
 * Version: 1.0.0
 */
(function() {
  'use strict';
  
  // Get API key from data attribute or global variable (required)
  var scriptTag = document.currentScript || document.querySelector('script[data-api-key]');
  var apiKeyFromAttr = scriptTag ? scriptTag.getAttribute('data-api-key') : null;
  var apiKey = apiKeyFromAttr || window.CITATIONTRACK_API_KEY || null;
  
  // Configuration
  var config = {
    apiKey: apiKey,
    endpoint: (window.CITATIONTRACK_ENDPOINT || 'https://yxovtpjozzzbhcxdeysz.supabase.co/functions/v1/track'),
    debug: window.CITATIONTRACK_DEBUG || false
  };
  
  // Validate API key is provided
  if (!config.apiKey) {
    console.error('[CitationTrack] Error: API key not provided. Add data-api-key attribute to script tag or set window.CITATIONTRACK_API_KEY');
    return; // Exit early - don't track without API key
  }
  
  // Logging helper
  function log(message, data) {
    if (config.debug) {
      console.log('[CitationTrack]', message, data || '');
    }
  }
  
  /**
   * Extract text fragment from URL using Navigation Timing API
   * 
   * IMPORTANT: Browsers strip the :~: fragment directive from window.location.hash
   * for security reasons. To detect text fragments for analytics, we use the
   * Navigation Timing API workaround from:
   * https://web.dev/articles/text-fragments#obtaining_text_fragments_for_analytics_purposes
   * 
   * This is the official Google-recommended method for text fragment analytics.
   */
  function getTextFragment() {
    try {
      // Method 1: Use Navigation Timing API (most reliable, official Google method)
      // This gets the original navigation URL before browser strips :~:text=
      var navigationEntry = null;
      try {
        var entries = performance.getEntries();
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].entryType === 'navigation') {
            navigationEntry = entries[i];
            break;
          }
        }
      } catch (e) {
        log('Navigation Timing API not available:', e);
      }
      
      var hash = null;
      
      if (navigationEntry && navigationEntry.name) {
        // Parse the original URL from Navigation Timing API
        try {
          var originalUrl = new URL(navigationEntry.name);
          hash = originalUrl.hash;
          log('Hash from Navigation Timing API:', hash);
        } catch (e) {
          log('Failed to parse navigation entry URL:', e);
        }
      }
      
      // Method 2: Fallback to window.location.hash (may not have :~:text=)
      if (!hash || hash.indexOf(':~:text=') === -1) {
        hash = window.location.hash;
        log('Using window.location.hash (fallback):', hash);
        
        // Method 3: Check preserved fragment (if inline script ran first)
        if ((!hash || hash.indexOf(':~:text=') === -1) && window.__preservedTextFragment) {
          hash = window.__preservedTextFragment;
          log('Using preserved text fragment:', hash);
        }
      }
      
      // Check if it contains a text fragment directive
      if (!hash || hash.indexOf(':~:text=') === -1) {
        log('No text fragment in URL');
        return null;
      }
      
      // Extract the text portion
      var match = hash.match(/:~:text=([^&]+)/);
      if (!match || !match[1]) {
        log('Failed to match text fragment pattern');
        return null;
      }
      
      // Decode URL-encoded characters
      var fragment = decodeURIComponent(match[1]);
      
      // Remove prefix/suffix markers (- at start/end)
      fragment = fragment.replace(/^-+/, '').replace(/-+$/, '');
      
      // Clean up text range markers ONLY if they look like range syntax
      // Range syntax: "prefix-,start,end,-suffix"
      // Real commas in text: "hello, world"
      // Only split on comma if followed by a dash (indicating range end marker)
      if (fragment.indexOf(',-') !== -1) {
        fragment = fragment.split(',-')[0];
      }
      
      log('✅ Text fragment detected:', fragment);
      return fragment || null;
      
    } catch (e) {
      log('Error parsing text fragment:', e);
      return null;
    }
  }
  
  /**
   * Detect traffic source from referrer
   */
  function detectTrafficSource(referrer) {
    if (!referrer) {
      return { source: 'Direct', ai: null };
    }
    
    var ref = referrer.toLowerCase();
    
    // AI Systems
    if (ref.indexOf('perplexity') !== -1) {
      return { source: 'AI', ai: 'Perplexity' };
    }
    if (ref.indexOf('chatgpt.com') !== -1 || ref.indexOf('openai.com') !== -1) {
      return { source: 'AI', ai: 'ChatGPT' };
    }
    if (ref.indexOf('claude.ai') !== -1 || ref.indexOf('anthropic.com') !== -1) {
      return { source: 'AI', ai: 'Claude' };
    }
    if (ref.indexOf('google.com') !== -1 && (ref.indexOf('ai') !== -1 || ref.indexOf('overview') !== -1)) {
      return { source: 'AI', ai: 'Google AI Overview' };
    }
    if (ref.indexOf('brave.com') !== -1 && ref.indexOf('ai') !== -1) {
      return { source: 'AI', ai: 'Brave AI' };
    }
    if (ref.indexOf('microsoft.com') !== -1 && ref.indexOf('copilot') !== -1) {
      return { source: 'AI', ai: 'Microsoft Copilot' };
    }
    if (ref.indexOf('duckduckgo.com') !== -1 && ref.indexOf('ai') !== -1) {
      return { source: 'AI', ai: 'DuckDuckGo AI' };
    }
    
    // Search Engines
    if (ref.indexOf('google.com/search') !== -1 || ref.indexOf('bing.com/search') !== -1 || 
        ref.indexOf('yahoo.com') !== -1 || ref.indexOf('yandex.com') !== -1) {
      return { source: 'Search', ai: null };
    }
    
    // Social Media
    if (ref.indexOf('facebook.com') !== -1 || ref.indexOf('twitter.com') !== -1 || 
        ref.indexOf('x.com') !== -1 || ref.indexOf('linkedin.com') !== -1 || 
        ref.indexOf('reddit.com') !== -1 || ref.indexOf('instagram.com') !== -1 ||
        ref.indexOf('tiktok.com') !== -1 || ref.indexOf('pinterest.com') !== -1) {
      return { source: 'Social', ai: null };
    }
    
    return { source: 'Referral', ai: null };
  }
  
  /**
   * Send tracking event to backend
   */
  function sendTrackingEvent(fragment) {
    var trafficInfo = detectTrafficSource(document.referrer);
    
    var payload = {
      api_key: config.apiKey,
      fragment_text: fragment,
      referrer_url: document.referrer || '',
      target_url: window.location.href,
      user_agent: navigator.userAgent,
      metadata: {
        traffic_source: trafficInfo.source,
        ai_source: trafficInfo.ai,
        fragment_source: 'url_hash',
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        language: navigator.language,
        timestamp: new Date().toISOString()
      }
    };
    
    log('Sending tracking event:', payload);
    
    // Dispatch custom event for UI components to listen to
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        var event = new CustomEvent('citationtrack:tracked', {
          detail: payload,
          bubbles: true
        });
        var dispatched = window.dispatchEvent(event);
        log('Custom event dispatched, result:', dispatched);
        // Store in global for debugging
        window.__lastCitationTrackEvent = payload;
        
        // Log to browser console directly for debugging
        console.log('[FragmentTracker] ✅ EVENT DISPATCHED:', {
          eventName: 'citationtrack:tracked',
          fragmentText: payload.fragment_text,
          dispatched: dispatched,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        log('Failed to dispatch custom event:', e);
      }
    }
    
    // Use sendBeacon if available (reliable for page unload)
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(config.endpoint, blob);
      log('Event sent via sendBeacon');
    } else {
      // Fallback to fetch
      fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit' // Don't send credentials to work with CORS wildcard
      }).then(function(response) {
        if (response.ok) {
          log('Event sent successfully');
        } else {
          log('Event send failed:', response.status);
        }
      }).catch(function(error) {
        log('Event send error:', error);
      });
    }
  }
  
  /**
   * Initialize tracking IMMEDIATELY
   * CRITICAL: Must run synchronously when script loads, before browser clears fragment
   */
  function init() {
    log('=== CitationTrack Tracker Initializing ===');
    log('Current URL:', window.location.href);
    log('Current Hash:', window.location.hash);
    log('Document readyState:', document.readyState);
    log('Document Referrer:', document.referrer);
    log('Preservation script ran?:', window.__preservationScriptRan);
    log('Preserved fragment global?:', window.__preservedTextFragment);
    
    // Also check sessionStorage directly
    try {
      var storedFragment = window.sessionStorage.getItem('__textFragment');
      log('sessionStorage __textFragment:', storedFragment);
    } catch(e) {
      log('Cannot read sessionStorage:', e);
    }
    
    // Check for text fragment IMMEDIATELY
    var fragment = getTextFragment();
    
    if (fragment) {
      log('✅ Found text fragment:', fragment);
      log('Sending tracking event...');
      sendTrackingEvent(fragment);
    } else {
      log('❌ No text fragment detected, skipping tracking');
    }
  }
  
  // Start tracking IMMEDIATELY - don't wait for DOMContentLoaded
  // Text fragments are cleared by the browser very quickly!
  log('Script loaded, starting init...');
  init();
})();
