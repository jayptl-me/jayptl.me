# Custom SVG Icons - Adaptive Theme System

This directory contains custom SVG icons with **dual-render adaptive architecture** for seamless integration with buttons, surfaces, and both light/dark themes.

## Icon List

### Navigation Icons

- **home.svg** - Home/portfolio icon
- **projects.svg** - Projects grid icon
- **more.svg** - More menu (three dots) icon

### Action Icons

- **settings.svg** - Privacy/settings gear icon
- **trash.svg** (`.icon-warning`) - Clear data/delete icon
- **close.svg** - Close/dismiss X icon

### Social Icons

- **github.svg** - GitHub logo
- **linkedin.svg** - LinkedIn logo

### Status Icons

- **check-circle.svg** (`.icon-success`) - Success/confirmation icon
- **info-circle.svg** (`.icon-info`) - Information icon
- **cookie.svg** (`.icon-warning`) - Cookie/consent icon

### Project Showcase Icons

- **chart.svg** - Analytics/data visualization
- **atom.svg** - React (atomic component structure)
- **rocket.svg** - Launch/live status
- **palette.svg** - UI/UX design
- **smartphone.svg** - Mobile device
- **layers.svg** - Flutter (widget layers)
- **target.svg** - Beta/target goal
- **app-window.svg** - Application window
- **globe.svg** - Web3/global
- **ethereum.svg** - Solidity/Ethereum blockchain
- **link-chain.svg** - Blockchain/chain links
- **hammer.svg** - Work in progress (WIP)
- **gem.svg** - Diamond/DApp
- **cpu.svg** - AI/processor
- **snake.svg** - Python programming
- **code.svg** - Code brackets
- **flask.svg** - Alpha/experimental
- **brain.svg** - Machine learning
- **gamepad.svg** - Gaming controller
- **cube.svg** - Unity game engine
- **sparkle.svg** - New/fresh
- **box-3d.svg** - 3D graphics
- **bolt.svg** - Lightning/speed
- **wrench.svg** - Tools/settings
- **dice.svg** - Randomization/games
- **joystick.svg** - Gaming/interactive

## Adaptive Architecture

### Dual-Render System

Every icon includes **two rendering modes**:

1. **Gradient Mode** (`.icon-gradient` group) - Full-color gradients for standalone use
2. **Monochrome Mode** (`.icon-mono` group) - `currentColor` for buttons and colored surfaces

```xml
<svg class="icon">
  <!-- Gradient version (visible by default) -->
  <g class="icon-gradient">...</g>
  
  <!-- Monochrome version (hidden, currentColor) -->
  <g class="icon-mono" style="display:none;">...</g>
</svg>
```

### CSS Variable Control

Icons use CSS custom properties for dynamic theming:

```css
:root {
    --icon-gradient-start: #2196f3;
    --icon-gradient-end: #00b8cc;
}

.icon-success {
    --icon-gradient-start: #14b8a6;
    --icon-gradient-end: #0d9488;
}
```

## Design Philosophy

All icons feature:

- **CSS variable-driven gradients** for easy customization
- **Dual-render architecture** (gradient + monochrome)
- **Rounded, smooth edges** matching the design system (8-18px border radius)
- **Subtle opacity layers** for depth and dimension
- **Consistent stroke widths** (1.5-2.5px) for visual harmony
- **Automatic context adaptation** (buttons, surfaces, themes)
- **Modern, minimalist aesthetic** that complements the glassmorphic UI

### Color Gradients

- **Primary Gradient:** Blue → Turquoise (navigation, general UI)
- **Success Gradient:** Teal → Dark Teal (confirmations, success states)
- **Warning Gradient:** Amber → Red (trash/delete, warnings)
- **Info Gradient:** Purple → Blue (information states)

## Usage Examples

### Basic Usage (Gradient Mode)

```html
<!-- Standalone icon with default gradient -->
<img src="assets/icons/home.svg" alt="Home" class="icon">

<!-- Icon with semantic color -->
<img src="assets/icons/trash.svg" alt="Delete" class="icon icon-warning">
```

### Button Usage (Auto Monochrome)

Icons automatically switch to monochrome on colored button backgrounds:

```html
<!-- Primary button - icon uses currentColor (white) -->
<button class="btn-primary">
    <img src="assets/icons/check-circle.svg" class="icon icon-success">
    Confirm
</button>

<!-- Ghost button - icon keeps gradient -->
<button class="btn-ghost">
    <img src="assets/icons/settings.svg" class="icon">
    Settings
</button>
```

### Surface Usage

```html
<!-- On colored surface - monochrome mode -->
<div class="bg-primary">
    <img src="assets/icons/info-circle.svg" class="icon icon-info">
    <p>Important information</p>
</div>

<!-- On neutral surface - gradient mode -->
<div class="card">
    <img src="assets/icons/info-circle.svg" class="icon icon-info">
    <p>Did you know?</p>
</div>
```

### Size Variants

```html
<!-- Extra small (14px) -->
<img src="assets/icons/home.svg" class="icon icon-xs">

<!-- Small (16px) -->
<img src="assets/icons/home.svg" class="icon icon-sm">

<!-- Default (24px) -->
<img src="assets/icons/home.svg" class="icon">

<!-- Large (32px) -->
<img src="assets/icons/home.svg" class="icon icon-lg">
```

### In JavaScript

```javascript
const basePath = new URL(".", location).pathname;
const icon = document.createElement('img');
icon.src = `${basePath}assets/icons/settings.svg`;
icon.alt = 'Settings';
icon.className = 'icon';
```

## Styling

Icons are designed with embedded gradients and styled via CSS for smooth interactions:

```css
/* Base icon styling */
.nav-link img {
    width: 20px;
    height: 20px;
    opacity: 0.9;
    transition: transform var(--duration-normal) var(--ease-out), 
                opacity var(--duration-normal) var(--ease-out);
}

/* Hover effects */
.nav-link:hover img {
    transform: scale(1.1);
    opacity: 1;
}

/* Light theme adjustments */
@media (prefers-color-scheme: light) {
    .nav-link img {
        opacity: 1;
    }
}
```

## Files Updated

The following files were updated to use these custom icons:

1. **js/components/navbar.js** - Navigation icons (projects, more menu)
2. **privacy.html** - Action button icons (settings, trash, home)
3. **js/components/consent-banner.js** - Close icon in settings dialog
4. **css/components/navbar.css** - Icon styling for nav links
5. **css/pages/privacy.css** - Icon styling for privacy action buttons

## Benefits

- **Consistency** - All icons follow the same design language
- **Performance** - Small SVG files load faster than icon fonts
- **Maintainability** - Easy to update or replace individual icons
- **Accessibility** - Icons are properly marked with `aria-hidden` and paired with descriptive text
- **Theme Support** - Icons automatically adapt to light/dark themes via CSS filters
