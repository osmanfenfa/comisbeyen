"""
Test configuration — in-memory / file SQLite DB so tests run without external Postgres.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
settings.APP_ENV = "testing"

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.db.seed import seed_database

TEST_DATABASE_URL = "sqlite:///./test_comis.db"

test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=test_engine)
    if os.path.exists("./test_comis.db"):
        try:
            os.remove("./test_comis.db")
        except Exception:
            pass


@pytest.fixture
def db():
    database = TestingSessionLocal()
    yield database
    database.close()


@pytest.fixture
def client(setup_test_db):
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
