import os
import json
import uuid
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil

from services import parser, embedder, vector_store
from utils import chunker

router = APIRouter()

ALLOWED_EXTENSIONS = {"pdf", "pptx", "png", "jpg", "jpeg"}
TEMP_DIR = os.path.join(os.path.dirname(__file__), "..", "temp")
DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "docs.json")

@router.post("")
async def upload_file(file: UploadFile = File(...)):
    try:
        filename = file.filename
        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Unsupported file extension")

        os.makedirs(TEMP_DIR, exist_ok=True)
        temp_path = os.path.join(TEMP_DIR, file.filename)
        
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        doc_id = str(uuid.uuid4())
        
        parsed_pages = parser.parse_file(temp_path, ext)
        
        all_chunks_data = []
        all_textsForEmbedding = []
        all_metadata = []
        total_words = 0
        total_pages = len(parsed_pages)

        for page_data in parsed_pages:
            page_num = page_data["page"]
            page_text = page_data["text"]
            
            chunks = chunker.chunk_text(page_text)
            for chunk in chunks:
                all_chunks_data.append({"text": chunk["text"]})
                all_textsForEmbedding.append(chunk["text"])
                all_metadata.append({
                    "doc_id": doc_id,
                    "filename": filename,
                    "page": page_num,
                    "chunk_index": chunk["chunk_index"],
                    "file_type": ext
                })
                total_words += chunk["word_count"]

        if all_textsForEmbedding:
            embeddings = embedder.embed_texts(all_textsForEmbedding)
            vector_store.add_chunks(doc_id, all_chunks_data, embeddings, all_metadata)

        doc_entry = {
            "id": doc_id,
            "name": filename,
            "uploadedAt": datetime.now().isoformat(),
            "pages": total_pages,
            "wordCount": total_words,
            "type": ext
        }

        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r") as f:
                try:
                    docs_list = json.load(f)
                except:
                    docs_list = []
        else:
            docs_list = []
            
        docs_list.append(doc_entry)
        
        with open(DATA_FILE, "w") as f:
            json.dump(docs_list, f, indent=2)

        os.remove(temp_path)

        return {
            "success": True,
            "document": doc_entry
        }

    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=str(e))
