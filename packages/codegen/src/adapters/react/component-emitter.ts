import type { PageDynamicInputInfo, PuckComponentData } from './types';
import { isDynamicBinding, resolveTextContent, generateBindingExpression } from './binding-resolver';
import { mapStylePropsToCss, extractStyleProps, cssObjectToInlineStyleAttr } from './style-mapper';

const LOG_PREFIX = '[Codegen:ComponentEmitter]';

const pad = (indent: number): string => ' '.repeat(indent);

const escapeJsx = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/{/g, '&#123;').replace(/}/g, '&#125;');

const escapeJsxText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/{/g, '&#123;').replace(/}/g, '&#125;');

const getZoneChildren = (
  componentId: string | undefined,
  slotName: string,
  zones: Record<string, PuckComponentData[]>
): PuckComponentData[] => {
  if (!componentId) {
    console.warn(`${LOG_PREFIX} getZoneChildren called with no componentId for slot "${slotName}"`);
    return [];
  }
  const key = `${componentId}:${slotName}`;
  const children = zones[key] ?? [];
  if (children.length > 0) {
    console.info(`${LOG_PREFIX} Zone "${key}" resolved ${children.length} child(ren)`);
  } else {
    console.info(`${LOG_PREFIX} Zone "${key}" is empty — no nested items found for this slot`);
  }
  return children;
};

const emitStyleAttr = (props: Record<string, unknown>, extraCss?: Record<string, string>): string => {
  const css = mapStylePropsToCss(props);
  if (extraCss) {
    Object.assign(css, extraCss);
  }
  const attr = cssObjectToInlineStyleAttr(css);
  return attr;
};

const emitChildren = (
  children: PuckComponentData[],
  zones: Record<string, PuckComponentData[]>,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  if (children.length === 0) return '';
  return children
    .map((child) => emitComponent(child, zones, dynamicInputs, indent))
    .join('\n');
};

const emitTextNode = (
  value: unknown,
  dynamicInputs: PageDynamicInputInfo[]
): string => {
  const resolved = resolveTextContent(value, dynamicInputs);
  if (resolved.isExpression) {
    return `{${resolved.text}}`;
  }
  return escapeJsxText(resolved.text);
};

