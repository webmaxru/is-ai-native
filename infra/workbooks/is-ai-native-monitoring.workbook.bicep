@description('Azure region for the workbook resource.')
param location string = resourceGroup().location

@description('Display name shown in the Azure Workbook gallery.')
param workbookDisplayName string = 'Is AI Native Monitoring'

@description('Source resource ID to associate the workbook with. Use the Log Analytics workspace or Azure Monitor.')
param workbookSourceId string

@description('Deterministic workbook resource ID.')
param workbookId string = guid(subscription().subscriptionId, resourceGroup().name, workbookDisplayName)

var workbookSerializedData = loadTextContent('is-ai-native-monitoring.workbook.json')

resource workbook 'Microsoft.Insights/workbooks@2023-06-01' = {
  name: workbookId
  location: location
  kind: 'shared'
  properties: {
    displayName: workbookDisplayName
    serializedData: workbookSerializedData
    version: 'Notebook/1.0'
    sourceId: workbookSourceId
    category: 'workbook'
  }
}

output workbookName string = workbook.name
output workbookResourceId string = workbook.id