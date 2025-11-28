'use client';

import { motion } from 'framer-motion';
import { User, Server, Shield, Database, CheckCircle } from 'lucide-react';

export default function IntentExplainer() {
  const steps = [
    {
      icon: <User size={20} />,
      title: "1. User Intent",
      desc: "You sign a message: \"I want to send 10 USDC\". No gas needed!"
    },
    {
      icon: <Server size={20} />,
      title: "2. Sequencer",
      desc: "Validates your signature and adds it to a batch of 100+ intents."
    },
    {
      icon: <Shield size={20} />,
      title: "3. ZK Prover",
      desc: "Generates a zero-knowledge proof that all 100 intents are valid."
    },
    {
      icon: <Database size={20} />,
      title: "4. L1 Settlement",
      desc: "Smart contract verifies the proof and updates balances on-chain."
    }
  ];

  return (
    <div className="bg-transparent border-none rounded-3xl p-0 py-24">
      <div className="container mx-auto px-6">
        <h3 className="text-3xl font-bold mb-12 flex items-center gap-3">
          <span className="w-1 h-8 bg-sui-sea rounded-full"></span>
          How zk-Intents Work
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-sui-sea/30 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 border border-sui-sea/20 bg-sui-sea/10">
                <div className="text-sui-sea">
                  {step.icon}
                </div>
              </div>
              <h4 className="font-semibold text-base mb-2 text-white">{step.title}</h4>
              <p className="text-white/60 text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-12">
          <div className="flex items-start gap-3 text-sm text-white/60 bg-white/[0.03] border border-white/[0.08] p-5 rounded-xl">
            <CheckCircle size={18} className="text-sui-sea shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Live Demo:</strong> When you click "Send", you are Step 1. Watch the "Network Logs" to see Steps 2-4 happen in real-time!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