const emitCustomCss = (props: Record<string, unknown>, indent: number): string => {
  const customCss = props.customCss;
  if (typeof customCss !== 'string' || !customCss.trim()) return '';
  const nodeId = props.id as string | undefined;
  if (!nodeId) return '';
  const p = pad(indent);
  const escaped = customCss.trim().replace(/`/g, '\\`').replace(/\$/g, '\\$');
  return `\n${p}<style dangerouslySetInnerHTML={{ __html: \`[data-bw-node="${nodeId}"] { ${escaped} }\` }} />`;
};

const emitDataAttrs = (props: Record<string, unknown>): string => {
  const nodeId = props.id as string | undefined;
  return nodeId ? ` data-bw-node="${nodeId}"` : '';
};

const emitSection = (
  component: PuckComponentData,
  zones: Record<string, PuckComponentData[]>,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const styleAttr = emitStyleAttr(component.props, { display: 'flex', flexDirection: 'column', gap: '0.75rem' });
  const dataAttrs = emitDataAttrs(component.props);

  const componentId = component.props.id as string | undefined;
  const slotChildren = getZoneChildren(componentId, 'contentSlot', zones);

  const lines: string[] = [];
  lines.push(`${p}<section${dataAttrs} ${styleAttr}>`);

  const bgImage = contentProps.backgroundImage;
  if (bgImage) {
    const bgResolved = resolveTextContent(bgImage, dynamicInputs);
    if (bgResolved.isExpression) {
      lines.push(`${p}  {${bgResolved.text} && (`);
      lines.push(`${p}    <div style={{ position: "absolute", inset: 0, backgroundImage: \`url(\${${bgResolved.text}})\`, backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />`);
      lines.push(`${p}  )}`);
    } else if (bgResolved.text) {
      lines.push(`${p}  <div style={{ position: "absolute", inset: 0, backgroundImage: "url(${bgResolved.text})", backgroundSize: "cover", backgroundPosition: "center", zIndex: 0 }} />`);
    }
  }

  const eyebrow = contentProps.eyebrow;
  if (eyebrow !== undefined && eyebrow !== '') {
    const resolved = resolveTextContent(eyebrow, dynamicInputs);
    if (resolved.isExpression) {
      lines.push(`${p}  {${resolved.text} && <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7 }}>{${resolved.text}}</span>}`);
    } else if (resolved.text) {
      lines.push(`${p}  <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.7 }}>${escapeJsxText(resolved.text)}</span>`);
    }
  }

  const heading = contentProps.heading;
  if (heading !== undefined && heading !== '') {
    const resolved = resolveTextContent(heading, dynamicInputs);
    if (resolved.isExpression) {
      lines.push(`${p}  {${resolved.text} && <h2 style={{ fontSize: "1.875rem", fontWeight: 600 }}>{${resolved.text}}</h2>}`);
    } else if (resolved.text) {
      lines.push(`${p}  <h2 style={{ fontSize: "1.875rem", fontWeight: 600 }}>${escapeJsxText(resolved.text)}</h2>`);
    }
  }

  const subheading = contentProps.subheading;
  if (subheading !== undefined && subheading !== '') {
    const resolved = resolveTextContent(subheading, dynamicInputs);
    if (resolved.isExpression) {
      lines.push(`${p}  {${resolved.text} && <p style={{ opacity: 0.8 }}>{${resolved.text}}</p>}`);
    } else if (resolved.text) {
      lines.push(`${p}  <p style={{ opacity: 0.8 }}>${escapeJsxText(resolved.text)}</p>`);
    }
  }

  const description = contentProps.description;
  if (description !== undefined && description !== '') {
    const resolved = resolveTextContent(description, dynamicInputs);
    if (resolved.isExpression) {
      lines.push(`${p}  {${resolved.text} && <p>{${resolved.text}}</p>}`);
    } else if (resolved.text) {
      lines.push(`${p}  <p>${escapeJsxText(resolved.text)}</p>`);
    }
  }

  if (slotChildren.length > 0) {
    lines.push(`${p}  <div>`);
    lines.push(emitChildren(slotChildren, zones, dynamicInputs, indent + 4));
    lines.push(`${p}  </div>`);
  }

  lines.push(`${p}</section>`);
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const COLUMN_LAYOUT_MAP: Record<string, string> = {
  equal: '1fr 1fr',
  wideLeft: '3fr 2fr',
  wideRight: '2fr 3fr'
};

const STACK_CLASS_MAP: Record<string, string> = {
  md: 'bw-stack-md',
  lg: 'bw-stack-lg'
};

const emitColumns = (
  component: PuckComponentData,
  zones: Record<string, PuckComponentData[]>,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const dataAttrs = emitDataAttrs(component.props);
  const componentId = component.props.id as string | undefined;

  const layoutValue = isDynamicBinding(contentProps.layout)
    ? (contentProps.layout as { fallback?: string }).fallback ?? 'equal'
    : (typeof contentProps.layout === 'string' ? contentProps.layout : 'equal');

  const stackValue = isDynamicBinding(contentProps.stackAt)
    ? (contentProps.stackAt as { fallback?: string }).fallback ?? 'md'
    : (typeof contentProps.stackAt === 'string' ? contentProps.stackAt : 'md');

  const gridCols = COLUMN_LAYOUT_MAP[layoutValue] ?? '1fr 1fr';
  const stackClass = STACK_CLASS_MAP[stackValue] ?? '';

  const baseCss = mapStylePropsToCss(component.props);
  baseCss['display'] = 'grid';
  baseCss['gridTemplateColumns'] = gridCols;
  if (!baseCss['gap']) baseCss['gap'] = '1.5rem';
  const styleAttr = cssObjectToInlineStyleAttr(baseCss);
  const classAttr = stackClass ? ` className="${stackClass}"` : '';

  const leftChildren = getZoneChildren(componentId, 'left', zones);
  const rightChildren = getZoneChildren(componentId, 'right', zones);

  const lines: string[] = [];
  lines.push(`${p}<div${dataAttrs}${classAttr} ${styleAttr}>`);
  lines.push(`${p}  <div>`);
  if (leftChildren.length > 0) {
    lines.push(emitChildren(leftChildren, zones, dynamicInputs, indent + 4));
  }
  lines.push(`${p}  </div>`);
  lines.push(`${p}  <div>`);
  if (rightChildren.length > 0) {
    lines.push(emitChildren(rightChildren, zones, dynamicInputs, indent + 4));
  }
  lines.push(`${p}  </div>`);
  lines.push(`${p}</div>`);
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const emitHeading = (
  component: PuckComponentData,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const styleAttr = emitStyleAttr(component.props);
  const dataAttrs = emitDataAttrs(component.props);

  const sizeValue = isDynamicBinding(contentProps.size)
    ? (contentProps.size as { fallback?: string }).fallback ?? 'h2'
    : (typeof contentProps.size === 'string' ? contentProps.size : 'h2');

  const tag = ['h1', 'h2', 'h3', 'h4'].includes(sizeValue) ? sizeValue : 'h2';
  const content = emitTextNode(contentProps.content, dynamicInputs);

  const lines: string[] = [];
  lines.push(`${p}<${tag}${dataAttrs} ${styleAttr}>${content}</${tag}>`);
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const emitParagraph = (
  component: PuckComponentData,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const baseCss = mapStylePropsToCss(component.props);
  if (!baseCss['fontSize']) baseCss['fontSize'] = '1rem';
  if (!baseCss['lineHeight']) baseCss['lineHeight'] = '1.6';
  const styleAttr = cssObjectToInlineStyleAttr(baseCss);
  const dataAttrs = emitDataAttrs(component.props);

  const content = emitTextNode(contentProps.content, dynamicInputs);

  const lines: string[] = [];
  lines.push(`${p}<p${dataAttrs} ${styleAttr}>${content}</p>`);
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const BUTTON_VARIANT_CSS: Record<string, Record<string, string>> = {
  primary: {
    background: '#DDC57A',
    color: '#1a1a2e',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
    border: 'none',
    padding: '0.625rem 1.25rem',
    borderRadius: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block'
  },
  ghost: {
    border: '1px solid #d1d5db',
    background: 'transparent',
    color: '#1f2937',
    padding: '0.625rem 1.25rem',
    borderRadius: '0.75rem',
    fontWeight: '600',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block'
  },
  link: {
    background: 'transparent',
    color: '#DDC57A',
    textDecoration: 'underline',
    border: 'none',
    padding: '0',
    cursor: 'pointer',
    fontWeight: '600',
    display: 'inline'
  }
};

const emitButton = (
  component: PuckComponentData,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const dataAttrs = emitDataAttrs(component.props);

  const variantValue = isDynamicBinding(contentProps.variant)
    ? (contentProps.variant as { fallback?: string }).fallback ?? 'primary'
    : (typeof contentProps.variant === 'string' ? contentProps.variant : 'primary');

  const variantCss = BUTTON_VARIANT_CSS[variantValue] ?? BUTTON_VARIANT_CSS['primary'];
  const userCss = mapStylePropsToCss(component.props);
  const mergedCss = { ...variantCss, ...userCss };
  const styleAttr = cssObjectToInlineStyleAttr(mergedCss);

  const label = emitTextNode(contentProps.label, dynamicInputs);

  const hrefResolved = resolveTextContent(contentProps.href, dynamicInputs);
  const hasHref = hrefResolved.text !== '';

  const lines: string[] = [];
  if (hasHref) {
    if (hrefResolved.isExpression) {
      lines.push(`${p}<a${dataAttrs} href={${hrefResolved.text}} ${styleAttr}>${label}</a>`);
    } else {
      lines.push(`${p}<a${dataAttrs} href="${escapeJsx(hrefResolved.text)}" ${styleAttr}>${label}</a>`);
    }
  } else {
    lines.push(`${p}<button${dataAttrs} type="button" ${styleAttr}>${label}</button>`);
  }
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const emitImage = (
  component: PuckComponentData,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const baseCss = mapStylePropsToCss(component.props);
  baseCss['borderRadius'] = baseCss['borderRadius'] || '0.75rem';
  baseCss['overflow'] = 'hidden';
  const figureStyleAttr = cssObjectToInlineStyleAttr(baseCss);
  const dataAttrs = emitDataAttrs(component.props);

  const srcResolved = resolveTextContent(contentProps.src, dynamicInputs);
  const altResolved = resolveTextContent(contentProps.alt, dynamicInputs);
  const captionResolved = resolveTextContent(contentProps.caption, dynamicInputs);

  const objectFitValue = isDynamicBinding(contentProps.objectFit)
    ? (contentProps.objectFit as { fallback?: string }).fallback ?? 'cover'
    : (typeof contentProps.objectFit === 'string' ? contentProps.objectFit : 'cover');

  const aspectRatioValue = isDynamicBinding(contentProps.aspectRatio)
    ? (contentProps.aspectRatio as { fallback?: string }).fallback ?? ''
    : (typeof contentProps.aspectRatio === 'string' ? contentProps.aspectRatio : '');

  const imgCss: Record<string, string> = {
    width: '100%',
    display: 'block',
    objectFit: objectFitValue
  };
  if (aspectRatioValue) {
    imgCss['aspectRatio'] = aspectRatioValue;
  }
  const imgStyleAttr = cssObjectToInlineStyleAttr(imgCss);

  const srcAttr = srcResolved.isExpression
    ? `src={${srcResolved.text}}`
    : `src="${escapeJsx(srcResolved.text || 'https://placehold.co/800x500')}"`;

  const altAttr = altResolved.isExpression
    ? `alt={${altResolved.text} ?? ""}`
    : `alt="${escapeJsx(altResolved.text)}"`;

  const lines: string[] = [];
  lines.push(`${p}<figure${dataAttrs} ${figureStyleAttr}>`);
  lines.push(`${p}  <img ${srcAttr} ${altAttr} ${imgStyleAttr} />`);

  if (captionResolved.text) {
    if (captionResolved.isExpression) {
      lines.push(`${p}  {${captionResolved.text} && <figcaption style={{ fontSize: "0.875rem", opacity: 0.7, marginTop: "0.5rem" }}>{${captionResolved.text}}</figcaption>}`);
    } else {
      lines.push(`${p}  <figcaption style={{ fontSize: "0.875rem", opacity: 0.7, marginTop: "0.5rem" }}>${escapeJsxText(captionResolved.text)}</figcaption>`);
    }
  }

  lines.push(`${p}</figure>`);
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const emitCard = (
  component: PuckComponentData,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const baseCss = mapStylePropsToCss(component.props);
  baseCss['display'] = baseCss['display'] || 'flex';
  baseCss['flexDirection'] = baseCss['flexDirection'] || 'column';
  baseCss['borderRadius'] = baseCss['borderRadius'] || '0.75rem';
  baseCss['overflow'] = 'hidden';
  if (!baseCss['borderWidth']) {
    baseCss['borderWidth'] = '1px';
    baseCss['borderStyle'] = 'solid';
    baseCss['borderColor'] = baseCss['borderColor'] || '#e5e7eb';
  }
  const styleAttr = cssObjectToInlineStyleAttr(baseCss);
  const dataAttrs = emitDataAttrs(component.props);

  const imageUrl = resolveTextContent(contentProps.imageUrl, dynamicInputs);
  const eyebrow = resolveTextContent(contentProps.eyebrow, dynamicInputs);
  const heading = resolveTextContent(contentProps.heading, dynamicInputs);
  const content = resolveTextContent(contentProps.content, dynamicInputs);
  const actionLabel = resolveTextContent(contentProps.actionLabel, dynamicInputs);
  const actionHref = resolveTextContent(contentProps.actionHref, dynamicInputs);

  const lines: string[] = [];
  lines.push(`${p}<article${dataAttrs} ${styleAttr}>`);

  if (imageUrl.text) {
    const imgSrc = imageUrl.isExpression ? `{${imageUrl.text}}` : `"${escapeJsx(imageUrl.text)}"`;
    lines.push(`${p}  <img src=${imgSrc} alt="" style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "16 / 9" }} />`);
  }

  lines.push(`${p}  <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>`);

  if (eyebrow.text) {
    if (eyebrow.isExpression) {
      lines.push(`${p}    {${eyebrow.text} && <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>{${eyebrow.text}}</span>}`);
    } else {
      lines.push(`${p}    <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.6 }}>${escapeJsxText(eyebrow.text)}</span>`);
    }
  }

  if (heading.text) {
    if (heading.isExpression) {
      lines.push(`${p}    {${heading.text} && <h3 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{${heading.text}}</h3>}`);
    } else {
      lines.push(`${p}    <h3 style={{ fontSize: "1.25rem", fontWeight: 600 }}>${escapeJsxText(heading.text)}</h3>`);
    }
  }

  if (content.text) {
    if (content.isExpression) {
      lines.push(`${p}    {${content.text} && <p style={{ fontSize: "0.875rem", opacity: 0.8 }}>{${content.text}}</p>}`);
    } else {
      lines.push(`${p}    <p style={{ fontSize: "0.875rem", opacity: 0.8 }}>${escapeJsxText(content.text)}</p>`);
    }
  }

  if (actionLabel.text && actionHref.text) {
    const hrefVal = actionHref.isExpression ? `{${actionHref.text}}` : `"${escapeJsx(actionHref.text)}"`;
    const labelVal = actionLabel.isExpression ? `{${actionLabel.text}}` : escapeJsxText(actionLabel.text);
    lines.push(`${p}    <a href=${hrefVal} style={{ color: "#DDC57A", fontWeight: 600, fontSize: "0.875rem" }}>${labelVal}</a>`);
  }

  lines.push(`${p}  </div>`);
  lines.push(`${p}</article>`);
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const emitList = (
  component: PuckComponentData,
  zones: Record<string, PuckComponentData[]>,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const styleAttr = emitStyleAttr(component.props);
  const dataAttrs = emitDataAttrs(component.props);
  const componentId = component.props.id as string | undefined;

  const variantValue = isDynamicBinding(contentProps.variant)
    ? (contentProps.variant as { fallback?: string }).fallback ?? 'bullet'
    : (typeof contentProps.variant === 'string' ? contentProps.variant : 'bullet');

  const renderMode = isDynamicBinding(contentProps.renderMode)
    ? (contentProps.renderMode as { fallback?: string }).fallback ?? 'builtIn'
    : (typeof contentProps.renderMode === 'string' ? contentProps.renderMode : 'builtIn');

  const dataSource = contentProps.dataSource;
  const hasDataSource = isDynamicBinding(dataSource);

  const items = Array.isArray(contentProps.items) ? contentProps.items as Array<Record<string, unknown>> : [];

  if (renderMode === 'custom' && hasDataSource) {
    const bindingExpr = generateBindingExpression(dataSource as { __bwDynamicBinding: true; bindingId: string; fallback?: string; propertyPath?: string[] }, dynamicInputs);
    const slotChildren = getZoneChildren(componentId, 'customItemSlot', zones);

    const lines: string[] = [];
    lines.push(`${p}<div${dataAttrs} ${styleAttr}>`);
    lines.push(`${p}  {(${bindingExpr} ?? []).map((item: Record<string, unknown>, index: number) => (`);
    lines.push(`${p}    <div key={index} style={{ marginBottom: "1rem" }}>`);
    if (slotChildren.length > 0) {
      lines.push(emitChildren(slotChildren, zones, dynamicInputs, indent + 6));
    } else {
      lines.push(`${p}      <span>{JSON.stringify(item)}</span>`);
    }
    lines.push(`${p}    </div>`);
    lines.push(`${p}  ))}`);
    lines.push(`${p}</div>`);
    lines.push(emitCustomCss(component.props, indent));
    return lines.filter(Boolean).join('\n');
  }

  const tag = variantValue === 'numbered' ? 'ol' : variantValue === 'bullet' ? 'ul' : 'div';
  const listStyleCss = tag === 'ul'
    ? 'listStyleType: "disc", paddingLeft: "1.5rem"'
    : tag === 'ol'
      ? 'listStyleType: "decimal", paddingLeft: "1.5rem"'
      : '';

  const lines: string[] = [];

  if (hasDataSource) {
    const bindingExpr = generateBindingExpression(dataSource as { __bwDynamicBinding: true; bindingId: string; fallback?: string; propertyPath?: string[] }, dynamicInputs);
    lines.push(`${p}<${tag}${dataAttrs} style={{ ${listStyleCss} }} ${styleAttr}>`);
    lines.push(`${p}  {(${bindingExpr} ?? []).map((item: unknown, index: number) => (`);
    if (tag === 'div') {
      lines.push(`${p}    <div key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</div>`);
    } else {
      lines.push(`${p}    <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>`);
    }
    lines.push(`${p}  ))}`);
    lines.push(`${p}</${tag}>`);
  } else {
    lines.push(`${p}<${tag}${dataAttrs} style={{ ${listStyleCss} }} ${styleAttr}>`);
    for (const item of items) {
      const text = resolveTextContent(item.text, dynamicInputs);
      const desc = resolveTextContent(item.description, dynamicInputs);
      if (tag === 'div') {
        lines.push(`${p}  <div>`);
        if (text.isExpression) {
          lines.push(`${p}    <span>{${text.text}}</span>`);
        } else if (text.text) {
          lines.push(`${p}    <span>${escapeJsxText(text.text)}</span>`);
        }
        if (desc.text) {
          if (desc.isExpression) {
            lines.push(`${p}    <span style={{ fontSize: "0.875rem", opacity: 0.7 }}>{${desc.text}}</span>`);
          } else {
            lines.push(`${p}    <span style={{ fontSize: "0.875rem", opacity: 0.7 }}>${escapeJsxText(desc.text)}</span>`);
          }
        }
        lines.push(`${p}  </div>`);
      } else {
        if (desc.text) {
          lines.push(`${p}  <li>`);
          const textVal = text.isExpression ? `{${text.text}}` : escapeJsxText(text.text);
          lines.push(`${p}    <span>${textVal}</span>`);
          const descVal = desc.isExpression ? `{${desc.text}}` : escapeJsxText(desc.text);
          lines.push(`${p}    <span style={{ fontSize: "0.875rem", opacity: 0.7, marginLeft: "0.5rem" }}>${descVal}</span>`);
          lines.push(`${p}  </li>`);
        } else {
          const textVal = text.isExpression ? `{${text.text}}` : escapeJsxText(text.text);
          lines.push(`${p}  <li>${textVal}</li>`);
        }
      }
    }
    lines.push(`${p}</${tag}>`);
  }

  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const emitDivider = (
  component: PuckComponentData,
  indent: number
): string => {
  const p = pad(indent);
  const baseCss = mapStylePropsToCss(component.props);
  baseCss['width'] = baseCss['width'] || '100%';
  baseCss['border'] = baseCss['border'] || 'none';
  baseCss['borderTop'] = baseCss['borderTop'] || '1px solid #e5e7eb';
  const styleAttr = cssObjectToInlineStyleAttr(baseCss);
  const dataAttrs = emitDataAttrs(component.props);

  const lines: string[] = [];
  lines.push(`${p}<hr${dataAttrs} ${styleAttr} />`);
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const emitSpacer = (
  component: PuckComponentData,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);

  const heightResolved = resolveTextContent(contentProps.height, dynamicInputs);
  const height = heightResolved.text || '48px';

  const baseCss = mapStylePropsToCss(component.props);
  baseCss['height'] = height;
  const styleAttr = cssObjectToInlineStyleAttr(baseCss);
  const dataAttrs = emitDataAttrs(component.props);

  return `${p}<div${dataAttrs} ${styleAttr} aria-hidden="true" />`;
};

const emitConditional = (
  component: PuckComponentData,
  zones: Record<string, PuckComponentData[]>,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  const p = pad(indent);
  const { contentProps } = extractStyleProps(component.props);
  const styleAttr = emitStyleAttr(component.props);
  const dataAttrs = emitDataAttrs(component.props);
  const componentId = component.props.id as string | undefined;

  const activeCaseKey = contentProps.activeCaseKey;
  const cases = Array.isArray(contentProps.cases)
    ? (contentProps.cases as Array<Record<string, unknown>>)
    : [];

  if (cases.length === 0) {
    return `${p}{/* Conditional: no cases defined */}`;
  }

  const activeCaseResolved = resolveTextContent(activeCaseKey, dynamicInputs);

  const lines: string[] = [];
  lines.push(`${p}<div${dataAttrs} ${styleAttr}>`);

  if (activeCaseResolved.isExpression) {
    lines.push(`${p}  {(() => {`);
    lines.push(`${p}    const activeCase = ${activeCaseResolved.text};`);
    for (let i = 0; i < cases.length; i++) {
      const caseKey = typeof cases[i].caseKey === 'string' ? cases[i].caseKey as string : `case-${i}`;
      const slotChildren = getZoneChildren(componentId, `cases-${i}-slot`, zones);
      const condition = i === 0 ? `if (activeCase === ${JSON.stringify(caseKey)})` : `else if (activeCase === ${JSON.stringify(caseKey)})`;
      lines.push(`${p}    ${condition} {`);
      lines.push(`${p}      return (`);
      lines.push(`${p}        <>`);
      if (slotChildren.length > 0) {
        lines.push(emitChildren(slotChildren, zones, dynamicInputs, indent + 10));
      }
      lines.push(`${p}        </>`);
      lines.push(`${p}      );`);
      lines.push(`${p}    }`);
    }
    lines.push(`${p}    return null;`);
    lines.push(`${p}  })()}`);
  } else {
    const activeKey = activeCaseResolved.text || (typeof cases[0]?.caseKey === 'string' ? cases[0].caseKey as string : 'primary');
    for (let i = 0; i < cases.length; i++) {
      const caseKey = typeof cases[i].caseKey === 'string' ? cases[i].caseKey as string : `case-${i}`;
      const slotChildren = getZoneChildren(componentId, `cases-${i}-slot`, zones);
      if (caseKey === activeKey) {
        if (slotChildren.length > 0) {
          lines.push(emitChildren(slotChildren, zones, dynamicInputs, indent + 2));
        } else {
          lines.push(`${p}  {/* Case "${caseKey}" (active, empty) */}`);
        }
        break;
      }
    }
  }

  lines.push(`${p}</div>`);
  lines.push(emitCustomCss(component.props, indent));
  return lines.filter(Boolean).join('\n');
};

const emitFallback = (
  component: PuckComponentData,
  indent: number
): string => {
  const p = pad(indent);
  const styleAttr = emitStyleAttr(component.props);
  const dataAttrs = emitDataAttrs(component.props);
  console.info(`${LOG_PREFIX} Unknown component type "${component.type}", emitting fallback div`);
  return `${p}<div${dataAttrs} ${styleAttr}>{/* Unknown component: ${component.type} */}</div>`;
};

export const emitComponent = (
  component: PuckComponentData,
  zones: Record<string, PuckComponentData[]>,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  console.info(`${LOG_PREFIX} Emitting component type="${component.type}" id="${component.props.id ?? 'unknown'}"`);

  switch (component.type) {
    case 'Section':
      return emitSection(component, zones, dynamicInputs, indent);
    case 'Columns':
      return emitColumns(component, zones, dynamicInputs, indent);
    case 'Heading':
      return emitHeading(component, dynamicInputs, indent);
    case 'Paragraph':
      return emitParagraph(component, dynamicInputs, indent);
    case 'Button':
      return emitButton(component, dynamicInputs, indent);
    case 'Image':
      return emitImage(component, dynamicInputs, indent);
    case 'Card':
      return emitCard(component, dynamicInputs, indent);
    case 'List':
      return emitList(component, zones, dynamicInputs, indent);
    case 'Divider':
      return emitDivider(component, indent);
    case 'Spacer':
      return emitSpacer(component, dynamicInputs, indent);
    case 'Conditional':
      return emitConditional(component, zones, dynamicInputs, indent);
    default:
      return emitFallback(component, indent);
  }
};

export const emitContentArray = (
  content: PuckComponentData[],
  zones: Record<string, PuckComponentData[]>,
  dynamicInputs: PageDynamicInputInfo[],
  indent: number
): string => {
  if (!content || content.length === 0) {
    console.info(`${LOG_PREFIX} No content components to emit`);
    return `${pad(indent)}{/* No components on this page */}`;
  }

  console.info(`${LOG_PREFIX} Emitting ${content.length} top-level component(s)`);
  return content
    .map((component) => emitComponent(component, zones, dynamicInputs, indent))
    .join('\n');
};
