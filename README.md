# Directus PWA Hook Extension

Adds Progressive Web App (PWA) support to your Directus admin interface. Automatically injects PWA meta tags, serves a dynamic manifest.json, and registers a service worker.

## Installation

### From Directus Marketplace

1. Set the environment variable:
   ```bash
   MARKETPLACE_TRUST_ALL=true
   ```

2. Install via Directus admin:
   - Go to Settings > Marketplace
   - Search for "PWA Hook"
   - Click Install

### Manual Installation

1. Copy this extension to your Directus extensions directory:
   ```bash
   cp -r directus-extension-pwa-hook /path/to/directus/extensions/
   ```

2. Restart Directus

## Configuration

Configure in Settings > Project Settings:

- **Project Name**: App display name
- **Project Descriptor**: App description
- **Project Color**: Theme color (hex)
- **Project Logo**: App icon (auto-sized to 192x192 and 512x512)
- **Public Background**: Background color

Changes apply immediately without restart.

## Features

- Injects PWA meta tags into admin app
- Serves `/pwa/manifest.json` dynamically from settings
- Serves `/pwa/sw.js` service worker
- Auto-registers service worker on page load
- Enables "Add to Home Screen" on supported browsers

## Testing

### Desktop (Chrome/Edge)
1. Open DevTools > Application
2. Check Manifest and Service Workers tabs
3. Look for install icon in address bar

### Mobile
1. Open admin in mobile browser
2. Look for "Add to Home Screen" prompt
3. Install and verify standalone mode

### Offline
1. DevTools > Network tab > Check "Offline"
2. Refresh page - should load from cache

## Important Notes

- **Service worker cache doesn't do much yet** - primarily provides basic offline support
- **PWA installation tested only on Android and Windows 11** - other platforms may have issues
- **Vibecoded with Claude Sonnet 4.5** - may have bugs or unexpected behavior
- Requires HTTPS in production (localhost works for development)

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari iOS 11.3+: Partial support
- Safari macOS: Limited manifest support

## Troubleshooting

**Service worker not registering?**
- Check browser console for errors
- Ensure HTTPS (or localhost)
- Hard reload (Ctrl+Shift+R)

**Install prompt not showing?**
- Must be on HTTPS
- User must interact with site first
- Different browsers have different criteria

## License

MIT
