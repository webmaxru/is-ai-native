// Azure Budget Alert — subscription-scoped deployment
// Monitors the is-ai-native-rg resource group for monthly spending over ~$5/day ($150/month)
// Deploy with: az deployment sub create --location <region> --template-file infra/budget.bicep --parameters rgName=<rg-name> email=<your-email>

targetScope = 'subscription'

@description('Name of the resource group to monitor.')
param rgName string = 'is-ai-native-rg'

@description('Email address to receive budget alerts.')
param email string

@description('Monthly budget amount in USD (default: $30 = ~$1/day).')
param monthlyBudget int = 30

@description('Budget name.')
param budgetName string = 'is-ai-native-daily-limit'

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: monthlyBudget
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '2026-03-01'
      endDate: '2027-12-31'
    }
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [
          rgName
        ]
      }
    }
    notifications: {
      // Alert at 80% of monthly budget (~$120 = $4/day average)
      Alert80Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        contactEmails: [
          email
        ]
        thresholdType: 'Actual'
      }
      // Alert at 100% of monthly budget ($150 = $5/day average)
      Alert100Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactEmails: [
          email
        ]
        thresholdType: 'Actual'
      }
      // Alert at 120% of monthly budget (overage protection)
      Alert120Percent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 120
        contactEmails: [
          email
        ]
        thresholdType: 'Actual'
      }
    }
  }
}

output budgetName string = budget.name
output budgetId string = budget.id
