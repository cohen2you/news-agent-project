# Quick script to set up Trello webhook for Render
# This reads values from .env.local file

$renderUrl = "https://news-agent-project.onrender.com"
$envFile = ".env.local"

Write-Host "`n🔧 Setting up Trello webhook for Render`n" -ForegroundColor Cyan

# Read .env.local file
if (-not (Test-Path $envFile)) {
    Write-Host "❌ Error: $envFile not found" -ForegroundColor Red
    exit 1
}

Write-Host "📖 Reading configuration from $envFile..." -ForegroundColor Yellow
$envContent = Get-Content $envFile

$apiKey = ($envContent | Select-String -Pattern "^TRELLO_API_KEY=(.+)$").Matches.Groups[1].Value
$token = ($envContent | Select-String -Pattern "^TRELLO_TOKEN=(.+)$").Matches.Groups[1].Value
$boardId = ($envContent | Select-String -Pattern "^TRELLO_BOARD_ID=(.+)$").Matches.Groups[1].Value

if ([string]::IsNullOrEmpty($apiKey)) {
    Write-Host "❌ Error: TRELLO_API_KEY not found in $envFile" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($token)) {
    Write-Host "❌ Error: TRELLO_TOKEN not found in $envFile" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrEmpty($boardId)) {
    Write-Host "❌ Error: TRELLO_BOARD_ID not found in $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Configuration loaded" -ForegroundColor Green
Write-Host "`n📋 Webhook Configuration:" -ForegroundColor Cyan
Write-Host "   Callback URL: $renderUrl/trello/webhook"
Write-Host "   Board ID: $boardId"
Write-Host "   API Key: $($apiKey.Substring(0, [Math]::Min(8, $apiKey.Length)))...`n"

# Check existing webhooks
Write-Host "🔍 Checking for existing webhooks..." -ForegroundColor Yellow
try {
    $listUrl = "https://api.trello.com/1/tokens/$token/webhooks?key=$apiKey"
    $existingWebhooks = Invoke-RestMethod -Uri $listUrl -Method GET
    
    $existingWebhook = $existingWebhooks | Where-Object { $_.idModel -eq $boardId }
    
    if ($existingWebhook) {
        Write-Host "⚠️  Found existing webhook:" -ForegroundColor Yellow
        Write-Host "   ID: $($existingWebhook.id)"
        Write-Host "   URL: $($existingWebhook.callbackURL)"
        
        $response = Read-Host "`nDelete and create new one? (y/n)"
        if ($response -eq 'y' -or $response -eq 'Y') {
            $deleteUrl = "https://api.trello.com/1/webhooks/$($existingWebhook.id)?key=$apiKey&token=$token"
            Invoke-RestMethod -Uri $deleteUrl -Method DELETE | Out-Null
            Write-Host "✅ Deleted existing webhook" -ForegroundColor Green
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
    $createUrl = "https://api.trello.com/1/tokens/$token/webhooks?key=$apiKey"
    $body = @{
        description = "News Agent - Render Webhook"
        callbackURL = "$renderUrl/trello/webhook"
        idModel = $boardId
    } | ConvertTo-Json
    
    $webhook = Invoke-RestMethod -Uri $createUrl -Method POST -Body $body -ContentType "application/json"
    
    Write-Host "✅ Webhook created successfully!`n" -ForegroundColor Green
    Write-Host "📋 Webhook Details:" -ForegroundColor Cyan
    Write-Host "   ID: $($webhook.id)"
    Write-Host "   Description: $($webhook.description)"
    Write-Host "   Callback URL: $($webhook.callbackURL)"
    Write-Host "   Board ID: $($webhook.idModel)"
    Write-Host "   Active: $($webhook.active)"
    
    Write-Host "`n🎉 Setup Complete!" -ForegroundColor Green
    Write-Host "`nNow when you add a comment to the WGO Control Card, it will trigger instantly!`n" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n❌ Error creating webhook: $_" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

