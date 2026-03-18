// is-ai-native — Azure Container Apps deployment
// Cheapest option: Consumption plan (scales to zero, free monthly grant)
// Run at resource-group scope:
//   az deployment group create \
//     --resource-group <rg> \
//     --template-file infra/main.bicep \
//     --parameters namePrefix=is-ai-native enableSharing=true \
//     --parameters containerImage=<image> githubToken=<token>

@description('Azure region for all resources. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Name prefix applied to every resource. Must contain only lowercase letters, numbers, and hyphens; 3–20 chars.')
@minLength(3)
@maxLength(20)
param namePrefix string = 'is-ai-native'

@description('Container image to deploy, e.g. ghcr.io/org/repo:sha-abc1234.')
param containerImage string

@description('GitHub PAT used by the scanner to raise API rate limits. Leave empty for unauthenticated access.')
@secure()
param githubToken string = ''

@description('Enable the report-sharing feature. When true, an Azure Files share is mounted for report persistence.')
param enableSharing bool = false

@description('Enable Azure Application Insights telemetry for scan/report monitoring.')
param enableAppInsights bool = true

@description('Enable low-cost external website availability monitoring. Requires Application Insights and a monitoring alert email address.')
param enableAvailabilityMonitoring bool = true

@description('Email address that receives website availability alerts. Leave empty to skip alert creation.')
param monitoringAlertEmail string = 'salnikov@gmail.com'

@description('Optional public URL to probe. Leave empty to monitor the default Container App URL.')
param monitoringUrl string = ''

@description('Container startup strategy. Use scale-to-zero for lowest cost, or keep-warm to keep one replica ready and reduce cold starts.')
@allowed([
  'scale-to-zero'
  'keep-warm'
])
param containerStartupStrategy string = 'scale-to-zero'

@description('Azure Container Registry name. When provided, the Container App pulls from ACR using its managed identity.')
param acrName string = ''

@description('Custom domain name to bind (e.g. scan.example.com). Leave empty to use the default Azure FQDN. Requires a one-time CLI setup: see README.')
param customDomainName string = ''

@description('Name of the existing managed certificate in the Container Apps environment. Created during one-time CLI setup.')
param managedCertName string = ''

@description('Optional secondary custom domain name to keep bound alongside the primary domain during migrations or cutovers.')
param secondaryCustomDomainName string = ''

@description('Name of the existing managed certificate for the optional secondary custom domain.')
param secondaryManagedCertName string = ''

@description('Public site origin used for canonical URLs, sitemap entries, and social card URLs. Leave empty to omit a canonical origin.')
param siteOrigin string = ''

@description('Tags applied to every resource.')
param tags object = {
  application: 'is-ai-native'
  managedBy: 'bicep'
}

// ── Log Analytics Workspace (required by Container Apps) ──────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 31
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = if (enableAppInsights) {
  name: '${namePrefix}-appi'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 30
    WorkspaceResourceId: logAnalytics.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ── Container Apps Environment (Consumption plan — no workload profiles) ─
resource containerEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${namePrefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// ── Optional: Azure Storage for shared-report persistence ──
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = if (enableSharing) {
  // Azure Storage account names: 3–24 chars, lowercase letters and numbers only.
  // namePrefix is documented as lowercase letters/numbers/hyphens; strip hyphens plus
  // defensive strips for underscores and dots in case a non-standard prefix is supplied.
  #disable-next-line BCP334
  name: take(toLower(replace(replace(replace('${namePrefix}data', '-', ''), '_', ''), '.', '')), 24)
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = if (enableSharing) {
  parent: storageAccount
  name: 'default'
}

resource dataShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = if (enableSharing) {
  parent: fileService
  name: 'data'
  properties: { shareQuota: 1 }
}

// Mount the file share inside the Container Apps Environment
resource caStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = if (enableSharing) {
  parent: containerEnv
  name: 'reports-data'
  properties: {
    azureFile: {
      #disable-next-line BCP422
      accountName: storageAccount.name
      #disable-next-line BCP422
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: 'data'
      accessMode: 'ReadWrite'
    }
  }
}

// ── Managed TLS certificate (reference existing — created by one-time CLI setup) ─
resource managedCert 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' existing = if (managedCertName != '') {
  parent: containerEnv
  name: managedCertName
}

resource secondaryManagedCert 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' existing = if (secondaryManagedCertName != '') {
  parent: containerEnv
  name: secondaryManagedCertName
}

// ── ACR reference (for admin credentials) ────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = if (acrName != '') {
  name: acrName
}

// ── Environment variables ─────────────────────────────────────────
var baseEnv = [
  { name: 'NODE_ENV', value: 'production' }
  { name: 'PORT', value: '3000' }
  { name: 'ENABLE_SHARING', value: enableSharing ? 'true' : 'false' }
  { name: 'CONTAINER_STARTUP_STRATEGY', value: containerStartupStrategy }
  { name: 'CONTAINER_MIN_REPLICAS', value: containerStartupStrategy == 'keep-warm' ? '1' : '0' }
]

var siteOriginEnv = siteOrigin != '' ? [
  { name: 'SITE_ORIGIN', value: siteOrigin }
] : []

var tokenEnv = githubToken != '' ? [
  { name: 'GH_TOKEN_FOR_SCAN', secretRef: 'gh-token-for-scan' }
] : []

var appInsightsEnv = enableAppInsights ? [
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', secretRef: 'app-insights-connection-string' }
] : []

