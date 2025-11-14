module.exports = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // Performance zones
        performance: {
          high: '#22c55e',
          balanced: '#eab308',
          latency: '#f97316',
          low: '#ef4444',
        },
        // Dark theme colors
        dark: {
          bg: '#1f2937',
          surface: '#374151',
          border: '#4b5563',
        },
      },
    },
  },
  darkMode: 'class',
  plugins: [],
};
