// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ZkIntentsRollup
 * @notice Core rollup contract managing state roots, batch verification, and L1↔L2 bridge
 * @dev Uses UUPS proxy pattern for upgradeability
 */
contract ZkIntentsRollup is 
    Initializable, 
    UUPSUpgradeable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;
    
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
    
    /// @notice Challenge period for fraud proofs
    uint256 public constant CHALLENGE_PERIOD = 7 days;
    
    /// @notice Last batch timestamp
    uint256 public lastBatchTimestamp;
    
    /// @notice Fraud proof bond amount
    uint256 public constant FRAUD_PROOF_BOND = 1 ether;
    
    /// @notice Minimum batch interval (prevents DOS)
    uint256 public constant MIN_BATCH_INTERVAL = 10 seconds;
    
    /// @notice Maximum pending deposits before sequencer must process
    uint256 public constant MAX_PENDING_DEPOSITS = 1000;
    
    /// @notice Supported ERC20 tokens
    mapping(address => bool) public supportedTokens;
    
    /// @notice Token balances held in contract
    mapping(address => uint256) public tokenBalances;
    
    /// @notice Fraud proof counter
    uint256 public fraudProofCounter;
    
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
        address token; // address(0) for ETH
        uint256 amount;
        bytes32 l2Address; // Commitment to L2 address
        uint256 timestamp;
        bool processed;
    }
    
    struct Withdrawal {
        address recipient;
        address token; // address(0) for ETH
        uint256 amount;
        bytes32 stateRoot;
        uint256 timestamp;
        bool finalized;
    }
    
    struct FraudProof {
        uint256 batchId;
        address challenger;
        bytes proofData;
        uint256 timestamp;
        bool resolved;
    }
    
    // ===== Mappings =====
    
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => Deposit) public deposits;
    mapping(uint256 => Withdrawal) public withdrawals;
    mapping(bytes32 => bool) public processedWithdrawals;
    mapping(uint256 => FraudProof) public fraudProofs;
    
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
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event FraudProofSubmitted(uint256 indexed fraudProofId, uint256 indexed batchId, address indexed challenger);
    event FraudProofResolved(uint256 indexed fraudProofId, bool valid);
    event EmergencyWithdrawal(address indexed user, address indexed token, uint256 amount);
    
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
        __ReentrancyGuard_init();
        __Pausable_init();
        
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
    ) external onlySequencer whenNotPaused {
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
     * @notice Deposit ETH to L2
     * @param _l2Address Commitment to L2 receiving address
     */
    function deposit(bytes32 _l2Address) external payable whenNotPaused {
        require(msg.value > 0, "Amount must be > 0");
        require(depositCounter < MAX_PENDING_DEPOSITS, "Too many pending deposits");
        
        depositCounter++;
        deposits[depositCounter] = Deposit({
            depositor: msg.sender,
            token: address(0),
            amount: msg.value,
            l2Address: _l2Address,
            timestamp: block.timestamp,
            processed: false
        });
        
        tokenBalances[address(0)] += msg.value;
        emit DepositQueued(depositCounter, msg.sender, msg.value, _l2Address);
    }
    
    /**
     * @notice Deposit ERC20 tokens to L2
     * @param _token Token address
     * @param _amount Amount to deposit
     * @param _l2Address Commitment to L2 receiving address
     */
    function depositToken(
        address _token,
        uint256 _amount,
        bytes32 _l2Address
    ) external whenNotPaused {
        require(supportedTokens[_token], "Token not supported");
        require(_amount > 0, "Amount must be > 0");
        
        depositCounter++;
        deposits[depositCounter] = Deposit({
            depositor: msg.sender,
            token: _token,
            amount: _amount,
            l2Address: _l2Address,
            timestamp: block.timestamp,
            processed: false
        });
        
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        tokenBalances[_token] += _amount;
        emit DepositQueued(depositCounter, msg.sender, _amount, _l2Address);
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
     * @param _token Token address (address(0) for ETH)
     * @param _amount Amount to withdraw
     * @param _merkleProof Merkle proof of account state
     */
    function requestWithdrawal(
        address _token,
        uint256 _amount,
        bytes32[] calldata _merkleProof
    ) external whenNotPaused {
        // Verify Merkle proof against current state root
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _token, _amount));
        require(_verifyMerkleProof(leaf, _merkleProof, stateRoot), "Invalid proof");
        
        bytes32 withdrawalHash = keccak256(abi.encodePacked(msg.sender, _token, _amount, stateRoot));
        require(!processedWithdrawals[withdrawalHash], "Already processed");
        
        withdrawalCounter++;
        withdrawals[withdrawalCounter] = Withdrawal({
            recipient: msg.sender,
            token: _token,
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
        tokenBalances[withdrawal.token] -= withdrawal.amount;
        
        // Transfer funds
        if (withdrawal.token == address(0)) {
            (bool success, ) = withdrawal.recipient.call{value: withdrawal.amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(withdrawal.token).safeTransfer(withdrawal.recipient, withdrawal.amount);
        }
        
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
    
    // ===== Fraud Proof Functions =====
    
    /**
     * @notice Submit fraud proof challenging a batch
     * @param _batchId Batch to challenge
     * @param _proofData Fraud proof data
     */
    function submitFraudProof(
        uint256 _batchId,
        bytes calldata _proofData
    ) external payable {
        require(msg.value == FRAUD_PROOF_BOND, "Invalid bond");
        require(batches[_batchId].timestamp > 0, "Batch does not exist");
        require(
            block.timestamp < batches[_batchId].timestamp + CHALLENGE_PERIOD,
            "Challenge period expired"
        );
        
        fraudProofCounter++;
        fraudProofs[fraudProofCounter] = FraudProof({
            batchId: _batchId,
            challenger: msg.sender,
            proofData: _proofData,
            timestamp: block.timestamp,
            resolved: false
        });
        
        emit FraudProofSubmitted(fraudProofCounter, _batchId, msg.sender);
    }
    
    /**
     * @notice Emergency withdrawal if sequencer is inactive
     * @param _token Token address
     * @param _amount Amount to withdraw
     * @param _merkleProof Merkle proof
     */
    function emergencyWithdraw(
        address _token,
        uint256 _amount,
        bytes32[] calldata _merkleProof
    ) external nonReentrant {
        require(
            block.timestamp > lastBatchTimestamp + EMERGENCY_DELAY,
            "Sequencer still active"
        );
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, _token, _amount));
        require(_verifyMerkleProof(leaf, _merkleProof, stateRoot), "Invalid proof");
        
        tokenBalances[_token] -= _amount;
        
        if (_token == address(0)) {
            (bool success, ) = msg.sender.call{value: _amount}("");
            require(success, "Transfer failed");
        } else {
            IERC20(_token).safeTransfer(msg.sender, _amount);
        }
        
        emit EmergencyWithdrawal(msg.sender, _token, _amount);
    }
    
    // ===== Admin Functions =====
    
    function addSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = true;
        emit TokenAdded(_token);
    }
    
    function removeSupportedToken(address _token) external onlyOwner {
        supportedTokens[_token] = false;
        emit TokenRemoved(_token);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
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
