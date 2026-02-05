import React from 'react';
import { ButtonBase, Typography, Box, Stack } from '@mui/material';

const NavButton = ({ active, icon: Icon, label, onClick }) => (
  <ButtonBase 
    onClick={onClick} 
    sx={{ 
        borderRadius: 4, 
        p: 1, 
        minWidth: 64,
        transition: 'all 0.3s'
    }}
  >
    <Stack alignItems="center" spacing={0.5}>
        <Box 
            sx={{ 
                p: 0.8, 
                borderRadius: '50%', 
                bgcolor: active ? 'primary.light' : 'transparent',
                color: active ? 'primary.main' : 'text.disabled',
                transition: 'all 0.3s'
            }}
        >
            <Icon className={`w-6 h-6 ${active ? 'fill-current' : ''}`}/>
        </Box>
        <Typography 
            variant="caption" 
            fontWeight="bold" 
            color={active ? 'primary.main' : 'text.disabled'}
        >
            {label}
        </Typography>
    </Stack>
  </ButtonBase>
);

export default NavButton;