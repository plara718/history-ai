import React from 'react';
import { ButtonBase, Typography, Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';

const NavButton = ({ active, icon: Icon, label, onClick }) => (
  <ButtonBase
    onClick={onClick}
    sx={{
      borderRadius: 3,
      p: 1,
      minWidth: 68,
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
          borderRadius: '16px', // 柔らかい印象の角丸
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
        {/* アイコン表示: Lucide React対応 */}
        <Icon 
          size={24} 
          style={{ 
            fill: active ? 'currentColor' : 'none', // アクティブ時は塗りつぶし
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
          fontSize: '0.7rem',
          letterSpacing: '0.02em'
        }}
      >
        {label}
      </Typography>
    </Stack>
  </ButtonBase>
);

export default NavButton;