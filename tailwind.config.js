export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#E5253A',
          dark: '#C81E30',
          light: '#3A1216',
        },
        'toss-bg': '#0A0A0B',
        surface: '#161618',
        'surface-alt': '#1F2023',
      },
      boxShadow: {
        card: '0 2px 16px rgba(0, 0, 0, 0.45)',
        floating: '0 8px 24px rgba(229, 37, 58, 0.35)',
      },
    },
  },
  plugins: [],
}
