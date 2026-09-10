import type { Config } from 'tailwindcss'
import daisyui from 'daisyui'
export default { content: ['./app/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [daisyui], daisyui: { themes: ['night'] } } satisfies Config
