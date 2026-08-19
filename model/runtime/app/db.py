"""Database connection helper."""

import mysql.connector

from app.config import DB_CONFIG


def connect_db():
    """Open a new MySQL connection using settings from app.config.DB_CONFIG.
    A connection timeout is set so an unreachable database fails fast
    (a few seconds) instead of hanging a request indefinitely — this
    matters most for app/insights.py, which is called from the live
    prediction path and must degrade gracefully."""
    return mysql.connector.connect(connection_timeout=10, **DB_CONFIG)
