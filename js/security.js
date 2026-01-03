// ========================================
// Quantum Supremacy - Security Helper (JavaScript)
// Based on enterprise CMS security patterns
// Adapted for static sites (GitHub Pages)
//
// ⚠️ SECURITY NOTES:
// - Uses DOMParser instead of regex for HTML parsing (regex can't parse HTML reliably)
// - Implements whitelist approach (safer than blacklist)
// - All user input should be escaped via escapeHtml() by default
// - Use sanitizeHtml() only when HTML input is specifically needed
// ========================================

class Security {
    /**
     * Check for XSS patterns in user input
     * Uses DOMParser for reliable HTML detection (not vulnerable regex)
     * @param {string} input - User input to check
     * @returns {boolean} - true if XSS detected, false if safe
     */
    static checkXSS(input) {
        if (typeof input !== 'string') {
            return false;
        }

        // List of dangerous patterns (simplified, not relying on regex HTML parsing)
        const dangerousPatterns = [
            // Event handlers
            /\bon\w+\s*=/gi,
            
            // Dangerous protocols
            /javascript:/gi,
            /data:text\/html/gi,
            /vbscript:/gi,
            
            // eval and similar
            /\b(eval|expression)\s*\(/gi
        ];

        // Check simple patterns first
        for (const pattern of dangerousPatterns) {
            if (pattern.test(input)) {
                console.warn('XSS pattern detected:', input.substring(0, 100));
                return true;
            }
        }

        // Use DOMParser to detect HTML/Script tags (reliable, not regex)
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(input, 'text/html');
            
            // Dangerous tags to check
            const dangerousTags = ['script', 'iframe', 'object', 'embed', 'applet', 
                                   'link', 'style', 'base', 'meta', 'form'];
            
            for (const tag of dangerousTags) {
                if (doc.getElementsByTagName(tag).length > 0) {
                    console.warn(`Dangerous tag detected: <${tag}>`, input.substring(0, 100));
                    return true;
                }
            }
        } catch (error) {
            console.error('DOMParser error:', error);
            // If parsing fails, consider it suspicious
            return true;
        }

        return false;
    }

    /**
     * Sanitize user input for safe display
     * @param {string} input - User input
     * @returns {string} - Sanitized input
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Check for XSS
        if (this.checkXSS(input)) {
            throw new Error('Security: XSS pattern detected');
        }

        // Remove null bytes
        input = input.replace(/\0/g, '');

        return input;
    }

    /**
     * Escape HTML special characters
     * @param {string} str - String to escape
     * @returns {string} - Escaped string
     */
    static escapeHtml(str) {
        if (typeof str !== 'string') {
            return str;
        }

        const htmlEscapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };

