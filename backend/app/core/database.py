from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import get_settings


settings = get_settings()

DATABASE_URL = settings.database_url

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
	"""FastAPI dependency that yields a database session and closes it afterwards."""
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()

