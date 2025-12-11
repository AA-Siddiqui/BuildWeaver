import '@testing-library/jest-dom';

jest.mock('@measured/puck', () => ({
	Puck: () => null,
	usePuck: () => ({ selectedItem: null })
}));

if (typeof window !== 'undefined') {
	if (!window.requestAnimationFrame) {
		window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 16);
	}
	if (!window.cancelAnimationFrame) {
		window.cancelAnimationFrame = (id) => window.clearTimeout(id);
	}
}
