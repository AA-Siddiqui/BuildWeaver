import '@testing-library/jest-dom';

if (typeof window !== 'undefined') {
	if (!window.requestAnimationFrame) {
		window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 16);
	}
	if (!window.cancelAnimationFrame) {
		window.cancelAnimationFrame = (id) => window.clearTimeout(id);
	}
}
