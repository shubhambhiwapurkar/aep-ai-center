#!/bin/bash
# Azure OpenAI Setup Helper
# Run this script to configure Azure OpenAI for the AI Agent

echo "=== Azure OpenAI Setup for AEP Monitor Agent ==="
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Azure CLI not found. Installing..."
    # For Windows, use winget
    winget install Microsoft.AzureCLI
    echo "Please restart your terminal after installation and run this script again."
    exit 1
fi

# Login to Azure
echo "Step 1: Logging into Azure..."
az login

# List available subscriptions
echo ""
echo "Step 2: Available subscriptions:"
az account list --output table

# Set subscription
echo ""
read -p "Enter your subscription ID: " SUBSCRIPTION_ID
az account set --subscription "$SUBSCRIPTION_ID"

# List or create Azure OpenAI resource
echo ""
echo "Step 3: Checking for Azure OpenAI resources..."
az cognitiveservices account list --query "[?kind=='OpenAI']" --output table

echo ""
read -p "Enter your Azure OpenAI resource name (or press Enter to create new): " RESOURCE_NAME

if [ -z "$RESOURCE_NAME" ]; then
    echo "Creating new Azure OpenAI resource..."
    read -p "Enter resource group name: " RESOURCE_GROUP
    read -p "Enter region (e.g., eastus, westeurope): " LOCATION
    RESOURCE_NAME="aep-monitor-openai-$(date +%s)"
    
    az cognitiveservices account create \
        --name "$RESOURCE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --kind OpenAI \
        --sku S0 \
        --location "$LOCATION" \
        --yes
fi

# Get the endpoint and key
echo ""
echo "Step 4: Getting credentials..."
ENDPOINT=$(az cognitiveservices account show --name "$RESOURCE_NAME" --query "properties.endpoint" -o tsv)
API_KEY=$(az cognitiveservices account keys list --name "$RESOURCE_NAME" --query "key1" -o tsv)

# List deployments
echo ""
echo "Step 5: Available model deployments:"
az cognitiveservices account deployment list --name "$RESOURCE_NAME" --output table

read -p "Enter deployment name (e.g., gpt-4, gpt-35-turbo): " DEPLOYMENT_NAME

# Output configuration
echo ""
echo "=== Configuration Complete ==="
echo ""
echo "Add these to your backend/.env file:"
echo ""
echo "AZURE_OPENAI_ENDPOINT=$ENDPOINT"
echo "AZURE_OPENAI_API_KEY=$API_KEY"
echo "AZURE_OPENAI_DEPLOYMENT=$DEPLOYMENT_NAME"
echo "AZURE_OPENAI_API_VERSION=2024-02-15-preview"
echo ""
echo "Done! Restart your backend server to apply changes."
