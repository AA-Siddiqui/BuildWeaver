import { getListOperationInputs } from './listOperationConfig';

describe('list operation config', () => {
  it('provides three inputs for slice operations', () => {
    const inputs = getListOperationInputs('slice');
    expect(inputs.map((input) => input.role)).toEqual(['primary', 'start', 'end']);
  });

  it('limits unique operations to the primary input', () => {
    const inputs = getListOperationInputs('unique');
    expect(inputs.map((input) => input.role)).toEqual(['primary']);
  });

  it('maps sort operation to list plus order inputs', () => {
    const inputs = getListOperationInputs('sort');
    expect(inputs.map((input) => input.role)).toEqual(['primary', 'order']);
  });
});
