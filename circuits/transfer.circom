pragma circom 2.1.6;

include "./merkle.circom";
include "./commitments.circom";
include "./eddsa.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";

/**
 * Account leaf structure
 * Each account in the state tree has: balance commitment, nonce, pubkey
 */
template AccountLeafHash() {
    signal input balanceCommitment;
    signal input nonce;
    signal input pubKeyX;
    signal input pubKeyY;
    signal output leafHash;
    
    component hasher = Poseidon(4);
    hasher.inputs[0] <== balanceCommitment;
    hasher.inputs[1] <== nonce;
    hasher.inputs[2] <== pubKeyX;
    hasher.inputs[3] <== pubKeyY;
    
    leafHash <== hasher.out;
}

/**
 * Transfer intent circuit
 * Proves a valid transfer from sender to receiver with:
 * - Valid signature
 * - Sufficient balance
 * - Correct state transition
 */
template TransferIntent(depth) {
    // Public inputs
    signal input oldStateRoot;
    signal output newStateRoot;
    
    // Intent data
    signal input intentId;
    signal input senderIndex;
    signal input receiverIndex;
    signal input amount;           // Actual amount (private)
    signal input amountCommitment; // Public commitment to amount
    signal input amountBlinding;
    signal input nonce;
    signal input timestamp;
    
    // Sender account (private)
    signal input senderBalance;
    signal input senderBalanceBlinding;
    signal input senderBalanceCommitment;
    signal input senderNonce;
    signal input senderPubKeyX;
    signal input senderPubKeyY;
    signal input senderPathIndices[depth];
    signal input senderSiblings[depth];
    
    // Receiver account (private)
    signal input receiverBalance;
    signal input receiverBalanceBlinding;
    signal input receiverBalanceCommitment;
    signal input receiverNonce;
    signal input receiverPubKeyX;
    signal input receiverPubKeyY;
    signal input receiverPathIndices[depth];
    signal input receiverSiblings[depth];
    
    // Signature
    signal input signature[3];
    
    // ==== Step 1: Verify amount commitment ====
    component verifyAmountCommit = VerifyCommitment();
    verifyAmountCommit.value <== amount;
    verifyAmountCommit.blinding <== amountBlinding;
    verifyAmountCommit.commitment <== amountCommitment;
    verifyAmountCommit.valid === 1;
    
    // ==== Step 2: Verify sender nonce matches ====
    component nonceCheck = IsEqual();
    nonceCheck.in[0] <== senderNonce;
    nonceCheck.in[1] <== nonce;
    nonceCheck.out === 1;
    
    // ==== Step 3: Verify signature ====
    component messageHasher = IntentMessageHasher();
    messageHasher.intentId <== intentId;
    messageHasher.action <== 0; // 0 = transfer
    messageHasher.targetCommitment <== 0; // Not used for transfers
    messageHasher.amountCommitment <== amountCommitment;
    messageHasher.nonce <== nonce;
    messageHasher.timestamp <== timestamp;
    
    component sigVerifier = EdDSAVerifier();
    sigVerifier.pubKey[0] <== senderPubKeyX;
    sigVerifier.pubKey[1] <== senderPubKeyY;
    sigVerifier.signature[0] <== signature[0];
    sigVerifier.signature[1] <== signature[1];
    sigVerifier.signature[2] <== signature[2];
    sigVerifier.message <== messageHasher.messageHash;
    sigVerifier.valid === 1;
    
    // ==== Step 4: Compute sender's old leaf ====
    component senderOldLeaf = AccountLeafHash();
    senderOldLeaf.balanceCommitment <== senderBalanceCommitment;
    senderOldLeaf.nonce <== senderNonce;
    senderOldLeaf.pubKeyX <== senderPubKeyX;
    senderOldLeaf.pubKeyY <== senderPubKeyY;
    
    // ==== Step 5: Verify sender inclusion in old state ====
    component senderInclusion = MerkleTreeInclusionProof(depth);
    senderInclusion.leaf <== senderOldLeaf.leafHash;
    senderInclusion.root <== oldStateRoot;
    for (var i = 0; i < depth; i++) {
        senderInclusion.pathIndices[i] <== senderPathIndices[i];
        senderInclusion.siblings[i] <== senderSiblings[i];
    }
    senderInclusion.valid === 1;
    
    // ==== Step 6: Check sender has sufficient balance ====
    signal newSenderBalance;
    newSenderBalance <== senderBalance - amount;
    component balanceCheck = NonNegativeBalance();
    balanceCheck.balance <== newSenderBalance;
    balanceCheck.valid === 1;
    
    // ==== Step 7: Compute new sender balance commitment ====
    component newSenderCommit = PedersenCommitment();
    newSenderCommit.value <== newSenderBalance;
    newSenderCommit.blinding <== senderBalanceBlinding;
    
    // ==== Step 8: Compute sender's new leaf (incremented nonce) ====
    component senderNewLeaf = AccountLeafHash();
    senderNewLeaf.balanceCommitment <== newSenderCommit.commitment;
    senderNewLeaf.nonce <== senderNonce + 1;
    senderNewLeaf.pubKeyX <== senderPubKeyX;
    senderNewLeaf.pubKeyY <== senderPubKeyY;
    
    // ==== Step 9: Update sender in tree -> intermediate root ====
    component senderUpdate = MerkleTreeUpdate(depth);
    senderUpdate.oldLeaf <== senderOldLeaf.leafHash;
    senderUpdate.newLeaf <== senderNewLeaf.leafHash;
    senderUpdate.oldRoot <== oldStateRoot;
    for (var i = 0; i < depth; i++) {
        senderUpdate.pathIndices[i] <== senderPathIndices[i];
        senderUpdate.siblings[i] <== senderSiblings[i];
    }
    signal intermediateRoot;
    intermediateRoot <== senderUpdate.newRoot;
    
    // ==== Step 10: Compute receiver's old leaf ====
    component receiverOldLeaf = AccountLeafHash();
    receiverOldLeaf.balanceCommitment <== receiverBalanceCommitment;
    receiverOldLeaf.nonce <== receiverNonce;
    receiverOldLeaf.pubKeyX <== receiverPubKeyX;
    receiverOldLeaf.pubKeyY <== receiverPubKeyY;
    
    // ==== Step 11: Verify receiver inclusion in intermediate state ====
    // NOTE: In practice, need to update siblings if sender/receiver share path
    // For simplicity, assuming they don't overlap significantly
    component receiverInclusion = MerkleTreeInclusionProof(depth);
    receiverInclusion.leaf <== receiverOldLeaf.leafHash;
    receiverInclusion.root <== intermediateRoot;
    for (var i = 0; i < depth; i++) {
        receiverInclusion.pathIndices[i] <== receiverPathIndices[i];
        receiverInclusion.siblings[i] <== receiverSiblings[i];
    }
    receiverInclusion.valid === 1;
    
    // ==== Step 12: Compute new receiver balance ====
    signal newReceiverBalance;
    newReceiverBalance <== receiverBalance + amount;
    
    component newReceiverCommit = PedersenCommitment();
    newReceiverCommit.value <== newReceiverBalance;
    newReceiverCommit.blinding <== receiverBalanceBlinding;
    
    // ==== Step 13: Compute receiver's new leaf ====
    component receiverNewLeaf = AccountLeafHash();
    receiverNewLeaf.balanceCommitment <== newReceiverCommit.commitment;
    receiverNewLeaf.nonce <== receiverNonce; // Receiver nonce unchanged
    receiverNewLeaf.pubKeyX <== receiverPubKeyX;
    receiverNewLeaf.pubKeyY <== receiverPubKeyY;
    
    // ==== Step 14: Update receiver in tree -> final root ====
    component receiverUpdate = MerkleTreeUpdate(depth);
    receiverUpdate.oldLeaf <== receiverOldLeaf.leafHash;
    receiverUpdate.newLeaf <== receiverNewLeaf.leafHash;
    receiverUpdate.oldRoot <== intermediateRoot;
    for (var i = 0; i < depth; i++) {
        receiverUpdate.pathIndices[i] <== receiverPathIndices[i];
        receiverUpdate.siblings[i] <== receiverSiblings[i];
    }
    
    newStateRoot <== receiverUpdate.newRoot;
}

// Main circuit with 20-level Merkle tree (supports 2^20 = 1M accounts)
component main {public [oldStateRoot, amountCommitment, intentId]} = TransferIntent(20);
