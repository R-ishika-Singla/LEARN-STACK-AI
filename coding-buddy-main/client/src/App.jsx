import { useState, useEffect, useRef } from "react";
import { Menu, Sun, Moon, X, Send } from "lucide-react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import StudyDeck from "./components/StudyDeck";
import Toast, { useToast } from "./components/Toast";
import useChat from "./hooks/useChat";
import useDocuments from "./hooks/useDocuments";
import useDecks from "./hooks/useDecks";

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showDecks, setShowDecks] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [savingMessage, setSavingMessage] = useState(null);

  const { toasts, addToast, removeToast } = useToast();
  const { messages, isLoading, sendMessage, clearMessages } = useChat();
  const { documents, selectedDocId, loading, selectDocument, deleteDocument, addDocument } = useDocuments();
  const { decks, createDeck, deleteDeck, saveCard, deleteCard } = useDecks();

  useEffect(() => {
    const saved = localStorage.getItem('coding_buddy_theme');
    if (saved === 'light') { 
      setDarkMode(false); 
      document.documentElement.classList.remove('dark'); 
    } else { 
      setDarkMode(true); 
      document.documentElement.classList.add('dark'); 
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('coding_buddy_theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    if (window.innerWidth < 768) setSidebarOpen(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleUploadSuccess = (doc) => {
    addDocument(doc);
    selectDocument(doc.id);
    addToast(`"${doc.name}" uploaded successfully! ${(doc.wordCount || 0).toLocaleString()} words processed.`, "success");
  };

  const handleDeleteDocument = async (id) => {
    const ok = await deleteDocument(id);
    if (ok) {
      addToast("Document removed", "success");
    } else {
      addToast("Failed to delete document", "error");
    }
    if (selectedDocId === id) clearMessages();
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !selectedDocId || isLoading) return;
    const question = inputValue.trim();
    setInputValue("");
    await sendMessage(question, selectedDocId);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      handleSendMessage(); 
    }
  };

  const handleSaveToDeck = (message) => {
    if (decks.length === 0) {
      addToast("Create a study deck first!", "error");
      setShowDecks(true);
      return;
    }
    setSavingMessage(message);
    setShowDecks(true);
  };

  const handleSaveCardToDeck = (deckId) => {
    if (!savingMessage) return;
    const lastUserMsg = messages.slice().reverse().find(m => m.role === "user");
    saveCard(deckId, {
      id: Date.now().toString(),
      question: lastUserMsg?.content || "Question",
      answer: savingMessage.content,
      sources: savingMessage.sources || [],
      savedAt: new Date().toISOString()
    });
    addToast("Saved to deck!", "success");
    setSavingMessage(null);
  };

  const handleCreateDeck = (name, subject) => {
    const id = createDeck(name, subject);
    addToast(`Deck "${name}" created!`, "success");
    return id;
  };

  const selectedDoc = documents.find(d => d.id === selectedDocId);
  const textareaRef = useRef(null);
  
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [inputValue]);

  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-200 ${darkMode ? 'dark bg-[#0F1117] text-white' : 'bg-[#F8F9FC] text-gray-900'}`}>
      
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity" onClick={() => setSidebarOpen(false)}></div>
      )}

      <div className={`fixed inset-y-0 left-0 z-50 md:relative md:flex transition-transform duration-300 ease-in-out flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <Sidebar
          documents={documents}
          selectedDocId={selectedDocId}
          loading={loading}
          onSelect={selectDocument}
          onDelete={handleDeleteDocument}
          onUploadSuccess={handleUploadSuccess}
          onOpenDecks={() => setShowDecks(true)}
          darkMode={darkMode}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        <div className="h-14 flex items-center justify-between px-4 border-b dark:border-gray-700/30 border-gray-200 flex-shrink-0 dark:bg-[#0F1117]/80 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 rounded-lg dark:hover:bg-gray-700/50 hover:bg-gray-100 transition-colors"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="w-8 h-8 rounded-full bg-[#6C63FF] flex items-center justify-center text-white text-xs font-bold">
              CB
            </div>
            <span className="font-semibold text-base" style={{ fontFamily: 'Space Grotesk' }}>Coding Buddy</span>
            {selectedDoc && (
              <>
                <span className="text-gray-400">&middot;</span>
                <span className="text-sm text-gray-400 max-w-[150px] truncate">{selectedDoc.name}</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleDarkMode}
              className="p-2 rounded-lg dark:hover:bg-gray-700/50 hover:bg-gray-100 transition-colors"
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            onSaveToDeck={handleSaveToDeck}
          />
        </div>

        <div className="px-4 py-3 border-t dark:border-gray-700/30 border-gray-200 dark:bg-[#0F1117] bg-white flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {!selectedDocId ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl dark:bg-[#1A1D27] bg-gray-100 border dark:border-gray-700/50 border-gray-200 opacity-60">
                <span className="text-sm text-gray-500">Select a document from the sidebar to start asking questions...</span>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-3 px-4 py-3 rounded-2xl dark:bg-[#1A1D27] bg-gray-100 border dark:border-gray-600/50 border-gray-300 focus-within:border-[#6C63FF] transition-colors duration-150">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={`Ask anything about ${selectedDoc?.name || "your document"}...`}
                    rows={1}
                    style={{ resize: "none", minHeight: "24px", maxHeight: "120px" }}
                    className="flex-1 bg-transparent outline-none text-sm dark:text-gray-200 text-gray-700 dark:placeholder-gray-500 placeholder-gray-400 leading-relaxed"
                  />
                  {inputValue.length > 200 && (
                    <span className="text-xs text-gray-500 self-end mb-0.5">{inputValue.length}</span>
                  )}
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className={`p-2 rounded-xl transition-all duration-150 flex-shrink-0 self-end ${
                      !inputValue.trim() || isLoading
                        ? 'dark:bg-gray-700 bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#6C63FF] hover:bg-[#5A52E0] text-white'
                    }`}
                  >
                    <Send size={16} />
                  </button>
                </div>
                <div className="text-xs text-gray-600 text-center mt-2">
                  Ctrl+K to focus &middot; Enter to send &middot; Shift+Enter for new line
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {showDecks && (
        <StudyDeck
          decks={decks}
          onClose={() => { setShowDecks(false); setSavingMessage(null); }}
          onCreateDeck={handleCreateDeck}
          onDeleteDeck={deleteDeck}
          onDeleteCard={deleteCard}
          onSaveCard={savingMessage ? handleSaveCardToDeck : null}
          savingMessage={savingMessage}
        />
      )}

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
