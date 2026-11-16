/* =========================================================
   AM ELECTRONICS AND ACCESSORIES
   GLOBAL PRODUCT SEARCH
   ---------------------------------------------------------
   FEATURES:
   1. Navbar product search
   2. Live autocomplete suggestions
   3. Backend product search
   4. Product matching
   5. Direct product-details navigation
   6. Redirect all search results to shop.html
   7. No homepage sections are displayed as search results
========================================================= */

"use strict";

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       1. CONFIGURATION
    ===================================================== */

    const configuredApiBase = String(
        window.AM_API_BASE_URL || ""
    ).trim().replace(/\/+$/, "");

    const API_BASE_URL = configuredApiBase
        ? `${configuredApiBase}/api/products`
        : "";

    const SHOP_PAGE = new URL(
        "shop.html",
        window.location.href
    ).href;

    const PRODUCT_DETAILS_PAGE = new URL(
        "product-details.html",
        window.location.href
    ).href;

    const searchInputs = Array.from(new Set([
        document.getElementById("productSearch"),
        document.getElementById("shopProductSearch"),
        ...document.querySelectorAll(
            "header input[type='search'], " +
            "header input[type='text'], " +
            "nav input[type='search'], " +
            "nav input[type='text'], " +
            ".site-navbar input, " +
            ".navbar-search input, " +
            ".search-bar input, " +
            ".shop-search input"
        )
    ].filter(Boolean))).filter(input =>
        input instanceof HTMLInputElement &&
        !["button", "submit", "hidden"].includes(input.type)
    );

    const searchButtons = Array.from(new Set([
        document.getElementById("searchButton"),
        ...document.querySelectorAll(
            ".search-button, " +
            ".navbar-search button, " +
            ".search-bar button, " +
            ".shop-search button"
        )
    ].filter(Boolean)));

    let catalogue = [];

    let autocompleteDropdown = null;
    let activeAutocompleteInput = null;

    let autocompleteRequestNumber = 0;
    let searchDebounceTimer = null;

    let backendProductsPromise = null;


    /* =====================================================
       2. GENERAL HELPERS
    ===================================================== */

    function normaliseText(value) {
        return String(value ?? "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/&/g, " and ")
            .replace(/[^a-z0-9\s-]/g, " ")
            .replace(/[\s-]+/g, " ")
            .trim();
    }


    function compactText(value) {
        return normaliseText(value)
            .replace(/[\s-]+/g, "");
    }


    function createProductId(name) {
        return normaliseText(name)
            .replace(/\s+/g, "-")
            .replace(/^-+|-+$/g, "");
    }


    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }


    function formatPrice(price) {
        const amount = Number(
            String(price ?? "")
                .replace(/,/g, "")
                .replace(/[^\d.]/g, "")
        );

        if (!Number.isFinite(amount) || amount <= 0) {
            return "Price on request";
        }

        return "KSh " + amount.toLocaleString("en-KE", {
            maximumFractionDigits: 2
        });
    }


    function getProductDetailsURL(product) {
        const id =
            product?._id ||
            product?.id ||
            product?.productId ||
            createProductId(
                product?.name || product?.title
            );

        const url = new URL(PRODUCT_DETAILS_PAGE);

        url.searchParams.set("id", String(id || ""));

        return url.href;
    }


    function getProductImage(product) {
        const image =
            product?.image ||
            product?.images?.[0] ||
            product?.thumbnail ||
            "";

        if (typeof image === "string") {
            return image;
        }

        if (image && typeof image === "object") {
            return (
                image.url ||
                image.secure_url ||
                image.src ||
                ""
            );
        }

        return "";
    }


    /* =====================================================
       3. NORMALISE PRODUCTS
    ===================================================== */

    function normaliseProduct(item) {
        if (!item || typeof item !== "object") {
            return null;
        }

        const name = String(
            item.name ||
            item.title ||
            item.productName ||
            ""
        ).trim();

        if (!name) {
            return null;
        }

        const id = String(
            item._id ||
            item.id ||
            item.productId ||
            createProductId(name)
        );

        const rawPrice =
            item.price ??
            item.currentPrice ??
            item.sellingPrice ??
            0;

        const price = Number(
            String(rawPrice)
                .replace(/,/g, "")
                .replace(/[^\d.]/g, "")
        ) || 0;

        const colors = Array.isArray(item.colors)
            ? item.colors
            : (
                typeof item.colors === "string"
                    ? item.colors
                        .split(",")
                        .map(color => color.trim())
                        .filter(Boolean)
                    : []
            );

        return {
            ...item,

            id,
            name,
            title: name,

            category: String(
                item.category ||
                item.productCategory ||
                ""
            ),

            price,

            originalPrice: Number(
                item.originalPrice ??
                item.oldPrice ??
                item.original_price ??
                0
            ) || 0,

            image: getProductImage(item),

            description: String(
                item.description ||
                item.shortDescription ||
                ""
            ),

            colors,

            detailsURL: item.detailsURL ||
                getProductDetailsURL({
                    ...item,
                    id,
                    name
                })
        };
    }


    /* =====================================================
       4. EXTRACT PRODUCTS FROM EXISTING PRODUCT CARDS
    ===================================================== */

    const PRODUCT_CARD_SELECTOR = [
        ".top-selling-card",
        ".phone-cover-card",
        ".new-arrival-card",
        ".screen-protector-card",
        ".product-card",
        ".smartwatch-card",
        ".chargers-cables-card",
        ".power-banks-card",
        ".recommended-product-card",
        ".shop-product-card",
        ".headphone-card",
        ".product-item",
        "[data-product-id]"
    ].join(", ");


    function extractCardProduct(card, baseURL) {
        if (!card) return null;

        const nameElement = card.querySelector(
            ".product-name, " +
            ".shop-product-name, " +
            ".shop-product-title, " +
            ".top-selling-name, " +
            ".new-arrival-name, " +
            ".phone-cover-name, h3, h2"
        );

        const name =
            nameElement?.textContent.trim() ||
            card.dataset.productName ||
            "";

        if (!name) return null;

        const imageElement = card.querySelector("img");

        let image =
            imageElement?.getAttribute("src") ||
            imageElement?.getAttribute("data-src") ||
            "";

        if (image && baseURL) {
            try {
                image = new URL(image, baseURL).href;
            } catch (_) {
                // Keep original image path.
            }
        }

        let productId =
            card.dataset.productId ||
            card.dataset.id ||
            "";

        let detailsURL = "";

        const productLink = card.matches("a[href]")
            ? card
            : card.querySelector("a[href]");

        if (productLink) {
            try {
                const parsedURL = new URL(
                    productLink.getAttribute("href") || "",
                    baseURL || window.location.href
                );

                const linkedId =
                    parsedURL.searchParams.get("id") ||
                    parsedURL.searchParams.get("product");

                if (linkedId) {
                    productId = linkedId;
                }

                if (
                    /product-details\.html$/i.test(
                        parsedURL.pathname
                    ) &&
                    linkedId
                ) {
                    detailsURL = parsedURL.href;
                }

            } catch (_) {
                // Ignore malformed links.
            }
        }

        if (!productId) {
            productId = createProductId(name);
        }

        const priceElement = card.querySelector(
            ".current-price, " +
            ".shop-product-current-price, " +
            ".product-price, " +
            ".smartwatch-price, " +
            ".top-selling-price, " +
            ".new-arrival-price, " +
            ".price, .new-price, ins"
        );

        let price = 0;
        let originalPrice = 0;

        if (priceElement) {
            const oldPriceElement =
                priceElement.querySelector(
                    "del, .old-price, .original-price"
                );

            const oldPriceText =
                oldPriceElement?.textContent || "";

            originalPrice = Number(
                oldPriceText
                    .replace(/,/g, "")
                    .replace(/[^\d.]/g, "")
            ) || 0;

            const currentPriceElement =
                priceElement.querySelector(
                    ".current-price, .new-price, ins"
                ) ||
                Array.from(
                    priceElement.querySelectorAll("strong, b")
                )
                    .filter(element =>
                        !element.closest("del")
                    )
                    .pop();

            const currentPriceText =
                currentPriceElement?.textContent ||
                priceElement.textContent.replace(
                    oldPriceText,
                    ""
                );

            price = Number(
                currentPriceText
                    .replace(/,/g, "")
                    .replace(/[^\d.]/g, "")
            ) || 0;
        }

        const category =
            card.dataset.category ||
            card.querySelector(
                ".product-category, .shop-product-category"
            )?.textContent.trim() ||
            "";

        const description = card.querySelector(
            ".product-description, " +
            ".shop-product-description, " +
            ".description, " +
            ".smartwatch-description, " +
            ".screen-protector-description, " +
            ".chargers-cables-description, " +
            ".top-selling-details > p, " +
            ".new-arrival-details > p, " +
            ".phone-cover-details > p"
        )?.textContent.trim() || "";

        return normaliseProduct({
            id: productId,
            name,
            category,
            price,
            originalPrice,
            image,
            description,
            detailsURL
        });
    }


    function getCurrentPageProducts() {
        return Array.from(
            document.querySelectorAll(
                PRODUCT_CARD_SELECTOR
            )
        )
            .map(card =>
                extractCardProduct(
                    card,
                    window.location.href
                )
            )
            .filter(Boolean);
    }


    /* =====================================================
       5. LOAD PRODUCTS FROM THE OTHER PAGE
    ===================================================== */

    let otherPageProductsPromise = null;


    async function getProductsFromOtherPage() {
        if (otherPageProductsPromise) {
            return otherPageProductsPromise;
        }

        const currentPath =
            window.location.pathname.toLowerCase();

        const otherPage =
            currentPath.endsWith("shop.html")
                ? "index.html"
                : "shop.html";

        otherPageProductsPromise = (async () => {
            try {
                const otherPageURL = new URL(
                    otherPage,
                    window.location.href
                );

                const response = await fetch(
                    otherPageURL.href,
                    { cache: "no-store" }
                );

                if (!response.ok) {
                    return [];
                }

                const html = await response.text();

                const otherDocument = new DOMParser()
                    .parseFromString(html, "text/html");

                return Array.from(
                    otherDocument.querySelectorAll(
                        PRODUCT_CARD_SELECTOR
                    )
                )
                    .map(card =>
                        extractCardProduct(
                            card,
                            otherPageURL.href
                        )
                    )
                    .filter(Boolean);

            } catch (error) {
                console.warn(
                    "AM Electronics: Could not load products from the other page.",
                    error
                );

                return [];
            }
        })();

        return otherPageProductsPromise;
    }


    /* =====================================================
       6. BACKEND PRODUCT REQUESTS
    ===================================================== */

    function extractProductList(result) {
        if (Array.isArray(result)) {
            return result;
        }

        if (Array.isArray(result?.products)) {
            return result.products;
        }

        if (Array.isArray(result?.data)) {
            return result.data;
        }

        if (Array.isArray(result?.results)) {
            return result.results;
        }

        return [];
    }


    async function requestProductList(url) {
        const response = await fetch(
            url,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(
                `Product API returned HTTP ${response.status}`
            );
        }

        return extractProductList(
            await response.json()
        );
    }


    async function getBackendProducts() {
        if (!API_BASE_URL) {
            return [];
        }

        if (backendProductsPromise) {
            return backendProductsPromise;
        }

        backendProductsPromise = (async () => {
            try {
                const products = await requestProductList(
                    API_BASE_URL
                );

                return products
                    .map(normaliseProduct)
                    .filter(Boolean);

            } catch (error) {
                console.error(
                    "AM Electronics: Backend product request failed.",
                    error
                );

                return [];
            }
        })();

        return backendProductsPromise;
    }


    /* =====================================================
       7. MERGE PRODUCTS
    ===================================================== */

    function mergeProducts(...productGroups) {
        const merged = new Map();

        productGroups.flat().forEach(rawProduct => {
            const product = normaliseProduct(rawProduct);

            if (!product) return;

            const key = String(
                product._id ||
                product.id ||
                compactText(product.name)
            );

            const nameKey = compactText(product.name);

            const existingKey = merged.has(key)
                ? key
                : Array.from(merged.entries())
                    .find(([, value]) =>
                        compactText(value.name) === nameKey
                    )?.[0];

            const targetKey = existingKey || key;

            if (!merged.has(targetKey)) {
                merged.set(targetKey, product);
                return;
            }

            const existing = merged.get(targetKey);

            merged.set(targetKey, {
                ...existing,
                ...product,

                image:
                    existing.image ||
                    product.image,

                description:
                    existing.description ||
                    product.description,

                category:
                    existing.category ||
                    product.category,

                price:
                    existing.price > 0
                        ? existing.price
                        : product.price,

                originalPrice:
                    existing.originalPrice > 0
                        ? existing.originalPrice
                        : product.originalPrice,

                colors:
                    existing.colors.length
                        ? existing.colors
                        : product.colors,

                detailsURL:
                    existing.detailsURL ||
                    product.detailsURL
            });
        });

        return Array.from(merged.values());
    }


    /* =====================================================
       8. CATEGORY ALIASES
    ===================================================== */

    const CATEGORY_ALIASES = {
        smartwatches: [
            "smartwatch",
            "smartwatches",
            "watch",
            "watches"
        ],

        covers: [
            "cover",
            "covers",
            "phonecover",
            "phonecovers",
            "phonecase",
            "phonecases",
            "case",
            "cases"
        ],

        screenprotectors: [
            "screenprotector",
            "screenprotectors",
            "screenguard",
            "screenguards",
            "temperedglass"
        ],

        headphones: [
            "headphone",
            "headphones",
            "earpod",
            "earpods",
            "earbud",
            "earbuds",
            "earphone",
            "earphones"
        ],

        chargers: [
            "charger",
            "chargers",
            "cable",
            "cables",
            "chargingcable",
            "chargingcables"
        ],

        powerbanks: [
            "powerbank",
            "powerbanks",
            "portablecharger",
            "portablechargers"
        ]
    };


    function getCategoryGroup(query) {
        const compactQuery = compactText(query);

        for (const [group, aliases] of Object.entries(
            CATEGORY_ALIASES
        )) {
            if (aliases.includes(compactQuery)) {
                return group;
            }
        }

        return "";
    }


    function productMatchesCategory(product, group) {
        if (!group) return false;

        const category = compactText(
            product.category
        );

        const name = compactText(
            product.name
        );

        const patterns = {
            smartwatches: /smartwatch|watch/,
            covers: /cover|case/,
            screenprotectors:
                /screenprotector|screenguard|temperedglass/,
            headphones:
                /headphone|earpod|earbud|earphone/,
            chargers:
                /charger|cable/,
            powerbanks:
                /powerbank|portablecharger/
        };

        return patterns[group].test(category) ||
            patterns[group].test(name);
    }


    /* =====================================================
       9. PRODUCT MATCHING
    ===================================================== */

    function findMatchingProducts(query, products = catalogue) {
        const words = normaliseText(query)
            .split(/\s+/)
            .filter(Boolean);

        if (!words.length) {
            return [];
        }

        const categoryGroup = getCategoryGroup(query);

        return products.filter(product => {

            if (
                categoryGroup &&
                productMatchesCategory(
                    product,
                    categoryGroup
                )
            ) {
                return true;
            }

            const searchableText = normaliseText([
                product.name,
                product.category,
                product.description,
                product.id,
                ...(Array.isArray(product.colors)
                    ? product.colors
                    : [])
            ].join(" "));

            return words.every(word =>
                searchableText.includes(word)
            );
        });
    }


    /* =====================================================
       10. REDIRECT TO SHOP RESULTS
    ===================================================== */

    function performGlobalSearch(query) {
        const cleanQuery = String(
            query || ""
        ).trim();

        if (!cleanQuery) {
            return;
        }

        hideAutocompleteDropdown();

        const resultsURL = new URL(SHOP_PAGE);

        resultsURL.searchParams.set(
            "q",
            cleanQuery
        );

        window.location.href = resultsURL.href;
    }


    /* =====================================================
       11. AUTOCOMPLETE DROPDOWN
    ===================================================== */

    function createAutocompleteDropdown() {
        autocompleteDropdown =
            document.createElement("div");

        autocompleteDropdown.id =
            "jumiaNavbarDropdown";

        autocompleteDropdown.className =
            "jumia-search-dropdown";

        autocompleteDropdown.setAttribute(
            "role",
            "listbox"
        );

        autocompleteDropdown.hidden = true;

        autocompleteDropdown.style.cssText = [
            "position:absolute",
            "background:#fff",
            "border:1px solid #e0e0e0",
            "border-radius:0 0 8px 8px",
            "box-shadow:0 10px 28px rgba(0,0,0,.22)",
            "z-index:999999",
            "max-height:420px",
            "overflow-y:auto",
            "text-align:left"
        ].join(";");

        document.body.appendChild(
            autocompleteDropdown
        );

        document.addEventListener("click", event => {
            const clickedInput = searchInputs.some(input =>
                input === event.target ||
                input.contains(event.target)
            );

            if (
                !clickedInput &&
                !autocompleteDropdown.contains(event.target)
            ) {
                hideAutocompleteDropdown();
            }
        });

        window.addEventListener(
            "resize",
            positionAutocompleteDropdown,
            { passive: true }
        );

        window.addEventListener(
            "scroll",
            positionAutocompleteDropdown,
            { passive: true }
        );
    }


    function positionAutocompleteDropdown() {
        if (
            !autocompleteDropdown ||
            autocompleteDropdown.hidden ||
            !activeAutocompleteInput
        ) {
            return;
        }

        const targetContainer =
            activeAutocompleteInput.closest(
                "form, .search-bar, .navbar-search, .shop-search"
            ) || activeAutocompleteInput;

        const rect =
            targetContainer.getBoundingClientRect();

        Object.assign(
            autocompleteDropdown.style,
            {
                top: `${
                    rect.bottom + window.scrollY
                }px`,

                left: `${
                    rect.left + window.scrollX
                }px`,

                width: `${
                    Math.max(rect.width, 280)
                }px`
            }
        );
    }


    function hideAutocompleteDropdown() {
        if (autocompleteDropdown) {
            autocompleteDropdown.hidden = true;
        }
    }


    /* =====================================================
       12. DISPLAY AUTOCOMPLETE SUGGESTIONS
    ===================================================== */

    async function showAutocompleteSuggestions(
        inputElement,
        query
    ) {
        if (
            !autocompleteDropdown ||
            query.length < 2
        ) {
            hideAutocompleteDropdown();
            return;
        }

        const requestNumber =
            ++autocompleteRequestNumber;

        activeAutocompleteInput = inputElement;

        const [
            backendProducts,
            otherPageProducts
        ] = await Promise.all([
            getBackendProducts(),
            getProductsFromOtherPage()
        ]);

        if (
            requestNumber !== autocompleteRequestNumber ||
            inputElement.value.trim() !== query
        ) {
            return;
        }

        catalogue = mergeProducts(
            getCurrentPageProducts(),
            otherPageProducts,
            backendProducts
        );

        const matches = findMatchingProducts(
            query
        ).slice(0, 6);

        if (!matches.length) {
            autocompleteDropdown.innerHTML = `
                <div style="
                    padding:14px 16px;
                    color:#666;
                    font-size:14px;
                ">
                    No instant matches for
                    "<strong>${escapeHTML(query)}</strong>"
                </div>

                <button
                    type="button"
                    id="jumiaSeeAllResultsBtn"
                    style="
                        width:100%;
                        border:0;
                        padding:12px;
                        text-align:center;
                        font-weight:700;
                        font-size:13px;
                        color:#f68b1e;
                        cursor:pointer;
                        background:#fff8f0;
                    "
                >
                    SEARCH FOR
                    "${escapeHTML(query.toUpperCase())}"
                </button>
            `;

            autocompleteDropdown.hidden = false;

            positionAutocompleteDropdown();

            document
                .getElementById("jumiaSeeAllResultsBtn")
                ?.addEventListener("click", () => {
                    performGlobalSearch(query);
                });

            return;
        }

        let html = `
            <div style="
                padding:8px 14px;
                font-size:11px;
                font-weight:700;
                color:#75757d;
                text-transform:uppercase;
                background:#f5f5f5;
                border-bottom:1px solid #eee;
            ">
                Products
            </div>
        `;

        matches.forEach(product => {
            const url =
                product.detailsURL ||
                getProductDetailsURL(product);

            const imageMarkup = product.image
                ? `
                    <img
                        src="${escapeHTML(product.image)}"
                        alt=""
                        style="
                            width:42px;
                            height:42px;
                            object-fit:cover;
                            border-radius:4px;
                            background:#f5f5f5;
                            flex-shrink:0;
                        "
                        onerror="this.style.display='none'"
                    >
                `
                : `
                    <span
                        aria-hidden="true"
                        style="
                            width:42px;
                            height:42px;
                            display:block;
                            background:#f5f5f5;
                            border-radius:4px;
                            flex-shrink:0;
                        "
                    ></span>
                `;

            html += `
                <a
                    href="${escapeHTML(url)}"
                    style="
                        display:flex;
                        align-items:center;
                        gap:12px;
                        padding:10px 14px;
                        text-decoration:none;
                        color:#282828;
                        border-bottom:1px solid #f2f2f2;
                    "
                    onmouseover="
                        this.style.background='#fff8f0'
                    "
                    onmouseout="
                        this.style.background='#fff'
                    "
                >
                    ${imageMarkup}

                    <span style="
                        flex:1;
                        min-width:0;
                    ">
                        <span style="
                            display:block;
                            font-size:14px;
                            font-weight:500;
                            white-space:nowrap;
                            overflow:hidden;
                            text-overflow:ellipsis;
                        ">
                            ${escapeHTML(product.name)}
                        </span>

                        <span style="
                            display:block;
                            font-size:13px;
                            font-weight:700;
                            color:#f68b1e;
                        ">
                            ${escapeHTML(
                                formatPrice(product.price)
                            )}
                        </span>
                    </span>
                </a>
            `;
        });

        html += `
            <button
                type="button"
                id="jumiaSeeAllResultsBtn"
                style="
                    width:100%;
                    border:0;
                    padding:12px;
                    text-align:center;
                    font-weight:700;
                    font-size:13px;
                    color:#f68b1e;
                    cursor:pointer;
                    background:#fff8f0;
                "
            >
                SEE ALL RESULTS FOR
                "${escapeHTML(query.toUpperCase())}"
            </button>
        `;

        autocompleteDropdown.innerHTML = html;

        autocompleteDropdown.hidden = false;

        positionAutocompleteDropdown();

        document
            .getElementById("jumiaSeeAllResultsBtn")
            ?.addEventListener("click", () => {
                performGlobalSearch(query);
            });
    }


    /* =====================================================
       13. SEARCH INPUT EVENTS
    ===================================================== */

    searchInputs.forEach(input => {

        input.setAttribute(
            "autocomplete",
            "off"
        );

        input.addEventListener("input", function () {

            const query = this.value.trim();

            clearTimeout(searchDebounceTimer);

            if (query.length < 2) {
                hideAutocompleteDropdown();
                return;
            }

            searchDebounceTimer = setTimeout(() => {
                showAutocompleteSuggestions(
                    this,
                    query
                );
            }, 300);
        });


        input.addEventListener("keydown", function (event) {

            if (event.key === "Enter") {
                event.preventDefault();

                performGlobalSearch(
                    this.value
                );
            }

            if (event.key === "Escape") {
                hideAutocompleteDropdown();
            }
        });


        input.addEventListener("focus", function () {
            const query = this.value.trim();

            if (query.length >= 2) {
                showAutocompleteSuggestions(
                    this,
                    query
                );
            }
        });

    });


    /* =====================================================
       14. SEARCH BUTTON EVENTS
    ===================================================== */

    searchButtons.forEach(button => {

        button.addEventListener("click", function (event) {

            event.preventDefault();

            const searchContainer =
                button.closest(
                    "form, .navbar-search, .search-bar, .shop-search"
                );

            const associatedInput =
                searchContainer?.querySelector(
                    "input[type='search'], input[type='text']"
                ) ||
                searchInputs[0];

            if (associatedInput) {
                performGlobalSearch(
                    associatedInput.value
                );
            }
        });

    });


    /* =====================================================
       15. PREVENT SEARCH FORM PAGE RELOAD
    ===================================================== */

    document.querySelectorAll(
        "form"
    ).forEach(form => {

        const formInput = form.querySelector(
            "input[type='search'], input[type='text']"
        );

        if (!formInput || !searchInputs.includes(formInput)) {
            return;
        }

        form.addEventListener("submit", function (event) {

            event.preventDefault();

            performGlobalSearch(
                formInput.value
            );

        });

    });


    /* =====================================================
       16. INITIALISE
    ===================================================== */

    if (searchInputs.length) {
        createAutocompleteDropdown();
    }

    console.info(
        "AM Electronics: Global product search initialised."
    );

});