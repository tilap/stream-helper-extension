const EXTENSION_TAG = "[SENPAI]";
// Enable this locally while developing. Keep false by default to avoid intrusive UI/logging.
const DEBUG = false;

function logDebug(message, extra) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(EXTENSION_TAG, message, extra ?? {});
}

function warnDebug(message, extra) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.warn(EXTENSION_TAG, message, extra ?? {});
}

function errorDebug(message, extra) {
  // Always keep errors visible: if something breaks, we want signal.
  // eslint-disable-next-line no-console
  console.error(EXTENSION_TAG, message, extra ?? {});
}

function isLikelyVideoUrl(url) {
  if (typeof url !== "string") return false;
  return (
    url.includes(".mp4") ||
    url.includes(".m3u8") ||
    url.includes("video") ||
    url.includes("stream")
  );
}

function createDebugOverlay() {
  if (!DEBUG) return null;
  const debugDiv = document.createElement("div");
  debugDiv.style.position = "fixed";
  debugDiv.style.bottom = "10px";
  debugDiv.style.left = "10px";
  debugDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  debugDiv.style.color = "white";
  debugDiv.style.padding = "10px";
  debugDiv.style.borderRadius = "5px";
  debugDiv.style.width = "300px";
  debugDiv.style.zIndex = "2147483647";
  debugDiv.style.fontSize = "12px";
  debugDiv.innerText = "Debug Info:";

  const append = () => {
    if (!document.body) return false;
    document.body.appendChild(debugDiv);
    return true;
  };

  if (!append()) {
    warnDebug("Body not available yet, waiting…", { timestamp: Date.now() });
    const bodyObserver = new MutationObserver((_, obs) => {
      if (append()) obs.disconnect();
    });
    bodyObserver.observe(document.documentElement, { childList: true });
  }

  return debugDiv;
}

const debugOverlay = createDebugOverlay();
function updateDebugStatus(message) {
  if (!debugOverlay) return;
  debugOverlay.innerText = `Debug Info:\n${message}`;
}

logDebug("Content script started", {
  url: window.location.href,
  readyState: document.readyState,
  bodyExists: !!document.body,
  timestamp: Date.now(),
});

const domain = new URL(SENPAI_ORIGIN).hostname;
logDebug("Domain set", { domain, timestamp: Date.now() });

// Function to extract real video URL from iframe
async function extractRealVideoUrl(iframe) {
  try {
    updateDebugStatus("Trying to extract video URL...");
    
    // Method 1: Try to access iframe content directly
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc) {
        // Look for video elements
        const videoElement = iframeDoc.querySelector('video');
        if (videoElement) {
          // Check for src attribute
          if (videoElement.src) {
            updateDebugStatus(`Found video src: ${videoElement.src}`);
            return videoElement.src;
          }
          
          // Check for source elements
          const sourceElement = iframeDoc.querySelector('video source');
          if (sourceElement && sourceElement.src) {
            updateDebugStatus(`Found video source: ${sourceElement.src}`);
            return sourceElement.src;
          }
        }
        
        // Look for any element with video URL patterns
        const allElements = iframeDoc.querySelectorAll("*");
        for (const element of allElements) {
          const src = element.src || element.href;
          if (src && isLikelyVideoUrl(src)) {
            updateDebugStatus(`Found video URL in element: ${src}`);
            return src;
          }
        }
      }
    } catch (crossOriginError) {
      updateDebugStatus("Cross-origin iframe, trying alternative methods...");
    }
    
    // Method 2: Try to intercept network requests
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest.prototype.open;
    let videoUrl = null;
    
    // Intercept fetch requests
    window.fetch = function(...args) {
      const url = args[0];
      if (isLikelyVideoUrl(url)) {
        videoUrl = url;
        updateDebugStatus(`Intercepted video URL via fetch: ${url}`);
      }
      return originalFetch.apply(this, args);
    };
    
    // Intercept XMLHttpRequest
    window.XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      if (isLikelyVideoUrl(url)) {
        videoUrl = url;
        updateDebugStatus(`Intercepted video URL via XHR: ${url}`);
      }
      return originalXHR.call(this, method, url, ...rest);
    };
    
    // Wait for potential network requests
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Restore original functions
    window.fetch = originalFetch;
    window.XMLHttpRequest.prototype.open = originalXHR;
    
    if (videoUrl) {
      return videoUrl;
    }
    
    // Method 3: Try to decode the iframe URL
    try {
      const iframeSrc = iframe.src;
      if (iframeSrc.includes('embed/')) {
        // Extract the encoded part
        const encodedPart = iframeSrc.split('embed/')[1];
        if (encodedPart) {
          // Try to decode base64
          try {
            const decoded = atob(encodedPart);
            updateDebugStatus(`Decoded iframe data: ${decoded.substring(0, 100)}...`);
            
            // Look for URLs in the decoded data
            const urlMatch = decoded.match(/https?:\/\/[^\s"']+/g);
            if (urlMatch) {
              for (const url of urlMatch) {
                if (isLikelyVideoUrl(url)) {
                  updateDebugStatus(`Found video URL in decoded data: ${url}`);
                  return url;
                }
              }
            }
          } catch (base64Error) {
            updateDebugStatus("Could not decode base64 data");
          }
        }
      }
    } catch (decodeError) {
      updateDebugStatus("Error decoding iframe URL");
    }
    
    updateDebugStatus("No video URL found, will use fallback");
    return null;
    
  } catch (error) {
    errorDebug("Error extracting video URL", error);
    updateDebugStatus("Error extracting video URL");
    return null;
  }
}

