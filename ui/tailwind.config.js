/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sui: {
          sea: '#4DA2FF',      // Bright Blue
          ocean: '#011829',    // Dark Blue Background
          deep: '#030F1C',     // Darker Background
          aqua: '#C0E6FF',     // Light Blue Accent
          steel: '#8490A5',    // Muted Text
          cloud: '#FFFFFF',    // White
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-glow': 'conic-gradient(from 180deg at 50% 50%, #030F1C 0deg, #4DA2FF 180deg, #030F1C 360deg)',
      },
    },
  },
  plugins: [],
};
