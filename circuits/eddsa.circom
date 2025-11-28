pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/eddsamimc.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

/**
 * EdDSA signature verification on BabyJubJub curve
 * Used to verify user intent signatures
 */
template EdDSAVerifier() {
    signal input pubKey[2];        // Public key (x, y) coordinates
    signal input signature[3];     // EdDSA signature (R8x, R8y, S)
    signal input message;          // Message hash to verify
    signal output valid;
    
    component verifier = EdDSAMiMCVerifier();
    verifier.enabled <== 1;
    verifier.Ax <== pubKey[0];
    verifier.Ay <== pubKey[1];
    verifier.R8x <== signature[0];
    verifier.R8y <== signature[1];
    verifier.S <== signature[2];
    verifier.M <== message;
    
    valid <== 1; // If circuit doesn't fail, signature is valid
}

/**
 * Multi-field message hasher for intent signing
 * Hashes all intent fields into a single message
 */
template IntentMessageHasher() {
    signal input intentId;
    signal input action;           // 0=transfer, 1=withdraw, etc.
    signal input targetCommitment; // Commitment to target address
    signal input amountCommitment; // Commitment to amount
    signal input nonce;
    signal input timestamp;
    signal output messageHash;
    
    component hasher = Poseidon(6);
    hasher.inputs[0] <== intentId;
    hasher.inputs[1] <== action;
    hasher.inputs[2] <== targetCommitment;
    hasher.inputs[3] <== amountCommitment;
    hasher.inputs[4] <== nonce;
    hasher.inputs[5] <== timestamp;
    
    messageHash <== hasher.out;
}
