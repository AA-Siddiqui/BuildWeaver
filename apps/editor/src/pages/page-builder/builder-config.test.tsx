import { render, screen } from '@testing-library/react';
import { createPageBuilderConfig, mergeSectionBackgrounds } from './builder-config';

describe('mergeSectionBackgrounds', () => {
  const gradient = 'linear-gradient(45deg, #111827 0%, #F9E7B2 100%)';
  const backgroundUrl = 'https://cdn.example.com/background.png';
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it('preserves gradient-only backgrounds when no image is provided', () => {
    const merged = mergeSectionBackgrounds({ backgroundImage: gradient }, undefined, 'section-gradient');
    expect(merged.backgroundImage).toBe(gradient);
    expect(merged.backgroundSize).toBeUndefined();
    expect(merged.backgroundPosition).toBeUndefined();
  });

  it('layers gradients above background images with sensible sizing', () => {
    const merged = mergeSectionBackgrounds({ backgroundImage: gradient }, backgroundUrl, 'section-layered');
    expect(merged.backgroundImage).toBe(`${gradient}, url(${backgroundUrl})`);
    expect(merged.backgroundSize).toBe('auto, cover');
    expect(merged.backgroundPosition).toBe('0% 0%, center');
  });

  it('applies image-only backgrounds when no gradient is present', () => {
    const merged = mergeSectionBackgrounds({}, backgroundUrl, 'section-image');
    expect(merged.backgroundImage).toBe(`url(${backgroundUrl})`);
    expect(merged.backgroundSize).toBe('cover');
    expect(merged.backgroundPosition).toBe('center');
  });
});

describe('Heading component rendering', () => {
  it('respects fully transparent background colors inside sections', () => {
    const config = createPageBuilderConfig({
      bindingOptions: [],
      resolveBinding: (text) => text ?? ''
    });
    const heading = config.components?.Heading;
    if (!heading?.render) {
      throw new Error('Heading component is not registered');
    }
    render(
      <>
        {heading.render({
          id: 'heading-transparent',
          content: 'Transparent heading',
          backgroundColor: 'rgba(255, 255, 255, 0)'
        } as unknown as Parameters<NonNullable<typeof heading.render>>[0])}
      </>
    );
    expect(screen.getByText('Transparent heading')).toHaveStyle({ backgroundColor: 'transparent' });
  });

  it('does not render when renderWhen resolves false', () => {
    const config = createPageBuilderConfig({
      bindingOptions: [],
      resolveBinding: (text) => text ?? ''
    });
    const heading = config.components?.Heading;
    if (!heading?.render) {
      throw new Error('Heading component is not registered');
    }
    render(
      <>
        {heading.render({
          id: 'heading-hidden',
          content: 'Hidden heading',
          renderWhen: 'false'
        } as unknown as Parameters<NonNullable<typeof heading.render>>[0])}
      </>
    );
    expect(screen.queryByText('Hidden heading')).not.toBeInTheDocument();
  });
});

describe('Conditional component', () => {
  const config = createPageBuilderConfig({
    bindingOptions: [],
    resolveBinding: (text) => text ?? ''
  });
  const conditional = config.components?.Conditional;
  const helperText = 'Provide or bind to a string that matches one of the defined case keys (e.g., "primary-view").';

  if (!conditional?.render) {
    throw new Error('Conditional component is not registered');
  }

  const slotFactory = (testId: string, label: string) => ({ className }: { className?: string }) => (
    <div data-testid={testId} className={className}>
      {label}
    </div>
  );

  it('renders the case whose key matches the provided string', () => {
    render(
      <>
        {conditional.render({
          id: 'conditional-test',
          activeCaseKey: 'secondary',
          cases: [
            { caseKey: 'primary', label: 'Primary view', slot: slotFactory('slot-primary', 'Primary') },
            { caseKey: 'secondary', label: 'Secondary view', slot: slotFactory('slot-secondary', 'Secondary') },
            { caseKey: 'tertiary', label: 'Tertiary view', slot: slotFactory('slot-tertiary', 'Tertiary') }
          ]
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByTestId('slot-secondary')).toBeInTheDocument();
    expect(screen.queryByTestId('slot-primary')).not.toBeInTheDocument();
  });

  it('falls back to the first case when the key is missing', () => {
    render(
      <>
        {conditional.render({
          id: 'conditional-test-fallback',
          activeCaseKey: 'unknown-value',
          cases: [
            { caseKey: 'alpha', label: 'Alpha view', slot: slotFactory('slot-alpha', 'Alpha') },
            { caseKey: 'beta', label: 'Beta view', slot: slotFactory('slot-beta', 'Beta') }
          ]
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByTestId('slot-alpha')).toBeInTheDocument();
    expect(screen.queryByTestId('slot-beta')).not.toBeInTheDocument();
  });

  it('hides helper UI when the active case slot has content', () => {
    render(
      <>
        {conditional.render({
          id: 'conditional-hide-helper',
          activeCaseKey: 'primary',
          cases: [{ caseKey: 'primary', label: 'Primary view', slot: slotFactory('slot-hide-helper', 'Rendered slot') }]
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByTestId('slot-hide-helper')).toBeInTheDocument();
    expect(screen.queryByText('Conditional render')).not.toBeInTheDocument();
    expect(screen.queryByText(helperText)).not.toBeInTheDocument();
  });

  it('shows helper UI when no slot content exists', () => {
    render(
      <>
        {conditional.render({
          id: 'conditional-show-helper',
          activeCaseKey: 'primary',
          cases: [{ caseKey: 'primary', label: 'Primary view' }]
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByText('Conditional render')).toBeInTheDocument();
    expect(screen.getByText(helperText)).toBeInTheDocument();
  });
});
