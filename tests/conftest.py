# tests/conftest.py
import subprocess
import os
import pytest

@pytest.fixture(scope="session", autouse=True)
def clear_preview_db():
    """
    Runs once, before any tests, to DELETE all rows from the preview D1 database.
    """
    # Determine paths
    root = os.path.abspath(os.path.dirname(__file__) + "/..")
    worker_dir = os.path.join(root, "worker")

    # Execute Wrangler CLI to clear preview DB
    subprocess.run([
        "wrangler", "d1", "execute", "EVENTS_DB",
        "--remote",
        "--cwd", worker_dir,
        "--command", "DELETE FROM events;"
    ], check=True)
    yield