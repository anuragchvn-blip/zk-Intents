'use client';

import Navbar from '../../../components/Navbar';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Concepts() {
  return (
    <main className="min-h-screen bg-sui-deep text-white">
      <Navbar />
      
      <div className="container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto">
          <Link href="/docs" className="text-sui-sea hover:text-white flex items-center gap-2 mb-8">
            ← Back to Docs
          </Link>
          
          <h1 className="text-5xl font-bold mb-8">Core Concepts</h1>
          
          <div className="prose prose-invert prose-lg max-w-none space-y-16">
            <section>
              <h2>Intents vs Transactions</h2>
              <p>
                Traditional blockchains execute <strong>transactions</strong> - imperative commands that specify exactly HOW to achieve a goal. 
                zk-Intents uses <strong>intents</strong> - declarative statements that specify WHAT you want to achieve.
              </p>
              
              <div className="grid grid-cols-2 gap-6 my-8">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <h3 className="text-lg font-bold mb-4">Transaction (Old Way)</h3>
                  <ul className="text-sm text-sui-steel space-y-2 list-disc list-inside">
                    <li>"Approve token A"</li>
                    <li>"Call Router.swap()"</li>
                    <li>"Pay 0.1 ETH gas"</li>
                  </ul>
                </div>
                
                <div className="bg-sui-sea/10 p-6 rounded-2xl border border-sui-sea/20">
                  <h3 className="text-lg font-bold mb-4">Intent (New Way)</h3>
                  <ul className="text-sm text-white space-y-2 list-disc list-inside">
                    <li>"I want 100 USDC"</li>
                    <li>Solver handles routing</li>
                    <li>Gas abstracted</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2>Session Keys</h2>
              <p>
                Session keys are ephemeral keypairs that allow users to interact with the network without repeatedly signing with their main wallet. 
                They're created using WebAuthn (passkeys) and stored securely in your device's TPM/Secure Enclave.
              </p>
              
              <div className="bg-sui-ocean border border-white/10 rounded-2xl p-6 my-8">
                <h4 className="font-bold mb-4">Benefits:</h4>
                <ul className="space-y-2 text-sui-steel list-disc list-inside">
                  <li>No seed phrases to manage</li>
                  <li>One-click authentication</li>
                  <li>Syncs across devices via cloud</li>
                  <li>Hardware-backed security</li>
                </ul>
              </div>
            </section>

            <section>
              <h2>ZK Circuits</h2>
              <p>
                Every intent is verified by a Zero-Knowledge proof before being settled on L1. This ensures:
              </p>
              <ul>
                <li><strong>Privacy</strong>: Your intent details are hidden from MEV searchers</li>
                <li><strong>Validity</strong>: Math guarantees correctness (no optimistic delays)</li>
                <li><strong>Scalability</strong>: Thousands of intents = 1 proof on L1</li>
              </ul>
            </section>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-4">Next Steps</h3>
              <Link href="/docs/api" className="text-sui-sea hover:text-white flex items-center gap-2">
                Explore API Reference <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
