import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, any render-time exception anywhere in the tree (a
// malformed Supabase response, a null a page didn't expect) unmounts the
// whole React tree and leaves the user staring at a blank white page with
// no way back short of manually editing the URL.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">
            This page hit an unexpected error. Reloading usually fixes it — if it keeps happening, let us know what
            you were doing.
          </p>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => (window.location.href = "/")}>Go home</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
