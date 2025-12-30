# 🔒 Security Configuration Guide

Comprehensive security setup for Quantum Supremacy project.

---

## 📋 Table of Contents

- [Overview](#overview)
- [GitHub Security Features](#github-security-features)
- [Security Headers](#security-headers)
- [Security Files](#security-files)
- [Best Practices](#best-practices)
- [Monitoring](#monitoring)
- [Incident Response](#incident-response)

---

## 🛡️ Overview

This project implements multiple layers of security:

1. **GitHub Repository Security** - Dependabot, CodeQL, branch protection
2. **HTTP Security Headers** - CSP, X-Frame-Options, HSTS
3. **Security Policies** - security.txt, SECURITY.md
4. **Automated Scanning** - Vulnerability detection, dependency review
5. **Secure Development** - Code review, security workflows

---

## 🔧 GitHub Security Features

### 1. Dependabot

**Location:** `.github/dependabot.yml`

**Features:**
- Automatic dependency updates
- Security vulnerability alerts
- Weekly schedule for checks
- Supports GitHub Actions and NPM

**Configuration:**
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    schedule:
      interval: "weekly"
  - package-ecosystem: "npm"
    schedule:
      interval: "weekly"
```

**How to Enable:**
1. Go to: `Settings` → `Security & analysis`
2. Enable `Dependabot alerts`
3. Enable `Dependabot security updates`

---

### 2. CodeQL Analysis

**Location:** `.github/workflows/codeql.yml`

**Features:**
- Static code analysis
- Security vulnerability detection
- JavaScript/TypeScript scanning
- Security-extended queries

**Runs:**
- On every push to main
- On every pull request
- Weekly scheduled scan (Monday)

**How to Enable:**
1. Go to: `Security` → `Code scanning`
2. Click `Set up` → `CodeQL Analysis`
3. Workflow will run automatically

---

### 3. Security Scanning

**Location:** `.github/workflows/security.yml`

**Features:**
- Trivy vulnerability scanner
- Filesystem scanning
- Dependency review
- SARIF results upload

**Runs:**
- On every push to main
- On every pull request
- Weekly scheduled scan (Sunday)

---

### 4. Branch Protection Rules

**Recommended Settings:**

Navigate to: `Settings` → `Branches` → `Add rule`

**Main branch protection:**
- ✅ Require pull request before merging
- ✅ Require approvals (1+)
- ✅ Require status checks to pass
- ✅ Require conversation resolution
- ✅ Require signed commits (optional)
- ✅ Include administrators
- ✅ Restrict who can push

---

### 5. Secret Scanning

**How to Enable:**
1. Go to: `Settings` → `Security & analysis`
2. Enable `Secret scanning`
3. Enable `Push protection`

**What it does:**
- Detects API keys, tokens, passwords
- Prevents accidental commits of secrets
- Alerts on detected secrets

---

## 🔐 Security Headers

### Implementation

**For GitHub Pages:**
Headers are added via meta tags in `index.html`

**For Netlify/Vercel:**
Use `_headers` file (included in project)

---

### Header Descriptions

#### 1. **X-Frame-Options: DENY**
```html
<meta http-equiv="X-Frame-Options" content="DENY">
```
**Purpose:** Prevents clickjacking attacks  
**Effect:** Site cannot be embedded in frames/iframes

---

#### 2. **X-Content-Type-Options: nosniff**
```html
<meta http-equiv="X-Content-Type-Options" content="nosniff">
```
**Purpose:** Prevents MIME type sniffing  
**Effect:** Browsers must respect declared content types

---

#### 3. **X-XSS-Protection: 1; mode=block**
```html
<meta http-equiv="X-XSS-Protection" content="1; mode=block">
```
**Purpose:** Enables XSS filter in older browsers  
**Effect:** Blocks detected XSS attacks

---

#### 4. **Referrer-Policy**
```html
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
```
**Purpose:** Controls referrer information  
**Effect:** Only sends origin on HTTPS→HTTP

---

#### 5. **Content Security Policy (CSP)**
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' data:;
  connect-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
">
```

**Breakdown:**
- `default-src 'self'` - Only load resources from same origin
- `script-src 'self' 'unsafe-inline'` - Scripts from same origin + inline
- `style-src 'self' 'unsafe-inline'` - Styles from same origin + inline
- `img-src 'self' data: https:` - Images from same origin, data URIs, HTTPS
- `font-src 'self' data:` - Fonts from same origin, data URIs
- `connect-src 'self'` - AJAX/WebSocket to same origin only
- `frame-ancestors 'none'` - Cannot be framed
- `base-uri 'self'` - Restrict base tag URLs
- `form-action 'self'` - Forms submit to same origin only

**Note:** `unsafe-inline` is needed for inline styles/scripts. For better security, move all inline code to external files.

---

#### 6. **Permissions Policy**
```
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
```
**Purpose:** Restrict browser features  
**Effect:** Disables unnecessary APIs

---

#### 7. **Strict-Transport-Security (HSTS)**
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
**Purpose:** Force HTTPS connections  
**Effect:** Browsers remember to use HTTPS for 1 year  
**Note:** GitHub Pages automatically provides HTTPS

---

## 📄 Security Files

### 1. security.txt

**Location:** `/.well-known/security.txt` and `/security.txt`

**Standard:** [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)

**Purpose:** Provide security contact information

**Contents:**
```
Contact: https://github.com/El-max-git/quantum_supremacy/security/advisories/new
Preferred-Languages: en, ru
Canonical: https://el-max-git.github.io/quantum_supremacy/.well-known/security.txt
Policy: https://github.com/El-max-git/quantum_supremacy/blob/main/SECURITY.md
```

**How to Use:**
Security researchers can find contact info at:
- `https://el-max-git.github.io/quantum_supremacy/.well-known/security.txt`

---

### 2. SECURITY.md

**Location:** `/SECURITY.md`

**Purpose:** Security policy and vulnerability reporting

**Contains:**
- Supported versions
- How to report vulnerabilities
- Security best practices
- Response timeline

---

### 3. robots.txt

**Location:** `/robots.txt`

**Security Additions:**
```
# Don't crawl sensitive directories
Disallow: /node_modules/
Disallow: /.git/
Disallow: /.github/
```

---

## 🛠️ Best Practices

### Code Security

#### 1. **No Secrets in Code**
❌ **Never commit:**
- API keys
- Passwords
- Access tokens
- Private keys
- Database credentials

✅ **Use:**
- Environment variables
- GitHub Secrets (for Actions)
- `.env` files (in `.gitignore`)

---

#### 2. **Input Validation**
```javascript
// Always validate user input
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Sanitize before using
function sanitizeInput(input) {
  return input.replace(/[<>]/g, '');
}
```

---

#### 3. **Avoid eval() and innerHTML**
```javascript
// ❌ Dangerous
eval(userInput);
element.innerHTML = userInput;

// ✅ Safe
element.textContent = userInput;
element.setAttribute('data-value', userInput);
```

---

#### 4. **Use HTTPS for External Resources**
```html
<!-- ❌ Insecure -->
<script src="http://example.com/script.js"></script>

<!-- ✅ Secure -->
<script src="https://example.com/script.js"></script>
```

---

#### 5. **Subresource Integrity (SRI)**
```html
<!-- When using CDN resources -->
<script 
  src="https://cdn.example.com/library.js"
  integrity="sha384-hash..."
  crossorigin="anonymous">
</script>
```

---

### GitHub Repository Security

#### 1. **Enable All Security Features**
- [x] Dependabot alerts
- [x] Dependabot security updates
- [x] Code scanning (CodeQL)
- [x] Secret scanning
- [x] Push protection

#### 2. **Review Permissions**
- Limit collaborator access
- Use teams for organization
- Enable two-factor authentication (2FA)

#### 3. **Signed Commits**
```bash
# Configure GPG signing
git config --global commit.gpgsign true
git config --global user.signingkey YOUR_KEY_ID
```

---

### Deployment Security

#### 1. **Environment Variables**
Never hardcode secrets. Use GitHub Secrets:

```yaml
# In GitHub Actions
- name: Deploy
  env:
    API_KEY: ${{ secrets.API_KEY }}
```

#### 2. **Minimize Exposed Information**
- Remove debug logs in production
- Don't expose stack traces
- Hide version numbers

#### 3. **Regular Updates**
- Keep dependencies updated
- Review Dependabot PRs
- Monitor security advisories

---

## 📊 Monitoring

### 1. **GitHub Security Advisories**

**Location:** `Security` tab → `Advisories`

**Check for:**
- Vulnerable dependencies
- Security alerts
- Dependabot PRs

---

### 2. **Code Scanning Alerts**

**Location:** `Security` tab → `Code scanning`

**Review:**
- CodeQL findings
- Security vulnerabilities
- Code quality issues

---

### 3. **Dependency Graph**

**Location:** `Insights` tab → `Dependency graph`

**Shows:**
- All dependencies
- Dependents
- Vulnerabilities

---

## 🚨 Incident Response

### If You Discover a Vulnerability

#### 1. **Assess Severity**
- Critical: Immediate access to sensitive data
- High: Potential for significant harm
- Medium: Limited impact
- Low: Minimal risk

#### 2. **Create Private Security Advisory**
1. Go to: `Security` → `Advisories`
2. Click `New draft security advisory`
3. Fill in details
4. Request CVE (optional)

#### 3. **Fix the Issue**
- Create private fork
- Develop fix
- Test thoroughly
- Review with team

#### 4. **Disclose Responsibly**
- Notify affected users
- Publish advisory
- Update SECURITY.md
- Document in CHANGELOG.md

---

### If Someone Reports a Vulnerability

#### 1. **Acknowledge Receipt** (within 48 hours)
- Thank the reporter
- Confirm you're investigating
- Provide timeline

#### 2. **Investigate** (within 5 days)
- Reproduce the issue
- Assess impact
- Determine severity

#### 3. **Develop Fix** (within 30 days for critical)
- Create patch
- Test thoroughly
- Prepare advisory

#### 4. **Coordinate Disclosure**
- Agree on timeline with reporter
- Prepare public statement
- Update affected users

---

## 🔍 Security Checklist

### Repository Setup
- [x] Dependabot enabled
- [x] CodeQL analysis configured
- [x] Secret scanning enabled
- [x] Branch protection rules set
- [x] Security policy (SECURITY.md) created
- [x] security.txt file created

### Code Security
- [x] Security headers implemented
- [x] CSP configured
- [x] Input validation added
- [x] No secrets in code
- [x] HTTPS enforced

### Monitoring
- [ ] Review security alerts weekly
- [ ] Check Dependabot PRs
- [ ] Monitor code scanning results
- [ ] Audit dependencies regularly

### Best Practices
- [ ] Enable 2FA on GitHub account
- [ ] Use signed commits (recommended)
- [ ] Review before merging PRs
- [ ] Keep dependencies updated

---

## 📚 Resources

### Official Documentation
- [GitHub Security Features](https://docs.github.com/en/code-security)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

### Tools
- [Mozilla Observatory](https://observatory.mozilla.org/) - Test security
- [Security Headers](https://securityheaders.com/) - Check headers
- [Snyk](https://snyk.io/) - Dependency scanning

### Learning
- [Web Security Academy](https://portswigger.net/web-security)
- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)

---

## 📝 Notes

- GitHub Pages automatically provides HTTPS
- Custom headers work best on Netlify/Vercel
- Keep this guide updated with new security measures
- Review and update security configurations quarterly

---

**Last Updated:** 2025-12-30  
**Version:** 1.0.0  
**Status:** ✅ Fully Configured

