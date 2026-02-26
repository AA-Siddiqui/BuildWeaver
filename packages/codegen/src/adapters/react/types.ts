export interface PuckComponentData {
  type: string;
  props: Record<string, unknown> & { id?: string };
}

export interface PuckData {
  root: { id?: string; props: Record<string, unknown> };
  content: PuckComponentData[];
  zones?: Record<string, PuckComponentData[]>;
}

export interface DynamicBindingState {
  __bwDynamicBinding: true;
  bindingId: string;
  fallback?: string;
  propertyPath?: string[];
}

export interface PageDynamicInputInfo {
  id: string;
  label: string;
  dataType: string;
}

export interface ReactPageContext {
  pageName: string;
  pageSlug: string;
  componentName: string;
  puckData: PuckData;
  dynamicInputs: PageDynamicInputInfo[];
  hasDynamicBindings: boolean;
}
