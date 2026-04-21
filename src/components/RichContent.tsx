'use client';

/**
 * RichContent — Markdown + LaTeX-lite renderer.
 *
 * AI responses come back with Markdown formatting and math notation. Without
 * this renderer, students see "**bold**" literally. Competitors all render
 * Markdown + LaTeX — it's table-stakes.
 *
 * We implement a dependency-free renderer that handles:
 *   - Headers (#, ##, ###)
 *   - Bold (**text**), italic (*text* / _text_), strike (~~text~~), code (`code`)
 *   - Unordered lists (-, *), ordered lists (1.)
 *   - Code blocks (```)
 *   - Blockquotes (>)
 *   - Links [text](url)
 *   - Horizontal rules (---)
 *   - Inline math $...$ and display math $$...$$ (Unicode-approximated; upgrade
 *     to KaTeX by installing `katex` + `react-katex` and swapping renderMath)
 *
 * Zero new npm dependencies — ships immediately.
 */

import React, { useMemo } from 'react';

interface RichContentProps {
  text: string;
  className?: string;
  inline?: boolean;
}

// ============================================================
// LaTeX → Unicode approximation (for common K-12 math)
// ============================================================

const LATEX_SUBS: Array<[RegExp, string | ((m: RegExpMatchArray) => string)]> = [
  // Fractions: \frac{a}{b} or \dfrac{a}{b}
  [/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (m) => `(${m[1]})/(${m[2]})`],
  // Square roots: \sqrt{x}
  [/\\sqrt\{([^{}]+)\}/g, (m) => `√(${m[1]})`],
  // Superscripts: x^2 or x^{10}
  [/\^{([^{}]+)}/g, (m) => toSuperscript(m[1])],
  [/\^(\w)/g, (m) => toSuperscript(m[1])],
  // Subscripts
  [/_\{([^{}]+)\}/g, (m) => toSubscript(m[1])],
  [/_(\w)/g, (m) => toSubscript(m[1])],
  // Greek letters (most common)
  [/\\alpha\b/g, 'α'], [/\\beta\b/g, 'β'], [/\\gamma\b/g, 'γ'], [/\\delta\b/g, 'δ'],
  [/\\epsilon\b/g, 'ε'], [/\\theta\b/g, 'θ'], [/\\lambda\b/g, 'λ'], [/\\mu\b/g, 'μ'],
  [/\\pi\b/g, 'π'], [/\\sigma\b/g, 'σ'], [/\\phi\b/g, 'φ'], [/\\omega\b/g, 'ω'],
  [/\\Delta\b/g, 'Δ'], [/\\Sigma\b/g, 'Σ'], [/\\Pi\b/g, 'Π'], [/\\Omega\b/g, 'Ω'],
  // Operators
  [/\\times\b/g, '×'], [/\\div\b/g, '÷'], [/\\cdot\b/g, '·'], [/\\pm\b/g, '±'],
  [/\\leq\b/g, '≤'], [/\\geq\b/g, '≥'], [/\\neq\b/g, '≠'], [/\\approx\b/g, '≈'],
  [/\\infty\b/g, '∞'], [/\\to\b/g, '→'], [/\\rightarrow\b/g, '→'], [/\\leftarrow\b/g, '←'],
  [/\\sum\b/g, '∑'], [/\\prod\b/g, '∏'], [/\\int\b/g, '∫'],
  [/\\in\b/g, '∈'], [/\\notin\b/g, '∉'], [/\\subset\b/g, '⊂'], [/\\cup\b/g, '∪'], [/\\cap\b/g, '∩'],
  [/\\angle\b/g, '∠'], [/\\degree\b/g, '°'], [/\\perp\b/g, '⊥'], [/\\parallel\b/g, '∥'],
  // Text commands
  [/\\text\{([^{}]+)\}/g, (m) => m[1]],
  [/\\mathbb\{([^{}]+)\}/g, (m) => m[1]],
  [/\\mathrm\{([^{}]+)\}/g, (m) => m[1]],
  // Clean up remaining backslash commands
  [/\\left/g, ''], [/\\right/g, ''],
];

const SUPER_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ',
};
const SUB_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎', 'a': 'ₐ', 'e': 'ₑ', 'o': 'ₒ', 'x': 'ₓ',
};

function toSuperscript(s: string): string {
  return s.split('').map((c) => SUPER_MAP[c] ?? `^${c}`).join('');
}

