# MindScribe Design System: "Digital Sanctuary"

> **Description:** The source of truth for MindScribe's visual design, typography, and color palette.
> **Usage:** Refer to this when generating ANY frontend component.

---

## Core Philosophy

MindScribe is a **Sanctuary**. The UI must feel calm, private, and focused. Avoid harsh contrasts.

| Principle | Implementation |
|-----------|----------------|
| **Aesthetic** | "Paper & Ink" – warm backgrounds, crisp serif text for content, clean sans-serif for UI |
| **Motion** | Subtle, organic transitions (approx 300ms ease-out) |
| **Spacing** | Generous whitespace to reduce cognitive load |
| **Mood** | Warm, inviting, non-clinical, personal |

---

## 1. Color Palette (Tailwind)

> ⚠️ **Do not use default Tailwind colors.** Use these semantic names in `tailwind.config.js`:

### Primary Colors

| Semantic Name | Tailwind Class | Hex Code | Usage |
|---------------|----------------|----------|-------|
| **Canvas** | `bg-canvas` | `#FAFAF9` (stone-50) | Main application background (Warm Grey) |
| **Paper** | `bg-paper` | `#FFFFFF` | Cards, Editor surface, Sidebar |
| **Ink** | `text-ink` | `#1E293B` (slate-800) | Primary text (Softer than black) |
| **Pencil** | `text-pencil` | `#64748B` (slate-500) | Secondary text, timestamps, placeholders |

### Accent Colors

| Semantic Name | Tailwind Class | Hex Code | Usage |
|---------------|----------------|----------|-------|
| **Brand** | `text-brand` / `bg-brand` | `#4F46E5` (indigo-600) | Primary Actions, Active States |
| **Brand Hover** | `bg-brand-hover` | `#4338CA` (indigo-700) | Button hover states |
| **Focus** | `ring-focus` | `#C7D2FE` (indigo-200) | Focus rings for accessibility |

### Semantic Colors

| Semantic Name | Tailwind Class | Hex Code | Usage |
|---------------|----------------|----------|-------|
| **Destruct** | `text-destruct` | `#E11D48` (rose-600) | Delete, Danger zones |
| **Success** | `text-success` | `#059669` (emerald-600) | Confirmations, positive states |
| **Warning** | `text-warning` | `#D97706` (amber-600) | Caution states |

### Emotion Indicator Colors (for Mood Tracking)

| Emotion Category | Tailwind Class | Hex Code | Usage |
|------------------|----------------|----------|-------|
| **Joy** | `bg-emotion-joy` | `#FEF3C7` (amber-100) | Happy, excited entries |
| **Calm** | `bg-emotion-calm` | `#DBEAFE` (blue-100) | Peaceful, content entries |
| **Sadness** | `bg-emotion-sad` | `#E0E7FF` (indigo-100) | Sad, melancholic entries |
| **Anxiety** | `bg-emotion-anxious` | `#FCE7F3` (pink-100) | Worried, stressed entries |
| **Anger** | `bg-emotion-anger` | `#FEE2E2` (red-100) | Frustrated, angry entries |

---

## 2. Typography

> Reading is the core activity. We separate **"Interface"** from **"Content"**.

### Font Stack

```css
/* tailwind.config.js */
fontFamily: {
  sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
  serif: ['Merriweather', 'Lora', 'Georgia', 'serif'],
  mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
}
```

### Usage Rules

| Context | Font | Class | Reasoning |
|---------|------|-------|-----------|
| **UI Font** (Headings, Buttons, Nav) | Inter / Plus Jakarta Sans | `font-sans` | Highly legible at small sizes, neutral character |
| **Journal Font** (Entries, Editor) | Merriweather / Lora | `font-serif` | Serif fonts reduce eye strain for long-form reading and feel more "personal" |
| **Code/Data** | JetBrains Mono | `font-mono` | For any technical displays |

### Type Scale

