/**
 * Get the base path for API calls
 * This handles the /scraper prefix when deployed
 * Uses window.location to detect the base path at runtime
 */
export function getBasePath() {
  if (typeof window !== 'undefined') {
    // In browser, detect from current pathname
    const pathname = window.location.pathname;
    if (pathname.startsWith('/scraper')) {
      return '/scraper';
    }
  }
  // Fallback to environment variable (build time)
  return process.env.NEXT_PUBLIC_BASE_PATH || '';
}

/**
 * Create an API URL with the correct base path
 */
export function apiUrl(path: string) {
  const basePath = getBasePath();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}`;
}
