import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      // Default to returning to the dashboard by forcing a page reload
      window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '40px',
          background: 'var(--bg-primary)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          margin: '20px',
          textAlign: 'center'
        }}>
          <AlertTriangle size={48} color="#dc2626" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: 'var(--text-primary)', marginBottom: '12px' }}>
            Oops! Something went wrong rendering this page.
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '500px' }}>
            {this.props.fallbackMessage || 'An unexpected error caused this component to crash.'}
            <br /><br />
            <span style={{ fontSize: '0.8rem', color: '#dc2626', opacity: 0.8 }}>
              {this.state.error?.message}
            </span>
          </p>
          <button
            onClick={this.handleReset}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={16} /> Return to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
