import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (question, docId) => {
    if (!question || !docId) return;

    const userMessage = { 
      id: Date.now().toString() + "_user", 
      role: 'user', 
      content: question, 
      timestamp: new Date().toISOString() 
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/query`, {
        question: question,
        document_id: docId
      });

      const assistantMessage = {
        id: Date.now().toString() + "_assistant",
        role: 'assistant',
        content: response.data.answer,
        sources: response.data.sources,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error", error);
      const errorMessage = {
        id: Date.now().toString() + "_error",
        role: 'assistant',
        content: "Sorry, I encountered an error while processing your request.",
        isError: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return { messages, isLoading, sendMessage, clearMessages };
}
