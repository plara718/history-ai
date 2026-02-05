import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// エラーが起きた時に表示する画面
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#333' }}>
          <h2 style={{ color: '#e11d48' }}>⚠️ アプリケーションエラーが発生しました</h2>
          <p>以下のエラーメッセージをコピーして、AIに伝えてください：</p>
          <div style={{ 
            backgroundColor: '#f1f5f9', 
            padding: '1rem', 
            borderRadius: '0.5rem', 
            border: '1px solid #cbd5e1',
            overflow: 'auto',
            marginBottom: '1rem'
          }}>
            <code style={{ fontWeight: 'bold', color: '#dc2626' }}>
              {this.state.error && this.state.error.toString()}
            </code>
            <pre style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#64748b' }}>
               {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            画面を再読み込みする
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);