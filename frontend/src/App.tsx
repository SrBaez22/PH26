import { useState, useEffect, useCallback } from 'react';
import { Thermometer, Droplets, Wind, Zap, Activity, Calendar, Clock, AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './App.css';

const API_URL = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:8000';

// ── Limites por norma (ajustável conforme classe ISO da sala limpa) ──
const THRESHOLDS = {
  temperatura: { warning: 22,   danger: 25   },
  umidade:     { warning: 60,   danger: 70   },
  gas:         { warning: 1000, danger: 2000 },
  particulas:  { warning: 20,   danger: 50   },
};

const STATUS_CONFIG = {
  ok:      { border: '#16a34a', bg: '#f0fdf4', badge: '#dcfce7', text: '#166534', label: 'Normal'  },
  warning: { border: '#d97706', bg: '#fffbeb', badge: '#fef3c7', text: '#92400e', label: 'Atenção' },
  danger:  { border: '#dc2626', bg: '#fef2f2', badge: '#fee2e2', text: '#991b1b', label: 'Alerta'  },
};

type MetricKey = keyof typeof THRESHOLDS;
type Status = keyof typeof STATUS_CONFIG;
type Period = '20' | '50' | '1h' | '3h' | '24h';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '20',  label: 'Últimos 20' },
  { value: '50',  label: 'Últimos 50' },
  { value: '1h',  label: '1 hora'     },
  { value: '3h',  label: '3 horas'    },
  { value: '24h', label: '24 horas'   },
];

function getStatus(value: number, key: MetricKey): Status {
  const t = THRESHOLDS[key];
  if (value >= t.danger)  return 'danger';
  if (value >= t.warning) return 'warning';
  return 'ok';
}

function calcStats(arr: number[]) {
  if (!arr.length) return { min: 0, max: 0, avg: 0 };
  return {
    min: Math.min(...arr),
    max: Math.max(...arr),
    avg: arr.reduce((a, b) => a + b, 0) / arr.length,
  };
}

function formatHora(hora: string | undefined): string {
  if (!hora || hora === '---') return '---';
  return hora.slice(0, 8);
}

function formatData(data: string | undefined): string {
  if (!data || data === '---') return '---';
  const parts = data.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return data;
}

interface EnvironmentalData {
  temperatura: number;
  umidade: number;
  particulas: number;
  gas: number;
  data?: string;
  hora?: string;
}

function normalize(item: any): EnvironmentalData {
  return {
    temperatura: item.temperatura ?? item.TEMPERATURA ?? 0,
    umidade:     item.umidade     ?? item.UMIDADE     ?? 0,
    particulas:  item.particulas  ?? item.PARTICULAS  ?? 0,
    gas:         item.gas         ?? item.GAS         ?? 0,
    data:        item.data        ?? item.DATA        ?? '---',
    hora:        item.hora        ?? item.HORA        ?? '---',
  };
}

function buildHistoryUrl(period: Period, dateFrom: string, dateTo: string, useDateRange: boolean): string {
  if (useDateRange && (dateFrom || dateTo)) {
    const p = new URLSearchParams();
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo)   p.set('date_to',   dateTo);
    return `${API_URL}/api/history?${p}`;
  }
  if (period === '20')  return `${API_URL}/api/history?limit=20`;
  if (period === '50')  return `${API_URL}/api/history?limit=50`;
  if (period === '1h')  return `${API_URL}/api/history?hours=1`;
  if (period === '3h')  return `${API_URL}/api/history?hours=3`;
  return `${API_URL}/api/history?hours=24`;
}

