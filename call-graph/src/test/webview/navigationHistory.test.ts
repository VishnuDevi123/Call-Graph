import * as assert from 'assert';
import { NavigationHistory } from '../../webview/NavigationHistory';

suite('panel graph navigation history', () => {
	test('records explicit node navigation and traverses backward and forward', () => {
		const history = new NavigationHistory();
		history.observeCurrentNode('first');

		assert.strictEqual(history.navigateTo('second'), 'second');
		assert.deepStrictEqual(history.state, { canGoBack: true, canGoForward: false });
		assert.strictEqual(history.back(), 'first');
		assert.deepStrictEqual(history.state, { canGoBack: false, canGoForward: true });
		assert.strictEqual(history.forward(), 'second');
		assert.deepStrictEqual(history.state, { canGoBack: true, canGoForward: false });
	});

	test('does not record automatic focus observations', () => {
		const history = new NavigationHistory();
		history.observeCurrentNode('first');
		history.observeCurrentNode('cursor-focus');

		assert.deepStrictEqual(history.state, { canGoBack: false, canGoForward: false });
		assert.strictEqual(history.back(), undefined);
	});

	test('does not turn cursor refocus into a forward-history destination', () => {
		const history = new NavigationHistory();
		history.observeCurrentNode('first');
		history.navigateTo('second');
		history.observeCurrentNode('cursor-focus');

		assert.strictEqual(history.back(), 'first');
		assert.strictEqual(history.forward(), 'second');
	});

	test('clears forward history after new explicit navigation', () => {
		const history = new NavigationHistory();
		history.observeCurrentNode('first');
		history.navigateTo('second');
		history.navigateTo('third');
		assert.strictEqual(history.back(), 'second');
		assert.deepStrictEqual(history.state, { canGoBack: true, canGoForward: true });

		history.navigateTo('replacement');

		assert.deepStrictEqual(history.state, { canGoBack: true, canGoForward: false });
		assert.strictEqual(history.forward(), undefined);
		assert.strictEqual(history.back(), 'second');
	});

	test('does not add the current focused node twice', () => {
		const history = new NavigationHistory();
		history.observeCurrentNode('focus');

		assert.strictEqual(history.navigateTo('focus'), 'focus');
		assert.deepStrictEqual(history.state, { canGoBack: false, canGoForward: false });
	});
});
