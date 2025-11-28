#!/bin/bash

echo "🚀 Starting zk-Intents Full Stack..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if circuit keys exist
if [ ! -f "circuits/transfer_final.zkey" ]; then
    echo -e "${YELLOW}⚠️  Circuit keys not found. Generating...${NC}"
    cd circuits
    ./setup_keys.sh
    cd ..
fi

# Start Prover Worker
echo -e "${BLUE}[1/4]${NC} Starting Prover Worker (port 8081)..."
cd prover/worker
npm install > /dev/null 2>&1
npm run build > /dev/null 2>&1
PORT=8081 npm start > ../../logs/prover-worker.log 2>&1 &
WORKER_PID=$!
echo -e "${GREEN}✓${NC} Prover Worker started (PID: $WORKER_PID)"
cd ../..

# Start Prover Orchestrator
echo -e "${BLUE}[2/4]${NC} Starting Prover Orchestrator (port 8080)..."
cd prover
npm install > /dev/null 2>&1
npm run build > /dev/null 2>&1
PORT=8080 npm start > ../logs/prover-orchestrator.log 2>&1 &
ORCHESTRATOR_PID=$!
echo -e "${GREEN}✓${NC} Prover Orchestrator started (PID: $ORCHESTRATOR_PID)"
cd ..

# Wait for prover to be ready
sleep 3

# Start Sequencer
echo -e "${BLUE}[3/4]${NC} Starting Sequencer (port 3000)..."
cd sequencer
npm install > /dev/null 2>&1
npm run build > /dev/null 2>&1
PORT=3000 npm start > ../logs/sequencer.log 2>&1 &
SEQUENCER_PID=$!
echo -e "${GREEN}✓${NC} Sequencer started (PID: $SEQUENCER_PID)"
cd ..

# Wait for sequencer to be ready
sleep 3

# Start Frontend
echo -e "${BLUE}[4/4]${NC} Starting Frontend (port 3001)..."
cd ui
npm install > /dev/null 2>&1
PORT=3001 npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo -e "${GREEN}✓${NC} Frontend started (PID: $FRONTEND_PID)"
cd ..

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""
echo "📊 Services:"
echo "  • Prover Worker:       http://localhost:8081/health"
echo "  • Prover Orchestrator: http://localhost:8080/health"
echo "  • Sequencer:           http://localhost:3000/health"
echo "  • Frontend:            http://localhost:3001"
echo ""
echo "📝 Logs:"
echo "  • Prover Worker:       tail -f logs/prover-worker.log"
echo "  • Prover Orchestrator: tail -f logs/prover-orchestrator.log"
echo "  • Sequencer:           tail -f logs/sequencer.log"
echo "  • Frontend:            tail -f logs/frontend.log"
echo ""
echo "🛑 To stop all services:"
echo "  kill $WORKER_PID $ORCHESTRATOR_PID $SEQUENCER_PID $FRONTEND_PID"
echo ""
echo "💡 Solver Network Stats: http://localhost:3000/api/v1/solvers/stats"
echo ""
