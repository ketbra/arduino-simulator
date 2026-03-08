import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState } from '@codemirror/state';

const DEFAULT_CODE = `// Arduino Simulator
// Write your code here!

void setup() {
  // runs once at start
  pinMode(13, OUTPUT);
}

void loop() {
  // runs repeatedly
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

export function createEditor(parentElement) {
  const state = EditorState.create({
    doc: DEFAULT_CODE,
    extensions: [
      basicSetup,
      javascript(),
      oneDark,
      EditorView.theme({
        '&': { height: '100%' },
        '.cm-scroller': { overflow: 'auto' },
      }),
    ],
  });

  const view = new EditorView({
    state,
    parent: parentElement,
  });

  return {
    getCode() {
      return view.state.doc.toString();
    },
    setCode(code) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
      });
    },
    view,
  };
}
