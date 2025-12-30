# 🔀 Router Configuration Guide

Complete guide to the SPA Router implementation for Quantum Supremacy.

---

## 📋 Overview

This project uses a **client-side router** for Single Page Application (SPA) navigation, allowing seamless page transitions without full page reloads.

### Key Features:
- ✅ Client-side routing (no server required)
- ✅ GitHub Pages compatible
- ✅ Browser back/forward support
- ✅ Clean URLs (no hash)
- ✅ Dynamic page loading
- ✅ Protected data directories

---

## 🏗️ Architecture

### Directory Structure

```
quantum_supremacy/
├── index.html              # Main router file (entry point)
├── router.js               # Router logic
├── 404.html                # GitHub Pages redirect handler
├── pages/                  # Page components (protected from direct access)
│   ├── home.html
│   ├── about.html
│   ├── technology.html
│   ├── contact.html
│   └── 404.html
├── data/                   # Protected data (not accessible directly)
│   ├── .htaccess          # Access protection
│   └── config.json        # Configuration data
├── css/                    # Styles
├── js/                     # Scripts
└── assets/                 # Public assets
```

---

## ⚙️ How It Works

### 1. GitHub Pages Redirect Trick

When a user visits a non-root path (e.g., `/about`):

1. GitHub Pages shows **404.html**
2. 404.html redirects to `/?redirect=/about`
3. index.html reads the redirect parameter
4. Router loads the correct page

**File:** `404.html`
```html
<script>
  const path = window.location.pathname.slice(1);
  if (path) {
    window.location.replace(
      window.location.origin + '/?redirect=' + encodeURIComponent(path)
    );
  }
</script>
```

---

### 2. Router Class

**File:** `router.js`

#### Key Methods:

**`addRoute(path, handler)`**
- Registers a route with its handler
- Handler returns HTML content or Promise

**`navigate(path)`**
- Programmatically navigate to a route
- Updates browser history
- Loads new content

**`loadRoute(path)`**
- Loads content for a path
- Shows loading state
- Handles errors

**Example Usage:**
```javascript
const router = new Router();

// Register routes
router.addRoute('/', () => loadPage('pages/home.html'));
router.addRoute('/about', () => loadPage('pages/about.html'));

// Navigate programmatically
router.navigate('/about');

// Start router
router.start();
```

---

### 3. Page Loading

Pages are loaded dynamically from the `/pages` directory.

**Function:** `loadPage(pagePath)`
```javascript
async function loadPage(pagePath) {
  try {
    const response = await fetch(pagePath);
    if (!response.ok) throw new Error('Page not found');
    return await response.text();
  } catch (error) {
    return '<h1>Error loading page</h1>';
  }
}
```

---

## 🔗 Navigation

### HTML Links

Use `data-link` attribute for router-handled links:

```html
<!-- Router-handled link (no page reload) -->
<a href="/about" data-link>About</a>

<!-- Regular link (page reload) -->
<a href="https://external.com">External</a>
```

### Programmatic Navigation

```javascript
// Navigate to a route
router.navigate('/about');

// Go back
window.history.back();

// Go to home
router.navigate('/');
```

---

## 📄 Creating New Pages

### Step 1: Create Page File

Create `pages/yourpage.html`:

```html
<section class="your-section">
    <div class="container">
        <h2>Your Page Title</h2>
        <p>Your content here...</p>
    </div>
</section>
```

### Step 2: Register Route

In `index.html`, add route:

```javascript
router.addRoute('/yourpage', () => loadPage('pages/yourpage.html'));
```

### Step 3: Add Navigation Link

In navigation menu:

```html
<li><a href="/yourpage" data-link>Your Page</a></li>
```

### Step 4: Test

Visit: `http://localhost:8000/yourpage`

---

## 🔒 Data Protection

### Protected Directories

The following directories are protected from direct access:

**`/data/`** - Configuration and sensitive data  
**`/pages/`** - Page components (loaded by router only)

### Protection Methods:

#### 1. robots.txt
```
Disallow: /data/
Disallow: /pages/
```
Prevents search engines from indexing.

#### 2. .htaccess (for Apache servers)
```apache
Order Deny,Allow
Deny from all
```
Blocks direct HTTP access.

#### 3. GitHub Pages
- Pages are loaded via JavaScript fetch
- Direct access returns 404 → redirects to router
- Content only accessible through router

---

## 🎨 Styling Pages

### Page-Specific Styles

Add to `css/style.css`:

