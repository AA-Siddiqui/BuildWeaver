import type { ReactElement } from 'react';

export const NODE_DATA_ATTRIBUTE = 'data-bw-node';

const escapeNodeId = (value: string): string => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
};

export const attachNodeIdentity = (nodeId: string | undefined, attributes: Record<string, string>) => {
  if (!nodeId) {
    return attributes;
  }
  const next: Record<string, string> = { ...attributes, [NODE_DATA_ATTRIBUTE]: nodeId };
  if (!next.id) {
    next.id = nodeId;
  }
  return next;
};

export const renderScopedCss = (nodeId?: string, css?: string): ReactElement | null => {
  if (!nodeId) {
    return null;
  }
  const trimmed = css?.trim();
  if (!trimmed) {
    return null;
  }
  const scopedCss = `[${NODE_DATA_ATTRIBUTE}="${escapeNodeId(nodeId)}"] { ${trimmed} }`;
  return <style data-bw-custom-css="true" dangerouslySetInnerHTML={{ __html: scopedCss }} />;
};
