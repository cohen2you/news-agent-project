# PowerShell script to test analyst note card creation

$body = @{
    subject = "Goldman Sachs Raises TSLA Price Target to $350"
    content = "Goldman Sachs analyst John Doe has raised the price target for Tesla (TSLA) to $350, citing strong demand for electric vehicles and the company's expanding manufacturing capacity. The analyst maintains a Buy rating on the stock.

The firm notes that Tesla's recent production ramp-up and strong delivery numbers in Q4 2025 exceeded expectations. The company's ability to scale production while maintaining margins is seen as a key positive.

Key points:
- Price target raised from $300 to $350
- Buy rating maintained
- Strong Q4 2025 delivery numbers
- Production capacity expansion on track"
    ticker = "TSLA"
    firm = "Goldman Sachs"
    analyst = "John Doe"
} | ConvertTo-Json

Write-Host "Creating test analyst note card..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "http://localhost:3001/analyst/test-create-card" -Method POST -Body $body -ContentType "application/json"

Write-Host "`n✅ Success!" -ForegroundColor Green
Write-Host "Card ID: $($response.cardId)" -ForegroundColor Yellow
Write-Host "Card URL: $($response.cardUrl)" -ForegroundColor Yellow
Write-Host "Title: $($response.title)" -ForegroundColor Yellow
Write-Host "`nCheck your Trello board to see the card!" -ForegroundColor Cyan




