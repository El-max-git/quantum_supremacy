# 🤖 AI Agent Security Configuration Guide

Complete security guide for AI-powered development projects based on enterprise CMS best practices.

---

## 📋 Overview

This guide provides comprehensive security configuration patterns learned from enterprise-level CMS systems (SITE_CMS) adapted for modern web applications.

### Core Security Principles:
1. **Defense in Depth** - Multiple layers of security
2. **Principle of Least Privilege** - Minimal access rights
3. **Input Validation** - Never trust user data
4. **Output Encoding** - Prevent XSS attacks
5. **CSRF Protection** - Protect against cross-site requests

---

## 🔒 Multi-Layer .htaccess Protection

### Layer 1: Root .htaccess (Main Protection)

**File:** `/.htaccess`

```apache
# ========================================
# Core Security Configuration
# ========================================

Options +FollowSymlinks
AddDefaultCharset UTF-8

# ========================================
# Protect .htaccess itself
# ========================================

<Files .htaccess>
    <IfModule !mod_authz_core.c>
        Order deny,allow
        Deny from all
    </IfModule>
    <IfModule mod_authz_core.c>
        Require all denied
    </IfModule>
</Files>

# ========================================
# PHP Security Settings
# ========================================

<IfModule mod_php7.c>
    # Disable dangerous PHP settings
    php_flag magic_quotes_gpc off
    php_flag magic_quotes_runtime off
    php_flag register_globals off
    
    # Security flags
    php_flag expose_php Off
    php_flag display_errors Off
    
    # Session security
    php_value session.cookie_httponly 1
    php_value session.cookie_secure 1
    php_value session.use_only_cookies 1
    
    # Disable dangerous functions
    php_value disable_functions "exec,passthru,shell_exec,system,proc_open,popen,curl_exec,curl_multi_exec,parse_ini_file,show_source"
</IfModule>

# ========================================
# Block Dangerous HTTP Methods
# ========================================

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    
    # Block TRACE, TRACK, DEBUG methods (security risk)
    RewriteCond %{REQUEST_METHOD} ^(DEBUG|TRACE|TRACK) [NC]
    RewriteRule ^(.*)$ - [F,L]
    
    # Block access to sensitive files
    RewriteRule ^\.git - [F,L]
    RewriteRule ^\.env - [F,L]
    RewriteRule ^composer\.(json|lock)$ - [F,L]
    RewriteRule ^package(-lock)?\.json$ - [F,L]
    
    # SPA Router (if needed)
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ /index.php [L,QSA]
</IfModule>

# ========================================
# Directory Index
# ========================================

<IfModule mod_dir.c>
    DirectoryIndex index.php index.html
</IfModule>

# Prevent directory listing
Options -Indexes

# ========================================
# Performance & Caching
# ========================================

<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/x-icon "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/webp "access plus 1 month"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType text/javascript "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType font/woff2 "access plus 1 month"
</IfModule>

<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/css text/javascript application/javascript application/x-javascript text/html
    <IfModule mod_setenvif.c>
        BrowserMatch ^Mozilla/4 gzip-only-text/html
        BrowserMatch ^Mozilla/4\.0[678] no-gzip
        BrowserMatch \bMSIE !no-gzip !gzip-only-text/html
    </IfModule>
</IfModule>
```

---

### Layer 2: Protected Directories

**Pattern:** Create `.htaccess` in sensitive directories

#### Example: `/data/.htaccess`

```apache
# Block ALL access to data directory
<IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
</IfModule>
<IfModule mod_authz_core.c>
    Require all denied
</IfModule>
```

#### Example: `/upload/.htaccess` (partial access)

```apache
# Block PHP execution but allow file access
Options -Indexes
<FilesMatch "\.(php|php3|php4|php5|phtml|inc)$">
    <IfModule !mod_authz_core.c>
        Order deny,allow
        Deny from all
    </IfModule>
    <IfModule mod_authz_core.c>
        Require all denied
    </IfModule>
</FilesMatch>
```

#### Example: `/cron/.htaccess` (complete block)

```apache
# Block access to cron scripts from web
<IfModule !mod_authz_core.c>
    Order deny,allow
    Deny from all
</IfModule>
<IfModule mod_authz_core.c>
    Require all denied
</IfModule>
```

---

## 🛡️ XSS Protection Class

**File:** `modules/core/security.php`