// Function to check and click the target element
function checkAndClickTarget() {
  const targetElement = document.querySelector('[x-show="cf_turnstile_response"]');
  if (targetElement) {
    updateDebugStatus("Play button click");
    targetElement.click();
    return true;
  }
  return false;
}

// Improved observer setup
function setupObserver() {
  // Direct check before setting up the observer
  if (checkAndClickTarget()) return;

  const observer = new MutationObserver((mutations, obs) => {
    if (checkAndClickTarget()) {
      obs.disconnect();
    }
  });

  // Start observing the document for changes
  observer.observe(document.body, { childList: true, subtree: true });
}

// Function to simulate clicks on the link
function simulateClicks(link) {
  let iterationCount = 0;
  const maxIterations = 20;

  const interval = setInterval(() => {
    const spans = document.querySelectorAll("span");
    const progressSpan = Array.from(spans).find(span => {
      const text = span.textContent.trim();
      return /^\d+%$/.test(text);
    });

    if (iterationCount >= maxIterations) {
      clearInterval(interval);
      updateDebugStatus("Error to click the ads");
      return;
    }

    // Check if no span with a percentage value is found
    if (!progressSpan) {
      updateDebugStatus("No progress span found, waiting for the target element");
      clearInterval(interval);
      setupObserver();
      return;
    }

    link.click();
    iterationCount++;
  }, 300);
}

// Function to block link opening
function blockLinkOpening(event) {
  event.preventDefault();
}

// Observer to find the link
const linkObserver = new MutationObserver((mutations, obs) => {
  try {
    updateDebugStatus("Waiting for the link to appear");
    const links = document.querySelectorAll("a");
    const link = Array.from(links).find(a => a.textContent.includes("Continuer"));

    if (link) {
      updateDebugStatus("Link found");
      link.addEventListener('click', blockLinkOpening);

      updateDebugStatus("Simulating clicks");
      simulateClicks(link);

      obs.disconnect();
    }
  } catch (error) {
    errorDebug("An error occurred", error);
  }
});

// Start observing the document for changes
linkObserver.observe(document, { childList: true, subtree: true });

