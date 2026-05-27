import chromadb

client = chromadb.PersistentClient(path="./chroma_db")

def get_or_create_collection(doc_id: str):
    return client.get_or_create_collection(name=doc_id)

def add_chunks(doc_id: str, chunks: list[dict], embeddings: list, metadata_list: list[dict]):
    collection = get_or_create_collection(doc_id)
    
    ids = []
    documents = []
    metadatas = []
    
    for i, (chunk, emb, meta) in enumerate(zip(chunks, embeddings, metadata_list)):
        ids.append(f"{doc_id}_chunk_{i}")
        documents.append(chunk["text"])
        metadatas.append(meta)
        
    if ids:
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas
        )

def query_chunks(doc_id: str, query_embedding: list[float], n_results=3) -> list[dict]:
    collection = get_or_create_collection(doc_id)
    
    try:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results
        )
    except Exception:
        return []
        
    output = []
    if results and "documents" in results and results["documents"]:
        docs = results["documents"][0]
        metas = results["metadatas"][0] if results.get("metadatas") and results["metadatas"][0] else [{}] * len(docs)
        
        for doc, meta in zip(docs, metas):
            output.append({
                "text": doc,
                "metadata": meta
            })
            
    return output

def delete_collection(doc_id: str):
    try:
        client.delete_collection(name=doc_id)
    except Exception:
        pass
