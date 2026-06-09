---
name: Standard Critical
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#424654'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#737786'
  outline-variant: '#c2c6d7'
  surface-tint: '#0056d0'
  primary: '#0055cd'
  on-primary: '#ffffff'
  primary-container: '#276ef1'
  on-primary-container: '#fffeff'
  inverse-primary: '#b1c5ff'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2e2e2'
  on-secondary-container: '#646464'
  tertiary: '#9e3f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c65100'
  on-tertiary-container: '#fffdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2ff'
  primary-fixed-dim: '#b1c5ff'
  on-primary-fixed: '#001947'
  on-primary-fixed-variant: '#00419f'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c6'
  on-secondary-fixed: '#1b1b1b'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb694'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  hp-danger: '#E11900'
  success-active: '#05A357'
  gm-amber: '#FFC043'
  surface-subtle: '#F6F6F6'
  border-low-contrast: '#E2E2E2'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 44px
    fontWeight: '800'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-bold:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  stat-number:
    fontFamily: Hanken Grotesk
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 40px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system bridges the utilitarian, high-efficiency aesthetic of modern logistics with the complex data-management needs of a Dungeons & Dragons campaign. The brand personality is **Systematic, Authoritative, and Clear**. It treats campaign management as a high-stakes coordination task, stripping away traditional fantasy "parchment and ink" tropes in favor of a **Corporate Modern** style that prioritizes readability and rapid data entry. 

The UI uses a high-contrast foundation to ensure visibility in low-light gaming environments, emphasizing a "Mobile-First" utility where every stat and modifier is instantly legible.

## Colors
This design system utilizes a stark, high-contrast palette. 
- **Core Palette:** Primary interactions use **Uber Blue (#276EF1)**. Backgrounds are primarily white with pure black text to maximize the "Standard" aesthetic.
- **Semantic Mapping:** 
    - **Red (#E11900):** Strictly reserved for HP depletion, failed saving throws, and critical monster threats.
    - **Green (#05A357):** Used for active status effects, successful checks, and "Ready" states.
    - **Amber (#FFC043):** Specifically for Game Master (GM) eyes-only notes and high-priority encounter alerts.
- **Utility:** Use high-contrast neutrals for borders to maintain a "flat" but structured look.

## Typography
The system uses **Hanken Grotesk** as a high-fidelity proxy for Uber Move. It provides the necessary geometric clarity for a data-heavy application. 
- **Hierarchy:** Use extreme weight contrast (800 for stats, 400 for descriptions) to help users scan character sheets quickly.
- **Stat Numbers:** Large, bold numerical values are the focal point for dice rolls and modifiers.
- **Labels:** Use uppercase for labels (e.g., "STRENGTH", "DEXTERITY") with slight letter spacing to differentiate them from body content.

## Layout & Spacing
A strict **4px/8px grid** governs all components. The layout is mobile-first, utilizing a fluid 4-column grid on phones and expanding to a 12-column grid on tablets/desktops.
- **Density:** Spacing should feel "tight but breathable"—use 8px between related items (like a modifier and its label) and 24px between distinct sections (like Combat vs. Inventory).
- **Safe Zones:** Ensure a minimum 16px margin on the edges of mobile devices to prevent interaction fatigue.

## Elevation & Depth
Depth is created primarily through **Tonal Layers** and extremely **Subtle Shadows**. 
- **Surfaces:** Use `#FFFFFF` for the primary background and `#F6F6F6` for container backgrounds (cards, input wells).
- **Shadows:** Avoid heavy drops. Use a single "Level 1" shadow (0px 2px 4px rgba(0,0,0,0.05)) only for floating action buttons or active cards.
- **Flat Borders:** Use 1px solid borders (`#E2E2E2`) to define structural boundaries without relying on shadows, maintaining the clean "Base Web" aesthetic.

## Shapes
Shapes are disciplined and modern. While the system is "Flat," it uses **Rounded (8px-12px)** corners to soften the density of information and make the interface feel approachable. 
- **Buttons & Inputs:** Standardize on 8px (0.5rem) for a crisp, professional look.
- **Selection Chips:** Use 12px or fully pill-shaped radii for status tags to distinguish them from interactive buttons.

## Components
- **Buttons:** Prominent, full-width on mobile. Primary buttons use `#276EF1` with white text. No gradients.
- **Input Fields:** Flat design with a light gray fill (`#F6F6F6`) and a 1px bottom border that turns blue on focus. 
- **Cards:** White background, 1px border, 8px corner radius. Used for monster blocks and spell descriptions.
- **Chips:** Small tags for "Level," "Class," or "Concentration." Use high-contrast text on subtle backgrounds.
- **Lists:** Clean rows with 16px vertical padding, separated by 1px dividers.
- **Stat Blocks:** Highly structured units featuring the `stat-number` typography, centered with a label underneath.
- **D20 Action Button:** A specialized Floating Action Button (FAB) for the primary roll action, using the Primary Blue and a shadow for visibility.