import React, { useState } from 'react';
import type { PeriodLeaderboardOutputDTO, LeaderboardRankedItemDTO } from '../../core/application/dtos/PeriodLeaderboardDTO';
import { downloadElementAsPng, copyElementToClipboard } from '../../lib/exportPng';

interface PeriodLeaderboardCardProps {
  data: PeriodLeaderboardOutputDTO;
}

export const PeriodLeaderboardCard: React.FC<PeriodLeaderboardCardProps> = ({ data }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const cardElementId = `period-card-export-${data.periodType}-${data.yearMonth || 'all'}`;
  const filename = `ranking-${data.periodType}-${data.yearMonth || 'geral'}`;

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

  const renderRankingColumn = (
    title: string,
    icon: string,
    accentColor: 'amber' | 'emerald' | 'blue',
    items: LeaderboardRankedItemDTO[],
    valueLabel: string
  ) => {
    const colorClasses = {
      amber: {
        border: 'border-amber-500/30',
        bgGradient: 'from-amber-500/15 to-transparent',
        text: 'text-amber-400',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      },
      emerald: {
        border: 'border-emerald-500/30',
        bgGradient: 'from-emerald-500/15 to-transparent',
        text: 'text-emerald-400',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      },
      blue: {
        border: 'border-blue-500/30',
        bgGradient: 'from-blue-500/15 to-transparent',
        text: 'text-blue-400',
        badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      },
    }[accentColor];

    return (
      <div className={`flex flex-col rounded-2xl border ${colorClasses.border} bg-surface-100/85 overflow-hidden shadow-lg`}>
        {/* Col Header */}
        <div className={`p-3.5 bg-gradient-to-r ${colorClasses.bgGradient} border-b border-white/10 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <h3 className={`font-display font-black text-sm uppercase tracking-wider ${colorClasses.text}`}>
                {title}
              </h3>
              <p className="text-[10px] text-gray-400 font-medium">{valueLabel}</p>
            </div>
          </div>
        </div>

        {/* List of items */}
        <div className="divide-y divide-white/5 flex-1 text-xs">
          {items.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-xs">Sem dados</div>
          ) : (
            items.slice(0, 10).map((player) => {
              const isTop1 = player.rank === 1 && player.value > 0;

              return (
                <div
                  key={player.playerId}
                  className={`px-3 py-2 flex items-center justify-between transition-colors ${
                    isTop1 ? 'bg-amber-500/10 font-bold' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-5 text-center font-black text-xs shrink-0 ${
                        isTop1
                          ? 'text-amber-400'
                          : player.rank === 2
                            ? 'text-gray-300'
                            : player.rank === 3
                              ? 'text-amber-600'
                              : 'text-gray-400'
                      }`}
                    >
                      {isTop1 ? '👑' : `${player.rank}º`}
                    </span>

                    {/* Avatar */}
                    <div className="w-5 h-5 rounded-full bg-surface-50 flex items-center justify-center text-[9px] font-black text-gray-200 shrink-0 overflow-hidden border border-white/10">
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

                    <div className="min-w-0 truncate">
                      <span className="text-white font-medium truncate block">
                        {player.name}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-2">
                    <span className={`font-mono font-black text-sm ${colorClasses.text}`}>
                      {player.value}
                    </span>
                    {player.secondaryInfo && (
                      <span className="block text-[9px] text-gray-400 font-medium -mt-0.5">
                        {player.secondaryInfo}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
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
          <span className="text-emerald-400 font-black text-sm">📸 Card de Ranking</span>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">
            3 Tabelas Consolidadas
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
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-gray-950 font-black text-xl shadow-lg shadow-emerald-500/30">
              🏆
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
              <p className="text-[11px] text-gray-400 font-medium">Classificação Consolidada</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-base sm:text-lg font-display font-black text-emerald-400 tracking-wide uppercase">
              {data.periodLabel}
            </div>
            <div className="text-[11px] text-gray-400 font-semibold">
              {data.totalPlayers} atletas pontuando
            </div>
          </div>
        </div>

        {/* 3 Colunas de Rankings Lado a Lado */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tabela 1: Craque do Futebol (G+A) */}
          {renderRankingColumn(
            'Craque (G+A)',
            '👑',
            'amber',
            data.byContributions,
            'Gols + Assistências'
          )}

          {/* Tabela 2: Artilheiro (Gols) */}
          {renderRankingColumn(
            'Artilheiro',
            '⚽',
            'emerald',
            data.byGoals,
            'Gols Marcados'
          )}

          {/* Tabela 3: Garçom (Assistências) */}
          {renderRankingColumn(
            'Garçom',
            '👟',
            'blue',
            data.byAssists,
            'Assistências'
          )}
        </div>

        {/* Rodapé do Card */}
        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400">
          <span>SocietyTracker • Ranking Oficial</span>
          <span>societytracker.vercel.app</span>
        </div>
      </div>
    </div>
  );
};
