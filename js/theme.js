// ========================================
// Quantum Supremacy - Theme Support
// System dark/light mode detection
// ========================================

class ThemeManager {
    constructor() {
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        // Detect system theme preference
        this.detectSystemTheme();
        
        // Listen for system theme changes
        this.watchSystemTheme();
    }

    /**
     * Detect current system theme
     * @returns {string} 'light' or 'dark'
     */
    getCurrentTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    /**
     * Detect system theme on load
     */
    detectSystemTheme() {
        const theme = this.getCurrentTheme();
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
    }

    /**
     * Watch for system theme changes
     */
    watchSystemTheme() {
        if (window.matchMedia) {
            const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            // Modern browsers
            if (darkModeQuery.addEventListener) {
                darkModeQuery.addEventListener('change', (e) => {
                    const newTheme = e.matches ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', newTheme);
                    this.updateMetaThemeColor(newTheme);
                    console.log('System theme changed to:', newTheme);
                });
            } 
            // Legacy browsers
            else if (darkModeQuery.addListener) {
                darkModeQuery.addListener((e) => {
                    const newTheme = e.matches ? 'dark' : 'light';
                    document.documentElement.setAttribute('data-theme', newTheme);
                    this.updateMetaThemeColor(newTheme);
                    console.log('System theme changed to:', newTheme);
                });
            }
        }
    }

    /**
     * Update meta theme-color tag
     * @param {string} theme - 'light' or 'dark'
     */
    updateMetaThemeColor(theme) {
        const metaTags = document.querySelectorAll('meta[name="theme-color"]');
        
        // Remove existing theme-color meta tags
        metaTags.forEach(tag => tag.remove());
        
        // Add new theme-color meta tag based on current theme
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = theme === 'dark' ? '#1e293b' : '#ffffff';
        document.head.appendChild(meta);
    }

    /**
     * Check if browser supports dark mode
     * @returns {boolean}
     */
    static supportsDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').media !== 'not all';
    }

    /**
     * Get system color scheme preference
     * @returns {string} 'light', 'dark', or 'no-preference'
     */
    static getSystemColorScheme() {
        if (!this.supportsDarkMode()) {
            return 'no-preference';
        }
        
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        
        return 'no-preference';
    }
}

// Initialize theme manager on page load
if (typeof window !== 'undefined') {
    window.ThemeManager = ThemeManager;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.themeManager = new ThemeManager();
        });
    } else {
        window.themeManager = new ThemeManager();
    }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeManager;
}

