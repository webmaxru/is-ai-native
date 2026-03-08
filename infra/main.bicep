// is-ai-native — Azure Container Apps deployment
// Cheapest option: Consumption plan (scales to zero, free monthly grant)
// Run at resource-group scope:
//   az deployment group create \
//     --resource-group <rg> \
//     --template-file infra/main.bicep \
//     --parameters @infra/main.bicepparam \
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

@description('Enable the report-sharing feature. When true, an Azure Files share is mounted for SQLite persistence.')
param enableSharing bool = false

@description('Tags applied to every resource.')
param tags object = {
  application: 'is-ai-native'
  managedBy: 'bicep'
}

// ── Log Analytics Workspace (required by Container Apps) ──────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${namePrefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 90
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

// ── Container Apps Environment (Consumption plan — no workload profiles) ─
resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
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

// ── Optional: Azure Storage for SQLite persistence (sharing feature) ──
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = if (enableSharing) {
  // Azure Storage account names: 3–24 chars, lowercase letters and numbers only.
  // namePrefix is documented as lowercase letters/numbers/hyphens; strip hyphens plus
  // defensive strips for underscores and dots in case a non-standard prefix is supplied.
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
      defaultAction: 'Deny'
      bypass: 'AzureServices'
    }
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = if (enableSharing) {
  parent: storageAccount
  name: 'default'
}

resource dataShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = if (enableSharing) {
  parent: fileService
  name: 'data'
  properties: { shareQuota: 1 }
}

// Mount the file share inside the Container Apps Environment
resource caStorage 'Microsoft.App/managedEnvironments/storages@2023-05-01' = if (enableSharing) {
  parent: containerEnv
  name: 'sqlite-data'
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: 'data'
      accessMode: 'ReadWrite'
    }
  }
}

// ── Environment variables ─────────────────────────────────────────
var baseEnv = [
  { name: 'NODE_ENV', value: 'production' }
  { name: 'PORT', value: '3000' }
  { name: 'SERVE_FRONTEND', value: 'true' }
  { name: 'ENABLE_SHARING', value: string(enableSharing) }
]

var sharingEnv = enableSharing ? [
  { name: 'DB_PATH', value: '/app/data/reports.db' }
] : []

var tokenEnv = githubToken != '' ? [
  { name: 'GITHUB_TOKEN', secretRef: 'github-token' }
] : []

var appEnv = concat(baseEnv, sharingEnv, tokenEnv)

// ── Secrets ───────────────────────────────────────────────────────
var appSecrets = githubToken != '' ? [
  { name: 'github-token', value: githubToken }
] : []

// ── Volumes & mounts (only when sharing is enabled) ───────────────
var appVolumes = enableSharing ? [
  { name: 'sqlite-data', storageType: 'AzureFile', storageName: caStorage.name }
] : []

var appVolumeMounts = enableSharing ? [
  { mountPath: '/app/data', volumeName: 'sqlite-data' }
] : []

// ── Container App ─────────────────────────────────────────────────
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
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
      }
      secrets: appSecrets
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
        // Scale to zero when idle — key cost saving for Consumption plan
        minReplicas: 0
        maxReplicas: 3
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

// ── Outputs ───────────────────────────────────────────────────────
@description('Public URL of the deployed application.')
output appUrl string = 'https://${containerApp.properties.configuration.ingress.fqdn}'

@description('Name of the Container App (used by CD workflow to update the image).')
output containerAppName string = containerApp.name

@description('Resource group name.')
output resourceGroupName string = resourceGroup().name
