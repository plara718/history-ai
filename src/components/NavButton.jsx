import React from 'react';
import { ButtonBase, Typography, Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';

// App.jsx で import { NavButton } ... としているため、named export にします
export const NavButton = ({ active, icon: Icon, label, onClick }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      borderRadius: 4, // テーマに合わせて少し丸く
      p: 1,
      minWidth: 72,
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      '&:hover': {
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
        transform: 'translateY(-2px)'
      },
      '&:active': {
        transform: 'scale(0.95)'
      }
    }}
  >
    <Stack alignItems="center" spacing={0.5}>
      <Box
        sx={{
          p: 1,
          borderRadius: 3, 
          bgcolor: (theme) => active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
          color: active ? 'primary.main' : 'text.disabled',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Lucide Icon */}
        <Icon 
          size={24} 
          style={{ 
            // アクティブ時は塗りつぶし風にする（Lucideの仕様による）
            fill: active ? 'currentColor' : 'none', 
            fillOpacity: active ? 0.2 : 0,
            strokeWidth: active ? 2.5 : 2,
            transition: 'all 0.3s'
          }} 
        />
      </Box>
      
      
      <Typography
        variant="caption"
        sx={{
          fontWeight: active ? 800 : 500,
          color: active ? 'primary.main' : 'text.secondary',
          transition: 'color 0.3s, font-weight 0.3s',
          fontSize: '0.65rem',
          letterSpacing: '0.02em'
        }}
      >
        {label}
      </Typography>
    </Stack>
  </ButtonBase>
);