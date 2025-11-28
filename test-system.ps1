# Test Script - Verify zk-Intents Full Stack

Write-Host "🧪 Testing zk-Intents Services..." -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3000"
$proverUrl = "http://localhost:8080"
$workerUrl = "http://localhost:8081"

# Test 1: Sequencer Health
Write-Host "[1/6] Testing Sequencer..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    if ($response.status -eq "ok") {
        Write-Host " ✓ OK" -ForegroundColor Green
    } else {
        Write-Host " ✗ FAIL" -ForegroundColor Red
    }
} catch {
    Write-Host " ✗ OFFLINE" -ForegroundColor Red
}

# Test 2: Prover Orchestrator
Write-Host "[2/6] Testing Prover Orchestrator..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "$proverUrl/health" -Method GET
    if ($response.status -eq "ok") {
        Write-Host " ✓ OK" -ForegroundColor Green
    } else {
        Write-Host " ✗ FAIL" -ForegroundColor Red
    }
} catch {
    Write-Host " ✗ OFFLINE" -ForegroundColor Red
}

# Test 3: Prover Worker
Write-Host "[3/6] Testing Prover Worker..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "$workerUrl/health" -Method GET
    if ($response.status -eq "ok") {
        Write-Host " ✓ OK" -ForegroundColor Green
        if ($response.circuitsExist) {
            Write-Host "   └─ Circuits found: $($response.circuitsPath)" -ForegroundColor Gray
        } else {
            Write-Host "   └─ ⚠️  No circuits found" -ForegroundColor Yellow
        }
    } else {
        Write-Host " ✗ FAIL" -ForegroundColor Red
    }
} catch {
    Write-Host " ✗ OFFLINE" -ForegroundColor Red
}

# Test 4: Solver Network
Write-Host "[4/6] Testing Solver Network..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/solvers/stats" -Method GET
    Write-Host " ✓ OK" -ForegroundColor Green
    Write-Host "   └─ Active Solvers: $($response.totalSolvers)" -ForegroundColor Gray
    Write-Host "   └─ Pending Auctions: $($response.pendingAuctions)" -ForegroundColor Gray
} catch {
    Write-Host " ✗ FAIL" -ForegroundColor Red
}

# Test 5: Submit Test Intent
Write-Host "[5/6] Testing Intent Submission..." -NoNewline
try {
    $intent = @{
        intentId = "test_$(Get-Date -Format 'yyyyMMddHHmmss')"
        senderAddress = "0x1234567890123456789012345678901234567890"
        action = "transfer"
        amountCommitment = "0x0000000000000000000000000000000000000000000000000de0b6b3a7640000"
        targetCommitment = "0x9876543210987654321098765432109876543210"
        nonce = 0
        timestamp = [int](Get-Date -UFormat %s)
        signature = @{
            r = "0x" + ("0" * 64)
            s = "0x" + ("0" * 64)
            pubKey = @("0x" + ("0" * 64), "0x" + ("0" * 64))
        }
    }
    
    $body = $intent | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri "$baseUrl/api/v1/intents" -Method POST -Body $body -ContentType "application/json"
    
    if ($response.status -eq "queued") {
        Write-Host " ✓ OK" -ForegroundColor Green
        Write-Host "   └─ Intent ID: $($response.intentId)" -ForegroundColor Gray
    } else {
        Write-Host " ✗ FAIL" -ForegroundColor Red
    }
} catch {
    Write-Host " ✗ FAIL - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 6: Check Available Circuits
Write-Host "[6/6] Checking Available Circuits..." -NoNewline
try {
    $response = Invoke-RestMethod -Uri "$workerUrl/circuits" -Method GET
    Write-Host " ✓ OK" -ForegroundColor Green
    
    if ($response.circuits.Count -gt 0) {
        foreach ($circuit in $response.circuits) {
            $status = if ($circuit.ready) { "✓ Ready" } else { "✗ Not Ready" }
            $color = if ($circuit.ready) { "Green" } else { "Yellow" }
            Write-Host "   └─ $($circuit.name): $status" -ForegroundColor $color
        }
    } else {
        Write-Host "   └─ ⚠️  No circuits found. Run: cd circuits && ./setup_keys.sh" -ForegroundColor Yellow
    }
} catch {
    Write-Host " ✗ FAIL" -ForegroundColor Red
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Full System Status:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend:    http://localhost:3001"
Write-Host "Sequencer:   http://localhost:3000"
Write-Host "Prover:      http://localhost:8080"
Write-Host "Worker:      http://localhost:8081"
Write-Host ""
Write-Host "💡 Next: Open http://localhost:3001 and create an account!" -ForegroundColor Green
Write-Host ""
