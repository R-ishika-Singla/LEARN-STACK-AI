import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import Spinner from './Spinner';

export default function ChatWindow({ messages, isLoading, onSaveToDeck }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const isEmpty = messages.length === 1 && !isLoading;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto scrollbar-hide px-4 py-4 h-full relative">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-full text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center text-3xl">
            🧠
          </div>
          <h2 className="text-xl font-semibold dark:text-white">Ask me anything</h2>
          <p className="text-sm text-gray-400 max-w-xs">
            Select a document from the sidebar, then type your question below
          </p>
        </div>
      ) : (
        <>
          {messages.map((msg, i) => (
            <ChatMessage key={msg.id || i} message={msg} onSaveToDeck={onSaveToDeck} />
          ))}
          {isLoading && (
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#6C63FF] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
                CB
              </div>
              <div className="dark:bg-[#22263A] bg-gray-100 px-4 py-3 rounded-[18px_18px_18px_4px]">
                <Spinner />
              </div>
            </div>
          )}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
