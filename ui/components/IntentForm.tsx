'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2, ChevronDown } from 'lucide-react';
import { SUPPORTED_TOKENS, type Token } from '../lib/tokens';
import { TokenIcon } from './icons/CryptoIcons';

interface IntentFormProps {
  session: any;
  onSubmit: (intent: any) => Promise<void>;
  loading: boolean;
}

export default function IntentForm({ session, onSubmit, loading }: IntentFormProps) {
  const [action, setAction] = useState('transfer');
  const [token, setToken] = useState<Token>(SUPPORTED_TOKENS[4]); // Default to MATIC
  const [toToken, setToToken] = useState<Token>(SUPPORTED_TOKENS[0]); // Default to ETH
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState('');
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [showToTokenSelector, setShowToTokenSelector] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    // For swap, deposit, withdraw - recipient is self or the protocol
    const finalRecipient = ['swap', 'deposit', 'withdraw'].includes(action) ? session.address : recipient;
    if (!finalRecipient) return;

    const intent = {
      senderAddress: session.address,
      action,
      token: token.symbol,
      tokenAddress: token.address,
      amount,
      recipient: finalRecipient,
      chainId: token.chainId,
      // Add action-specific details
      data: action === 'swap' ? { toToken: toToken.symbol } : undefined,
    };

    await onSubmit(intent);
    
    setAmount('');
    setRecipient('');
  };

  const isValid = amount && (['swap', 'deposit', 'withdraw'].includes(action) || recipient);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Action Selector */}
      <div>
        <label className="text-xs font-medium text-sui-steel mb-2 block">ACTION</label>
        <div className="grid grid-cols-4 gap-2 bg-white/5 p-1 rounded-xl">
          {['transfer', 'swap', 'deposit', 'withdraw'].map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAction(a)}
              className={`py-2 rounded-lg text-xs font-medium transition-all ${
                action === a ? 'bg-sui-sea text-white shadow-lg' : 'text-sui-steel hover:text-white'
              }`}
            >
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Token Selector (From) */}
      <div>
        <label className="text-xs font-medium text-sui-steel mb-2 block">
          {action === 'swap' ? 'FROM' : 'TOKEN'}
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTokenSelector(!showTokenSelector)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sui-sea focus:outline-none transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <TokenIcon symbol={token.symbol} className="w-8 h-8" />
              <div className="text-left">
                <div className="font-bold">{token.symbol}</div>
                <div className="text-xs text-sui-steel">{token.name}</div>
              </div>
            </div>
            <ChevronDown size={20} className={`transition-transform ${showTokenSelector ? 'rotate-180' : ''}`} />
          </button>

          {showTokenSelector && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-0 right-0 mt-2 bg-sui-ocean border border-white/10 rounded-xl max-h-64 overflow-y-auto z-50 shadow-2xl"
            >
              {SUPPORTED_TOKENS.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setToken(t);
                    setShowTokenSelector(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                >
                  <TokenIcon symbol={t.symbol} className="w-8 h-8" />
                  <div className="flex-1">
                    <div className="font-bold">{t.symbol}</div>
                    <div className="text-xs text-sui-steel">{t.name}</div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Swap Arrow */}
      {action === 'swap' && (
        <div className="flex justify-center -my-2 relative z-10">
          <div className="bg-sui-deep border border-white/10 p-2 rounded-full">
            <ChevronDown size={16} className="text-sui-steel" />
          </div>
        </div>
      )}

      {/* To Token (Swap Only) */}
      {action === 'swap' && (
        <div>
          <label className="text-xs font-medium text-sui-steel mb-2 block">TO</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowToTokenSelector(!showToTokenSelector)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sui-sea focus:outline-none transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <TokenIcon symbol={toToken.symbol} className="w-8 h-8" />
                <div className="text-left">
                  <div className="font-bold">{toToken.symbol}</div>
                  <div className="text-xs text-sui-steel">{toToken.name}</div>
                </div>
              </div>
              <ChevronDown size={20} className={`transition-transform ${showToTokenSelector ? 'rotate-180' : ''}`} />
            </button>

            {showToTokenSelector && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-full left-0 right-0 mt-2 bg-sui-ocean border border-white/10 rounded-xl max-h-64 overflow-y-auto z-50 shadow-2xl"
              >
                {SUPPORTED_TOKENS.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setToToken(t);
                      setShowToTokenSelector(false);
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
                  >
                    <TokenIcon symbol={t.symbol} className="w-8 h-8" />
                    <div className="flex-1">
                      <div className="font-bold">{t.symbol}</div>
                      <div className="text-xs text-sui-steel">{t.name}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Amount Input */}
      <div>
        <label className="text-xs font-medium text-sui-steel mb-2 block">AMOUNT</label>
        <input
          type="number"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-2xl font-bold focus:border-sui-sea focus:outline-none transition-colors"
        />
        <div className="mt-2 text-xs text-sui-steel">
          Available: 1000.00 {token.symbol}
        </div>
      </div>

      {/* Recipient Input (Transfer Only) */}
      {action === 'transfer' && (
        <div>
          <label className="text-xs font-medium text-sui-steel mb-2 block">TO ADDRESS</label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x... or email@example.com"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-sui-sea focus:outline-none transition-colors font-mono text-sm"
          />
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full bg-sui-sea text-white rounded-xl py-4 font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-lg"
      >
        {loading ? (
          <Loader2 className="animate-spin" size={24} />
        ) : (
          <>
            <Send size={20} />
            {action === 'swap' && 'Swap Tokens'}
            {action === 'transfer' && 'Send Transfer'}
            {action === 'deposit' && 'Deposit to L2'}
            {action === 'withdraw' && 'Withdraw to L1'}
          </>
        )}
      </button>
    </form>
  );
}
