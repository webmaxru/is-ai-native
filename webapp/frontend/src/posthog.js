let initialized = false;
let loading = false;
const pendingCalls = [];
const pendingLogCalls = [];

function isDevelopment() {
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}

function missingConfiguration(variableName) {
  if (isDevelopment()) {
    throw new Error(
      `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`
    );
  }
}

function callPostHog(method, args) {
  const client = window.posthog;
  if (client && typeof client[method] === 'function') {
    return client[method](...args);
  }

  if (loading) {
    pendingCalls.push([method, args]);
  }

  return undefined;
}

function callPostHogLogger(level, args) {
  const logger = window.posthog?.logger;
  if (logger && typeof logger[level] === 'function') {
    return logger[level](...args);
  }

  if (loading) {
    pendingLogCalls.push([level, args]);
  }

  return undefined;
}

export const posthog = Object.freeze({
  capture: (...args) => callPostHog('capture', args),
  identify: (...args) => callPostHog('identify', args),
  reset: (...args) => callPostHog('reset', args),
  opt_in_capturing: (...args) => callPostHog('opt_in_capturing', args),
  opt_out_capturing: (...args) => callPostHog('opt_out_capturing', args),
});

export const posthogLogger = Object.freeze({
  info: (...args) => callPostHogLogger('info', args),
  error: (...args) => callPostHogLogger('error', args),
});

export function initPostHog(config = {}) {
  if (initialized || loading) {
    return;
  }

  const projectToken = typeof config.posthogProjectToken === 'string' ? config.posthogProjectToken : '';
  const host = typeof config.posthogHost === 'string' ? config.posthogHost : '';

  if (!projectToken) {
    missingConfiguration('POSTHOG_PROJECT_TOKEN');
    return;
  }

  if (!host) {
    missingConfiguration('POSTHOG_HOST');
    return;
  }

  loading = true;
  const script = document.createElement('script');
  script.async = true;
  script.src = `${host.replace(/\/+$/, '')}/static/array.js`;
  script.onload = () => {
    const client = window.posthog;
    if (!client || typeof client.init !== 'function') {
      loading = false;
      return;
    }

    client.init(projectToken, {
      api_host: host,
      capture_exceptions: {
        capture_unhandled_errors: true,
        capture_unhandled_rejections: true,
        capture_console_errors: false,
      },
      logs: {
        serviceName: 'is-ai-native-frontend',
        environment: isDevelopment() ? 'development' : 'production',
      },
    });
    initialized = true;
    loading = false;
    pendingCalls.splice(0).forEach(([method, args]) => callPostHog(method, args));
    pendingLogCalls.splice(0).forEach(([level, args]) => callPostHogLogger(level, args));
  };
  script.onerror = () => {
    loading = false;
  };
  document.head.append(script);
}
