// ========================================
// Quantum Supremacy - SPA Router
// ========================================

class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.rootElement = document.getElementById('app');
        
        // Detect base path for GitHub Pages
        this.basePath = window.location.hostname.includes('github.io') 
            ? '/quantum_supremacy' 
            : '';
        
        // Handle initial redirect from 404.html
        this.handleInitialRedirect();
        
        // Setup event listeners
        this.setupListeners();
    }

    /**
     * Register a route
     * @param {string} path - Route path (e.g., '/', '/about', '/contact')
     * @param {Function} handler - Function that returns HTML or loads component
     */
    addRoute(path, handler) {
        this.routes[path] = handler;
    }

    /**
     * Handle initial redirect from 404.html
     */
    handleInitialRedirect() {
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        
        if (redirect) {
            // Remove redirect param and update history
            const cleanPath = '/' + redirect;
            window.history.replaceState({}, '', cleanPath);
        }
    }

    /**
     * Setup event listeners for navigation
     */
    setupListeners() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            let pathname = window.location.pathname;
            if (this.basePath && pathname.startsWith(this.basePath)) {
                pathname = pathname.substring(this.basePath.length) || '/';
            }
            this.loadRoute(pathname);
        });

        // Handle link clicks
        document.addEventListener('click', (e) => {
            // Find closest anchor tag
            const link = e.target.closest('a[data-link]');
            
            if (link) {
                e.preventDefault();
                const path = link.getAttribute('href');
                this.navigate(path);
            }
        });
    }

    /**
     * Navigate to a route
     * @param {string} path - Route path
     */
    navigate(path) {
        // Add base path if needed
        const fullPath = this.basePath + path;
        
        // Update browser history
        window.history.pushState({}, '', fullPath);
        
        // Load the route (without base path)
        this.loadRoute(path);
        
        // Scroll to top
        window.scrollTo(0, 0);
    }

    /**
     * Load a route
     * @param {string} path - Route path
     */
    async loadRoute(path) {
        // Find matching route
        let handler = this.routes[path];
        
        // If no exact match, try 404
        if (!handler) {
            handler = this.routes['/404'] || (() => '<h1>404 - Page Not Found</h1>');
        }

        this.currentRoute = path;

        try {
            // Add loading class to prevent flash
            this.rootElement.style.opacity = '0';
            this.rootElement.style.transition = 'opacity 0.2s ease';

            // Get content from handler
            const content = await handler();

            // Update content while hidden
            this.rootElement.innerHTML = content;

            // Execute scripts in the loaded content
            this.executeScripts();

            // Initialize page scripts
            this.initializePageScripts();

            // Update active nav link
            this.updateActiveNav(path);

            // Show content with fade-in
            requestAnimationFrame(() => {
                this.rootElement.style.opacity = '1';
            });

        } catch (error) {
            console.error('Error loading route:', error);
            this.rootElement.innerHTML = '<h1>Error loading page</h1>';
            this.rootElement.style.opacity = '1';
        }
    }

    /**
     * Execute scripts from loaded HTML content
     */
    executeScripts() {
        const scripts = this.rootElement.querySelectorAll('script');
        scripts.forEach(oldScript => {
            const newScript = document.createElement('script');
            
            // Copy attributes
            Array.from(oldScript.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy content
            if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
            }
            
            // Replace old script with new one (this executes it)
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    /**
     * Initialize page-specific scripts
     */
    initializePageScripts() {
        // Reinitialize form handlers, animations, etc.
        if (typeof initializePageComponents === 'function') {
            initializePageComponents();
        }
    }

    /**
     * Update active navigation link
     * @param {string} path - Current path
     */
    updateActiveNav(path) {
        // Remove active class from all links
        document.querySelectorAll('nav a').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to current link
        const activeLink = document.querySelector(`nav a[href="${path}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    /**
     * Start the router
     */
    start() {
        // Get current pathname and remove base path if present
        let pathname = window.location.pathname;
        if (this.basePath && pathname.startsWith(this.basePath)) {
            pathname = pathname.substring(this.basePath.length) || '/';
        }
        
        // Load initial route
        this.loadRoute(pathname);
    }
}

// ========================================
// Page Loaders
// ========================================

/**
 * Load page from file
 * @param {string} pagePath - Path to page file
 */
async function loadPage(pagePath) {
    try {
        const response = await fetch(pagePath);
        if (!response.ok) throw new Error('Page not found');
        return await response.text();
    } catch (error) {
        console.error('Error loading page:', error);
        return '<h1>Error loading page content</h1>';
    }
}

// ========================================
// Export Router
// ========================================

// Make router available globally
window.Router = Router;
window.loadPage = loadPage;

