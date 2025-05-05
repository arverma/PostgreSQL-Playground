// editorManager.js
export const EditorManager = {
  editor: null,

  initializeEditor(textareaId, editorContainerSelector) {
    const textarea = document.getElementById(textareaId);
    const editorContainer = document.querySelector(editorContainerSelector);

    if (!textarea) {
      console.error(`Cannot find textarea with id '${textareaId}'`);
      return;
    }

    this.editor = CodeMirror.fromTextArea(textarea, {
      mode: "text/x-sql",
      lineNumbers: true,
      matchBrackets: true,
      styleActiveLine: true,
      indentWithTabs: false,
      smartIndent: true,
      tabSize: 2,
      indentUnit: 2,
      lineWrapping: true,
      theme: "default",
    });

    this.editor.setSize(null, editorContainer.clientHeight);

    const resizeObserver = new ResizeObserver(() => {
      this.editor.setSize(null, editorContainer.clientHeight);
    });

    resizeObserver.observe(editorContainer);
  },

  getValue() {
    return this.editor?.getValue() || "";
  },

  setValue(value) {
    if (this.editor) {
      this.editor.setValue(value);
      this.editor.focus();
    } else {
      console.error("Editor is not initialized");
    }
  },
};
