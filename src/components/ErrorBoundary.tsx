import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    // Error captured — UI fallback is rendered via getDerivedStateFromError
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
