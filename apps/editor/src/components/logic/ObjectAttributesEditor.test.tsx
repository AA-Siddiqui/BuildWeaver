import { fireEvent, render, screen } from '@testing-library/react';
import { ObjectAttributesEditor } from './ObjectAttributesEditor';

describe('ObjectAttributesEditor', () => {
  it('adds attributes and emits structured values', () => {
    const handleChange = jest.fn();

    render(
      <ObjectAttributesEditor
        nodeId="node-1"
        fieldKey="object.sample"
        onChange={handleChange}
      />
    );

    fireEvent.click(screen.getByText('Add attribute'));

    fireEvent.change(screen.getByLabelText('Attribute key'), {
      target: { value: 'status' }
    });

    fireEvent.change(screen.getByLabelText('Attribute string value'), {
      target: { value: 'ready' }
    });

    expect(handleChange).toHaveBeenLastCalledWith({ status: 'ready' });
  });

  it('supports nested object attributes', () => {
    const handleChange = jest.fn();
    render(
      <ObjectAttributesEditor
        nodeId="node-1"
        fieldKey="object.sample"
        value={{ meta: { version: '1.0.0' } }}
        onChange={handleChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Attribute string value'), {
      target: { value: '2.0.0' }
    });

    expect(handleChange).toHaveBeenLastCalledWith({
      meta: { version: '2.0.0' }
    });
  });

  it('applies full-width layout styles to avoid overlap', () => {
    render(
      <ObjectAttributesEditor
        nodeId="node-1"
        fieldKey="object.sample"
        onChange={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('Add attribute'));

    const keyInput = screen.getByLabelText('Attribute key');
    const typeSelect = screen.getByLabelText('Attribute type');
    const valueInput = screen.getByLabelText('Attribute string value');
    const row = screen.getByTestId('attribute-row');

    expect(keyInput.className).toMatch(/w-full/);
    expect(keyInput.className).toMatch(/min-w-0/);
    expect(typeSelect.className).toMatch(/w-full/);
    expect(valueInput.className).toMatch(/w-full/);
    expect(valueInput.className).toMatch(/min-w-0/);
    expect(row.className).toMatch(/flex-wrap/);
  });
});
