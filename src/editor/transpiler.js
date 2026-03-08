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

  // void funcName(...) { -> function funcName(...) {
  (line) => line.replace(/\bvoid\s+(\w+)\s*\(/, 'function $1('),

  // typed function declarations: int/float/etc funcName(...) -> function funcName(...)
  (line) => line.replace(/\b(int|float|long|byte|boolean|char)\s+(\w+)\s*\(/, 'function $2('),

  // Remove type annotations from function params: (int red, int green) -> (red, green)
  (line) => line.replace(/\b(int|float|long|unsigned long|byte|boolean|char)\s+(?=\w+\s*[,\)])/g, ''),

  // int/float/etc variable declarations -> let (only at start of statement)
  (line) => {
    if (line.match(/^\s*(int|float|long|byte|boolean|char)\s+\w+/)) {
      return line.replace(/\b(int|float|long|byte|boolean|char)\s+/, 'let ');
    }
    return line;
  },
];

export function transpile(code) {
  const lines = code.split('\n');
  const result = lines.map((line) => {
    let transformed = line;
    for (const transform of transforms) {
      transformed = transform(transformed);
    }
    return transformed;
  });
  return result.join('\n');
}
