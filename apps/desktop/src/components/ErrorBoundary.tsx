// FILE: apps/desktop/src/components/ErrorBoundary.tsx
import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-black text-white">
          <div className="text-center max-w-md">
            <h1 className="text-sm font-bold text-red-400 mb-1">Something went wrong</h1>
            <p className="text-gray-300 mb-1">
              An unexpected error occurred. Please try refreshing the application.
            </p>
            {this.state.error && (
              <details className="text-left bg-gray-900 p-2 rounded-md mb-1">
                <summary className="cursor-pointer text-sm font-medium">Error Details</summary>
                <pre className="text-xs mt-2 text-red-300 overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-2 py-2 bg-black hover:bg-gray-900 rounded-md transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}