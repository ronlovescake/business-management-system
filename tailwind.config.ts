import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'card-background': 'var(--card-background)',
        'border-color': 'var(--border-color)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'surface-1': 'var(--surface-1)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
      },
      boxShadow: {
        'light': 'var(--shadow-light)',
        'medium': 'var(--shadow-medium)',
        'large': 'var(--shadow-large)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'slide-in-right': 'slideInRight 0.6s ease-out forwards',
      },
    },
  },
  plugins: [],
  // Important: Disable preflight since Mantine has its own reset
  corePlugins: {
    preflight: false,
  },
};

export default config;