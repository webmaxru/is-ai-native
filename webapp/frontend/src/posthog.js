import posthog from 'posthog-js';

const config = globalThis.__IS_AI_NATIVE_CONFIG__;
const posthogKey = typeof config?.posthogKey === 'string' ? config.posthogKey : '';
const posthogHost = typeof config?.posthogHost === 'string' ? config.posthogHost : '';
const isDevelopment = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
export const isPosthogConfigured = Boolean(posthogKey && posthogHost);

if (!isPosthogConfigured) {
  if (isDevelopment) {
    const missingVariable = posthogKey ? 'PUBLIC_POSTHOG_HOST' : 'PUBLIC_POSTHOG_KEY';
    console.error(
      new Error(
        `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`
      )
    );
  }
} else {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_exceptions: true,
    logs: {
      serviceName: 'is-ai-native-frontend',
      environment: isDevelopment ? 'development' : 'production',
    },
  });
}

export default posthog;
