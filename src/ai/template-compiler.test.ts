import { expect, fixture, html } from '@open-wc/testing';
import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { compileTemplate, safeRender } from './template-compiler.js';

@customElement('test-host-compiler')
class TestHost extends LitElement {}

describe('template-compiler', () => {
  describe('compileTemplate()', () => {
    it('returns ok=true and a callable function for valid template source', () => {
      const result = compileTemplate("return html`<span>hello</span>`");
      expect(result.ok).to.be.true;
      if (result.ok) {
        expect(result.fn).to.be.a('function');
      }
    });

    it('returns ok=false with error message for syntax error', () => {
      const result = compileTemplate("return html`<span>${");
      expect(result.ok).to.be.false;
      if (!result.ok) {
        expect(result.error).to.be.a('string').and.not.empty;
      }
    });

    it('returns ok=false for unclosed function body', () => {
      const result = compileTemplate("{{{{");
      expect(result.ok).to.be.false;
    });
  });

  describe('safeRender()', () => {
    it('returns the template result when function succeeds', async () => {
      const result = compileTemplate("return html`<span id='ok'>rendered</span>`");
      expect(result.ok).to.be.true;
      if (!result.ok) return;

      const el = await fixture<TestHost>(html`<test-host-compiler></test-host-compiler>`);
      const tpl = safeRender(result.fn, el);
      expect(tpl).to.exist;
    });

    it('returns an error TemplateResult instead of throwing on runtime error', async () => {
      // This function will throw at runtime when called
      const badFn = () => { throw new Error('boom'); };
      const el = await fixture<TestHost>(html`<test-host-compiler></test-host-compiler>`);

      let threw = false;
      let result;
      try {
        result = safeRender(badFn as never, el);
      } catch {
        threw = true;
      }

      expect(threw).to.be.false;
      expect(result).to.exist;
    });
  });
});
