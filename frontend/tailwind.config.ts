import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          app: "var(--surface-app)",
          card: "var(--surface-card)",
          "card-hover": "var(--surface-card-hover)",
          muted: "var(--surface-muted)",
        },
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          focus: "var(--border-focus)",
        },
        text: {
          main: "var(--text-main)",
          sub: "var(--text-sub)",
          disabled: "var(--text-disabled)",
          inverse: "var(--text-inverse)",
        },
        brand: {
          DEFAULT: "var(--color-brand)",
          hover: "var(--color-brand-hover)",
          light: "var(--color-brand-light)",
        },
        inflow: {
          DEFAULT: "var(--color-inflow)",
          light: "var(--color-inflow-light)",
        },
        outflow: {
          DEFAULT: "var(--color-outflow)",
          light: "var(--color-outflow-light)",
        },
        alert: {
          DEFAULT: "var(--color-alert)",
          light: "var(--color-alert-light)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          light: "var(--color-info-light)",
        },
        accent: {
          catchweight: {
            DEFAULT: "var(--accent-catchweight)",
            light: "var(--accent-catchweight-light)",
          },
          matrix: {
            DEFAULT: "var(--accent-matrix)",
            light: "var(--accent-matrix-light)",
          },
          bom: {
            DEFAULT: "var(--accent-bom)",
            light: "var(--accent-bom-light)",
          },
          modifier: {
            DEFAULT: "var(--accent-modifier)",
            light: "var(--accent-modifier-light)",
          },
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-base)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        dropdown: "var(--shadow-dropdown)",
        popover: "var(--shadow-popover)",
      },
    },
  },
  plugins: [],
};

export default config;
