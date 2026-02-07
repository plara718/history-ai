import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // ★ Tailwind CSSの読み込み (重要)

// エラーが起きた時に表示する画面 (ErrorBoundary)
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
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#333', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ color: '#e11d48', borderBottom: '2px solid #e11d48', paddingBottom: '0.5rem' }}>
            ⚠️ アプリケーションエラーが発生しました
          </h2>
          <p>以下のエラーメッセージをコピーして、AIに伝えてください：</p>
          
          <div style={{ 
            backgroundColor: '#f1f5f9', 
            padding: '1.5rem', 
            borderRadius: '0.5rem', 
            border: '1px solid #cbd5e1',
            overflow: 'auto',
            marginBottom: '1.5rem',
            maxHeight: '400px'
          }}>
            <code style={{ display: 'block', fontWeight: 'bold', color: '#dc2626', marginBottom: '1rem' }}>
              {this.state.error && this.state.error.toString()}
            </code>
            <pre style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
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
              fontWeight: 'bold',
              fontSize: '1rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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