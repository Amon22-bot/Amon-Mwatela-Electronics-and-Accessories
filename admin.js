"use strict";

/* =========================================
   API CONFIGURATION
========================================= */

const API_BASE = String(window.AM_API_BASE_URL || "").replace(/\/+$/, "");

if (!API_BASE) {
    console.error("AM_API_BASE_URL is missing. Check api-config.js.");
}

const ORDERS_API = `${API_BASE}/api/orders`;
const PRODUCTS_API = `${API_BASE}/api/products`;
const SITE_ASSETS_API = `${API_BASE}/api/site-assets`;

const ADMIN_TOKEN_KEY = "ameAdminSession";

let adminToken = sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
let cachedProducts = [];

const adminPreviewUrls = new Set();
const productPreviewUrls = new Set();

let editingProductId = null;
let editingProduct = null;

const $ = selector => document.querySelector(selector);

const loginSection = $("#adminLogin");
const adminApp = $("#adminApp");
const loginForm = $("#adminLoginForm");
const loginMessage = $("#loginMessage");
const loginButton = $("#loginButton");
const connectionStatus = $("#connectionStatus");


/* =========================================
   GENERAL HELPERS
========================================= */

function showMessage(element, message, type = "info") {
    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`;
}

function clearMessage(element) {
    if (!element) return;

    element.textContent = "";
    element.className = "message";
}

function money(value) {
    return "KSh " + Number(value || 0).toLocaleString("en-KE", {
        maximumFractionDigits: 2
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getAdminHeaders(extra = {}) {
    const headers = { ...extra };

    if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
    }

    return headers;
}

async function apiRequest(url, options = {}) {
    if (!API_BASE) {
        throw new Error(
            "The API address is missing. Check your api-config.js file."
        );
    }

    const response = await fetch(url, {
        ...options,
        headers: {
            ...getAdminHeaders(),
            ...(options.headers || {})
        }
    });

    let data = {};

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (response.status === 401 || response.status === 403) {
        showLogin(
            "Your admin session has expired or you are not authorised. Please sign in again."
        );

        throw new Error(
            "Your admin session has expired or you are not authorised."
        );
    }

    if (!response.ok) {
        const validationErrors = Array.isArray(data.errors)
            ? data.errors.map(error =>
                typeof error === "string"
                    ? error
                    : error.message || JSON.stringify(error)
            ).join(" ")
            : "";

        throw new Error(
            data.message ||
            data.error ||
            validationErrors ||
            `Request failed (${response.status}).`
        );
    }

    return data;
}

function getArray(data, possibleKeys = []) {
    if (Array.isArray(data)) return data;

    for (const key of possibleKeys) {
        if (Array.isArray(data?.[key])) {
            return data[key];
        }
    }

    return [];
}

function getErrorMessage(error) {
    return error?.message || "Something went wrong. Please try again.";
}

function getProductId(product) {
    return product?._id || product?.id || "";
}

function parseArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);

            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}


/* =========================================
   LOGIN AND LOGOUT
========================================= */

function showAdmin() {
    if (loginSection) loginSection.hidden = true;
    if (adminApp) adminApp.hidden = false;

    if (connectionStatus) {
        connectionStatus.textContent = "Admin signed in";
    }

    loadOrders();
    loadProducts();
    loadWebsiteAssets();
}

function showLogin(message = "") {
    adminToken = "";

    clearAdminPreviewUrls();
    clearProductPreviewUrls();

    sessionStorage.removeItem(ADMIN_TOKEN_KEY);

    if (adminApp) adminApp.hidden = true;
    if (loginSection) loginSection.hidden = false;

    if (connectionStatus) {
        connectionStatus.textContent = "Not signed in";
    }

    if (message) {
        showMessage(loginMessage, message, "error");
    }
}

if (loginForm) {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();

        clearMessage(loginMessage);

        const password = $("#adminPassword")?.value.trim();

        if (!password) {
            showMessage(
                loginMessage,
                "Enter your admin password.",
                "error"
            );

            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = "Signing in...";

        try {
            const response = await fetch(`${ORDERS_API}/admin/login`, {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({ password })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message || data.error || "Login failed."
                );
            }

            const token =
                data.token ||
                data.accessToken ||
                data.sessionToken ||
                data.adminToken;

            if (!token) {
                throw new Error(
                    "The server did not return an admin session token. Check your login API response."
                );
            }

            adminToken = token;

            sessionStorage.setItem(
                ADMIN_TOKEN_KEY,
                adminToken
            );

            loginForm.reset();

            showAdmin();

        } catch (error) {
            showMessage(
                loginMessage,
                getErrorMessage(error),
                "error"
            );

        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "Sign In";
        }
    });
}

$("#logoutButton")?.addEventListener("click", async () => {
    try {
        await fetch(`${ORDERS_API}/admin/logout`, {
            method: "POST",
            headers: getAdminHeaders()
        });

    } catch (error) {
        console.warn(
            "Logout request could not be completed:",
            error
        );
    }

    showLogin();
});


/* =========================================
   ADMIN NAVIGATION TABS
========================================= */

function activateAdminPanel(panelId) {
    document.querySelectorAll(".tab-button").forEach(tab => {
        tab.classList.remove("active");
    });

    document.querySelectorAll(".admin-panel").forEach(panel => {
        panel.hidden = true;
    });

    const targetPanel = document.getElementById(panelId);

    if (!targetPanel) return;

    targetPanel.hidden = false;

    const targetButton = document.querySelector(
        `.tab-button[data-panel="${panelId}"]`
    );

    if (targetButton) {
        targetButton.classList.add("active");
    }
}

document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
        activateAdminPanel(button.dataset.panel);
    });
});


/* =========================================
   CUSTOMER ORDERS
========================================= */

const ordersList = $("#ordersList");
const ordersMessage = $("#ordersMessage");

function getCustomerName(order) {
    return (
        order.customerName ||
        order.name ||
        order.customer?.name ||
        order.shippingAddress?.name ||
        "Customer"
    );
}

function getCustomerPhone(order) {
    return (
        order.phone ||
        order.customerPhone ||
        order.customer?.phone ||
        order.shippingAddress?.phone ||
        "Not provided"
    );
}

function getOrderItems(order) {
    return order.items || order.products || order.cart || [];
}


/* =========================================
   ORDER PRODUCT IMAGE HELPER
========================================= */

function getOrderItemImage(item) {
    const image =
        item.image ||
        item.productImage ||
        item.imageUrl;

    if (typeof image === "string" && image.trim()) {
        const imageValue = image.trim();

        if (
            imageValue.startsWith("https://") ||
            imageValue.startsWith("http://") ||
            imageValue.startsWith("data:") ||
            imageValue.startsWith("blob:")
        ) {
            return imageValue;
        }

        if (imageValue.startsWith("/")) {
            return `${API_BASE}${imageValue}`;
        }

        return `${API_BASE}/${imageValue}`;
    }

    if (image && typeof image === "object") {
        if (image.url) {
            return getOrderItemImage({
                image: image.url
            });
        }

        if (image.fileId) {
            return `${PRODUCTS_API}/image/${encodeURIComponent(image.fileId)}`;
        }
    }

    if (item.imageFileId) {
        return `${PRODUCTS_API}/image/${encodeURIComponent(item.imageFileId)}`;
    }

    return "";
}


/* =========================================
   ORDER PRODUCT IMAGE PLACEHOLDER
========================================= */

function createOrderImagePlaceholder() {
    const placeholder = document.createElement("div");

    placeholder.className = "order-item-image-placeholder";

    const icon = document.createElement("i");

    icon.className = "fa-solid fa-image";
    icon.setAttribute("aria-hidden", "true");

    placeholder.appendChild(icon);

    return placeholder;
}


/* =========================================
   RENDER CUSTOMER ORDER
========================================= */

function renderOrder(order) {
    const orderId = order._id || order.id;

    const reference =
        order.reference ||
        order.orderNumber ||
        orderId ||
        "Order";

    const status = ["new", "dispatched"].includes(order.status)
        ? order.status
        : "new";

    const items = getOrderItems(order);

    const date = order.createdAt
        ? new Date(order.createdAt).toLocaleString("en-KE")
        : "Date unavailable";

    const itemHTML = items.map(item => {
        const name = item.title || item.name || "Product";
        const quantity = Number(item.quantity || 1);
        const price = Number(item.price || 0);

        const imageUrl = getOrderItemImage(item);

        return `
            <div class="order-item">

                <div class="order-item-product">

                    ${
                        imageUrl
                            ? `
                                <img
                                    class="order-item-image"
                                    src="${escapeHTML(imageUrl)}"
                                    alt="${escapeHTML(name)}"
                                    loading="lazy"
                                >
                            `
                            : `
                                <div class="order-item-image-placeholder">
                                    <i class="fa-solid fa-image"></i>
                                </div>
                            `
                    }

                    <div class="order-item-information">
                        <strong>${escapeHTML(name)}</strong>
                        <p>Quantity: ${quantity}</p>
                    </div>

                </div>

                <strong class="order-item-price">
                    ${money(price * quantity)}
                </strong>

            </div>
        `;
    }).join("");

    const total = Number(
        order.totalAmount ??
        order.total ??
        order.grandTotal ??
        0
    );

    const article = document.createElement("article");

    article.className = "order-card";

    article.innerHTML = `
        <div class="order-heading">

            <div>
                <h3>${escapeHTML(reference)}</h3>
                <p>Placed: ${escapeHTML(date)}</p>
            </div>

            <select class="order-status" aria-label="Order status">

                <option value="new" ${status === "new" ? "selected" : ""}>
                    New
                </option>

                <option value="dispatched" ${status === "dispatched" ? "selected" : ""}>
                    Dispatched
                </option>

            </select>

        </div>

        <div class="order-body">

            <div class="order-details">

                <div class="order-detail">
                    <strong>Customer</strong>
                    ${escapeHTML(getCustomerName(order))}
                </div>

                <div class="order-detail">
                    <strong>Phone</strong>
                    ${escapeHTML(getCustomerPhone(order))}
                </div>

                <div class="order-detail">
                    <strong>Email</strong>
                    ${escapeHTML(
                        order.email ||
                        order.customer?.email ||
                        "Not provided"
                    )}
                </div>

                <div class="order-detail">
                    <strong>Delivery address</strong>
                    ${escapeHTML(
                        order.address ||
                        order.deliveryAddress ||
                        order.shippingAddress?.address ||
                        "Not provided"
                    )}
                </div>

            </div>

            <div class="order-items">

                ${itemHTML || "<p>No item details returned by the server.</p>"}

            </div>

            <div class="order-total">
                <span>Order total</span>
                <strong>${money(total)}</strong>
            </div>

        </div>
    `;


    /* =====================================
       HANDLE BROKEN PRODUCT IMAGES
    ===================================== */

    article.querySelectorAll(".order-item-image").forEach(image => {
        image.addEventListener("error", () => {
            image.replaceWith(
                createOrderImagePlaceholder()
            );
        });
    });


    /* =====================================
       ORDER STATUS UPDATE
    ===================================== */

    const statusSelect = article.querySelector(".order-status");

    statusSelect.addEventListener("change", async () => {
        if (!orderId) {
            showMessage(
                ordersMessage,
                "This order does not have an ID that can be updated.",
                "error"
            );

            return;
        }

        const newStatus = statusSelect.value;

        statusSelect.disabled = true;

        try {
            await apiRequest(
                `${ORDERS_API}/admin/orders/${encodeURIComponent(orderId)}/status`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        status: newStatus
                    })
                }
            );

            showMessage(
                ordersMessage,
                "Order status updated.",
                "success"
            );

        } catch (error) {
            showMessage(
                ordersMessage,
                getErrorMessage(error),
                "error"
            );

            statusSelect.value = status;

        } finally {
            statusSelect.disabled = false;
        }
    });

    return article;
}


/* =========================================
   LOAD CUSTOMER ORDERS
========================================= */

async function loadOrders() {
    if (!ordersList) return;

    ordersList.innerHTML =
        '<p class="empty-state">Loading orders...</p>';

    clearMessage(ordersMessage);

    try {
        const data = await apiRequest(
            `${ORDERS_API}/admin/orders`
        );

        const orders = getArray(data, ["orders", "data"]);

        ordersList.replaceChildren();

        if (!orders.length) {
            ordersList.innerHTML =
                '<p class="empty-state">No customer orders found.</p>';

            return;
        }

        orders.forEach(order => {
            ordersList.appendChild(renderOrder(order));
        });

    } catch (error) {
        ordersList.innerHTML =
            '<p class="empty-state">Could not load orders.</p>';

        showMessage(
            ordersMessage,
            getErrorMessage(error),
            "error"
        );
    }
}

$("#refreshOrders")?.addEventListener("click", loadOrders);


/* =========================================
   PRODUCT CATEGORY AND ASSIGNMENT LABELS
========================================= */

const PRODUCT_CATEGORY_LABELS = {
    "covers": "Phone Covers",
    "screen-protectors": "Screen Protectors",
    "headphones-earpods": "Headphones & Earpods",
    "smartwatches": "Smartwatches",
    "chargers-cables": "Chargers & Cables",
    "power-banks": "Power Banks",
    "gaming-accessories": "Gaming Accessories",
    "photography-lighting": "Photography & Lighting",
    "audio-sound": "Audio & Sound",
    "storage-memory": "Storage & Memory",
    "computer-accessories": "Computer Accessories"
};

const HOMEPAGE_PLACEMENT_LABELS = {
    "top-selling": "Top Selling",
    "new-arrivals": "New Arrivals",
    "covers": "Phone Covers",
    "screen-protectors": "Screen Protectors",
    "headphones-earpods": "Headphones & Earpods",
    "smartwatches": "Smartwatches",
    "chargers-cables": "Chargers & Cables",
    "power-banks": "Power Banks"
};

const SHOP_COLLECTION_LABELS = {
    "trending": "Trending",
    "featured": "Featured",
    "recommended": "Recommended",
    "must-have": "Must Have",
    "explore": "Explore"
};

const HOMEPAGE_PLACEMENT_VALUES = Object.keys(
    HOMEPAGE_PLACEMENT_LABELS
);

const SHOP_COLLECTION_VALUES = Object.keys(
    SHOP_COLLECTION_LABELS
);


/* =========================================
   PRODUCT ASSIGNMENT HELPERS
========================================= */

function getProductPlacements(product) {
    const rawPlacements = [
        ...parseArray(product.placements)
    ];

    if (product.placement && product.placement !== "regular") {
        rawPlacements.push(product.placement);
    }

    return [...new Set(
        rawPlacements.filter(value =>
            typeof value === "string" &&
            HOMEPAGE_PLACEMENT_VALUES.includes(value)
        )
    )];
}

function getProductCollections(product) {
    const rawCollections = [
        ...parseArray(product.collections),
        ...parseArray(product.placements)
    ];

    if (product.placement && product.placement !== "regular") {
        rawCollections.push(product.placement);
    }

    return [...new Set(
        rawCollections.filter(value =>
            typeof value === "string" &&
            SHOP_COLLECTION_VALUES.includes(value)
        )
    )];
}

function getCategoryLabel(category) {
    return (
        PRODUCT_CATEGORY_LABELS[category] ||
        category ||
        "Not specified"
    );
}

function getPlacementLabels(product) {
    const placements = getProductPlacements(product);

    if (!placements.length) {
        return "None";
    }

    return placements.map(placement =>
        HOMEPAGE_PLACEMENT_LABELS[placement]
    ).join(", ");
}

function getCollectionLabels(product) {
    const collections = getProductCollections(product);

    if (!collections.length) {
        return "None";
    }

    return collections.map(collection =>
        SHOP_COLLECTION_LABELS[collection]
    ).join(", ");
}


/* =========================================
   PRODUCT IMAGE PREVIEW HELPERS
========================================= */

function clearProductPreviewUrls() {
    productPreviewUrls.forEach(url => {
        URL.revokeObjectURL(url);
    });

    productPreviewUrls.clear();
}

function getProductImageSource(value, fileId = "") {
    if (typeof value === "string" && value.trim()) {
        if (
            value.startsWith("https://") ||
            value.startsWith("http://") ||
            value.startsWith("data:") ||
            value.startsWith("blob:")
        ) {
            return value;
        }

        if (value.startsWith("/")) {
            return `${API_BASE}${value}`;
        }

        return `${API_BASE}/${value}`;
    }

    if (value && typeof value === "object") {
        if (value.url) {
            return getProductImageSource(value.url);
        }

        if (value.fileId) {
            return `${PRODUCTS_API}/image/${value.fileId}`;
        }
    }

    if (fileId) {
        return `${PRODUCTS_API}/image/${fileId}`;
    }

    return "";
}

function getExistingProductImages(product) {
    const images = [];

    const mainImage = getProductImageSource(
        product.image,
        product.imageFileId
    );

    if (mainImage) {
        images.push({
            url: mainImage,
            alt: product.title || product.name || "Product image"
        });
    }

    const extraImages = Array.isArray(product.extraImages)
        ? product.extraImages
        : [];

    extraImages.forEach((image, index) => {
        const url = getProductImageSource(image);

        if (url) {
            images.push({
                url,
                alt: `${product.title || "Product"} image ${index + 2}`
            });
        }
    });

    return images.slice(0, 4);
}

function getProductImagePreviewElement() {
    let preview = $("#productImagePreview");

    if (preview) return preview;

    const imageInput = $("#productImageFile");

    if (!imageInput) return null;

    preview = document.createElement("div");

    preview.id = "productImagePreview";
    preview.className = "product-image-preview";

    imageInput.insertAdjacentElement("afterend", preview);

    return preview;
}

function renderProductImagePreview(images, message = "") {
    const preview = getProductImagePreviewElement();

    if (!preview) return;

    preview.replaceChildren();

    if (message) {
        const note = document.createElement("p");

        note.className = "image-preview-message";
        note.textContent = message;

        preview.appendChild(note);
    }

    if (!images.length) {
        if (!message) {
            preview.textContent = "No product images selected.";
        }

        return;
    }

    const grid = document.createElement("div");

    grid.className = "product-image-preview-grid";

    images.forEach(item => {
        const wrapper = document.createElement("div");

        wrapper.className = "product-image-preview-item";

        const image = document.createElement("img");

        image.src = item.url;
        image.alt = item.alt || "Product image";

        image.loading = "lazy";

        image.onerror = () => {
            wrapper.textContent = "Preview unavailable";
        };

        wrapper.appendChild(image);
        grid.appendChild(wrapper);
    });

    preview.appendChild(grid);
}

function previewExistingProductImages(product) {
    const images = getExistingProductImages(product);

    renderProductImagePreview(
        images,
        "Existing images will be retained unless you select replacement images."
    );
}

function previewSelectedProductImages(files) {
    clearProductPreviewUrls();

    const images = [];

    Array.from(files).forEach((file, index) => {
        const url = URL.createObjectURL(file);

        productPreviewUrls.add(url);

        images.push({
            url,
            alt: `Selected product image ${index + 1}`
        });
    });

    renderProductImagePreview(
        images,
        `${images.length} replacement image(s) selected. They will replace the existing image set.`
    );
}


/* =========================================
   PRODUCT MANAGEMENT
========================================= */

const productsList = $("#productsList");
const productsMessage = $("#productsMessage");

async function loadProducts() {
    if (!productsList) return;

    productsList.innerHTML =
        '<p class="empty-state">Loading products...</p>';

    clearMessage(productsMessage);

    try {
        const data = await apiRequest(
            `${PRODUCTS_API}/admin/list`
        );

        cachedProducts = getArray(data, ["products", "data"]);

        renderProducts();

    } catch (error) {
        productsList.innerHTML =
            '<p class="empty-state">Could not load products.</p>';

        showMessage(
            productsMessage,
            getErrorMessage(error),
            "error"
        );
    }
}

function renderProducts() {
    if (!productsList) return;

    productsList.replaceChildren();

    const scope = $("#productScopeFilter")?.value || "all";
    const category = $("#productCategoryFilter")?.value || "all";
    const assignment = $("#productAssignmentFilter")?.value || "all";

    const filtered = cachedProducts.filter(product => {
        const placements = getProductPlacements(product);
        const collections = getProductCollections(product);

        const isHomepageProduct = placements.length > 0;

        const matchesScope =
            scope === "all" ||
            (scope === "homepage" && isHomepageProduct) ||
            (scope === "shop" && !isHomepageProduct);

        const matchesCategory =
            category === "all" ||
            product.category === category ||
            placements.includes(category);

        const matchesAssignment =
            assignment === "all" ||
            placements.includes(assignment) ||
            collections.includes(assignment);

        return (
            matchesScope &&
            matchesCategory &&
            matchesAssignment
        );
    });

    if (!filtered.length) {
        productsList.innerHTML =
            '<p class="empty-state">No products match these filters.</p>';

        return;
    }

    filtered.forEach(product => {
        const productId = getProductId(product);

        const card = document.createElement("article");

        card.className = "product-card";

        const information = document.createElement("div");

        information.className = "product-card-information";

        const title = document.createElement("h3");

        title.textContent =
            product.title || product.name || "Unnamed product";

        const price = document.createElement("p");

        price.textContent =
            `Selling price: ${money(product.price)}`;

        const originalPrice = document.createElement("p");

        originalPrice.textContent =
            product.originalPrice
                ? `Original price: ${money(product.originalPrice)}`
                : "Original price: Not specified";

        const categoryText = document.createElement("p");

        categoryText.textContent =
            `Actual category: ${getCategoryLabel(product.category)}`;

        const placementText = document.createElement("p");

        placementText.textContent =
            `Homepage sections: ${getPlacementLabels(product)}`;

        const collectionText = document.createElement("p");

        collectionText.textContent =
            `Shop collections: ${getCollectionLabels(product)}`;

        const stockText = document.createElement("p");

        stockText.textContent =
            `Stock: ${
                product.inStock === false ||
                product.stockStatus === "out-of-stock"
                    ? "Out of stock"
                    : "In stock"
            }`;

        information.append(
            title,
            price,
            originalPrice,
            categoryText,
            placementText,
            collectionText,
            stockText
        );

        const actions = document.createElement("div");

        actions.className = "product-card-actions";

        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.className = "btn primary";
        editButton.textContent = "Edit product";

        editButton.addEventListener("click", () => {
            startProductEdit(product);
        });

        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "btn danger";
        deleteButton.textContent = "Delete product";

        deleteButton.addEventListener("click", async () => {
            if (!productId) {
                showMessage(
                    productsMessage,
                    "This product does not have an ID.",
                    "error"
                );

                return;
            }

            const confirmed = confirm(
                `Delete "${product.title || product.name}"? This action cannot be undone.`
            );

            if (!confirmed) return;

            deleteButton.disabled = true;
            deleteButton.textContent = "Deleting...";

            try {
                await apiRequest(
                    `${PRODUCTS_API}/${encodeURIComponent(productId)}`,
                    {
                        method: "DELETE"
                    }
                );

                if (editingProductId === String(productId)) {
                    resetProductForm();
                }

                showMessage(
                    productsMessage,
                    "Product deleted successfully.",
                    "success"
                );

                await loadProducts();

            } catch (error) {
                showMessage(
                    productsMessage,
                    getErrorMessage(error),
                    "error"
                );

                deleteButton.disabled = false;
                deleteButton.textContent = "Delete product";
            }
        });

        actions.append(
            editButton,
            deleteButton
        );

        card.append(
            information,
            actions
        );

        productsList.appendChild(card);
    });
}

$("#refreshProducts")?.addEventListener("click", loadProducts);

$("#productScopeFilter")?.addEventListener(
    "change",
    renderProducts
);

$("#productCategoryFilter")?.addEventListener(
    "change",
    renderProducts
);

$("#productAssignmentFilter")?.addEventListener(
    "change",
    renderProducts
);


/* =========================================
   PRODUCT FORM
========================================= */

const productForm = $("#productForm");
const uploadMessage = $("#uploadMessage");
const uploadButton = $("#uploadProductButton");

const productFormHeading = productForm
    ?.closest(".admin-panel")
    ?.querySelector(".panel-heading h2");

const originalFormHeading =
    productFormHeading?.textContent || "Upload Product";

const originalUploadButtonText =
    uploadButton?.textContent || "Upload Product";


/* =========================================
   FORM DATA HELPERS
========================================= */

function linesToArray(value, limit) {
    return String(value || "")
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, limit);
}

function commaSeparated(value) {
    return String(value || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
}

function formatSpecifications(value) {
    if (Array.isArray(value)) {
        return value.map(item => {
            if (typeof item === "string") {
                return item;
            }

            if (item && typeof item === "object") {
                const name =
                    item.name ||
                    item.key ||
                    item.label ||
                    "";

                const specificationValue =
                    item.value ??
                    item.description ??
                    "";

                return name
                    ? `${name}: ${specificationValue}`
                    : String(specificationValue);
            }

            return "";
        }).filter(Boolean).join("\n");
    }

    if (value && typeof value === "object") {
        return Object.entries(value)
            .map(([key, item]) => `${key}: ${item}`)
            .join("\n");
    }

    return String(value || "");
}

function getSelectedCheckboxValues(selector) {
    return Array.from(
        document.querySelectorAll(`${selector}:checked`)
    ).map(checkbox => checkbox.value);
}

function setCheckboxValues(selector, values) {
    const selected = new Set(values);

    document.querySelectorAll(selector).forEach(checkbox => {
        checkbox.checked = selected.has(checkbox.value);
    });
}

function appendFormData(formData, key, value) {
    if (value === undefined || value === null) {
        return;
    }

    formData.append(key, String(value));
}


/* =========================================
   PRODUCT EDIT FORM CONTROLS
========================================= */

function getCancelEditButton() {
    if (!productForm) return null;

    let button = $("#cancelProductEditButton");

    if (button) return button;

    const actions = productForm.querySelector(".form-actions");

    if (!actions) return null;

    button = document.createElement("button");

    button.type = "button";
    button.id = "cancelProductEditButton";
    button.className = "btn secondary";
    button.textContent = "Cancel Edit";
    button.hidden = true;

    actions.appendChild(button);

    button.addEventListener("click", resetProductForm);

    return button;
}

function setProductFormMode(isEditing) {
    if (productFormHeading) {
        productFormHeading.textContent = isEditing
            ? "Edit Product"
            : originalFormHeading;
    }

    if (uploadButton) {
        uploadButton.textContent = isEditing
            ? "Update Product"
            : originalUploadButtonText;
    }

    const cancelButton = getCancelEditButton();

    if (cancelButton) {
        cancelButton.hidden = !isEditing;
    }

    const submitButton = uploadButton;

    if (submitButton) {
        submitButton.dataset.mode = isEditing
            ? "edit"
            : "create";
    }
}

function startProductEdit(product) {
    if (!productForm) return;

    const productId = getProductId(product);

    if (!productId) {
        showMessage(
            productsMessage,
            "This product cannot be edited because it has no ID.",
            "error"
        );

        return;
    }

    editingProductId = String(productId);
    editingProduct = product;

    productForm.reset();

    clearProductPreviewUrls();

    clearMessage(uploadMessage);

    $("#productTitle").value =
        product.title || product.name || "";

    $("#productCategory").value =
        product.category || "";

    $("#originalPrice").value =
        product.originalPrice ?? "";

    $("#sellingPrice").value =
        product.price ?? "";

    $("#productDescription").value =
        product.description || "";

    $("#stockStatus").value =
        product.inStock === false ||
        product.stockStatus === "out-of-stock"
            ? "false"
            : "true";

    $("#productBrand").value =
        product.brand || "";

    $("#productModel").value =
        product.model || "";

    $("#productColors").value =
        Array.isArray(product.colors)
            ? product.colors.join(", ")
            : "";

    $("#productFeatures").value =
        Array.isArray(product.features)
            ? product.features.join("\n")
            : "";

    $("#productSpecifications").value =
        formatSpecifications(product.specifications);

    $("#productWarranty").value =
        product.warranty || "";

    $("#detailsVerified").checked =
        Boolean(product.detailsVerified);

    setCheckboxValues(
        ".homepage-placement-checkbox",
        getProductPlacements(product)
    );

    setCheckboxValues(
        ".shop-collection-checkbox",
        getProductCollections(product)
    );

    const imagePath = $("#productImagePath");

    if (imagePath) {
        imagePath.value = "";
    }

    const imageInput = $("#productImageFile");

    if (imageInput) {
        imageInput.value = "";
    }

    previewExistingProductImages(product);

    setProductFormMode(true);

    const formPanel = productForm.closest(".admin-panel");

    if (formPanel?.id) {
        activateAdminPanel(formPanel.id);
    }

    showMessage(
        uploadMessage,
        `Editing "${product.title || product.name}". Existing images will remain unless you select replacements.`,
        "info"
    );

    productForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


/* =========================================
   RESET PRODUCT FORM
========================================= */

function resetProductForm() {
    if (!productForm) return;

    productForm.reset();

    editingProductId = null;
    editingProduct = null;

    clearProductPreviewUrls();

    const imagePreview = $("#productImagePreview");

    if (imagePreview) {
        imagePreview.replaceChildren();

        imagePreview.textContent =
            "No product images selected.";
    }

    const imagePath = $("#productImagePath");

    if (imagePath) {
        imagePath.value = "";
    }

    const imageInput = $("#productImageFile");

    if (imageInput) {
        imageInput.value = "";
    }

    setProductFormMode(false);

    clearMessage(uploadMessage);
}

const clearProductButton = productForm?.querySelector(
    'button[type="reset"]'
);

clearProductButton?.addEventListener("click", event => {
    event.preventDefault();

    resetProductForm();
});


/* =========================================
   PRODUCT IMAGE INPUT PREVIEW
========================================= */

$("#productImageFile")?.addEventListener("change", event => {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
        if (editingProduct) {
            previewExistingProductImages(editingProduct);
        } else {
            renderProductImagePreview([]);
        }

        return;
    }

    if (files.length > 4) {
        showMessage(
            uploadMessage,
            "You can upload a maximum of four product images.",
            "error"
        );

        event.target.value = "";

        return;
    }

    previewSelectedProductImages(files);
});


/* =========================================
   PRODUCT VALIDATION
========================================= */

const ALLOWED_PRODUCT_IMAGE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif"
];

const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;

function validateProductImages(files) {
    if (files.length > 4) {
        return "You can upload a maximum of four product images.";
    }

    for (const file of files) {
        if (!ALLOWED_PRODUCT_IMAGE_TYPES.includes(file.type)) {
            return "Only PNG, JPG, WEBP and GIF product images are allowed.";
        }

        if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
            return `The image "${file.name}" exceeds the 5 MB limit.`;
        }
    }

    return "";
}

function validateProductPrices(originalPriceRaw, sellingPriceRaw) {
    const price = Number(sellingPriceRaw);

    if (
        sellingPriceRaw === "" ||
        !Number.isFinite(price) ||
        price <= 0
    ) {
        return "Enter a valid selling price greater than zero.";
    }

    if (originalPriceRaw !== "") {
        const originalPrice = Number(originalPriceRaw);

        if (
            !Number.isFinite(originalPrice) ||
            originalPrice <= 0
        ) {
            return "Original Price must be greater than zero when provided.";
        }

        if (originalPrice <= price) {
            return "Original Price must be greater than the Selling Price. Leave it blank if the product is not discounted.";
        }
    }

    return "";
}


/* =========================================
   BUILD PRODUCT FORM DATA
========================================= */

function buildProductFormData({
    title,
    category,
    price,
    originalPrice,
    description,
    placements,
    collections,
    inStock,
    brand,
    model,
    colors,
    features,
    specifications,
    warranty,
    detailsVerified,
    files,
    imagePath
}) {
    const formData = new FormData();

    appendFormData(formData, "title", title);
    appendFormData(formData, "category", category);
    appendFormData(formData, "price", price);

    appendFormData(
        formData,
        "originalPrice",
        originalPrice === "" ? "" : originalPrice
    );

    appendFormData(formData, "description", description);

    appendFormData(
        formData,
        "placements",
        JSON.stringify(placements)
    );

    appendFormData(
        formData,
        "collections",
        JSON.stringify(collections)
    );

    appendFormData(
        formData,
        "inStock",
        String(inStock)
    );

    appendFormData(formData, "brand", brand);
    appendFormData(formData, "model", model);

    appendFormData(
        formData,
        "colors",
        JSON.stringify(colors)
    );

    appendFormData(
        formData,
        "features",
        JSON.stringify(features)
    );

    appendFormData(
        formData,
        "specifications",
        JSON.stringify(specifications)
    );

    appendFormData(formData, "warranty", warranty);

    appendFormData(
        formData,
        "detailsVerified",
        String(detailsVerified)
    );

    files.forEach(file => {
        formData.append("images", file);
    });

    if (!files.length && imagePath) {
        appendFormData(formData, "image", imagePath);
    }

    return formData;
}


/* =========================================
   SUBMIT PRODUCT FORM
   CREATE OR UPDATE
========================================= */

if (productForm) {
    productForm.addEventListener("submit", async event => {
        event.preventDefault();

        clearMessage(uploadMessage);

        const title = $("#productTitle")?.value.trim() || "";
        const category = $("#productCategory")?.value || "";

        const originalPriceRaw =
            $("#originalPrice")?.value.trim() || "";

        const sellingPriceRaw =
            $("#sellingPrice")?.value.trim() || "";

        const priceError = validateProductPrices(
            originalPriceRaw,
            sellingPriceRaw
        );

        if (priceError) {
            showMessage(
                uploadMessage,
                priceError,
                "error"
            );

            return;
        }

        if (!title) {
            showMessage(
                uploadMessage,
                "Enter a product name.",
                "error"
            );

            return;
        }

        if (!category) {
            showMessage(
                uploadMessage,
                "Select the actual product category.",
                "error"
            );

            return;
        }

        if (!Object.hasOwn(PRODUCT_CATEGORY_LABELS, category)) {
            showMessage(
                uploadMessage,
                "The selected product category is not valid.",
                "error"
            );

            return;
        }

        const placements = getSelectedCheckboxValues(
            ".homepage-placement-checkbox"
        );

        const collections = getSelectedCheckboxValues(
            ".shop-collection-checkbox"
        );

        const invalidPlacement = placements.find(
            value => !HOMEPAGE_PLACEMENT_VALUES.includes(value)
        );

        if (invalidPlacement) {
            showMessage(
                uploadMessage,
                `Invalid homepage placement: ${invalidPlacement}`,
                "error"
            );

            return;
        }

        const invalidCollection = collections.find(
            value => !SHOP_COLLECTION_VALUES.includes(value)
        );

        if (invalidCollection) {
            showMessage(
                uploadMessage,
                `Invalid Shop collection: ${invalidCollection}`,
                "error"
            );

            return;
        }

        const files = Array.from(
            $("#productImageFile")?.files || []
        );

        const imageError = validateProductImages(files);

        if (imageError) {
            showMessage(
                uploadMessage,
                imageError,
                "error"
            );

            return;
        }

        const imagePath =
            $("#productImagePath")?.value.trim() || "";

        if (
            !editingProductId &&
            !files.length &&
            !imagePath
        ) {
            showMessage(
                uploadMessage,
                "Choose at least one product image or enter an image path.",
                "error"
            );

            return;
        }

        const productData = {
            title,
            category,

            price: Number(sellingPriceRaw),

            originalPrice: originalPriceRaw,

            description:
                $("#productDescription")?.value.trim() || "",

            placements,
            collections,

            inStock:
                $("#stockStatus")?.value === "true",

            brand:
                $("#productBrand")?.value.trim() || "",

            model:
                $("#productModel")?.value.trim() || "",

            colors:
                commaSeparated($("#productColors")?.value),

            features:
                linesToArray(
                    $("#productFeatures")?.value,
                    12
                ),

            specifications:
                linesToArray(
                    $("#productSpecifications")?.value,
                    20
                ),

            warranty:
                $("#productWarranty")?.value.trim() || "",

            detailsVerified:
                $("#detailsVerified")?.checked || false,

            files,
            imagePath
        };

        const isEditing = Boolean(editingProductId);

        const endpoint = isEditing
            ? `${PRODUCTS_API}/${encodeURIComponent(editingProductId)}`
            : PRODUCTS_API;

        const method = isEditing ? "PUT" : "POST";

        const formData = buildProductFormData(productData);

        if (uploadButton) {
            uploadButton.disabled = true;

            uploadButton.textContent = isEditing
                ? "Updating..."
                : "Uploading...";
        }

        try {
            await apiRequest(endpoint, {
                method,
                body: formData
            });

            showMessage(
                uploadMessage,
                isEditing
                    ? "Product updated successfully."
                    : "Product uploaded successfully.",
                "success"
            );

            resetProductForm();

            await loadProducts();

        } catch (error) {
            showMessage(
                uploadMessage,
                getErrorMessage(error),
                "error"
            );

        } finally {
            if (uploadButton) {
                uploadButton.disabled = false;

                uploadButton.textContent = editingProductId
                    ? "Update Product"
                    : originalUploadButtonText;
            }
        }
    });
}


/* =========================================
   WEBSITE IMAGE MANAGEMENT
   CENTRAL MONGODB GRIDFS STORAGE
========================================= */

const ASSET_GROUPS = [
    {
        title: "Website Logo",

        description:
            "Upload or replace your main website logo.",

        items: [
            {
                key: "website-logo",
                name: "Website logo",
                help: "A transparent PNG is recommended."
            }
        ]
    },

    {
        title: "Homepage Hero Slides",

        description:
            "Manage your five rotating homepage banner images.",

        items: [
            {
                key: "hero-slide-1",
                name: "Hero slide 1",
                help: "Recommended size: 1400 × 400."
            },
            {
                key: "hero-slide-2",
                name: "Hero slide 2",
                help: "Recommended size: 1400 × 400."
            },
            {
                key: "hero-slide-3",
                name: "Hero slide 3",
                help: "Recommended size: 1400 × 400."
            },
            {
                key: "hero-slide-4",
                name: "Hero slide 4",
                help: "Recommended size: 1400 × 400."
            },
            {
                key: "hero-slide-5",
                name: "Hero slide 5",
                help: "Recommended size: 1400 × 400."
            }
        ]
    },

    {
        title: "Circular Category Images",

        description:
            "Replace the images displayed in your five homepage category circles.",

        items: [
            {
                key: "category-gaming",
                name: "Gaming Accessories",
                help: "A square PNG image is recommended."
            },
            {
                key: "category-photography",
                name: "Photography & Lighting",
                help: "A square PNG image is recommended."
            },
            {
                key: "category-audio",
                name: "Audio & Sound",
                help: "A square PNG image is recommended."
            },
            {
                key: "category-storage",
                name: "Storage & Memory",
                help: "A square PNG image is recommended."
            },
            {
                key: "category-computer",
                name: "Computer Accessories",
                help: "A square PNG image is recommended."
            }
        ]
    },

    {
        title: "Shop Collection Slides",

        description:
            "Manage the five promotional image slides used for the Shop collections.",

        items: [
            {
                key: "collection-trending",
                name: "Trending",
                help: "Shop Trending collection slide."
            },
            {
                key: "collection-featured",
                name: "Featured",
                help: "Shop Featured collection slide."
            },
            {
                key: "collection-recommended",
                name: "Recommended",
                help: "Shop Recommended collection slide."
            },
            {
                key: "collection-must-have",
                name: "Must Have",
                help: "Shop Must Have collection slide."
            },
            {
                key: "collection-explore",
                name: "Explore",
                help: "Shop Explore collection slide."
            }
        ]
    }
];


/* =========================================
   TEMPORARY ADMIN IMAGE PREVIEW URLS
========================================= */

function clearAdminPreviewUrls() {
    adminPreviewUrls.forEach(url => {
        URL.revokeObjectURL(url);
    });

    adminPreviewUrls.clear();
}


/* =========================================
   WEBSITE IMAGE URL HELPER
========================================= */

function getSiteAssetUrl(value) {
    if (!value) return "";

    let url = "";

    if (typeof value === "string") {
        url = value;

    } else if (typeof value === "object") {
        url =
            value.url ||
            value.secure_url ||
            value.imageUrl ||
            value.image ||
            "";
    }

    if (!url) return "";

    if (
        url.startsWith("https://") ||
        url.startsWith("http://") ||
        url.startsWith("data:") ||
        url.startsWith("blob:")
    ) {
        return url;
    }

    return `${API_BASE}/${url.replace(/^\/+/, "")}`;
}


/* =========================================
   FETCH PROTECTED ADMIN IMAGE PREVIEW
========================================= */

async function fetchAdminImagePreview(value) {
    const imageUrl = getSiteAssetUrl(value);

    if (!imageUrl) {
        throw new Error("No image URL was provided.");
    }

    if (
        imageUrl.startsWith("data:") ||
        imageUrl.startsWith("blob:")
    ) {
        return imageUrl;
    }

    if (!adminToken) {
        throw new Error("Your admin session has expired.");
    }

    const response = await fetch(imageUrl, {
        method: "GET",

        headers: {
            Authorization: `Bearer ${adminToken}`
        }
    });

    if (response.status === 401 || response.status === 403) {
        showLogin(
            "Your admin session has expired. Please sign in again."
        );

        throw new Error("Admin authorisation failed.");
    }

    if (!response.ok) {
        throw new Error(
            `Could not load image preview (${response.status}).`
        );
    }

    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
        throw new Error(
            "The server did not return a valid image."
        );
    }

    const objectUrl = URL.createObjectURL(blob);

    adminPreviewUrls.add(objectUrl);

    return objectUrl;
}


/* =========================================
   FETCH CENTRAL WEBSITE IMAGES
========================================= */

async function fetchCentralAssets() {
    const data = await apiRequest(
        `${SITE_ASSETS_API}/admin/list`
    );

    const assets = {};

    const assetList = Array.isArray(data.assets)
        ? data.assets
        : [];

    assetList.forEach(asset => {
        if (asset && asset.key) {
            assets[asset.key] = asset;
        }
    });

    return assets;
}


/* =========================================
   DETERMINE WEBSITE IMAGE TYPE
========================================= */

function getSiteAssetType(key) {
    if (key === "website-logo") {
        return "logo";
    }

    if (/^hero-slide-[1-5]$/.test(key)) {
        return "hero";
    }

    if (key.startsWith("category-")) {
        return "category";
    }

    if (SHOP_COLLECTION_VALUES.some(
        collection => key === `collection-${collection}`
    )) {
        return "collection";
    }

    throw new Error("Invalid website image category.");
}


/* =========================================
   UPLOAD OR REPLACE WEBSITE IMAGE
========================================= */

async function uploadSiteAsset(key, file) {
    const type = getSiteAssetType(key);

    const formData = new FormData();

    formData.append("key", key);
    formData.append("type", type);
    formData.append("image", file);

    return apiRequest(SITE_ASSETS_API, {
        method: "POST",
        body: formData
    });
}


/* =========================================
   REMOVE REPLACEMENT IMAGE
========================================= */

async function deleteSiteAsset(key) {
    return apiRequest(
        `${SITE_ASSETS_API}/${encodeURIComponent(key)}`,
        {
            method: "DELETE"
        }
    );
}


/* =========================================
   CREATE WEBSITE IMAGE CARD
========================================= */

function createAssetCard(asset, currentAssets) {
    const card = document.createElement("div");

    card.className = "asset-card";

    const preview = document.createElement("div");

    preview.className = "asset-preview";

    const currentAsset = currentAssets[asset.key];

    const currentImage = getSiteAssetUrl(currentAsset);

    const hasReplacement = Boolean(currentImage);

    const title = document.createElement("h4");

    title.textContent = asset.name;

    const fileInput = document.createElement("input");

    fileInput.type = "file";

    fileInput.accept =
        "image/png,image/jpeg,image/webp,image/gif";

    fileInput.setAttribute(
        "aria-label",
        `Upload ${asset.name}`
    );

    const help = document.createElement("small");

    help.textContent = asset.help;

    const status = document.createElement("div");

    status.className = "asset-status";

    if (hasReplacement) {
        status.textContent = currentAsset.isActive === false
            ? "A replacement image is stored but inactive."
            : "A replacement image is currently active.";

        preview.textContent = "Loading image preview...";

        fetchAdminImagePreview(currentAsset)
            .then(previewUrl => {
                if (!preview.isConnected) return;

                const image = document.createElement("img");

                image.src = previewUrl;

                image.alt =
                    currentAsset.altText || asset.name;

                image.onerror = () => {
                    preview.textContent =
                        "Image preview unavailable";
                };

                preview.replaceChildren(image);
            })
            .catch(error => {
                if (preview.isConnected) {
                    preview.textContent =
                        "Image preview unavailable";
                }

                console.warn(
                    `Could not preview ${asset.key}:`,
                    error
                );
            });

    } else {
        preview.textContent =
            "Using original website image";

        status.textContent =
            "No replacement uploaded. The original image is being used.";
    }

    const removeButton = document.createElement("button");

    removeButton.type = "button";

    removeButton.className = "btn danger";

    removeButton.textContent = "Restore original image";

    removeButton.hidden = !hasReplacement;


    /* =====================================
       UPLOAD IMAGE EVENT
    ===================================== */

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];

        if (!file) return;

        const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            showMessage(
                $("#assetsMessage"),
                "Please select a PNG, JPG, WEBP or GIF image.",
                "error"
            );

            fileInput.value = "";

            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showMessage(
                $("#assetsMessage"),
                "The image must be 5 MB or smaller.",
                "error"
            );

            fileInput.value = "";

            return;
        }

        fileInput.disabled = true;
        removeButton.disabled = true;

        status.textContent = "Uploading image...";

        showMessage(
            $("#assetsMessage"),
            `Uploading ${asset.name}...`,
            "info"
        );

        try {
            await uploadSiteAsset(asset.key, file);

            showMessage(
                $("#assetsMessage"),
                `${asset.name} uploaded successfully.`,
                "success"
            );

            await loadWebsiteAssets();

        } catch (error) {
            status.textContent = getErrorMessage(error);

            showMessage(
                $("#assetsMessage"),
                getErrorMessage(error),
                "error"
            );

            fileInput.disabled = false;
            removeButton.disabled = false;
            fileInput.value = "";
        }
    });


    /* =====================================
       RESTORE ORIGINAL IMAGE EVENT
    ===================================== */

    removeButton.addEventListener("click", async () => {
        const confirmed = confirm(
            `Remove the replacement for "${asset.name}" and restore the original website image?`
        );

        if (!confirmed) return;

        removeButton.disabled = true;
        fileInput.disabled = true;

        status.textContent = "Restoring original image...";

        showMessage(
            $("#assetsMessage"),
            `Restoring original ${asset.name.toLowerCase()}...`,
            "info"
        );

        try {
            await deleteSiteAsset(asset.key);

            showMessage(
                $("#assetsMessage"),
                `Original ${asset.name.toLowerCase()} restored successfully.`,
                "success"
            );

            await loadWebsiteAssets();

        } catch (error) {
            showMessage(
                $("#assetsMessage"),
                getErrorMessage(error),
                "error"
            );

            removeButton.disabled = false;
            fileInput.disabled = false;

            status.textContent = getErrorMessage(error);
        }
    });

    card.append(
        preview,
        title,
        fileInput,
        help,
        status,
        removeButton
    );

    return card;
}


/* =========================================
   LOAD WEBSITE IMAGE MANAGER
========================================= */

async function loadWebsiteAssets() {
    const manager = $("#assetManager");

    const message = $("#assetsMessage");

    if (!manager) {
        console.error(
            "Website image manager container #assetManager was not found."
        );

        return;
    }

    clearAdminPreviewUrls();

    manager.replaceChildren();

    showMessage(
        message,
        "Loading website images...",
        "info"
    );

    try {
        const currentAssets = await fetchCentralAssets();

        for (const group of ASSET_GROUPS) {
            const groupElement = document.createElement("div");

            groupElement.className = "asset-group";

            const heading = document.createElement("h3");

            heading.textContent = group.title;

            const description = document.createElement("p");

            description.textContent = group.description;

            const grid = document.createElement("div");

            grid.className = "asset-grid";

            group.items.forEach(asset => {
                const card = createAssetCard(
                    asset,
                    currentAssets
                );

                grid.appendChild(card);
            });

            groupElement.append(
                heading,
                description,
                grid
            );

            manager.appendChild(groupElement);
        }

        showMessage(
            message,
            "Website images loaded successfully.",
            "success"
        );

    } catch (error) {
        manager.innerHTML =
            '<p class="empty-state">Could not load website images from the server.</p>';

        showMessage(
            message,
            getErrorMessage(error),
            "error"
        );
    }
}


/* =========================================
   RESTORE EXISTING ADMIN SESSION
   KEEP THIS AT THE END OF THE FILE
========================================= */

if (adminToken) {
    showAdmin();
} else {
    showLogin();
}
