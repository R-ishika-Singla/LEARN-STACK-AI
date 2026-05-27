import React, { useState } from 'react';
import { BookOpen, X, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import SourceBadge from './SourceBadge';

export default function StudyDeck({ decks = [], onClose, onCreateDeck, onDeleteDeck, onDeleteCard, onSaveCard }) {
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckSubject, setNewDeckSubject] = useState("CS");
  const [expandedDeckId, setExpandedDeckId] = useState(null);

  const toggleDeck = (id) => {
    if (expandedDeckId === id) setExpandedDeckId(null);
    else setExpandedDeckId(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
      
      <div className="relative z-10 dark:bg-[#1A1D27] bg-white rounded-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            <BookOpen className="text-purple-500" size={20} />
            <h2 className="font-['Space_Grotesk'] font-semibold text-lg dark:text-white">My Study Decks</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-4">
          <div className="mb-3 text-xs uppercase tracking-wider text-gray-500">Create New Deck</div>
          <input 
            type="text" 
            placeholder="Deck name e.g. React Hooks" 
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            className="dark:bg-[#22263A] bg-gray-100 rounded-xl px-3 py-2 text-sm w-full mb-2 dark:text-gray-200 text-gray-700 outline-none dark:border-gray-600 border dark:focus:border-purple-500 focus:border-purple-400 transition-colors"
          />
          <select 
            value={newDeckSubject}
            onChange={(e) => setNewDeckSubject(e.target.value)}
            className="dark:bg-[#22263A] bg-gray-100 rounded-xl px-3 py-2 text-sm w-full mb-2 dark:text-gray-200 text-gray-700 outline-none dark:border-gray-600 border"
          >
            <option value="CS">CS</option>
            <option value="Math">Math</option>
            <option value="Science">Science</option>
            <option value="Language">Language</option>
            <option value="Other">Other</option>
          </select>
          <button 
            onClick={() => { 
              if(newDeckName.trim()) { 
                onCreateDeck(newDeckName.trim(), newDeckSubject); 
                setNewDeckName(''); 
              }
            }}
            disabled={!newDeckName.trim()}
            className={`w-full bg-[#6C63FF] hover:bg-[#5A52E0] text-white rounded-xl py-2 text-sm font-medium transition-colors ${!newDeckName.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Create Deck
          </button>

          <div className="my-4 border-t dark:border-gray-700/50"></div>

          <div className="mb-2 flex items-center justify-between text-xs tracking-wider text-gray-500 uppercase">
            <span>Your Decks</span>
            <span className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">{decks.length}</span>
          </div>

          {decks.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-6">
              No decks yet. Create one above!
            </div>
          )}

          {decks.map(deck => {
            const isExpanded = expandedDeckId === deck.id;
            return (
              <div key={deck.id} className="mb-2">
                <div 
                  onClick={() => toggleDeck(deck.id)}
                  className="flex items-center justify-between p-3 rounded-xl dark:bg-[#22263A]/60 bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    <span className="font-medium text-sm dark:text-gray-200 text-gray-700">{deck.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">{deck.subject}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {onSaveCard && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSaveCard(deck.id); }}
                        className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded"
                      >
                        Save here
                      </button>
                    )}
                    <span className="text-xs text-gray-500">{deck.cards?.length || 0} cards</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteDeck(deck.id); }}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isExpanded && deck.cards && deck.cards.length > 0 && (
                  <div className="mt-2">
                    {deck.cards.map(card => (
                      <div key={card.id} className="dark:bg-[#0F1117]/60 bg-white rounded-xl p-3 mb-2 ml-3 border dark:border-gray-700/30 border-gray-200">
                        <div className="text-sm font-medium dark:text-gray-200 mb-1">{card.question}</div>
                        <div className="text-xs text-gray-400 line-clamp-3 mb-2">{card.answer}</div>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex flex-wrap gap-1">
                            {card.sources?.map((src, i) => (
                              <SourceBadge key={i} source={src} />
                            ))}
                          </div>
                          <button 
                            onClick={() => onDeleteCard(deck.id, card.id)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isExpanded && (!deck.cards || deck.cards.length === 0) && (
                  <div className="ml-3 p-3 text-xs text-gray-500 text-center border border-dashed dark:border-gray-700 border-gray-300 rounded-xl mb-2">
                    Empty deck
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
