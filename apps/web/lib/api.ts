/**
 * Get the base path for API calls
 * This handles the /scraper prefix when deployed
 */
export function getBasePath() {
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
