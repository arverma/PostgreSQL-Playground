import { loadTables } from "./tableManager.js";
import { EditorManager } from "./editorManager.js";

// Fetch query history from backend
async function fetchQueryHistory(setLastToEditor = false) {
  try {
    const res = await fetch("/query_history");
    const history = await res.json();
    renderQueryHistory(history);

    // Set most recent query to editor if requested
    if (setLastToEditor && history.length > 0) {
      EditorManager.setValue(history[0].query); // Assuming index 0 is most recent
    }
  } catch (err) {
    console.error("Failed to load query history:", err);
  }
}

// Render query history list
function renderQueryHistory(history) {
  const list = document.getElementById("history-list");
  list.innerHTML = "";

  history.forEach((item) => {
    const li = document.createElement("li");
    li.textContent =
      item.query.length > 100 ? item.query.slice(0, 100) + "..." : item.query;
    li.title = item.query;

    li.onclick = () => {
      EditorManager.setValue(item.query);
    };

    list.appendChild(li);
  });
}

function formatTable(columns, rows) {
  // Calculate column widths
  const colWidths = columns.map((col, i) => {
    const maxDataWidth = Math.max(
      ...rows.map((row) => (row[i] ? row[i].toString().length : 0))
    );
    return Math.max(col.length, maxDataWidth);
  });

  // Function to create a line like +------+--------+
  const makeLine = (char = "-") =>
    "+" + colWidths.map((w) => char.repeat(w + 2)).join("+") + "+";

  // Function to format a row like | val1 | val2 |
  const formatRow = (row) =>
    "| " +
    row
      .map((cell, i) => (cell ?? "").toString().padEnd(colWidths[i]))
      .join(" | ") +
    " |";

  const lines = [];

  lines.push(makeLine()); // Top border
  lines.push(formatRow(columns)); // Header
  lines.push(makeLine("=")); // Header separator
  rows.forEach((row) => lines.push(formatRow(row))); // Data rows
  lines.push(makeLine()); // Bottom border

  return lines.join("\n");
}

async function runQuery() {
  const resultEl = document.getElementById("result");
  const loadingEl = document.getElementById("query-loading");
  const runBtn = document.getElementById("runBtn");

  resultEl.textContent = "";
  if (loadingEl) loadingEl.style.display = "inline";
  if (runBtn) {
    runBtn.disabled = true;
    runBtn.textContent = "Running...";
  }

  let query = EditorManager.getValue();
  const lines = query.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith("--");
  });
  query = lines.join("\n").trim();

  if (!query) {
    resultEl.textContent = "Error: no valid SQL to execute.";
    return;
  }

  resultEl.classList.add("loading");

  try {
    const res = await fetch("/run_sql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();

    if (data.error) {
      resultEl.textContent = "Error: " + data.error;
    } else if (Array.isArray(data)) {
      let output = "";
      data.forEach((res, index) => {
        output += `\n--- Statement ${index + 1} ---\n`;
        if (res.columns) {
          output += formatTable(res.columns, res.rows);
        } else if (res.message) {
          output += res.message;
        }
        output += "\n";
      });
      resultEl.textContent = output;
    } else {
      resultEl.textContent = JSON.stringify(data, null, 2);
    }

    loadTables();
    fetchQueryHistory();
  } catch (err) {
    resultEl.textContent = "Network Error: " + err.message;
  } finally {
    resultEl.classList.remove("loading");
    if (loadingEl) loadingEl.style.display = "none";
    if (runBtn) {
      runBtn.disabled = false;
      runBtn.textContent = "▶ Run (⌘+⏎)";
    }
  }
}

function formatSQL() {
  console.log("Formatting SQL...");
  const rawSQL = EditorManager.getValue();
  const formatted = sqlFormatter.format(rawSQL, {
    language: "postgresql",
  });
  EditorManager.setValue(formatted);
}

function toggleComment() {
  const doc = EditorManager.editor.getDoc();
  const selections = doc.listSelections();

  selections.forEach((sel) => {
    const from = sel.from().line;
    const to = sel.to().line;

    let allCommented = true;

    for (let i = from; i <= to; i++) {
      const lineText = doc.getLine(i);
      if (!lineText.trim().startsWith("--")) {
        allCommented = false;
        break;
      }
    }

    for (let i = from; i <= to; i++) {
      const lineText = doc.getLine(i);
      if (allCommented) {
        // Uncomment
        const uncommented = lineText.replace(/^(\s*)--\s?/, "$1");
        doc.replaceRange(
          uncommented,
          { line: i, ch: 0 },
          { line: i, ch: lineText.length }
        );
      } else {
        // Comment
        const commented = "-- " + lineText;
        doc.replaceRange(
          commented,
          { line: i, ch: 0 },
          { line: i, ch: lineText.length }
        );
      }
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  // Initialize CodeMirror editor AFTER DOM is ready
  EditorManager.initializeEditor("sqlEditor", ".editor-wrapper");

  // Format button
  const formatBtn = document.getElementById("formatBtn");
  if (formatBtn) {
    formatBtn.addEventListener("click", formatSQL);
  }
  const runBtn = document.getElementById("runBtn");
  if (runBtn) {
    runBtn.addEventListener("click", runQuery);
  }

  // Keyboard shortcuts for formatting and running
  EditorManager.editor.addKeyMap({
    "Shift-Ctrl-F": formatSQL,
    "Shift-Cmd-F": formatSQL,
    "Cmd-Enter": runQuery,
    "Ctrl-Enter": runQuery,
    "Cmd-/": toggleComment,
    "Ctrl-/": toggleComment,
  });

  // Load tables on page load
  loadTables();
  fetchQueryHistory(true);
});
