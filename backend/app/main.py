from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import pre, projects, takeoff
from .core.config import Settings, get_settings
from .db import connect, init_db
from .modules.takeoff import elements  # noqa: F401  (registers every element)

ROUTERS = (projects.router, pre.router, takeoff.router)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings.storage_root.mkdir(parents=True, exist_ok=True)
        conn = connect(settings.database_path)
        init_db(conn)
        conn.close()
        yield

    app = FastAPI(title="BOQ Task Core API", lifespan=lifespan)
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in ROUTERS:
        app.include_router(router)
    return app


app = create_app()
