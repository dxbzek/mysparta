/**
 * The recovery card (brief 3.14): an error anywhere below shows this instead of a blank page.
 * It offers a reload and a save code read straight from the save store, so the player can keep
 * the save even when the screens cannot draw.
 */
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { UI } from "../text/ui";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import css from "./app.module.css";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Reads the save and gives its code. Must not depend on the screens. */
  exportCode?: () => Promise<string>;
}

interface State { error: Error | null; code: string | null; codeFailed: boolean }

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null, code: null, codeFailed: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Rank Zero: a screen failed", error, info.componentStack);
  }

  private export = (): void => {
    const run = this.props.exportCode;
    if (!run) return;
    run().then((code) => this.setState({ code }), () => this.setState({ codeFailed: true }));
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <RecoveryCard error={this.state.error} code={this.state.code} codeFailed={this.state.codeFailed} onExport={this.props.exportCode ? this.export : undefined} />;
  }
}

export function RecoveryCard({ error, code, codeFailed, onExport }: { error: Error | null; code: string | null; codeFailed: boolean; onExport?: () => void }) {
  return (
    <main className={css.recovery} role="alert">
      <Panel title={UI.recovery.title}>
        <p className={css.recoveryLine}>{UI.recovery.line}</p>
        {error ? <p className={css.recoveryError}>{error.message}</p> : null}
        <div className={css.recoveryButtons}>
          <Button variant="primary" onClick={() => location.reload()}>{UI.recovery.reload}</Button>
          {onExport ? <Button onClick={onExport}>{UI.recovery.export}</Button> : null}
        </div>
        {code ? <textarea className={css.code} readOnly value={code} aria-label={UI.recovery.export} rows={4} onFocus={(e) => e.currentTarget.select()} /> : null}
        {codeFailed ? <p className={css.recoveryError}>{UI.recovery.failed}</p> : null}
      </Panel>
    </main>
  );
}
