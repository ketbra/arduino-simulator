import './style.css';
import { createEditor } from './editor/editor.js';

const editor = createEditor(document.getElementById('code-editor'));

window.arduinoSimulator = { editor };
