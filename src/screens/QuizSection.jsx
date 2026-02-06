import React, { useState, useMemo } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, IconButton, 
  List, ListItem, ListItemText, ListItemSecondaryAction, 
  Chip, Collapse, Paper, Alert, AlertTitle 
} from '@mui/material';
import { 
  CheckCircle as CheckIcon, 
  Cancel as CancelIcon, 
  ArrowUpward as ArrowUpIcon, 
  ArrowDownward as ArrowDownIcon,
  NavigateNext as NextIcon
} from '@mui/icons-material';
import { SafeMarkdown } from '../components/SafeMarkdown';

/**
 * 演習セクションのメインコンポーネント
 */
export const QuizSection = ({ lessonData, onComplete }) => {
  // 正誤問題と整序問題を1つのリストに結合
  const questions = useMemo(() => {
    const q1 = lessonData.content.true_false.map(q => ({ ...q, type: 'tf' }));
    const q2 = lessonData.content.sort.map(q => ({ ...q, type: 'sort' }));
    return [...q1, ...q2];
  }, [lessonData]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  
  // 現在の問題データ
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // 次の問題へ進む
  const handleNext = () => {
    if (isLastQuestion) {
      onComplete(); // 親コンポーネントへ通知（記述パートへ遷移）
    } else {
      setIsAnswered(false);
      setIsCorrect(false);
      setCurrentIndex(prev => prev + 1);
    }
  };

  // 正誤判定後の処理
  const handleResult = (result) => {
    setIsCorrect(result);
    setIsAnswered(true);
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}>
      {/* 進捗バー代わりのチップ */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Chip 
          label={`Question ${currentIndex + 1} / ${questions.length}`} 
          color="primary" 
          variant="outlined" 
          size="small" 
          sx={{ fontWeight: 'bold' }}
        />
        <Typography variant="caption" color="text.secondary">
          {currentQuestion.type === 'tf' ? '正誤判定' : '整序問題'}
        </Typography>
      </Box>

      {/* 問題カード */}
      <Card 
        elevation={3} 
        sx={{ 
          borderRadius: 4, 
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'grey.100'
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3, lineHeight: 1.6 }}>
            Q. {currentQuestion.q}
          </Typography>

          {/* 問題タイプに応じたコンポーネントの出し分け */}
          {!isAnswered ? (
            currentQuestion.type === 'tf' ? (
              <TrueFalseQuestion 
                question={currentQuestion} 
                onAnswer={handleResult} 
              />
            ) : (
              <SortQuestion 
                question={currentQuestion} 
                onAnswer={handleResult} 
              />
            )
          ) : (
            // 回答済みの場合の表示（自分の回答など）
            <Box sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="body2" color="text.secondary">回答完了</Typography>
            </Box>
          )}
        </CardContent>

        {/* 解説＆結果エリア (アコーディオン表示) */}
        <Collapse in={isAnswered}>
          <Box sx={{ p: 3, bgcolor: isCorrect ? '#f0fdf4' : '#fef2f2', borderTop: '1px solid #eee' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              {isCorrect ? (
                <CheckIcon color="success" sx={{ fontSize: 32, mr: 1 }} />
              ) : (
                <CancelIcon color="error" sx={{ fontSize: 32, mr: 1 }} />
              )}
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: isCorrect ? 'success.main' : 'error.main' }}>
                {isCorrect ? 'Correct!' : 'Incorrect...'}
              </Typography>
            </Box>

            {/* AI解説 (SafeMarkdownでリッチに表示) */}
            <Box sx={{ mt: 2, bgcolor: 'white', p: 2, borderRadius: 2, border: '1px solid #eee' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 'bold' }}>
                💡 解説・ポイント
              </Typography>
              <SafeMarkdown content={currentQuestion.exp} />
            </Box>

            <Button 
              variant="contained" 
              color="primary" 
              fullWidth 
              size="large"
              endIcon={<NextIcon />}
              onClick={handleNext}
              sx={{ mt: 3, borderRadius: 2, fontWeight: 'bold', py: 1.5 }}
            >
              {isLastQuestion ? '記述問題（Essay）へ挑戦' : '次の問題へ'}
            </Button>
          </Box>
        </Collapse>
      </Card>
    </Box>
  );
};

/**
 * サブコンポーネント: 正誤問題
 */
const TrueFalseQuestion = ({ question, onAnswer }) => {
  const handleSelect = (userSelectBool) => {
    // APIの正解データ(correct)と比較 (correctは true/false ではなく 0/1 の場合もあるため柔軟に)
    // プロンプトでは 0=True, 1=False と指定していた場合と、booleanの場合があるため調整
    // ここではプロンプトで {options: ["True", "False"], correct: 0} としているので、0がTrue(正)とする想定
    const isTrue = userSelectBool === true;
    const correctIsFirstOption = question.correct === 0; // 0番目が正解ならTrueが正解
    
    // ユーザーがTrueを選び、正解も0番目(True)なら正解
    const result = (isTrue && correctIsFirstOption) || (!isTrue && !correctIsFirstOption);
    onAnswer(result);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Button
        variant="outlined"
        color="primary" // MUIのデフォルト青
        fullWidth
        sx={{ 
          py: 4, borderRadius: 3, border: '2px solid', fontSize: '1.2rem', fontWeight: 'bold',
          '&:hover': { borderWidth: '2px', bgcolor: 'primary.50' }
        }}
        onClick={() => handleSelect(true)}
      >
        ⭕ 正しい
      </Button>
      <Button
        variant="outlined"
        color="error"
        fullWidth
        sx={{ 
          py: 4, borderRadius: 3, border: '2px solid', fontSize: '1.2rem', fontWeight: 'bold',
          '&:hover': { borderWidth: '2px', bgcolor: 'error.50' }
        }}
        onClick={() => handleSelect(false)}
      >
        ❌ 誤り
      </Button>
    </Box>
  );
};

/**
 * サブコンポーネント: 整序問題 (Sort)
 * - items配列を並べ替えて提出するUI
 */
const SortQuestion = ({ question, onAnswer }) => {
  // 現在の並び順（インデックスの配列）を管理
  const [order, setOrder] = useState(question.items.map((_, i) => i));

  // 要素を入れ替える関数
  const moveItem = (index, direction) => {
    const newOrder = [...order];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    // スワップ
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setOrder(newOrder);
  };

  const handleSubmit = () => {
    // correct_order (例: [2, 0, 1, 3]) と現在の order が完全一致するか
    const isCorrect = JSON.stringify(order) === JSON.stringify(question.correct_order);
    onAnswer(isCorrect);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        正しい歴史の順序に並べ替えてください
      </Typography>
      
      <List sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid #eee' }}>
        {order.map((originalIndex, displayIndex) => (
          <ListItem 
            key={originalIndex} 
            divider={displayIndex !== order.length - 1}
            sx={{ bgcolor: 'white' }}
          >
            <ListItemText 
              primary={
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {question.items[originalIndex]}
                </Typography>
              } 
              secondary={`選択肢 ${String.fromCharCode(65 + originalIndex)}`}
            />
            <ListItemSecondaryAction sx={{ display: 'flex', flexDirection: 'column' }}>
              <IconButton 
                size="small" 
                disabled={displayIndex === 0}
                onClick={() => moveItem(displayIndex, -1)}
              >
                <ArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton 
                size="small"
                disabled={displayIndex === order.length - 1}
                onClick={() => moveItem(displayIndex, 1)}
              >
                <ArrowDownIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
        ))}
      </List>

      <Button 
        variant="contained" 
        color="secondary" 
        fullWidth 
        sx={{ mt: 3, borderRadius: 2, fontWeight: 'bold', py: 1.5 }}
        onClick={handleSubmit}
      >
        回答を決定する
      </Button>
    </Box>
  );
};