function getConfiguredBackendUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (!configuredUrl) {
    // Set NEXT_PUBLIC_BACKEND_URL in production; local dev talks to the backend on :3001.
    return 'http://localhost:3001';
  }

  return configuredUrl.replace(/\/$/, '');
}

export function getBackendUrl() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
  }

  return getConfiguredBackendUrl();
}

export function getSocketUrl() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001';
    }
  }

  return getConfiguredBackendUrl();
}
