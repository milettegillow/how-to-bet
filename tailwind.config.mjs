/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    colors: {
      paper: '#fafaf7',
      ink: '#1a1a1a',
      'card-red': '#a8252c',
      gold: '#b08d2c',
      ruin: '#6b7f5e',
      success: '#3d6b4e',
      transparent: 'transparent',
      current: 'currentColor',
    },
    fontFamily: {
      serif: ['"EB Garamond"', 'Georgia', 'serif'],
      mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
    },
    extend: {
      fontSize: {
        body: ['1.1875rem', { lineHeight: '1.6' }],
      },
      maxWidth: {
        prose: '680px',
        wide: '960px',
      },
    },
  },
  plugins: [],
};
