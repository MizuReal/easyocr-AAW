from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, List

import pandas as pd
from supabase import Client, create_client

from app.core.config import get_settings

COLUMN_MAP = {
    "ph": "ph",
    "Hardness": "hardness",
    "Solids": "solids",
    "Chloramines": "chloramines",
    "Sulfate": "sulfate",
    "Conductivity": "conductivity",
    "Organic_carbon": "organic_carbon",
    "Trihalomethanes": "trihalomethanes",
    "Turbidity": "turbidity",
    "Potability": "is_potable",
}

DEFAULT_BATCH_SIZE = 500


def get_supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment"
        )
    return create_client(settings.supabase_url, settings.supabase_service_key)


def load_csv(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(csv_path)

    df = pd.read_csv(csv_path)
    missing = [col for col in COLUMN_MAP if col not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing expected columns: {', '.join(missing)}")

    df = df.rename(columns=COLUMN_MAP)
    df["is_potable"] = df["is_potable"].apply(_to_bool)
    # Convert to object dtype before replacing NaN so JSON serialization sees None
    df = df.astype(object).where(pd.notnull(df), None)
    return df


def _to_bool(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return bool(int(value))
    except (TypeError, ValueError):
        return None


def chunk_rows(df: pd.DataFrame, size: int) -> Iterable[pd.DataFrame]:
    total = len(df)
    for start in range(0, total, size):
        yield df.iloc[start : start + size]


def insert_batch(client: Client, table_name: str, batch: pd.DataFrame) -> None:
    payload: List[dict] = batch.to_dict(orient="records")
    response = client.table(table_name).insert(payload).execute()
    if getattr(response, "error", None):
        raise RuntimeError(response.error)


def run(csv_path: Path, table_name: str, batch_size: int) -> None:
    client = get_supabase_client()
    df = load_csv(csv_path)
    for batch in chunk_rows(df, batch_size):
        insert_batch(client, table_name, batch)
    print(
        f"Finished importing {len(df)} rows from {csv_path} into {table_name}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import CSV rows into Supabase")
    parser.add_argument(
        "--csv",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "water_potability.csv",
        help="Path to the CSV file to import",
    )
    parser.add_argument(
        "--table",
        default="water_samples",
        help="Supabase table name",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help="Number of rows to send per insert request",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run(args.csv, args.table, args.batch_size)
