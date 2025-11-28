'use client';

import Navbar from '../../components/Navbar';
import { Terminal, Book, Github, Code, Copy, Check, Box, Cpu } from 'lucide-react';
import { useState } from 'react';

export default function Developers() {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText('npm install @zk-intents/sdk');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-sui-deep text-white font-sans selection:bg-sui-sea selection:text-white">
      <Navbar />
      
      <div className="container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto mb-16">
          <h1 className="text-5xl font-bold mb-8">Developer Resources</h1>
          <p className="text-xl text-sui-steel leading-relaxed">
            Build the next generation of intent-centric dApps. 
            Our SDK provides a type-safe interface for session management and intent submission.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
          {/* SDK Integration */}
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Box className="text-sui-sea" /> SDK Integration
            </h2>
            <div className="bg-sui-ocean border border-white/10 rounded-3xl p-8 font-mono text-sm overflow-x-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <span className="text-sui-steel">terminal</span>
                <button onClick={copyCode} className="text-sui-steel hover:text-white transition-colors">
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <div className="text-sui-sea mb-4">npm install @zk-intents/sdk</div>
              
              <div className="text-sui-steel">// Initialize Client</div>
              <div>
                <span className="text-purple-400">const</span> client = <span className="text-purple-400">new</span> <span className="text-yellow-300">ZkIntentsClient</span>(<span className="text-green-400">'https://api.zkintents.io'</span>);
              </div>
              <br />
              <div className="text-sui-steel">// Create Session (Walletless)</div>
              <div>
                <span className="text-purple-400">const</span> session = <span className="text-purple-400">await</span> client.<span className="text-blue-400">createSession</span>();
              </div>
              <br />
              <div className="text-sui-steel">// Submit Intent</div>
              <div>
                <span className="text-purple-400">await</span> client.<span className="text-blue-400">submitIntent</span>({`{`}
                <br />
                &nbsp;&nbsp;to: <span className="text-green-400">'0x123...'</span>,
                <br />
                &nbsp;&nbsp;amount: <span className="text-orange-400">1000n</span>,
                <br />
                &nbsp;&nbsp;token: <span className="text-green-400">'USDC'</span>
                <br />
                {`}`});
              </div>
            </div>
          </div>

          {/* Circuit Logic */}
          <div>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Cpu className="text-purple-400" /> Circuit Logic
            </h2>
            <div className="bg-sui-ocean border border-white/10 rounded-3xl p-8 font-mono text-sm overflow-x-auto">
              <div className="text-sui-steel mb-4">// Circom Template: Transfer</div>
              <div>
                <span className="text-purple-400">template</span> <span className="text-yellow-300">Transfer</span>() {`{`}
              </div>
              <div className="pl-4">
                <span className="text-sui-steel">// Public Inputs</span>
                <br />
                <span className="text-purple-400">signal input</span> root;
                <br />
                <span className="text-purple-400">signal input</span> nullifier;
                <br /><br />
                <span className="text-sui-steel">// Private Inputs</span>
                <br />
                <span className="text-purple-400">signal input</span> secret;
                <br />
                <span className="text-purple-400">signal input</span> pathElements[20];
                <br /><br />
                <span className="text-sui-steel">// Constraints</span>
                <br />
                component hasher = <span className="text-yellow-300">Poseidon</span>(2);
                <br />
                hasher.inputs[0] <span className="text-purple-400">&lt;==</span> secret;
                <br />
                hasher.inputs[1] <span className="text-purple-400">&lt;==</span> 1;
                <br /><br />
                nullifier <span className="text-purple-400">===</span> hasher.out;
              </div>
              <div>{`}`}</div>
            </div>
            <p className="mt-6 text-sui-steel text-sm leading-relaxed">
              Our circuits enforce strict state transitions. The `Transfer` template above demonstrates 
              how we verify ownership without revealing the user's secret key, using a Poseidon hash 
              as a nullifier to prevent double-spending.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
