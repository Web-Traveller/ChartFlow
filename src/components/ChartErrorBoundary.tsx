import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "../lib/logger";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ChartErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(
      `Chart component crashed: ${error.message}`,
      {
        componentStack: errorInfo.componentStack,
      },
      error.stack,
    );
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mb-6">
              <AlertOctagon className="w-8 h-8 text-rose-400" />
            </div>

            <h2 className="text-2xl font-bold mb-3 text-slate-100">
              Chart Error Detected
            </h2>

            <p className="text-slate-400 text-sm mb-6 max-h-32 overflow-y-auto font-mono text-left bg-slate-950 p-3 rounded-lg border border-slate-850">
              {this.state.error?.toString()}
            </p>

            <p className="text-slate-500 text-sm mb-8">
              This error has been logged automatically. Please try refreshing or
              returning to the dashboard.
            </p>

            <div className="flex gap-4 w-full">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Chart
              </button>

              <a
                href="/"
                className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 font-semibold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-center"
              >
                <Home className="w-4 h-4" />
                Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ChartErrorBoundary;
