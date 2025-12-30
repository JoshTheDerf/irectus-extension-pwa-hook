import { defineHook } from "@directus/extensions-sdk";

export default defineHook(({ init, embed }, { services, getSchema }) => {
	const { SettingsService } = services;

	// Register routes for manifest.json and service worker
	init("routes.before", ({ app }) => {
		// Serve manifest.json
		app.get("/pwa/manifest.json", async (req, res) => {
			try {
				const schema = await getSchema();
				const settingsService = new SettingsService({ 
					schema, 
					accountability: { admin: true, role: null, user: null }
				});
				
				const settings = await settingsService.readSingleton({
					fields: [
						"project_name",
						"project_descriptor",
						"project_color",
						"project_logo",
						"public_background",
					],
				});

				// Helper to validate and normalize hex colors
				const normalizeColor = (color: string | null | undefined, fallback: string): string => {
					if (!color) return fallback;
					// Remove any whitespace
					const cleaned = color.trim();
					// Check if it's a valid hex color (with or without #)
					if (/^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(cleaned)) {
						return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
					}
					return fallback;
				};

				const manifest = {
					name: settings.project_name || "Directus",
					short_name: settings.project_name || "Directus",
					description: settings.project_descriptor || "Directus Admin App",
					start_url: "/admin/",
					display: "standalone",
					background_color: normalizeColor(settings.public_background, "#ffffff"),
					theme_color: normalizeColor(settings.project_color, "#6644ff"),
					icons: [
						{
							src: settings.project_logo
								? `/assets/${settings.project_logo}?width=192&height=192&fit=contain`
								: "/admin/favicon.ico",
							sizes: "192x192",
							type: "image/png",
							purpose: "any",
						},
						{
							src: settings.project_logo
								? `/assets/${settings.project_logo}?width=512&height=512&fit=contain`
								: "/admin/favicon.ico",
							sizes: "512x512",
							type: "image/png",
							purpose: "any",
						},
					],
					screenshots: [
						{
							src: settings.project_logo
								? `/assets/${settings.project_logo}?width=1280&height=720&fit=cover`
								: "/admin/favicon.ico",
							sizes: "1280x720",
							type: "image/png",
							form_factor: "wide",
						},
						{
							src: settings.project_logo
								? `/assets/${settings.project_logo}?width=750&height=1334&fit=cover`
								: "/admin/favicon.ico",
							sizes: "750x1334",
							type: "image/png",
							form_factor: "narrow",
						},
					],
					orientation: "portrait-primary",
					categories: ["productivity", "business"],
				};

				res.setHeader("Content-Type", "application/json");
				res.json(manifest);
			} catch (error) {
				console.error("Error generating manifest:", error);
				res.status(500).json({ error: "Failed to generate manifest" });
			}
		});

		// Serve service worker
		app.get("/pwa/sw.js", async (_req, res) => {
			const serviceWorkerCode = `
const CACHE_NAME = 'directus-pwa-v1';
const STATIC_CACHE_NAME = 'directus-static-v1';
const urlsToCache = [
	'/admin/',
	'/admin/index.html',
];

// Patterns for static assets that should be cached
const STATIC_ASSET_PATTERNS = [
	/\\.css$/,
	/\\.js$/,
	/\\.woff2?$/,
	/\\.ttf$/,
	/\\.eot$/,
	/\\.svg$/,
	/\\.png$/,
	/\\.jpg$/,
	/\\.jpeg$/,
	/\\.gif$/,
	/\\.webp$/,
	/\\.ico$/,
];

// Assets to exclude from caching
const EXCLUDE_FROM_CACHE = [
	/extensions\\.js$/,  // Exclude extensions.js from caching
	/\\/items\\//,        // Exclude API item requests
	/\\/users\\//,        // Exclude user API requests
	/\\/activity\\//,     // Exclude activity logs
	/\\/server\\//,       // Exclude server info
];

// Check if URL should be cached as a static asset
function isStaticAsset(url) {
	// First check exclusions
	for (const pattern of EXCLUDE_FROM_CACHE) {
		if (pattern.test(url)) {
			return false;
		}
	}
	
	// Then check if it matches static asset patterns
	for (const pattern of STATIC_ASSET_PATTERNS) {
		if (pattern.test(url)) {
			return true;
		}
	}
	
	return false;
}

// Install event - cache core files
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => {
				return cache.addAll(urlsToCache);
			})
			.catch((error) => {
				console.error('Cache installation failed:', error);
			})
	);
	self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	const currentCaches = [CACHE_NAME, STATIC_CACHE_NAME];
	event.waitUntil(
		caches.keys().then((cacheNames) => {
			return Promise.all(
				cacheNames.map((cacheName) => {
					if (!currentCaches.includes(cacheName)) {
						console.log('Deleting old cache:', cacheName);
						return caches.delete(cacheName);
					}
				})
			);
		})
	);
	self.clients.claim();
});

// Fetch event - cache strategy based on request type
self.addEventListener('fetch', (event) => {
	// Skip non-GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	// Skip chrome extensions and non-http(s) requests
	if (!event.request.url.startsWith('http')) {
		return;
	}

	const url = event.request.url;
	
	// Static assets: Cache first, fall back to network
	if (isStaticAsset(url)) {
        console.log('STATIC')
		event.respondWith(
			caches.match(event.request).then((cachedResponse) => {
				if (cachedResponse) {
					// Return cached version immediately
					return cachedResponse;
				}
				
				// Not in cache, fetch from network
				return fetch(event.request).then((response) => {
					// Don't cache if not a valid response
					if (!response || response.status !== 200 || response.type === 'error') {
						return response;
					}
					
					// Clone and cache the response
					const responseToCache = response.clone();
					caches.open(STATIC_CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
					});
					
					return response;
				}).catch(() => {
					// Network failed and not in cache
					return new Response('Offline - Asset unavailable', {
						status: 503,
						statusText: 'Service Unavailable',
					});
				});
			})
		);
		return;
	}
	
	// For all other requests: Network first, fallback to cache
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				// Don't cache if not a valid response
				if (!response || response.status !== 200 || response.type === 'error') {
					return response;
				}

				// Clone the response
				const responseToCache = response.clone();

				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, responseToCache);
				});

				return response;
			})
			.catch(() => {
				// Network failed, try cache
				return caches.match(event.request).then((response) => {
					if (response) {
						return response;
					}

					// Return offline page for navigation requests
					if (event.request.mode === 'navigate') {
						return caches.match('/admin/');
					}

					return new Response('Offline', {
						status: 503,
						statusText: 'Service Unavailable',
						headers: new Headers({
							'Content-Type': 'text/plain',
						}),
					});
				});
			})
	);
});
`;

			res.setHeader("Content-Type", "application/javascript");
			res.send(serviceWorkerCode);
		});
	});

	// Inject PWA tags into the admin app head
	// Note: embed callbacks CANNOT be async - they run once at startup and are cached
	embed("head", `
<!-- PWA Meta Tags -->
<link rel="manifest" href="/pwa/manifest.json">
<meta name="theme-color" content="#6644ff">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Directus">
`);

	// Inject service worker registration into the admin app body
	embed("body", `
<script>
(function() {
	// Register service worker for PWA support
	if ('serviceWorker' in navigator) {
		window.addEventListener('load', () => {
			navigator.serviceWorker
				.register('/pwa/sw.js')
				.then((registration) => {
					console.log('PWA: ServiceWorker registered:', registration.scope);
					
					// Check for updates periodically
					setInterval(() => {
						registration.update();
					}, 60000); // Check every minute
				})
				.catch((error) => {
					console.log('PWA: ServiceWorker registration failed:', error);
				});
		});
	}
})();
</script>
`);
});
