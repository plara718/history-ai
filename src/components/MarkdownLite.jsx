import React from 'react';

const MarkdownLite = ({ text }) => {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="text-slate-700 leading-loose tracking-wide text-base">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        
        // 太字 (**text**) の解析
        const parseBold = (str) => {
          const parts = str.split(/(\*\*.*?\*\*)/g);
          return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="font-bold text-slate-900 bg-yellow-100/60 px-1 rounded mx-0.5">{part.slice(2, -2)}</strong>;
            }
            return part;
          });
        };

        // 見出し (### )
        if (trimmed.startsWith('### ')) {
            return (
                <h3 key={index} className="text-lg font-bold text-slate-800 mt-6 mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-indigo-400 rounded-full"></span>
                    {parseBold(trimmed.replace('### ', ''))}
                </h3>
            );
        }
        
        // 見出し (## )
        if (trimmed.startsWith('## ')) {
            return (
                <h2 key={index} className="text-xl font-bold text-slate-800 mt-8 mb-4 pb-2 border-b border-indigo-100 flex items-center gap-2">
                    {parseBold(trimmed.replace('## ', ''))}
                </h2>
            );
        }

        // 見出し (# )
        if (trimmed.startsWith('# ')) {
            return (
                <h1 key={index} className="text-2xl font-bold text-slate-900 mt-8 mb-6 text-center">
                    {parseBold(trimmed.replace('# ', ''))}
                </h1>
            );
        }

        // リスト (- )
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
                <div key={index} className="flex items-start gap-2 mb-2 ml-2">
                    <span className="text-indigo-400 mt-2.5 text-xs">●</span>
                    <p className="m-0 flex-1">{parseBold(trimmed.replace(/^[-*]\s+/, ''))}</p>
                </div>
            );
        }

        // 番号付きリスト (1. )
        if (/^\d+\.\s/.test(trimmed)) {
            return (
                <div key={index} className="flex items-start gap-2 mb-2 ml-2">
                    <span className="text-indigo-600 font-bold mt-0.5 min-w-[1.5rem]">{trimmed.match(/^\d+\./)[0]}</span>
                    <p className="m-0 flex-1">{parseBold(trimmed.replace(/^\d+\.\s+/, ''))}</p>
                </div>
            );
        }

        // 引用 (> )
        if (trimmed.startsWith('> ')) {
            return (
                <blockquote key={index} className="border-l-4 border-slate-300 pl-4 py-1 my-4 bg-slate-50 text-slate-600 italic">
                    {parseBold(trimmed.replace('> ', ''))}
                </blockquote>
            );
        }

        // 空行
        if (trimmed === '') {
            return <div key={index} className="h-4"></div>;
        }

        // 通常の段落
        return (
            <p key={index} className="mb-2">
                {parseBold(line)}
            </p>
        );
      })}
    </div>
  );
};

export default MarkdownLite;