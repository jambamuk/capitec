param(
    [string]$BaseUrl = 'http://localhost:8080',
    [string]$Username = 'operator',
    [string]$Password = 'operator-demo',
    [string]$AccountId,
    [ValidateSet('CATEGORY','MERCHANT','SOURCE','ACCOUNT','DAY','MONTH')][string]$GroupBy
)
$ErrorActionPreference = 'Stop'
$csrf = Invoke-RestMethod "$BaseUrl/api/csrf" -SessionVariable apiSession
$headers = @{}
$headers[$csrf.headerName] = $csrf.token
Invoke-WebRequest -UseBasicParsing "$BaseUrl/api/session" -Method Post -WebSession $apiSession -Headers $headers -ContentType 'application/x-www-form-urlencoded' -Body @{ username=$Username; password=$Password } | Out-Null
$query = @()
if ($AccountId) { $query += 'accountId=' + [Uri]::EscapeDataString($AccountId) }
if ($GroupBy) { $query += 'groupBy=' + $GroupBy }
$endpoint = if ($GroupBy) { '/api/v1/breakdowns' } else { '/api/v1/transaction-summary' }
if ($query.Count) { $endpoint += '?' + ($query -join '&') }
Invoke-RestMethod "$BaseUrl$endpoint" -WebSession $apiSession | ConvertTo-Json -Depth 10
