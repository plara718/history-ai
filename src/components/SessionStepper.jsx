import React from 'react';
import { Box, Stepper, Step, StepLabel, Typography } from '@mui/material';
import { MAX_DAILY_SESSIONS } from '../lib/constants';

const SessionStepper = ({ activeSession, viewingSession, historyMeta, onSwitch }) => {
  // ステップ（セッション）の配列を作成
  const steps = Array.from({ length: MAX_DAILY_SESSIONS }, (_, i) => i + 1);

  return (
    <Box sx={{ width: '100%', overflowX: 'auto', pb: 1 }}>
      <Stepper activeStep={viewingSession - 1} alternativeLabel nonLinear>
        {steps.map((num) => {
          // ★防御策: historyMeta[num] が undefined でもクラッシュさせない
          const meta = historyMeta?.[num] || {}; 
          const isCompleted = !!meta.completed;
          const exists = !!meta.exists;
          const isActive = activeSession === num;

          return (
            <Step key={num} completed={isCompleted}>
              <StepLabel
                onClick={() => {
                  // データが存在するか、現在のセッションならクリック可能
                  if (exists || isActive) {
                    onSwitch(num);
                  }
                }}
                sx={{
                  cursor: (exists || isActive) ? 'pointer' : 'default',
                  '& .MuiStepLabel-label': {
                    mt: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: num === viewingSession ? 'bold' : 'normal',
                    color: num === viewingSession ? 'primary.main' : 'text.secondary',
                  },
                  '& .MuiStepIcon-root': {
                    color: isCompleted ? 'success.main' : (isActive ? 'primary.main' : 'action.disabled'),
                    '&.Mui-active': { color: 'primary.main' },
                    '&.Mui-completed': { color: 'success.main' },
                  }
                }}
              >
                {/* テーマ名があれば表示、なければ "No.{num}" */}
                <Typography variant="caption" sx={{ display: 'block', maxWidth: 80, mx: 'auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {meta.theme ? meta.theme.substring(0, 5) + (meta.theme.length > 5 ? '..' : '') : `Mission ${num}`}
                </Typography>
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
    </Box>
  );
};

export default SessionStepper;