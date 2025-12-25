# Trello Webhook Setup Script
# This script helps you set up a Trello webhook for instant "Process For AI" button addition

param(
    [string]$NgrokUrl = "",
    [string]$TrelloApiKey = "",
    [string]$TrelloToken = "",
    [string]$BoardId = ""
)

Write-Host "`n🔧 Trello Webhook Setup for Instant Button Addition`n" -ForegroundColor Cyan

# Check if ngrok URL is provided
if ([string]::IsNullOrEmpty($NgrokUrl)) {
    Write-Host "❌ Error: ngrok URL is required" -ForegroundColor Red
    Write-Host "`n📋 Instructions:" -ForegroundColor Yellow
    Write-Host "1. Install ngrok: https://ngrok.com/download"
    Write-Host "2. Start ngrok: ngrok http 3001"
    Write-Host "3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)"
    Write-Host "4. Run this script again with: .\setup-trello-webhook.ps1 -NgrokUrl 'https://your-ngrok-url.ngrok.io'`n"
    exit 1
}

# Check if API credentials are provided
if ([string]::IsNullOrEmpty($TrelloApiKey)) {
    $TrelloApiKey = $env:TRELLO_API_KEY
    if ([string]::IsNullOrEmpty($TrelloApiKey)) {
        Write-Host "❌ Error: Trello API Key not found" -ForegroundColor Red
        Write-Host "`nProvide it via:" -ForegroundColor Yellow
        Write-Host "  - Environment variable: `$env:TRELLO_API_KEY"
        Write-Host "  - Script parameter: -TrelloApiKey 'your-key'`n"
        exit 1
    }
}

if ([string]::IsNullOrEmpty($TrelloToken)) {
    $TrelloToken = $env:TRELLO_TOKEN
    if ([string]::IsNullOrEmpty($TrelloToken)) {
        Write-Host "❌ Error: Trello Token not found" -ForegroundColor Red
        Write-Host "`nProvide it via:" -ForegroundColor Yellow
        Write-Host "  - Environment variable: `$env:TRELLO_TOKEN"
        Write-Host "  - Script parameter: -TrelloToken 'your-token'`n"
        exit 1
    }
}

if ([string]::IsNullOrEmpty($BoardId)) {
    $BoardId = $env:TRELLO_BOARD_ID
    if ([string]::IsNullOrEmpty($BoardId)) {
        Write-Host "❌ Error: Trello Board ID not found" -ForegroundColor Red
        Write-Host "`nProvide it via:" -ForegroundColor Yellow
        Write-Host "  - Environment variable: `$env:TRELLO_BOARD_ID"
        Write-Host "  - Script parameter: -BoardId 'your-board-id'`n"
        exit 1
    }
}

# Construct webhook URL
$webhookCallbackUrl = "$NgrokUrl/trello/webhook"
Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "  Webhook Callback URL: $webhookCallbackUrl"
Write-Host "  Trello Board ID: $BoardId"
Write-Host "  API Key: $($TrelloApiKey.Substring(0, 8))...`n"

# Check existing webhooks first
Write-Host "🔍 Checking existing webhooks..." -ForegroundColor Yellow
try {
    $listWebhooksUrl = "https://api.trello.com/1/tokens/$TrelloToken/webhooks?key=$TrelloApiKey"
    $existingWebhooks = Invoke-RestMethod -Uri $listWebhooksUrl -Method GET
    
    # Check if webhook for this board already exists
    $existingWebhook = $existingWebhooks | Where-Object { 
        $_.idModel -eq $BoardId -and $_.callbackURL -like "*ngrok*"
    }
    
    if ($existingWebhook) {
        Write-Host "⚠️  Found existing webhook for this board:" -ForegroundColor Yellow
        Write-Host "   ID: $($existingWebhook.id)"
        Write-Host "   URL: $($existingWebhook.callbackURL)"
        
        $response = Read-Host "`nDo you want to delete it and create a new one? (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            try {
                $deleteUrl = "https://api.trello.com/1/webhooks/$($existingWebhook.id)?key=$TrelloApiKey&token=$TrelloToken"
                Invoke-RestMethod -Uri $deleteUrl -Method DELETE
                Write-Host "✅ Deleted existing webhook" -ForegroundColor Green
            } catch {
                Write-Host "❌ Error deleting webhook: $_" -ForegroundColor Red
            }
        } else {
            Write-Host "ℹ️  Keeping existing webhook. Exiting." -ForegroundColor Yellow
            exit 0
        }
    }
} catch {
    Write-Host "⚠️  Could not check existing webhooks: $_" -ForegroundColor Yellow
}

# Create webhook
Write-Host "`n🔨 Creating webhook..." -ForegroundColor Yellow
try {
    $createWebhookUrl = "https://api.trello.com/1/tokens/$TrelloToken/webhooks?key=$TrelloApiKey"
    $body = @{
        description = "News Agent - Instant Process For AI Button"
        callbackURL = $webhookCallbackUrl
        idModel = $BoardId
    } | ConvertTo-Json
    
    $webhook = Invoke-RestMethod -Uri $createWebhookUrl -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "✅ Webhook created successfully!" -ForegroundColor Green
    Write-Host "`n📋 Webhook Details:" -ForegroundColor Cyan
    Write-Host "   ID: $($webhook.id)"
    Write-Host "   Description: $($webhook.description)"
    Write-Host "   Callback URL: $($webhook.callbackURL)"
    Write-Host "   Board ID: $($webhook.idModel)"
    Write-Host "   Active: $($webhook.active)"
    
    Write-Host "`n🎉 Setup Complete!" -ForegroundColor Green
    Write-Host "`nNow when you:" -ForegroundColor Yellow
    Write-Host "1. Add a URL to a Trello card description"
    Write-Host "2. Click Save"
    Write-Host "`nThe 'Process For AI' button will appear INSTANTLY (no 30-second wait!)`n" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n❌ Error creating webhook: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Make sure ngrok is running: ngrok http 3001"
    Write-Host "2. Verify the ngrok URL is correct and accessible"
    Write-Host "3. Check that your Trello API key and token are valid"
    exit 1
}




