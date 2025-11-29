import { ethers } from 'ethers';
import { StateTree } from './state';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DepositParams {
  userAddress: string;
  tokenAddress: string;
  amount: string;
  chainId: number;
}

export interface WithdrawalParams {
  userAddress: string;
  tokenAddress: string;
  amount: string;
  recipient: string;
  merkleProof: string[];
}

export interface DepositResult {
  success: boolean;
  txHash?: string;
  l2Balance?: string;
  error?: string;
}

export interface WithdrawalResult {
  success: boolean;
  txHash?: string;
  withdrawalId?: string;
  error?: string;
}

export class DepositWithdrawalService {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contractAddress: string;

  constructor(
    private stateTree: StateTree,
    rpcUrl: string,
    privateKey: string,
    contractAddress: string
  ) {
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contractAddress = contractAddress;
    
    logger.info({ contractAddress }, 'Deposit/Withdrawal service initialized');
  }

  /**
   * Process deposit from L1 to L2
   */
  async processDeposit(params: DepositParams): Promise<DepositResult> {
    try {
      logger.info({ params }, 'Processing deposit');

      // Contract ABI for deposit
      const abi = [
        'function deposit(address token, uint256 amount) external payable',
        'event Deposited(address indexed user, address indexed token, uint256 amount, uint256 indexed l2AccountId)'
      ];

      const contract = new ethers.Contract(
        this.contractAddress,
        abi,
        this.wallet
      );

      const amount = ethers.utils.parseUnits(params.amount, 18);

      // Handle native token (ETH/MATIC) vs ERC20
      let tx;
      if (params.tokenAddress === ethers.constants.AddressZero) {
        // Native token deposit
        tx = await contract.deposit(ethers.constants.AddressZero, amount, {
          value: amount
        });
      } else {
        // ERC20 deposit - requires prior approval
        await this.approveToken(params.tokenAddress, this.contractAddress, BigInt(amount.toString()));
        tx = await contract.deposit(params.tokenAddress, amount);
      }

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error('Deposit transaction failed');
      }

      // Update L2 state
      const l2Balance = await this.creditL2Account(
        params.userAddress,
        params.tokenAddress,
        params.amount
      );

      logger.info({ 
        txHash: receipt.hash,
        userAddress: params.userAddress,
        l2Balance
      }, 'Deposit successful');

      return {
        success: true,
        txHash: receipt.hash,
        l2Balance,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, params }, 'Deposit failed');
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Initiate withdrawal from L2 to L1
   */
  async initiateWithdrawal(params: WithdrawalParams): Promise<WithdrawalResult> {
    try {
      logger.info({ params }, 'Initiating withdrawal');

      // Debit L2 account
      const debitSuccess = await this.debitL2Account(
        params.userAddress,
        params.tokenAddress,
        params.amount
      );

      if (!debitSuccess) {
        throw new Error('Insufficient L2 balance');
      }

      // Create withdrawal intent
      const withdrawalId = this.generateWithdrawalId(
        params.userAddress,
        params.tokenAddress,
        params.amount
      );

      // In the next batch, this withdrawal will be proven and submitted to L1
      // The user can then claim after the withdrawal is finalized

      logger.info({ withdrawalId }, 'Withdrawal initiated');

      return {
        success: true,
        withdrawalId,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, params }, 'Withdrawal initiation failed');
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Complete withdrawal on L1 (after proof is verified)
   */
  async completeWithdrawal(params: WithdrawalParams): Promise<WithdrawalResult> {
    try {
      logger.info({ params }, 'Completing withdrawal on L1');

      const abi = [
        'function withdraw(address token, uint256 amount, address recipient, bytes32[] calldata merkleProof) external',
        'event Withdrawn(address indexed user, address indexed token, uint256 amount)'
      ];

      const contract = new ethers.Contract(
        this.contractAddress,
        abi,
        this.wallet
      );

      const amount = ethers.utils.parseUnits(params.amount, 18);

      const tx = await contract.withdraw(
        params.tokenAddress,
        amount,
        params.recipient,
        params.merkleProof
      );

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error('Withdrawal transaction failed');
      }

      logger.info({ 
        txHash: receipt.hash,
        recipient: params.recipient,
        amount: params.amount
      }, 'Withdrawal completed');

      return {
        success: true,
        txHash: receipt.hash,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, params }, 'Withdrawal completion failed');
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Approve ERC20 token for deposit
   */
  private async approveToken(
    tokenAddress: string,
    spender: string,
    amount: bigint
  ): Promise<void> {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function approve(address spender, uint256 amount) returns (bool)',
        'function allowance(address owner, address spender) view returns (uint256)'
      ],
      this.wallet
    );

