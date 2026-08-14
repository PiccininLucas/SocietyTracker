import React, { useState } from 'react';
import type { RoundHighlightsOutputDTO } from '../../core/application/dtos/RoundHighlightsDTO';
import type { PeriodLeaderboardOutputDTO } from '../../core/application/dtos/PeriodLeaderboardDTO';
import { RoundSummaryCard } from './RoundSummaryCard';
import { PeriodLeaderboardCard } from './PeriodLeaderboardCard';

export interface SessionOption {
  id: string;
  sessionDate: string;
  status: string;
}

export interface MonthOption {
  yearMonth: string;
  label: string;
}

interface ReportsIslandProps {
  sessions: SessionOption[];
  months: MonthOption[];
  initialRoundData: RoundHighlightsOutputDTO | null;
  initialMonthData: PeriodLeaderboardOutputDTO | null;
  initialAllTimeData: PeriodLeaderboardOutputDTO;
}

type TabType = 'round' | 'month' | 'all';

export const ReportsIsland: React.FC<ReportsIslandProps> = ({
  sessions,
  months,
  initialRoundData,
  initialMonthData,
  initialAllTimeData,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('round');

  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    initialRoundData?.sessionId || (sessions.length > 0 ? sessions[0].id : '')
  );
  const [roundData, setRoundData] = useState<RoundHighlightsOutputDTO | null>(initialRoundData);

  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(
    months.length > 0 ? months[0].yearMonth : ''
  );
  const [monthData, setMonthData] = useState<PeriodLeaderboardOutputDTO | null>(initialMonthData);

  const [allTimeData] = useState<PeriodLeaderboardOutputDTO>(initialAllTimeData);

  const [isLoading, setIsLoading] = useState(false);

  // Formata data para o seletor (ex: "Quinta-feira, 13/08/2026")
  const formatSessionLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        const dayFormatted = date.toLocaleDateString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        return dayFormatted.charAt(0).toUpperCase() + dayFormatted.slice(1);
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleSessionChange = async (newSessionId: string) => {
    setSelectedSessionId(newSessionId);
    if (!newSessionId) return;

    try {
      setIsLoading(true);
      const res = await fetch(`/api/reports/round?sessionId=${encodeURIComponent(newSessionId)}`);
      if (res.ok) {
        const data: RoundHighlightsOutputDTO = await res.json();
        setRoundData(data);
      } else {
        console.error('Falha ao carregar dados da rodada');
      }
    } catch (err) {
      console.error('Erro de rede ao buscar rodada:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMonthChange = async (newYearMonth: string) => {
    setSelectedYearMonth(newYearMonth);
    if (!newYearMonth) return;

    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/reports/period?type=month&yearMonth=${encodeURIComponent(newYearMonth)}`
      );
      if (res.ok) {
        const data: PeriodLeaderboardOutputDTO = await res.json();
        setMonthData(data);
      } else {
        console.error('Falha ao carregar dados do mês');
      }
    } catch (err) {
      console.error('Erro de rede ao buscar mês:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navegação por Abas */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-100/90 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('round')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'round'
                ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🗓️</span>
            <span>Por Rodada</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('month')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'month'
                ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>📅</span>
            <span>Por Mês</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-emerald-500 text-gray-950 shadow-md shadow-emerald-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>🏆</span>
            <span>Geral (Temporada)</span>
          </button>
        </div>

        {/* Controles de Filtros Dinâmicos */}
        <div className="flex items-center gap-3">
          {activeTab === 'round' && sessions.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="session-select" className="text-xs font-bold text-gray-400">
                Data:
              </label>
              <select
                id="session-select"
                value={selectedSessionId}
                onChange={(e) => handleSessionChange(e.target.value)}
                disabled={isLoading}
                aria-label="Selecionar data da rodada"
                className="bg-surface-50 border border-white/10 text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id} className="bg-surface-100 text-white">
                    {formatSessionLabel(s.sessionDate)} {s.status === 'ongoing' ? '(Ao Vivo)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'month' && months.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="month-select" className="text-xs font-bold text-gray-400">
                Mês:
              </label>
              <select
                id="month-select"
                value={selectedYearMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                disabled={isLoading}
                aria-label="Selecionar mês do ranking"
                className="bg-surface-50 border border-white/10 text-white text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {months.map((m) => (
                  <option key={m.yearMonth} value={m.yearMonth} className="bg-surface-100 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-surface-100/50 rounded-3xl border border-white/5 text-gray-400">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
          <span className="text-xs font-semibold">Atualizando card...</span>
        </div>
      ) : (
        <div>
          {/* Aba 1: Por Rodada */}
          {activeTab === 'round' && (
            <div>
              {roundData ? (
                <RoundSummaryCard data={roundData} />
              ) : (
                <div className="p-12 text-center rounded-3xl glass-card bg-surface-100/90 border border-white/10 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <span className="text-4xl">⚽</span>
                  <h3 className="font-display font-bold text-lg text-white">
                    Nenhuma rodada selecionada
                  </h3>
                  <p className="text-xs max-w-sm">
                    Inicie partidas no Modo Mesário para gerar os destaques e o resumo da rodada.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Aba 2: Por Mês */}
          {activeTab === 'month' && (
            <div>
              {monthData ? (
                <PeriodLeaderboardCard data={monthData} />
              ) : (
                <div className="p-12 text-center rounded-3xl glass-card bg-surface-100/90 border border-white/10 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <span className="text-4xl">📅</span>
                  <h3 className="font-display font-bold text-lg text-white">
                    Nenhum dado para o mês selecionado
                  </h3>
                </div>
              )}
            </div>
          )}

          {/* Aba 3: Geral (Temporada) */}
          {activeTab === 'all' && (
            <div>
              <PeriodLeaderboardCard data={allTimeData} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