```php
<?php
/**
 * Security Helper - XSS Protection & CSRF Tokens
 */
class Core_Security
{
    /**
     * Check for XSS attacks
     * @param string $string User input to check
     * @return boolean TRUE if XSS detected, FALSE if safe
     */
    static public function checkXSS($string)
    {
        if (!is_string($string))
        {
            return FALSE;
        }

        // Step 1: Decode double encoding
        // Attackers may use %253C instead of <
        $decoded = preg_replace('/%25([0-9a-f]{2})/i', '%$1', $string);
        
        // Step 2: URL decode
        $decoded = rawurldecode($decoded);
        
        // Step 3: Convert hex characters (&#x4f60; or \x4f60)
        $decoded = preg_replace_callback(
            '/(?:&#|\\\)[x]([0-9a-f]+);?/i',
            function($matches) {
                return chr(@hexdec($matches[1]));
            },
            $decoded
        );
        
        // Step 4: Fix incomplete HTML entities (&#00 => &#00;)
        $decoded = preg_replace('/(&#0+[0-9]+)/', '$1;', $decoded);
        
        // Step 5: Convert HTML entities
        $decoded = html_entity_decode($decoded, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        
        // Step 6: Remove spaces (attackers use spaces to bypass filters)
        $decoded = preg_replace('/\s/', '', $decoded);

        // Patterns to detect XSS
        $aPatterns = array(
            // Match event handlers: onclick, onload, etc.
            '/(<[^>]+[\"\'\/\x00-\x20])(on|xmlns)[^>]*>?/iuU',
            
            // Match dangerous protocols
            '/(data|feed|mocha|(java|live|vb)script):(\w)*/iuU',
            
            // Match style attributes (can contain expressions)
            '/(<[^>]+[\"\'\/\x00-\x20])style=[^>]*>?/iuU',
            
            // Match dangerous tags
            '/<\/*(applet|bgsound|blink|base|embed|frame|frameset|iframe|ilayer|layer|link|meta|object|script|style|title|xml)[^>]*>?/i',
            
            // Match CSS binding
            '/-moz-binding[\x00-\x20]*:/iu'
        );

        // Check both original and decoded strings
        foreach ($aPatterns as $pattern)
        {
            if (preg_match($pattern, $string) || preg_match($pattern, $decoded))
            {
                return TRUE; // XSS detected!
            }
        }

        return FALSE; // Safe
    }

    /**
     * Sanitize user input
     * @param mixed $data Input data
     * @return mixed Sanitized data
     */
    static public function sanitizeInput($data)
    {
        if (is_array($data))
        {
            return array_map([__CLASS__, 'sanitizeInput'], $data);
        }

        if (is_string($data))
        {
            // Remove null bytes
            $data = str_replace(chr(0), '', $data);
            
            // Check for XSS
            if (self::checkXSS($data))
            {
                // Log attack attempt
                error_log('XSS attempt detected: ' . $data);
                
                // Return empty or throw exception
                throw new Exception('Security: XSS detected');
            }
        }

        return $data;
    }

    /**
     * Generate CSRF token
     * @return string 74-character token
     */
    static public function getCsrfToken()
    {
        // Start session if not started
        if (session_status() === PHP_SESSION_NONE)
        {
            session_start();
        }

        $time = time();
        $sessionId = session_id();
        
        // Token = timestamp + hash(session_id + timestamp)
        return $time . hash('sha256', $sessionId . $time);
    }

    /**
     * Check CSRF token validity
     * @param string $token Token to check
     * @param int $lifetime Token lifetime in seconds (default: 3600)
     * @return boolean TRUE if valid, FALSE if invalid
     */
    static public function checkCsrfToken($token, $lifetime = 3600)
    {
        // Check token length (10 digits + 64 char hash = 74)
        if (strlen($token) !== 74)
        {
            error_log('CSRF: Wrong token length');
            return FALSE;
        }

        // Extract timestamp and hash
        $timestamp = substr($token, 0, 10);
        $tokenHash = substr($token, 10);

        // Verify hash
        $expectedHash = hash('sha256', session_id() . $timestamp);
        if ($tokenHash !== $expectedHash)
        {
            error_log('CSRF: Invalid token');
            return FALSE;
        }

        // Check expiration
        if (time() - $timestamp > $lifetime)
        {
            error_log('CSRF: Token expired');
            return FALSE;
        }

        return TRUE;
    }

    /**
     * Generate secure random string
     * @param int $length Length of string
     * @return string Random string
     */
    static public function generateRandomString($length = 32)
    {
        return bin2hex(random_bytes($length / 2));
    }

    /**
     * Hash password securely
     * @param string $password Plain password
     * @return string Hashed password
     */
    static public function hashPassword($password)
    {
        return password_hash($password, PASSWORD_ARGON2ID);
    }

    /**
     * Verify password
     * @param string $password Plain password
     * @param string $hash Stored hash
     * @return boolean TRUE if valid
     */
    static public function verifyPassword($password, $hash)
    {
        return password_verify($password, $hash);
    }
}
```

