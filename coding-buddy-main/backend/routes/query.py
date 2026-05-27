import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from groq import Groq

from services import embedder, vector_store

router = APIRouter()

class QueryRequest(BaseModel):
    question: str
    document_id: str

@router.post("")
async def query_document(req: QueryRequest):
    if not req.question or not req.document_id:
        raise HTTPException(status_code=400, detail="Missing question or document_id")
        
    try:
        query_embedding = embedder.embed_texts([req.question])[0]
        results = vector_store.query_chunks(req.document_id, query_embedding, n_results=3)
        
        if not results:
            return {
                "answer": "I could not find this in your study material.",
                "sources": []
            }
            
        context_parts = []
        sources = []
        seen_sources = set()
        
        for res in results:
            context_parts.append(res["text"])
            meta = res["metadata"]
            
            source_key = (meta.get("filename"), meta.get("page"))
            if source_key not in seen_sources:
                seen_sources.add(source_key)
                sources.append({
                    "file": meta.get("filename"),
                    "page": meta.get("page"),
                    "type": meta.get("file_type")
                })
                
        context = "\n\n---\n\n".join(context_parts)
        
        groq_api_key = os.getenv("GROQ_API_KEY")
        if not groq_api_key:
            raise Exception("GROQ_API_KEY is not set.")
            
        client = Groq(api_key=groq_api_key)
        system_prompt = "You are a helpful study assistant. Answer the user's question using only the provided context. If the answer is not in the context, say 'I could not find this in your study material.' Always be concise and clear."
        user_message = f"Context:\n{context}\n\nQuestion: {req.question}"
        
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
        )
        
        answer = response.choices[0].message.content
        
        return {
            "answer": answer,
            "sources": sources
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
