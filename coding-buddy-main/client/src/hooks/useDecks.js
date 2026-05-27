import { useState, useEffect } from 'react';

export default function useDecks() {
  const [decks, setDecks] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("coding_buddy_decks");
    if (saved) {
      try {
        setDecks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse decks", e);
        setDecks([]);
      }
    }
  }, []);

  const saveToStorage = (newDecks) => {
    setDecks(newDecks);
    localStorage.setItem("coding_buddy_decks", JSON.stringify(newDecks));
  };

  const createDeck = (name, subject) => {
    const id = Date.now().toString();
    const newDeck = { id, name, subject, cards: [] };
    saveToStorage([...decks, newDeck]);
    return id;
  };

  const deleteDeck = (id) => {
    saveToStorage(decks.filter(d => d.id !== id));
  };

  const saveCard = (deckId, card) => {
    const newDecks = decks.map(deck => {
      if (deck.id === deckId) {
        return {
          ...deck,
          cards: [...(deck.cards || []), card]
        };
      }
      return deck;
    });
    saveToStorage(newDecks);
  };

  const deleteCard = (deckId, cardId) => {
    const newDecks = decks.map(deck => {
      if (deck.id === deckId) {
        return {
          ...deck,
          cards: deck.cards.filter(c => c.id !== cardId)
        };
      }
      return deck;
    });
    saveToStorage(newDecks);
  };

  return { decks, createDeck, deleteDeck, saveCard, deleteCard };
}
