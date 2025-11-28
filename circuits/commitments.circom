pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/babyjub.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

/**
 * Pedersen commitment using BabyJubJub curve
 * C = v*G + b*H where v is value, b is blinding factor
 */
template PedersenCommitment() {
    signal input value;
    signal input blinding;
    signal output commitment;
    
    // Use Poseidon hash for simplicity (production should use proper Pedersen)
    component hasher = Poseidon(2);
    hasher.inputs[0] <== value;
    hasher.inputs[1] <== blinding;
    commitment <== hasher.out;
}

/**
 * Verify commitment opening
 * Proves that value + blinding produces the given commitment
 */
template VerifyCommitment() {
    signal input value;
    signal input blinding;
    signal input commitment;
    signal output valid;
    
    component commit = PedersenCommitment();
    commit.value <== value;
    commit.blinding <== blinding;
    
    component isEqual = IsEqual();
    isEqual.in[0] <== commit.commitment;
    isEqual.in[1] <== commitment;
    valid <== isEqual.out;
}

/**
 * Range proof: proves that value is in range [0, 2^bits)
 * Uses bit decomposition to constrain value
 */
template RangeProof(bits) {
    signal input value;
    signal output valid;
    
    component n2b = Num2Bits(bits);
    n2b.in <== value;
    
    // If value fits in 'bits' bits, it's in range
    valid <== 1;
}

/**
 * Non-negative balance proof
 * Proves balance >= 0 after transaction
 */
template NonNegativeBalance() {
    signal input balance;
    signal output valid;
    
    // Balance must fit in 64 bits (max value constraint)
    component rangeCheck = RangeProof(64);
    rangeCheck.value <== balance;
    valid <== rangeCheck.valid;
}

/**
 * Commitment arithmetic: prove that commitments add correctly
 * C1 + C2 = C3 where C1 = commit(v1), C2 = commit(v2), C3 = commit(v1+v2)
 * With same blinding factors, commitment addition is homomorphic
 */
template CommitmentAddition() {
    signal input value1;
    signal input value2;
    signal input blinding;
    signal input commitment1;
    signal input commitment2;
    signal input commitmentSum;
    signal output valid;
    
    // Verify individual commitments
    component verify1 = VerifyCommitment();
    verify1.value <== value1;
    verify1.blinding <== blinding;
    verify1.commitment <== commitment1;
    
    component verify2 = VerifyCommitment();
    verify2.value <== value2;
    verify2.blinding <== blinding;
    verify2.commitment <== commitment2;
    
    // Verify sum commitment
    component verifySum = VerifyCommitment();
    verifySum.value <== value1 + value2;
    verifySum.blinding <== blinding;
    verifySum.commitment <== commitmentSum;
    
    valid <== verify1.valid * verify2.valid * verifySum.valid;
}