    const currentAllowance = await tokenContract.allowance(
      await this.wallet.getAddress(),
      spender
    );

    if (currentAllowance >= amount) {
      logger.info('Token already approved');
      return;
    }

    logger.info({ tokenAddress, spender, amount: amount.toString() }, 'Approving token');
    const tx = await tokenContract.approve(spender, ethers.constants.MaxUint256);
    await tx.wait();
    logger.info('Token approved');
  }

  /**
   * Credit L2 account after deposit
   */
  private async creditL2Account(
    userAddress: string,
    tokenAddress: string,
    amount: string
  ): Promise<string> {
    // Get current balance from state tree
    const accountState = await this.stateTree.getAccount(userAddress);
    
    const currentBalance = accountState?.balanceCommitment || '0';
    const newBalance = (
      BigInt(currentBalance) + BigInt(ethers.utils.parseUnits(amount, 18).toString())
    ).toString();

    // Update state tree
    await this.stateTree.updateAccount(userAddress, {
      address: userAddress,
      balanceCommitment: newBalance,
      nonce: accountState?.nonce || 0,
      publicKey: accountState?.publicKey || '',
    });

    return newBalance;
  }

  /**
   * Debit L2 account for withdrawal
   */
  private async debitL2Account(
    userAddress: string,
    tokenAddress: string,
    amount: string
  ): Promise<boolean> {
    const accountState = await this.stateTree.getAccount(userAddress);
    
    if (!accountState) {
      return false;
    }

    const currentBalance = BigInt(accountState.balanceCommitment);
    const withdrawAmount = BigInt(ethers.utils.parseUnits(amount, 18).toString());

    if (currentBalance < withdrawAmount) {
      return false;
    }

    const newBalance = (currentBalance - withdrawAmount).toString();

    await this.stateTree.updateAccount(userAddress, {
      address: userAddress,
      balanceCommitment: newBalance,
      nonce: accountState.nonce,
      publicKey: accountState.publicKey,
    });

    return true;
  }

  /**
   * Generate unique withdrawal ID
   */
  private generateWithdrawalId(
    userAddress: string,
    tokenAddress: string,
    amount: string
  ): string {
    const data = ethers.utils.solidityPack(
      ['address', 'address', 'uint256', 'uint256'],
      [userAddress, tokenAddress, ethers.utils.parseUnits(amount, 18), Date.now()]
    );
    return ethers.utils.keccak256(data);
  }

  /**
   * Get user's L2 balance
   */
  async getL2Balance(userAddress: string): Promise<string> {
    const accountState = await this.stateTree.getAccount(userAddress);
    return accountState?.balanceCommitment || '0';
  }

  /**
   * Check if withdrawal is ready to be claimed
   */
  async isWithdrawalReady(withdrawalId: string): Promise<boolean> {
    try {
      const abi = [
        'function withdrawals(bytes32) view returns (bool processed, address user, address token, uint256 amount)'
      ];

      const contract = new ethers.Contract(
        this.contractAddress,
        abi,
        this.provider
      );

      const withdrawal = await contract.withdrawals(withdrawalId);
      return withdrawal.processed === false && withdrawal.amount > 0;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, 'Failed to check withdrawal status');
      return false;
    }
  }
}
