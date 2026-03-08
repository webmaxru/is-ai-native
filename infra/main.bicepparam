using './main.bicep'

// Default parameters for production deployment.
// Sensitive values (containerImage, githubToken) are supplied by the CD workflow
// via --parameters overrides and are never stored in the repository.

param namePrefix = 'is-ai-native'

// Report sharing is disabled by default (no persistent storage provisioned).
// Set to true together with a GITHUB_TOKEN_FOR_SCAN secret to enable the feature.
param enableSharing = false

param tags = {
  application: 'is-ai-native'
  managedBy: 'bicep'
  environment: 'production'
}
