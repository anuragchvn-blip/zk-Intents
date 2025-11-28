# zk-Intents Full Stack Startup Script (Windows PowerShell)

Write-Host "🚀 Starting zk-Intents Full Stack..." -ForegroundColor Cyan
Write-Host ""

# Create logs directory if it doesn't exist
if (!(Test-Path "logs")) {
    New-Item -ItemType Directory -Path "logs" | Out-Null
}

# Check if circuit keys exist
if (!(Test-Path "circuits\transfer_final.zkey")) {
    Write-Host "⚠️  Circuit keys not found. Please run:" -ForegroundColor Yellow
    Write-Host "  cd circuits" -ForegroundColor Yellow
    Write-Host "  ./setup_keys.sh (or generate manually)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Continuing without keys (proofs will fail)..." -ForegroundColor Yellow
    Write-Host ""
}

# Function to start a service in a new window
function Start-Service {
    param (
        [string]$Name,
        [string]$Path,
        [string]$Command,
        [int]$Port
    )
    
    Write-Host "[Starting] $Name (port $Port)..." -ForegroundColor Blue
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Path'; $Command" -WindowStyle Normal
    
    Write-Host "✓ $Name started" -ForegroundColor Green
    Start-Sleep -Seconds 2
}

# Start Prover Worker
Start-Service -Name "Prover Worker" -Path "$PWD\prover\worker" -Command "npm start" -Port 8081

# Start Prover Orchestrator
Start-Service -Name "Prover Orchestrator" -Path "$PWD\prover" -Command "npm start" -Port 8080

# Start Sequencer
Start-Service -Name "Sequencer" -Path "$PWD\sequencer" -Command "npm run dev" -Port 3000

# Start Frontend
Start-Service -Name "Frontend" -Path "$PWD\ui" -Command "npm run dev" -Port 3001

Write-Host ""
Write-Host "✅ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Services:" -ForegroundColor Cyan
Write-Host "  • Prover Worker:       http://localhost:8081/health"
Write-Host "  • Prover Orchestrator: http://localhost:8080/health"
Write-Host "  • Sequencer:           http://localhost:3000/health"
Write-Host "  • Frontend:            http://localhost:3001"
Write-Host ""
Write-Host "💡 Test Endpoints:" -ForegroundColor Cyan
Write-Host "  • Solver Stats:   http://localhost:3000/api/v1/solvers/stats"
Write-Host "  • Prover Stats:   http://localhost:8080/api/v1/stats"
Write-Host "  • Circuits List:  http://localhost:8081/circuits"
Write-Host ""
Write-Host "🛑 To stop: Close all PowerShell windows or press Ctrl+C in each" -ForegroundColor Yellow
Write-Host ""

# Keep this window open
Write-Host "Press any key to exit this launcher window..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
