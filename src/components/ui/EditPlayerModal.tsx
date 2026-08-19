import React, { useState, useEffect } from 'react';
import { UserCheck, X, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
import { cn } from './utils';

export interface EditablePlayerData {
  id: string;
  name: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  isGoalkeeper?: boolean;
}

export interface EditPlayerModalProps {
  isOpen: boolean;
  player: EditablePlayerData | null;
  onClose: () => void;
  onSaved: (updatedPlayer: EditablePlayerData) => void;
}

export const EditPlayerModal: React.FC<EditPlayerModalProps> = ({
  isOpen,
  player,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [isGoalkeeper, setIsGoalkeeper] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (player) {
      setName(player.name || '');
      setNickname(player.nickname || '');
      setIsGoalkeeper(!!player.isGoalkeeper);
      setErrorMessage(null);
    }
  }, [player, isOpen]);

  if (!isOpen || !player) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('O nome do atleta é obrigatório.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          nickname: nickname.trim() || null,
          isGoalkeeper,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao atualizar cadastro do atleta.');
      }

      const updated: EditablePlayerData = await res.json();
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao conectar ao servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl glass-card-glow bg-surface-100 border border-emerald-500/30 p-6 shadow-2xl">
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-black text-lg text-white">
              Editar Atleta
            </h3>
            <p className="text-xs text-gray-400">Atualize os dados e a posição padrão</p>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Matheus Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Apelido (Como é chamado)
            </label>
            <input
              type="text"
              placeholder="Ex: Theus"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-50 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">
              Posição Padrão
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsGoalkeeper(false)}
                className={cn(
                  'py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95',
                  !isGoalkeeper
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-surface-50 text-gray-400 border-white/5 hover:text-white hover:border-white/20'
                )}
              >
                <span>⚽</span>
                <span>Linha</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGoalkeeper(true)}
                className={cn(
                  'py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none active:scale-95',
                  isGoalkeeper
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-surface-50 text-gray-400 border-white/5 hover:text-white hover:border-white/20'
                )}
              >
                <span>🧤</span>
                <span>Goleiro</span>
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {isGoalkeeper
                ? '🧤 Goleiros ficam imunes à lista de Bola Murcha da rodada.'
                : '⚽ Jogador de linha padrão da pelada.'}
            </p>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-surface-50 hover:bg-surface-200 text-xs font-bold text-gray-300 border border-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-black text-gray-950 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Alterações</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
