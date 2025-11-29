'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, ArrowRight, Zap, Terminal, Globe, LogOut } from 'lucide-react';
import { api } from '../lib/api';
import IntentForm from './IntentForm';
import IntentExplainer from './IntentExplainer';

export default function InteractiveDemo() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [session, setSession] = useState<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [isLogin, setIsLogin] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [lastIntent, setLastIntent] = useState<any>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Load saved session on mount
  useEffect(() => {
    const savedSession = api.loadSession();
    if (savedSession) {
      setSession(savedSession);
      setEmail(savedSession.email);
      setStep(1);
      addLog(`Restored session for ${savedSession.email}`);
      addLog(`Address: ${savedSession.address}`);
    }

    // Listen for session updates (logout, etc.)
    const handleSessionUpdate = () => {
      const updatedSession = api.loadSession();
      if (!updatedSession) {
        // Session was cleared
        setSession(null);
        setEmail('');
        setStep(0);
      }
    };

    window.addEventListener('session-update', handleSessionUpdate);
    return () => window.removeEventListener('session-update', handleSessionUpdate);
  }, []);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    api.connectWebSocket((data) => {
      if (data.type === 'subscribed') {
        addLog(`Network subscription active. State root: ${data.stateRoot.slice(0, 10)}...`);
      } else if (data.type === 'new_intent') {
        addLog(`Intent received: ${data.intentId.slice(0, 10)}...`);
      } else if (data.type === 'batch_created') {
        addLog(`📦 Batch #${data.batchId} created (${data.txCount} txs)`);
      } else if (data.type === 'batch_verified') {
        addLog(`✅ Batch #${data.batchId} verified on L1!`);
        addLog(`TX: ${data.txHash?.slice(0, 10)}...`);
      }
    });

    return () => {
      api.disconnectWebSocket();
    };
  }, []);

  // Step 1: Send OTP to email
  const handleAuth = async () => {
    if (!email) return;
    
    setLoading(true);
    addLog(isLogin ? 'Sending login code...' : 'Sending verification code...');
    
    try {
      const health = await api.checkHealth();
      if (!health.ok) {
        throw new Error('Sequencer offline');
      }

      if (isLogin) {
        await api.sendLoginOTP(email);
        addLog('Login code sent to your email');
      } else {
        await api.registerWithEmail(email);
        addLog('Verification code sent to your email');
      }
      
      setOtpSent(true);
      addLog('Please check your inbox');
    } catch (e: any) {
      addLog(`ERROR: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and create account or login
  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      addLog('Please enter a valid 6-digit code');
      return;
    }
    
    setLoading(true);
    addLog('Verifying code...');
    
    try {
      let sessionData;
      if (isLogin) {
        sessionData = await api.loginWithOTP(email, otp);
        addLog('Login successful!');
      } else {
        sessionData = await api.verifyOTPAndCreateAccount(email, otp);
        addLog('Account created successfully!');
        setShowPasskeyPrompt(true); // Show passkey enrollment option
      }
      
      setSession(sessionData);
      setStep(isLogin ? 1 : 0.5); // Go to passkey prompt for new users, intent form for existing
      addLog(`Address: ${sessionData.address}`);
      setOtpSent(false);
      setOtp('');
    } catch (e: any) {
      addLog(`Verification failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3 (Optional): Enroll passkey for faster login
  const handleEnrollPasskey = async () => {
    setLoading(true);
    addLog('Setting up passkey for instant login...');
    
    try {
      await api.enrollPasskey(email);
      addLog('Passkey enrolled successfully!');
      addLog('Next time you can login instantly');
      setShowPasskeyPrompt(false);
      setStep(1);
    } catch (e: any) {
      addLog(`Passkey enrollment failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPasskey = () => {
    addLog('Passkey enrollment skipped');
    setShowPasskeyPrompt(false);
    setStep(1);
  };

  // Alternative: Login with passkey (instant)
  const handlePasskeyLogin = async () => {
    if (!email) return;
    
    setLoading(true);
    addLog('Authenticating with passkey...');
    
    try {
      const sessionData = await api.loginWithPasskey(email);
      setSession(sessionData);
      setStep(1);
      addLog('Login successful!');
      addLog(`Address: ${sessionData.address}`);
    } catch (e: any) {
      addLog(`Passkey login failed: ${e.message}`);
      addLog('Try logging in with email code instead');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitIntent = async (intentData: any) => {
    if (!session) return;
    
    setLoading(true);
    setLastIntent(intentData);
    addLog(`Creating ${intentData.action} intent...`);
    addLog(`Token: ${intentData.token} (${intentData.chainId})`);
    addLog(`Amount: ${intentData.amount}`);
    addLog(`Recipient: ${intentData.recipient}`);
    
    try {
      // Handle deposit action
      if (intentData.action === 'deposit') {
        addLog('Processing L1 → L2 deposit...');
        const result = await api.deposit({
          userAddress: session.address,
          tokenAddress: intentData.tokenAddress,
          amount: intentData.amount,
          chainId: intentData.chainId,
        });
        
        if (result.success) {
          addLog(`✓ Deposit successful!`);
          addLog(`TX Hash: ${result.txHash?.slice(0, 20)}...`);
          addLog(`L2 Balance: ${result.l2Balance}`);
          setLoading(false);
          setStep(2);
          return;
        } else {
          throw new Error(result.error || 'Deposit failed');
        }
      }

      // Handle withdrawal action
      if (intentData.action === 'withdraw') {
        addLog('Initiating L2 → L1 withdrawal...');
        const result = await api.initiateWithdrawal({
          userAddress: session.address,
          tokenAddress: intentData.tokenAddress,
          amount: intentData.amount,
          recipient: intentData.recipient,
        });
        
        if (result.success) {
          addLog(`✓ Withdrawal initiated!`);
          addLog(`Withdrawal ID: ${result.withdrawalId?.slice(0, 20)}...`);
          addLog('You can claim after batch verification');
          setLoading(false);
          setStep(2);
          return;
        } else {
          throw new Error(result.error || 'Withdrawal failed');
        }
      }

      // Handle regular intents (transfer, swap)
      addLog('Note: Intent submission requires EdDSA signature implementation');
      addLog('Demo: Simulating intent acceptance...');
      
      // Simulate intent ID for demo purposes
      const randomBytes = crypto.getRandomValues(new Uint8Array(16));
      let mockIntentId = '0x';
      for (let i = 0; i < randomBytes.length; i++) {
        mockIntentId += randomBytes[i].toString(16).padStart(2, '0');
      }
      
      addLog(`Intent ID: ${mockIntentId.slice(0, 20)}...`);
      addLog(`Chain: ${intentData.chainId}`);
      addLog('⚠️ Production: Implement EdDSA signing with noble-curves/ed25519');
      setLoading(false);
      setStep(2);
    } catch (e: any) {
      addLog(`Submission failed: ${e.message}`);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    console.log('Logout clicked!');
    try {
      await api.clearSession();
      setSession(null);
      setEmail('');
      setOtp('');
      setStep(0);
      setOtpSent(false);
      setShowPasskeyPrompt(false);
      setLastIntent(null);
      setLogs(['Session cleared. You have been logged out.']);
      console.log('Logout complete');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div id="demo" className="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Left: Interactive UI */}
      <div className="bg-sui-deep border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
        {/* Header */}
        <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-sui-sea animate-pulse"></div>
            <span className="text-xs font-mono text-sui-steel">LIVE DEMO</span>
          </div>
          {session && (
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Button clicked');
                handleLogout();
              }}
              type="button"
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer z-50"
            >
              <LogOut size={14} /> Logout
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-8 flex-1 flex flex-col relative overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 0 && !otpSent && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Globe className="text-sui-sea" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold">Welcome to zk-Intents</h3>
                  <div className="flex justify-center gap-4 mt-4 text-sm">
                    <button 
                      onClick={() => { setIsLogin(false); setOtpSent(false); }}
                      className={`pb-2 border-b-2 transition-colors ${!isLogin ? 'border-sui-sea text-white' : 'border-transparent text-sui-steel'}`}
                    >
                      Create Account
                    </button>
                    <button 
                      onClick={() => { setIsLogin(true); setOtpSent(false); }}
                      className={`pb-2 border-b-2 transition-colors ${isLogin ? 'border-sui-sea text-white' : 'border-transparent text-sui-steel'}`}
                    >
                      Log In
                    </button>
                  </div>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                  placeholder="name@example.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:border-sui-sea focus:outline-none transition-colors text-lg"
                />
                <button
                  onClick={handleAuth}
                  disabled={!email || loading}
                  className="w-full bg-sui-sea text-white rounded-xl py-4 font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-lg"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <>{isLogin ? 'Send Login Code' : 'Send Verification Code'} <ArrowRight size={20} /></>}
                </button>
                {isLogin && (
                  <button
                    onClick={handlePasskeyLogin}
                    disabled={!email || loading}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    Or use Passkey (instant)
                  </button>
                )}
              </motion.div>
            )}

            {step === 0 && otpSent && (
              <motion.div
                key="step0-otp"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Globe className="text-sui-sea" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold">Enter Verification Code</h3>
                  <p className="text-sui-steel text-sm mt-2">
                    We sent a 6-digit code to <span className="text-white">{email}</span>
                  </p>
                </div>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white focus:border-sui-sea focus:outline-none transition-colors text-2xl text-center tracking-widest font-mono"
                />
                <button
                  onClick={handleVerifyOTP}
                  disabled={otp.length !== 6 || loading}
                  className="w-full bg-sui-sea text-white rounded-xl py-4 font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-lg"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <>Verify <Check size={20} /></>}
                </button>
                <button
                  onClick={() => { setOtpSent(false); setOtp(''); }}
                  className="w-full text-sui-steel hover:text-white transition-colors text-sm"
                >
                  Change email address
                </button>
              </motion.div>
            )}

            {step === 0.5 && showPasskeyPrompt && session && (
              <motion.div
                key="step0.5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 text-center"
              >
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500 border border-green-500/20">
                  <Check size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Account Created!</h3>
                  <p className="text-sui-steel text-sm">
                    Want to setup a passkey for instant login next time?
                  </p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <p className="text-xs text-sui-steel mb-2">Your Address</p>
                  <p className="font-mono text-sm break-all">{session.address}</p>
                </div>
                <button
                  onClick={handleEnrollPasskey}
                  disabled={loading}
                  className="w-full bg-sui-sea text-white rounded-xl py-4 font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Setup Passkey'}
                </button>
                <button
                  onClick={handleSkipPasskey}
                  className="w-full text-sui-steel hover:text-white transition-colors text-sm"
                >
                  Skip for now
                </button>
              </motion.div>
            )}

            {step === 1 && session && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Create Your Intent</h3>
                  <p className="text-sm text-sui-steel">Logged in as {session.email}</p>
                  <div className="bg-white/5 p-3 rounded-xl font-mono text-xs text-sui-steel break-all border border-white/5 mt-3">
                    {session.address.slice(0, 20)}...{session.address.slice(-10)}
                  </div>
                </div>

                {/* Example Intents */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs font-medium text-sui-steel mb-3">QUICK EXAMPLES</p>
                  <div className="space-y-2 text-xs">
                    <div className="bg-sui-deep p-2 rounded text-left">
                      <span className="text-sui-sea">Transfer:</span> Send 1 MATIC to 0x1234...
                    </div>
                    <div className="bg-sui-deep p-2 rounded text-left">
                      <span className="text-sui-sea">Swap:</span> Swap 100 USDC for ETH
                    </div>
                    <div className="bg-sui-deep p-2 rounded text-left">
                      <span className="text-sui-sea">Deposit:</span> Deposit 10 MATIC to L2
                    </div>
                    <div className="bg-sui-deep p-2 rounded text-left">
                      <span className="text-sui-sea">Withdraw:</span> Withdraw 5 MATIC to L1
                    </div>
                  </div>
                </div>

                <IntentForm 
                  session={session} 
                  onSubmit={handleSubmitIntent}
                  loading={loading}
                />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 text-center"
              >
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 bg-sui-sea/20 rounded-full animate-ping"></div>
                  <div className="relative w-full h-full bg-sui-sea rounded-full flex items-center justify-center text-white shadow-lg shadow-sui-sea/50">
                    <Zap size={40} />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-2">Intent Submitted ✓</h3>
                  <p className="text-sui-steel">Your transaction is being proved.</p>
                </div>

                {/* Show what was submitted */}
                {lastIntent && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                    <p className="text-xs font-medium text-sui-steel mb-3">YOUR INTENT</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-sui-steel">Action:</span>
                        <span className="font-semibold capitalize">{lastIntent.action}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-sui-steel">Amount:</span>
                        <span className="font-semibold">{lastIntent.amount} {lastIntent.token}</span>
                      </div>
                      {lastIntent.action === 'transfer' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-sui-steel">To:</span>
                          <span className="font-mono text-xs">{lastIntent.recipient.slice(0, 10)}...</span>
                        </div>
                      )}
                      {lastIntent.action === 'swap' && lastIntent.data?.toToken && (
                        <div className="flex justify-between text-sm">
                          <span className="text-sui-steel">For:</span>
                          <span className="font-semibold">{lastIntent.data.toToken}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-sui-steel">Chain:</span>
                        <span className="font-semibold">
                          {lastIntent.chainId === 137 ? 'Polygon' : lastIntent.chainId === 1 ? 'Ethereum' : `Chain ${lastIntent.chainId}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep(1)}
                  className="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 font-medium hover:bg-white/10 transition-all"
                >
                  Submit Another Intent
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Network Logs */}
      <div className="bg-[#0D1117] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
        <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-sui-steel" />
            <span className="text-xs font-mono text-sui-steel">NETWORK LOGS</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
          </div>
        </div>
        <div className="p-6 font-mono text-xs text-sui-steel space-y-2 overflow-y-auto flex-1">
          <div className="text-sui-sea">Initializing connection...</div>
          {logs.map((log, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="border-l-2 border-white/10 pl-3 py-1"
            >
              {log}
            </motion.div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
      
      {/* Explainer Section */}
      <div className="col-span-1 lg:col-span-2">
        <IntentExplainer />
      </div>
    </div>
  );
}
