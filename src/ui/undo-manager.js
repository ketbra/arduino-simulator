export function createUndoManager() {
  const undoStack = [];
  const redoStack = [];

  function push(action) {
    undoStack.push(action);
    redoStack.length = 0; // Clear redo on new action
    if (undoStack.length > 100) undoStack.shift();
  }

  function undo() {
    const action = undoStack.pop();
    if (!action) return null;
    redoStack.push(action);
    return { type: 'undo', action };
  }

  function redo() {
    const action = redoStack.pop();
    if (!action) return null;
    undoStack.push(action);
    return { type: 'redo', action };
  }

  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  return { push, undo, redo, canUndo, canRedo };
}
