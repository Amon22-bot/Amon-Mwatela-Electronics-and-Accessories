/* =========================================================
   AM ELECTRONICS AND ACCESSORIES
   PRODUCT DETAILS JAVASCRIPT
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    "use strict";

    /* =====================================================
       1. CONFIGURATION
    ===================================================== */

    const CART_KEY = "amElectronicsCart";
    const MIN_QUANTITY = 1;
    const MAX_QUANTITY = 10;

    const API_BASE = String(window.AM_API_BASE_URL || "").replace(/\/+$/, "");

    const catalogue = Array.isArray(window.products)
        ? window.products
        : (typeof products !== "undefined" ? products : []);

    let currentProduct = null;

    /* =====================================================
       2. PAGE ELEMENTS
    ===================================================== */

    const mainProductImg = document.getElementById("mainProductImg");

    const thumbnailRow = document.getElementById("thumbnailRow");

    const getThumbnails = () => document.querySelectorAll(".thumb");

    const quantityInput = document.getElementById("quantity");

    const addToCartButton = document.querySelector(".btn-add-cart");

    const cartCount = document.getElementById("cartCount");

    /* =====================================================
       3. GENERAL HELPERS
    ===================================================== */

    function formatMoney(amount) {

        const number = Number(amount);

        if (!Number.isFinite(number)) {
            return "Price unavailable";
        }

        return "KSh " + number.toLocaleString("en-KE", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });

    }

    function getCart() {

        try {

            const storedCart = localStorage.getItem(CART_KEY);

            if (!storedCart) return [];

            const parsedCart = JSON.parse(storedCart);

            return Array.isArray(parsedCart) ? parsedCart : [];

        } catch (error) {

            console.error("Unable to read cart:", error);

            return [];

        }

    }

    function saveCart(cart) {

        try {

            localStorage.setItem(
                CART_KEY,
                JSON.stringify(cart)
            );

            return true;

        } catch (error) {

            console.error("Unable to save cart:", error);

            showMessage(
                "Unable to save your cart. Please try again.",
                "error"
            );

            return false;

        }

    }

    function updateCartCount() {

        if (!cartCount) return;

        const totalItems = getCart().reduce(function (total, item) {

            const quantity = Number(item.quantity);

            return total + (
                Number.isFinite(quantity) && quantity > 0
                    ? Math.floor(quantity)
                    : 0
            );

        }, 0);

        cartCount.textContent = totalItems;

    }

    function showMessage(message, type) {

        let notification = document.getElementById(
            "productCartNotification"
        );

        if (!notification) {

            notification = document.createElement("div");

            notification.id = "productCartNotification";

            notification.setAttribute("role", "status");
            notification.setAttribute("aria-live", "polite");

            Object.assign(notification.style, {
                position: "fixed",
                right: "20px",
                bottom: "20px",
                zIndex: "99999",
                maxWidth: "min(360px, calc(100vw - 40px))",
                padding: "14px 20px",
                borderRadius: "10px",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: "600",
                boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
                opacity: "0",
                transform: "translateY(10px)",
                transition: "opacity 0.2s ease, transform 0.2s ease"
            });

            document.body.appendChild(notification);

        }

        notification.style.background =
            type === "error" ? "#c62828" : "#087b42";

        notification.textContent = message;

        notification.style.opacity = "1";
        notification.style.transform = "translateY(0)";

        clearTimeout(notification.hideTimer);

        notification.hideTimer = setTimeout(function () {

            notification.style.opacity = "0";
            notification.style.transform = "translateY(10px)";

        }, 3000);

    }

    function getText(value) {

        if (value === null || value === undefined) {
            return "";
        }

        if (typeof value === "string") {
            return value.trim();
        }

        if (typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }

        return "";

    }

    /* =====================================================
       4. NORMALIZE PRODUCT SPECIFICATIONS

       Supports:
       - [{ label: "Battery", value: "5000mAh" }]
       - [{ name: "Battery", value: "5000mAh" }]
       - [{ key: "Battery", value: "5000mAh" }]
       - { Battery: "5000mAh", Display: "6.7 inches" }
       - "Battery: 5000mAh"
       - Multiline specification text
    ===================================================== */

    function normalizeSpecifications(specifications) {

        if (!specifications) return [];

        /* Handle string data. */

        if (typeof specifications === "string") {

            const text = specifications.trim();

            if (!text) return [];

            try {

                const parsed = JSON.parse(text);

                if (parsed !== specifications) {
                    return normalizeSpecifications(parsed);
                }

            } catch (error) {
                // Continue and interpret it as ordinary text.
            }

            return text
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => {

                    const separator = line.indexOf(":");

                    if (separator !== -1) {

                        return {
                            label: line.substring(0, separator).trim(),
                            value: line.substring(separator + 1).trim()
                        };

                    }

                    return {
                        label: "Specification",
                        value: line
                    };

                })
                .filter(spec => spec.value);

        }

        /* Handle arrays. */

        if (Array.isArray(specifications)) {

            return specifications
                .map(spec => {

                    if (typeof spec === "string") {

                        return {
                            label: "Specification",
                            value: spec.trim()
                        };

                    }

                    if (!spec || typeof spec !== "object") {
                        return null;
                    }

                    const label = getText(
                        spec.label ??
                        spec.name ??
                        spec.key ??
                        spec.title ??
                        spec.attribute ??
                        spec.specification
                    );

                    const value = getText(
                        spec.value ??
                        spec.description ??
                        spec.detail ??
                        spec.text
                    );

                    return {
                        label: label || "Specification",
                        value
                    };

                })
                .filter(spec => spec && spec.value);

        }

        /* Handle objects. */

        if (typeof specifications === "object") {

            if (
                "value" in specifications ||
                "label" in specifications ||
                "name" in specifications
            ) {

                return normalizeSpecifications([specifications]);

            }

            return Object.entries(specifications)
                .map(([label, value]) => ({
                    label: label.trim(),
                    value: getText(value)
                }))
                .filter(spec => spec.value);

        }

        return [];

    }

    /* =====================================================
       5. FIND SELECTED PRODUCT
    ===================================================== */

    function getSelectedProduct() {

        return currentProduct;

    }

    function getRequestedProductId() {

        const params = new URLSearchParams(window.location.search);

        return params.get("id") || params.get("product");

    }

    function normalizeProduct(product) {

        if (!product) return null;

        const inStock = typeof product.stockStatus === "string"
            ? product.stockStatus === "in-stock"
            : product.inStock !== false;

        return {

            ...product,

            id: String(product._id || product.id || ""),

            name: product.title || product.name || "Product",

            oldPrice: product.originalPrice ?? product.oldPrice ?? product.price,

            inStock,

            colors: Array.isArray(product.colors)
                ? product.colors
                : [],

            features: Array.isArray(product.features)
                ? product.features
                : [],

            specifications: normalizeSpecifications(
                product.specifications
            ),

            extraImages: Array.isArray(product.extraImages)
                ? product.extraImages
                : []

        };

    }

    function categoryLabel(category) {

        const labels = {

            covers: "Phone Covers",

            "screen-protectors": "Screen Protectors",

            "headphones-earpods": "Headphones and Earpods",

            smartwatches: "Smartwatches",

            "chargers-cables": "Chargers and Cables",

            "power-banks": "Power Banks",

            "gaming-accessories": "Gaming Accessories",

            "photography-lighting": "Photography and Lighting",

            "audio-sound": "Audio and Sound",

            "storage-memory": "Storage and Memory",

            "computer-accessories": "Computer Accessories"

        };

        return labels[category] || "Shop Product";

    }

    /* =====================================================
       6. DISPLAY PRODUCT INFORMATION
    ===================================================== */

    function loadProductDetails(product) {

        if (!product) return;

        const title = document.querySelector(".product-title");

        const currentPrice = document.querySelector(".current-price");

        const oldPrice = document.querySelector(".old-price");

        const discountBadge = document.querySelector(
            ".detail-discount-badge"
        );

        const description = document.querySelector(
            ".product-description"
        );

        /* PRODUCT NAME */

        if (title) {

            title.textContent = product.name;

            document.title = product.name + " | AM Electronics";

        }

        /* CURRENT PRICE */

        if (currentPrice) {

            currentPrice.textContent = formatMoney(product.price);

        }

        /* ORIGINAL PRICE */

        if (oldPrice) {

            if (Number(product.oldPrice) > Number(product.price)) {

                oldPrice.textContent = formatMoney(product.oldPrice);

                oldPrice.hidden = false;

                oldPrice.style.display = "";

            } else {

                oldPrice.textContent = "";

                oldPrice.hidden = true;

                oldPrice.style.display = "";

            }

        }

        /* DISCOUNT BADGE */

        const hasDiscount =
            Number(product.oldPrice) > Number(product.price) &&
            Number(product.oldPrice) > 0;

        if (discountBadge) {

            if (hasDiscount) {

                const percentage = Math.round(
                    (
                        (Number(product.oldPrice) - Number(product.price)) /
                        Number(product.oldPrice)
                    ) * 100
                );

                discountBadge.textContent = `-${percentage}%`;

                discountBadge.style.display = "inline-block";

            } else {

                discountBadge.textContent = "";

                discountBadge.style.display = "none";

            }

        }

        /* DESCRIPTION */

        if (description) {

            description.textContent = product.description || "";

        }

        /* =================================================
           PRODUCT IMAGES
        ================================================= */

        if (mainProductImg && product.image) {

            mainProductImg.src = product.image;

            mainProductImg.alt = product.name;

        }

        const galleryImages = [
            product.image,
            ...product.extraImages
        ].filter(Boolean);

        if (thumbnailRow) {

            thumbnailRow.replaceChildren(
                ...galleryImages.map((src, index) => {

                    const thumbnail = document.createElement("img");

                    thumbnail.className =
                        `thumb${index === 0 ? " active" : ""}`;

                    thumbnail.src = src;

                    thumbnail.dataset.fullImage = src;

                    thumbnail.alt =
                        `${product.name} image ${index + 1}`;

                    thumbnail.loading = "lazy";

                    thumbnail.tabIndex = 0;

                    thumbnail.setAttribute("role", "button");

                    return thumbnail;

                })
            );

        }

        /* =================================================
           BRAND AND MODEL
        ================================================= */

        const extraInfo = document.getElementById(
            "productExtraInfo"
        );

        const brandModel = document.getElementById(
            "productBrandModel"
        );

        const brandModelText = [
            product.brand,
            product.model
        ]
            .map(getText)
            .filter(Boolean)
            .join(" · ");

        if (brandModel) {

            brandModel.textContent = brandModelText;

            brandModel.hidden = !brandModelText;

        }

        /* =================================================
           KEY FEATURES
        ================================================= */

        const featuresList = document.getElementById(
            "productFeatures"
        );

        if (featuresList) {

            featuresList.replaceChildren();

            product.features
                .map(getText)
                .filter(Boolean)
                .forEach(function (feature) {

                    const item = document.createElement("li");

                    item.textContent = feature;

                    featuresList.appendChild(item);

                });

        }

        const featuresSection = document.getElementById(
            "featuresSection"
        );

        const validFeatures = product.features
            .map(getText)
            .filter(Boolean);

        if (featuresSection) {

            featuresSection.hidden = validFeatures.length === 0;

        }

        /* =================================================
           PRODUCT SPECIFICATIONS
        ================================================= */

        const specsBody = document.getElementById(
            "productSpecifications"
        );

        const specsSection = document.getElementById(
            "specificationsSection"
        );

        const specifications = normalizeSpecifications(
            product.specifications
        );

        if (specsBody) {

            specsBody.replaceChildren();

            specifications.forEach(function (spec) {

                const row = document.createElement("tr");

                const label = document.createElement("td");

                label.className = "spec-label";

                label.textContent =
                    spec.label || "Specification";

                const value = document.createElement("td");

                value.className = "spec-value";

                value.textContent = spec.value;

                row.append(label, value);

                specsBody.appendChild(row);

            });

        }

        if (specsSection) {

            specsSection.hidden = specifications.length === 0;

        }

        /* =================================================
           AVAILABLE COLOURS
        ================================================= */

        const colorsSection = document.getElementById(
            "colorsSection"
        );

        const colorsText = document.getElementById(
            "productColors"
        );

        const validColors = product.colors
            .map(getText)
            .filter(Boolean);

        if (colorsText) {

            colorsText.textContent = validColors.join(", ");

        }

        if (colorsSection) {

            colorsSection.hidden = validColors.length === 0;

        }

        /* =================================================
           WARRANTY
        ================================================= */

        const warrantySection = document.getElementById(
            "warrantySection"
        );

        const warrantyText = document.getElementById(
            "productWarranty"
        );

        const warranty = getText(product.warranty);

        if (warrantyText) {

            warrantyText.textContent = warranty;

        }

        if (warrantySection) {

            warrantySection.hidden = !warranty;

        }

        /* =================================================
           VERIFIED DETAILS BADGE
        ================================================= */

        const verifiedBadge = document.getElementById(
            "detailsVerifiedBadge"
        );

        if (verifiedBadge) {

            verifiedBadge.hidden =
                product.detailsVerified !== true;

        }

        /* SHOW OR HIDE EXTRA PRODUCT INFORMATION */

        const hasExtraInfo =
            Boolean(brandModelText) ||
            validFeatures.length > 0 ||
            specifications.length > 0 ||
            validColors.length > 0 ||
            Boolean(warranty) ||
            product.detailsVerified === true;

        if (extraInfo) {

            extraInfo.hidden = !hasExtraInfo;

        }

        /* =================================================
           BASIC PRODUCT INFORMATION TABLE
        ================================================= */

        const specName = document.getElementById(
            "specProductName"
        );

        const specCategory = document.getElementById(
            "specProductCategory"
        );

        const specStock = document.getElementById(
            "specProductStock"
        );

        if (specName) {

            specName.textContent = product.name;

        }

        if (specCategory) {

            specCategory.textContent =
                categoryLabel(product.category);

        }

        if (specStock) {

            specStock.textContent = product.inStock
                ? "In Stock"
                : "Out of Stock";

        }

        /* =================================================
           STOCK STATUS
        ================================================= */

        const stockElement = document.querySelector(
            ".product-status, .stock-status"
        );

        if (stockElement) {

            stockElement.textContent = product.inStock
                ? "In Stock"
                : "Out of Stock";

            stockElement.style.color = product.inStock
                ? "#087b42"
                : "#c62828";

        }

        /* REMEMBER CURRENT PRODUCT */

        document.body.dataset.productId = product.id;

        /* RENDER COLOUR OPTIONS */

        renderColours(product);

        /* UPDATE ADD TO CART BUTTON */

        if (addToCartButton) {

            addToCartButton.disabled = !product.inStock;

            addToCartButton.textContent = product.inStock
                ? "Add to Cart"
                : "Out of Stock";

        }

    }

    /* =====================================================
       7. COLOUR SELECTION
    ===================================================== */

    function renderColours(product) {

        const colourContainer = document.querySelector(
            ".product-colors, .color-options"
        );

        if (!colourContainer) return;

        colourContainer.replaceChildren();

        const colours = Array.isArray(product.colors)
            ? product.colors
            : [];

        const validColours = colours
            .map(getText)
            .filter(Boolean);

        if (validColours.length === 0) {

            const message = document.createElement("p");

            message.textContent =
                "Colour options not specified.";

            colourContainer.appendChild(message);

            return;

        }

        validColours.forEach(function (colour, index) {

            const button = document.createElement("button");

            button.type = "button";

            button.className = "swatch";

            button.dataset.color = colour;

            button.setAttribute("aria-label", colour);

            button.setAttribute("title", colour);

            button.setAttribute("aria-pressed", "false");

            button.textContent = colour;

            if (index === 0) {

                button.classList.add("selected");

                button.setAttribute("aria-pressed", "true");

            }

            button.addEventListener("click", function () {

                selectSwatch(button);

            });

            colourContainer.appendChild(button);

        });

    }

    function selectSwatch(element) {

        if (!element) return;

        document.querySelectorAll(".swatch").forEach(
            function (swatch) {

                swatch.classList.remove("selected");

                swatch.setAttribute("aria-pressed", "false");

            }
        );

        element.classList.add("selected");

        element.setAttribute("aria-pressed", "true");

    }

    /* =====================================================
       8. IMAGE GALLERY
    ===================================================== */

    function changeImage(element) {

        if (!mainProductImg || !element) return;

        const source =
            element.getAttribute("data-full-image") ||
            element.getAttribute("src");

        if (!source) return;

        mainProductImg.src = source;

        mainProductImg.alt =
            element.alt || "Product image";

        getThumbnails().forEach(function (thumbnail) {

            thumbnail.classList.remove("active");

        });

        element.classList.add("active");

    }

    if (thumbnailRow) {

        thumbnailRow.addEventListener("click", function (event) {

            const thumbnail = event.target.closest(".thumb");

            if (thumbnail) {

                changeImage(thumbnail);

            }

        });

        thumbnailRow.addEventListener("keydown", function (event) {

            const thumbnail = event.target.closest(".thumb");

            if (
                thumbnail &&
                (event.key === "Enter" || event.key === " ")
            ) {

                event.preventDefault();

                changeImage(thumbnail);

            }

        });

    }

    /* =====================================================
       9. QUANTITY CONTROLS
    ===================================================== */

    function getQuantity() {

        if (!quantityInput) return MIN_QUANTITY;

        let quantity = parseInt(quantityInput.value, 10);

        if (!Number.isFinite(quantity)) {

            quantity = MIN_QUANTITY;

        }

        quantity = Math.max(
            MIN_QUANTITY,
            Math.min(MAX_QUANTITY, quantity)
        );

        quantityInput.value = quantity;

        return quantity;

    }

    function updateQty(change) {

        if (!quantityInput) return;

        const newQuantity =
            getQuantity() + Number(change);

        if (
            Number.isInteger(newQuantity) &&
            newQuantity >= MIN_QUANTITY &&
            newQuantity <= MAX_QUANTITY
        ) {

            quantityInput.value = newQuantity;

        }

    }

    if (quantityInput) {

        quantityInput.min = MIN_QUANTITY;

        quantityInput.max = MAX_QUANTITY;

        quantityInput.step = 1;

        quantityInput.addEventListener("change", getQuantity);

    }

    /* =====================================================
       10. ADD TO CART
    ===================================================== */

    function addProductToCart() {

        const product = getSelectedProduct();

        if (!product) {

            showMessage(
                "Product not found. Please return to the shop and select a product.",
                "error"
            );

            return;

        }

        if (!product.inStock) {

            showMessage(
                "Sorry, this product is currently out of stock.",
                "error"
            );

            return;

        }

        if (
            quantityInput &&
            !quantityInput.reportValidity()
        ) {

            return;

        }

        const quantity = getQuantity();

        const selectedSwatch = document.querySelector(
            ".swatch.selected"
        );

        const colour = selectedSwatch
            ? selectedSwatch.dataset.color ||
              selectedSwatch.getAttribute("title") ||
              selectedSwatch.textContent.trim()
            : "";

        const cart = getCart();

        const existingProduct = cart.find(function (item) {

            return String(item.id) === String(product.id) &&
                String(item.color || "") === String(colour || "");

        });

        if (existingProduct) {

            existingProduct.quantity =
                Number(existingProduct.quantity || 0) + quantity;

            existingProduct.price = Number(product.price);

            existingProduct.image = product.image;

        } else {

            cart.push({

                id: product.id,

                name: product.name,

                price: Number(product.price),

                image: product.image,

                color: colour,

                quantity: quantity

            });

        }

        if (!saveCart(cart)) return;

        updateCartCount();

        showMessage(
            product.name + " added to your cart.",
            "success"
        );

        if (addToCartButton) {

            addToCartButton.textContent = "✓ Added to Cart";

            addToCartButton.disabled = true;

            setTimeout(function () {

                addToCartButton.textContent = "Add to Cart";

                addToCartButton.disabled = !product.inStock;

            }, 1200);

        }

    }

    if (addToCartButton) {

        addToCartButton.addEventListener(
            "click",
            addProductToCart
        );

    }

    /* =====================================================
       11. LOAD PRODUCT FROM BACKEND
    ===================================================== */

    async function initializeProductDetails() {

        const requestedId = getRequestedProductId();

        const title = document.querySelector(".product-title");

        const description = document.querySelector(
            ".product-description"
        );

        if (!requestedId) {

            if (title) {

                title.textContent = "Product not selected";

            }

            if (description) {

                description.textContent =
                    "Open this page by selecting a product from the Shop page.";

            }

            if (addToCartButton) {

                addToCartButton.textContent = "Product unavailable";

                addToCartButton.disabled = true;

            }

            return;

        }

        try {

            if (!API_BASE) {

                throw new Error(
                    "The backend API address is not configured."
                );

            }

            const response = await fetch(
                `${API_BASE}/api/products/${encodeURIComponent(requestedId)}`
            );

            if (!response.ok) {

                throw new Error(
                    `Product request failed (${response.status})`
                );

            }

            const productData = await response.json();

            currentProduct = normalizeProduct(productData);

        } catch (error) {

            console.error(
                "Could not load product from the backend:",
                error
            );

            const fallback = catalogue.find(function (item) {

                return String(item.id || item._id) === requestedId;

            });

            currentProduct = normalizeProduct(fallback);

        }

        if (!currentProduct) {

            if (title) {

                title.textContent = "Product not found";

            }

            if (description) {

                description.textContent =
                    "This product may have been removed. Return to the Shop page and choose another product.";

            }

            if (addToCartButton) {

                addToCartButton.textContent = "Product unavailable";

                addToCartButton.disabled = true;

            }

            return;

        }

        loadProductDetails(currentProduct);

    }

    /* =====================================================
       12. INITIALIZE PAGE
    ===================================================== */

    if (quantityInput) {

        quantityInput.value = MIN_QUANTITY;

    }

    updateCartCount();

    /* Preserve compatibility with existing inline handlers. */

    window.changeImage = changeImage;

    window.selectSwatch = selectSwatch;

    window.updateQty = updateQty;

    initializeProductDetails();

    console.log(
        "AM Electronics product details initialized."
    );

});
