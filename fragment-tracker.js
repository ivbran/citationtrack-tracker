/**
 * CitationTrack Fragment Tracker
 * Lightweight script to track citations and text fragments
 * Version: 1.0.6
 */
(function() {
  'use strict';
  
  // Supabase anon key (public, safe to include in client-side code)
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4b3Z0cGpvenp6YmhjeGRleXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMDA5MDAsImV4cCI6MjA3NzY3NjkwMH0.TRnEkDP4aDd-k18Nx0WCmN2OZLZx6COEEAVr612A6ck';
  
  // Get API key from data attribute or global variable (required)
  var scriptTag = document.currentScript || document.querySelector('script[data-api-key]');
  var apiKeyFromAttr = scriptTag ? scriptTag.getAttribute('data-api-key') : null;
  var apiKey = apiKeyFromAttr || window.CITATIONTRACK_API_KEY || null;
  
  // Get Supabase anon key from data attribute, window variable, or hardcoded fallback
  // This is public and safe to include in client-side code - same for all users
  var supabaseAnonKeyFromAttr = scriptTag ? scriptTag.getAttribute('data-supabase-anon-key') : null;
  var supabaseAnonKey = supabaseAnonKeyFromAttr || window.CITATIONTRACK_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  
  var config = {
    apiKey: apiKey,
    endpoint: (window.CITATIONTRACK_ENDPOINT || 'https://yxovtpjozzzbhcxdeysz.supabase.co/functions/v1/track'),
    debug: window.CITATIONTRACK_DEBUG || false,
    supabaseAnonKey: supabaseAnonKey
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
      
      // Extract ALL text fragments (handle multiple: &text=...)
      // Support: #:~:text=fragment1&text=fragment2&text=fragment3
      var fragments = [];
      // Match both :~:text= (first fragment) and &text= (subsequent fragments)
      // The pattern matches: :~:text=... or &text=...
      var regex = /(?::~:text=|&text=)([^&]+)/g;
      var match;
      
      // Use exec() instead of matchAll() for better browser compatibility
      while ((match = regex.exec(hash)) !== null) {
        if (match && match[1]) {
          fragments.push(match[1]); // Store encoded fragment for parsing
        }
      }
      
      if (fragments.length === 0) {
        log('Failed to match text fragment pattern');
        return null;
      }
      
      log('Found', fragments.length, 'fragment(s)');
      
      // Parse all fragments and extract text from each
      var parsedFragments = [];
      for (var i = 0; i < fragments.length; i++) {
        // Decode URL-encoded characters
        var fragment = decodeURIComponent(fragments[i]);
        
        // Parse full syntax: [prefix-,]textStart[,textEnd][,-suffix]
        // Examples:
        // - "hello" -> textStart = "hello"
        // - "hello,world" -> textStart = "hello", textEnd = "world"
        // - "avoid-,use" -> prefix = "avoid", textStart = "use"
        // - "use,-ing" -> textStart = "use", suffix = "ing"
        // - "prefix-,start,end,-suffix" -> full syntax
        
        var textStart = null;
        var textEnd = null;
        var prefix = null;
        var suffix = null;
        
        // Step 1: Extract prefix if present (format: "prefix-,rest")
        var prefixMatch = fragment.match(/^([^,]+?)-,(.+)$/);
        if (prefixMatch) {
          prefix = prefixMatch[1];
          fragment = prefixMatch[2];
          log('Found prefix:', prefix);
        }
        
        // Step 2: Extract suffix if present (format: "rest,-suffix")
        // Must check for suffix BEFORE checking range (to avoid false positives)
        var suffixMatch = fragment.match(/^(.+?),-([^,]+)$/);
        if (suffixMatch) {
          suffix = suffixMatch[2];
          fragment = suffixMatch[1]; // Remaining part after removing suffix
          log('Found suffix:', suffix);
        }
        
        // Step 3: Extract range if present (format: "textStart,textEnd")
        // Only check for comma if it's followed by something (not end of string)
        // But be careful - commas in text are valid!
        // Range syntax typically: "start,end" where end is not followed by another comma
        var commaIndex = fragment.indexOf(',');
        if (commaIndex !== -1 && commaIndex < fragment.length - 1) {
          // Check if this looks like range syntax (not just comma in text)
          // Range: "start,end" where we can reasonably split
          // Simple heuristic: if comma is not the last char, likely a range
          var parts = fragment.split(',', 2); // Split only first comma
          if (parts.length === 2 && parts[1].length > 0) {
            // Only treat as range if second part doesn't start with a dash (which would be suffix)
            // And if it's reasonably short (not a continuation of text with comma)
            if (!parts[1].startsWith('-')) {
              // Trim whitespace from both parts to handle URL-encoded spaces
              textStart = parts[0].trim();
              textEnd = parts[1].trim();
              log('Found range:', textStart, 'to', textEnd);
            } else {
              // This was actually suffix, but we already handled it above
              textStart = fragment.trim();
            }
          } else {
            textStart = fragment.trim();
          }
        } else {
          // No comma, so this is just textStart
          textStart = fragment.trim();
        }
        
        // Final extraction: Track just the start text (simpler, more reliable)
        // For ranges like "hello,world", we track just "hello" since we can't
        // get the actual highlighted text that appears between them
        var finalFragment = textStart;
        if (textEnd) {
          // Note: Range detected but tracking only start text
          log('Range detected:', textStart, 'to', textEnd, '- tracking start text only:', finalFragment);
        }
        
        parsedFragments.push(finalFragment);
        log('✅ Fragment', (i + 1) + ':', finalFragment, prefix ? '(prefix: ' + prefix + ')' : '', suffix ? '(suffix: ' + suffix + ')' : '');
      }
      
      // Combine all fragments (comma-separated) for tracking
      // Example: "hello" or "hello...world" or "frag1, frag2" or "frag1...end1, frag2...end2"
      var combinedFragment = parsedFragments.join(', ');
      log('✅ All fragments combined:', combinedFragment);
      return combinedFragment || null;
      
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
   * Reconstruct full URL with original text fragment
   * This allows users to click the URL and see the highlighted text
   */
  function getTargetUrlWithFragment(originalHash) {
    try {
      // Get base URL without hash
      var baseUrl = window.location.href.split('#')[0];
      
      // Reconstruct with original fragment
      if (originalHash && originalHash.indexOf(':~:text=') !== -1) {
        return baseUrl + originalHash;
      }
      
      // Fallback to current href
      return window.location.href;
    } catch (e) {
      log('Error reconstructing URL:', e);
      return window.location.href;
    }
  }
  
  /**
   * Send tracking event to backend
   */
  function sendTrackingEvent(fragment, originalHash) {
    var trafficInfo = detectTrafficSource(document.referrer);
    
    // Reconstruct full URL with fragment for clickable link
    var targetUrlWithFragment = getTargetUrlWithFragment(originalHash);
    
    var payload = {
      api_key: config.apiKey,
      fragment_text: fragment, // Parsed text for searchability
      referrer_url: document.referrer || '',
      target_url: targetUrlWithFragment, // Full URL with fragment (clickable!)
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
    // Note: sendBeacon doesn't support custom headers, so we'll use fetch for Supabase Edge Functions
    // which require the 'apikey' header
    fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.supabaseAnonKey, // Required by Supabase Edge Functions
        'Authorization': 'Bearer ' + config.supabaseAnonKey // Also try Authorization header
      },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit' // Don't send credentials to work with CORS wildcard
    }).then(function(response) {
      if (response.ok) {
        log('Event sent successfully');
        if (config.debug) {
          response.json().then(function(data) {
            console.log('[CitationTrack] Success:', data);
          }).catch(function() {
            console.log('[CitationTrack] Success (no JSON response)');
          });
        }
      } else {
        // Log detailed error for debugging
        var status = response.status;
        var statusText = response.statusText;
        response.text().then(function(errorText) {
          // Handle empty response
          if (!errorText || errorText.trim() === '') {
            console.error('[CitationTrack] Request failed:', {
              status: status,
              statusText: statusText,
              message: 'Empty error response from server',
              endpoint: config.endpoint
            });
            return;
          }
          
          try {
            var errorJson = JSON.parse(errorText);
            console.error('[CitationTrack] Request failed:', {
              status: status,
              statusText: statusText,
              code: errorJson.code || 'unknown',
              message: errorJson.message || errorJson.error || 'Unknown error',
              fullError: errorJson
            });
          } catch (e) {
            // If parsing fails, log the raw text
            console.error('[CitationTrack] Request failed:', {
              status: status,
              statusText: statusText,
              errorText: errorText,
              parseError: e.message,
              endpoint: config.endpoint
            });
          }
          log('Event send failed:', 'Status ' + status + ': ' + errorText);
        }).catch(function(err) {
          console.error('[CitationTrack] Failed to read error response:', err);
          console.error('[CitationTrack] Request failed:', {
            status: status,
            statusText: statusText,
            readError: err.message,
            endpoint: config.endpoint
          });
        });
      }
    }).catch(function(error) {
      console.error('[CitationTrack] Network error:', {
        message: error.message,
        stack: error.stack,
        endpoint: config.endpoint
      });
      log('Event send error:', error);
    });
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
    
    // Get original hash before parsing (for full URL reconstruction)
    var originalHash = null;
    try {
      // Try Navigation Timing API first (preserves original fragment)
      var entries = performance.getEntries();
      var navigationEntry = null;
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].entryType === 'navigation') {
          navigationEntry = entries[i];
          break;
        }
      }
      
      if (navigationEntry && navigationEntry.name) {
        try {
          var originalUrl = new URL(navigationEntry.name);
          originalHash = originalUrl.hash;
          log('Original hash from Navigation Timing API:', originalHash);
        } catch (e) {
          log('Failed to parse navigation entry URL:', e);
        }
      }
      
      // Fallback to window.location.hash or preserved fragment
      if (!originalHash || originalHash.indexOf(':~:text=') === -1) {
        originalHash = window.location.hash || window.__preservedTextFragment || null;
        log('Using fallback hash:', originalHash);
      }
    } catch (e) {
      log('Error getting original hash:', e);
      originalHash = window.location.hash || null;
    }
    
    // Check for text fragment IMMEDIATELY
    var fragment = getTextFragment();
    
    if (fragment) {
      log('✅ Found text fragment:', fragment);
      log('Original hash preserved:', originalHash);
      log('Sending tracking event...');
      sendTrackingEvent(fragment, originalHash);
    } else {
      log('❌ No text fragment detected, skipping tracking');
    }
  }
  
  // Start tracking IMMEDIATELY - don't wait for DOMContentLoaded
  // Text fragments are cleared by the browser very quickly!
  log('Script loaded, starting init...');
  init();
})();
