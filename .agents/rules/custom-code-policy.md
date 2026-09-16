# Custom Code, Intellectual Property & Theme Taste Policy

## 1. Custom Code & Intellectual Property Mandate
1. **100% Bespoke, Original Implementation**:
   - All code written for this portfolio must be written from scratch in clean vanilla HTML, CSS, and JavaScript.
   - External UI concepts, animation patterns, or web references serve **STRICTLY AND ONLY AS CONCEPTUAL INSPIRATION**.
   - NEVER copy, download, scrape, or extract proprietary code from commercial or external registries.
   - NEVER configure authentication headers, private registry URLs, or install external proprietary/commercial packages or private registries.

2. **Clean Brand Separation**:
   - Do NOT include third-party commercial brand names, package tags, or registry references in source code, docstrings, CSS comments, or commit messages.
   - Describe all components by their actual architecture and role in the design system (e.g. "Unified Floating Island", "Split Text Stagger", "Canvas Particle Text Engine", "Selected Work Scroll Stack").

3. **Strict Technology Constraints**:
   - Zero runtime frameworks (no React, Vue, Svelte, or Angular).
   - Zero CSS preprocessors or utility frameworks (pure vanilla CSS only).
   - Zero emojis in deliverables.


---

## 2. Theme Taste & Aesthetics Specification

The portfolio uses two fundamentally distinct design languages across light and dark modes. Agents must NEVER mix their tokens, visual materials, or color ramps.

### Dark Mode Taste: "Liquid Glass" (Turquoise Ramp)
- **Vibe & Mood**: Sci-Fi, deep space refractive liquid glass, glowing neon reflections, sleek obsidian aesthetic.
- **Color Palette**: STRICTLY Turquoise ramp (`#00b8cc`, `var(--accent-400)`, `var(--accent-500)`, `var(--accent-300)`). **NEVER blue in dark mode.**
- **Materiality & Surfaces**:
  - Translucent obsidian/slate surfaces (`linear-gradient(135deg, rgba(14, 22, 33, 0.78), rgba(8, 13, 20, 0.88))`).
  - High blur refraction: `backdrop-filter: blur(20px) saturate(160%)`.
  - Specular rim reflections: crisp white/translucent inner highlight on the top edge (`inset 0 1px 1px 0 rgba(255, 255, 255, 0.22)`).
  - Ambient edge glow: diffuse turquoise perimeter glow (`0 0 20px -2px rgba(0, 184, 204, 0.15)`).
  - Neon accents: glowing cyan/turquoise badges, status indicators, and lightsaber beam.

### Light Mode Taste: "Soft Calm Clay & Light Play UI" (Skeuomorphic Blue Ramp)
- **Vibe & Mood**: Tactile, organic, calm, premium porcelain/clay extrusion with directional ambient lighting and physical depth.
- **Color Palette**: STRICTLY Skeuomorphic Blue ramp (`#2196f3`, `var(--primary-500)`, `var(--primary-600)`, `var(--primary-900)`). **NEVER turquoise in light mode.**
- **Materiality & Surfaces**:
  - Opaque-matte porcelain/clay surfaces (`rgba(244, 248, 252, 0.94)` or `#ffffff`).
  - Tactile depth via dual diffused shadows: soft ambient spread (`0 12px 30px -6px rgba(33, 150, 243, 0.18)`) + close contact shadow (`0 4px 12px rgba(0, 0, 0, 0.05)`).
  - Light Play inner bevels: top inner highlight catching an overhead light source (`inset 0 2px 1px rgba(255, 255, 255, 0.95)`) and bottom ambient shadow rim (`inset 0 -2px 1px rgba(33, 150, 243, 0.10)`).
  - Pill buttons and cards feel physically pressable and extruded, rather than flat or harsh.
