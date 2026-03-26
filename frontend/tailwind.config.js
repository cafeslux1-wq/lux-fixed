/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT:'#C9A84C', light:'#E8C97A', dark:'#8B6E2F', dim:'rgba(201,168,76,0.12)' },
        black: { DEFAULT:'#0D0D0D', 2:'#141414', 3:'#1A1A1A', 4:'#212121', 5:'#2A2A2A' },
      },
      fontFamily: { display:['"Playfair Display"','Georgia','serif'], body:['"DM Sans"','sans-serif'] },
      animation: { 'pulse-slow':'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite', 'slide-up':'slideUp 0.25s ease-out', 'fade-in':'fadeIn 0.2s ease-out' },
      keyframes: { slideUp:{from:{opacity:'0',transform:'translateY(8px)'},to:{opacity:'1',transform:'translateY(0)'}}, fadeIn:{from:{opacity:'0'},to:{opacity:'1'}} },
    },
  },
  plugins: [],
};
