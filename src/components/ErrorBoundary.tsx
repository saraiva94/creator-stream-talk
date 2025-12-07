import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught render error", { error, info });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-muted/30 p-6 text-center">
          <div>
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-muted-foreground">
              An unexpected error occurred. We logged the details. You can try reloading the page.
            </p>
            {this.state.error && (
              <pre className="mt-4 max-w-lg text-left text-xs text-destructive bg-destructive/10 p-3 rounded overflow-auto">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
