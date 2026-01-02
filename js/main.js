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

// Store reference to outside click handler for cleanup
let mobileMenuOutsideClickHandler = null;

/**
 * Инициализация мобильного меню
 * ЛОГИКА: Управление показом/скрытием меню через классы .active
 * CSS только определяет стили для этих классов
 */
function initMobileMenu() {
    console.log('=== initMobileMenu() called ===');
    
    const navToggle = document.querySelector('.mobile-menu-toggle');
    const navMenu = document.querySelector('nav ul');
    const nav = document.querySelector('nav');

    console.log('navToggle found:', !!navToggle, navToggle);
    console.log('navMenu found:', !!navMenu, navMenu);
    console.log('nav found:', !!nav, nav);
    console.log('navMenu children:', navMenu ? navMenu.children.length : 0);
    
    if (navMenu) {
        console.log('navMenu HTML:', navMenu.outerHTML.substring(0, 200));
    }

    if (!navToggle) {
        console.warn('Mobile menu toggle button not found!');
        return;
    }

    if (!navMenu) {
        console.warn('Navigation menu (nav ul) not found!');
        return;
    }

    // Check if menu has items
    if (navMenu.children.length === 0) {
        console.warn('Navigation menu is empty! Menu items may not be generated yet.');
        // Don't return - still set up the button, menu might be populated later
    }

    // ЛОГИКА: Устанавливаем начальное состояние через inline стили
    // CSS только определяет декоративные стили (цвета, размеры, отступы)
    // Проверяем размер экрана для определения начального состояния
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    
    if (isDesktop) {
        // ЛОГИКА: На десктопе меню видно по умолчанию
        navMenu.style.display = 'flex';
        navMenu.style.visibility = 'visible';
        navMenu.style.opacity = '1';
    } else {
        // ЛОГИКА: На мобильных и планшетах меню скрыто по умолчанию
        navMenu.style.display = 'none';
        navMenu.style.visibility = 'hidden';
        navMenu.style.opacity = '0';
    }
    
    navToggle.classList.remove('active');

    // Remove old listeners by cloning
    const newToggle = navToggle.cloneNode(true);
    navToggle.parentNode.replaceChild(newToggle, navToggle);

    // Remove old outside click handler if exists
    if (mobileMenuOutsideClickHandler) {
        document.removeEventListener('click', mobileMenuOutsideClickHandler);
        mobileMenuOutsideClickHandler = null;
    }

    // Флаг для отслеживания клика на кнопке меню
    let menuButtonClicked = false;
    
    /**
     * ЛОГИКА: Обработчик клика на кнопку меню
     * Управляет состоянием через добавление/удаление класса .active
     * CSS только определяет визуальное оформление для этого класса
     */
    newToggle.addEventListener('click', (e) => {
        menuButtonClicked = true; // Устанавливаем флаг
        
        e.stopPropagation(); // Останавливаем всплытие
        e.preventDefault(); // Предотвращаем стандартное поведение
        // ЛОГИКА: Проверяем текущее состояние через inline стили
        const isVisible = navMenu.style.display === 'flex' && navMenu.style.visibility === 'visible';
        console.log('Menu toggle clicked, current state:', isVisible);
        
        // ЛОГИКА: Переключаем состояние меню через inline стили
        // CSS только определяет декоративные стили (цвета, размеры, отступы)
        if (isVisible) {
            // ЛОГИКА: Закрываем меню - устанавливаем inline стили
            navMenu.style.display = 'none';
            navMenu.style.visibility = 'hidden';
            navMenu.style.opacity = '0';
            newToggle.classList.remove('active');
            console.log('Menu closed (inline styles set)');
        } else {
            // ЛОГИКА: Открываем меню - устанавливаем inline стили
            navMenu.style.display = 'flex';
            navMenu.style.visibility = 'visible';
            navMenu.style.opacity = '1';
            newToggle.classList.add('active');
            console.log('Menu opened (inline styles set)');
        }
        
        console.log('Menu state after toggle:', navMenu.classList.contains('active'));
        console.log('Menu items count:', navMenu.children.length);
        
        // Сбрасываем флаг после небольшой задержки
        setTimeout(() => {
            menuButtonClicked = false;
        }, 100);
    });

    /**
     * ЛОГИКА: Закрытие меню при клике на ссылку навигации
     * Управление через удаление класса .active
     */
    const handleNavLinkClick = (e) => {
        const link = e.target.closest('nav a[data-link]');
        if (link) {
            console.log('Nav link clicked, closing menu');
            // ЛОГИКА: Закрываем меню - устанавливаем inline стили
            navMenu.style.display = 'none';
            navMenu.style.visibility = 'hidden';
            navMenu.style.opacity = '0';
            newToggle.classList.remove('active');
        }
    };

    // Remove old listener if exists (won't work, but try anyway)
    navMenu.removeEventListener('click', handleNavLinkClick);
    // Add new listener with event delegation
    navMenu.addEventListener('click', handleNavLinkClick);

    /**
     * ЛОГИКА: Закрытие меню при клике вне его области
     * Управление через удаление класса .active
     */
    mobileMenuOutsideClickHandler = (e) => {
        // Если был клик на кнопке меню, игнорируем
        if (menuButtonClicked) {
            return;
        }
        
        // Проверяем, что клик не на кнопке меню и не на самом меню
        const clickedToggle = e.target.closest('.mobile-menu-toggle');
        const clickedMenu = e.target.closest('nav ul');
        const clickedNav = e.target.closest('nav');
        
        // Если клик был на кнопке, не закрываем меню
        if (clickedToggle) {
            return;
        }
        
        // Если клик был на меню или внутри nav, не закрываем
        if (clickedMenu || clickedNav) {
            return;
        }
        
        // ЛОГИКА: Если меню открыто и клик был вне его, закрываем - устанавливаем inline стили
        if (navMenu.style.display === 'flex' && navMenu.style.visibility === 'visible') {
            console.log('Click outside menu, closing (setting inline styles)');
            navMenu.style.display = 'none';
            navMenu.style.visibility = 'hidden';
            navMenu.style.opacity = '0';
            newToggle.classList.remove('active');
        }
    };
    
    // Добавляем обработчик с задержкой, чтобы обработчик кнопки успел сработать
    document.addEventListener('click', (e) => {
        setTimeout(() => mobileMenuOutsideClickHandler(e), 10);
    }, false);

    console.log('=== Mobile menu initialized successfully ===');
    console.log('Button element:', newToggle);
    console.log('Menu element:', navMenu);
    console.log('Menu is now ready for clicks');
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
    document.querySelectorAll('.card, .tech-card, .contact-item, .features-item').forEach(card => {
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
    
    document.querySelectorAll('nav a').forEach(link => {
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
    // Smooth fade-in on initial page load
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.3s ease';
    
    requestAnimationFrame(() => {
        document.body.style.opacity = '1';
    });
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
    window.initMobileMenu = initMobileMenu;
    window.updateActiveNav = updateActiveNav;
}
