# Styles — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Files](#1-files)
- [2. Design tokens (\_tokens.scss)](#2-design-tokens-_tokensscss)
  - [2.1 Brand colors (CSS custom properties)](#21-brand-colors-css-custom-properties)
  - [2.2 Button glass tokens](#22-button-glass-tokens)
  - [2.3 Surface tokens](#23-surface-tokens)
- [3. Global styles (index.scss)](#3-global-styles-indexscss)
  - [3.1 CSS Variables](#31-css-variables)
  - [3.2 Typography](#32-typography)
  - [3.3 Theme switching](#33-theme-switching)
  - [3.4 Component classes](#34-component-classes)
- [4. Liquid Glass system](#4-liquid-glass-system)
- [5. Khi nào dùng SCSS / Tailwind / CSS module](#5-khi-nào-dùng-scss--tailwind--css-module)
- [6. Gotchas](#6-gotchas)

---

# 1. Files

```
styles/
├── _tokens.scss              ← Design tokens: brand colors, button glass tokens, surface tokens
├── index.scss                ← Global styles, CSS variables, Liquid Glass classes, Ant Design overrides
└── product-description.css   ← Override cho Quill HTML output (product description)
```

`index.scss` dùng `@use './tokens' as *` để import tokens, sau đó include trong `src/main.tsx`.

---

# 2. Design tokens (\_tokens.scss)

## 2.1 Brand colors (CSS custom properties)

```scss
:root {
  /* Primary — Teal */
  --color-primary: #2aaca7;
  --color-primary-light: #4bbcb8;
  --color-primary-dark: #229a96;

  /* Secondary — Coral */
  --color-secondary: #ff755e;
  --color-secondary-light: #ff9a87;
  --color-secondary-dark: #e56954;
}
```

## 2.2 Button glass tokens

Button tokens tập trung — thay đổi 1 token = apply toàn bộ buttons cùng loại:

| Token group      | Dùng cho                                                  |
| ---------------- | --------------------------------------------------------- |
| `--btn-cta-*`    | CTA "Mua ngay" buttons — Teal                             |
| `--btn-cart-*`   | "Thêm vào giỏ" buttons — Coral                            |
| `--btn-view-*`   | "Xem chi tiết" buttons — Neutral                          |
| `--btn-danger-*` | Delete/danger buttons — Red                               |
| `--btn-blur`     | `blur(14px) saturate(2)` — chung cho tất cả glass buttons |
| `--btn-specular` | Specular highlight gradient — chung                       |

Dark mode: opacity thấp hơn để glass trong hơn, màu giữ nguyên.

## 2.3 Surface tokens

```scss
--surface-card           // Card background (rgba white)
--surface-card-border    // Card border
--surface-image          // Product image background (#f5f5f5 light / #2a2a2a dark)
```

---

# 3. Global styles (index.scss)

## 3.1 CSS Variables

**Light mode (`/:root`):**

```
--bg-base: #ffffff         --text-primary: #09090b
--bg-surface: #fafafa      --text-secondary: #52525b
--bg-elevated: #f4f4f5     --text-tertiary: #a1a1aa
--accent: #2aaca7          --border-default: #e4e4e7
--glass-bg: rgba(255,255,255,0.65)
```

**Dark mode (`.dark`):**

```
--bg-base: #111111         --text-primary: #fafafa
--bg-surface: #161616      --accent: #4bbcb8 (luminous)
--glass-bg: rgba(255,255,255,0.05)
```

## 3.2 Typography

- Heading: `Montserrat` (`--font-heading`) — bold, letter-spacing tight
- Body: `Inter` (`--font-body`)
- Font variables: `--font-light` (300) → `--font-extrabold` (800)

## 3.3 Theme switching

- **View Transitions API:** `startViewTransition()` + circular reveal từ toggle button position
- `::view-transition-new(root)`: `theme-circle-reveal` animation 0.3s
- CSS variable `--theme-toggle-x/y`: position của toggle button (set từ `ThemeToggle.tsx`)
- `prefers-reduced-motion`: fallback `animation: none`

## 3.4 Component classes

```scss
/* Liquid Glass cards */
.glass-card          // Base glass card (radius 1.25rem)
.glass-card-sm       // Smaller glass card (radius 0.875rem)
.glass-card-lg       // Large glass card (radius 1.75rem)
.glass-nav           // Navbar glass
.glass-btn           // Glass button base
.glass-input         // Glass form input
.glass-product-card  // Product card (2.0 — noise grain + specular)
.glass-product-card-featured  // Featured product tall card
.glass-section-card  // Promo banner card
.collection-card     // Category editorial card (hover scale image)

/* Typography */
.gradient-text       // Teal gradient text
.gradient-text-warm  // Coral/warm gradient text
.gradient-text-shine // Animated shimmer gradient text
.display-heading     // Large section heading (font-black, tight tracking)
.section-number      // "01 / SECTION NAME" label

/* Layout */
.page-canvas         // Unified page background (no stripe effect)
.bento-card          // Bento grid card

/* Glass buttons 2.0 */
.btn-glass-primary   // CTA — teal
.btn-glass-cart      // Cart — coral
.btn-glass-danger    // Delete — red
.btn-glass-secondary // View — neutral

/* Premium buttons (Ant Design) */
.premium-button      // Base class
.premium-button-primary, -secondary, -success, -info, -warning, -danger, -ghost, -outline

/* Animations */
.shimmer             // Loading skeleton animation
.orb, .orb-primary, .orb-secondary, .orb-accent  // Ambient gradient orbs
.marquee-container / .marquee-track   // Auto-scroll brand marquee
.iridescent-rule     // Iridescent divider line

/* Utilities */
.no-scrollbar        // Hide scrollbar but keep scroll
.scrollbar-thin      // Modern thin scrollbar
.focus-ring          // Accessibility focus ring
.gradient-border     // Gradient border via ::before pseudo

/* Ant Design dark mode overrides */
.ant-message-dark    // Dark mode toast styles
.dark .ant-*         // Dark mode overrides cho Table, Modal, Form, Pagination...
```

---

# 4. Liquid Glass system

Design system 2025-2026 — Apple iOS 26 inspired. Key concepts:

- **Backdrop filter:** `blur(var(--glass-blur)) saturate(var(--glass-saturate))`
- **Noise grain:** SVG `feTurbulence` filter embedded as data URI — simulates frosted glass texture
- **Specular highlight:** `::after` pseudo với `linear-gradient` diagonal
- **Ambient orbs:** radial-gradient blurred circles cho background depth
- **Page canvas:** 1 unified background cho toàn bộ page — không có stripe giữa sections

---

# 5. Khi nào dùng SCSS / Tailwind / CSS module

| Use case                                   | Tool                                                   |
| ------------------------------------------ | ------------------------------------------------------ |
| Layout, spacing, color cho UI thông thường | **Tailwind class** trực tiếp                           |
| Conditional classes                        | `cn()` từ `utils/cn.ts`                                |
| Global font, body reset                    | `index.scss`                                           |
| Design tokens (brand colors, glass vars)   | `_tokens.scss` CSS variables                           |
| Complex animations (keyframes phức tạp)    | `index.scss` hoặc **Framer Motion**                    |
| Product description HTML từ Quill          | `product-description.css` class `.description-content` |
| Override Ant Design dark mode              | `index.scss` `.dark .ant-*`                            |

**Nguyên tắc:** ưu tiên Tailwind. Chỉ dùng SCSS khi Tailwind không xử lý được.

---

# 6. Gotchas

- **Không tạo file `.scss` rải rác** trong feature folders — đặt trong `styles/` hoặc dùng Tailwind inline.
- **`product-description.css`** áp dụng global (class `.description-content`) — cẩn thận tránh conflict với layout khác.
- **Đổi brand color:** update `_tokens.scss` (CSS vars) **VÀ** `tailwind.config.js` (Tailwind palette) cùng lúc.
- **Dark mode:** dùng Tailwind `dark:` modifier cho component-level, CSS vars cho global. `--bg-base`/`--text-primary` là source of truth cho neutral dark mode (#111111 base).
- **`--color-bg-primary` và `--bg-base`** đều tồn tại — `--bg-base` là version mới, `--color-bg-primary` là legacy compat. Dùng `--bg-base` cho code mới.
- **Glass effects cần `isolation: isolate`** trên container để stacking context hoạt động đúng với `::before`/`::after` pseudo-elements.
