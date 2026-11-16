/* =========================================================
   AM ELECTRONICS AND ACCESSORIES
   COMPLETE HOMEPAGE JAVASCRIPT
   File: index.js
========================================================= */

"use strict";


/* =========================================================
   1. MAIN HOMEPAGE INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       1.1 SHARED SETTINGS
    ===================================================== */

    const CART_KEY = "amElectronicsCart";

    const HERO_INTERVAL = 5000;

    const CAROUSEL_IDLE_DELAY = 1000;

    const PRODUCT_CARD_SELECTOR = [
        ".top-selling-card",
        ".phone-cover-card",
        ".new-arrival-card",
        ".screen-protector-card",
        ".headphones-card",
        ".product-card",
        ".smartwatch-card",
        ".chargers-cables-card",
        ".power-banks-card",
        ".recommended-product-card"
    ].join(", ");

    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );


    /* =====================================================
       2. SHOPPING CART COUNT
    ===================================================== */

    function updateCartCount() {

        const cartCount = document.getElementById("cartCount");

        if (!cartCount) return;

        try {

            const cart = JSON.parse(
                localStorage.getItem(CART_KEY) || "[]"
            );

            if (!Array.isArray(cart)) {

                cartCount.textContent = "0";

                return;

            }

            const totalItems = cart.reduce(function (total, item) {

                const quantity = Number(item?.quantity);

                if (
                    Number.isFinite(quantity) &&
                    quantity > 0
                ) {

                    return total + Math.floor(quantity);

                }

                return total;

            }, 0);

            cartCount.textContent = totalItems;

        } catch (error) {

            console.error(
                "Unable to update cart count:",
                error
            );

            cartCount.textContent = "0";

        }

    }


    /* INITIAL CART COUNT */

    updateCartCount();


    /* UPDATE WHEN ANOTHER TAB CHANGES THE CART */

    window.addEventListener("storage", function (event) {

        if (
            event.key === CART_KEY ||
            event.key === null
        ) {

            updateCartCount();

        }

    });


    /* UPDATE WHEN RETURNING TO THE HOMEPAGE */

    window.addEventListener("pageshow", updateCartCount);


    document.addEventListener("visibilitychange", function () {

        if (!document.hidden) {

            updateCartCount();

        }

    });


    /*
       Allow other scripts to update the cart count.

       Usage:
       window.updateAMElectronicsCartCount();
    */

    window.updateAMElectronicsCartCount = updateCartCount;


    /*
       Listen for same-page cart updates.

       Usage:
       window.dispatchEvent(
           new Event("am:cart-updated")
       );
    */

    window.addEventListener(
        "am:cart-updated",
        updateCartCount
    );


    /* =====================================================
       3. HERO SLIDER
    ===================================================== */

    const heroSlides = Array.from(
        document.querySelectorAll(".hero-slide")
    );

    const heroDots = Array.from(
        document.querySelectorAll(".hero-dot")
    );

    const heroPrev = document.querySelector(".hero-prev");

    const heroNext = document.querySelector(".hero-next");

    /*
       The hero section must have:

       id="hero"

       This container controls:
       - Hero autoplay
       - Arrow visibility
       - Hover interaction
       - Keyboard focus
    */

    const heroSlider = document.getElementById("hero");


    let currentHeroSlide = 0;

    let heroTimer = null;

    let heroArrowTimer = null;

    let heroIsHovered = false;

    let heroHasFocus = false;


    /* -----------------------------------------------------
       3.1 DISPLAY A HERO SLIDE
    ----------------------------------------------------- */

    function showHeroSlide(index) {

        if (heroSlides.length === 0) return;

        currentHeroSlide =
            (index + heroSlides.length) % heroSlides.length;


        heroSlides.forEach(function (slide, slideIndex) {

            const isActive =
                slideIndex === currentHeroSlide;

            slide.classList.toggle("active", isActive);

            slide.setAttribute(
                "aria-hidden",
                isActive ? "false" : "true"
            );

        });


        heroDots.forEach(function (dot, dotIndex) {

            const isActive =
                dotIndex === currentHeroSlide;

            dot.classList.toggle("active", isActive);

            if (isActive) {

                dot.setAttribute("aria-current", "true");

            } else {

                dot.removeAttribute("aria-current");

            }

        });

    }


    /* -----------------------------------------------------
       3.2 NEXT AND PREVIOUS SLIDES
    ----------------------------------------------------- */

    function nextHeroSlide() {

        showHeroSlide(currentHeroSlide + 1);

    }


    function previousHeroSlide() {

        showHeroSlide(currentHeroSlide - 1);

    }


    /* -----------------------------------------------------
       3.3 STOP AUTOMATIC SLIDING
    ----------------------------------------------------- */

    function stopHeroSlider() {

        if (heroTimer !== null) {

            clearInterval(heroTimer);

            heroTimer = null;

        }

    }


    /* -----------------------------------------------------
       3.4 START AUTOMATIC SLIDING
    ----------------------------------------------------- */

    function startHeroSlider() {

        stopHeroSlider();

        if (heroSlides.length < 2) return;

        if (document.hidden) return;

        if (heroIsHovered || heroHasFocus) return;

        if (prefersReducedMotion.matches) return;


        heroTimer = setInterval(function () {

            nextHeroSlide();

        }, HERO_INTERVAL);

    }


    /* -----------------------------------------------------
       3.5 HERO ARROW VISIBILITY
    ----------------------------------------------------- */

    /*
       Reuses the same .is-scrolling class used by
       the homepage product carousels.

       The class is applied to the main hero container.
    */

    function showHeroArrows() {

        if (!heroSlider) return;

        heroSlider.classList.add("is-scrolling");

        clearTimeout(heroArrowTimer);


        /*
           Do not hide arrows while the customer is
           hovering over the hero or using keyboard focus.
        */

        if (heroIsHovered || heroHasFocus) return;


        /*
           Hide arrows after the interaction has ended.
        */

        heroArrowTimer = setTimeout(function () {

            if (
                !heroIsHovered &&
                !heroHasFocus
            ) {

                heroSlider.classList.remove("is-scrolling");

            }

        }, CAROUSEL_IDLE_DELAY);

    }


    /* -----------------------------------------------------
       3.6 HIDE HERO ARROWS
    ----------------------------------------------------- */

    function hideHeroArrows() {

        if (!heroSlider) return;

        clearTimeout(heroArrowTimer);

        if (
            !heroIsHovered &&
            !heroHasFocus
        ) {

            heroSlider.classList.remove("is-scrolling");

        }

    }


    /* -----------------------------------------------------
       3.7 INITIALISE HERO
    ----------------------------------------------------- */

    if (heroSlides.length > 0) {

        showHeroSlide(0);

        startHeroSlider();


        /* NEXT BUTTON */

        if (heroNext) {

            heroNext.addEventListener("click", function () {

                nextHeroSlide();

                showHeroArrows();

                startHeroSlider();

            });

        }


        /* PREVIOUS BUTTON */

        if (heroPrev) {

            heroPrev.addEventListener("click", function () {

                previousHeroSlide();

                showHeroArrows();

                startHeroSlider();

            });

        }


        /* NAVIGATION DOTS */

        heroDots.forEach(function (dot, index) {

            dot.addEventListener("click", function () {

                showHeroSlide(index);

                showHeroArrows();

                startHeroSlider();

            });

        });


        /* -------------------------------------------------
           HERO HOVER INTERACTION
        ------------------------------------------------- */

        if (heroSlider) {

            heroSlider.addEventListener(
                "mouseenter",
                function () {

                    heroIsHovered = true;

                    clearTimeout(heroArrowTimer);

                    heroSlider.classList.add("is-scrolling");

                    stopHeroSlider();

                }
            );


            heroSlider.addEventListener(
                "mouseleave",
                function () {

                    heroIsHovered = false;

                    hideHeroArrows();

                    startHeroSlider();

                }
            );


            /* -------------------------------------------------
               KEYBOARD FOCUS INTERACTION
            ------------------------------------------------- */

            heroSlider.addEventListener(
                "focusin",
                function () {

                    heroHasFocus = true;

                    clearTimeout(heroArrowTimer);

                    heroSlider.classList.add("is-scrolling");

                    stopHeroSlider();

                }
            );


            heroSlider.addEventListener(
                "focusout",
                function (event) {

                    /*
                       Only respond when keyboard focus
                       leaves the entire hero section.
                    */

                    if (
                        !heroSlider.contains(event.relatedTarget)
                    ) {

                        heroHasFocus = false;

                        hideHeroArrows();

                        startHeroSlider();

                    }

                }
            );


            /* -------------------------------------------------
               POINTER INTERACTION
            ------------------------------------------------- */

            heroSlider.addEventListener(
                "pointerdown",
                function () {

                    showHeroArrows();

                },
                { passive: true }
            );

        }

    }


    /* -----------------------------------------------------
       3.8 PAUSE WHEN BROWSER TAB IS HIDDEN
    ----------------------------------------------------- */

    document.addEventListener("visibilitychange", function () {

        if (document.hidden) {

            stopHeroSlider();

        } else {

            startHeroSlider();

        }

    });


    /* -----------------------------------------------------
       3.9 RESPECT REDUCED-MOTION PREFERENCE
    ----------------------------------------------------- */

    function handleHeroMotionPreference() {

        if (prefersReducedMotion.matches) {

            stopHeroSlider();

        } else {

            startHeroSlider();

        }

    }


    if (prefersReducedMotion.addEventListener) {

        prefersReducedMotion.addEventListener(
            "change",
            handleHeroMotionPreference
        );

    } else if (prefersReducedMotion.addListener) {

        prefersReducedMotion.addListener(
            handleHeroMotionPreference
        );

    }


    /* =====================================================
       4. REUSABLE CAROUSEL SYSTEM
    ===================================================== */

    function setupCarousel(
        track,
        previousButton,
        nextButton
    ) {

        if (!track) return;


        /*
           The track's immediate parent is the slider
           container in the supplied homepage HTML.
        */

        const carouselContainer = track.parentElement;

        let scrollIdleTimer = null;

        let resizeObserver = null;

        let mutationObserver = null;

        let resizeFrame = null;


        /* -------------------------------------------------
           4.1 GET ACTUAL CARD SCROLL DISTANCE
        ------------------------------------------------- */

        function getScrollStep() {

            const firstCard = track.firstElementChild;

            if (!firstCard) {

                return track.clientWidth * 0.8;

            }


            const cardWidth =
                firstCard.getBoundingClientRect().width;

            const cardStyle =
                window.getComputedStyle(firstCard);

            const trackStyle =
                window.getComputedStyle(track);


            const marginLeft =
                parseFloat(cardStyle.marginLeft) || 0;

            const marginRight =
                parseFloat(cardStyle.marginRight) || 0;

            const gap =
                parseFloat(trackStyle.columnGap) ||
                parseFloat(trackStyle.gap) ||
                0;


            return (
                cardWidth +
                marginLeft +
                marginRight +
                gap
            );

        }


        /* -------------------------------------------------
           4.2 UPDATE CAROUSEL ARROW STATES
        ------------------------------------------------- */

        function updateButtons() {

            const maximumScroll = Math.max(
                0,
                track.scrollWidth - track.clientWidth
            );

            const currentScroll = Math.max(
                0,
                track.scrollLeft
            );


            const canScroll = maximumScroll > 3;

            const canScrollBackward =
                canScroll && currentScroll > 3;

            const canScrollForward =
                canScroll &&
                currentScroll < maximumScroll - 3;


            if (previousButton) {

                previousButton.disabled =
                    !canScrollBackward;

                previousButton.setAttribute(
                    "aria-disabled",
                    previousButton.disabled ? "true" : "false"
                );

            }


            if (nextButton) {

                nextButton.disabled =
                    !canScrollForward;

                nextButton.setAttribute(
                    "aria-disabled",
                    nextButton.disabled ? "true" : "false"
                );

            }

        }


        /* -------------------------------------------------
           4.3 TEMPORARILY REVEAL CAROUSEL ARROWS
        ------------------------------------------------- */

        function showScrollingState() {

            track.classList.add("is-scrolling");

            if (carouselContainer) {

                carouselContainer.classList.add(
                    "is-scrolling"
                );

            }


            clearTimeout(scrollIdleTimer);


            scrollIdleTimer = setTimeout(function () {

                track.classList.remove("is-scrolling");

                if (carouselContainer) {

                    carouselContainer.classList.remove(
                        "is-scrolling"
                    );

                }

            }, CAROUSEL_IDLE_DELAY);

        }


        /* -------------------------------------------------
           4.4 SCROLL CAROUSEL
        ------------------------------------------------- */

        function scrollCarousel(direction) {

            const distance = getScrollStep() * direction;

            track.scrollBy({

                left: distance,

                behavior: prefersReducedMotion.matches
                    ? "auto"
                    : "smooth"

            });

            showScrollingState();

        }


        /* -------------------------------------------------
           4.5 PREVIOUS BUTTON
        ------------------------------------------------- */

        if (previousButton) {

            previousButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    if (previousButton.disabled) return;

                    scrollCarousel(-1);

                }
            );

        }


        /* -------------------------------------------------
           4.6 NEXT BUTTON
        ------------------------------------------------- */

        if (nextButton) {

            nextButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    if (nextButton.disabled) return;

                    scrollCarousel(1);

                }
            );

        }


        /* -------------------------------------------------
           4.7 TRACK SCROLL EVENT
        ------------------------------------------------- */

        track.addEventListener(
            "scroll",
            function () {

                updateButtons();

                showScrollingState();

            },
            { passive: true }
        );


        /* -------------------------------------------------
           4.8 USER INTERACTION
        ------------------------------------------------- */

        track.addEventListener(
            "wheel",
            function () {

                showScrollingState();

            },
            { passive: true }
        );


        track.addEventListener(
            "pointerdown",
            function () {

                showScrollingState();

            },
            { passive: true }
        );


        track.addEventListener(
            "keydown",
            function (event) {

                const scrollingKeys = [
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End"
                ];

                if (scrollingKeys.includes(event.key)) {

                    showScrollingState();

                }

            }
        );


        /* -------------------------------------------------
           4.9 IMAGE LOADING
        ------------------------------------------------- */

        track.addEventListener(
            "load",
            function (event) {

                if (
                    event.target.tagName === "IMG"
                ) {

                    updateButtons();

                }

            },
            true
        );


        track.addEventListener(
            "error",
            function (event) {

                if (
                    event.target.tagName === "IMG"
                ) {

                    updateButtons();

                }

            },
            true
        );


        /* -------------------------------------------------
           4.10 WINDOW RESIZE
        ------------------------------------------------- */

        function handleResize() {

            if (resizeFrame !== null) {

                cancelAnimationFrame(resizeFrame);

            }

            resizeFrame = requestAnimationFrame(function () {

                updateButtons();

                resizeFrame = null;

            });

        }


        window.addEventListener(
            "resize",
            handleResize,
            { passive: true }
        );


        /* -------------------------------------------------
           4.11 RESIZE OBSERVER
        ------------------------------------------------- */

        if ("ResizeObserver" in window) {

            resizeObserver = new ResizeObserver(function () {

                updateButtons();

            });


            resizeObserver.observe(track);


            Array.from(track.children).forEach(function (card) {

                if (card.nodeType === 1) {

                    resizeObserver.observe(card);

                }

            });

        }


        /* -------------------------------------------------
           4.12 DYNAMIC PRODUCT OBSERVER
        ------------------------------------------------- */

        if ("MutationObserver" in window) {

            mutationObserver = new MutationObserver(
                function (mutations) {

                    mutations.forEach(function (mutation) {

                        mutation.addedNodes.forEach(
                            function (node) {

                                if (
                                    node.nodeType === 1 &&
                                    resizeObserver
                                ) {

                                    resizeObserver.observe(node);

                                }

                            }
                        );

                    });

                    updateButtons();

                }
            );


            mutationObserver.observe(track, {

                childList: true,

                subtree: false

            });

        }


        /* -------------------------------------------------
           4.13 INITIAL CALCULATIONS
        ------------------------------------------------- */

        updateButtons();

        requestAnimationFrame(updateButtons);

        setTimeout(updateButtons, 300);

        setTimeout(updateButtons, 800);


        /*
           Return controller for future external use.
        */

        return {

            update: updateButtons,

            scrollNext: function () {

                scrollCarousel(1);

            },

            scrollPrevious: function () {

                scrollCarousel(-1);

            }

        };

    }


    /* =====================================================
       5. TOP SELLING CAROUSEL
    ===================================================== */

    setupCarousel(

        document.getElementById("topSellingTrack"),

        document.getElementById("topSellingPrev"),

        document.getElementById("topSellingNext")

    );


    /* =====================================================
       6. PHONE COVERS CAROUSEL
    ===================================================== */

    const phoneCoversSection = document.querySelector(
        ".phone-covers-section"
    );

    if (phoneCoversSection) {

        setupCarousel(

            phoneCoversSection.querySelector(
                ".phone-covers-track"
            ),

            phoneCoversSection.querySelector(
                ".phone-covers-prev"
            ),

            phoneCoversSection.querySelector(
                ".phone-covers-next"
            )

        );

    }


    /* =====================================================
       7. NEW ARRIVALS CAROUSEL
    ===================================================== */

    const newArrivalsSection = document.querySelector(
        ".new-arrivals-section"
    );

    if (newArrivalsSection) {

        setupCarousel(

            newArrivalsSection.querySelector(
                ".new-arrivals-track"
            ),

            newArrivalsSection.querySelector(
                ".new-arrivals-prev"
            ),

            newArrivalsSection.querySelector(
                ".new-arrivals-next"
            )

        );

    }


    /* =====================================================
       8. SCREEN PROTECTORS CAROUSEL
    ===================================================== */

    const screenProtectorsSection = document.querySelector(
        ".screen-protectors-section"
    );

    if (screenProtectorsSection) {

        setupCarousel(

            screenProtectorsSection.querySelector(
                ".screen-protectors-track"
            ),

            screenProtectorsSection.querySelector(
                ".screen-protectors-prev"
            ),

            screenProtectorsSection.querySelector(
                ".screen-protectors-next"
            )

        );

    }


    /* =====================================================
       9. HEADPHONES & EARPODS CAROUSEL
    ===================================================== */

    const headphonesSection = document.querySelector(
        ".headphones-section"
    );

    if (headphonesSection) {

        setupCarousel(

            headphonesSection.querySelector(
                ".headphones-track"
            ),

            headphonesSection.querySelector(
                ".headphones-prev"
            ),

            headphonesSection.querySelector(
                ".headphones-next"
            )

        );

    }


    /* =====================================================
       10. SMARTWATCHES CAROUSEL
    ===================================================== */

    const smartwatchesSection = document.querySelector(
        ".smartwatches-section"
    );

    if (smartwatchesSection) {

        setupCarousel(

            smartwatchesSection.querySelector(
                ".smartwatches-track"
            ),

            smartwatchesSection.querySelector(
                ".smartwatches-prev"
            ),

            smartwatchesSection.querySelector(
                ".smartwatches-next"
            )

        );

    }


    /* =====================================================
       11. CHARGERS & CABLES CAROUSEL
    ===================================================== */

    const chargersSection = document.querySelector(
        ".chargers-cables-section"
    );

    if (chargersSection) {

        setupCarousel(

            chargersSection.querySelector(
                ".chargers-cables-track"
            ),

            chargersSection.querySelector(
                ".chargers-cables-prev"
            ),

            chargersSection.querySelector(
                ".chargers-cables-next"
            )

        );

    }


    /* =====================================================
       12. POWER BANKS CAROUSEL
    ===================================================== */

    const powerBanksSection = document.querySelector(
        ".power-banks-section"
    );

    if (powerBanksSection) {

        setupCarousel(

            powerBanksSection.querySelector(
                ".power-banks-track"
            ),

            powerBanksSection.querySelector(
                ".power-banks-prev"
            ),

            powerBanksSection.querySelector(
                ".power-banks-next"
            )

        );

    }


    /* =====================================================
       13. YOU MAY ALSO LIKE CAROUSEL
    ===================================================== */

    const recommendedSection = document.querySelector(
        ".you-may-also-like"
    );

    if (recommendedSection) {

        setupCarousel(

            recommendedSection.querySelector(
                ".recommended-products-grid"
            ),

            recommendedSection.querySelector(
                ".carousel-prev"
            ),

            recommendedSection.querySelector(
                ".carousel-next"
            )

        );

    }


    /* =====================================================
       14. HOMEPAGE PRODUCT NAVIGATION
    ===================================================== */

    /*
       Clicking anywhere on a product card opens its
       product-details page.

       Existing image and title links remain functional.

       Buttons and other interactive elements are excluded.

       Homepage cards do not add products directly to cart.
    */

    document.querySelectorAll(
        PRODUCT_CARD_SELECTOR
    ).forEach(function (card) {

        card.addEventListener(
            "click",
            function (event) {

                /*
                   Allow existing links, buttons and other
                   interactive elements to work normally.
                */

                if (
                    event.target.closest(
                        "a, button, input, select, textarea, label"
                    )
                ) {

                    return;

                }


                const productLink = card.querySelector(
                    'a[href*="product-details.html"]'
                );


                if (
                    productLink &&
                    productLink.getAttribute("href")
                ) {

                    window.location.href =
                        productLink.href;

                }

            }
        );


        /*
           Prevent nested buttons from accidentally
           triggering other card-level click handlers.
        */

        card.querySelectorAll("button").forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function (event) {

                        event.stopPropagation();

                    }
                );

            }
        );

    });


    /* =====================================================
       15. GLOBAL SEARCH
    ===================================================== */

    /*
       Search is managed separately by:

       global-search.js

       Do not register another search handler here.
    */


    /* =====================================================
       16. MOBILE NAVIGATION
    ===================================================== */

    const mobileMenuButton = document.getElementById(
        "mobileMenuButton"
    );

    const navbarMenu = document.getElementById(
        "navbarMenu"
    );


    if (mobileMenuButton && navbarMenu) {

        mobileMenuButton.setAttribute(
            "aria-expanded",
            "false"
        );

        mobileMenuButton.setAttribute(
            "aria-controls",
            "navbarMenu"
        );


        /* CLOSE MENU */

        function closeMobileMenu() {

            navbarMenu.classList.remove("active");

            mobileMenuButton.classList.remove("active");

            mobileMenuButton.setAttribute(
                "aria-expanded",
                "false"
            );

        }


        /* OPEN MENU */

        function openMobileMenu() {

            navbarMenu.classList.add("active");

            mobileMenuButton.classList.add("active");

            mobileMenuButton.setAttribute(
                "aria-expanded",
                "true"
            );

        }


        /* TOGGLE MENU */

        mobileMenuButton.addEventListener(
            "click",
            function () {

                const isOpen =
                    mobileMenuButton.getAttribute(
                        "aria-expanded"
                    ) === "true";


                if (isOpen) {

                    closeMobileMenu();

                } else {

                    openMobileMenu();

                }

            }
        );


        /* CLOSE AFTER SELECTING A LINK */

        navbarMenu.querySelectorAll("a").forEach(
            function (link) {

                link.addEventListener(
                    "click",
                    closeMobileMenu
                );

            }
        );


        /* CLOSE WHEN CLICKING OUTSIDE */

        document.addEventListener(
            "click",
            function (event) {

                const clickedInsideMenu =
                    navbarMenu.contains(event.target);

                const clickedMenuButton =
                    mobileMenuButton.contains(event.target);


                if (
                    !clickedInsideMenu &&
                    !clickedMenuButton
                ) {

                    closeMobileMenu();

                }

            }
        );


        /* CLOSE WHEN PRESSING ESCAPE */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    mobileMenuButton.getAttribute(
                        "aria-expanded"
                    ) === "true"
                ) {

                    closeMobileMenu();

                    mobileMenuButton.focus();

                }

            }
        );

    }


    /* =====================================================
       17. FAQ ACCORDION
    ===================================================== */

    document.querySelectorAll(".faq-item").forEach(
        function (item) {

            const question = item.querySelector(
                "button, h3"
            );

            if (!question) return;


            /*
               Prevent duplicate event registration.
            */

            if (
                question.dataset.faqInitialized === "true"
            ) {

                return;

            }

            question.dataset.faqInitialized = "true";


            /*
               Make heading-based FAQ questions keyboard
               accessible while preserving the supplied HTML.
            */

            if (question.tagName === "H3") {

                question.setAttribute("role", "button");

                question.setAttribute("tabindex", "0");

            }


            const isInitiallyOpen =
                item.classList.contains("active");

            question.setAttribute(
                "aria-expanded",
                isInitiallyOpen ? "true" : "false"
            );


            /* TOGGLE FAQ ITEM */

            function toggleFAQ() {

                const isOpen =
                    item.classList.toggle("active");

                question.setAttribute(
                    "aria-expanded",
                    isOpen ? "true" : "false"
                );

            }


            question.addEventListener(
                "click",
                toggleFAQ
            );


            /* KEYBOARD SUPPORT */

            if (question.tagName === "H3") {

                question.addEventListener(
                    "keydown",
                    function (event) {

                        if (
                            event.key === "Enter" ||
                            event.key === " "
                        ) {

                            event.preventDefault();

                            toggleFAQ();

                        }

                    }
                );

            }

        }
    );


    /* =====================================================
       18. AUTOMATIC FOOTER YEAR
    ===================================================== */

    const currentYear = document.getElementById(
        "currentYear"
    );

    if (currentYear) {

        currentYear.textContent =
            new Date().getFullYear();

    } else {

        /*
           Also support the current footer HTML where
           the year is written directly inside the paragraph.
        */

        const footerText = document.querySelector(
            ".site-footer p"
        );

        if (footerText) {

            footerText.textContent =
                footerText.textContent.replace(
                    /\b20\d{2}\b/,
                    String(new Date().getFullYear())
                );

        }

    }


    /* =====================================================
       19. INITIALISATION COMPLETE
    ===================================================== */

    console.log(
        "AM Electronics homepage JavaScript initialized successfully."
    );

});