| Element | Class | Size | Weight |
|---------|-------|------|--------|
| **Page Title** | `text-2xl font-sans font-semibold` | 24px | 600 |
| **Section Header** | `text-lg font-sans font-medium` | 18px | 500 |
| **Body (UI)** | `text-sm font-sans` | 14px | 400 |
| **Body (Journal)** | `text-lg font-serif` | 18px | 400 |
| **Caption** | `text-xs font-sans text-pencil` | 12px | 400 |
| **Timestamp** | `text-xs font-sans text-pencil` | 12px | 400 |

---

## 3. UI Component Rules

> When generating components, adhere to these rules:

### Buttons

```tsx
// Base classes for ALL buttons
const buttonBase = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"

// Variants
const buttonVariants = {
  primary: "bg-brand text-white hover:bg-brand-hover shadow-sm focus:ring-focus",
  secondary: "bg-paper text-ink border border-stone-200 hover:bg-stone-50 focus:ring-focus",
  ghost: "bg-transparent text-pencil hover:bg-stone-100 hover:text-ink",
  danger: "bg-destruct text-white hover:bg-rose-700 focus:ring-rose-200",
}

// Sizes
const buttonSizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10", // Square for icon-only buttons
}
```

### Cards (Entry Cards)

```tsx
const cardBase = "bg-paper border border-stone-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"

// Entry card specific
const entryCard = `${cardBase} p-4 cursor-pointer`

// Selected state
const entryCardSelected = "ring-2 ring-brand ring-offset-2"
```

### Inputs & Editor

```tsx
// Text inputs
const inputBase = "w-full bg-paper border border-stone-200 rounded-lg px-3 py-2 text-ink placeholder:text-pencil focus:border-brand focus:ring-2 focus:ring-focus focus:outline-none transition-colors"

// Editor (BlockNote wrapper)
const editorWrapper = "prose prose-slate prose-lg max-w-none font-serif focus:outline-none"

// Textarea (for simple text areas)
const textareaBase = `${inputBase} min-h-[120px] resize-none`
```

### Sidebar

```tsx
const sidebarBase = "w-64 bg-paper border-r border-stone-200 h-screen flex flex-col"

const sidebarItem = "flex items-center gap-3 px-3 py-2 rounded-lg text-pencil hover:bg-stone-100 hover:text-ink transition-colors"

const sidebarItemActive = "bg-indigo-50 text-brand font-medium"
```

### Modal / Dialog

```tsx
const modalOverlay = "fixed inset-0 bg-black/50 backdrop-blur-sm z-50"

const modalContent = "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-paper rounded-2xl shadow-xl p-6 w-full max-w-md z-50 animate-in fade-in zoom-in-95 duration-300"
```

---

## 4. Spacing System

> Use Tailwind's default spacing scale, but prefer these semantic patterns:

| Context | Spacing | Class |
|---------|---------|-------|
| **Component padding** | 16px | `p-4` |
| **Card padding** | 16-24px | `p-4` or `p-6` |
| **Section gap** | 24px | `space-y-6` or `gap-6` |
| **Tight list items** | 8px | `space-y-2` |
| **Page margins** | 24-32px | `px-6` or `px-8` |

---

## 5. Motion & Transitions

> All transitions should feel organic and calm—never jarring.

```tsx
// Standard transition
const transition = "transition-all duration-300 ease-out"

// Hover lift effect (for cards)
const hoverLift = "hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"

// Fade in animation (for modals, toasts)
const fadeIn = "animate-in fade-in duration-300"

// Slide in from bottom (for panels)
const slideUp = "animate-in slide-in-from-bottom-4 duration-300"
```

