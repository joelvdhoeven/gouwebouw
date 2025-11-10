/**
 * Version checker to ensure users always have the latest version
 * This prevents cached files from causing issues with new features
 */

const APP_VERSION = '1.2.1'; // Should match package.json version
const VERSION_KEY = 'app_version';

export const checkAndUpdateVersion = (): void => {
  try {
    const storedVersion = localStorage.getItem(VERSION_KEY);

    // If version has changed, clear storage and force reload
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log(`Version changed from ${storedVersion} to ${APP_VERSION}. Clearing cache and reloading...`);

      // Clear localStorage except for auth tokens
      const authToken = localStorage.getItem('supabase.auth.token');
      localStorage.clear();
      if (authToken) {
        localStorage.setItem('supabase.auth.token', authToken);
      }

      // Store new version
      localStorage.setItem(VERSION_KEY, APP_VERSION);

      // Force hard reload to clear all caches
      window.location.reload();
    } else if (!storedVersion) {
      // First time or after clear - just store the version
      localStorage.setItem(VERSION_KEY, APP_VERSION);
    }
  } catch (error) {
    console.error('Error checking app version:', error);
  }
};

export const getCurrentVersion = (): string => {
  return APP_VERSION;
};
