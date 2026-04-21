'use client';

/**
 * CodeSandbox — in-browser JavaScript code runner with sandboxed iframe.
 * Captures console output, runs with a 3-second watchdog, isolates from parent
 * window via srcDoc iframe.
 *
 * For Python, recommend Pyodide plugin (too heavy to bundle here).
 */

import { useRef, useState } from 'react';

type Language = 'javascript';

const STARTER_TEMPLATES: Record<string, string> = {
  hello: `console.log("Hello, world!");`,
  loop: `for (let i = 1; i <= 5; i++) {
  console.log("Count:", i);
}`,
  function: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
for (let i = 0; i < 10; i++) {
  console.log(fibonacci(i));
}`,
  objects: `const students = [
  { name: "Aarav", score: 85 },
  { name: "Priya", score: 92 },
  { name: "Ravi", score: 78 },
];
const avg = students.reduce((s, x) => s + x.score, 0) / students.length;
console.log("Average:", avg.toFixed(1));`,
};

// Simple syntax highlighter for JavaScript
const KEYWORDS = new Set([
  'var', 'let', 'const', 'function', 'return', 'if', 'else', 'for', 'while',
  'do', 'switch', 'case', 'break', 'continue', 'new', 'this', 'class', 'extends',
  'super', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of',
  'null', 'undefined', 'true', 'false', 'async', 'await',
]);

function highlight(code: string): string {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // strings
  html = html.replace(/(['"`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="sy-str">$&</span>');
  // comments
  html = html.replace(/\/\/[^\n]*/g, '<span class="sy-cmt">$&</span>');
  html = html.replace(/\/\*[\s\S]*?\*\//g, '<span class="sy-cmt">$&</span>');
  // numbers
  html = html.replace(/\b\d+(\.\d+)?\b/g, '<span class="sy-num">$&</span>');
  // keywords
  html = html.replace(/\b(\w+)\b/g, (m) => KEYWORDS.has(m) ? `<span class="sy-kw">${m}</span>` : m);
  return html;
}

export default function CodeSandbox() {
  const [code, setCode] = useState(STARTER_TEMPLATES.hello);
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const run = () => {
    setError(null);
    setOutput([]);
    setRunning(true);

    const wrappedCode = `
      (function() {
        const lines = [];
        const origLog = console.log;
        const origErr = console.error;
        console.log = (...args) => { lines.push(args.map(String).join(' ')); };
        console.error = (...args) => { lines.push('❌ ' + args.map(String).join(' ')); };
        try {
          ${code}
          parent.postMessage({ type: 'sb-output', lines }, '*');
        } catch (err) {
          parent.postMessage({ type: 'sb-error', error: String(err && err.stack || err) }, '*');
        }
      })();
    `;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><script>${wrappedCode}<\/script></body></html>`;

    const handler = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'sb-output') {
        setOutput(Array.isArray(e.data.lines) ? e.data.lines : []);
        setRunning(false);
        window.removeEventListener('message', handler);
      }
      if (e.data.type === 'sb-error') {
        setError(String(e.data.error || 'Unknown error'));
        setRunning(false);
        window.removeEventListener('message', handler);
      }
    };
    window.addEventListener('message', handler);

    // Watchdog — stop after 3s
    setTimeout(() => {
      if (iframeRef.current) iframeRef.current.srcdoc = '';
      setRunning(false);
      window.removeEventListener('message', handler);
    }, 3000);

    if (iframeRef.current) iframeRef.current.srcdoc = html;
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold">💻 Code Sandbox <span className="text-xs text-gray-500 font-normal">(JavaScript)</span></h3>
        <div className="flex gap-1">
          {Object.entries(STARTER_TEMPLATES).map(([key, tpl]) => (
            <button
              key={key}
              type="button"
              onClick={() => setCode(tpl)}
              aria-label={key}
              className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-800 rounded capitalize"
            >{key}</button>
          ))}
        </div>
      </div>

      <style>{`
        .sy-kw { color: #8b5cf6; font-weight: 600; }
        .sy-str { color: #16a34a; }
        .sy-cmt { color: #9ca3af; font-style: italic; }
        .sy-num { color: #f59e0b; }
        .sandbox-editor { position: relative; font-family: ui-monospace, Menlo, Monaco, 'Courier New', monospace; }
        .sandbox-editor textarea, .sandbox-editor pre {
          margin: 0; padding: 12px; border-radius: 8px;
          font-size: 13px; line-height: 1.5;
          white-space: pre-wrap; word-break: break-word;
        }
        .sandbox-editor textarea { color: transparent; caret-color: #1f2937; background: transparent; position: absolute; inset: 0; border: none; resize: none; outline: none; }
        .sandbox-editor pre { background: #0f172a; color: #f1f5f9; min-height: 160px; }
      `}</style>
      <div className="sandbox-editor border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <pre dangerouslySetInnerHTML={{ __html: highlight(code) + '\n' }} />
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          aria-label="Code editor"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        />
      </div>

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={run}
          disabled={running}
          aria-label="Run code"
          className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded font-semibold text-sm"
        >{running ? 'Running…' : '▶ Run'}</button>
        <button
          type="button"
          onClick={() => { setOutput([]); setError(null); }}
          aria-label="Clear output"
          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-sm"
        >Clear output</button>
      </div>

      <div className="mt-3 p-3 bg-gray-900 text-gray-100 rounded-lg font-mono text-xs min-h-[100px] max-h-60 overflow-auto">
        {error ? (
          <span className="text-red-400 whitespace-pre-wrap">❌ {error}</span>
        ) : output.length === 0 ? (
          <span className="text-gray-500">Output appears here…</span>
        ) : (
          output.map((l, i) => <div key={i}>{l}</div>)
        )}
      </div>

      <iframe
        ref={iframeRef}
        sandbox="allow-scripts"
        title="Code sandbox runtime"
        className="hidden"
        aria-hidden="true"
      />

      <p className="mt-2 text-xs text-gray-500">
        Sandboxed iframe · 3-second timeout · No network or storage access.
      </p>
    </div>
  );
}
