'use client';

import Navbar from '../../components/Navbar';
import Link from 'next/link';
import { Book, FileText, Code, Terminal } from 'lucide-react';

export default function Documentation() {
  return (
    <main className="min-h-screen bg-sui-deep text-white font-sans selection:bg-sui-sea selection:text-white">
      <Navbar />
      
      <div className="container mx-auto px-6 pt-32 pb-20">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar */}
          <div className="w-full lg:w-64 shrink-0">
            <div className="sticky top-32 space-y-8">
              <div>
                <h3 className="font-bold text-white mb-4">Getting Started</h3>
                <ul className="space-y-3 text-sm text-sui-steel">
                  <li className="text-sui-sea font-medium">Introduction</li>
                  <li className="hover:text-white cursor-pointer">
                    <Link href="/docs/quick-start">Quick Start</Link>
                  </li>
                  <li className="hover:text-white cursor-pointer">Architecture</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-white mb-4">Core Concepts</h3>
                <ul className="space-y-3 text-sm text-sui-steel">
                  <li className="hover:text-white cursor-pointer">
                    <Link href="/docs/concepts">Intents vs Txs</Link>
                  </li>
                  <li className="hover:text-white cursor-pointer">Session Keys</li>
                  <li className="hover:text-white cursor-pointer">ZK Circuits</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-white mb-4">API Reference</h3>
                <ul className="space-y-3 text-sm text-sui-steel">
                  <li className="hover:text-white cursor-pointer">Sequencer API</li>
                  <li className="hover:text-white cursor-pointer">SDK Methods</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 max-w-4xl">
            <h1 className="text-5xl font-bold mb-8">Introduction</h1>
            <p className="text-xl text-sui-steel mb-12 leading-relaxed">
              zk-Intents is a high-performance Layer 2 rollup that uses zero-knowledge proofs to enable 
              walletless, intent-centric interactions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <Book className="text-sui-sea mb-4" size={24} />
                <h3 className="text-lg font-bold mb-2">Learn the Basics</h3>
                <p className="text-sm text-sui-steel">Understand the fundamental concepts behind intent-centric architectures.</p>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <Terminal className="text-purple-400 mb-4" size={24} />
                <h3 className="text-lg font-bold mb-2">Developer Guide</h3>
                <p className="text-sm text-sui-steel">Start building dApps with our TypeScript SDK.</p>
              </div>
            </div>

            <div className="prose prose-invert prose-lg max-w-none">
              <h3>Why zk-Intents?</h3>
              <p>
                Blockchain UX is broken. Users shouldn't have to worry about gas fees, nonces, or private key management. 
                By abstracting these complexities into <strong>Intents</strong>, we create a user experience that rivals Web2.
              </p>
              
              <div className="bg-sui-ocean border border-white/10 rounded-2xl p-6 my-8">
                <h4 className="flex items-center gap-2 text-white font-bold mb-4">
                  <Code size={20} className="text-green-400" /> Installation
                </h4>
                <code className="block bg-sui-deep p-4 rounded-lg text-sm font-mono text-sui-steel">
                  npm install @zk-intents/sdk
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
