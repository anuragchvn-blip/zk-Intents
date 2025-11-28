'use client';

import Navbar from '../../components/Navbar';
import WorkflowDiagram from '../../components/WorkflowDiagram';
import { Server, Cpu, Database, Shield, Lock, FileCode } from 'lucide-react';

export default function Technology() {
  return (
    <main className="min-h-screen bg-sui-deep text-white font-sans selection:bg-sui-sea selection:text-white">
      <Navbar />
      
      {/* Hero */}
      <div className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-sui-sea/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-6xl md:text-7xl font-bold mb-8 tracking-tight">
              Architecture of <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sui-sea to-sui-aqua">
                Infinite Scale
              </span>
            </h1>
            <p className="text-xl text-sui-steel leading-relaxed max-w-2xl mx-auto">
              A modular ZK-rollup stack designed for high-frequency intents. 
              Separating execution, proving, and settlement for maximum throughput.
            </p>
          </div>
        </div>
      </div>

      {/* Workflow Diagram */}
      <div className="container mx-auto px-6 mb-32">
        <div className="bg-sui-ocean border border-white/10 rounded-[2.5rem] p-12 relative overflow-hidden">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-2">System Workflow</h2>
            <p className="text-sui-steel">Real-time visualization of the intent lifecycle.</p>
          </div>
          <WorkflowDiagram />
        </div>
      </div>

      {/* Deep Dive Content (Vitalik Style) */}
      <div className="container mx-auto px-6 pb-32">
        <div className="max-w-3xl mx-auto space-y-16">
          
          <section>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Shield className="text-sui-sea" /> Cryptographic Security
            </h2>
            <div className="prose prose-invert prose-lg text-sui-steel">
              <p>
                The security model of zk-Intents relies on the <strong>soundness</strong> of the underlying proof system (Groth16 over BN254). 
                Unlike optimistic rollups which rely on a 1-of-N honest watchtower assumption and a challenge period (typically 7 days), 
                our validity proofs offer cryptographic certainty. Once a proof is verified on L1, the state transition is final.
              </p>
              <p className="mt-4">
                We utilize a <strong>Sparse Merkle Tree (SMT)</strong> structure for state storage, allowing for efficient non-inclusion proofs. 
                This is critical for our "stateless" client architecture, where users only need to store their own path to the root, 
                rather than the entire state trie.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Lock className="text-purple-400" /> Circuit Constraints
            </h2>
            <div className="prose prose-invert prose-lg text-sui-steel">
              <p>
                Our circuits are written in <strong>Circom</strong> and compiled to R1CS. The primary constraint generation focuses on 
                EdDSA signature verification and Merkle path validity. To optimize prover time, we batch multiple intents (up to 1024) 
                into a single proof using recursive aggregation.
              </p>
              <p className="mt-4">
                This recursive structure allows us to parallelize proof generation horizontally. Worker nodes generate proofs for individual 
                chunks of intents, which are then aggregated by a master prover. This reduces the marginal cost of an intent to near zero 
                as network usage scales.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <FileCode className="text-green-400" /> Account Abstraction
            </h2>
            <div className="prose prose-invert prose-lg text-sui-steel">
              <p>
                We implement native account abstraction at the protocol level, not just as a smart contract layer (ERC-4337). 
                This means the protocol itself understands "Session Keys" and "Recovery Logic".
              </p>
              <p className="mt-4">
                Users authenticate via WebAuthn (Passkeys) or OIDC (ZK-Email). The sequencer verifies these off-chain credentials 
                and maps them to an on-chain address. This separation of <em>authentication</em> from <em>authorization</em> 
                allows for seamless key rotation without changing the user's identity or asset ownership.
              </p>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
