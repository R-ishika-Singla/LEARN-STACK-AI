import React from 'react';
import { BookOpen, ChevronRight, Trash2 } from 'lucide-react';
import FileUpload from './FileUpload';

export default function Sidebar({ 
  documents = [], 
  selectedDocId, 
  loading, 
  onSelect, 
  onDelete, 
  onUploadSuccess, 
  onOpenDecks, 
  darkMode 
}) {
  return (
    <div className={`h-full flex flex-col w-[280px] flex-shrink-0 ${darkMode ? 'bg-[#1A1D27]' : 'bg-white border-r border-gray-200'}`}>
      <div className="px-4 pt-4 pb-3 border-b dark:border-gray-700/50">
        <h2 className="font-['Space_Grotesk'] font-semibold text-sm uppercase tracking-widest text-gray-400 mb-3">Study Library</h2>
        <FileUpload onUploadSuccess={onUploadSuccess} onError={(msg) => console.error(msg)} />
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 py-3">
        <div className="text-xs uppercase tracking-wider text-gray-500 px-1 mb-2">Documents</div>
        
        {loading && (
          <>
            <div className="animate-pulse h-16 rounded-xl dark:bg-gray-700/50 bg-gray-200 mb-2"></div>
            <div className="animate-pulse h-16 rounded-xl dark:bg-gray-700/50 bg-gray-200 mb-2"></div>
            <div className="animate-pulse h-16 rounded-xl dark:bg-gray-700/50 bg-gray-200 mb-2"></div>
          </>
        )}

        {!loading && documents.length === 0 && (
          <div className="text-xs text-gray-500 text-center py-8 flex flex-col gap-1">
            <span>No documents yet</span>
            <span>Upload a file above</span>
          </div>
        )}

        {!loading && documents.map(doc => {
          const isSelected = doc.id === selectedDocId;
          const ext = doc.type ? doc.type.toLowerCase() : "";
          let dotColor = "bg-gray-400";
          if (ext === "pdf") dotColor = "bg-red-400";
          else if (ext === "pptx") dotColor = "bg-orange-400";
          else if (ext === "png" || ext === "jpg" || ext === "jpeg") dotColor = "bg-green-400";

          return (
            <div 
              key={doc.id}
              onClick={() => onSelect(doc.id)}
              className={`rounded-xl p-3 mb-2 cursor-pointer transition-all duration-150 relative group ${
                isSelected 
                  ? 'dark:bg-purple-500/20 bg-purple-50 border border-purple-500/40' 
                  : 'dark:bg-[#22263A]/60 bg-gray-50 border border-transparent dark:hover:bg-[#22263A] hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}></div>
                  <div className="text-sm font-medium truncate max-w-[160px] dark:text-gray-200 text-gray-700">
                    {doc.name}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                <span>{doc.pages} pages</span>
                <span>·</span>
                <span>{doc.wordCount?.toLocaleString() || 0} words</span>
                <span>·</span>
                <span>{new Date(doc.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 pb-4 border-t dark:border-gray-700/50 pt-3">
        <button 
          onClick={() => onOpenDecks()}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl dark:bg-[#22263A] bg-gray-100 hover:bg-purple-500/20 dark:hover:bg-purple-500/20 transition-colors cursor-pointer"
        >
          <BookOpen size={16} className="text-purple-400" />
          <span className="text-sm font-medium dark:text-gray-300 text-gray-600">My Study Decks</span>
          <ChevronRight size={14} className="text-gray-500 ml-auto" />
        </button>
      </div>
    </div>
  );
}
