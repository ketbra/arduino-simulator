import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

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

const setHighlightLine = StateEffect.define();

const highlightField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlightLine)) {
        if (e.value === null) return Decoration.none;
        const line = tr.state.doc.line(e.value);
        return Decoration.set([
          Decoration.line({ class: 'cm-activeLine-running' }).range(line.from),
        ]);
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const highlightTheme = EditorView.theme({
  '.cm-activeLine-running': {
    backgroundColor: 'rgba(255, 200, 0, 0.15)',
    borderLeft: '3px solid #f0c000',
  },
});

export function createEditor(parentElement, options = {}) {
  const extensions = [
    basicSetup,
    javascript(),
    oneDark,
    highlightField,
    highlightTheme,
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
    }),
  ];

  if (options.onChange) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange();
      })
    );
  }

  const state = EditorState.create({
    doc: DEFAULT_CODE,
    extensions,
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
    highlightLine(lineNum) {
      view.dispatch({ effects: setHighlightLine.of(lineNum) });
    },
    clearHighlight() {
      view.dispatch({ effects: setHighlightLine.of(null) });
    },
    view,
  };
}
