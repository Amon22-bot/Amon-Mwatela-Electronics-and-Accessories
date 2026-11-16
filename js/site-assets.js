/* =========================================================
   AM ELECTRONICS AND ACCESSORIES
   CENTRAL WEBSITE IMAGE LOADER

   Loads centrally managed website images from MongoDB GridFS.

   Manages:
   1. Website logo
   2. Homepage hero slides
   3. Homepage category-circle images

   Original website images remain as fallbacks.
========================================================= */

"use strict";


/* =========================================================
   1. INITIALIZE IMAGE LOADER
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    loadWebsiteAssets();
});


/* =========================================================
   2. LOAD WEBSITE ASSETS
========================================================= */

async function loadWebsiteAssets() {

    const API_BASE = String(
        window.AM_API_BASE_URL || ""
    ).replace(/\/+$/, "");

    if (!API_BASE) {
        console.warn("AM API URL is not configured.");
        return;
    }

    try {

        const response = await fetch(
            `${API_BASE}/api/site-assets`,
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Website asset request failed: ${response.status}`
            );
        }

        const data = await response.json();

        if (!data.success || !data.assets) {
            throw new Error(
                "Invalid website asset response."
            );
        }

        const assets = data.assets;


        /* =============================================
           WEBSITE LOGO
        ============================================= */

        updateImage(
            ".navbar-logo img",
            assets["website-logo"]
        );


        /* =============================================
           HOMEPAGE HERO SLIDES
        ============================================= */

        const heroSlides = [
            "hero-slide-1",
            "hero-slide-2",
            "hero-slide-3",
            "hero-slide-4",
            "hero-slide-5"
        ];

        document
            .querySelectorAll(".hero-slide img")
            .forEach((image, index) => {

                const assetKey = heroSlides[index];

                if (assetKey) {
                    updateImage(
                        image,
                        assets[assetKey]
                    );
                }

            });


        /* =============================================
           HOMEPAGE CATEGORY CIRCLES
        ============================================= */

        const categoryKeys = [
            "category-gaming",
            "category-photography",
            "category-audio",
            "category-storage",
            "category-computer"
        ];

        document
            .querySelectorAll(
                ".category-circle-item .category-circle-image img"
            )
            .forEach((image, index) => {

                const assetKey = categoryKeys[index];

                if (assetKey) {
                    updateImage(
                        image,
                        assets[assetKey]
                    );
                }

            });


        console.log(
            "AM Electronics website images loaded successfully."
        );

    } catch (error) {

        console.error(
            "Website image loading error:",
            error
        );

    }

}


/* =========================================================
   3. UPDATE IMAGE

   Supports:
   - Backend asset objects
   - Plain image URL strings
   - Relative backend image paths
   - Absolute image URLs

   Preserves the original image as a fallback.
========================================================= */

function updateImage(selectorOrElement, asset) {

    const image = typeof selectorOrElement === "string"
        ? document.querySelector(selectorOrElement)
        : selectorOrElement;

    if (!image || !asset) return;


    // Extract URL and alt text from backend asset object.

    const imageUrl = typeof asset === "string"
        ? asset
        : asset.url;

    if (!imageUrl || typeof imageUrl !== "string") {
        return;
    }


    // Preserve original image.

    if (!image.dataset.originalSrc) {

        image.dataset.originalSrc =
            image.getAttribute("src") || "";

    }


    // Preserve original alt text as fallback.

    if (!image.dataset.originalAlt) {

        image.dataset.originalAlt =
            image.getAttribute("alt") || "";

    }


    // Convert relative paths into absolute backend URLs.

    const API_BASE = String(
        window.AM_API_BASE_URL || ""
    ).replace(/\/+$/, "");

    let finalUrl = imageUrl;

    if (
        !/^https?:\/\//i.test(finalUrl) &&
        !finalUrl.startsWith("data:") &&
        !finalUrl.startsWith("blob:")
    ) {

        finalUrl =
            `${API_BASE}/${finalUrl.replace(/^\/+/, "")}`;

    }


    // Update accessible image description.

    if (
        typeof asset === "object" &&
        asset.altText
    ) {

        image.alt = asset.altText;

    }


    // Restore original image if backend image fails.

    image.onerror = function () {

        this.onerror = null;

        if (this.dataset.originalSrc) {

            this.src = this.dataset.originalSrc;

        }

        if (this.dataset.originalAlt) {

            this.alt = this.dataset.originalAlt;

        }

    };


    // Load centrally managed image.

    image.src = finalUrl;

}