---

## 📝 Usage Examples

### Example 1: Form with CSRF Protection

```php
<?php
// Generate token
$csrfToken = Core_Security::getCsrfToken();
?>

<form method="POST" action="/submit">
    <input type="hidden" name="csrf_token" value="<?php echo $csrfToken; ?>">
    <input type="text" name="username">
    <button type="submit">Submit</button>
</form>

<?php
// Process form
if ($_SERVER['REQUEST_METHOD'] === 'POST')
{
    // Check CSRF token
    if (!Core_Security::checkCsrfToken($_POST['csrf_token']))
    {
        die('Security: Invalid CSRF token');
    }

    // Sanitize input
    $username = Core_Security::sanitizeInput($_POST['username']);

    // Process...
}
?>
```

---

### Example 2: API with XSS Protection

```php
<?php
// API endpoint
header('Content-Type: application/json');

// Get input
$input = json_decode(file_get_contents('php://input'), true);

// Sanitize all inputs
try {
    $input = Core_Security::sanitizeInput($input);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input']);
    exit;
}

// Process API request...
echo json_encode(['status' => 'success']);
?>
```

---

### Example 3: File Upload Security

```php
<?php
/**
 * Secure file upload handler
 */
class FileUpload
{
    static public function validateUpload($file)
    {
        // Check if file was uploaded
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name']))
        {
            throw new Exception('Invalid upload');
        }

        // Check file size (10MB max)
        if ($file['size'] > 10 * 1024 * 1024)
        {
            throw new Exception('File too large');
        }

        // Check file extension
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf'];
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        
        if (!in_array($extension, $allowedExtensions))
        {
            throw new Exception('Invalid file type');
        }

        // Check MIME type
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        $allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf'
        ];

        if (!in_array($mimeType, $allowedMimes))
        {
            throw new Exception('Invalid MIME type');
        }

        // Generate secure filename
        $secureFilename = Core_Security::generateRandomString(16) . '.' . $extension;

        // Move to secure location (no PHP execution)
        $uploadDir = __DIR__ . '/upload/';
        move_uploaded_file($file['tmp_name'], $uploadDir . $secureFilename);

        return $secureFilename;
    }
}
?>
```

---

## 🗂️ Directory Structure Security

### Recommended Structure:

```
project/
├── public/                 # Web root (only this accessible)
│   ├── index.php
│   ├── .htaccess          # Main protection
│   ├── assets/
│   └── upload/
│       └── .htaccess      # Block PHP execution
│
├── app/                    # Application code (not web accessible)
│   ├── config/
│   │   └── .htaccess      # Deny all
│   ├── modules/
│   │   └── core/
│   │       └── security.php
│   └── data/
│       └── .htaccess      # Deny all
│
├── cron/                   # Cron scripts
│   └── .htaccess          # Deny all
│
├── logs/                   # Log files
│   └── .htaccess          # Deny all
│
└── vendor/                 # Dependencies
    └── .htaccess          # Deny all
```

---

## 🔐 Security Headers Configuration

### Add to main .htaccess or PHP:

```apache
<IfModule mod_headers.c>
    # Prevent clickjacking
    Header always set X-Frame-Options "DENY"
    
    # Prevent MIME sniffing
    Header always set X-Content-Type-Options "nosniff"
    
    # Enable XSS filter
    Header always set X-XSS-Protection "1; mode=block"
    
    # Content Security Policy
    Header always set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
    
    # HSTS (HTTPS only)
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    
    # Referrer Policy
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```

**Or in PHP:**

```php
<?php
// Set security headers
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Content-Security-Policy: default-src \'self\';');
?>
```

