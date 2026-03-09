const transforms = [
  // #define NAME value -> const NAME = value;
  (line) => {
    const defineMatch = line.match(/^#define\s+(\w+)\s+(.+)$/);
    if (defineMatch) {
      return `const ${defineMatch[1]} = ${defineMatch[2]};`;
    }
    return line;
  },

  // Remove C-style casts like (float), (int), (unsigned long)
  (line) => line.replace(/\((?:float|int|long|unsigned long|byte|char)\)/g, ''),

  // unsigned long varName -> let varName
  (line) => line.replace(/\bunsigned\s+long\s+(\w)/g, 'let $1'),

  // void funcName(...) { -> async function funcName(...) {
  (line) => line.replace(/\bvoid\s+(\w+)\s*\(/, 'async function $1('),

  // typed function declarations: int/float/etc funcName(...) -> async function funcName(...)
  (line) => line.replace(/\b(int|float|long|byte|boolean|char)\s+(\w+)\s*\(/, 'async function $2('),

  // Remove type annotations from function params: (int red, int green) -> (red, green)
  (line) => line.replace(/\b(int|float|long|unsigned long|byte|boolean|char)\s+(?=\w+\s*[,\)])/g, ''),

  // int/float/etc variable declarations -> let (only at start of statement)
  (line) => {
    if (line.match(/^\s*(int|float|long|byte|boolean|char)\s+\w+/)) {
      return line.replace(/\b(int|float|long|byte|boolean|char)\s+/, 'let ');
    }
    return line;
  },

  // Add await before delay/delayMicroseconds
  (line) => line.replace(/^(\s*)(delay|delayMicroseconds)\s*\(/, '$1await $2('),

  // Add await before standalone function call statements (not keywords/control flow)
  (line) => {
    // Match: leading whitespace, then identifier followed by ( — but not if it's a keyword or already awaited
    const m = line.match(/^(\s*)(?!await |async |return |if |else |for |while |function |const |let |var )([\w]+)\s*\(/);
    if (m && !line.includes('async function')) {
      return line.replace(/^(\s*)([\w]+)\s*\(/, '$1await $2(');
    }
    return line;
  },

  // Add await in assignments: let x = funcCall() -> let x = await funcCall()
  (line) => line.replace(/=\s*(?!await )(\w+)\s*\(/, '= await $1('),
];

export function transpile(code) {
  const lines = code.split('\n');
  let insideFunction = false;
  const result = lines.map((line, i) => {
    let transformed = line;
    for (const transform of transforms) {
      transformed = transform(transformed);
    }

    // Track function scope
    const trimmed = transformed.trim();
    if (trimmed.startsWith('async function')) insideFunction = true;

    // Inject line reporting before executable statements inside functions
    const shouldReport = insideFunction && trimmed && trimmed !== '{' && trimmed !== '}' &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('async function') &&
        !trimmed.startsWith('let ') &&
        !trimmed.startsWith('return ');
    if (shouldReport) {
      const indent = transformed.match(/^(\s*)/)[1];
      return `${indent}await __reportLine(${i + 1});\n${transformed}`;
    }
    return transformed;
  });
  return result.join('\n');
}
