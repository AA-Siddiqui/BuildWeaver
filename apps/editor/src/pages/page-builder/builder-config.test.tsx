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
  it('switches between Element A and Element B', () => {
    const config = createPageBuilderConfig({
      bindingOptions: [],
      resolveBinding: (text) => text ?? ''
    });
    const conditional = config.components?.Conditional;
    if (!conditional?.render) {
      throw new Error('Conditional component is not registered');
    }

    const slotA = ({ className }: { className?: string }) => (
      <div data-testid="slot-a" className={className}>
        Element A content
      </div>
    );
    const slotB = ({ className }: { className?: string }) => (
      <div data-testid="slot-b" className={className}>
        Element B content
      </div>
    );

    render(
      <>
        {conditional.render({
          id: 'conditional-test',
          activeElement: 'b',
          elementA: slotA,
          elementB: slotB
        } as unknown as Parameters<NonNullable<typeof conditional.render>>[0])}
      </>
    );

    expect(screen.getByTestId('slot-b')).toBeInTheDocument();
    expect(screen.queryByTestId('slot-a')).not.toBeInTheDocument();
  });
});