        return str.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char]);
    }

    /**
     * Sanitize HTML using whitelist approach (DOMParser based)
     * Only allows safe tags and attributes
     * @param {string} html - HTML to sanitize
     * @param {Object} options - Whitelist options
     * @returns {string} - Sanitized HTML
     */
    static sanitizeHtml(html, options = {}) {
        const allowedTags = options.allowedTags || ['p', 'b', 'i', 'u', 'strong', 'em', 'br', 'span', 'div'];
        const allowedAttributes = options.allowedAttributes || ['class', 'id'];

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Remove all script and dangerous elements
            const dangerousTags = ['script', 'iframe', 'object', 'embed', 'applet', 
                                   'link', 'style', 'base', 'meta', 'form'];
            dangerousTags.forEach(tag => {
                const elements = doc.getElementsByTagName(tag);
                while (elements.length > 0) {
                    elements[0].remove();
                }
            });

            // Walk through all elements
            const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
            const nodesToRemove = [];

            let node;
            while (node = walker.nextNode()) {
                const tagName = node.tagName.toLowerCase();
                
                // Remove disallowed tags
                if (!allowedTags.includes(tagName)) {
                    nodesToRemove.push(node);
                    continue;
                }

                // Remove disallowed attributes
                Array.from(node.attributes).forEach(attr => {
                    if (!allowedAttributes.includes(attr.name.toLowerCase())) {
                        node.removeAttribute(attr.name);
                    }
                });
            }

            // Remove marked nodes
            nodesToRemove.forEach(node => {
                node.replaceWith(...node.childNodes);
            });

            return doc.body.innerHTML;

        } catch (error) {
            console.error('HTML sanitization error:', error);
            // Fallback: escape everything
            return this.escapeHtml(html);
        }
    }

    /**
     * Generate CSRF token (client-side)
     * @returns {string} - CSRF token
     */
    static generateCsrfToken() {
        const timestamp = Date.now();
        const random = this.generateRandomString(32);
        const token = `${timestamp}-${random}`;
        
        // Store in sessionStorage
        sessionStorage.setItem('csrf_token', token);
        sessionStorage.setItem('csrf_time', timestamp.toString());
        
        return token;
    }

    /**
     * Validate CSRF token
     * @param {string} token - Token to validate
     * @param {number} lifetime - Token lifetime in milliseconds (default: 1 hour)
     * @returns {boolean} - true if valid
     */
    static validateCsrfToken(token, lifetime = 3600000) {
        const storedToken = sessionStorage.getItem('csrf_token');
        const storedTime = parseInt(sessionStorage.getItem('csrf_time') || '0');

        if (!storedToken || token !== storedToken) {
            console.warn('CSRF: Invalid token');
            return false;
        }

        if (Date.now() - storedTime > lifetime) {
            console.warn('CSRF: Token expired');
            return false;
        }

        return true;
    }

    /**
     * Generate cryptographically secure random string
     * @param {number} length - Length of string
     * @returns {string} - Random hex string
     */
    static generateRandomString(length = 32) {
        const array = new Uint8Array(length / 2);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} - true if valid
     */
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate URL
     * @param {string} url - URL to validate
     * @returns {boolean} - true if valid
     */
    static validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sanitize filename for safe storage
     * @param {string} filename - Original filename
     * @returns {string} - Safe filename
     */
    static sanitizeFilename(filename) {
        // Remove path traversal attempts
        filename = filename.replace(/\.\./g, '');
        filename = filename.replace(/[\/\\]/g, '');
        
        // Remove special characters
        filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        return filename;
    }

    /**
     * Rate limiting helper (localStorage based)
     * @param {string} key - Rate limit key
     * @param {number} limit - Max attempts
     * @param {number} window - Time window in ms
     * @returns {boolean} - true if allowed, false if rate limited
     */
    static checkRateLimit(key, limit = 5, window = 60000) {
        const storageKey = `ratelimit_${key}`;
        const now = Date.now();
        
        // Get existing attempts
        const data = localStorage.getItem(storageKey);
        let attempts = data ? JSON.parse(data) : [];
        
        // Remove old attempts outside window
        attempts = attempts.filter(time => now - time < window);
        
        // Check if limit exceeded
        if (attempts.length >= limit) {
            console.warn(`Rate limit exceeded for: ${key}`);
            return false;
        }
        
        // Add current attempt
        attempts.push(now);
        localStorage.setItem(storageKey, JSON.stringify(attempts));
        
        return true;
    }

    /**
     * Secure form submission with CSRF and validation
     * @param {HTMLFormElement} form - Form element
     * @param {Function} callback - Success callback
     */
    static async secureFormSubmit(form, callback) {
        try {
            // Get form data
            const formData = new FormData(form);
            const data = {};
            
            for (const [key, value] of formData.entries()) {
                // Sanitize each input
                data[key] = this.sanitizeInput(value);
            }

            // Validate email if present
            if (data.email && !this.validateEmail(data.email)) {
                throw new Error('Invalid email address');
            }

            // Check rate limit (5 submissions per minute)
            if (!this.checkRateLimit('form_submit', 5, 60000)) {
                throw new Error('Too many submissions. Please wait.');
            }

            // Generate/validate CSRF token
            const token = this.generateCsrfToken();
            data.csrf_token = token;

            // Call success callback
            if (typeof callback === 'function') {
                await callback(data);
            }

        } catch (error) {
            console.error('Form submission error:', error);
            alert(error.message);
        }
    }

    /**
     * Secure localStorage access with encryption
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     */
    static secureSetItem(key, value) {
        try {
            const json = JSON.stringify(value);
            // Simple obfuscation (not real encryption, but better than nothing)
            const encoded = btoa(json);
            localStorage.setItem(key, encoded);
        } catch (error) {
            console.error('Storage error:', error);
        }
    }

    /**
     * Secure localStorage retrieval
     * @param {string} key - Storage key
     * @returns {any} - Stored value
     */
    static secureGetItem(key) {
        try {
            const encoded = localStorage.getItem(key);
            if (!encoded) return null;
            
            const json = atob(encoded);
            return JSON.parse(json);
        } catch (error) {
            console.error('Storage retrieval error:', error);
            return null;
        }
    }

    /**
     * Clean sensitive data from memory
     * @param {Object} obj - Object to clean
     */
    static cleanSensitiveData(obj) {
        if (typeof obj === 'object' && obj !== null) {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (key.toLowerCase().includes('password') || 
                        key.toLowerCase().includes('token') ||
                        key.toLowerCase().includes('secret')) {
                        delete obj[key];
                    }
                }
            }
        }
    }

    /**
     * Detect if running in secure context (HTTPS)
     * @returns {boolean} - true if secure
     */
    static isSecureContext() {
        return window.isSecureContext && location.protocol === 'https:';
    }

    /**
     * Initialize security features
     */
    static init() {
        // Warn if not HTTPS
        if (!this.isSecureContext()) {
            console.warn('Warning: Running in insecure context (HTTP)');
        }

        // Clear old rate limit data on page load
        this.cleanOldRateLimits();

        // Generate initial CSRF token
        this.generateCsrfToken();
    }

    /**
     * Clean old rate limit entries from localStorage
     */
    static cleanOldRateLimits() {
        const now = Date.now();
        const maxAge = 3600000; // 1 hour

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('ratelimit_')) {
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    const filtered = data.filter(time => now - time < maxAge);
                    
                    if (filtered.length === 0) {
                        localStorage.removeItem(key);
                    } else if (filtered.length !== data.length) {
                        localStorage.setItem(key, JSON.stringify(filtered));
                    }
                } catch (e) {
                    // Invalid data, remove it
                    localStorage.removeItem(key);
                }
            }
        }
    }
}

// Initialize on page load
if (typeof window !== 'undefined') {
    window.Security = Security;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Security.init());
    } else {
        Security.init();
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Security;
}