var appEnv = concat(baseEnv, siteOriginEnv, tokenEnv, appInsightsEnv)

// ── Secrets ───────────────────────────────────────────────────────
var appSecrets = githubToken != '' ? [
  { name: 'gh-token-for-scan', value: githubToken }
] : []

var appInsightsSecrets = enableAppInsights ? [
  {
    name: 'app-insights-connection-string'
    value: appInsights!.properties.ConnectionString
  }
] : []

// ── Volumes & mounts (only when sharing is enabled) ───────────────
var appVolumes = enableSharing ? [
  { name: 'reports-data', storageType: 'AzureFile', storageName: caStorage.name }
] : []

var appVolumeMounts = enableSharing ? [
  { mountPath: '/app/data', volumeName: 'reports-data' }
] : []

var availabilityMonitoringEnabled = enableAppInsights && enableAvailabilityMonitoring && monitoringAlertEmail != ''
var monitoringTargetUrl = monitoringUrl != '' ? monitoringUrl : 'https://${containerApp.properties.configuration.ingress.fqdn}'
var monitoringActionGroupShortName = take(replace('${namePrefix}mon', '-', ''), 12)
var monitoringLocationIds = [
  'us-il-ch1-azr'
]

var customDomainBindings = concat(
  (customDomainName != '' && managedCertName != '') ? [
    {
      name: customDomainName
      bindingType: 'SniEnabled'
      certificateId: managedCert.id
    }
  ] : [],
  (secondaryCustomDomainName != '' && secondaryManagedCertName != '') ? [
    {
      name: secondaryCustomDomainName
      bindingType: 'SniEnabled'
      certificateId: secondaryManagedCert.id
    }
  ] : []
)

// ── Container App ─────────────────────────────────────────────────
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${namePrefix}-app'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    environmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
        customDomains: customDomainBindings
      }
      secrets: concat(appSecrets, appInsightsSecrets, acrName != '' ? [
        #disable-next-line BCP422
        { name: 'acr-password', value: acr.listCredentials().passwords[0].value }
      ] : [])
      registries: acrName != '' ? [
        {
          server: '${acrName}.azurecr.io'
          #disable-next-line BCP422
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: 'app'
          image: containerImage
          resources: {
            // Minimum viable size on Consumption plan
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          env: appEnv
          volumeMounts: appVolumeMounts
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 3000 }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: { path: '/health', port: 3000 }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 5
              successThreshold: 1
              failureThreshold: 3
            }
          ]
        }
      ]
      volumes: appVolumes
      scale: {
        // Keep one replica warm when requested to reduce cold-start latency.
        minReplicas: containerStartupStrategy == 'keep-warm' ? 1 : 0
        maxReplicas: 4
        rules: [
          {
            name: 'http-scaling'
            http: { metadata: { concurrentRequests: '20' } }
          }
        ]
      }
    }
  }
}

// ── Low-cost external availability monitoring ─────────────────────
resource monitoringActionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (availabilityMonitoringEnabled) {
  name: '${namePrefix}-site-alerts'
  location: 'global'
  tags: tags
  properties: {
    enabled: true
    groupShortName: monitoringActionGroupShortName
    emailReceivers: [
      {
        name: 'primary-email'
        emailAddress: monitoringAlertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource siteAvailabilityTest 'Microsoft.Insights/webtests@2022-06-15' = if (availabilityMonitoringEnabled) {
  name: '${namePrefix}-site-availability'
  location: location
  kind: 'standard'
  tags: union(tags, {
    'hidden-link:${appInsights!.id}': 'Resource'
  })
  properties: {
    Name: '${namePrefix}-site-availability'
    SyntheticMonitorId: '${namePrefix}-site-availability'
    Description: 'Lowest-cost public site availability check for email alerting.'
    Enabled: true
    Frequency: 900
    Timeout: 30
    Kind: 'standard'
    RetryEnabled: true
    Locations: [for locationId in monitoringLocationIds: {
      Id: locationId
    }]
    Request: {
      RequestUrl: monitoringTargetUrl
      HttpVerb: 'GET'
      ParseDependentRequests: true
      FollowRedirects: true
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 14
    }
  }
}

resource siteAvailabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = if (availabilityMonitoringEnabled) {
  name: '${namePrefix}-site-down'
  location: 'global'
  tags: tags
  properties: {
    description: 'Sends email when the public site is unavailable or returns non-200 responses from the lowest-cost availability test profile.'
    enabled: true
    severity: 1
    scopes: [
      appInsights!.id
      siteAvailabilityTest.id
    ]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    autoMitigate: true
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      componentId: appInsights!.id
      webTestId: siteAvailabilityTest.id
      failedLocationCount: 1
    }
    actions: [
      {
        actionGroupId: monitoringActionGroup.id
      }
    ]
  }
}

// ── Outputs ───────────────────────────────────────────────────────
@description('Public URL of the deployed application.')
output appUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'

@description('Name of the Container App (used by CD workflow to update the image).')
output containerAppName string = containerApp.name

@description('Name of the Application Insights component used for telemetry.')
output appInsightsName string = enableAppInsights ? appInsights.name : ''

@description('True when external website availability monitoring resources were deployed.')
output availabilityMonitoringConfigured bool = availabilityMonitoringEnabled

@description('URL monitored by the external availability test.')
output availabilityMonitoringTargetUrl string = availabilityMonitoringEnabled ? monitoringTargetUrl : ''

@description('Resource group name.')
output resourceGroupName string = resourceGroup().name
