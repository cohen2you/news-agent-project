# PowerShell script to kill process on port 3001
# Usage: .\kill-port.ps1

$port = 3001
$maxAttempts = 5
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "Attempt ${attempt}/${maxAttempts}: Checking port ${port}..."
    
    $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($processes) {
        $killedAny = $false
        foreach ($processId in $processes) {
            if ($processId -eq 0 -or $processId -eq $PID) {
                continue  # Skip system process or current script
            }
            
            $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Killing process $processId ($($process.ProcessName))..."
                
                # Try Stop-Process first (graceful)
                try {
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    Write-Host "  ✅ Process killed (graceful)"
                    $killedAny = $true
                } catch {
                    # If graceful fails, try taskkill (more forceful)
                    Write-Host "  ⚠️  Graceful kill failed, trying taskkill /F..."
                    try {
                        & taskkill /F /PID $processId 2>$null | Out-Null
                        Write-Host "  ✅ Process killed (force)"
                        $killedAny = $true
                    } catch {
                        Write-Host "  ❌ Failed to kill process $processId"
                    }
                }
            }
        }
        
        if ($killedAny) {
            # Wait progressively longer on each attempt
            $waitTime = $attempt * 1000  # 1s, 2s, 3s, 4s, 5s
            Write-Host "  ⏳ Waiting ${waitTime}ms for port to be released..."
            Start-Sleep -Milliseconds $waitTime
            
            # Check if port is now free
            $stillInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if (-not $stillInUse) {
                Write-Host "✅ Port $port is now free!"
                exit 0
            } else {
                Write-Host "  ⚠️  Port still in use, retrying..."
            }
        } else {
            Write-Host "  ⚠️  No processes to kill on this attempt"
            Start-Sleep -Milliseconds 1000
        }
    } else {
        Write-Host "✅ Port $port is free (no processes found)"
        exit 0
    }
}

Write-Host "❌ Failed to free port $port after $maxAttempts attempts"
Write-Host "   You may need to manually kill the process or wait longer"
exit 1

