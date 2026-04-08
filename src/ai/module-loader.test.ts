import { expect } from '@open-wc/testing';
import { loadModule, clearModuleCache } from './module-loader.js';

afterEach(() => {
  clearModuleCache();
});

describe('module-loader', () => {
  it('returns the same Promise for concurrent requests to the same URL', () => {
    // Don't await — capture the promises synchronously
    const p1 = loadModule('/test/widget.js');
    const p2 = loadModule('/test/widget.js');
    expect(p1).to.equal(p2);
  });

  it('returns different Promises for different URLs', () => {
    const p1 = loadModule('/test/a.js');
    const p2 = loadModule('/test/b.js');
    expect(p1).to.not.equal(p2);
  });

  it('removes failed URL from cache so retry can re-attempt', async () => {
    // First call — will fail (module doesn't exist in test environment)
    const p1 = loadModule('/test/nonexistent-abc.js');
    await p1.then(() => { throw new Error('should not resolve'); }, () => {});

    // After failure, cache entry should be removed — second call gets new Promise
    const p2 = loadModule('/test/nonexistent-abc.js');
    expect(p1).to.not.equal(p2);
  });
});