/* =========================================================
   DISCOVERY SLIDES
   ONE-CARD AUTOMATIC INFINITE CAROUSEL
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    const track = document.getElementById(
        "discoverySlidesTrack"
    );

    const wrapper = document.querySelector(
        ".discovery-slides-wrapper"
    );

    const prevButton = document.getElementById(
        "discoveryPrev"
    );

    const nextButton = document.getElementById(
        "discoveryNext"
    );


    if (
        !track ||
        !wrapper ||
        !prevButton ||
        !nextButton
    ) return;


    const originalSlides = Array.from(track.children);

    const originalCount = originalSlides.length;


    if (originalCount <= 3) return;


    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );


    /* =====================================================
       1. SETTINGS
    ===================================================== */

    const AUTOPLAY_DELAY = 3000;

    const RESUME_DELAY = 2500;

    const TRANSITION_DURATION = 650;


    let currentIndex = 0;

    let cardStep = 0;

    let autoplayTimer = null;

    let resumeTimer = null;

    let transitionTimer = null;

    let isPaused = false;

    let isHovering = false;

    let isAnimating = false;


    /* =====================================================
       2. CREATE CLONES FOR INFINITE LOOPING
    ===================================================== */

    originalSlides.slice(0, 3).forEach(function (slide) {

        const clone = slide.cloneNode(true);

        clone.classList.add("discovery-clone");

        clone.setAttribute("aria-hidden", "true");

        clone.setAttribute("tabindex", "-1");


        clone.querySelectorAll(
            "a, button, input, select, textarea"
        ).forEach(function (element) {

            element.setAttribute("tabindex", "-1");

        });


        track.appendChild(clone);

    });


    /* =====================================================
       3. MEASURE ONE COMPLETE CARD
    ===================================================== */

    function measureCarousel() {

        const slide = originalSlides[0];

        if (!slide) return;

        const slideWidth =
            slide.getBoundingClientRect().width;

        const styles = window.getComputedStyle(track);

        const gap =
            parseFloat(styles.columnGap) ||
            parseFloat(styles.gap) ||
            0;

        cardStep = slideWidth + gap;

    }


    measureCarousel();


    /* =====================================================
       4. MOVE TO CARD POSITION
    ===================================================== */

    function moveToCard(index, behavior = "smooth") {

        measureCarousel();

        if (cardStep <= 0) return;

        track.scrollTo({

            left: index * cardStep,

            behavior: behavior

        });

    }


    /* =====================================================
       5. NEXT CARD
    ===================================================== */

    function nextSlide() {

        if (isAnimating) return;

        isAnimating = true;

        currentIndex++;

        moveToCard(currentIndex);


        clearTimeout(transitionTimer);

        transitionTimer = setTimeout(function () {

            if (currentIndex >= originalCount) {

                currentIndex = 0;

                moveToCard(currentIndex, "auto");

            }

            isAnimating = false;

        }, TRANSITION_DURATION);

    }


    /* =====================================================
       6. PREVIOUS CARD
    ===================================================== */

    function previousSlide() {

        if (isAnimating) return;

        isAnimating = true;


        if (currentIndex === 0) {

            currentIndex = originalCount;

            moveToCard(currentIndex, "auto");

        }


        currentIndex--;

        moveToCard(currentIndex);


        clearTimeout(transitionTimer);

        transitionTimer = setTimeout(function () {

            isAnimating = false;

        }, TRANSITION_DURATION);

    }


    /* =====================================================
       7. AUTOMATIC SLIDING
    ===================================================== */

    function startAutoplay() {

        stopAutoplay();

        if (isPaused) return;

        if (reducedMotion.matches) return;

        if (document.hidden) return;


        autoplayTimer = setInterval(function () {

            if (
                !isPaused &&
                !isAnimating &&
                !document.hidden
            ) {

                nextSlide();

            }

        }, AUTOPLAY_DELAY);

    }


    function stopAutoplay() {

        clearInterval(autoplayTimer);

        autoplayTimer = null;

    }


    /* =====================================================
       8. PAUSE AND RESUME
    ===================================================== */

    function pauseCarousel() {

        isPaused = true;

        stopAutoplay();

        clearTimeout(resumeTimer);

        wrapper.classList.add("is-interacting");

    }


    function resumeCarousel() {

        clearTimeout(resumeTimer);

        if (isHovering) return;

        if (reducedMotion.matches) return;


        resumeTimer = setTimeout(function () {

            isPaused = false;

            wrapper.classList.remove("is-interacting");

            startAutoplay();

        }, RESUME_DELAY);

    }


    /* =====================================================
       9. HOVER INTERACTION
    ===================================================== */

    wrapper.addEventListener(
        "mouseenter",
        function () {

            isHovering = true;

            pauseCarousel();

        }
    );


    wrapper.addEventListener(
        "mouseleave",
        function () {

            isHovering = false;

            resumeCarousel();

        }
    );


    /* =====================================================
       10. TOUCH AND POINTER INTERACTION
    ===================================================== */

    track.addEventListener(
        "pointerdown",
        pauseCarousel
    );


    track.addEventListener(
        "pointerup",
        resumeCarousel
    );


    track.addEventListener(
        "pointercancel",
        resumeCarousel
    );


    track.addEventListener(
        "touchstart",
        pauseCarousel,
        { passive: true }
    );


    track.addEventListener(
        "touchend",
        resumeCarousel,
        { passive: true }
    );


    /* =====================================================
       11. MANUAL ARROW NAVIGATION
    ===================================================== */

    function manualScroll(direction) {

        pauseCarousel();

        if (direction === 1) {

            nextSlide();

        } else {

            previousSlide();

        }

        resumeCarousel();

    }


    nextButton.addEventListener(
        "click",
        function () {

            manualScroll(1);

        }
    );


    prevButton.addEventListener(
        "click",
        function () {

            manualScroll(-1);

        }
    );


    /* =====================================================
       12. RESPONSIVE RESIZING
    ===================================================== */

    window.addEventListener(
        "resize",
        function () {

            measureCarousel();

            moveToCard(currentIndex, "auto");

        },
        { passive: true }
    );


    /* =====================================================
       13. PAGE VISIBILITY
    ===================================================== */

    document.addEventListener(
        "visibilitychange",
        function () {

            if (document.hidden) {

                stopAutoplay();

            } else {

                startAutoplay();

            }

        }
    );


    /* =====================================================
       14. REDUCED MOTION SUPPORT
    ===================================================== */

    function handleDiscoveryMotionPreference() {

        if (reducedMotion.matches) {

            stopAutoplay();

            isPaused = true;

        } else {

            isPaused = false;

            startAutoplay();

        }

    }


    if (reducedMotion.addEventListener) {

        reducedMotion.addEventListener(
            "change",
            handleDiscoveryMotionPreference
        );

    } else if (reducedMotion.addListener) {

        reducedMotion.addListener(
            handleDiscoveryMotionPreference
        );

    }


    /* =====================================================
       15. INITIALISE DISCOVERY CAROUSEL
    ===================================================== */

    track.style.scrollBehavior = "smooth";

    moveToCard(0, "auto");

    startAutoplay();

});

