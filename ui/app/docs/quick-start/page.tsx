'use client';

import Navbar from '../../../components/Navbar';
import Link from 'next/link';
import { ArrowRight, Terminal, Copy } from 'lucide-react';
import { useState } from 'react';

export default function QuickStart() {
  const [copied, setCopied] = useState(false);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen bg-sui-deep text-white">
      <Navbar />
      
      <div className="container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto">
          <Link href="/docs" className="text-sui-sea hover:text-white flex items-center gap-2 mb-8">
            ← Back to Docs
          </Link>
          
          <h1 className="text-5xl font-bold mb-8">Quick Start</h1>
          <p className="text-xl text-sui-steel mb-12">
            Get started with zk-Intents in under 5 minutes.
          </p>

          <div className="space-y-12">
            <section>
              <h2 className="text-3xl font-bold mb-4">1. Installation</h2>
              <div className="bg-sui-ocean border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <code className="font-mono text-sm">npm install @zk-intents/sdk</code>
                  <button onClick={() => copyCode('npm install @zk-intents/sdk')} className="text-sui-steel hover:text-white">
                    {copied ? <Terminal size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">2. Initialize Client</h2>
              <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6 font-mono text-sm overflow-x-auto">
                <div className="text-purple-400">import</div> {`{ ZkIntentsClient }`} <div className="text-purple-400">from</div> <div className="text-green-400">'@zk-intents/sdk'</div>;
                <br /><br />
                <div className="text-purple-400">const</div> client = <div className="text-purple-400">new</div> ZkIntentsClient(<div className="text-green-400">'https://api.zkintents.io'</div>);
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">3. Create Session</h2>
              <p className="text-sui-steel mb-4">
                Create a session using WebAuthn (passkeys) for passwordless authentication:
              </p>
              <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6 font-mono text-sm overflow-x-auto">
                <div className="text-sui-steel">// User creates account with email</div>
                <br />
                <div className="text-purple-400">const</div> session = <div className="text-purple-400">await</div> client.createPasskeySession(<div className="text-green-400">'user@example.com'</div>);
                <br />
                console.log(session.address); <div className="text-sui-steel">// 0x71C...</div>
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-bold mb-4">4. Submit Intent</h2>
              <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-6 font-mono text-sm overflow-x-auto">
                <div className="text-purple-400">await</div> client.submitIntent({`{`}
                <br />
                &nbsp;&nbsp;from: session.address,
                <br />
                &nbsp;&nbsp;type: <div className="text-green-400">'transfer'</div>,
                <br />
                &nbsp;&nbsp;amount: <div className="text-orange-400">100</div>,
                <br />
                &nbsp;&nbsp;token: <div className="text-green-400">'USDC'</div>
                <br />
                {`}`});
              </div>
            </section>

            <div className="bg-sui-ocean/50 border border-sui-sea/20 rounded-2xl p-8 mt-12">
              <h3 className="text-xl font-bold mb-4">Success! You're Ready</h3>
              <p className="text-sui-steel mb-4">
                Your users can now interact with the blockchain without managing private keys or paying gas fees.
              </p>
              <Link href="/docs/concepts" className="text-sui-sea hover:text-white flex items-center gap-2">
                Learn Core Concepts <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
