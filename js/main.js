// Quantum Supremacy - Main JavaScript

// ========================================
// Initialize Page Components
// ========================================

function initializePageComponents() {
    initMobileMenu();
    initContactForm();
    initScrollAnimations();
}

// ========================================
// Mobile Menu Toggle
// ========================================

function initMobileMenu() {
    const navToggle = document.querySelector('.nav__toggle');
    const navMenu = document.querySelector('.nav__menu');

    if (navToggle) {
        // Remove old listeners by cloning
        const newToggle = navToggle.cloneNode(true);
        navToggle.parentNode.replaceChild(newToggle, navToggle);

        newToggle.addEventListener('click', () => {
            navMenu.classList.toggle('nav__menu--active');
            newToggle.classList.toggle('nav__toggle--active');
        });

        // Close menu when clicking nav link
        document.querySelectorAll('.nav__menu a[data-link]').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('nav__menu--active');
                newToggle.classList.remove('nav__toggle--active');
            });
        });
    }
}

// ========================================
// Contact Form Handler
// ========================================

function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        // Remove old listeners
        const newForm = contactForm.cloneNode(true);
        contactForm.parentNode.replaceChild(newForm, contactForm);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Use Security class for secure form handling
            if (typeof Security !== 'undefined') {
                await Security.secureFormSubmit(newForm, (data) => {
                    // Log sanitized data
                    console.log('Secure form submitted:', data);
                    
                    // Show success message
                    alert('Спасибо за ваше сообщение! Мы свяжемся с вами в ближайшее время.');
                    
                    // Reset form
                    newForm.reset();
                });
            } else {
                // Fallback if Security not loaded
                alert('Security module not loaded');
            }
        });
    }
}

// ========================================
// Scroll Animations
// ========================================

function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all cards
    document.querySelectorAll('.about__card, .tech-card, .contact__method').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}

// ========================================
// Active Navigation State
// ========================================

function updateActiveNav() {
    const currentPath = window.location.pathname;
    
    document.querySelectorAll('.nav__menu a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active');
        }
    });
}

// ========================================
// Page Load Animation
// ========================================

window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

// ========================================
// Smooth Scroll Enhancement
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Add smooth scrolling to all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                e.preventDefault();
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
});

// ========================================
// Export for use with router
// ========================================

if (typeof window !== 'undefined') {
    window.initializePageComponents = initializePageComponents;
    window.updateActiveNav = updateActiveNav;
}
