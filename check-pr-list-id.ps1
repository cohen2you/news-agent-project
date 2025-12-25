# Quick script to check your PR list ID from .env.local
$envFile = ".env.local"
if (Test-Path $envFile) {
    $content = Get-Content $envFile
    $prListId = ($content | Select-String "TRELLO_LIST_ID_PR=").ToString().Split("=")[1]
    if ($prListId) {
        Write-Host "✅ Your PR List ID: $prListId" -ForegroundColor Green
        Write-Host ""
        Write-Host "To add Process For AI buttons, visit:" -ForegroundColor Cyan
        Write-Host "http://localhost:3001/trello/add-process-buttons/$prListId" -ForegroundColor Yellow
    } else {
        Write-Host "❌ TRELLO_LIST_ID_PR not found in .env.local" -ForegroundColor Red
    }
} else {
    Write-Host "❌ .env.local file not found" -ForegroundColor Red
}




