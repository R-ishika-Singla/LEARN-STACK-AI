import React from 'react';
import { Bookmark } from 'lucide-react';
import SourceBadge from './SourceBadge';

export default function ChatMessage({ message, onSaveToDeck }) {
  const { role, content, sources, timestamp, isError } = message;
  const isUser = role === "user";

  const renderContent = (text) => {
    if (!text) return null;
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />')
      .replace(/`(.*?)`/g, '<code class="bg-gray-700/50 px-1 rounded text-purple-300 text-xs font-mono">$1</code>');
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="flex flex-col items-end max-w-[70%]">
          <div className={`px-4 py-3 rounded-[18px_18px_4px_18px] text-sm leading-relaxed whitespace-pre-wrap ${
            isError ? 'bg-red-500 text-white' : 'bg-[#6C63FF] text-white'
          }`}>
            {content}
          </div>
          <div className="text-[11px] text-gray-400 text-right mt-1">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-[#6C63FF] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
        CB
      </div>
      <div className="flex-1 flex flex-col items-start max-w-[85%]">
        <div className="px-4 py-3 rounded-[18px_18px_18px_4px] text-sm leading-relaxed dark:bg-[#22263A] bg-gray-100 dark:text-gray-100 text-gray-800">
          {renderContent(content)}
        </div>
        
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {sources.map((source, i) => (
              <SourceBadge key={i} source={source} />
            ))}
          </div>
        )}
        
        <div className="w-full flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-500">
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button 
            onClick={() => onSaveToDeck && onSaveToDeck(message)}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-purple-400 transition-colors"
          >
            <Bookmark size={12} />
            <span>Save to deck</span>
          </button>
        </div>
        <div className="w-full text-[10px] text-gray-600 dark:text-gray-600 text-right mt-1">
          Powered by Groq
        </div>
      </div>
    </div>
  );
}
