'use strict';

/*
 * FoodLab Studio — stacked/pie friendly-wide import hotfix
 *
 * Scope is deliberately narrow: only gallery composition charts (stacked/pie)
 * are touched, and only when imported rows have Group but are missing Component.
 * Other chart types, statistics, styles and rendering code are left unchanged.
 */
(() => {
  if (typeof state === 'undefined' || typeof analyzeGalleryData !== 'function') return;

  const originalAnalyzeGalleryData = analyzeGalleryData;

  analyzeGalleryData = function patchedCompositionAnalyzeGalleryData() {
    try {
      const type = state.workflow?.mode === 'gallery'
        ? state.workflow.chartType
        : state.gallery?.type;

      if ((type === 'stacked' || type === 'pie') && Array.isArray(state.gallery?.rows)) {
        state.gallery.rows = state.gallery.rows.map(row => {
          if (!row || (row.Component !== undefined && String(row.Component).trim() !== '')) return row;

          const component = row.Group === undefined || row.Group === null
            ? ''
            : String(row.Group).trim();

          if (!component) return row;

          // Friendly wide-table import currently emits {Category, Group, Value},
          // while the composition renderer expects {Category, Component, Value}.
          // Normalize only that mismatched shape.
          return {
            Category: row.Category,
            Component: component,
            Value: row.Value
          };
        });
      }
    } catch (_) {
      // Keep the original analysis path untouched if the guard itself ever fails.
    }

    return originalAnalyzeGalleryData.apply(this, arguments);
  };
})();
