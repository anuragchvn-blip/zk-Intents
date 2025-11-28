pragma circom 2.1.6;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";

/**
 * Sparse Merkle Tree inclusion proof verifier
 * Proves that a leaf exists at a specific position in the tree
 * 
 * @param depth - Height of the Merkle tree (default: 32 for 2^32 leaves)
 */
template MerkleTreeInclusionProof(depth) {
    signal input leaf;              // Leaf value (hash of account data)
    signal input pathIndices[depth]; // Binary path: 0 = left, 1 = right
    signal input siblings[depth];    // Sibling hashes at each level
    signal input root;              // Expected root hash
    
    signal output valid;            // 1 if proof is valid, 0 otherwise
    
    // Intermediate hash values as we traverse up the tree
    signal hashes[depth + 1];
    hashes[0] <== leaf;
    
    component hashers[depth];
    component selectors[depth];
    
    for (var i = 0; i < depth; i++) {
        // Select left and right based on path index
        selectors[i] = Mux1();
        selectors[i].c[0] <== hashes[i];       // If index=0, current is left
        selectors[i].c[1] <== siblings[i];     // If index=0, sibling is right
        selectors[i].s <== pathIndices[i];
        
        // Hash the pair (using Poseidon hash for efficiency)
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== pathIndices[i] == 0 ? hashes[i] : siblings[i];
        hashers[i].inputs[1] <== pathIndices[i] == 0 ? siblings[i] : hashes[i];
        
        hashes[i + 1] <== hashers[i].out;
    }
    
    // Verify final hash matches the root
    component isEqual = IsEqual();
    isEqual.in[0] <== hashes[depth];
    isEqual.in[1] <== root;
    valid <== isEqual.out;
}

/**
 * Merkle tree updater - proves state transition
 * Shows that updating a leaf changes root from oldRoot to newRoot
 */
template MerkleTreeUpdate(depth) {
    signal input oldLeaf;
    signal input newLeaf;
    signal input pathIndices[depth];
    signal input siblings[depth];
    signal input oldRoot;
    signal output newRoot;
    
    // Verify old inclusion proof
    component oldProof = MerkleTreeInclusionProof(depth);
    oldProof.leaf <== oldLeaf;
    oldProof.root <== oldRoot;
    for (var i = 0; i < depth; i++) {
        oldProof.pathIndices[i] <== pathIndices[i];
        oldProof.siblings[i] <== siblings[i];
    }
    oldProof.valid === 1;
    
    // Compute new root with updated leaf
    signal hashes[depth + 1];
    hashes[0] <== newLeaf;
    
    component hashers[depth];
    for (var i = 0; i < depth; i++) {
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== pathIndices[i] == 0 ? hashes[i] : siblings[i];
        hashers[i].inputs[1] <== pathIndices[i] == 0 ? siblings[i] : hashes[i];
        hashes[i + 1] <== hashers[i].out;
    }
    
    newRoot <== hashes[depth];
}

// Mux1 helper (selects between two inputs based on selector)
template Mux1() {
    signal input c[2];
    signal input s;
    signal output out;
    
    out <== c[0] + s * (c[1] - c[0]);
}
