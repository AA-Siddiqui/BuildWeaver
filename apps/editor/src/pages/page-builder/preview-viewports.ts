export type BuilderPreviewViewport = 'desktop' | 'tablet' | 'mobile';

export type ViewportPreset = {
  label: string;
  width: number;
  height: number;
  description: string;
};

export const PREVIEW_VIEWPORTS: Record<BuilderPreviewViewport, ViewportPreset> = {
  desktop: {
    label: 'Desktop',
    width: 1440,
    height: 900,
    description: 'Represents large displays and laptops'
  },
  tablet: {
    label: 'Tablet',
    width: 834,
    height: 1112,
    description: 'Represents portrait tablets'
  },
  mobile: {
    label: 'Mobile',
    width: 390,
    height: 844,
    description: 'Represents modern mobile devices'
  }
};
