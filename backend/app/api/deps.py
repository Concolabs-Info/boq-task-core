import sqlite3
from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request

from ..core.config import Settings
from ..db import connect


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


SettingsDep = Annotated[Settings, Depends(get_app_settings)]


def get_conn(settings: SettingsDep) -> Iterator[sqlite3.Connection]:
    """One connection per request. Commits when the request succeeds, rolls back when it fails."""
    conn = connect(settings.database_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# scope="function" closes the connection, and commits, before the response is sent.
Conn = Annotated[sqlite3.Connection, Depends(get_conn, scope="function")]


def require_runtime_token(settings: SettingsDep, authorization: Annotated[str, Header()] = "") -> None:
    """Guards the /internal routes that only the agent runtime may call."""
    token = settings.agent_runtime_token
    if not token or authorization != f"Bearer {token}":
        raise HTTPException(status_code=401, detail="Invalid agent runtime token")
