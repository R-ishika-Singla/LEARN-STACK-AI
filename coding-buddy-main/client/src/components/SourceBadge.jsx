import React from 'react';

export default function SourceBadge({ source }) {
  if (!source) return null;
  const { file, page, type } = source;
  
  const ext = type ? type.toLowerCase() : "";
  let dotColor = "bg-gray-400";
  if (ext === "pdf") dotColor = "bg-red-400";
  else if (ext === "pptx") dotColor = "bg-orange-400";
  else if (ext === "png" || ext === "jpg" || ext === "jpeg") dotColor = "bg-green-400";

  const truncatedFile = file && file.length > 20 ? file.substring(0, 20) + "..." : file;

  return (
    <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 rounded-full px-3 py-1 text-xs font-medium inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      {truncatedFile} &middot; p.{page}
    </span>
  );
}
