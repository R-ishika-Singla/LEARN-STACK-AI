import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function useDocuments() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error("Failed to fetch documents", error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const deleteDocument = async (id) => {
    try {
      await axios.delete(`${API_URL}/documents/${id}`);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      return true;
    } catch (error) {
      console.error("Failed to delete document", error);
      return false;
    }
  };

  const selectDocument = (id) => {
    setSelectedDocId(id);
  };

  const addDocument = (doc) => {
    setDocuments(prev => [...prev, doc]);
  };

  return { 
    documents, 
    selectedDocId, 
    loading, 
    fetchDocuments, 
    deleteDocument, 
    selectDocument, 
    addDocument 
  };
}
