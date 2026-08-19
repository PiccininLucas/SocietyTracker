import React, { useState } from 'react';
import type { RoundHighlightsOutputDTO } from '../../core/application/dtos/RoundHighlightsDTO';
import { downloadElementAsPng, copyElementToClipboard } from '../../lib/exportPng';

interface RoundSummaryCardProps {
  data: RoundHighlightsOutputDTO;
}

export const RoundSummaryCard: React.FC<RoundSummaryCardProps> = ({ data }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cardElementId = `round-card-export-${data.sessionId}`;

  // Formata data da sessão para exibição compacta de impacto (Ex: "13/AGO")
  const formatDateHeader = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        const dayStr = String(day).padStart(2, '0');
        const monthStr = date
          .toLocaleDateString('pt-BR', { month: 'short' })
          .replace('.', '')
          .toUpperCase();
        return `${dayStr}/${monthStr}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formattedDate = formatDateHeader(data.sessionDate);
  const filename = `resumo-rodada-${data.sessionDate}`;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const success = await downloadElementAsPng(cardElementId, filename);
      if (success) {
        showToast('PNG baixado com sucesso!');
      } else {
        showToast('Erro ao baixar imagem.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      setIsCopying(true);
      const success = await copyElementToClipboard(cardElementId);
      if (success) {
        showToast('✨ Imagem copiada! Cole no WhatsApp (Ctrl+V)');
      } else {
        showToast('Não foi possível copiar. Use o botão Baixar.');
      }
    } finally {
      setIsCopying(false);
    }
  };

  const { highlights } = data;
  const craqueNames = highlights.mvps.length > 0 ? highlights.mvps.join(', ') : '—';
  const artilheiroNames = highlights.topScorers.length > 0 ? highlights.topScorers.join(', ') : '—';
  const garcomNames = highlights.topAssisters.length > 0 ? highlights.topAssisters.join(', ') : '—';
  const bolaMurchaNames =
    highlights.bottomPlayers.length > 0 ? highlights.bottomPlayers.join(', ') : 'Nenhum';

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-500 text-gray-950 px-4 py-2.5 rounded-2xl font-bold text-sm shadow-2xl flex items-center gap-2 animate-bounce-short">
          <span>✅</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Botões de Ação no Topo do Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-100/90 p-3.5 rounded-2xl border border-white/10 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-black text-sm">📸 Card da Rodada</span>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">
            Pronto para WhatsApp
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={isCopying || isDownloading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-50 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            title="Copiar imagem para colar no WhatsApp Web"
          >
            <span>{isCopying ? '⏳' : '📋'}</span>
            <span>{isCopying ? 'Copiando...' : 'Copiar Imagem'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading || isCopying}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
            title="Baixar card como arquivo PNG em alta resolução"
          >
            <span>{isDownloading ? '⏳' : '📥'}</span>
            <span>{isDownloading ? 'Gerando...' : 'Baixar PNG'}</span>
          </button>
        </div>
      </div>

      {/* CARD VISUAL EXPORTÁVEL (Conteúdo capturado pelo html-to-image) */}
      <div
        id={cardElementId}
        style={{
          backgroundColor: '#090d16',
          backgroundImage:
            'radial-gradient(ellipse at 50% -20%, rgba(16, 185, 129, 0.15), transparent 70%), radial-gradient(ellipse at 50% 120%, rgba(59, 130, 246, 0.08), transparent 70%)',
        }}
        className="w-full text-white p-6 sm:p-7 rounded-3xl border-2 border-emerald-500/30 shadow-2xl font-sans"
      >
        {/* Cabeçalho do Card */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-gray-950 font-black text-xl shadow-lg shadow-emerald-500/30">
              ⚽
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-lg sm:text-xl tracking-tight text-white uppercase">
                  Society<span className="text-emerald-400">Tracker</span>
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Pelada das Quintas
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">Resumo Oficial da Rodada</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg sm:text-xl font-display font-black text-emerald-400 tracking-wider">
              {formattedDate}
            </div>
            <div className="text-[11px] text-gray-400 font-semibold">
              {data.totalMatches} jogos • {data.totalGoals} gols
            </div>
          </div>
        </div>

        {/* Quadro de Destaques (Pódio / Destaques da Noite) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {/* Craque da Rodada */}
          <div className="p-3.5 rounded-2xl bg-surface-100/90 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">👑</span>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                Craque da Rodada (G+A)
              </span>
            </div>
            <div className="font-display font-black text-base sm:text-lg text-white truncate">
              {craqueNames}
            </div>
          </div>

          {/* Artilheiro da Rodada */}
          <div className="p-3.5 rounded-2xl bg-surface-100/90 border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚽</span>
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                Artilheiro da Noite
              </span>
            </div>
            <div className="font-display font-black text-base sm:text-lg text-white truncate">
              {artilheiroNames}
            </div>
          </div>

          {/* Garçom da Rodada */}
          <div className="p-3.5 rounded-2xl bg-surface-100/90 border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">👟</span>
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                Garçom da Noite
              </span>
            </div>
            <div className="font-display font-black text-base sm:text-lg text-white truncate">
              {garcomNames}
            </div>
          </div>

          {/* Bola Murcha da Rodada */}
          <div className="p-3.5 rounded-2xl bg-surface-100/90 border border-rose-500/30 bg-gradient-to-br from-rose-500/10 to-transparent">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🩴</span>
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">
                Bola Murcha (Linha 0G + 0A)
              </span>
            </div>
            <div className="font-display font-bold text-xs sm:text-sm text-gray-300 truncate" title={bolaMurchaNames}>
              {bolaMurchaNames}
            </div>
          </div>
        </div>

        {/* Tabela de Desempenho do Dia */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface-100/70">
          <div className="bg-surface-50/80 px-4 py-2.5 border-b border-white/10 flex items-center justify-between text-xs font-bold text-gray-300 uppercase tracking-wider">
            <div className="flex items-center gap-4">
              <span className="w-6 text-center">#</span>
              <span>Jogador</span>
            </div>
            <div className="flex items-center gap-5 sm:gap-7 text-right">
              <span className="w-7 text-center">G</span>
              <span className="w-7 text-center">A</span>
              <span className="w-10 text-center text-emerald-400 font-black">G+A</span>
            </div>
          </div>

          <div className="divide-y divide-white/5 text-xs sm:text-sm">
            {data.players.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">
                Nenhum jogador registrado nesta rodada.
              </div>
            ) : (
              data.players.map((player) => {
                const isTop1 = player.rank === 1 && player.contributions > 0;
                const isTopScorer = highlights.topScorers.includes(player.name);
                const isTopAssister = highlights.topAssisters.includes(player.name);

                return (
                  <div
                    key={player.playerId}
                    className={`px-4 py-2 flex items-center justify-between transition-colors ${
                      isTop1 ? 'bg-amber-500/10 font-bold' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <span
                        className={`w-6 text-center text-xs font-black shrink-0 ${
                          isTop1
                            ? 'text-amber-400'
                            : player.rank <= 3
                              ? 'text-emerald-400'
                              : 'text-gray-400'
                        }`}
                      >
                        {isTop1 ? '👑' : `${player.rank}º`}
                      </span>

                      {/* Avatar / Inicial */}
                      <div className="w-6 h-6 rounded-full bg-surface-50 flex items-center justify-center text-[10px] font-black text-gray-200 shrink-0 overflow-hidden border border-white/10">
                        {player.avatarUrl ? (
                          <img
                            src={player.avatarUrl}
                            alt={player.name}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          player.name.charAt(0).toUpperCase()
                        )}
                      </div>

                      <div className="min-w-0 truncate flex items-center gap-1.5">
                        <span className="text-white font-medium truncate">
                          {player.name}
                          {player.nickname && (
                            <span className="text-gray-400 text-[11px] ml-1 font-normal">
                              ({player.nickname})
                            </span>
                          )}
                        </span>

                        {player.isGoalkeeper && (
                          <span
                            className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0"
                            title="Goleiro (Imune ao Bola Murcha)"
                          >
                            🧤 GK
                          </span>
                        )}
                      </div>

                      {player.teamName && (
                        <span
                          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-gray-300 shrink-0 hidden sm:inline"
                          style={{
                            backgroundColor: player.teamColor
                              ? `${player.teamColor}33`
                              : 'rgba(255,255,255,0.1)',
                            borderColor: player.teamColor || '#555',
                            borderWidth: '1px',
                          }}
                        >
                          {player.teamName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-5 sm:gap-7 text-right shrink-0">
                      <span
                        className={`w-7 text-center font-mono font-bold ${
                          isTopScorer && player.goals > 0 ? 'text-emerald-400 font-black' : 'text-gray-300'
                        }`}
                      >
                        {player.goals}
                      </span>
                      <span
                        className={`w-7 text-center font-mono font-bold ${
                          isTopAssister && player.assists > 0 ? 'text-blue-400 font-black' : 'text-gray-300'
                        }`}
                      >
                        {player.assists}
                      </span>
                      <span
                        className={`w-10 text-center font-mono font-black ${
                          player.contributions > 0 ? 'text-emerald-400' : 'text-gray-500'
                        }`}
                      >
                        {player.contributions}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Rodapé do Card */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400">
          <span>SocietyTracker • 7 min ou 2 gols</span>
          <span>societytracker.vercel.app</span>
        </div>
      </div>
    </div>
  );
};
