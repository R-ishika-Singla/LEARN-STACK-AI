def chunk_text(text: str, chunk_size=500, overlap=50) -> list[dict]:
    words = text.split()
    chunks = []
    
    if not words:
        return chunks
        
    start = 0
    chunk_index = 0
    
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunk_text_str = " ".join(chunk_words)
        
        if chunk_text_str.strip():
            chunks.append({
                "text": chunk_text_str,
                "chunk_index": chunk_index,
                "word_count": len(chunk_words)
            })
            chunk_index += 1
            
        if end == len(words):
            break
            
        start += (chunk_size - overlap)
        
    return chunks
