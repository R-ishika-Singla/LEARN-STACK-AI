import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load from local .env first, then parent directories
load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

from routes import upload, query, documents

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DATA_FILE = os.path.join(DATA_DIR, "docs.json")

app = FastAPI(title="Coding Buddy API")

# Get CORS origins from environment variable
CORS_ORIGINS = os.getenv("CODINGBUDDY_CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000").split(",")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS]

@app.on_event("startup")
async def startup_event():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w") as f:
            json.dump([], f)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/upload")
app.include_router(query.router, prefix="/query")
app.include_router(documents.router, prefix="/documents")

@app.get("/")
def health_check():
    return {"status": "Coding Buddy API is running"}
