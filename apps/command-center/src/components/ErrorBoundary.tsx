/**
 * Production-Grade Error Boundary for Command Center
 * Provides comprehensive error handling with fallback UI and error reporting
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'widget';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    errorId: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    this.setState({
      error,
      errorInfo,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error to monitoring service
    this.reportError(error, errorInfo);
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      const errorReport = {
        id: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        level: this.props.level || 'component',
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        retryCount: this.retryCount,
      };

      // Send to monitoring endpoint
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport),
      });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  private renderErrorDetails = () => {
    const { error, errorInfo, errorId } = this.state;

    if (process.env.NODE_ENV === 'development') {
      return (
        <details className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <summary className="cursor-pointer font-medium text-gray-700 mb-2">
            Error Details (Development Mode)
          </summary>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Error ID:</strong> {errorId}
            </div>
            <div>
              <strong>Message:</strong> {error?.message}
            </div>
            <div>
              <strong>Stack Trace:</strong>
              <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {error?.stack}
              </pre>
            </div>
            {errorInfo && (
              <div>
                <strong>Component Stack:</strong>
                <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </div>
        </details>
      );
    }

    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">
          Error ID: <code className="bg-gray-200 px-1 rounded">{errorId}</code>
        </p>
        <p className="text-sm text-gray-500 mt-1">
          This error has been reported to our monitoring system.
        </p>
      </div>
    );
  };

  private renderFallbackUI = () => {
    const { level = 'component' } = this.props;
    const { error } = this.state;
    const canRetry = this.retryCount < this.maxRetries;

    // Widget-level errors (small components)
    if (level === 'widget') {
      return (
        <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-center space-x-2 text-red-700 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="font-medium text-sm">Widget Error</span>
          </div>
          <p className="text-sm text-red-600 mb-3">
            This component encountered an error and couldn't load properly.
          </p>
          {canRetry && (
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry ({this.maxRetries - this.retryCount} attempts left)
            </button>
          )}
        </div>
      );
    }

    // Component-level errors (sections, cards)
    if (level === 'component') {
      return (
        <div className="p-6 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-center space-x-3 text-red-700 mb-4">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <h3 className="font-semibold">Component Error</h3>
              <p className="text-sm text-red-600">
                {error?.message || 'Something went wrong in this section'}
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            {canRetry && (
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Component
              </button>
            )}
            <button
              onClick={this.handleReload}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </button>
          </div>

          {this.renderErrorDetails()}
        </div>
      );
    }

    // Page-level errors (full page replacement)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>

            <h1 className="text-xl font-semibold text-gray-900 mb-2">Oops! Something went wrong</h1>

            <p className="text-gray-600 mb-6">
              The Command Center encountered an unexpected error. Our team has been notified and is
              working on a fix.
            </p>

            <div className="space-y-3">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again ({this.maxRetries - this.retryCount} attempts left)
                </button>
              )}

              <button
                onClick={this.handleReload}
                className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Dashboard
              </button>
            </div>

            {this.renderErrorDetails()}
          </div>
        </div>
      </div>
    );
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI based on level
      return this.renderFallbackUI();
    }

    return this.props.children;
  }
}

// Convenience wrapper components for different error boundary levels
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="page">{children}</ErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}> = ({ children, onError }) => (
  <ErrorBoundary level="component" onError={onError}>
    {children}
  </ErrorBoundary>
);

export const WidgetErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary level="widget">{children}</ErrorBoundary>
);

export default ErrorBoundary;
