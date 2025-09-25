from app.core.db import engine
from app.models.database import Base

print("Engine from app.core.db:", engine)
print("Base metadata tables:", Base.metadata.tables.keys())