function exportCSV(data: EnvironmentalData[]) {
  const BOM = '﻿';
  const header = 'Data;Hora;Temperatura (°C);Umidade (%);Partículas (µg/m³);Gás (ppm)\n';
  const rows = [...data].reverse().map(r =>
    `${formatData(r.data)};${formatHora(r.hora)};${r.temperatura.toFixed(1)};${r.umidade.toFixed(1)};${r.particulas.toFixed(1)};${r.gas.toFixed(0)}`
  ).join('\n');
  const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `monitoramento_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Componente principal ────────────────────────────────────────────
export default function App() {
  const [latest,       setLatest]       = useState<EnvironmentalData | null>(null);
  const [history,      setHistory]      = useState<EnvironmentalData[]>([]);
  const [status,       setStatus]       = useState<'online' | 'offline'>('offline');
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [period,       setPeriod]       = useState<Period>('20');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [useDateRange, setUseDateRange] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [latestRes, historyRes, statusRes] = await Promise.all([
        fetch(`${API_URL}/api/latest`),
        fetch(buildHistoryUrl(period, dateFrom, dateTo, useDateRange)),
        fetch(`${API_URL}/api/status`),
      ]);

      if (latestRes.ok)  setLatest(normalize(await latestRes.json()));
      if (statusRes.ok)  { setStatus('online'); setLastUpdated(new Date()); }
      else               setStatus('offline');

      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistory(data.map(normalize).reverse());
      }
    } catch {
      setStatus('offline');
    }
  }, [period, dateFrom, dateTo, useDateRange]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Alertas ativos
  const activeAlerts: string[] = [];
  if (latest) {
    if (getStatus(latest.temperatura, 'temperatura') !== 'ok') activeAlerts.push(`Temperatura: ${latest.temperatura.toFixed(1)}°C`);
    if (getStatus(latest.umidade,     'umidade')     !== 'ok') activeAlerts.push(`Umidade: ${latest.umidade.toFixed(1)}%`);
    if (getStatus(latest.gas,         'gas')         !== 'ok') activeAlerts.push(`Gás: ${latest.gas.toFixed(0)} ppm`);
    if (getStatus(latest.particulas,  'particulas')  !== 'ok') activeAlerts.push(`Partículas: ${latest.particulas.toFixed(1)} µg/m³`);
  }

  // Dados para os gráficos
  const chartData = history.map((row) => ({
    hora:        row.hora?.slice(0, 5) ?? '---',
    Temperatura: +row.temperatura.toFixed(1),
    Umidade:     +row.umidade.toFixed(1),
    Gas:         +row.gas.toFixed(0),
  }));

  // Estatísticas do histórico
  const stats = {
    temperatura: calcStats(history.map(r => r.temperatura)),
    umidade:     calcStats(history.map(r => r.umidade)),
    gas:         calcStats(history.map(r => r.gas)),
  };

  return (
    <div className="dashboard-container">

      {/* ── Header ── */}
      <header>
        <div>
          <h1>Monitoramento Ambiental</h1>
          <p className="header-sub">
            Sala Limpa — dados em tempo real
            {lastUpdated && (
              <span className="last-updated">
                &nbsp;· Atualizado às {lastUpdated.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </p>
        </div>
        <div className={`status-badge ${status === 'online' ? 'status-online' : 'status-offline'}`}>
          <span className={`pulse-dot ${status === 'online' ? 'pulse-green' : 'pulse-red'}`} />
          <Activity size={15} />
          {status === 'online' ? 'Sistema Online' : 'Sistema Offline'}
        </div>
      </header>

      {/* ── Banner de alertas ── */}
      {activeAlerts.length > 0 && (
        <div className="alert-banner">
          <AlertTriangle size={18} />
          <strong>Alerta de Limites ISO:</strong>
          {activeAlerts.map((a, i) => <span key={i} className="alert-tag">{a}</span>)}
        </div>
      )}

      {/* ── Cards de leitura atual ── */}
      <div className="metrics-grid">
        <MetricCard title="Temperatura" value={latest?.temperatura} unit="°C"    metricKey="temperatura" icon={<Thermometer size={22} />} color="#ef4444" />
        <MetricCard title="Umidade"     value={latest?.umidade}     unit="%"     metricKey="umidade"     icon={<Droplets    size={22} />} color="#06b6d4" />
        <MetricCard title="Partículas"  value={latest?.particulas}  unit="µg/m³" metricKey="particulas"  icon={<Wind        size={22} />} color="#f59e0b" />
        <MetricCard title="Gases"       value={latest?.gas}         unit="ppm"   metricKey="gas"         icon={<Zap         size={22} />} color="#8b5cf6" />
      </div>

      {/* ── Estatísticas do histórico ── */}
      {history.length > 1 && (
        <div className="stats-grid">
          <StatBox label="Temperatura" stats={stats.temperatura} unit="°C"  color="#ef4444" />
          <StatBox label="Umidade"     stats={stats.umidade}     unit="%"   color="#06b6d4" />
          <StatBox label="Gás"         stats={stats.gas}         unit="ppm" color="#8b5cf6" />
        </div>
      )}

      {/* ── Gráficos lado a lado ── */}
      {chartData.length > 1 && (
        <div className="charts-row">
          <div className="chart-container">
            <h2>Temperatura e Umidade</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gradHum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Temperatura" stroke="#ef4444" strokeWidth={2} fill="url(#gradTemp)" dot={false} />
                <Area type="monotone" dataKey="Umidade"     stroke="#06b6d4" strokeWidth={2} fill="url(#gradHum)"  dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h2>Gás (ppm)</h2>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradGas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="Gas" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradGas)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Tabela de histórico ── */}
      <div className="table-container">
        <div className="table-header">
          <h2>Histórico de Leituras</h2>
          <div className="table-controls">
            <div className="period-selector">
              {PERIOD_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`period-btn${!useDateRange && period === opt.value ? ' active' : ''}`}
                  onClick={() => { setPeriod(opt.value); setUseDateRange(false); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="date-range">
              <input
                type="date"
                className="date-input"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
              <span className="date-sep">até</span>
              <input
                type="date"
                className="date-input"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
              <button
                className={`date-search-btn${useDateRange ? ' active' : ''}`}
                onClick={() => { if (dateFrom || dateTo) setUseDateRange(true); }}
              >
                Buscar
              </button>
            </div>
            {history.length > 0 && (
              <button className="export-btn" onClick={() => exportCSV(history)}>
                Exportar CSV
              </button>
            )}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th><span className="th-label"><Calendar size={13} /> Data</span></th>
              <th><span className="th-label"><Clock size={13} /> Hora</span></th>
              <th>Temp (°C)</th>
              <th>Umid (%)</th>
              <th>Partículas</th>
              <th>Gases (ppm)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((row, i) => {
              const rowStatus =
                getStatus(row.temperatura, 'temperatura') === 'danger' ||
                getStatus(row.umidade,     'umidade')     === 'danger' ||
                getStatus(row.gas,         'gas')         === 'danger' ||
                getStatus(row.particulas,  'particulas')  === 'danger'
                  ? 'danger'
                  : getStatus(row.temperatura, 'temperatura') === 'warning' ||
                    getStatus(row.umidade,     'umidade')     === 'warning' ||
                    getStatus(row.gas,         'gas')         === 'warning' ||
                    getStatus(row.particulas,  'particulas')  === 'warning'
                  ? 'warning'
                  : 'ok';
              const sc = STATUS_CONFIG[rowStatus];
              return (
                <tr key={i} style={{ background: rowStatus !== 'ok' ? sc.bg : undefined }}>
                  <td style={{ fontWeight: 500 }}>{formatData(row.data)}</td>
                  <td style={{ color: '#64748b' }}>{formatHora(row.hora)}</td>
                  <td style={{ color: STATUS_CONFIG[getStatus(row.temperatura, 'temperatura')].border, fontWeight: 600 }}>{row.temperatura.toFixed(1)}</td>
                  <td style={{ color: STATUS_CONFIG[getStatus(row.umidade,     'umidade')].border,     fontWeight: 600 }}>{row.umidade.toFixed(1)}</td>
                  <td style={{ color: STATUS_CONFIG[getStatus(row.particulas,  'particulas')].border,  fontWeight: 600 }}>{row.particulas.toFixed(1)}</td>
                  <td style={{ color: STATUS_CONFIG[getStatus(row.gas,         'gas')].border,         fontWeight: 600 }}>{row.gas.toFixed(0)}</td>
                  <td>
                    <span className="row-status-tag" style={{ background: sc.badge, color: sc.text }}>
                      {sc.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {history.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-row">Aguardando dados do sistema...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── MetricCard ──────────────────────────────────────────────────────
function MetricCard({ title, value, unit, metricKey, icon, color }: {
  title: string; value?: number; unit: string;
  metricKey: MetricKey; icon: React.ReactNode; color: string;
}) {
  const status = value !== undefined ? getStatus(value, metricKey) : 'ok';
  const sc     = STATUS_CONFIG[status];
  const limit  = THRESHOLDS[metricKey].danger;
  const pct    = value !== undefined ? Math.min(100, (value / limit) * 100) : 0;

  return (
    <div className="metric-card" style={{ borderLeft: `4px solid ${sc.border}`, background: sc.bg }}>
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        <div className="metric-header-right">
          <span className="status-tag" style={{ background: sc.badge, color: sc.text }}>{sc.label}</span>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div className="metric-value" style={{ color }}>
        {value !== undefined ? value.toFixed(1) : '--'}
        <span className="metric-unit">{unit}</span>
      </div>
      <div className="metric-bar-bg">
        <div className="metric-bar-fill" style={{ width: `${pct}%`, background: sc.border }} />
      </div>
      <div className="metric-limit">Limite ISO: {limit} {unit}</div>
    </div>
  );
}

// ── StatBox ─────────────────────────────────────────────────────────
function StatBox({ label, stats, unit, color }: {
  label: string; stats: { min: number; max: number; avg: number }; unit: string; color: string;
}) {
  return (
    <div className="stat-box">
      <div className="stat-label" style={{ color }}>{label}</div>
      <div className="stat-rows">
        <div className="stat-item">
          <span className="stat-name">Mínimo</span>
          <span className="stat-val" style={{ color }}>{stats.min.toFixed(1)} <span className="stat-unit">{unit}</span></span>
        </div>
        <div className="stat-item">
          <span className="stat-name">Média</span>
          <span className="stat-val" style={{ color }}>{stats.avg.toFixed(1)} <span className="stat-unit">{unit}</span></span>
        </div>
        <div className="stat-item">
          <span className="stat-name">Máximo</span>
          <span className="stat-val" style={{ color }}>{stats.max.toFixed(1)} <span className="stat-unit">{unit}</span></span>
        </div>
      </div>
    </div>
  );
}
