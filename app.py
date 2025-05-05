import os
import time
from flask import Flask, request, jsonify, render_template
import psycopg2

app = Flask(__name__)

# Use environment variables for sensitive data
DB_NAME = os.getenv("POSTGRES_DB")
DB_USER = os.getenv("POSTGRES_USER")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD")
DB_HOST = os.getenv("POSTGRES_HOST")
DB_PORT = int(os.getenv("POSTGRES_PORT"))

while True:
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
        )

        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS query_history (
                id SERIAL PRIMARY KEY,
                query TEXT NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """
        )
        conn.commit()
        cur.close()

        print("✅ Connected to PostgreSQL!")
        break
    except psycopg2.OperationalError as e:
        print("❌ Database not ready, retrying in 2 seconds...")
        time.sleep(2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/run_sql", methods=["POST"])
def run_sql():
    time.sleep(0.5)
    try:
        data = request.get_json()
        sql = data.get("query", "")

        if not sql.strip():
            return jsonify({"error": "No SQL query provided."}), 400

        statements = [stmt.strip() for stmt in sql.split(";") if stmt.strip()]
        results = []

        with conn:
            with conn.cursor() as cur:
                for stmt in statements:
                    cur.execute(stmt)

                    if cur.description:  # SELECT query
                        columns = [desc[0] for desc in cur.description]
                        rows = cur.fetchall()
                        results.append({"columns": columns, "rows": rows})
                    else:
                        results.append(
                            {"message": "✅ Statement executed successfully"}
                        )

                # ✅ Save the full query to history (after running all statements)
                cur.execute("INSERT INTO query_history (query) VALUES (%s);", (sql,))

        return jsonify(results)

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 400


@app.route("/list_tables", methods=["GET"])
def list_tables():
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_type = 'BASE TABLE';
            """
            )
            tables = [row[0] for row in cur.fetchall()]
            return jsonify(tables)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/table_schema/<table_name>", methods=["GET"])
def table_schema(table_name):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    cols.column_name,
                    cols.data_type,
                    CASE
                        WHEN pk.column_name IS NOT NULL THEN 'PRIMARY KEY'
                        WHEN fk.column_name IS NOT NULL THEN 'FOREIGN KEY'
                        ELSE ''
                    END AS key_type,
                    CASE 
                        WHEN cols.is_nullable = 'NO' THEN 'NOT NULL'
                        ELSE ''
                    END AS nullability,
                    cols.column_default
                FROM information_schema.columns cols
                LEFT JOIN (
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.table_name = %s AND tc.constraint_type = 'PRIMARY KEY'
                ) pk ON pk.column_name = cols.column_name
                LEFT JOIN (
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.table_name = %s AND tc.constraint_type = 'FOREIGN KEY'
                ) fk ON fk.column_name = cols.column_name
                WHERE cols.table_name = %s AND cols.table_schema = 'public'
                ORDER BY cols.ordinal_position;
            """,
                (table_name, table_name, table_name),
            )

            rows = cur.fetchall()
            schema = []
            for col in rows:
                col_name, data_type, key_type, nullability, column_default = col
                constraints = []

                if key_type:
                    constraints.append(key_type)
                if nullability == "NOT NULL":
                    constraints.append("NOT NULL")
                if column_default:
                    # Clean up DEFAULT clause
                    default_clean = str(column_default)
                    if default_clean.startswith("nextval("):
                        constraints.append("AUTO INCREMENT")
                    elif "::" in default_clean:
                        # Strip type casting like 'abc'::text -> 'abc'
                        default_clean = default_clean.split("::")[0]
                        constraints.append(f"DEFAULT {default_clean}")
                    else:
                        constraints.append(f"DEFAULT {default_clean}")

                schema.append(
                    {
                        "column": col_name,
                        "type": data_type,
                        "constraints": ", ".join(constraints),
                    }
                )

            return jsonify(schema)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/query_history", methods=["GET"])
def get_query_history():
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT DISTINCT ON (query) id, query, created_at
            FROM query_history
            ORDER BY query, created_at DESC
            LIMIT 50;
            """
        )
        rows = cur.fetchall()
        cur.close()

        # Sort again by recency for final output
        history = sorted(
            [
                {"id": row[0], "query": row[1], "created_at": row[2].isoformat()}
                for row in rows
            ],
            key=lambda x: x["created_at"],
            reverse=True,
        )

        return jsonify(history)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.errorhandler(500)
def handle_internal_error(error):
    return jsonify({"error": "An unexpected error occurred"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
