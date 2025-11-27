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
    expect(inputs.map((input) => input.role)).toEqual(['primary', 'order', 'callback']);
  });

  it('requires callback for map operations', () => {
    const inputs = getListOperationInputs('map');
    expect(inputs.map((input) => input.role)).toEqual(['primary', 'callback']);
  });

  it('requires callback for filter operations', () => {
    const inputs = getListOperationInputs('filter');
    expect(inputs.map((input) => input.role)).toEqual(['primary', 'callback']);
  });

  it('requires callback and initial value for reduce operations', () => {
    const inputs = getListOperationInputs('reduce');
    expect(inputs.map((input) => input.role)).toEqual(['primary', 'callback', 'initial']);
  });
});
