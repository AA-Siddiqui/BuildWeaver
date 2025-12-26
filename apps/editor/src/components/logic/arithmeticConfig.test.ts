import { ArithmeticOperand } from '@buildweaver/libs';
import { getArithmeticOperationConfig, normalizeArithmeticOperands } from './arithmeticConfig';

describe('arithmetic operation config', () => {
  it('limits modulo to two operands with descriptive labels', () => {
    const operands: ArithmeticOperand[] = [
      { id: 'a', label: 'One', sampleValue: 10 },
      { id: 'b', label: 'Two', sampleValue: 3 },
      { id: 'c', label: 'Three', sampleValue: 1 }
    ];

    const config = getArithmeticOperationConfig('modulo');
    const normalized = normalizeArithmeticOperands(operands, config, (index) => ({
      id: `generated-${index}`,
      label: `Generated ${index}`,
      sampleValue: 0
    }));

    expect(normalized).toHaveLength(2);
    expect(normalized[0].label).toBe('Dividend');
    expect(normalized[1].label).toBe('Divisor');
  });

  it('enforces base/exponent labels for exponent operation', () => {
    const operands: ArithmeticOperand[] = [{ id: 'only', label: 'Placeholder', sampleValue: 2 }];

    const config = getArithmeticOperationConfig('exponent');
    const normalized = normalizeArithmeticOperands(operands, config, (index) => ({
      id: `generated-${index}`,
      label: `Generated ${index}`,
      sampleValue: 0
    }));

    expect(normalized).toHaveLength(2);
    expect(normalized[0].label).toBe('Base');
    expect(normalized[1].label).toBe('Exponent');
  });
});
