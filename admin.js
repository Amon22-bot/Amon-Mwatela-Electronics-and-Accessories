
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
        throw new Error(
            data.message ||
            data.error ||
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
            sessionStorage.setItem(ADMIN_TOKEN_KEY, adminToken);

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

/* Restore an existing admin session */

if (adminToken) {
    showAdmin();
} else {
    showLogin();
}

/* =========================================
   ADMIN NAVIGATION TABS
========================================= */

document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".tab-button").forEach(tab => {
            tab.classList.remove("active");
        });

        document.querySelectorAll(".admin-panel").forEach(panel => {
            panel.hidden = true;
        });

        button.classList.add("active");

        const panel = document.getElementById(button.dataset.panel);

        if (panel) {
            panel.hidden = false;
        }
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

        return `
            <div class="order-item">
                <div>
                    <strong>${escapeHTML(name)}</strong>
                    <p>Quantity: ${quantity}</p>
                </div>
                <strong>${money(price * quantity)}</strong>
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
   PRODUCT MANAGEMENT
========================================= */

const productsList = $("#productsList");
const productsMessage = $("#productsMessage");

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
    "covers": "Phone Covers",
    "new-arrivals": "New Arrivals",
    "screen-protectors": "Screen Protectors",
    "headphones-earpods": "Headphones & Earpods",
    "smartwatches": "Smartwatches",
    "chargers-cables": "Chargers & Cables"
};

function getProductPlacements(product) {
    const placements = Array.isArray(product.placements)
        ? [...product.placements]
        : [];

    if (
        product.placement &&
        product.placement !== "regular"
    ) {
        placements.push(product.placement);
    }

    return [...new Set(
        placements.filter(value =>
            typeof value === "string" &&
            value &&
            value !== "regular"
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
        return "Shop only";
    }

    return placements.map(placement =>
        HOMEPAGE_PLACEMENT_LABELS[placement] || placement
    ).join(", ");
}

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

    const filtered = cachedProducts.filter(product => {
        const placements = getProductPlacements(product);
        const isHomepageProduct = placements.length > 0;

        const matchesScope =
            scope === "all" ||
            (scope === "homepage" && isHomepageProduct) ||
            (scope === "shop" && !isHomepageProduct);

        const matchesCategory =
            category === "all" ||
            product.category === category ||
            placements.includes(category);

        return matchesScope && matchesCategory;
    });

    if (!filtered.length) {
        productsList.innerHTML =
            '<p class="empty-state">No products match these filters.</p>';
        return;
    }

    filtered.forEach(product => {
        const productId = product._id || product.id;

        const card = document.createElement("article");
        card.className = "product-card";

        const information = document.createElement("div");

        const title = document.createElement("h3");
        title.textContent =
            product.title || product.name || "Unnamed product";

        const price = document.createElement("p");
        price.textContent =
            `Selling price: ${money(product.price)}`;

        const categoryText = document.createElement("p");
        categoryText.textContent =
            `Actual category: ${getCategoryLabel(product.category)}`;

        const placementText = document.createElement("p");
        placementText.textContent =
            `Homepage sections: ${getPlacementLabels(product)}`;

        information.append(
            title,
            price,
            categoryText,
            placementText
        );

        const deleteButton = document.createElement("button");
        deleteButton.className = "btn danger";
        deleteButton.type = "button";
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
                    { method: "DELETE" }
                );

                showMessage(
                    productsMessage,
                    "Product deleted.",
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

        card.append(information, deleteButton);
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

/* =========================================
   PRODUCT UPLOAD FORM
========================================= */

const productForm = $("#productForm");
const uploadMessage = $("#uploadMessage");
const uploadButton = $("#uploadProductButton");

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);

        reader.onerror = () => {
            reject(new Error("Could not read image file."));
        };

        reader.readAsDataURL(file);
    });
}

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

if (productForm) {
    productForm.addEventListener("submit", async event => {
        event.preventDefault();

        clearMessage(uploadMessage);

        const title = $("#productTitle")?.value.trim() || "";
        const category = $("#productCategory")?.value || "";

        const placements = Array.from(
            document.querySelectorAll(
                ".homepage-placement-checkbox:checked"
            )
        ).map(checkbox => checkbox.value);

        const originalPrice = Number(
            $("#originalPrice")?.value
        );

        const price = Number(
            $("#sellingPrice")?.value
        );

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

        if (
            !Number.isFinite(originalPrice) ||
            !Number.isFinite(price) ||
            originalPrice < 0 ||
            price < 0
        ) {
            showMessage(
                uploadMessage,
                "Enter valid product prices.",
                "error"
            );
            return;
        }

        if (price > originalPrice && originalPrice > 0) {
            const confirmed = confirm(
                "The selling price is higher than the original price. Continue?"
            );

            if (!confirmed) return;
        }

        const mainImageFile =
            $("#productImageFile")?.files?.[0];

        if (
            mainImageFile &&
            !mainImageFile.type.startsWith("image/")
        ) {
            showMessage(
                uploadMessage,
                "Choose a valid image file.",
                "error"
            );
            return;
        }

        const imagePath =
            $("#productImagePath")?.value.trim() || "";

        if (!mainImageFile && !imagePath) {
            showMessage(
                uploadMessage,
                "Choose a product image or enter an image path.",
                "error"
            );
            return;
        }

        if (
            mainImageFile &&
            mainImageFile.size > 5 * 1024 * 1024
        ) {
            showMessage(
                uploadMessage,
                "The product image must be 5 MB or smaller.",
                "error"
            );
            return;
        }

        const validPlacements = Object.keys(
            HOMEPAGE_PLACEMENT_LABELS
        );

        const invalidPlacement = placements.find(
            placement => !validPlacements.includes(placement)
        );

        if (invalidPlacement) {
            showMessage(
                uploadMessage,
                `Invalid homepage placement: ${invalidPlacement}`,
                "error"
            );
            return;
        }

        uploadButton.disabled = true;
        uploadButton.textContent = "Uploading...";

        try {
            let image = imagePath;

            if (mainImageFile) {
                image = await readFileAsDataURL(mainImageFile);
            }

            const product = {
                title,
                price,
                originalPrice,

                description:
                    $("#productDescription")?.value.trim() || "",

                image,
                category,
                placements,

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
                    $("#detailsVerified")?.checked || false
            };

            await apiRequest(PRODUCTS_API, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(product)
            });

            showMessage(
                uploadMessage,
                "Product uploaded successfully.",
                "success"
            );

            productForm.reset();

            await loadProducts();

        } catch (error) {
            showMessage(
                uploadMessage,
                getErrorMessage(error),
                "error"
            );
        } finally {
            uploadButton.disabled = false;
            uploadButton.textContent = "Upload Product";
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
        description: "Upload or replace your main website logo.",
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
        description: "Manage your five rotating homepage banner images.",
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
        description: "Replace the images displayed in your five homepage category circles.",
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
    }
];

/* =========================================
   TEMPORARY ADMIN IMAGE PREVIEW URLS
========================================= */

const adminPreviewUrls = new Set();

function clearAdminPreviewUrls() {
    adminPreviewUrls.forEach(url => {
        URL.revokeObjectURL(url);
    });

    adminPreviewUrls.clear();
}

/* =========================================
   IMAGE URL HELPER
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
   AUTHENTICATED ADMIN LIST
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

    if (key.startsWith("hero-slide-")) {
        return "hero";
    }

    if (key.startsWith("category-")) {
        return "category";
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

