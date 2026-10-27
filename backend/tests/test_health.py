def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_tables_exist(conn):
    names = {row[0] for row in conn.execute("select name from sqlite_master where type = 'table'")}
    assert {"projects", "documents", "pages", "storeys", "frames", "observations", "confirmations"} <= names


def test_init_db_is_idempotent(conn):
    from app.db import init_db

    init_db(conn)
    init_db(conn)
