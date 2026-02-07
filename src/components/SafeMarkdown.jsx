import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Typography, Box, Link, Divider } from '@mui/material';
import { alpha } from '@mui/material/styles';

/**
 * AIの出力を「Simple & Pop」に表示するラッパーコンポーネント
 * MUIシステムに準拠し、読みやすさを最適化
 */
export const SafeMarkdown = ({ content }) => {
  if (!content) return null;

  return (
    <Box 
      className="markdown-body"
      sx={{ 
        '& h1, & h2, & h3, & h4, & h5, & h6': { overflowWrap: 'break-word', lineHeight: 1.4 },
        '& p, & ul, & ol': { overflowWrap: 'break-word' },
        fontFamily: '"Noto Sans JP", "Helvetica", "Arial", sans-serif',
        // リストのネスト対応
        '& ul ul, & ol ul, & ul ol, & ol ol': { mb: 0 }
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 見出し (H1): インディゴの下線付き
          h1: ({node, ...props}) => (
            <Typography 
              variant="h5" 
              component="h1"
              sx={{ 
                fontWeight: 800, 
                mt: 4, mb: 2, pb: 1,
                color: 'primary.dark',
                borderBottom: '2px solid',
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                fontSize: { xs: '1.4rem', md: '1.6rem' }
              }} 
              {...props} 
            />
          ),
          // 見出し (H2): シンプルな下線
          h2: ({node, ...props}) => (
            <Typography 
              variant="h6" 
              component="h2"
              sx={{ 
                fontWeight: 700, 
                mt: 3, mb: 2, pb: 1,
                color: 'text.primary',
                borderBottom: '1px solid',
                borderColor: 'divider',
                fontSize: { xs: '1.2rem', md: '1.3rem' }
              }} 
              {...props} 
            />
          ),
          // 見出し (H3): 左線アクセントと背景
          h3: ({node, ...props}) => (
            <Box 
              component="h3"
              sx={{ 
                fontSize: '1rem',
                fontWeight: 700, 
                mt: 3, mb: 1.5, 
                pl: 2, py: 0.5,
                borderLeft: '4px solid',
                borderColor: 'primary.main',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                color: 'primary.dark',
                borderRadius: '0 4px 4px 0'
              }} 
              {...props} 
            />
          ),
          
          // 太字 (**text**): 蛍光マーカー風
          strong: ({node, ...props}) => (
            <Box 
              component="strong"
              sx={{ 
                fontWeight: 700,
                color: 'text.primary',
                background: 'linear-gradient(transparent 60%, rgba(255, 235, 59, 0.6) 60%)',
                px: 0.5,
                borderRadius: '2px'
              }} 
              {...props} 
            />
          ),

          // 段落 (p)
          p: ({node, ...props}) => (
            <Typography 
              variant="body1" 
              component="p"
              sx={{ 
                mb: 2, 
                lineHeight: 1.8, 
                color: 'text.secondary',
                fontSize: '0.95rem'
              }} 
              {...props} 
            />
          ),

          // リスト (ul/ol)
          ul: ({node, ...props}) => (
            <Box 
              component="ul" 
              sx={{ 
                pl: 3, mb: 2, 
                listStyleType: 'disc',
                '& li': { mb: 0.5, pl: 0.5 }
              }} 
              {...props} 
            />
          ),
          ol: ({node, ...props}) => (
            <Box 
              component="ol" 
              sx={{ 
                pl: 3, mb: 2, 
                listStyleType: 'decimal',
                '& li': { mb: 0.5, pl: 0.5 }
              }} 
              {...props} 
            />
          ),
          li: ({node, ...props}) => (
            <li style={{ lineHeight: 1.7, color: '#475569' }} {...props} />
          ),

          // 引用 (blockquote)
          blockquote: ({node, ...props}) => (
            <Box 
              component="blockquote"
              sx={{ 
                borderLeft: '4px solid',
                borderColor: 'grey.300',
                pl: 2, py: 1, my: 3,
                bgcolor: 'grey.50',
                color: 'text.secondary',
                fontStyle: 'italic',
                borderRadius: '0 4px 4px 0'
              }} 
              {...props} 
            />
          ),
          
          // インラインコード (`code`)
          code: ({node, inline, className, children, ...props}) => {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              // ブロックコード (簡易表示)
              <Box 
                component="pre" 
                sx={{ 
                  bgcolor: '#1e293b', 
                  color: '#f8fafc', 
                  p: 2, 
                  borderRadius: 2, 
                  overflowX: 'auto', 
                  mb: 3, 
                  fontSize: '0.85em',
                  fontFamily: 'monospace'
                }}
              >
                <code className={className} {...props}>
                  {children}
                </code>
              </Box>
            ) : (
              // インラインコード
              <Box 
                component="code" 
                sx={{ 
                  bgcolor: 'grey.100', 
                  color: '#d32f2f', 
                  px: 0.6, py: 0.2, 
                  borderRadius: 1, 
                  fontSize: '0.85em',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  mx: 0.5
                }} 
                {...props}
              >
                {children}
              </Box>
            );
          },

          // リンク
          a: ({node, ...props}) => (
            <Link 
              target="_blank" 
              rel="noopener noreferrer" 
              underline="hover"
              sx={{ color: 'primary.main', fontWeight: 600 }} 
              {...props} 
            />
          ),
          
          // 水平線
          hr: ({node, ...props}) => (
            <Divider sx={{ my: 4 }} {...props} />
          ),

          // テーブル (簡易対応)
          table: ({node, ...props}) => (
            <Box sx={{ overflowX: 'auto', mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
               <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }} {...props} />
            </Box>
          ),
          thead: ({node, ...props}) => <thead style={{ backgroundColor: '#f8fafc' }} {...props} />,
          tbody: ({node, ...props}) => <tbody {...props} />,
          tr: ({node, ...props}) => <tr style={{ borderBottom: '1px solid #e2e8f0' }} {...props} />,
          th: ({node, ...props}) => <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#475569' }} {...props} />,
          td: ({node, ...props}) => <td style={{ padding: '12px', color: '#334155' }} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};