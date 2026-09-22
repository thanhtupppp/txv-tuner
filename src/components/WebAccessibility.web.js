import React from 'react';

export function WebAccessibility() {
  return <style>{`
    :focus-visible { outline: 3px solid #0076ba; outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) {
      * { animation: none !important; transition: none !important; }
    }
    @media (forced-colors: active) {
      div, input { background-color: Canvas !important; color: CanvasText !important;
        border-color: CanvasText !important; box-shadow: none !important; }
      [role="button"], [role="radio"], [role="tab"], input { border: 1px solid ButtonText !important; }
      [aria-checked="true"], [aria-selected="true"] { border: 3px solid Highlight !important; }
      :focus-visible { outline: 3px solid Highlight !important; }
      svg { forced-color-adjust: auto; }
      svg [fill^="url("] { fill: Canvas !important; }
      svg path, svg line { stroke: CanvasText !important; }
      svg text { fill: CanvasText !important; }
    }
  `}</style>;
}
