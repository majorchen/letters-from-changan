'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center bg-stone-950 text-amber-100">
          <div className="text-center px-6">
            <div className="font-handwriting text-2xl mb-4">长安遇到了意外……</div>
            <p className="text-amber-100/50 text-sm mb-6">别担心，你的存档还在。</p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-6 py-2 rounded bg-amber-800/30 text-amber-200 text-sm hover:bg-amber-800/50 transition-colors border border-amber-800/20"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
