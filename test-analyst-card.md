# Test Analyst Note Card Creation

You can test the analyst note card creation without email setup using this endpoint.

## Endpoint

**POST** `/analyst/test-create-card`

## Request Body

```json
{
  "subject": "Goldman Sachs Raises TSLA Price Target to $350",
  "content": "Goldman Sachs analyst John Doe has raised the price target for Tesla (TSLA) to $350, citing strong demand for electric vehicles and the company's expanding manufacturing capacity. The analyst maintains a Buy rating on the stock.\n\nThe firm notes that Tesla's recent production ramp-up and strong delivery numbers in Q4 2025 exceeded expectations. The company's ability to scale production while maintaining margins is seen as a key positive.\n\nKey points:\n- Price target raised from $300 to $350\n- Buy rating maintained\n- Strong Q4 2025 delivery numbers\n- Production capacity expansion on track",
  "ticker": "TSLA",
  "firm": "Goldman Sachs",
  "analyst": "John Doe"
}
```

## Optional Fields

- `pdfContent` - Base64-encoded PDF file (if you want to test PDF extraction)
- `pdfFilename` - Name of the PDF file (e.g., "analyst-note.pdf")

## Example with cURL

```bash
curl -X POST http://localhost:3001/analyst/test-create-card \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Goldman Sachs Raises TSLA Price Target to $350",
    "content": "Goldman Sachs analyst John Doe has raised the price target for Tesla (TSLA) to $350...",
    "ticker": "TSLA",
    "firm": "Goldman Sachs",
    "analyst": "John Doe"
  }'
```

## Example with PowerShell

```powershell
$body = @{
    subject = "Goldman Sachs Raises TSLA Price Target to `$350"
    content = "Goldman Sachs analyst John Doe has raised the price target for Tesla (TSLA) to `$350, citing strong demand for electric vehicles and the company's expanding manufacturing capacity. The analyst maintains a Buy rating on the stock."
    ticker = "TSLA"
    firm = "Goldman Sachs"
    analyst = "John Doe"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/analyst/test-create-card" -Method POST -Body $body -ContentType "application/json"
```

**Or using a single-line command:**

```powershell
$json = '{"subject":"Goldman Sachs Raises TSLA Price Target to $350","content":"Goldman Sachs analyst John Doe has raised the price target for Tesla (TSLA) to $350...","ticker":"TSLA","firm":"Goldman Sachs","analyst":"John Doe"}'; Invoke-RestMethod -Uri "http://localhost:3001/analyst/test-create-card" -Method POST -Body $json -ContentType "application/json"
```

## Response

```json
{
  "success": true,
  "message": "Test analyst note card created successfully",
  "cardId": "6947da04746b1474227ba3f4",
  "cardUrl": "https://trello.com/c/...",
  "title": "TSLA... Goldman Sachs Raises TSLA Price Target to $350"
}
```

## What It Does

1. Creates a Trello card in the "Analyst Notes" list
2. Formats it exactly like the email agent would:
   - Title with ticker prefix: `TSLA... [Subject]`
   - Description with firm, analyst, ticker, date
   - "Generate Story" button link
   - Full note data stored as metadata (for story generation)

## Testing the Full Flow

1. **Create Test Card**: Use the endpoint above
2. **Check Trello**: Verify the card appears in "Analyst Notes" list
3. **Click "Generate Story"**: Test the story generation flow
4. **Verify**: Story should be generated and card moved to "Submitted"

