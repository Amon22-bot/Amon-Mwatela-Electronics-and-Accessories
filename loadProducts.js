/* =========================================================
   AM ELECTRONICS AND ACCESSORIES
   SEARCH-BASED SHOP PRODUCTS JAVASCRIPT

   Handles:
   1. Loading products from the backend
   2. Displaying search results only
   3. Category-based product results
   4. Homepage placement results
   5. Navbar search query parameters
   6. Improved product relevance ranking
   7. Category aliases and alternative search terms
   8. Shop product visibility protection
   9. Product card creation
   10. Price and discount formatting
   11. Loading, empty and error messages
   12. Accessibility and keyboard navigation
   13. Navigation to product-details.html

   IMPORTANT:
   - No filter buttons are required.
   - No shop-page search input is required.
   - No homepage sections are rendered here.
   - Products display only when a search,
     category or placement is provided.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    "use strict";


    /* =====================================================
       1. CONFIGURATION
    ===================================================== */

    const API_BASE_URL = (
        window.AM_API_BASE_URL || ""
    ).replace(/\/+$/, "");

    const PRODUCTS_ENDPOINT = `${API_BASE_URL}/api/products`;

    const PRODUCT_DETAILS_PAGE = "product-details.html";

    const PRODUCT_GRID_ID = "shopProductGrid";


    /* =====================================================
       2. PRODUCT CATEGORIES
    ===================================================== */

    const PRODUCT_CATEGORIES = [

        "covers",
        "screen-protectors",
        "headphones-earpods",
        "smartwatches",
        "chargers-cables",
        "power-banks",
        "phones",
        "bluetooth-speakers",
        "ring-lights",
        "gaming-accessories",
        "photography-lighting",
        "audio-sound",
        "storage-memory",
        "computer-accessories"

    ];


    /* =====================================================
       3. HOMEPAGE PLACEMENTS
    ===================================================== */

    const HOMEPAGE_PLACEMENTS = [

        "top-selling",
        "covers",
        "new-arrivals",
        "screen-protectors",
        "headphones-earpods",
        "smartwatches",
        "chargers-cables",
        "trending",
        "featured",
        "recommended",
        "explore",
        "must-have"

    ];


    /* =====================================================
       4. CATEGORY ALIASES
    ===================================================== */

    const CATEGORY_ALIASES = {

        "phone-covers": "covers",
        "phone-cover": "covers",
        "phone-cases": "covers",
        "phone-case": "covers",

        "screen-protector": "screen-protectors",

        "headphones": "headphones-earpods",
        "earpods": "headphones-earpods",
        "earbuds": "headphones-earpods",
        "headphones-and-earpods": "headphones-earpods",

        "smart-watches": "smartwatches",

        "chargers-and-cables": "chargers-cables",
        "charger-and-cable": "chargers-cables",

        "powerbanks": "power-banks",
        "powerbank": "power-banks",
        "power-bank": "power-banks",

        "bluetooth-speaker": "bluetooth-speakers",

        "gaming-accessory": "gaming-accessories",

        "photography-and-lighting": "photography-lighting",
        "photography-light": "photography-lighting",

        "computer-accessory": "computer-accessories"

    };


    /* =====================================================
       5. CATEGORY SEARCH TERMS

       Allows customers to search using common names
       rather than only the exact backend category.
    ===================================================== */

    const CATEGORY_SEARCH_TERMS = {

        "covers": [
            "phone cover",
            "phone covers",
            "phone case",
            "phone cases",
            "mobile cover",
            "mobile covers"
        ],

        "screen-protectors": [
            "screen protector",
            "screen protectors",
            "phone protector",
            "tempered glass"
        ],

        "headphones-earpods": [
            "headphones",
            "earpods",
            "earbuds",
            "earphones",
            "wireless earbuds"
        ],

        "smartwatches": [
            "smart watch",
            "smart watches",
            "watch"
        ],

        "chargers-cables": [
            "charger",
            "chargers",
            "charging cable",
            "charging cables",
            "usb cable",
            "type c cable"
        ],

        "power-banks": [
            "powerbank",
            "power bank",
            "power banks",
            "portable charger"
        ],

        "phones": [
            "smartphone",
            "smartphones",
            "mobile phone",
            "mobile phones"
        ],

        "bluetooth-speakers": [
            "bluetooth speaker",
            "bluetooth speakers",
            "wireless speaker",
            "wireless speakers"
        ],

        "ring-lights": [
            "ring light",
            "ring lights"
        ],

        "gaming-accessories": [
            "gaming accessory",
            "gaming accessories",
            "gaming equipment"
        ],

        "photography-lighting": [
            "photography",
            "photography lighting",
            "lighting equipment",
            "camera lighting"
        ],

        "audio-sound": [
            "audio",
            "sound equipment",
            "audio equipment"
        ],

        "storage-memory": [
            "storage",
            "memory",
            "memory cards",
            "flash drives",
            "usb drives"
        ],

        "computer-accessories": [
            "computer accessory",
            "computer accessories",
            "laptop accessories",
            "pc accessories"
        ]

    };


    /* =====================================================
       6. DOM ELEMENTS
    ===================================================== */

    const productGrid = document.getElementById(PRODUCT_GRID_ID);

    if (!productGrid) {

        console.error(
            `AM Electronics: #${PRODUCT_GRID_ID} was not found.`
        );

        return;

    }


    /* =====================================================
       7. STATE
    ===================================================== */

    let allProducts = [];

    let currentRequest = null;


    /* =====================================================
       8. TEXT NORMALIZATION
    ===================================================== */

    function normalizeText(value) {

        return String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[_\s]+/g, "-")
            .replace(/-+/g, "-");

    }


    function normalizeSearchText(value) {

        return String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, " ")
            .replace(/\s+/g, " ");

    }


    /* =====================================================
       9. CANONICAL CATEGORY
    ===================================================== */

    function getCanonicalCategory(category) {

        const normalized = normalizeText(category);

        return CATEGORY_ALIASES[normalized] || normalized;

    }


    /* =====================================================
       10. DOM ACCESSIBILITY STATE
    ===================================================== */

    function setBusyState(isBusy) {

        productGrid.setAttribute(
            "aria-busy",
            isBusy ? "true" : "false"
        );

    }


    /* =====================================================
       11. PRODUCT INFORMATION HELPERS
    ===================================================== */

    function getProductId(product) {

        return product?._id ||
               product?.id ||
               product?.productId ||
               "";

    }


    function getProductTitle(product) {

        return product?.title ||
               product?.name ||
               "Product";

    }


    function getProductImage(product) {

        return product?.image ||
               product?.imageUrl ||
               product?.thumbnail ||
               "";

    }


    function getProductDescription(product) {

        return product?.description || "";

    }


    function getProductPrice(product) {

        const price = Number(product?.price);

        return Number.isFinite(price) ? price : 0;

    }


    function getOriginalPrice(product) {

        const originalPrice = Number(product?.originalPrice);

        return Number.isFinite(originalPrice)
            ? originalPrice
            : 0;

    }


    function getProductCategory(product) {

        return getCanonicalCategory(product?.category);

    }


    /* =====================================================
       12. PRICE FORMATTING
    ===================================================== */

    function formatKES(amount) {

        const value = Number(amount);

        if (!Number.isFinite(value)) {
            return "KSh 0";
        }

        return "KSh " + value.toLocaleString("en-KE", {

            maximumFractionDigits: 2

        });

    }


    /* =====================================================
       13. DISCOUNT CALCULATION
    ===================================================== */

    function calculateDiscount(product) {

        const currentPrice = getProductPrice(product);

        const originalPrice = getOriginalPrice(product);

        if (
            originalPrice <= 0 ||
            currentPrice <= 0 ||
            originalPrice <= currentPrice
        ) {

            return 0;

        }

        return Math.round(

            ((originalPrice - currentPrice) / originalPrice) * 100

        );

    }


    /* =====================================================
       14. SHOP PRODUCT VISIBILITY

       Rules:

       1. Explicit showInShop:false means hidden.
       2. Explicit showInShop:true means visible.
       3. targetPage:"homepage" means hidden from Shop
          unless showInShop is explicitly true.
       4. targetPage:"shop" means visible unless explicitly
          disabled through showInShop:false.
       5. Older records without visibility fields remain
          compatible with the backend's Shop endpoint.

       IMPORTANT:
       The backend should also enforce Shop visibility.
    ===================================================== */

    function isProductVisibleInShop(product) {

        if (!product || typeof product !== "object") {
            return false;
        }

        if (product.showInShop === false) {
            return false;
        }

        if (product.showInShop === true) {
            return true;
        }

        const targetPage = normalizeText(product.targetPage);

        if (
            targetPage === "homepage" ||
            targetPage === "home-page"
        ) {

            return false;

        }

        if (
            targetPage === "shop" ||
            targetPage === "both" ||
            targetPage === "all"
        ) {

            return true;

        }

        return true;

    }


    /* =====================================================
       15. PRODUCT PLACEMENTS
    ===================================================== */

    function getProductPlacements(product) {

        const placements = new Set();


        if (Array.isArray(product?.placements)) {

            product.placements.forEach(function (placement) {

                const normalized = normalizeText(placement);

                if (
                    normalized &&
                    normalized !== "regular" &&
                    HOMEPAGE_PLACEMENTS.includes(normalized)
                ) {

                    placements.add(normalized);

                }

            });

        }


        const legacyPlacement = normalizeText(product?.placement);

        if (
            legacyPlacement &&
            legacyPlacement !== "regular" &&
            HOMEPAGE_PLACEMENTS.includes(legacyPlacement)
        ) {

            placements.add(legacyPlacement);

        }


        /*
         * Legacy compatibility:
         * Some older homepage products may have stored
         * their placement in the category field.
         */

        const explicitlyHomepageProduct =
            product?.targetPage === "homepage" ||
            product?.showOnHomepage === true;

        const hasNoRealPlacement =
            placements.size === 0 &&
            (
                !legacyPlacement ||
                legacyPlacement === "regular"
            );


        if (
            explicitlyHomepageProduct &&
            product?.showOnHomepage !== false &&
            hasNoRealPlacement
        ) {

            const category = normalizeText(product?.category);

            if (HOMEPAGE_PLACEMENTS.includes(category)) {

                placements.add(category);

            }

        }


        return Array.from(placements);

    }


    /* =====================================================
       16. PRODUCT CATEGORY MATCHING
    ===================================================== */

    function productMatchesCategory(product, selectedCategory) {

        if (!selectedCategory) {
            return true;
        }

        const productCategory = getProductCategory(product);

        const requestedCategory =
            getCanonicalCategory(selectedCategory);

        return productCategory === requestedCategory;

    }


    /* =====================================================
       17. PRODUCT PLACEMENT MATCHING
    ===================================================== */

    function productMatchesPlacement(product, selectedPlacement) {

        if (!selectedPlacement) {
            return true;
        }

        const requestedPlacement = normalizeText(selectedPlacement);

        const productPlacements = getProductPlacements(product);

        return productPlacements.includes(requestedPlacement);

    }


    /* =====================================================
       18. SEARCHABLE PRODUCT INFORMATION
    ===================================================== */

    function getSearchableProductText(product) {

        const placements = getProductPlacements(product);

        const features = Array.isArray(product?.features)
            ? product.features
            : [];

        const colors = Array.isArray(product?.colors)
            ? product.colors
            : [];


        return normalizeSearchText([

            product?.title,
            product?.name,
            product?.description,
            product?.brand,
            product?.model,
            product?.category,
            product?.placement,

            ...(Array.isArray(product?.placements)
                ? product.placements
                : []),

            ...features,
            ...colors,
            ...placements

        ].filter(Boolean).join(" "));

    }


    /* =====================================================
       19. CATEGORY SEARCH MATCHING
    ===================================================== */

    function getSearchCategory(searchQuery) {

        const normalizedQuery = normalizeText(searchQuery);

        const canonicalQuery = getCanonicalCategory(normalizedQuery);


        if (PRODUCT_CATEGORIES.includes(canonicalQuery)) {

            return canonicalQuery;

        }


        const normalizedSearch = normalizeSearchText(searchQuery);


        for (const category of PRODUCT_CATEGORIES) {

            const categoryTerms = CATEGORY_SEARCH_TERMS[category] || [];

            const matches = categoryTerms.some(function (term) {

                return normalizeSearchText(term) === normalizedSearch;

            });


            if (matches) {
                return category;
            }

        }


        return "";

    }


    function productMatchesSearchCategory(product, searchQuery) {

        const requestedCategory = getSearchCategory(searchQuery);

        if (!requestedCategory) {
            return false;
        }

        return getProductCategory(product) === requestedCategory;

    }


    /* =====================================================
       20. FUZZY MATCHING

       Allows minor spelling mistakes in search terms.
    ===================================================== */

    function levenshteinDistance(first, second) {

        if (first === second) {
            return 0;
        }

        if (!first.length) {
            return second.length;
        }

        if (!second.length) {
            return first.length;
        }


        const previousRow = Array.from(

            { length: second.length + 1 },

            (_, index) => index

        );


        for (let i = 0; i < first.length; i++) {

            let previousDiagonal = previousRow[0];

            previousRow[0] = i + 1;


            for (let j = 0; j < second.length; j++) {

                const oldValue = previousRow[j + 1];

                const cost = first[i] === second[j] ? 0 : 1;


                previousRow[j + 1] = Math.min(

                    previousRow[j + 1] + 1,

                    previousRow[j] + 1,

                    previousDiagonal + cost

                );


                previousDiagonal = oldValue;

            }

        }


        return previousRow[second.length];

    }


    function isFuzzyMatch(word, text) {

        if (!word || !text) {
            return false;
        }


        if (text.includes(word)) {
            return true;
        }


        if (word.length < 4) {
            return false;
        }


        const words = text.split(/\s+/).filter(Boolean);


        return words.some(function (item) {

            if (item.length < 4) {
                return false;
            }


            if (Math.abs(word.length - item.length) > 1) {
                return false;
            }


            return levenshteinDistance(word, item) <= 1;

        });

    }


    /* =====================================================
       21. PRODUCT SEARCH SCORING

       Priority:

       1. Exact product title
       2. Product title contains full query
       3. Exact category match
       4. Brand and model matches
       5. Other product information
       6. Description and feature matches

       Multiword searches require all search words to
       appear somewhere in the product information.

       This prevents unrelated partial results.
    ===================================================== */

    function scoreProductForSearch(product, searchQuery) {

        const query = normalizeSearchText(searchQuery);

        const title = normalizeSearchText(
            getProductTitle(product)
        );

        const description = normalizeSearchText(
            getProductDescription(product)
        );

        const brand = normalizeSearchText(product?.brand);

        const model = normalizeSearchText(product?.model);

        const category = normalizeSearchText(
            getProductCategory(product)
        );

        const searchableText = getSearchableProductText(product);


        const searchWords = query.split(/\s+/).filter(Boolean);

        if (!searchWords.length) {
            return 0;
        }


        let score = 0;

        let matchedWords = 0;


        /* EXACT TITLE */

        if (title === query) {

            score += 200;

        }


        /* TITLE CONTAINS FULL QUERY */

        if (title.includes(query)) {

            score += 120;

        }


        /* EXACT CATEGORY */

        if (productMatchesSearchCategory(product, searchQuery)) {

            score += 100;

        }


        /* BRAND AND MODEL */

        if (brand === query) {

            score += 85;

        } else if (brand.includes(query)) {

            score += 65;

        }


        if (model === query) {

            score += 85;

        } else if (model.includes(query)) {

            score += 65;

        }


        /* OTHER COMPLETE PHRASE MATCHES */

        if (
            searchableText.includes(query) &&
            !title.includes(query)
        ) {

            score += 45;

        }


        /* INDIVIDUAL WORD MATCHES */

        searchWords.forEach(function (word) {

            let matched = false;


            if (title.split(/\s+/).includes(word)) {

                score += 25;

                matched = true;

            } else if (isFuzzyMatch(word, title)) {

                score += 12;

                matched = true;

            }


            if (category.includes(word)) {

                score += 20;

                matched = true;

            }


            if (
                brand.includes(word) ||
                model.includes(word)
            ) {

                score += 18;

                matched = true;

            }


            if (
                description.includes(word) ||
                searchableText.includes(word)
            ) {

                score += 7;

                matched = true;

            }


            if (
                !matched &&
                isFuzzyMatch(word, searchableText)
            ) {

                score += 3;

                matched = true;

            }


            if (matched) {
                matchedWords++;
            }

        });


        /*
         * Reject incomplete multiword matches.
         *
         * Example:
         * "Samsung Galaxy" should not return a product
         * that only matches "Samsung".
         */

        if (matchedWords !== searchWords.length) {

            return 0;

        }


        return score;

    }


    /* =====================================================
       22. ESCAPE HTML
    ===================================================== */

    function escapeHTML(value) {

        return String(value ?? "").replace(/[&<>"']/g, function (character) {

            const entities = {

                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"

            };

            return entities[character];

        });

    }


    /* =====================================================
       23. LOADING MESSAGE
    ===================================================== */

    function showLoadingMessage() {

        setBusyState(true);


        productGrid.innerHTML = `

            <div class="shop-loading">

                <div class="shop-loading-spinner"></div>

                <p>Loading products...</p>

            </div>

        `;

    }


    /* =====================================================
       24. EMPTY RESULTS MESSAGE
    ===================================================== */

    function showEmptyMessage(searchQuery = "") {

        setBusyState(false);


        let message = "No products were found.";


        if (searchQuery) {

            message = `No products found for "${escapeHTML(searchQuery)}".`;

        }


        productGrid.innerHTML = `

            <div class="shop-empty-state">

                <i class="fa-solid fa-magnifying-glass"></i>

                <h3>No Products Found</h3>

                <p>${message}</p>

            </div>

        `;

    }


    /* =====================================================
       25. INITIAL SHOP MESSAGE
    ===================================================== */

    function showInitialMessage() {

        setBusyState(false);


        productGrid.innerHTML = `

            <div class="shop-empty-state">

                <i class="fa-solid fa-magnifying-glass"></i>

                <h3>Find What You Need</h3>

                <p>
                    Search for a product to see matching results.
                </p>

            </div>

        `;

    }


    /* =====================================================
       26. ERROR MESSAGE
    ===================================================== */

    function showConnectionError() {

        setBusyState(false);


        productGrid.innerHTML = `

            <div class="shop-error-state">

                <i class="fa-solid fa-circle-exclamation"></i>

                <h3>Unable to Load Products</h3>

                <p>
                    We could not connect to the product server.
                    Please check your connection and try again.
                </p>

                <button
                    type="button"
                    class="shop-retry-button"
                    id="shopRetryButton"
                >

                    Try Again

                </button>

            </div>

        `;


        const retryButton = document.getElementById(
            "shopRetryButton"
        );


        if (retryButton) {

            retryButton.addEventListener("click", function () {

                loadProducts();

            });

        }

    }


    /* =====================================================
       27. EXTRACT PRODUCT LIST
    ===================================================== */

    function extractProductList(data) {

        if (Array.isArray(data)) {
            return data;
        }


        if (Array.isArray(data?.products)) {
            return data.products;
        }


        if (Array.isArray(data?.data)) {
            return data.data;
        }


        return [];

    }


    /* =====================================================
       28. FETCH PRODUCTS
    ===================================================== */

    async function fetchProducts() {

        if (!API_BASE_URL) {

            throw new Error(

                "AM_API_BASE_URL is not configured. " +
                "Check api-config.js."

            );

        }


        if (currentRequest) {

            currentRequest.abort();

        }


        const requestController = new AbortController();

        currentRequest = requestController;


        const response = await fetch(PRODUCTS_ENDPOINT, {

            method: "GET",

            headers: {

                "Accept": "application/json"

            },

            signal: requestController.signal

        });


        if (!response.ok) {

            throw new Error(

                `Product request failed: ${response.status}`

            );

        }


        const data = await response.json();


        return extractProductList(data);

    }


    /* =====================================================
       29. CREATE PRODUCT IMAGE
    ===================================================== */

    function createProductImage(product) {

        const imageContainer = document.createElement("div");

        imageContainer.className = "shop-product-image";


        const image = getProductImage(product);

        const title = getProductTitle(product);


        if (image) {

            const img = document.createElement("img");

            img.src = image;

            img.alt = title;

            img.loading = "lazy";

            img.decoding = "async";


            img.onerror = function () {

                const placeholder = document.createElement("div");

                placeholder.className = "shop-image-placeholder";

                placeholder.textContent = "Image unavailable";

                imageContainer.replaceChildren(placeholder);

            };


            imageContainer.appendChild(img);

        } else {

            const placeholder = document.createElement("div");

            placeholder.className = "shop-image-placeholder";

            placeholder.textContent = "No Image Available";

            imageContainer.appendChild(placeholder);

        }


        return imageContainer;

    }


    /* =====================================================
       30. CREATE PRODUCT PRICING
    ===================================================== */

    function createProductPricing(product) {

        const priceContainer = document.createElement("div");

        priceContainer.className = "shop-product-pricing";


        const price = getProductPrice(product);

        const originalPrice = getOriginalPrice(product);

        const discount = calculateDiscount(product);


        /*
         * Original price and discount badge are displayed
         * only when a valid discount exists.
         */

        if (discount > 0) {

            const originalPriceElement = document.createElement("span");

            originalPriceElement.className = "shop-original-price";

            originalPriceElement.textContent = formatKES(originalPrice);


            const discountBadge = document.createElement("span");

            discountBadge.className = "shop-discount-badge";

            discountBadge.textContent = `${discount}%`;


            priceContainer.appendChild(originalPriceElement);

            priceContainer.appendChild(discountBadge);

        }


        const currentPrice = document.createElement("span");

        currentPrice.className = "shop-current-price";

        currentPrice.textContent = formatKES(price);


        priceContainer.appendChild(currentPrice);


        return priceContainer;

    }


    /* =====================================================
       31. CREATE PRODUCT CARD
    ===================================================== */

    function createProductCard(product) {

        const productId = getProductId(product);

        const title = getProductTitle(product);

        const description = getProductDescription(product);


        const card = document.createElement("article");

        card.className = "shop-product-card";

        card.setAttribute("role", "link");

        card.setAttribute("tabindex", "0");

        card.setAttribute(

            "aria-label",

            `View ${title} details`

        );


        /* PRODUCT IMAGE */

        const imageContainer = createProductImage(product);


        /* PRODUCT DETAILS */

        const details = document.createElement("div");

        details.className = "shop-product-details";


        /* PRODUCT TITLE */

        const productTitle = document.createElement("h3");

        productTitle.className = "shop-product-title";

        productTitle.textContent = title;


        /* PRODUCT DESCRIPTION */

        const productDescription = document.createElement("p");

        productDescription.className = "shop-product-description";

        productDescription.textContent = description;


        /* PRODUCT PRICING */

        const priceContainer = createProductPricing(product);


        /* ASSEMBLE CARD */

        details.appendChild(productTitle);


        if (description) {

            details.appendChild(productDescription);

        }


        details.appendChild(priceContainer);

        card.appendChild(imageContainer);

        card.appendChild(details);


        /* PRODUCT NAVIGATION */

        function openProduct() {

            if (!productId) {

                console.error(

                    "This product does not have a valid ID:",

                    product

                );

                return;

            }


            window.location.href =

                `${PRODUCT_DETAILS_PAGE}?id=${encodeURIComponent(productId)}`;

        }


        card.addEventListener("click", openProduct);


        card.addEventListener("keydown", function (event) {

            if (

                event.key === "Enter" ||

                event.key === " "

            ) {

                event.preventDefault();

                openProduct();

            }

        });


        return card;

    }


    /* =====================================================
       32. DISPLAY PRODUCTS
    ===================================================== */

    function displayProducts(products, searchQuery = "") {

        productGrid.innerHTML = "";


        if (!products.length) {

            showEmptyMessage(searchQuery);

            return;

        }


        const fragment = document.createDocumentFragment();


        products.forEach(function (product) {

            fragment.appendChild(

                createProductCard(product)

            );

        });


        productGrid.appendChild(fragment);

        setBusyState(false);

    }


    /* =====================================================
       33. READ URL PARAMETERS
    ===================================================== */

    function readURLParameters() {

        const params = new URLSearchParams(

            window.location.search

        );


        let category = params.get("category") || "";

        let placement = params.get("placement") || "";

        const filter = params.get("filter") || "";


        const searchQuery =

            params.get("q") ||

            params.get("search") ||

            "";


        category = getCanonicalCategory(category);

        placement = normalizeText(placement);


        /*
         * Compatibility with older links using ?filter=
         */

        if (filter && !category && !placement) {

            const normalizedFilter = normalizeText(filter);

            const canonicalFilter =

                getCanonicalCategory(normalizedFilter);


            if (PRODUCT_CATEGORIES.includes(canonicalFilter)) {

                category = canonicalFilter;

            } else if (

                HOMEPAGE_PLACEMENTS.includes(normalizedFilter)

            ) {

                placement = normalizedFilter;

            }

        }


        if (!PRODUCT_CATEGORIES.includes(category)) {

            category = "";

        }


        if (!HOMEPAGE_PLACEMENTS.includes(placement)) {

            placement = "";

        }


        return {

            category,

            placement,

            searchQuery: searchQuery.trim()

        };

    }


    /* =====================================================
       34. FILTER AND RANK PRODUCTS
    ===================================================== */

    function filterAndDisplayProducts() {

        const {

            category,

            placement,

            searchQuery

        } = readURLParameters();


        /*
         * Never display the entire catalogue automatically.
         */

        if (!category && !placement && !searchQuery) {

            showInitialMessage();

            return;

        }


        /*
         * First enforce Shop visibility and category/placement
         * requirements.
         */

        let filteredProducts = allProducts.filter(function (product) {

            return (

                isProductVisibleInShop(product) &&

                productMatchesCategory(product, category) &&

                productMatchesPlacement(product, placement)

            );

        });


        /* SEARCH RESULTS AND RELEVANCE RANKING */

        if (searchQuery) {

            filteredProducts = filteredProducts

                .map(function (product) {

                    return {

                        product,

                        score: scoreProductForSearch(

                            product,

                            searchQuery

                        )

                    };

                })


                .filter(function (item) {

                    return item.score > 0;

                })


                .sort(function (a, b) {

                    return b.score - a.score;

                })


                .map(function (item) {

                    return item.product;

                });

        }


        displayProducts(filteredProducts, searchQuery);

    }


    /* =====================================================
       35. MAIN LOAD FUNCTION
    ===================================================== */

    async function loadProducts() {

        showLoadingMessage();


        try {

            const products = await fetchProducts();


            /*
             * Ignore an outdated request if a newer request
             * has replaced it.
             */

            if (
                !currentRequest ||
                currentRequest.signal.aborted
            ) {

                return;

            }


            allProducts = products.filter(function (product) {

                return isProductVisibleInShop(product);

            });


            filterAndDisplayProducts();

        } catch (error) {

            if (error.name === "AbortError") {

                return;

            }


            console.error(

                "AM Electronics product loading error:",

                error

            );


            showConnectionError();

        }

    }


    /* =====================================================
       36. HANDLE BROWSER BACK/FORWARD
    ===================================================== */

    window.addEventListener("popstate", function () {

        filterAndDisplayProducts();

    });


    /* =====================================================
       37. OPTIONAL PUBLIC FUNCTIONS
    ===================================================== */

    window.reloadShopProducts = function () {

        loadProducts();

    };


    window.filterShopProducts = function (category) {

        const canonicalCategory =

            getCanonicalCategory(category);


        if (!PRODUCT_CATEGORIES.includes(canonicalCategory)) {

            return;

        }


        const params = new URLSearchParams();

        params.set("category", canonicalCategory);


        window.history.pushState(

            {},

            "",

            `${window.location.pathname}?${params.toString()}`

        );


        filterAndDisplayProducts();

    };


    /* =====================================================
       38. INITIALIZE SHOP PAGE
    ===================================================== */

    loadProducts();

});