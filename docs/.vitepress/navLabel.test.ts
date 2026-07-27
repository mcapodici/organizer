// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { iconLabel, octocatSvg } from './navLabel';

describe('iconLabel', () => {
  it('wraps the icon and text in a .icon-label span', () => {
    expect(iconLabel(octocatSvg, 'Source')).toBe(
      `<span class="icon-label">${octocatSvg} Source</span>`,
    );
  });

  // The label used to carry `style="display:inline-flex;align-items:center"`,
  // which made the nav item sit ~3px above its neighbours (issue #9). The
  // alignment now belongs to theme/custom.css; an inline style here would
  // reintroduce the bug and silently win over the stylesheet.
  it('carries no inline styles', () => {
    expect(iconLabel(octocatSvg, 'Source')).not.toContain('style=');
  });

  // `.icon-label` sets its leading to the mark's height so the icon centres on
  // the text rather than on a row the icon itself made taller. Resizing the
  // mark here without following it there would put the octocat back off-centre.
  it('renders the mark at the 16px the stylesheet assumes', () => {
    expect(octocatSvg).toContain('width="16" height="16"');
  });
});

describe('.icon-label in theme/custom.css', () => {
  // The class name is a silent coupling between this module and the
  // stylesheet — VitePress renders the nav text through v-html, so a rename on
  // one side alone would fail invisibly at runtime.
  it('declares the alignment properties the helper depends on', () => {
    const css = readFileSync(new URL('./theme/custom.css', import.meta.url), 'utf8');
    const rule = css.match(/\.icon-label\s*\{([^}]*)\}/);

    expect(rule).not.toBeNull();
    // Baseline-aligning the text is what puts the group on the same line as the
    // plain-text nav items; centring it instead left "Source" ~1px low, which
    // read as "Open App" sitting slightly too high.
    expect(rule![1]).toContain('align-items: baseline');
    // Leading equal to the icon's own height, not `1`: at the nav's 14px the
    // shorter text box let the icon centre on a row it had inflated itself,
    // leaving the octocat 1.3px below the text's cap-height midpoint.
    expect(rule![1]).toContain('line-height: 16px');
  });

  // The SVG must opt out of that baseline alignment, otherwise it hangs off the
  // text baseline instead of sitting centred on the row — and, being the first
  // flex item, it would supply the synthesised baseline that caused issue #9.
  it('centres the icon rather than baseline-aligning it', () => {
    const css = readFileSync(new URL('./theme/custom.css', import.meta.url), 'utf8');
    const rule = css.match(/\.icon-label > svg\s*\{([^}]*)\}/);

    expect(rule).not.toBeNull();
    expect(rule![1]).toContain('align-self: center');
  });
});
