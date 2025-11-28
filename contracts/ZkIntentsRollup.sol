// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZkIntentsRollup
 * @notice Core rollup contract managing state roots, batch verification, and L1↔L2 bridge
 * @dev Uses UUPS proxy pattern for upgradeability
 */
contract ZkIntentsRollup is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuard 
{
    // ===== State Variables =====
    
    /// @notice Current state root of the L2 state tree
    bytes32 public stateRoot;
    
    /// @notice Verifier contract address
    address public verifier;
    
    /// @notice Authorized sequencer address
    address public sequencer;
    
    /// @notice Batch counter
    uint256 public batchCounter;
    
    /// @notice Deposit counter
    uint256 public depositCounter;
    
    /// @notice Withdrawal counter  
    uint256 public withdrawalCounter;
    
    /// @notice Emergency withdrawal enabled after this timestamp if sequencer is down
    uint256 public constant EMERGENCY_DELAY = 24 hours;
    
    /// @notice Last batch timestamp
    uint256 public lastBatchTimestamp;
    
    /// @notice Minimum batch interval (prevents DOS)
    uint256 public constant MIN_BATCH_INTERVAL = 10 seconds;
    
    /// @notice Maximum pending deposits before sequencer must process
    uint256 public constant MAX_PENDING_DEPOSITS = 1000;
    
    // ===== Structs =====
    
    struct Batch {
        bytes32 stateRoot;
        bytes32 calldataHash;
        uint256 txCount;
        uint256 timestamp;
        bool verified;
    }
    
    struct Deposit {
        address depositor;
        uint256 amount;
        bytes32 l2Address; // Commitment to L2 address
        uint256 timestamp;
        bool processed;
    }
    
    struct Withdrawal {
        address recipient;
        uint256 amount;
        bytes32 stateRoot;
        uint256 timestamp;
        bool finalized;
    }
    
    // ===== Mappings =====
    
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => Deposit) public deposits;
    mapping(uint256 => Withdrawal) public withdrawals;
    mapping(bytes32 => bool) public processedWithdrawals;
    
    // ===== Events =====
    
    event BatchSubmitted(
        uint256 indexed batchId,
        bytes32 indexed oldRoot,
        bytes32 indexed newRoot,
        uint256 txCount
    );
    
    event DepositQueued(
        uint256 indexed depositId,
        address indexed depositor,
        uint256 amount,
        bytes32 l2Address
    );
    
    event WithdrawalRequested(
        uint256 indexed withdrawalId,
        address indexed recipient,
        uint256 amount
    );
    
    event WithdrawalFinalized(
        uint256 indexed withdrawalId,
        address indexed recipient,
        uint256 amount
    );
    
    event SequencerUpdated(address indexed oldSequencer, address indexed newSequencer);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    
    // ===== Modifiers =====
    
    modifier onlySequencer() {
        require(msg.sender == sequencer, "ZkIntentsRollup: caller is not sequencer");
        _;
    }
    
    // ===== Initialization =====
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @notice Initialize the contract
     * @param _stateRoot Initial state root (genesis)
     * @param _verifier Verifier contract address
     * @param _sequencer Sequencer address
     */
    function initialize(
        bytes32 _stateRoot,
        address _verifier,
        address _sequencer
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        
        stateRoot = _stateRoot;
        verifier = _verifier;
        sequencer = _sequencer;
        lastBatchTimestamp = block.timestamp;
    }
    
    // ===== Core Rollup Functions =====
    
    /**
     * @notice Submit a new batch with zk proof
     * @param _newStateRoot New state root after batch
     * @param _calldataHash Hash of batch transaction data
     * @param _txCount Number of transactions in batch
     * @param _proof ZK proof of correct state transition
     */
    function submitBatch(
        bytes32 _newStateRoot,
        bytes32 _calldataHash,
        uint256 _txCount,
        bytes calldata _proof
    ) external onlySequencer {
        require(
            block.timestamp >= lastBatchTimestamp + MIN_BATCH_INTERVAL,
            "ZkIntentsRollup: batch interval too short"
        );
        
        bytes32 oldRoot = stateRoot;
        
        // Verify proof
        require(
            _verifyProof(oldRoot, _newStateRoot, _calldataHash, _txCount, _proof),
            "ZkIntentsRollup: invalid proof"
        );
        
        // Update state
        stateRoot = _newStateRoot;
        batchCounter++;
        lastBatchTimestamp = block.timestamp;
        
        batches[batchCounter] = Batch({
            stateRoot: _newStateRoot,
            calldataHash: _calldataHash,
            txCount: _txCount,
            timestamp: block.timestamp,
            verified: true
        });
        
        emit BatchSubmitted(batchCounter, oldRoot, _newStateRoot, _txCount);
    }
    
    /**
     * @notice Verify a zk proof (delegates to verifier contract)
     */
    function _verifyProof(
        bytes32 _oldRoot,
        bytes32 _newRoot,
        bytes32 _calldataHash,
        uint256 _txCount,
        bytes calldata _proof
    ) internal view returns (bool) {
        // Encode public inputs
        bytes memory publicInputs = abi.encodePacked(
            _oldRoot,
            _newRoot,
            _calldataHash,
            _txCount
        );
        
        // Call verifier (simplified - actual implementation depends on snark verifier)
        (bool success, bytes memory result) = verifier.staticcall(
            abi.encodeWithSignature("verifyProof(bytes,bytes)", _proof, publicInputs)
        );
        
        return success && abi.decode(result, (bool));
    }
    
    // ===== Deposit Functions =====
    
    /**
     * @notice Deposit funds to L2
     * @param _l2Address Commitment to L2 receiving address
     */
    function deposit(bytes32 _l2Address) external payable {
        require(msg.value > 0, "ZkIntentsRollup: deposit amount must be greater than 0");
        require(
            depositCounter < MAX_PENDING_DEPOSITS,
            "ZkIntentsRollup: too many pending deposits"
        );
        
        depositCounter++;
        deposits[depositCounter] = Deposit({
            depositor: msg.sender,
            amount: msg.value,
            l2Address: _l2Address,
            timestamp: block.timestamp,
            processed: false
        });
        
        emit DepositQueued(depositCounter, msg.sender, msg.value, _l2Address);
    }
    
    /**
     * @notice Mark deposits as processed (called by sequencer after inclusion in batch)
     * @param _depositIds Array of deposit IDs to mark as processed
     */
    function markDepositsProcessed(uint256[] calldata _depositIds) external onlySequencer {
        for (uint256 i = 0; i < _depositIds.length; i++) {
            require(
                deposits[_depositIds[i]].depositor != address(0),
                "ZkIntentsRollup: deposit does not exist"
            );
            deposits[_depositIds[i]].processed = true;
        }
    }
    
    // ===== Withdrawal Functions =====
    
    /**
     * @notice Request withdrawal from L2
     * @param _amount Amount to withdraw
     * @param _merkleProof Merkle proof of account state
     */
    function requestWithdrawal(
        uint256 _amount,
        bytes32[] calldata _merkleProof
    ) external {
        // Verify Merkle proof against current state root
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _amount));
        require(
            _verifyMerkleProof(leaf, _merkleProof, stateRoot),
            "ZkIntentsRollup: invalid Merkle proof"
        );
        
        bytes32 withdrawalHash = keccak256(abi.encodePacked(msg.sender, _amount, stateRoot));
        require(
            !processedWithdrawals[withdrawalHash],
            "ZkIntentsRollup: withdrawal already processed"
        );
        
        withdrawalCounter++;
        withdrawals[withdrawalCounter] = Withdrawal({
            recipient: msg.sender,
            amount: _amount,
            stateRoot: stateRoot,
            timestamp: block.timestamp,
            finalized: false
        });
        
        processedWithdrawals[withdrawalHash] = true;
        
        emit WithdrawalRequested(withdrawalCounter, msg.sender, _amount);
    }
    
    /**
     * @notice Finalize withdrawal and transfer funds
     * @param _withdrawalId Withdrawal ID
     */
    function finalizeWithdrawal(uint256 _withdrawalId) external nonReentrant {
        Withdrawal storage withdrawal = withdrawals[_withdrawalId];
        
        require(withdrawal.recipient != address(0), "ZkIntentsRollup: withdrawal does not exist");
        require(!withdrawal.finalized, "ZkIntentsRollup: withdrawal already finalized");
        require(
            withdrawal.recipient == msg.sender,
            "ZkIntentsRollup: only recipient can finalize"
        );
        
        withdrawal.finalized = true;
        
        // Transfer funds
        (bool success, ) = withdrawal.recipient.call{value: withdrawal.amount}("");
        require(success, "ZkIntentsRollup: transfer failed");
        
        emit WithdrawalFinalized(_withdrawalId, withdrawal.recipient, withdrawal.amount);
    }
    
    /**
     * @notice Verify Merkle proof
     */
    function _verifyMerkleProof(
        bytes32 _leaf,
        bytes32[] calldata _proof,
        bytes32 _root
    ) internal pure returns (bool) {
        bytes32 computedHash = _leaf;
        
        for (uint256 i = 0; i < _proof.length; i++) {
            bytes32 proofElement = _proof[i];
            
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        
        return computedHash == _root;
    }
    
    // ===== Admin Functions =====
    
    function setSequencer(address _newSequencer) external onlyOwner {
        address oldSequencer = sequencer;
        sequencer = _newSequencer;
        emit SequencerUpdated(oldSequencer, _newSequencer);
    }
    
    function setVerifier(address _newVerifier) external onlyOwner {
        address oldVerifier = verifier;
        verifier = _newVerifier;
        emit VerifierUpdated(oldVerifier, _newVerifier);
    }
    
    // ===== Upgrade Function =====
    
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    // ===== View Functions =====
    
    function getBatch(uint256 _batchId) external view returns (Batch memory) {
        return batches[_batchId];
    }
    
    function getDeposit(uint256 _depositId) external view returns (Deposit memory) {
        return deposits[_depositId];
    }
    
    function getWithdrawal(uint256 _withdrawalId) external view returns (Withdrawal memory) {
        return withdrawals[_withdrawalId];
    }
}
