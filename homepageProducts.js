"use strict";

/* =========================================================
   AM ELECTRONICS AND ACCESSORIES
   HOMEPAGE PRODUCT LOADER

   RESPONSIBILITIES:
   1. Load homepage products from the backend.
   2. Update product images, titles and descriptions.
   3. Display original prices, discount badges and current prices.
   4. Preserve existing cards when backend sections are empty.
   5. Link product cards to the product details page.
   6. Support Power Banks image placeholders.
   7. Preserve existing CSS price layouts.
   8. Avoid unnecessary line breaks in price containers.
   9. Do not generate stock-status badges.
========================================================= */


/* =========================================================
   1. HOMEPAGE PRODUCT SECTION CONFIGURATION
========================================================= */

const homepageProductSections = {

    "top-selling": {
        container: "#topSellingTrack",
        description: ".top-selling-details > p",
        price: ".top-selling-price"
    },

    covers: {
        container: "#phoneCoversTrack",
        description: ".phone-covers-details > p",
        price: ".phone-covers-price"
    },

    "new-arrivals": {
        container: ".new-arrivals-track",
        description: ".new-arrival-details > p",
        price: ".new-arrival-price"
    },

    "screen-protectors": {
        container: "#screenProtectorsTrack",
        description: ".screen-protector-description",
        price: ".screen-protector-price"
    },

    "headphones-earpods": {
        container: "#headphonesTrack",
        description: ".headphones-details > p",
        price: ".headphones-price"
    },

    smartwatches: {
        container: "#smartwatchesTrack",
        description: ".smartwatch-description",
        price: ".smartwatch-price"
    },

    "chargers-cables": {
        container: "#chargersCablesTrack",
        description: ".chargers-cables-description",
        price: ".chargers-cables-price"
    },

    "power-banks": {
        container: "#powerBanksTrack",
        description: ".power-banks-description",
        price: ".power-banks-price"
    }

};


/* =========================================================
   2. LOAD HOMEPAGE PRODUCTS WHEN PAGE IS READY
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    Object.entries(homepageProductSections).forEach(
        ([category, config]) => {

            loadHomepageCategory(category, config);

        }
    );

});


/* =========================================================
   3. LOAD PRODUCTS FOR AN INDIVIDUAL SECTION
========================================================= */

async function loadHomepageCategory(category, config) {

    const container = document.querySelector(config.container);

    if (!container) {

        console.warn(
            `Homepage section container not found: ${category}`
        );

        return;

    }

    /*
     * Use the first existing HTML card as the template.
     */

    const template = container.firstElementChild;

    if (!template) {

        console.warn(
            `No product card template found for: ${category}`
        );

        return;

    }

    try {

        const response = await fetch(
            `${window.AM_API_BASE_URL}/api/products/homepage/${encodeURIComponent(category)}`
        );

        if (!response.ok) {

            throw new Error(
                `Request failed with status ${response.status}`
            );

        }

        const products = await response.json();

        if (!Array.isArray(products)) {

            throw new Error(
                `Invalid product response for ${category}`
            );

        }


        /* KEEP EXISTING CARDS IF BACKEND IS EMPTY */

        if (products.length === 0) {

            console.info(
                `No backend products assigned to ${category}. Existing cards retained.`
            );

            return;

        }


        /* CREATE CARDS FROM BACKEND PRODUCTS */

        const cards = products.map(product => {

            const card = template.cloneNode(true);

            updateHomepageCard(card, product, config);

            return card;

        });


        /* REPLACE EXISTING CARDS */

        container.replaceChildren(...cards);

    } catch (error) {

        console.error(
            `Could not load homepage section ${category}:`,
            error
        );

        /*
         * Existing HTML cards remain visible if the
         * backend request fails.
         */

    }

}


/* =========================================================
   4. UPDATE INDIVIDUAL PRODUCT CARD
========================================================= */

