/**
 * CitationTrack Fragment Tracker
 * Lightweight script to track citations and text fragments
 * Version: 2.0.2 - Security fix: Event dispatch after backend validation
 */
(function() {
  'use strict';
  
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4b3Z0cGpvenp6YmhjeGRleXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMDA5MDAsImV4cCI6MjA3NzY3NjkwMH0.TRnEkDP4aDd-k18Nx0WCmN2OZLZx6COEEAVr612A6ck';
  
  var scriptTag = document.currentScript || document.querySelector('script');
  
  var supabaseAnonKeyFromAttr = scriptTag ? scriptTag.getAttribute('data-supabase-anon-key') : null;
  var supabaseAnonKey = supabaseAnonKeyFromAttr || window.CITATIONTRACK_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;
  
  // Domain is extracted server-side from Origin/Referer headers (Simple Analytics approach)
  // No need to extract domain client-side - browser automatically sends headers
  var config = {
    endpoint: (window.CITATIONTRACK_ENDPOINT || 'https://yxovtpjozzzbhcxdeysz.supabase.co/functions/v1/track'),
    debug: window.CITATIONTRACK_DEBUG || false,
    supabaseAnonKey: supabaseAnonKey
  };
  
  function log(message, data) {
    if (config.debug) {
      console.log('[CitationTrack]', message, data || '');
    }
  }
  
  /**
   * Extract text fragment from URL
   */
  function getTextFragment() {
    try {
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
        try {
          var originalUrl = new URL(navigationEntry.name);
          hash = originalUrl.hash;
          log('Hash from Navigation Timing API:', hash);
        } catch (e) {
          log('Failed to parse navigation entry URL:', e);
        }
      }
      
      if (!hash || hash.indexOf(':~:text=') === -1) {
        hash = window.location.hash;
        log('Using window.location.hash (fallback):', hash);
        
        if ((!hash || hash.indexOf(':~:text=') === -1) && window.__preservedTextFragment) {
          hash = window.__preservedTextFragment;
          log('Using preserved text fragment:', hash);
        }
      }
      
      if (!hash || hash.indexOf(':~:text=') === -1) {
        log('No text fragment in URL');
        return null;
      }
      
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
      
      var parsedFragments = [];
      for (var i = 0; i < fragments.length; i++) {
        var fragment = decodeURIComponent(fragments[i]);
        
        var textStart = null;
        var textEnd = null;
        var prefix = null;
        var suffix = null;
        
        var prefixMatch = fragment.match(/^([^,]+?)-,(.+)$/);
        if (prefixMatch) {
          prefix = prefixMatch[1];
          fragment = prefixMatch[2];
          log('Found prefix:', prefix);
        }
        
        var suffixMatch = fragment.match(/^(.+?),-([^,]+)$/);
        if (suffixMatch) {
          suffix = suffixMatch[2];
          fragment = suffixMatch[1];
          log('Found suffix:', suffix);
        }
        
        var commaIndex = fragment.indexOf(',');
        if (commaIndex !== -1 && commaIndex < fragment.length - 1) {
          var parts = fragment.split(',', 2);
          if (parts.length === 2 && parts[1].length > 0) {
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
        
        var finalFragment = textStart;
        if (textEnd) {
          finalFragment = textStart + '...' + textEnd;
          log('Range detected, tracking full range:', finalFragment);
        }
        
        parsedFragments.push(finalFragment);
        log('✅ Fragment', (i + 1) + ':', finalFragment, prefix ? '(prefix: ' + prefix + ')' : '', suffix ? '(suffix: ' + suffix + ')' : '');
      }
      
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
   * Sanitize fragment text to remove sensitive patterns
   */
  function sanitizeFragmentText(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }
    
    var sanitized = text;
    
    sanitized = sanitized.replace(/\bpassword[=:]\s*\S+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\bpasswd[=:]\s*\S+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\bpwd[=:]\s*\S+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\b(api[_-]?key|apikey)[=:]\s*\S+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\b(secret|token|auth)[=:]\s*\S+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED]');
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]');
    sanitized = sanitized.replace(/session[=:]\s*[a-zA-Z0-9_-]+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/token[=:]\s*[a-zA-Z0-9_-]+/gi, '[REDACTED]');
    sanitized = sanitized.replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]');
    sanitized = sanitized.replace(/\b[\w\.-]+@[\w\.-]+\.\w+\b/g, '[REDACTED]');
    
    return sanitized;
  }
  
  /**
   * Sanitize referrer URL by removing sensitive query parameters
   */
  function sanitizeReferrerUrl(url) {
    if (!url || typeof url !== 'string') {
      return url;
    }
    
    try {
      if (url.indexOf('?') === -1 && url.indexOf('&') === -1) {
        return url;
      }
      
      var urlObj;
      try {
        urlObj = new URL(url);
      } catch (e) {
        return url.replace(/[?&](token|session|key|auth|api_key|secret|password)=[^&\s]+/gi, function(match) {
          return match.split('=')[0] + '=[REDACTED]';
        });
      }
      
      var sensitiveParams = [
        'token', 'session', 'sessionid', 'session_id',
        'key', 'api_key', 'apikey', 'access_key',
        'auth', 'authorization', 'auth_token',
        'secret', 'password', 'pwd', 'passwd',
        'id', 'user_id', 'uid', 'userid',
        'csrf', 'csrf_token', 'csrf-token',
        'oauth_token', 'oauth_secret'
      ];
      
      sensitiveParams.forEach(function(param) {
        urlObj.searchParams.delete(param);
      });
      
      return urlObj.toString();
    } catch (e) {
      log('Error sanitizing referrer URL:', e);
      return url.replace(/[?&](token|session|key|auth)=[^&\s]+/gi, function(match) {
        return match.split('=')[0] + '=[REDACTED]';
      });
    }
  }
  
  /**
   * Reconstruct full URL with original text fragment
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
   */
  function sendTrackingEvent(fragment, originalHash) {
    if (navigator.doNotTrack === '1' || navigator.doNotTrack === 'yes') {
      log('Do Not Track enabled, skipping tracking');
      return;
    }
    
    var trafficInfo = detectTrafficSource(document.referrer);
    var targetUrlWithFragment = getTargetUrlWithFragment(originalHash);
    var sanitizedFragment = sanitizeFragmentText(fragment);
    var sanitizedReferrer = sanitizeReferrerUrl(document.referrer || '');
    
    // Extract hostname client-side (Simple Analytics approach - for convenience/logging)
    // Server will validate it matches Origin/Referer headers (security)
    var hostname = window.location.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    var timestamp = new Date().toISOString();
    var payload = {
      hostname: hostname, // Sent from client for convenience, but validated server-side from headers
      fragment_text: sanitizedFragment,
      referrer_url: sanitizedReferrer,
      target_url: targetUrlWithFragment,
      user_agent: navigator.userAgent,
      timestamp: timestamp, // Top-level timestamp for replay attack prevention
      metadata: {
        traffic_source: trafficInfo.source,
        ai_source: trafficInfo.ai,
        fragment_source: 'url_hash',
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
        language: navigator.language,
        timestamp: timestamp // Also in metadata for backward compatibility
      }
    };
    
    log('Sending tracking event:', payload);
    
    // SECURITY: Event only fires AFTER successful backend validation
    // This prevents bypassing our servers by copying code and removing backend call
    fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.supabaseAnonKey,
        'Authorization': 'Bearer ' + config.supabaseAnonKey
      },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit'
    }).then(function(response) {
      if (response.ok) {
        log('Event sent successfully');
        
        // Only fire citationtrack:tracked event AFTER successful backend validation
        // This ensures domain is registered and account is active
        if (typeof window !== 'undefined' && window.dispatchEvent) {
          try {
            var event = new CustomEvent('citationtrack:tracked', {
              detail: payload,
              bubbles: true
            });
            var dispatched = window.dispatchEvent(event);
            log('Custom event dispatched, result:', dispatched);
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
        
        if (config.debug) {
          response.json().then(function(data) {
            console.log('[CitationTrack] Success:', data);
          }).catch(function() {
            console.log('[CitationTrack] Success (no JSON response)');
          });
        }
      } else {
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
   * Initialize tracking
   */
  function init() {
    log('=== CitationTrack Tracker Initializing ===');
    log('Current URL:', window.location.href);
    log('Current Hash:', window.location.hash);
    log('Document readyState:', document.readyState);
    log('Document Referrer:', document.referrer);
    log('Preservation script ran?:', window.__preservationScriptRan);
    log('Preserved fragment global?:', window.__preservedTextFragment);
    
    try {
      var storedFragment = window.sessionStorage.getItem('__textFragment');
      log('sessionStorage __textFragment:', storedFragment);
    } catch(e) {
      log('Cannot read sessionStorage:', e);
    }
    
    var originalHash = null;
    try {
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
      
      if (!originalHash || originalHash.indexOf(':~:text=') === -1) {
        originalHash = window.location.hash || window.__preservedTextFragment || null;
        log('Using fallback hash:', originalHash);
      }
    } catch (e) {
      log('Error getting original hash:', e);
      originalHash = window.location.hash || null;
    }
    
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
  
  log('Script loaded, starting init...');
  init();
})();
