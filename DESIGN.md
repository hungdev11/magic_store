# DESIGN.md — Micro-ERP Design System & Tokens

## Design Direction & Mode
- **Mode**: Operate (Scanability, consistency, rapid keyboard & touch ergonomics for POS / Inventory operators).
- **Core Aesthetic**: Crisp, high-density, professional utility. No visual noise, no generic AI slop.

## Color Tokens
```css
:root {
  /* Surfaces */
  --surface-app: #f8fafc;        /* App canvas background */
  --surface-card: #ffffff;       /* Cards, tables, drawers */
  --surface-card-hover: #f1f5f9; /* Table row / list item hover */
  --surface-muted: #f1f5f9;      /* Muted containers, table headers */

  /* Borders */
  --border-subtle: #e2e8f0;     /* Dividers and soft section borders */
  --border-default: #cbd5e1;    /* Input borders and standard outlines */
  --border-focus: #059669;      /* Brand active focus outline */

  /* Typography / Text (Contrast ≥ 4.5:1) */
  --text-main: #0f172a;         /* High-contrast primary text (Slate-900) */
  --text-sub: #475569;          /* Secondary labels and descriptions (Slate-600) */
  --text-disabled: #94a3b8;     /* Inactive elements and placeholders */
  --text-inverse: #ffffff;      /* Text on dark/accent backgrounds */

  /* Semantics */
  --color-brand: #059669;       /* Emerald-600 */
  --color-brand-hover: #047857; /* Emerald-700 */
  --color-brand-light: #ecfdf5; /* Emerald-50 */

  --color-inflow: #059669;      /* Inward inventory / Revenue */
  --color-inflow-light: #ecfdf5;

  --color-outflow: #e11d48;     /* Loss, wastage, expense, debt (Rose-600) */
  --color-outflow-light: #fff1f2;

  --color-alert: #d97706;       /* Warning, expiring batches (Amber-600) */
  --color-alert-light: #fffbeb;

  --color-info: #0284c7;        /* Information, system notices (Sky-600) */
  --color-info-light: #f0f9ff;

  /* Industry Module Accents */
  --accent-catchweight: #0891b2;
  --accent-catchweight-light: #ecfeff;

  --accent-matrix: #7c3aed;
  --accent-matrix-light: #f5f3ff;

  --accent-bom: #4f46e5;
  --accent-bom-light: #eef2ff;

  --accent-modifier: #ea580c;
  --accent-modifier-light: #fff7ed;

  /* Radius */
  --radius-sm: 0.25rem;  /* Inputs, small buttons, badges */
  --radius-base: 0.375rem;
  --radius-md: 0.5rem;   /* Modals, panels */
  --radius-lg: 0.75rem;  /* Container cards */
}
```

## Typography Scale
| Token | Size | Tracking | Use Case |
|---|---|---|---|
| `text-[10px]` | 10px | +0.02em | Micro tags, keyboard shortcut hints |
| `text-xs` | 12px | normal | Form labels, table headers, badges |
| `text-sm` | 14px | normal | Standard body, table data, inputs, buttons |
| `text-base` | 16px | normal | Modal titles, group headings |
| `text-xl` | 20px | -0.01em | Section titles, summary figures |
| `text-2xl` | 24px | -0.02em | Page headers |

## Anti-AI Slop Rules
1. **No Eyebrow Kickers**: Headings carry their own meaning. Never prepend a miniature badge saying "QUẢN LÝ..." above the `h1`.
2. **Tabular Numerals**: Every monetary figure (`₫`), physical measurement (`kg`), inventory count, and barcode MUST declare `tabular-nums font-mono` or `font-sans tabular-nums`.
3. **No Decorative Gradients**: Text is solid colored. Emphasis comes from font size, weight, or semantic text colors.
4. **No Empty Metric Hero Cards**: Show actionable tabular lists or real summaries instead of fake cards with static numbers.
5. **No Unicode/Emoji Icons**: All icons come from `lucide-react` with 1.5px or 2px stroke width.
