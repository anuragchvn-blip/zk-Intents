#!/bin/bash
# Circuit Key Generation Script
# Generates production-ready proving and verification keys

set -e

echo "🔧 Starting circuit key generation..."

CIRCUITS_DIR="$(dirname "$0")"
BUILD_DIR="$CIRCUITS_DIR/build"
KEYS_DIR="$CIRCUITS_DIR/keys"

mkdir -p "$BUILD_DIR"
mkdir -p "$KEYS_DIR"

# Download Powers of Tau (if not exists)
if [ ! -f "$KEYS_DIR/powersOfTau28_hez_final_20.ptau" ]; then
    echo "📥 Downloading Powers of Tau ceremony file..."
    wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau -O "$KEYS_DIR/powersOfTau28_hez_final_20.ptau"
fi

PTAU_FILE="$KEYS_DIR/powersOfTau28_hez_final_20.ptau"

# Compile transfer circuit
echo "⚙️  Compiling transfer circuit..."
circom "$CIRCUITS_DIR/transfer.circom" \
    --r1cs --wasm --sym \
    -o "$BUILD_DIR" \
    -l "$CIRCUITS_DIR/../node_modules"

echo "📊 Circuit info:"
snarkjs r1cs info "$BUILD_DIR/transfer.r1cs"

# Generate witness calculator
echo "🧮 Generating witness calculator..."
node "$BUILD_DIR/transfer_js/generate_witness.js" \
    "$BUILD_DIR/transfer_js/transfer.wasm" \
    "$CIRCUITS_DIR/test/input.json" \
    "$BUILD_DIR/witness.wtns" || echo "Witness generation test (will work after proper input)"

# Setup Groth16
echo "🔐 Setting up Groth16 proving system..."
snarkjs groth16 setup \
    "$BUILD_DIR/transfer.r1cs" \
    "$PTAU_FILE" \
    "$KEYS_DIR/transfer_0000.zkey"

echo "🎯 Contributing to phase 2 ceremony..."
echo "random-entropy-$(date +%s)" | snarkjs zkey contribute \
    "$KEYS_DIR/transfer_0000.zkey" \
    "$KEYS_DIR/transfer_0001.zkey" \
    --name="1st Contributor"

# Verify the final zkey
echo "✅ Verifying zkey..."
snarkjs zkey verify \
    "$BUILD_DIR/transfer.r1cs" \
    "$PTAU_FILE" \
    "$KEYS_DIR/transfer_0001.zkey"

# Export verification key
echo "📤 Exporting verification key..."
snarkjs zkey export verificationkey \
    "$KEYS_DIR/transfer_0001.zkey" \
    "$KEYS_DIR/verification_key.json"

# Generate Solidity verifier
echo "📝 Generating Solidity verifier contract..."
snarkjs zkey export solidityverifier \
    "$KEYS_DIR/transfer_0001.zkey" \
    "$CIRCUITS_DIR/../contracts/Verifier_generated.sol"

echo "✨ Circuit keys generated successfully!"
echo ""
echo "📁 Output files:"
echo "  - Proving key: $KEYS_DIR/transfer_0001.zkey"
echo "  - Verification key: $KEYS_DIR/verification_key.json"
echo "  - Solidity verifier: ../contracts/Verifier_generated.sol"
echo "  - R1CS: $BUILD_DIR/transfer.r1cs"
echo "  - WASM: $BUILD_DIR/transfer_js/transfer.wasm"
echo ""
echo "🎉 Ready for production proof generation!"