function toSubscript(s: string): string {
  return s.split('').map((c) => SUB_MAP[c] ?? `_${c}`).join('');
}

function renderMath(latex: string): string {
  let out = latex;
  for (const [re, sub] of LATEX_SUBS) {
    if (typeof sub === 'string') {
      out = out.replace(re, sub);
    } else {
      out = out.replace(re, (...args: any[]) => {
        const m = [args[0], ...args.slice(1, -2)] as unknown as RegExpMatchArray;
        return (sub as (m: RegExpMatchArray) => string)(m);
      });
    }
  }
  return out;
}

// ============================================================
// Markdown parser — line-based, with inline formatting
// ============================================================

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(raw: string): string {
  let s = escapeHtml(raw);

  // Display math $$...$$
  s = s.replace(/\$\$([^$]+)\$\$/g, (_, m) => `<span class="math-display">${renderMath(m)}</span>`);
  // Inline math $...$
  s = s.replace(/\$([^$\n]+)\$/g, (_, m) => `<span class="math-inline">${renderMath(m)}</span>`);

  // Code spans
  s = s.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>');

  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="text-primary-600 underline">$1</a>');

  // Bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>');

  // Strike
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return s;
}

function parseBlocks(text: string): string {
  const lines = text.split('\n');
  const html: string[] = [];
  let inCode = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inQuote = false;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const content = paragraphBuffer.join(' ');
      html.push(`<p class="mb-2">${renderInline(content)}</p>`);
      paragraphBuffer = [];
    }
  };

  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };

  const closeQuote = () => {
    if (inQuote) {
      html.push(`</blockquote>`);
      inQuote = false;
    }
  };

  for (let raw of lines) {
    // Code fence
    if (/^```/.test(raw)) {
      if (inCode) {
        const codeText = escapeHtml(codeBuffer.join('\n'));
        html.push(`<pre class="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs my-2"><code>${codeText}</code></pre>`);
        codeBuffer = [];
        inCode = false;
        codeLang = '';
      } else {
        flushParagraph(); closeList(); closeQuote();
        inCode = true;
        codeLang = raw.replace(/^```/, '').trim();
      }
      continue;
    }
    if (inCode) {
      codeBuffer.push(raw);
      continue;
    }

    const line = raw;

    // Horizontal rule
    if (/^\s*---\s*$/.test(line) || /^\s*\*\*\*\s*$/.test(line)) {
      flushParagraph(); closeList(); closeQuote();
      html.push('<hr class="my-3 border-gray-200" />');
      continue;
    }

    // Headers
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      flushParagraph(); closeList(); closeQuote();
      const level = hMatch[1].length;
      const size = level === 1 ? 'text-xl font-bold'
                 : level === 2 ? 'text-lg font-bold'
                 : level === 3 ? 'text-base font-semibold'
                 : 'text-sm font-semibold';
      html.push(`<h${level} class="${size} mt-3 mb-1">${renderInline(hMatch[2])}</h${level}>`);
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      flushParagraph(); closeList();
      if (!inQuote) {
        html.push('<blockquote class="border-l-4 border-gray-300 pl-3 italic text-gray-700 my-2">');
        inQuote = true;
      }
      html.push(`<p>${renderInline(line.replace(/^>\s?/, ''))}</p>`);
      continue;
    } else if (inQuote) {
      closeQuote();
    }

    // Unordered list
    const ulMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      if (inList !== 'ul') {
        closeList();
        html.push('<ul class="list-disc ml-5 my-2 space-y-1">');
        inList = 'ul';
      }
      html.push(`<li>${renderInline(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      if (inList !== 'ol') {
        closeList();
        html.push('<ol class="list-decimal ml-5 my-2 space-y-1">');
        inList = 'ol';
      }
      html.push(`<li>${renderInline(olMatch[1])}</li>`);
      continue;
    }

    // Blank line — paragraph separator
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    // Regular paragraph line
    closeList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  closeList();
  closeQuote();
  if (inCode) {
    html.push(`<pre class="bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto text-xs my-2"><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`);
  }
  return html.join('\n');
}

// ============================================================
// React component
// ============================================================

export default function RichContent({ text, className = '', inline = false }: RichContentProps) {
  const html = useMemo(() => {
    if (!text) return '';
    if (inline) return renderInline(text);
    return parseBlocks(text);
  }, [text, inline]);

  if (inline) {
    return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <div className={`rich-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
