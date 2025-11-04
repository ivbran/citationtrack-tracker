/**
 * CitationTrack Fragment Tracker
 * Lightweight script to track citations and text fragments
 * Version: 1.0.9
 * 
 * HOW THIS WORKS:
 * 1. Detects text fragments in URLs (e.g., #:~:text=highlighted%20text)
 * 2. Identifies traffic sources (AI tools, search engines, social media)
 * 3. Sanitizes sensitive data to protect user privacy
 * 4. Sends tracking events to CitationTrack backend
 */
(function() {
  'use strict';
  
  // Default Supabase anonymous key for API authentication
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4b3Z0cGpvenp6YmhjeGRleXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMDA5MDAsImV4cCI6MjA3NzY3NjkwMH0.TRnEkDP4aDd-k18Nx0WCmN2OZLZx6COEEAVr612A6ck';
  
  // Extract API key from script tag data attribute or global variable
  // Priority: data-api-key attribute > window.CITATIONTRACK_API_KEY
  var scriptTag = document.currentScript || document.querySelector('script[data-api-key]');
  var apiKeyFromAttr = scriptTag ? scriptTag.getAttribute('data-api-key') : null;
  var apiKey = apiKeyFromAttr || window.CITATIONTRACK_API_KEY || null;
  
  // Extract Supabase anonymous key (can be overridden for custom deployments)
  var supabaseAnonKeyFromAttr = scriptTag ? scriptTag.getAttribute('data-supabase-anon-key') : null;
  var supabaseAnonKey = supabaseAnonKeyFromAttr || window.CITATIONTRACK_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  
  // Configuration object with endpoint and debug settings
  var config = {
    apiKey: apiKey,
    endpoint: (window.CITATIONTRACK_ENDPOINT || 'https://yxovtpjozzzbhcxdeysz.supabase.co/functions/v1/track'),
    debug: window.CITATIONTRACK_DEBUG || false,
    supabaseAnonKey: supabaseAnonKey
  };
  
  // API key is required - exit early if not provided
  if (!config.apiKey) {
    console.error('[CitationTrack] Error: API key not provided. Add data-api-key attribute to script tag or set window.CITATIONTRACK_API_KEY');
    return;
  }
  
  function log(message, data) {
    if (config.debug) {
      console.log('[CitationTrack]', message, data || '');
    }
  }
  
  /**
   * Extract text fragment from URL
   * 
   * HOW IT WORKS:
   * Text fragments are URL fragments that look like: #:~:text=start,end
   * They allow linking to specific text on a page, often used by AI tools
   * when citing sources. Browsers automatically remove these fragments from
   * the URL after scrolling, so we use multiple techniques to capture them:
   * 
   * 1. Navigation Timing API - Most reliable, contains original URL
   * 2. window.location.hash - Fallback if Navigation Timing unavailable
   * 3. window.__preservedTextFragment - For pre-preserved fragments
   * 
   * @returns {string|null} The extracted and decoded text fragment, or null if none found
   */
  function getTextFragment() {
    try {
      // Try to get the original navigation entry from Performance API
      // This is the most reliable method as it captures the URL before browser modifications
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
      
      // Extract hash from Navigation Timing API (preferred method)
      if (navigationEntry && navigationEntry.name) {
        try {
          var originalUrl = new URL(navigationEntry.name);
          hash = originalUrl.hash;
          log('Hash from Navigation Timing API:', hash);
        } catch (e) {
          log('Failed to parse navigation entry URL:', e);
        }
      }
      
      // Fallback to window.location.hash if Navigation Timing didn't work
      // or if the hash doesn't contain a text fragment
      if (!hash || hash.indexOf(':~:text=') === -1) {
        hash = window.location.hash;
        log('Using window.location.hash (fallback):', hash);
        
        // Final fallback: check if a text fragment was preserved by a pre-loading script
        if ((!hash || hash.indexOf(':~:text=') === -1) && window.__preservedTextFragment) {
          hash = window.__preservedTextFragment;
          log('Using preserved text fragment:', hash);
        }
      }
      
      // No text fragment found - exit early
      if (!hash || hash.indexOf(':~:text=') === -1) {
        log('No text fragment in URL');
        return null;
      }
      
      // Extract all text fragments from the hash
      // Text fragments can appear as :~:text=... or &text=...
      var fragments = [];
      var regex = /(?::~:text=|&text=)([^&]+)/g;
      var match;
      
      while ((match = regex.exec(hash)) !== null) {
        if (match && match[1]) {
          fragments.push(match[1]);
        }
      }
      
      if (fragments.length === 0) {
        log('Failed to match text fragment pattern');
        return null;
      }
      
      log('Found', fragments.length, 'fragment(s)');
      
      // Parse each fragment to extract the actual text
      // Text fragment syntax supports:
      // - Simple: text=hello (exact match)
      // - Range: text=start,end (match from start to end)
      // - Prefix: text=prefix-,match (context before)
      // - Suffix: text=match,-suffix (context after)
      var parsedFragments = [];
      for (var i = 0; i < fragments.length; i++) {
        var fragment = decodeURIComponent(fragments[i]);
        
        var textStart = null;
        var textEnd = null;
        var prefix = null;
        var suffix = null;
        
        // Check for prefix (appears as "prefix-,text")
        var prefixMatch = fragment.match(/^([^,]+?)-,(.+)$/);
        if (prefixMatch) {
          prefix = prefixMatch[1];
          fragment = prefixMatch[2];
          log('Found prefix:', prefix);
        }
        
        // Check for suffix (appears as "text,-suffix")
        var suffixMatch = fragment.match(/^(.+?),-([^,]+)$/);
        if (suffixMatch) {
          suffix = suffixMatch[2];
          fragment = suffixMatch[1];
          log('Found suffix:', suffix);
        }
        
        // Parse text range (start,end) if present
        var commaIndex = fragment.indexOf(',');
        if (commaIndex !== -1 && commaIndex < fragment.length - 1) {
          var parts = fragment.split(',', 2);
          if (parts.length === 2 && parts[1].length > 0) {
            // Check if this is a range (not a prefix/suffix indicator)
            if (!parts[1].startsWith('-')) {
              textStart = parts[0].trim();
              textEnd = parts[1].trim();
              log('Found range:', textStart, 'to', textEnd);
            } else {
              textStart = fragment.trim();
            }
          } else {
            textStart = fragment.trim();
          }
        } else {
          textStart = fragment.trim();
        }
        
        // Combine range into a single string with ellipsis
        var finalFragment = textStart;
        if (textEnd) {
          finalFragment = textStart + '...' + textEnd;
          log('Range detected, tracking full range:', finalFragment);
        }
        
        parsedFragments.push(finalFragment);
        log('✅ Fragment', (i + 1) + ':', finalFragment, prefix ? '(prefix: ' + prefix + ')' : '', suffix ? '(suffix: ' + suffix + ')' : '');
      }
      
      // Combine all fragments into a single string
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
   * 
   * HOW IT WORKS:
   * Analyzes the referrer URL to identify where the visitor came from.
   * This is crucial for understanding which AI tools are citing your content.
   * 
   * Categories:
   * - AI: Citations from AI assistants (ChatGPT, Perplexity, Claude, etc.)
   * - Search: Traditional search engines (Google, Bing, Yahoo)
   * - Social: Social media platforms (Facebook, Twitter, LinkedIn, etc.)
   * - Direct: No referrer (typed URL, bookmark, or private browsing)
   * - Referral: Any other external website
   * 
   * @param {string} referrer - The HTTP referrer URL
   * @returns {object} Object with 'source' (category) and 'ai' (specific AI tool name)
   */
  function detectTrafficSource(referrer) {
    if (!referrer) {
      return { source: 'Direct', ai: null };
    }
    
    var ref = referrer.toLowerCase();
    
    // AI Systems - Check for known AI assistant domains
    // These tools often use text fragments when citing sources
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
    
    // Search Engines - Traditional search traffic
    if (ref.indexOf('google.com/search') !== -1 || ref.indexOf('bing.com/search') !== -1 || 
        ref.indexOf('yahoo.com') !== -1 || ref.indexOf('yandex.com') !== -1) {
      return { source: 'Search', ai: null };
    }
    
    // Social Media - Traffic from social platforms
    if (ref.indexOf('facebook.com') !== -1 || ref.indexOf('twitter.com') !== -1 || 
        ref.indexOf('x.com') !== -1 || ref.indexOf('linkedin.com') !== -1 || 
        ref.indexOf('reddit.com') !== -1 || ref.indexOf('instagram.com') !== -1 ||
        ref.indexOf('tiktok.com') !== -1 || ref.indexOf('pinterest.com') !== -1) {
      return { source: 'Social', ai: null };
    }
    
    // Default: treat as generic referral traffic
    return { source: 'Referral', ai: null };
  }
  
  /**
   * Sanitize fragment text to remove sensitive patterns
   * 
   * HOW IT WORKS:
   * Privacy protection is critical - we don't want to accidentally track
   * sensitive information that might appear in text fragments. This function
   * uses pattern matching to detect and redact:
   * 
   * - Passwords and credentials (password=, pwd=, passwd=)
   * - API keys and secrets (api_key=, secret=, token=)
   * - Credit card numbers (16 digits with optional separators)
   * - Social Security Numbers (XXX-XX-XXXX format)
   * - Session tokens and authentication tokens
   * - JWT tokens (eyJ... format)
   * - Email addresses
   * 
   * @param {string} text - The text fragment to sanitize
   * @returns {string} Sanitized text with sensitive patterns replaced by [REDACTED]
   */
  function sanitizeFragmentText(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }
    
    var sanitized = text;
    
    // Password patterns
    sanitized = sanitized.replace(/\bpassword[=:]\s*\S+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\bpasswd[=:]\s*\S+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\bpwd[=:]\s*\S+/gi, '[REDACTED]');
    
    // API keys and secrets
    sanitized = sanitized.replace(/\b(api[_-]?key|apikey)[=:]\s*\S+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\b(secret|token|auth)[=:]\s*\S+/gi, '[REDACTED]');
    
    // Credit card numbers (16 digits with optional separators)
    sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED]');
    
    // Social Security Numbers (XXX-XX-XXXX)
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]');
    
    // Session and auth tokens
    sanitized = sanitized.replace(/session[=:]\s*[a-zA-Z0-9_-]+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/token[=:]\s*[a-zA-Z0-9_-]+/gi, '[REDACTED]');
    
    // JWT tokens (start with eyJ and have 3 base64 segments)
    sanitized = sanitized.replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]');
    
    // Email addresses
    sanitized = sanitized.replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, '[REDACTED]');
    
    return sanitized;
  }
  
  /**
   * Sanitize referrer URL by removing sensitive query parameters
   * 
   * HOW IT WORKS:
   * Referrer URLs often contain sensitive information in query parameters
   * (e.g., session tokens, API keys, user IDs). This function removes
   * these parameters to protect user privacy while preserving useful
   * referrer domain information.
   * 
   * Approach:
   * 1. Try to parse as proper URL object (preferred)
   * 2. Delete known sensitive query parameters
   * 3. Fallback to regex replacement if URL parsing fails
   * 
   * Sensitive parameters removed:
   * - Authentication: token, session, auth, authorization, csrf
   * - API keys: api_key, apikey, access_key, secret
   * - User identifiers: id, user_id, uid
   * - OAuth: oauth_token, oauth_secret
   * - Credentials: password, pwd, passwd
   * 
   * @param {string} url - The referrer URL to sanitize
   * @returns {string} Sanitized URL with sensitive parameters removed
   */
  function sanitizeReferrerUrl(url) {
    if (!url || typeof url !== 'string') {
      return url;
    }
    
    try {
      // Quick check: if no query parameters, no sanitization needed
      if (url.indexOf('?') === -1 && url.indexOf('&') === -1) {
        return url;
      }
      
      var urlObj;
      try {
        // Try to parse as proper URL (preferred method)
        urlObj = new URL(url);
      } catch (e) {
        // Fallback: use regex if URL parsing fails
        return url.replace(/[?&](token|session|key|auth|api_key|secret|password)=[^&\s]+/gi, function(match) {
          return match.split('=')[0] + '=[REDACTED]';
        });
      }
      
      // List of sensitive query parameters to remove
      var sensitiveParams = [
        'token', 'session', 'sessionid', 'session_id',
        'key', 'api_key', 'apikey', 'access_key',
        'auth', 'authorization', 'auth_token',
        'secret', 'password', 'pwd', 'passwd',
        'id', 'user_id', 'uid', 'userid',
        'csrf', 'csrf_token', 'csrf-token',
        'oauth_token', 'oauth_secret'
      ];
      
      // Remove each sensitive parameter
      sensitiveParams.forEach(function(param) {
        urlObj.searchParams.delete(param);
      });
      
      return urlObj.toString();
    } catch (e) {
      log('Error sanitizing referrer URL:', e);
      // Final fallback: basic regex replacement
      return url.replace(/[?&](token|session|key|auth)=[^&\s]+/gi, function(match) {
        return match.split('=')[0] + '=[REDACTED]';
      });
    }
  }
  
  /**
   * Reconstruct full URL with original text fragment
   * 
   * HOW IT WORKS:
   * Browsers automatically remove text fragments (#:~:text=...) from the
   * visible URL after scrolling to the target text. To preserve the
   * complete citation URL for tracking, we reconstruct it by:
   * 
   * 1. Taking the base URL (without hash)
   * 2. Appending the original hash if it contains a text fragment
   * 3. Falling back to current URL if no text fragment was preserved
   * 
   * This ensures we track the exact URL that was used to cite your content.
   * 
   * @param {string} originalHash - The preserved hash containing the text fragment
   * @returns {string} Full URL with text fragment included
   */
  function getTargetUrlWithFragment(originalHash) {
    try {
      var baseUrl = window.location.href.split('#')[0];
      
      if (originalHash && originalHash.indexOf(':~:text=') !== -1) {
        return baseUrl + originalHash;
      }
      
      return window.location.href;
    } catch (e) {
      log('Error reconstructing URL:', e);
      return window.location.href;
    }
  }
  
  /**
   * Send tracking event to backend
   * 
   * HOW IT WORKS:
   * This is the core tracking function that sends data to CitationTrack.
   * 
   * Process:
   * 1. Check Do Not Track (DNT) header - respect user privacy preferences
   * 2. Detect traffic source (AI tool, search engine, etc.)
   * 3. Sanitize sensitive data from fragment and referrer
   * 4. Build payload with citation data and metadata
   * 5. Dispatch custom event (for testing and extensions)
   * 6. Send HTTP POST request to CitationTrack API
   * 7. Handle response (success or error logging)
   * 
   * The payload includes:
   * - fragment_text: The cited text (sanitized)
   * - referrer_url: Where the visitor came from (sanitized)
   * - target_url: Your page URL with text fragment
   * - metadata: Browser info, viewport, timestamp, traffic source
   * 
   * @param {string} fragment - The extracted text fragment
   * @param {string} originalHash - The original URL hash for reconstruction
   */
  function sendTrackingEvent(fragment, originalHash) {
    // Respect Do Not Track browser setting
    if (navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes') {
      log('Do Not Track enabled, skipping tracking');
      return;
    }
    
    // Gather and sanitize all tracking data
    var trafficInfo = detectTrafficSource(document.referrer);
    var targetUrlWithFragment = getTargetUrlWithFragment(originalHash);
    var sanitizedFragment = sanitizeFragmentText(fragment);
    var sanitizedReferrer = sanitizeReferrerUrl(document.referrer || '');
    
    // Build the tracking payload
    var payload = {
      api_key: config.apiKey,
      fragment_text: sanitizedFragment,
      referrer_url: sanitizedReferrer,
      target_url: targetUrlWithFragment,
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
    
    // Dispatch custom event for testing and browser extensions
    // This allows developers to listen for tracking events without API access
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      try {
        var event = new CustomEvent('citationtrack:tracked', {
          detail: payload,
          bubbles: true
        });
        var dispatched = window.dispatchEvent(event);
        log('Custom event dispatched, result:', dispatched);
        
        // Store last event for debugging
        window.__lastCitationTrackEvent = payload;
        
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
    
    // Send tracking event to CitationTrack API
    // Using fetch with keepalive ensures the request completes even if the page unloads
    fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.supabaseAnonKey,
        'Authorization': 'Bearer ' + config.supabaseAnonKey
      },
      body: JSON.stringify(payload),
      keepalive: true,  // Request continues even if page unloads
      credentials: 'omit'  // Don't send cookies
    }).then(function(response) {
      // Handle successful response (2xx status codes)
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
        // Handle error responses (4xx, 5xx status codes)
        var status = response.status;
        var statusText = response.statusText;
        response.text().then(function(errorText) {
          if (!errorText || errorText.trim() === '') {
            console.error('[CitationTrack] Request failed:', {
              status: status,
              statusText: statusText,
              message: 'Empty error response from server',
              endpoint: config.endpoint
            });
            return;
          }
          
          // Try to parse error as JSON for structured error info
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
            // Error response is not JSON - log as plain text
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
      // Handle network errors (connection failed, CORS, etc.)
      console.error('[CitationTrack] Network error:', {
        message: error.message,
        stack: error.stack,
        endpoint: config.endpoint
      });
      log('Event send error:', error);
    });
  }
  
  /**
   * Initialize tracking
   * 
   * HOW IT WORKS:
   * This is the main entry point that runs when the script loads.
   * 
   * Initialization flow:
   * 1. Log diagnostic information (URL, hash, readyState, referrer)
   * 2. Check for preserved text fragments from multiple sources:
   *    - Navigation Timing API (most reliable)
   *    - window.location.hash (fallback)
   *    - window.__preservedTextFragment (pre-preserved by helper script)
   *    - sessionStorage (backup storage)
   * 3. Extract and parse text fragments from URL
   * 4. If fragment found, send tracking event to backend
   * 5. If no fragment, skip tracking (not a citation)
   * 
   * The script runs immediately when loaded, so it captures the URL
   * before the browser removes the text fragment.
   */
  function init() {
    log('=== CitationTrack Tracker Initializing ===');
    log('Current URL:', window.location.href);
    log('Current Hash:', window.location.hash);
    log('Document readyState:', document.readyState);
    log('Document Referrer:', document.referrer);
    log('Preservation script ran?:', window.__preservationScriptRan);
    log('Preserved fragment global?:', window.__preservedTextFragment);
    
    // Try to read from sessionStorage (may be blocked by privacy settings)
    try {
      var storedFragment = window.sessionStorage.getItem('__textFragment');
      log('sessionStorage __textFragment:', storedFragment);
    } catch(e) {
      log('Cannot read sessionStorage:', e);
    }
    
    // Retrieve original hash before browser removes it
    var originalHash = null;
    try {
      // Try Navigation Timing API first (most reliable)
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
      
      // Fallback to other sources if Navigation Timing didn't work
      if (!originalHash || originalHash.indexOf(':~:text=') === -1) {
        originalHash = window.location.hash || window.__preservedTextFragment || null;
        log('Using fallback hash:', originalHash);
      }
    } catch (e) {
      log('Error getting original hash:', e);
      originalHash = window.location.hash || null;
    }
    
    // Extract text fragment from URL
    var fragment = getTextFragment();
    
    // Send tracking event if fragment was found
    if (fragment) {
      log('✅ Found text fragment:', fragment);
      log('Original hash preserved:', originalHash);
      log('Sending tracking event...');
      sendTrackingEvent(fragment, originalHash);
    } else {
      log('❌ No text fragment detected, skipping tracking');
    }
  }
  
  // Start initialization immediately when script loads
  log('Script loaded, starting init...');
  init();
})();
