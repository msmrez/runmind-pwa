/* eslint-disable no-restricted-globals */

// --- IMPORTS (at top) ---
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies"; // No CacheFirst needed now
import { CacheableResponsePlugin } from "workbox-cacheable-response";
// --- END IMPORTS ---

console.log(
  "%c>>> CUSTOM SERVICE WORKER (src/service-worker.js) IS RUNNING! <<<",
  "color: white; background: green; font-size: 16px; padding: 5px;"
);
console.log("[Service Worker] Script executing...");

clientsClaim();

console.log("[Service Worker] Precache and route setup...");
precacheAndRoute(self.__WB_MANIFEST);
console.log("[Service Worker] Precache and route finished.");

// App Shell routing
const fileExtensionRegexp = new RegExp("/[^/?]+\\.[^/]+$");
registerRoute(({ request, url }) => {
  /* ... navigation handling ... */
  if (request.mode !== "navigate") return false;
  if (url.pathname.startsWith("/_")) return false;
  if (url.pathname.match(fileExtensionRegexp)) return false;
  return true;
}, createHandlerBoundToURL(process.env.PUBLIC_URL + "/index.html"));
console.log("[Service Worker] App Shell routing registered.");

// --- Runtime Caching for API calls ---
// Define the strategy WITH logging plugins
const apiCachingStrategy = new StaleWhileRevalidate({
  cacheName: "api-cache", // <<< VERIFY THIS NAME
  plugins: [
    // Log requests and responses handled by this strategy
    {
      fetchDidSucceed: async ({ request, response, event }) => {
        console.log(
          `[SW API Cache - StaleWhileRevalidate] fetchDidSucceed: Fetched ${request.url}, Status: ${response.status}. Will cache.`
        );
        // Must return the response
        return response;
      },
      fetchDidFail: async ({ request, error, event }) => {
        console.error(
          `[SW API Cache - StaleWhileRevalidate] fetchDidFail: Failed to fetch ${request.url}`,
          error
        );
        // Don't return anything, Workbox will try cache
      },
      cacheWillUpdate: async ({ request, response, event, state }) => {
        console.log(
          `[SW API Cache - StaleWhileRevalidate] cacheWillUpdate: Updating cache for ${request.url}. Response status: ${response.status}`
        );
        // Return the response to cache it, or return null/undefined to prevent caching
        if (response.status === 0 || response.status === 200) {
          return response;
        } else {
          console.warn(
            `[SW API Cache - StaleWhileRevalidate] cacheWillUpdate: Preventing caching for ${request.url} due to status ${response.status}`
          );
          return null; // Prevent caching non-200 responses explicitly
        }
      },
      cachedResponseWillBeUsed: async ({
        cacheName,
        request,
        matchOptions,
        cachedResponse,
        event,
        state,
      }) => {
        console.log(
          `[SW API Cache - StaleWhileRevalidate] cachedResponseWillBeUsed: Using cached response for ${request.url} from ${cacheName}.`
        );
        // Must return the cachedResponse
        return cachedResponse;
      },
      handlerDidError: async ({ request, error, event, state }) => {
        console.error(
          `[SW API Cache - StaleWhileRevalidate] handlerDidError: Error during strategy for ${request.url}`,
          error
        );
        // Can potentially return a fallback response here
        // return new Response("Network error occurred.", { status: 500 });
      },
    },
    // Original CacheableResponsePlugin and ExpirationPlugin
    new CacheableResponsePlugin({ statuses: [0, 200] }), // Redundant with cacheWillUpdate check but safe
    new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 7, maxEntries: 50 }),
  ],
});

// Register the route with the detailed strategy
registerRoute(
  ({ url }) => {
    // Check if the URL is for our API
    const isApiCall =
      url.origin === self.location.origin && url.pathname.startsWith("/api/");
    // Log the check result
    console.log(
      `[SW Route Check] URL: ${url.pathname}, Is API Route? ${isApiCall}`
    );
    return isApiCall;
  },
  apiCachingStrategy // Use the strategy instance defined above
);
console.log(
  "[Service Worker] API runtime caching registered with detailed logging."
);

// --- Event Listeners (message, install, activate, fetch) ---
self.addEventListener("message", (event) => {
  /* ... skipWaiting logic ... */
});
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Event: install");
});
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Event: activate");
});
self.addEventListener("fetch", (event) => {
  /* console.log('[SW Fetch Event]', event.request.url); */
}); // Keep this commented unless debugging fetch directly
