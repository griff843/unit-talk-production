'use client';

import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Optionally reload the page
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="container mx-auto p-6">
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <CardTitle className="text-red-900">Something went wrong</CardTitle>
              </div>
              <CardDescription className="text-red-700">
                An unexpected error occurred while rendering this page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {this.state.error && (
                <div className="p-3 bg-red-100 rounded border border-red-300">
                  <p className="font-mono text-sm text-red-800">
                    {this.state.error.message}
                  </p>
                  {process.env.NODE_ENV === 'development' && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-red-600">
                        Stack trace
                      </summary>
                      <pre className="mt-2 text-xs overflow-x-auto">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}
              
              <Button onClick={this.handleReset} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}