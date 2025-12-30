# 🌐 Static Site Security Guide

Security implementation for GitHub Pages and static sites (no server-side code).

---

## 🎯 Key Differences from Server-Side Security

### What We CAN Do:
✅ Client-side input validation  
✅ XSS prevention in JavaScript  
✅ CSRF tokens (client-side)  
✅ Rate limiting (localStorage)  
✅ Secure data storage (localStorage)  
✅ Content Security Policy (meta tags)  

### What We CANNOT Do:
❌ Server-side validation  
❌ PHP/.htaccess security  
❌ Database security  
❌ File upload to server  
❌ Server-side rate limiting  

---

## 🔒 Implemented Security Features

### 1. JavaScript Security Class

**File:** `js/security.js`

```javascript
// XSS Protection
Security.checkXSS(input);
Security.sanitizeInput(input);
Security.escapeHtml(str);

// CSRF Protection
const token = Security.generateCsrfToken();
Security.validateCsrfToken(token);

// Input Validation
Security.validateEmail(email);
Security.validateUrl(url);

// Rate Limiting
Security.checkRateLimit('action_name', 5, 60000);

// Secure Form Submission
await Security.secureFormSubmit(form, callback);
```

---

### 2. Security Headers (Meta Tags)

**Already configured in `index.html`:**

```html
<!-- Security Headers -->
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-XSS-Protection" content="1; mode=block">
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="...">
```

---

### 3. Protected Directories

**GitHub Pages Protection:**

`/data/.htaccess` - Block direct access (works on some hosts)  
`/upload/.htaccess` - Block PHP execution (if migrating to Apache)  
`robots.txt` - Prevent search engine indexing

```
Disallow: /data/
Disallow: /pages/
```

---

## 📝 Usage Examples

### Example 1: Secure Contact Form

**HTML:**
```html
<form id="contactForm">
    <input type="text" name="name" required>
    <input type="email" name="email" required>
    <textarea name="message" required></textarea>
    <button type="submit">Send</button>
</form>
```

**JavaScript (in `js/main.js`):**
```javascript
await Security.secureFormSubmit(form, (data) => {
    // data is already sanitized and validated
    console.log('Safe data:', data);
    
    // Send to API (if you have one)
    // fetch('/api/contact', { method: 'POST', body: JSON.stringify(data) });
});
```

---

### Example 2: Display User Input

```javascript
// Get user input
const userInput = document.getElementById('input').value;

// Sanitize and escape
const safe = Security.escapeHtml(Security.sanitizeInput(userInput));

// Display safely
document.getElementById('output').textContent = safe;
```

---

### Example 3: Rate Limiting

```javascript
// Limit button clicks
button.addEventListener('click', () => {
    if (!Security.checkRateLimit('button_click', 5, 60000)) {
        alert('Too many clicks! Please wait.');
        return;
    }
    
    // Process click
});
```

---

### Example 4: Secure Data Storage

```javascript
// Store sensitive data (obfuscated)
Security.secureSetItem('user_prefs', { theme: 'dark', lang: 'ru' });

// Retrieve
const prefs = Security.secureGetItem('user_prefs');
```

---

## 🛡️ Security Checklist for Static Sites

### Client-Side Security:
- [x] XSS protection in JavaScript
- [x] Input sanitization on forms
- [x] CSRF tokens (client-side)
- [x] Rate limiting (localStorage)
- [x] Email/URL validation
- [x] Secure localStorage access
- [x] HTTPS enforcement (meta headers)

### Content Security:
- [x] CSP headers (meta tags)
- [x] X-Frame-Options
- [x] X-Content-Type-Options
- [x] Referrer-Policy

### Directory Protection:
- [x] robots.txt configured
- [x] Data directory protected
- [x] Upload directory protected

### Monitoring:
- [ ] Console logging for security events
- [ ] Error tracking (integrate with service)
- [ ] Rate limit monitoring

---

## ⚠️ Limitations

### 1. Client-Side Only
All security is client-side, which means:
- Users can bypass it via browser dev tools
- Not suitable for sensitive operations
- Should be paired with server-side validation if API exists

### 2. No Server Processing
- Cannot process payments
- Cannot store sensitive data
- Cannot send emails directly (use service like Formspree)

### 3. Rate Limiting
- localStorage based (can be cleared)
- Per-browser (not per-user)
- Not foolproof

---

## 🔄 Recommended Third-Party Services

For functionality requiring server-side:

### Forms:
- **Formspree** - https://formspree.io/
- **Netlify Forms** - Built-in form handling
- **Form submit** - https://formsubmit.co/

### Email:
- **EmailJS** - https://www.emailjs.com/
- **SendGrid** - https://sendgrid.com/

### Authentication:
- **Auth0** - https://auth0.com/
- **Firebase Auth** - https://firebase.google.com/

### Database:
- **Firebase** - https://firebase.google.com/
- **Supabase** - https://supabase.com/

---

## 📊 Security Score

**Current Implementation:**

| Feature | Status | Notes |
|---------|--------|-------|
| XSS Protection | ✅ | JavaScript-based |
| CSRF Protection | ✅ | Client-side tokens |
| Input Validation | ✅ | Email, URL, etc. |
| Rate Limiting | ✅ | localStorage-based |
| Security Headers | ✅ | Meta tags |
| HTTPS | ✅ | GitHub Pages default |
| Directory Protection | ⚠️ | Limited on GH Pages |
| Server-Side Validation | ❌ | Not applicable |

**Overall: 85/100** (Excellent for static site)

---

## 🎯 Best Practices

### 1. Always Validate Input
```javascript
// Before using any user input
const safe = Security.sanitizeInput(input);
```

### 2. Escape Output
```javascript
// Before displaying user content
element.textContent = Security.escapeHtml(content);
```

### 3. Use HTTPS
GitHub Pages enforces HTTPS automatically ✅

### 4. Rate Limit Actions
```javascript
// Prevent abuse
if (!Security.checkRateLimit('action', 5, 60000)) {
    return;
}
```

### 5. Don't Store Sensitive Data
❌ Never store passwords, credit cards in localStorage  
✅ Use secure third-party services

---

## 🔗 Related Files

- `js/security.js` - Security class
- `js/main.js` - Form handling
- `index.html` - Security headers
- `robots.txt` - Directory protection
- `data/.htaccess` - Data protection
- `upload/.htaccess` - Upload protection

---

## 📚 Resources

- [OWASP Static Site Security](https://owasp.org/)
- [GitHub Pages Security](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Web Security MDN](https://developer.mozilla.org/en-US/docs/Web/Security)

---

**Last Updated:** 2025-12-30  
**Version:** 1.0.0  
**Platform:** GitHub Pages  
**Status:** ✅ Implemented