```css
/* Your Page Styles */
.your-section {
    padding: 6rem 0;
}

.your-section h2 {
    color: var(--dark-color);
    margin-bottom: 2rem;
}
```

### Use Existing Components

Reuse existing CSS classes:

```html
<section class="about">  <!-- Reuse 'about' section styles -->
    <div class="container">
        <h2 class="section__title">Title</h2>
        <div class="about__grid">
            <div class="about__card">
                <!-- Card content -->
            </div>
        </div>
    </div>
</section>
```

---

## 🔧 Page Initialization

### Initialize Components on Load

When a page loads, you may need to:
- Attach event listeners
- Initialize animations
- Setup forms

**In `js/main.js`:**

```javascript
function initializePageComponents() {
    initMobileMenu();
    initContactForm();
    initScrollAnimations();
}

// Called automatically by router after loading page
```

**Router calls this automatically:**
```javascript
// In router.js
this.rootElement.innerHTML = content;
this.initializePageScripts(); // ← Calls initializePageComponents
```

---

## 📊 Active Navigation State

The router automatically highlights the active link:

```javascript
updateActiveNav(path) {
    document.querySelectorAll('.nav__menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`.nav__menu a[href="${path}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}
```

**CSS:**
```css
.nav__menu a.active {
    color: var(--primary-color);
    font-weight: 600;
}
```

---

## 🚀 Advanced Features

### 1. Dynamic Routes

Support for URL parameters:

```javascript
// Route with parameter
router.addRoute('/blog/:id', async (params) => {
    const blogId = params.id;
    return loadBlogPost(blogId);
});
```

### 2. Route Guards

Protect routes with authentication:

```javascript
router.addRoute('/admin', () => {
    if (!isAuthenticated()) {
        router.navigate('/login');
        return;
    }
    return loadPage('pages/admin.html');
});
```

### 3. Lazy Loading

Load pages only when needed:

```javascript
router.addRoute('/heavy-page', async () => {
    const module = await import('./pages/heavy-module.js');
    return module.render();
});
```

### 4. Transitions

Add page transitions:

```css
#app {
    animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
```

---

## 🐛 Troubleshooting

### Issue: Direct links don't work

**Problem:** Visiting `/about` directly shows 404

**Solution:** 
- Ensure `404.html` is in root
- Check GitHub Pages is enabled
- Verify redirect script in 404.html

---

### Issue: Pages not loading

**Problem:** Fetch fails, blank page

**Solution:**
```javascript
// Check browser console for errors
// Verify page file exists: pages/yourpage.html
// Check file path is correct
```

---

### Issue: Navigation doesn't update

**Problem:** Clicking links reloads page

**Solution:**
```html
<!-- Add data-link attribute -->
<a href="/about" data-link>About</a>
```

---

### Issue: Styles not applying

**Problem:** New page has no styles

**Solution:**
```html
<!-- Use existing CSS classes -->
<section class="about">
    <div class="container">
        <!-- Content -->
    </div>
</section>
```

---

## 📝 Best Practices

### 1. Consistent Structure

All pages should follow the same structure:

```html
<section class="section-name">
    <div class="container">
        <h2 class="section__title">Title</h2>
        <!-- Content -->
    </div>
</section>
```

### 2. Semantic HTML

Use semantic elements:

```html
<article>  <!-- For blog posts -->
<aside>    <!-- For sidebars -->
<nav>      <!-- For navigation -->
<section>  <!-- For page sections -->
```

### 3. Accessibility

```html
<!-- Add ARIA labels -->
<button aria-label="Close menu">×</button>

<!-- Use semantic links -->
<a href="/about" data-link>About</a>

<!-- Alt text for images -->
<img src="photo.jpg" alt="Description">
```

### 4. Error Handling

```javascript
router.addRoute('/your-page', async () => {
    try {
        return await loadPage('pages/your-page.html');
    } catch (error) {
        console.error('Error:', error);
        return '<h1>Error loading page</h1>';
    }
});
```

---

## 🔗 Related Files

- **index.html** - Main router entry point
- **router.js** - Router implementation
- **404.html** - Redirect handler
- **js/main.js** - Page initialization
- **css/style.css** - Styles
- **pages/** - Page components

---

## 📚 Further Reading

- [History API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- [Single Page Applications](https://en.wikipedia.org/wiki/Single-page_application)
- [GitHub Pages Docs](https://docs.github.com/en/pages)

---

**Last Updated:** 2025-12-30  
**Version:** 1.0.0  
**Status:** ✅ Fully Implemented

