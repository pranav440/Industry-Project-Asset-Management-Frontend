import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { err?: string }
> {
  state: { err?: string } = {};
  static getDerivedStateFromError(error: Error) {
    return { err: error.message + '\n' + (error.stack ?? '') };
  }
  render() {
    if (this.state.err) {
      return (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            font: '13px/1.5 monospace',
            padding: 16,
            color: '#b00020',
            background: '#fff',
          }}
        >
          {'ASSETMX RENDER ERROR:\n\n' + this.state.err}
        </pre>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
