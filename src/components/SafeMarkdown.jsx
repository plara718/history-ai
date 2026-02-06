import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * AIの出力を「Simple & Pop」に表示するラッパーコンポーネント
 * * - **太字**: 黄色のマーカー風ハイライト
 * - 見出し: 左線アクセントと背景色
 * - リスト: 読みやすい行間
 * - 表組み: GFM対応
 */
export const SafeMarkdown = ({ content }) => {
  if (!content) return null;

  return (
    <div className="text-gray-800 leading-relaxed text-sm md:text-base break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 見出し (H1-H3): ポップな左線と背景
          h1: ({node, ...props}) => (
            <h1 className="text-2xl font-bold mt-8 mb-4 pb-2 border-b-2 border-indigo-100 text-indigo-900" {...props} />
          ),
          h2: ({node, ...props}) => (
            <h2 className="text-xl font-bold mt-8 mb-4 pb-2 border-b border-indigo-100 text-slate-800" {...props} />
          ),
          h3: ({node, ...props}) => (
            <h3 className="text-lg font-bold mt-6 mb-3 pl-3 border-l-4 border-indigo-500 text-indigo-900 bg-indigo-50 py-2 rounded-r-md" {...props} />
          ),
          
          // 太字 (**text**): 黄色マーカー風
          strong: ({node, ...props}) => (
            <strong className="font-bold bg-yellow-200/80 px-1 rounded text-gray-900 mx-0.5 box-decoration-clone" {...props} />
          ),

          // 段落 (p): 文字の壁を防ぐための行間
          p: ({node, ...props}) => (
            <p className="mb-4 leading-7 text-slate-700" {...props} />
          ),

          // リスト (ul/ol): インデントを見やすく
          ul: ({node, ...props}) => (
            <ul className="list-disc list-outside ml-5 mb-4 space-y-2 text-slate-700" {...props} />
          ),
          ol: ({node, ...props}) => (
            <ol className="list-decimal list-outside ml-5 mb-4 space-y-2 text-slate-700" {...props} />
          ),
          li: ({node, ...props}) => (
            <li className="pl-1" {...props} />
          ),

          // 引用 (>)
          blockquote: ({node, ...props}) => (
            <blockquote className="border-l-4 border-slate-300 pl-4 py-2 my-4 bg-slate-50 text-slate-600 italic rounded-r" {...props} />
          ),
          
          // コードブロック
          code: ({node, inline, className, children, ...props}) => {
            return inline ? (
              <code className="bg-slate-100 text-red-500 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg overflow-x-auto mb-4 text-xs md:text-sm font-mono">
                <code {...props}>{children}</code>
              </pre>
            );
          },

          // リンク
          a: ({node, ...props}) => (
            <a className="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          
          // 水平線
          hr: ({node, ...props}) => (
            <hr className="my-8 border-t-2 border-slate-100" {...props} />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};