// Function to create the download button
function createDownloadButton(iframe) {
  logDebug("createDownloadButton called", { iframeSrc: iframe?.src, timestamp: Date.now() });
  updateDebugStatus("Iframe found");

  // Create and style the red button
  const redButton = document.createElement('button');
  redButton.innerText = "Get command line to download";
  redButton.style.backgroundColor = '#E50814';
  redButton.style.color = 'white';
  redButton.style.padding = '10px 20px';
  redButton.style.border = 'none';
  redButton.style.borderRadius = '5px';
  redButton.style.cursor = 'pointer';
  redButton.style.display = 'block';
  redButton.style.margin = '10px auto';
  redButton.style.width = 'auto';
  redButton.style.minWidth = '250px';
  redButton.style.fontSize = '14px';
  redButton.style.fontWeight = 'bold';

  // Add click event listener to the button
  redButton.addEventListener('click', async () => {
    const pageTitle = document.title.trim();
    const movieName = prompt("Movie name", pageTitle) || pageTitle;
    const escapedMovieName = movieName.replace(/"/g, '\\"');
    
    updateDebugStatus("Extracting video URL from iframe...");
    
    try {
      // Try to access iframe content and extract real video URL
      const realVideoUrl = await extractRealVideoUrl(iframe);
      
      if (realVideoUrl) {
        const command = `yt-dlp -o "${escapedMovieName}.%(ext)s" "${realVideoUrl}"`;
        
        // Copy command to clipboard
        navigator.clipboard.writeText(command).then(() => {
          updateDebugStatus("Command copied to clipboard");
        }).catch(err => {
          updateDebugStatus("Failed to copy command");
          errorDebug("Clipboard error", err);
        });
      } else {
        // Fallback: use iframe URL with additional yt-dlp options
        const referer = `${SENPAI_ORIGIN.replace(/\/$/, "")}/`;
        const embedBase = `${SENPAI_ORIGIN.replace(/\/$/, "")}/embed/`;
        const fallbackCommand = `yt-dlp --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --referer "${referer}" --add-header "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" --add-header "Accept-Language: en-US,en;q=0.5" --add-header "Accept-Encoding: gzip, deflate" --add-header "DNT: 1" --add-header "Connection: keep-alive" --add-header "Upgrade-Insecure-Requests: 1" --extractor-args "generic:player_url=${embedBase}" -o "${escapedMovieName}.%(ext)s" "${iframe.src}"`;
        
        navigator.clipboard.writeText(fallbackCommand).then(() => {
          updateDebugStatus("Fallback command copied (try this first, then manual extraction if needed)");
        }).catch(err => {
          updateDebugStatus("Failed to copy fallback command");
          errorDebug("Clipboard error", err);
        });
      }
    } catch (error) {
      updateDebugStatus("Error extracting video URL");
      errorDebug("Error", error);
    }
  });

  // Try to insert the button right after the iframe in the DOM
  // If iframe has a parent, insert after iframe, otherwise append to body
  const iframeParent = iframe.parentElement;
  
  if (iframeParent && iframe.nextSibling) {
    // Insert after the iframe
    iframeParent.insertBefore(redButton, iframe.nextSibling);
    logDebug("Button inserted after iframe in parent", { timestamp: Date.now() });
  } else if (iframeParent) {
    // Append to parent if no next sibling
    iframeParent.appendChild(redButton);
    logDebug("Button appended to iframe parent", { timestamp: Date.now() });
  } else {
    // Fallback: calculate position based on iframe and use fixed positioning
    const iframeRect = iframe.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    
    redButton.style.position = 'absolute';
    redButton.style.top = `${iframeRect.bottom + scrollY + 10}px`;
    redButton.style.left = '50%';
    redButton.style.transform = 'translateX(-50%)';
    redButton.style.zIndex = '1001';
    
    document.body.appendChild(redButton);
    logDebug("Button positioned below iframe using fixed positioning", {
      top: redButton.style.top,
      timestamp: Date.now(),
    });
  }
  
  logDebug("Button appended successfully", { timestamp: Date.now() });
}

// Function to find iframe with multiple strategies
function findIframe() {
  // Strategy 1: Direct search by src containing domain/embed/
  let iframe = document.querySelector(`iframe[src*="${domain}/embed/"]`);
  if (iframe) {
    logDebug("Iframe found by src search", { src: iframe.src, timestamp: Date.now() });
    return iframe;
  }

  // Strategy 2: Check all iframes and see if any match
  const allIframes = document.querySelectorAll('iframe');
  logDebug("Checking all iframes", { count: allIframes.length, timestamp: Date.now() });
  
  for (const iframeEl of allIframes) {
    const src = iframeEl.src || iframeEl.getAttribute('src') || iframeEl.getAttribute('data-src') || '';
    logDebug("Iframe found", {
      src: src.substring(0, 100),
      hasSrc: !!iframeEl.src,
      hasDataSrc: !!iframeEl.getAttribute('data-src'),
      domainMatch: src.includes(domain),
      embedMatch: src.includes('/embed/'),
      timestamp: Date.now(),
    });
    
    // Check if it matches our criteria (domain and embed)
    if (src.includes(domain) && src.includes('/embed/')) {
      logDebug("Matching iframe found", { src: src.substring(0, 100), timestamp: Date.now() });
      return iframeEl;
    }
    
    // Also check if iframe exists but src is empty (might be set later)
    if (!src && iframeEl.id && iframeEl.id.includes('embed')) {
      logDebug("Potential embed iframe (empty src)", { id: iframeEl.id, timestamp: Date.now() });
    }
  }

  return null;
}

// Function to setup iframe observer with direct check first
function setupIframeObserver() {
  logDebug("setupIframeObserver called", { domain, timestamp: Date.now() });
  
  // Direct check before setting up the observer
  const iframe = findIframe();
  logDebug("Direct iframe check result", {
    iframeFound: !!iframe,
    iframeSrc: iframe?.src?.substring(0, 100),
    timestamp: Date.now(),
  });
  
  if (iframe) {
    logDebug("Iframe found immediately, creating button", { timestamp: Date.now() });
    createDownloadButton(iframe);
    return;
  }

  logDebug("Iframe not found, setting up observer and periodic check", { timestamp: Date.now() });
  
  let buttonCreated = false;
  
  // Function to check and create button if iframe found
  const checkAndCreateButton = () => {
    if (buttonCreated) return;
    
    const iframe = findIframe();
    if (iframe) {
      console.log('[SENPAI] Iframe found, creating button', { timestamp: Date.now() });
      buttonCreated = true;
      createDownloadButton(iframe);
      return true;
    }
    return false;
  };
  
  // Periodic check as fallback (every 100ms for first 2 seconds, then every 500ms)
  let checkCount = 0;
  const maxQuickChecks = 20; // 20 * 100ms = 2 seconds
  const periodicCheck = setInterval(() => {
    checkCount++;
    if (checkAndCreateButton()) {
      clearInterval(periodicCheck);
      iframeObserver.disconnect();
      return;
    }
    
    // After quick checks, slow down
    if (checkCount >= maxQuickChecks) {
      clearInterval(periodicCheck);
      // Continue with slower checks (every 500ms for 10 more seconds)
      const slowCheck = setInterval(() => {
        if (checkAndCreateButton()) {
          clearInterval(slowCheck);
          iframeObserver.disconnect();
        }
      }, 500);
      
      // Stop slow check after 10 seconds
      setTimeout(() => {
        clearInterval(slowCheck);
      }, 10000);
    }
  }, 100);
  
  // If iframe not found, set up observer to wait for it
  const iframeObserver = new MutationObserver((mutations, obs) => {
    logDebug("Observer triggered", { mutationsCount: mutations.length, timestamp: Date.now() });
    
    if (checkAndCreateButton()) {
      obs.disconnect();
      clearInterval(periodicCheck);
      logDebug("Observer disconnected", { timestamp: Date.now() });
    }
  });

  // Start observing the document for changes
  logDebug("Starting observer with periodic checks", { timestamp: Date.now() });
  iframeObserver.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
}

// Initialize iframe observer
logDebug("Script loaded, initializing iframe observer", {
  domain,
  documentReady: document.readyState,
  bodyExists: !!document.body,
  timestamp: Date.now(),
});
setupIframeObserver(); 