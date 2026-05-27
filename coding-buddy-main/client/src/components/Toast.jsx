import React, { useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

export const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const addToast = (message, type = "success") => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  return { toasts, addToast, removeToast };
};

export default function Toast({ toasts, removeToast }) {
  if (!toasts || toasts.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => {
        const isSuccess = toast.type === "success";
        return (
          <div 
            key={toast.id} 
            className={`animate-slide-up flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg min-w-64 max-w-sm border ${
              isSuccess 
                ? 'bg-green-50 dark:bg-green-900/30 border-green-400 text-green-800 dark:text-green-300' 
                : 'bg-red-50 dark:bg-red-900/30 border-red-400 text-red-800 dark:text-red-300'
            }`}
          >
            {isSuccess ? <CheckCircle size={18} /> : <XCircle size={18} />}
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="hover:opacity-75 transition-opacity">
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
