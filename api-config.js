/* =========================================
   AM ELECTRONICS API CONFIGURATION
========================================= */

(function configureApiBase() {

    "use strict";

    const hostname = window.location.hostname;

    const localDevelopment =
        window.location.protocol === "file:" ||
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1";

    const RENDER_API_URL = "https://YOUR-RENDER-SERVICE.onrender.com";

    window.AM_API_BASE_URL = localDevelopment
        ? "http://localhost:5000"
        : RENDER_API_URL.replace(/\/+$/, "");

})();