### Animation Keyframes (add to CSS)

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { 
    opacity: 0;
    transform: translateY(16px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
```

---

## 6. Accessibility (A11y)

> Non-negotiable requirements for all components:

### Focus States

```tsx
// NEVER remove outline without replacing it
// ❌ BAD: focus:outline-none
// ✅ GOOD: focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2
```

### Interactive Elements

```tsx
// Icon-only buttons MUST have aria-label
<button aria-label="Delete entry" className="...">
  <TrashIcon />
</button>

// Loading states
<button disabled aria-busy="true">
  <Spinner aria-hidden="true" />
  <span className="sr-only">Loading...</span>
</button>
```

### Color Contrast

| Combination | Ratio | Status |
|-------------|-------|--------|
| Ink on Paper | 12.6:1 | ✅ AAA |
| Ink on Canvas | 11.8:1 | ✅ AAA |
| Pencil on Paper | 4.6:1 | ✅ AA |
| Brand on Paper | 5.2:1 | ✅ AA |
| White on Brand | 5.2:1 | ✅ AA |

---

## 7. Component Examples

### Entry Card

```tsx
<article className="bg-paper border border-stone-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
  <div className="flex items-start justify-between mb-2">
    <time className="text-xs font-sans text-pencil">January 31, 2026</time>
    <span className="w-2 h-2 rounded-full bg-emotion-calm" aria-label="Calm mood" />
  </div>
  <h3 className="font-serif text-ink text-lg mb-2 line-clamp-1 group-hover:text-brand transition-colors">
    A quiet morning reflection
  </h3>
  <p className="font-serif text-pencil text-sm line-clamp-2">
    Today I woke up feeling grateful for the small things...
  </p>
  <div className="flex gap-2 mt-3">
    <span className="text-xs bg-stone-100 text-pencil px-2 py-1 rounded-full">#gratitude</span>
    <span className="text-xs bg-stone-100 text-pencil px-2 py-1 rounded-full">#morning</span>
  </div>
</article>
```

### Mood Selector

```tsx
<div className="flex items-center gap-2 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
  <span className="text-sm font-sans text-pencil mr-2">How are you feeling?</span>
  {['😢', '😔', '😐', '🙂', '😄'].map((emoji, i) => (
    <button
      key={i}
      className={`text-2xl p-2 rounded-lg transition-all hover:scale-110 ${
        selected === i 
          ? 'bg-brand/10 ring-2 ring-brand' 
          : 'hover:bg-white/50'
      }`}
      aria-label={`Mood level ${i + 1}`}
    >
      {emoji}
    </button>
  ))}
</div>
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-16 text-center">
  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4">
    <BookOpenIcon className="w-8 h-8 text-pencil" />
  </div>
  <h3 className="font-sans text-ink text-lg font-medium mb-2">
    Your journal awaits
  </h3>
  <p className="font-sans text-pencil text-sm max-w-xs mb-6">
    Start your first entry and begin your journey of reflection.
  </p>
  <button className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-hover transition-colors">
    <PlusIcon className="w-4 h-4" />
    New Entry
  </button>
</div>
```

---

## 8. Tailwind Config

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAF9',
        paper: '#FFFFFF',
        ink: '#1E293B',
        pencil: '#64748B',
        brand: {
          DEFAULT: '#4F46E5',
          hover: '#4338CA',
        },
        focus: '#C7D2FE',
        destruct: '#E11D48',
        success: '#059669',
        warning: '#D97706',
        emotion: {
          joy: '#FEF3C7',
          calm: '#DBEAFE',
          sad: '#E0E7FF',
          anxious: '#FCE7F3',
          anger: '#FEE2E2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Lora', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

---

## 9. Do's and Don'ts

### ✅ Do

- Use warm, muted colors (stone, slate)
- Prioritize readability with serif fonts for journal content
- Add generous padding and whitespace
- Use subtle shadows and transitions
- Ensure all interactive elements have focus states
- Use semantic color names, not raw values

### ❌ Don't

- Use pure black (`#000000`) for text
- Use harsh, saturated colors
- Create cramped layouts
- Use fast, jarring animations
- Remove focus outlines without replacement
- Use clinical/medical UI patterns (avoid "dashboard" aesthetic)

---

## 10. Icon Library

Use **Lucide React** for consistency:

```bash
npm install lucide-react
```

Commonly used icons:
- `BookOpen` - Journal/entries
- `PenLine` - Write/edit
- `Sparkles` - AI features
- `Heart` - Gratitude
- `Sun` - Mood/wellbeing
- `Search` - Search
- `Settings` - Settings
- `Plus` - New entry
- `Trash2` - Delete
- `Tag` - Tags
- `Calendar` - Date
- `TrendingUp` - Insights/trends

---

*Last updated: January 31, 2026*
*Version: 1.0.0*