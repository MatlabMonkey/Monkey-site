<#
.SYNOPSIS
    Quick Todo Adder PowerShell Script
.DESCRIPTION
    Adds a todo item to your dashboard via the webhook API
.PARAMETER Content
    The todo item content to add
.PARAMETER Source
    The source identifier (default: "PowerShell")
.EXAMPLE
    Add-Todo "Buy groceries"
.EXAMPLE
    Add-Todo -Content "Call dentist" -Source "Reminder"
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Content,
    
    [Parameter(Mandatory=$false)]
    [string]$Source = "PowerShell"
)

# Configuration
$TodoApiUrl = if (![string]::IsNullOrWhiteSpace($env:TODO_API_URL)) { $env:TODO_API_URL } else { "https://ztbrown.com/api/webhook/todos" }
$WebhookSecret = if (![string]::IsNullOrWhiteSpace($env:TODO_WEBHOOK_SECRET)) {
    $env:TODO_WEBHOOK_SECRET
} elseif (![string]::IsNullOrWhiteSpace($env:WEBHOOK_SECRET)) {
    $env:WEBHOOK_SECRET
} elseif (![string]::IsNullOrWhiteSpace($env:CAPTURE_API_KEY)) {
    $env:CAPTURE_API_KEY
} else {
    ""
}

function Add-TodoItem {
    param(
        [string]$TodoContent,
        [string]$TodoSource
    )
    
    if ([string]::IsNullOrWhiteSpace($TodoContent)) {
        Write-Host "❌ Error: Todo content cannot be empty" -ForegroundColor Red
        return $false
    }
    
    # Prepare the request body
    $body = @{
        content = $TodoContent.Trim()
        source = $TodoSource
    } | ConvertTo-Json
    
    # Prepare headers
    $headers = @{
        'Content-Type' = 'application/json'
        'User-Agent' = 'TodoScript-PowerShell/1.0'
    }
    
    # Add authentication if webhook secret is configured
    if (![string]::IsNullOrWhiteSpace($WebhookSecret)) {
        $headers['Authorization'] = "Bearer $WebhookSecret"
    }
    
    try {
        Write-Host "🔄 Adding todo: $TodoContent" -ForegroundColor Yellow
        
        $response = Invoke-RestMethod -Uri $TodoApiUrl -Method Post -Body $body -Headers $headers -TimeoutSec 10
        
        if ($response.success) {
            Write-Host "✅ Todo added successfully!" -ForegroundColor Green
            Write-Host "📝 Content: $TodoContent" -ForegroundColor Cyan
            Write-Host "🕒 Time: $(Get-Date -Format 'HH:mm:ss')" -ForegroundColor Cyan
            return $true
        } else {
            Write-Host "❌ Error: $($response.error)" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ Error adding todo: $($_.Exception.Message)" -ForegroundColor Red
        
        if ($_.Exception.Response) {
            $statusCode = $_.Exception.Response.StatusCode
            Write-Host "   HTTP Status: $statusCode" -ForegroundColor Red
        }
        
        Write-Host "💡 Tip: Check your API URL and internet connection" -ForegroundColor Yellow
        return $false
    }
}

# Main execution
$success = Add-TodoItem -TodoContent $Content -TodoSource $Source

if ($success) {
    Write-Host "🎉 Done! Check your dashboard inbox." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to add todo. Please try again." -ForegroundColor Red
}

# Keep window open briefly so user can see the result
Start-Sleep -Seconds 2
