import React, { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud } from 'lucide-react';
import Spinner from './Spinner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function FileUpload({ onUploadSuccess, onError }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const inputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    const name = file.name || "";
    const ext = name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'pptx', 'png', 'jpg', 'jpeg'];
    
    if (!allowed.includes(ext)) {
      if (onError) onError("Unsupported file extension");
      return;
    }

    setIsUploading(true);
    setUploadingFileName(name);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_URL}/upload`, formData);
      if (onUploadSuccess) onUploadSuccess(response.data.document);
    } catch (error) {
      const msg = error.response?.data?.detail || "Upload failed";
      if (onError) onError(msg);
    } finally {
      setIsUploading(false);
      setUploadingFileName("");
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (isUploading) {
    return (
      <div className="border border-dashed rounded-xl p-4 text-center bg-transparent border-gray-600 dark:border-gray-600 flex flex-col items-center justify-center gap-2">
        <Spinner />
        <span className="text-xs text-gray-400 mt-2">Uploading {uploadingFileName}...</span>
      </div>
    );
  }

  return (
    <>
      <input 
        type="file" 
        className="hidden" 
        ref={inputRef} 
        onChange={(e) => { 
          if(e.target.files[0]) handleFile(e.target.files[0]); 
          if(inputRef.current) inputRef.current.value = ""; 
        }} 
        accept=".pdf,.pptx,.png,.jpg,.jpeg" 
      />
      <div 
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border border-dashed rounded-xl p-4 cursor-pointer text-center transition-colors ${
          isDragging ? 'border-[#6C63FF] bg-purple-500/10' : 'border-gray-600 dark:border-gray-600 bg-transparent'
        }`}
      >
        <UploadCloud size={24} className="text-gray-400 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Drop file or click to upload</p>
        <p className="text-xs text-gray-500 mt-1">PDF, PPT, PNG, JPG</p>
      </div>
    </>
  );
}
