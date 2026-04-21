/**
 * Tiny safe math-expression parser + evaluator.
 *
 * Lets us evaluate things like "sin(x)*x^2 + 1/x" without touching `eval`.
 * Supports: + - * / ^ , parentheses, unary minus, variables, and a whitelist
 * of functions (sin, cos, tan, asin, acos, atan, log, ln, sqrt, abs, exp).
 *
 * This powers the GraphPlotter + calculator tools without the security
 * risk of executing arbitrary user input.
 */

type Token =
  | { t: 'num'; v: number }
  | { t: 'id';  v: string }
  | { t: 'op';  v: string }
  | { t: 'lp' } | { t: 'rp' } | { t: 'comma' };

const FUNCS: Record<string, (...args: number[]) => number> = {
  sin:  (x) => Math.sin(x),
  cos:  (x) => Math.cos(x),
  tan:  (x) => Math.tan(x),
  asin: (x) => Math.asin(x),
  acos: (x) => Math.acos(x),
  atan: (x) => Math.atan(x),
  sinh: (x) => Math.sinh(x),
  cosh: (x) => Math.cosh(x),
  tanh: (x) => Math.tanh(x),
  log:  (x) => Math.log10(x),
  ln:   (x) => Math.log(x),
  exp:  (x) => Math.exp(x),
  sqrt: (x) => Math.sqrt(x),
  abs:  (x) => Math.abs(x),
  floor:(x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  round:(x) => Math.round(x),
  max:  (...a) => Math.max(...a),
  min:  (...a) => Math.min(...a),
  pow:  (a, b) => Math.pow(a, b),
};

const CONSTS: Record<string, number> = {
  pi: Math.PI, PI: Math.PI,
  e: Math.E, E: Math.E,
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c >= '0' && c <= '9' || (c === '.' && /\d/.test(src[i + 1] || ''))) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      // Exponent notation
      if (src[j] === 'e' || src[j] === 'E') {
        j++;
        if (src[j] === '+' || src[j] === '-') j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      out.push({ t: 'num', v: parseFloat(src.slice(i, j)) });
      i = j; continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j; continue;
    }
    if ('+-*/^%'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { out.push({ t: 'rp' }); i++; continue; }
    if (c === ',') { out.push({ t: 'comma' }); i++; continue; }
    throw new Error(`Unexpected character "${c}" at ${i}`);
  }
  return out;
}

type Node =
  | { k: 'num'; v: number }
  | { k: 'var'; name: string }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'un';  op: string; a: Node }
  | { k: 'fn';  name: string; args: Node[] };

class Parser {
  private tokens: Token[];
  private i = 0;
  constructor(tokens: Token[]) { this.tokens = tokens; }
  private peek(): Token | undefined { return this.tokens[this.i]; }
  private eat(): Token { return this.tokens[this.i++]; }

  parse(): Node {
    const node = this.parseExpr();
    if (this.i < this.tokens.length) throw new Error(`Unexpected token`);
    return node;
  }
  private parseExpr(): Node { return this.parseAddSub(); }
  private parseAddSub(): Node {
    let left = this.parseMulDiv();
    while (true) {
      const p = this.peek();
      if (p && p.t === 'op' && (p.v === '+' || p.v === '-')) {
        this.eat();
        const right = this.parseMulDiv();
        left = { k: 'bin', op: p.v, a: left, b: right };
      } else break;
    }
    return left;
  }
  private parseMulDiv(): Node {
    let left = this.parseUnary();
    while (true) {
      const p = this.peek();
      if (p && p.t === 'op' && (p.v === '*' || p.v === '/' || p.v === '%')) {
        this.eat();
        const right = this.parseUnary();
        left = { k: 'bin', op: p.v, a: left, b: right };
      } else break;
    }
    return left;
  }
  private parseUnary(): Node {
    const p = this.peek();
    if (p && p.t === 'op' && (p.v === '+' || p.v === '-')) {
      this.eat();
      const a = this.parseUnary();
      return { k: 'un', op: p.v, a };
    }
    return this.parsePow();
  }
  private parsePow(): Node {
    const base = this.parsePrimary();
    const p = this.peek();
    if (p && p.t === 'op' && p.v === '^') {
      this.eat();
      const exp = this.parseUnary(); // right-assoc
      return { k: 'bin', op: '^', a: base, b: exp };
    }
    return base;
  }
  private parsePrimary(): Node {
    const p = this.eat();
    if (!p) throw new Error('Unexpected end');
    if (p.t === 'num') return { k: 'num', v: p.v };
    if (p.t === 'id') {
      const next = this.peek();
      if (next && next.t === 'lp') {
        this.eat();
        const args: Node[] = [];
        if (this.peek()?.t !== 'rp') {
          args.push(this.parseExpr());
          while (this.peek()?.t === 'comma') { this.eat(); args.push(this.parseExpr()); }
        }
        if (this.eat()?.t !== 'rp') throw new Error('Missing )');
        return { k: 'fn', name: p.v, args };
      }
      return { k: 'var', name: p.v };
    }
    if (p.t === 'lp') {
      const n = this.parseExpr();
      if (this.eat()?.t !== 'rp') throw new Error('Missing )');
      return n;
    }
    throw new Error('Unexpected token');
  }
}

function evaluate(node: Node, env: Record<string, number>): number {
  switch (node.k) {
    case 'num': return node.v;
    case 'var': {
      if (node.name in env) return env[node.name];
      if (node.name in CONSTS) return CONSTS[node.name];
      throw new Error(`Unknown variable: ${node.name}`);
    }
    case 'bin': {
      const a = evaluate(node.a, env);
      const b = evaluate(node.b, env);
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
        case '^': return Math.pow(a, b);
      }
      throw new Error(`Unknown op: ${node.op}`);
    }
    case 'un': {
      const a = evaluate(node.a, env);
      return node.op === '-' ? -a : a;
    }
    case 'fn': {
      const fn = FUNCS[node.name];
      if (!fn) throw new Error(`Unknown function: ${node.name}`);
      const args = node.args.map((a) => evaluate(a, env));
      return fn(...args);
    }
  }
}

export function compileExpression(src: string): (env: Record<string, number>) => number {
  const tokens = tokenize(src);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return (env) => evaluate(ast, env);
}

export function evalExpression(src: string, env: Record<string, number> = {}): number {
  return compileExpression(src)(env);
}
