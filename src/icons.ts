/** Inline SVG icons that replace text glyphs (⌂ ✓ ▶ …). Same style as the top-bar icons: 24px viewBox, currentColor, stroke 2.4. */
function icon(paths: string, size = 22): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
export const icons = {
  home: icon('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/>'),
  check: icon('<path d="m5 12.5 4.5 4.5L19 7"/>'),
  book: icon('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>'),
  target: icon('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/>'),
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.2"/>'),
  star: icon('<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8l-5.3 2.8 1.1-5.8-4.3-4.1 5.9-.8z"/>'),
  gear: icon('<path d="M12 3.5 14 5l2.5-.3.8 2.4 2.2 1.2-.8 2.4.8 2.4-2.2 1.2-.8 2.4-2.5-.3-2 1.5-2-1.5-2.5.3-.8-2.4-2.2-1.2.8-2.4-.8-2.4 2.2-1.2.8-2.4L10 5z"/><circle cx="12" cy="11.2" r="2.6"/>'),
  play: icon('<path d="M7 4.5v15l12-7.5z"/>'),
  sparkle: icon('<path d="M12 3v18M3 12h18"/><path d="m6.5 6.5 11 11m0-11-11 11"/>'),
  reset: icon('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.5H9"/>'),
  download: icon('<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>'),
  rotateLeft: icon('<path d="M5 12a7 7 0 1 1 2 4.9"/><path d="M5 7.5V12h4.5"/>'),
  rotateRight: icon('<path d="M19 12a7 7 0 1 0-2 4.9"/><path d="M19 7.5V12h-4.5"/>'),
  arrowDownLeft: icon('<path d="M17 7 7 17"/><path d="M7 9.5V17h7.5"/>'),
  arrowDownRight: icon('<path d="m7 7 10 10"/><path d="M17 9.5V17H9.5"/>'),
  swap: icon('<path d="M4 8.5h14l-3.5-3.5"/><path d="M20 15.5H6l3.5 3.5"/>'),
  speech: icon('<path d="M4 5.5h16v10.5h-8.5L7 20v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  landscape: icon('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M12 15.5v.2"/>'),
};
