import React from 'react';

// Keep a rendering failure inside the consultation instead of blanking the app.
// Drafts stay in the encrypted vault; no patient content is logged here.
export default class ConsultationBoundary extends React.Component<
  { children: React.ReactNode; onBack: () => void },
  { failed: boolean }
> {
  declare props: Readonly<{ children: React.ReactNode; onBack: () => void }>;
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" className="bg-white rounded-2xl p-6 space-y-4">
        <h2 className="text-lg font-bold">Não foi possível abrir o atendimento</h2>
        <p>Os rascunhos protegidos existentes foram mantidos. Volte à agenda e tente novamente. Se o erro continuar, informe o horário em que ocorreu.</p>
        <button type="button" className="bg-blue-600 text-white px-4 py-2 rounded-xl" onClick={this.props.onBack}>
          Voltar à agenda
        </button>
      </section>
    );
  }
}
