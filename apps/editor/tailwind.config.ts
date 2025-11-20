import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bw-crimson': '#D34E4E',
        'bw-sand': '#F9E7B2',
        'bw-amber': '#DDC57A',
        'bw-clay': '#CE7E5A',
        'bw-ink': '#0B0D16',
        'bw-platinum': '#F7F5F2'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        'glow-sm': '0 10px 30px rgba(211, 78, 78, 0.25)'
      }
    }
  },
  plugins: []
};

export default config;
