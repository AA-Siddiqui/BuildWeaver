import { mergeSectionBackgrounds } from './builder-config';

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
