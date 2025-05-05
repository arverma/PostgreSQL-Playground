export async function loadTables() {
  const tableList = document.getElementById("tableList");
  tableList.innerHTML = "";

  try {
    const res = await fetch("/list_tables");
    const data = await res.json();

    if (Array.isArray(data)) {
      data.forEach(createTableContainer);
    }
  } catch (err) {
    console.error("Error fetching tables:", err);
  }

  function createTableContainer(table) {
    const container = document.createElement("div");
    container.classList.add("table-container");

    const header = document.createElement("div");
    header.classList.add("table-header");

    const toggleIcon = document.createElement("span");
    toggleIcon.textContent = "▶";
    toggleIcon.classList.add("toggle-icon");

    const tableName = document.createElement("span");
    tableName.textContent = table;
    tableName.classList.add("table-name");

    header.appendChild(toggleIcon);
    header.appendChild(tableName);
    container.appendChild(header);

    const schemaScrollContainer = document.createElement("div");
    schemaScrollContainer.classList.add("schema-scroll-container");
    schemaScrollContainer.style.display = "none";

    const schemaTable = document.createElement("table");
    schemaTable.classList.add("schema-table");

    header.addEventListener("click", () =>
      toggleTableSchema(table, schemaScrollContainer, schemaTable, toggleIcon)
    );

    schemaScrollContainer.appendChild(schemaTable);
    container.appendChild(schemaScrollContainer);
    tableList.appendChild(container);
  }

  async function toggleTableSchema(
    table,
    schemaScrollContainer,
    schemaTable,
    toggleIcon
  ) {
    if (schemaScrollContainer.style.display === "none") {
      try {
        const res = await fetch(`/table_schema/${table}`);
        const columns = await res.json();
        schemaTable.innerHTML = `
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Constraints</th>
              </tr>
            </thead>
          `;

        const tbody = document.createElement("tbody");
        columns.forEach((col) => {
          const row = document.createElement("tr");
          row.innerHTML = `
              <td>${col.column}</td>
              <td>${col.type}</td>
              <td>${col.constraints}</td>
            `;
          tbody.appendChild(row);
        });
        schemaTable.appendChild(tbody);

        schemaScrollContainer.style.display = "block"; // show scroll container
        toggleIcon.textContent = "▼";
      } catch (err) {
        console.error("Error fetching table schema:", err);
      }
    } else {
      schemaScrollContainer.style.display = "none"; // hide scroll container
      toggleIcon.textContent = "▶";
    }
  }
}
