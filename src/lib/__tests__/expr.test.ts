import { describe, it, expect } from 'vitest';
import { evalExpression } from '../expr';

describe('evalExpression — arithmetic', () => {
  it('handles basic ops', () => {
    expect(evalExpression('2+3')).toBe(5);
    expect(evalExpression('10-4')).toBe(6);
    expect(evalExpression('6*7')).toBe(42);
    expect(evalExpression('20/4')).toBe(5);
  });

  it('respects precedence', () => {
    expect(evalExpression('2+3*4')).toBe(14);
    expect(evalExpression('(2+3)*4')).toBe(20);
  });

  it('supports power', () => {
    expect(evalExpression('2^10')).toBe(1024);
    expect(evalExpression('2^3^2')).toBe(512);  // right-assoc
  });

  it('handles unary minus', () => {
    expect(evalExpression('-2^2')).toBe(-4);    // -(2^2)
    expect(evalExpression('(-2)^2')).toBe(4);
  });

  it('supports decimals + exponent notation', () => {
    expect(evalExpression('1.5*2')).toBe(3);
    expect(evalExpression('1e3')).toBe(1000);
  });
});

describe('evalExpression — functions and constants', () => {
  it('math functions', () => {
    expect(evalExpression('sqrt(9)')).toBe(3);
    expect(Math.abs(evalExpression('sin(0)'))).toBeLessThan(1e-9);
    expect(evalExpression('abs(-5)')).toBe(5);
    expect(evalExpression('max(3,7,2)')).toBe(7);
  });

  it('constants pi and e', () => {
    expect(Math.abs(evalExpression('pi') - Math.PI)).toBeLessThan(1e-9);
    expect(Math.abs(evalExpression('e') - Math.E)).toBeLessThan(1e-9);
  });

  it('variables via env', () => {
    expect(evalExpression('x+1', { x: 5 })).toBe(6);
    expect(evalExpression('x*x', { x: 3 })).toBe(9);
  });
});

describe('evalExpression — safety', () => {
  it('rejects unknown functions', () => {
    expect(() => evalExpression('evilFn(1)')).toThrow();
  });

  it('rejects unknown variables', () => {
    expect(() => evalExpression('undefinedVar+1')).toThrow();
  });

  it('rejects malformed input', () => {
    expect(() => evalExpression('2+')).toThrow();
    expect(() => evalExpression('(1+2')).toThrow();
  });

  it('does not evaluate JS', () => {
    // Would be catastrophic if it did.
    expect(() => evalExpression('constructor.constructor')).toThrow();
  });
});
