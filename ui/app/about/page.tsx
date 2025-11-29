'use client';

import Navbar from '../../components/Navbar';
import { Globe, Target } from 'lucide-react';

export default function About() {
  return (
    <main className="min-h-screen bg-sui-deep text-white font-sans selection:bg-sui-sea selection:text-white">
      <Navbar />
      
      <div className="container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold mb-8">About zk-Intents</h1>
          <p className="text-xl text-sui-steel mb-16 leading-relaxed">
            We are a team of cryptographers and engineers dedicated to solving the blockchain usability crisis.
            Our mission is to make zero-knowledge proofs accessible to every developer and invisible to every user.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-24">
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Target className="text-sui-sea" /> Our Vision
              </h2>
              <p className="text-sui-steel leading-relaxed">
                We believe that the future of finance is not in managing private keys, but in expressing <strong>intents</strong>. 
                Users should define <em>what</em> they want, and the network should figure out <em>how</em> to deliver it.
                By combining ZK-SNARKs with account abstraction, we remove the friction of gas fees, chain switching, and seed phrases.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Globe className="text-purple-400" /> The Network
              </h2>
              <p className="text-sui-steel leading-relaxed">
                zk-Intents is not just a rollup; it's a decentralized coordination layer. 
                Our prover network is permissionless, allowing anyone with a GPU to contribute computational power 
                and earn rewards for generating validity proofs. This ensures censorship resistance and liveness.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-16">
            <h2 className="text-3xl font-bold mb-12 text-center">Core Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-8 rounded-3xl bg-white/5 border border-white/5">
                <h3 className="text-xl font-bold mb-4">Privacy First</h3>
                <p className="text-sui-steel">
                  Transactions reveal too much. Intents reveal only what is necessary. We use ZK to shield user intent data from MEV searchers.
                </p>
              </div>
              <div className="p-8 rounded-3xl bg-white/5 border border-white/5">
                <h3 className="text-xl font-bold mb-4">Radical Simplicity</h3>
                <p className="text-sui-steel">
                  Complexity is a bug. We abstract away nonces, gas, and signatures to create a web2-like experience.
                </p>
              </div>
              <div className="p-8 rounded-3xl bg-white/5 border border-white/5">
                <h3 className="text-xl font-bold mb-4">Open Source</h3>
                <p className="text-sui-steel">
                  We build in public. Our circuits, sequencer, and SDK are fully open source and MIT licensed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
