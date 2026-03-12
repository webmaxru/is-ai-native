using './main.bicep'

// Default parameters for production deployment.
// Sensitive values (containerImage, githubToken) are supplied by the CD workflow
// via --parameters overrides and are never stored in the repository.

param namePrefix = 'is-ai-native'

// Report sharing is enabled by default (Azure Files share provisioned for report persistence).
// Optionally provide a GH_TOKEN_FOR_SCAN secret to increase GitHub API rate limits for scanning.
param enableSharing = true

// Application Insights is enabled by default for scan/report telemetry and Azure Workbook monitoring.
param enableAppInsights = true

// Use 'keep-warm' to keep one replica ready and avoid scale-to-zero cold starts.
param containerStartupStrategy = 'scale-to-zero'

param tags = {
  application: 'is-ai-native'
  managedBy: 'bicep'
  environment: 'production'
}
