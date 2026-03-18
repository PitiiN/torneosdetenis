# Design System Document: The Court Editorial

## 1. Overview & Creative North Star
**Creative North Star: "The Kinetic Gallery"**
This design system moves away from the static, data-heavy "spreadsheet" feel of traditional sports management. Instead, it adopts a high-end editorial aesthetic that balances the explosive energy of a tennis match with the prestige of a Grand Slam tournament. 

We break the "template" look by utilizing **Intentional Asymmetry**. Actionable elements and data points are not just boxed; they are curated. By layering high-contrast typography against sophisticated neutral surfaces, we create a rhythmic flow that guides the eye through tournament brackets and player stats with the same precision as a cross-court winner.

## 2. Colors: Tonal Depth & Kinetic Energy
Our palette is designed to oscillate between the deep "Night Match" navy and the "High-Sun" energetic orange.

*   **Primary (#a83900) & Primary Container (#FF6B2B):** Used for "Peak Energy" moments—CTAs, active tournament status, and winning scores.
*   **Secondary (#485f83):** The "Quiet Professional." Used for utility actions and secondary navigation to keep the focus on the game.
*   **Surface Hierarchy (The No-Line Rule):** 
    *   **Prohibition:** 1px solid borders are strictly forbidden for sectioning. 
    *   **The Shift:** Define boundaries using background shifts. A `surface-container-low` (#f3f4f5) card should sit on a `surface` (#f8f9fa) background. 
    *   **The Glass & Gradient Rule:** For floating headers (like the tennis ball header), use Glassmorphism. Apply `surface-container-lowest` (#ffffff) at 70% opacity with a 12px backdrop blur. For primary CTAs, use a subtle linear gradient from `primary` to `primary_container` to add "soul" and dimension.

## 3. Typography: Editorial Authority
We pair the geometric strength of **Lexend** for headers with the high-legibility of **Inter** for data.

*   **Display (Lexend):** Used for tournament titles and set scores. The tight tracking and bold weight convey a sense of "Live" urgency.
*   **Headline (Lexend):** Used for section starts (e.g., "Upcoming Matches"). Use `headline-lg` (2rem) to create clear entry points.
*   **Body & Labels (Inter):** Used for player names and match details. We prioritize `body-md` (0.875rem) for tables to ensure high information density without visual clutter.
*   **Hierarchy Note:** Always contrast a `display-md` score with a `label-sm` "SET 1" tag to create a clear, professional information architecture.

## 4. Elevation & Depth: The Layering Principle
We convey importance through **Tonal Stacking** rather than traditional drop shadows.

*   **The Stacking Rule:** To elevate a "Live Match" card, place a `surface-container-lowest` (#ffffff) container on top of a `surface-container-high` (#e7e8e9) background. This creates a "lift" that feels integrated into the architecture.
*   **Ambient Shadows:** For floating action buttons or modal overlays, use a diffused shadow: `box-shadow: 0 12px 32px rgba(25, 28, 29, 0.06)`. Note the low opacity; it should feel like ambient light, not a dark glow.
*   **The "Ghost Border" Fallback:** If a player card requires a boundary against a similar tone, use `outline-variant` (#e2bfb3) at **15% opacity**. It should be felt, not seen.

## 5. Components: Refined Athletics

### Buttons & Chips
*   **Primary Button:** Uses the `primary_container` (#FF6B2B) with a `lg` (1rem) corner radius. Use `on_primary_container` (#5c1c00) for text to ensure high-contrast readability.
*   **Status Chips:** Use `secondary_container` (#bed6ff) for "Scheduled" and `tertiary_container` (#88a26b) for "Completed." All chips use the `full` (9999px) roundedness scale.

### Cards & Tables (The "No-Divider" Rule)
*   **Tournament Cards:** Forbid the use of divider lines. Use `spacing-6` (1.5rem) of vertical white space to separate match times from player names. 
*   **Professional Tables:** Use alternating row colors—`surface` and `surface-container-low`—to guide the eye horizontally. The header row should use `surface-dim` (#d9dadb) with `label-md` bold typography.

### Specialized Tennis Components
*   **The Tennis Ball Header:** This brand element should use a `surface-tint` backdrop-blur. The "ball" graphic should partially overlap the container edge (asymmetry) to create a sense of movement.
*   **Scoreboard Cells:** High-contrast containers using `on_surface` (#191c1d) backgrounds with `primary_container` text for the current server to denote active play.

## 6. Do's and Don'ts

### Do:
*   **Use Layered Surfaces:** Always nest a lighter surface inside a darker one to show hierarchy.
*   **Embrace Whitespace:** Use `spacing-8` (2rem) between major sections to let the editorial typography "breathe."
*   **Apply Intentional Asymmetry:** Let the tennis ball graphic or a player's action photo break the grid slightly to create a premium, custom feel.

### Don't:
*   **Don't use 1px Borders:** Never use a solid line to separate content. Use a `0.5px` ghost border at 10% opacity only if absolutely necessary for accessibility.
*   **Don't use "Pure" Black Shadows:** Always tint your shadows with the `on_surface` color to maintain a sophisticated tonal palette.
*   **Don't Crowded the Data:** In tables, if a row feels tight, increase the vertical padding to `spacing-4` (1rem). High-end design requires "luxurious" spacing.