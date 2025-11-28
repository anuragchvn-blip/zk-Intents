'use client';

import { motion } from 'framer-motion';

interface SketchProps {
  title: string;
  description: string;
  step: number;
}

export default function SketchExplanation({ title, description, step }: SketchProps) {
  return (
    <div className="flex flex-col md:flex-row items-center gap-12 py-16">
      <div className={`flex-1 ${step % 2 === 0 ? 'md:order-2' : 'md:order-1'}`}>
        <motion.div
          initial={{ opacity: 0, x: step % 2 === 0 ? 50 : -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative bg-white rounded-3xl p-8 shadow-xl border border-gray-100 overflow-hidden"
        >
          {/* Sketchy Background Pattern */}
          <div className="absolute inset-0 opacity-5" 
            style={{ 
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")' 
            }} 
          />
          
          {/* Abstract Sketch Representation */}
          <div className="relative h-64 w-full flex items-center justify-center">
            {step === 1 && (
              <svg viewBox="0 0 200 200" className="w-full h-full stroke-blue-500 stroke-2 fill-none">
                <motion.path
                  d="M40,100 Q100,20 160,100 T280,100"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                />
                <circle cx="40" cy="100" r="10" className="fill-blue-100" />
                <circle cx="160" cy="100" r="10" className="fill-blue-100" />
              </svg>
            )}
            {step === 2 && (
               <div className="relative w-40 h-40">
                 <motion.div 
                   className="absolute inset-0 border-4 border-dashed border-purple-400 rounded-full"
                   animate={{ rotate: 360 }}
                   transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                 />
                 <div className="absolute inset-0 flex items-center justify-center text-4xl">🔐</div>
               </div>
            )}
            {step === 3 && (
               <div className="grid grid-cols-3 gap-2 w-48">
                 {[...Array(9)].map((_, i) => (
                   <motion.div
                     key={i}
                     initial={{ scale: 0 }}
                     whileInView={{ scale: 1 }}
                     transition={{ delay: i * 0.1 }}
                     className="w-12 h-12 bg-green-100 rounded-lg border border-green-300"
                   />
                 ))}
               </div>
            )}
          </div>
        </motion.div>
      </div>
      
      <div className={`flex-1 ${step % 2 === 0 ? 'md:order-1' : 'md:order-2'}`}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="inline-block px-4 py-1 rounded-full bg-gray-100 text-gray-600 font-mono text-sm mb-4">
            Step 0{step}
          </div>
          <h3 className="text-3xl font-bold mb-4 text-gray-900">{title}</h3>
          <p className="text-lg text-gray-600 leading-relaxed">
            {description}
          </p>
          <button className="mt-6 text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-2 group">
            Learn more 
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
