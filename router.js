// ========================================
// Quantum Supremacy - SPA Router
// ========================================

class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.rootElement = document.getElementById('app');
        
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
            this.loadRoute(window.location.pathname);
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
        // Update browser history
        window.history.pushState({}, '', path);
        
        // Load the route
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
            // Show loading state
            this.showLoading();

            // Get content from handler
            const content = await handler();

            // Update content
            this.rootElement.innerHTML = content;

            // Initialize page scripts
            this.initializePageScripts();

            // Update active nav link
            this.updateActiveNav(path);

        } catch (error) {
            console.error('Error loading route:', error);
            this.rootElement.innerHTML = '<h1>Error loading page</h1>';
        }
    }

    /**
     * Show loading state
     */
    showLoading() {
        this.rootElement.innerHTML = `
            <div class="loading">
                <div class="loading__spinner"></div>
                <p>Loading...</p>
            </div>
        `;
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
        document.querySelectorAll('.nav__menu a').forEach(link => {
            link.classList.remove('active');
        });

        // Add active class to current link
        const activeLink = document.querySelector(`.nav__menu a[href="${path}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    /**
     * Start the router
     */
    start() {
        // Load initial route
        this.loadRoute(window.location.pathname);
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

