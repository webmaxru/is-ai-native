using './main.bicep'

// Default parameters for production deployment.
// Sensitive values (containerImage, githubToken) are supplied by the CD workflow
// via --parameters overrides and are never stored in the repository.

param namePrefix = 'is-ai-native'

// Static Web Apps supports a smaller region set than Container Apps.
param staticWebAppLocation = 'eastus2'

// Report sharing is enabled by default (Azure Files share provisioned for report persistence).
// Optionally provide a GH_TOKEN_FOR_SCAN secret to increase GitHub API rate limits for scanning.
param enableSharing = true

// Application Insights is enabled by default for scan/report telemetry and Azure Workbook monitoring.
param enableAppInsights = true

// Deploy the shared growth and engagement workbook alongside the Application Insights resources.
param enableEngagementWorkbook = true

// Low-cost public website monitoring is created when you pass monitoringAlertEmail at deploy time.
param enableAvailabilityMonitoring = true

// Default website availability alert email for manual deployments.
param monitoringAlertEmail = 'salnikov@gmail.com'

// Production frontend domain. Agent-Ready Check (webmaxru/agent-ready-check) serves the
// isainative.dev apex and www, so this scanner lives on the repo subdomain. The CD workflow
// passes the same values from the SITE_ORIGIN, STATIC_WEB_APP_CUSTOM_DOMAIN_NAME and
// STATIC_WEB_APP_DOMAIN_VALIDATION_METHOD repository variables.
param siteOrigin = 'https://repo.isainative.dev'
param staticWebAppCustomDomainName = 'repo.isainative.dev'
param staticWebAppDomainValidationMethod = 'cname-delegation'

// Keep the default at scale-to-zero until production traffic justifies an idle replica.
// Use 'keep-warm' to keep one replica ready and avoid cold starts.
param containerStartupStrategy = 'scale-to-zero'

param tags = {
  application: 'is-ai-native'
  managedBy: 'bicep'
  environment: 'production'
}
