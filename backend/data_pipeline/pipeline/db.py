import json
from pathlib import Path
from typing import Any, Iterable

import psycopg2
import psycopg2.extras


class Database:
    def __init__(self, database_url: str):
        self.database_url = database_url

    def connect(self):
        return psycopg2.connect(self.database_url)

    def run_sql_file(self, file_path: str) -> None:
        sql = Path(file_path).read_text(encoding="utf-8")

        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()

    def fetch_all(
        self,
        query: str,
        params: tuple[Any, ...] = (),
    ) -> list[dict[str, Any]]:
        with self.connect() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query, params)
                rows = cur.fetchall()
                return [dict(row) for row in rows]

    def fetch_one(
        self,
        query: str,
        params: tuple[Any, ...] = (),
    ) -> dict[str, Any] | None:
        rows = self.fetch_all(query, params)
        return rows[0] if rows else None

    def execute(
        self,
        query: str,
        params: tuple[Any, ...] = (),
    ) -> None:
        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.execute(query, params)
            conn.commit()

    def execute_many(
        self,
        query: str,
        rows: Iterable[tuple[Any, ...]],
    ) -> None:
        rows = list(rows)

        if not rows:
            return

        with self.connect() as conn:
            with conn.cursor() as cur:
                cur.executemany(query, rows)
            conn.commit()


def to_jsonb(value: Any) -> str:
    return json.dumps(value, default=str)