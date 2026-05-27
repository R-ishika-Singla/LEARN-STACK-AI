import os
import json
from fastapi import APIRouter

from services import vector_store

router = APIRouter()

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "docs.json")

@router.get("")
async def get_documents():
    if not os.path.exists(DATA_FILE):
        return []
    try:
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    except:
        return []

@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r") as f:
                docs = json.load(f)
        except:
            docs = []
            
        filtered_docs = [doc for doc in docs if doc.get("id") != doc_id]
        
        with open(DATA_FILE, "w") as f:
            json.dump(filtered_docs, f, indent=2)
            
    vector_store.delete_collection(doc_id)
    return {"success": True}