function updateHomepageCard(card, product, config) {

    /* PRODUCT DETAILS URL */

    const productUrl =
        `product-details.html?id=${encodeURIComponent(product._id)}`;


    /* DEMO PRODUCT INDICATOR */

    if (product.isDemo) {

        card.classList.add("demo-preview-card");

        if (!card.querySelector(":scope > .demo-preview-badge")) {

            const badge = document.createElement("span");

            badge.className = "demo-preview-badge";

            badge.textContent = "DEMO PREVIEW";

            card.appendChild(badge);

        }

    }


    /* PRODUCT CARD CLICK BEHAVIOUR */

    if (card.tagName === "A") {

        card.href = productUrl;

    }

    card.tabIndex = 0;

    card.setAttribute("role", "link");

    card.setAttribute(
        "aria-label",
        `View details for ${product.title}`
    );


    card.addEventListener("click", event => {

        if (event.target.closest("a, button")) {

            return;

        }

        window.location.href = productUrl;

    });


    card.addEventListener("keydown", event => {

        if (event.key === "Enter" || event.key === " ") {

            event.preventDefault();

            window.location.href = productUrl;

        }

    });


    /* =====================================================
       PRODUCT IMAGE
    ===================================================== */

    let image = card.querySelector("img");

    /*
     * POWER BANKS IMAGE SUPPORT
     */

    if (!image && product.image) {

        const imageContainer = card.querySelector(
            ".power-banks-image"
        );

        if (imageContainer) {

            image = document.createElement("img");

            image.className = "power-banks-product-image";

            imageContainer.classList.remove(
                "power-bank-placeholder"
            );

            imageContainer.replaceChildren(image);

            image.style.width = "100%";

            image.style.height = "100%";

            image.style.objectFit = "cover";

            image.style.display = "block";

        }

    }


    if (image && product.image) {

        image.src = product.image;

        image.alt = product.title;

        image.loading = "lazy";

    }


    /* =====================================================
       PRODUCT TITLE
    ===================================================== */

    const title = card.querySelector("h3");

    if (title) {

        const titleLink = title.querySelector("a");

        if (titleLink) {

            titleLink.textContent = product.title;

        } else {

            title.textContent = product.title;

        }

    }


    /* =====================================================
       PRODUCT DESCRIPTION
    ===================================================== */

    const description = card.querySelector(
        config.description
    );

    if (description) {

        description.textContent = product.description || "";

    }


    /* =====================================================
       PRODUCT PRICE
    ===================================================== */

    const priceBox = card.querySelector(config.price);

    if (priceBox) {

        updatePriceMarkup(priceBox, product);

    }


    /* =====================================================
       UPDATE PRODUCT LINKS
    ===================================================== */

    card.querySelectorAll("a").forEach(link => {

        link.href = productUrl;

    });


    /* =====================================================
       PRODUCT DATA ATTRIBUTES
    ===================================================== */

    card.dataset.productId = product._id;


    card.querySelectorAll("[data-product-id]").forEach(element => {

        element.dataset.productId = product._id;

    });


    card.querySelectorAll("[data-product]").forEach(element => {

        element.dataset.product = product.title;

    });


    card.querySelectorAll("[data-price]").forEach(element => {

        element.dataset.price = product.price;

    });

}


/* =========================================================
   5. UPDATE PRODUCT PRICE DISPLAY
========================================================= */

function updatePriceMarkup(priceBox, product) {

    const original = Number(product.originalPrice);

    const current = Number(product.price);


    /* VALIDATE CURRENT PRICE */

    if (!Number.isFinite(current)) {

        console.warn(
            `Invalid price for product: ${product.title}`
        );

        return;

    }


    /* CHECK FOR VALID DISCOUNT */

    const hasDiscount =
        Number.isFinite(original) &&
        original > current &&
        original > 0;


    /*
     * PRESERVE EXISTING PRICE CONTAINER STRUCTURE.
     *
     * If the HTML contains a direct child paragraph,
     * use it. Otherwise, use the price container itself.
     */

    const contentBox =
        priceBox.querySelector(":scope > p") || priceBox;


    /*
     * Remove old price content without replacing the
     * outer price container or its CSS classes.
     */

    contentBox.replaceChildren();


    /* =====================================================
       ORIGINAL PRICE
    ===================================================== */

    if (hasDiscount) {

        const oldPrice = document.createElement("del");

        oldPrice.className = "original-price";

        oldPrice.textContent = formatKES(original);

        contentBox.appendChild(oldPrice);


        /* DISCOUNT BADGE */

        const badge = document.createElement("span");

        badge.className = "discount-badge";

        const percentage = Math.round(
            ((original - current) / original) * 100
        );

        badge.textContent = `-${percentage}%`;

        contentBox.appendChild(badge);

    }


    /* =====================================================
       CURRENT PRICE
    ===================================================== */

    const currentPrice = document.createElement("strong");

    currentPrice.className = "current-price";

    currentPrice.textContent = formatKES(current);

    contentBox.appendChild(currentPrice);

}


/* =========================================================
   6. FORMAT PRICES IN KENYAN SHILLINGS
========================================================= */

function formatKES(amount) {

    return "KSh " + Number(amount).toLocaleString("en-KE", {

        minimumFractionDigits: 0,

        maximumFractionDigits: 2

    });

}


