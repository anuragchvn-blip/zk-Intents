'use client';

import { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero3D from '../components/Hero3D';
import SpotlightCard from '../components/SpotlightCard';
import InteractiveDemo from '../components/InteractiveDemo';
import IntentExplainer from '../components/IntentExplainer';
import WorkflowDiagram from '../components/WorkflowDiagram';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Zap, Layers, Code, Globe, Terminal, Cpu, Network } from 'lucide-react';

// Inline simplified client
class SimpleClient {
  constructor(private url: string) {}
  async createSession() {
    return {
      address: '0x' + Math.random().toString(16).slice(2, 42),
      publicKey: ['0x123', '0x456'] as [string, string],
    };
  }
  async submitIntent() {
    return { intentId: `intent_${Date.now()}`, status: 'queued' };
  }
}

export default function Home() {
  const [client] = useState(() => new SimpleClient('http://localhost:3000'));
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [email, setEmail] = useState('');
  
  const createSession = async () => {
    setLoading(true);
    try {
      const newSession = await client.createSession();
      setSession(newSession);
      setStatus(`Session active: ${newSession.address.slice(0, 8)}...`);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const submitTransfer = async () => {
    setLoading(true);
    try {
      const result = await client.submitIntent();
      setStatus(`Intent submitted: ${result.intentId}`);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <main className="min-h-screen bg-sui-deep text-white font-sans selection:bg-sui-sea selection:text-white overflow-x-hidden">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20">
        <Hero3D />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sui-sea/10 border border-sui-sea/20 text-sui-sea text-xs font-mono mb-8">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sui-sea opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sui-sea"></span>
                </span>
                MAINNET BETA LIVE
              </div>
              
              <h1 className="text-7xl md:text-9xl font-bold tracking-tighter leading-[0.9] mb-8">
                Build without <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sui-sea to-sui-aqua">
                  boundaries.
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-sui-steel mb-12 max-w-2xl leading-relaxed font-light">
                The first intent-centric rollup designed for infinite scalability. 
                Abstracting complexity, maximizing throughput.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6">
                <button 
                  onClick={() => document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })}
                  className="group px-8 py-4 bg-sui-cloud text-sui-deep rounded-full font-bold text-lg hover:bg-white transition-all flex items-center gap-2"
                >
                  Start Building 
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="px-8 py-4 bg-white/5 text-white border border-white/10 rounded-full font-bold text-lg hover:bg-white/10 transition-all backdrop-blur-sm">
                  Read Documentation
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid (Spotlight) */}
      <section className="py-32 bg-sui-deep relative z-10">
        <div className="container mx-auto px-6">
          <div className="mb-16">
            <h2 className="text-4xl font-bold mb-4">Engineered for performance</h2>
            <p className="text-sui-steel text-lg">Primitive-level optimizations for the next generation of dApps.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SpotlightCard>
              <Zap className="text-sui-sea mb-6" size={32} />
              <h3 className="text-2xl font-bold mb-4">Instant Finality</h3>
              <p className="text-sui-steel leading-relaxed">
                Optimistic confirmation with ZK-validity proofs. Sub-second latency for real-time applications.
              </p>
            </SpotlightCard>
            
            <SpotlightCard>
              <Shield className="text-sui-sea mb-6" size={32} />
              <h3 className="text-2xl font-bold mb-4">Native Abstraction</h3>
              <p className="text-sui-steel leading-relaxed">
                Session keys and social recovery baked into the protocol. No complex wallet SDKs required.
              </p>
            </SpotlightCard>
            
            <SpotlightCard>
              <Network className="text-sui-sea mb-6" size={32} />
              <h3 className="text-2xl font-bold mb-4">Parallel Execution</h3>
              <p className="text-sui-steel leading-relaxed">
                State access lists allow non-overlapping transactions to execute in parallel.
              </p>
            </SpotlightCard>
          </div>
        </div>
      </section>





      {/* Intent Explainer Section */}
      <IntentExplainer />

      {/* Workflow Diagram Section */}
      <section className="py-24 bg-sui-deep border-b border-white/5">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Live Network Activity</h2>
            <p className="text-sui-steel">Visualizing the flow of intents through the sequencer and prover network.</p>
          </div>
          <div className="bg-sui-ocean border border-white/10 rounded-[2.5rem] p-8">
            <WorkflowDiagram />
          </div>
        </div>
      </section>

      {/* Developer Experience (Split Screen) */}
      <section id="demo" className="py-32 bg-sui-ocean border-y border-white/5 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Left: Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sui-sea/10 text-sui-sea text-xs font-mono mb-6">
                <Terminal size={12} />
                DEVELOPER PREVIEW
              </div>
              <h2 className="text-5xl font-bold mb-6 tracking-tight">
                Code less. <br />
                <span className="text-sui-steel">Ship more.</span>
              </h2>
              <p className="text-lg text-sui-steel mb-8 leading-relaxed">
                Integrate walletless onboarding in minutes, not weeks. Our SDK handles the cryptography, you handle the experience.
              </p>
              
              <div className="space-y-4 mb-12">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Code size={20} className="text-sui-sea" />
                  </div>
                  <div>
                    <h4 className="font-bold">Type-safe SDK</h4>
                    <p className="text-sm text-sui-steel">Full TypeScript support out of the box.</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Cpu size={20} className="text-sui-sea" />
                  </div>
                  <div>
                    <h4 className="font-bold">Local Simulation</h4>
                    <p className="text-sm text-sui-steel">Test intents locally before deploying.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Interactive Demo */}
            <div className="relative">
              {/* Glow Effect */}
              <div className="absolute -inset-4 bg-sui-sea/20 rounded-[2.5rem] blur-2xl"></div>
              <InteractiveDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 bg-sui-deep">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-sui-sea rounded-full"></div>
              <span className="font-bold text-lg">zk-Intents</span>
            </div>
            <div className="flex gap-8 text-sm text-sui-steel">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
