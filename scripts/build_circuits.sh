#!/bin/bash
# Build script for compiling Circom circuits and generating proving/verification keys

set -e

echo "🔧 Building zk-Intents Circuits..."

# Create build directory
mkdir -p circuits/build

cd circuits

# List of circuits to compile
CIRCUITS=("merkle" "commitments" "eddsa" "transfer")

for circuit in "${CIRCUITS[@]}"; do
    echo "📦 Compiling $circuit.circom..."
    
    # Compile circuit to R1CS and WASM
    circom "$circuit.circom" --r1cs --wasm --sym --c -o build/
    
    echo "✅ $circuit compiled successfully"
done

echo "🎉 All circuits built successfully!"
echo "Next steps:"
echo "  1. Run setup_srs.sh to generate proving keys"
echo "  2. Run circuit tests: npm test"