---

## 🚨 Security Checklist for AI Agent

When creating a new project, implement:

### Level 1: Critical (Must Have)
- [ ] Root `.htaccess` with basic protection
- [ ] Block dangerous HTTP methods (TRACE, TRACK, DEBUG)
- [ ] XSS protection class implemented
- [ ] CSRF token system implemented
- [ ] Input sanitization on all user data
- [ ] Secure password hashing (Argon2)
- [ ] Session security (httponly, secure cookies)
- [ ] Directory listing disabled
- [ ] Sensitive files blocked (.env, .git, etc.)

### Level 2: Important (Should Have)
- [ ] Protected directories with individual `.htaccess`
- [ ] File upload validation
- [ ] Security headers (CSP, X-Frame-Options, etc.)
- [ ] SQL injection protection (prepared statements)
- [ ] Rate limiting on sensitive endpoints
- [ ] Error logging (without exposing details)
- [ ] HTTPS enforcement
- [ ] Secure session configuration

### Level 3: Enhanced (Nice to Have)
- [ ] IP-based rate limiting
- [ ] Failed login attempt tracking
- [ ] Security audit logging
- [ ] Content Security Policy fine-tuning
- [ ] Subresource Integrity (SRI) for CDN resources
- [ ] Two-factor authentication
- [ ] Regular security updates check
- [ ] Penetration testing

---

## 🛠️ Testing Security

### Test 1: XSS Protection

```php
<?php
// Test vectors
$testVectors = [
    '<script>alert("XSS")</script>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
    '<img src=x onerror=alert("XSS")>',
    '<svg/onload=alert("XSS")>',
    'javascript:alert("XSS")',
    'data:text/html,<script>alert("XSS")</script>',
];

foreach ($testVectors as $vector)
{
    if (Core_Security::checkXSS($vector))
    {
        echo "✓ Detected: $vector\n";
    }
    else
    {
        echo "✗ MISSED: $vector\n";
    }
}
?>
```

### Test 2: CSRF Protection

```php
<?php
// Generate token
$token = Core_Security::getCsrfToken();
echo "Token: $token\n";

// Wait 1 second
sleep(1);

// Verify token
if (Core_Security::checkCsrfToken($token))
{
    echo "✓ Token valid\n";
}

// Wait until expired
sleep(3601);

// Try expired token
if (!Core_Security::checkCsrfToken($token))
{
    echo "✓ Expired token rejected\n";
}
?>
```

### Test 3: Directory Protection

```bash
# Test directory access
curl -I https://yourdomain.com/data/config.json
# Should return: 403 Forbidden

curl -I https://yourdomain.com/cron/script.php
# Should return: 403 Forbidden

curl -I https://yourdomain.com/upload/test.php
# Should return: 403 Forbidden (if PHP in upload/)
```

---

## 📚 Best Practices Summary

### For AI Agent Development:

1. **Always validate input**
   - Never trust user data
   - Use whitelist validation
   - Sanitize before processing

2. **Use prepared statements**
   - Never concatenate SQL
   - Use PDO or MySQLi prepared statements

3. **Implement CSRF tokens**
   - On all forms
   - On all state-changing operations
   - Verify on server side

4. **Protect sensitive directories**
   - Use `.htaccess` layering
   - Block PHP execution in uploads
   - Deny access to config/data

5. **Use security headers**
   - Set via .htaccess or PHP
   - Include CSP, X-Frame-Options, etc.

6. **Log security events**
   - Failed login attempts
   - XSS detections
   - CSRF failures
   - File upload rejections

7. **Keep dependencies updated**
   - Regular security updates
   - Monitor CVE databases
   - Use Dependabot

8. **Test regularly**
   - Use security scanners
   - Manual penetration testing
   - Review logs

---

## 🔗 Related Files

- `.htaccess` - Main protection
- `data/.htaccess` - Data protection
- `upload/.htaccess` - Upload protection
- `cron/.htaccess` - Cron protection
- `modules/core/security.php` - Security class

---

## 📖 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PHP Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/PHP_Configuration_Cheat_Sheet.html)
- [Apache Security Tips](https://httpd.apache.org/docs/2.4/misc/security_tips.html)

---

**Last Updated:** 2025-12-30  
**Version:** 1.0.0  
**Based on:** Enterprise CMS Security Patterns  
**Status:** ✅ Production Ready

