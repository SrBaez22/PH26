import { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Thermometer, Droplets, Wind, Zap, Activity } from 'lucide-react';
import './App.css';

interface EnvironmentalData {
  temperatura: number;
  umidade: number;
  particulas: number;
  gas: number;
  [key: string]: any;
}

function App() {
  const [latest, setLatest] = useState<EnvironmentalData | null>(null);
  const [history, setHistory] = useState<EnvironmentalData[]>([]);
  const [status, setStatus] = useState<'online' | 'offline'>('offline');

  const fetchData = async () => {
    try {
      const [latestRes, historyRes, statusRes] = await Promise.all([
        fetch('http://localhost:8000/api/latest'),
        fetch('http://localhost:8000/api/history'),
        fetch('http://localhost:8000/api/status')
      ]);

      if (latestRes.ok) {
        const data = await latestRes.json();
        // Normalização de chaves (case-insensitive do banco)
        setLatest({
          temperatura: data.temperatura ?? data.TEMPERATURA ?? 0,
          umidade: data.umidade ?? data.UMIDADE ?? 0,
          particulas: data.particulas ?? data.PARTICULAS ?? 0,
          gas: data.gas ?? data.GAS ?? 0
        });
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        const normalizedHistory = data.map((item: any) => ({
          temperatura: item.temperatura ?? item.TEMPERATURA ?? 0,
          umidade: item.umidade ?? item.UMIDADE ?? 0,
          particulas: item.particulas ?? item.PARTICULAS ?? 0,
          gas: item.gas ?? item.GAS ?? 0
        }));
        setHistory(normalizedHistory);
      }

      if (statusRes.ok) {
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      setStatus('offline');
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll a cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1>Monitoramento Ambiental</h1>
          <p style={{ color: '#27292c', margin: '4px 0 0 0' }}>Dashboard em tempo real (Neon DB)</p>
        </div>
        <div className={`status-badge ${status === 'online' ? 'status-online' : 'status-offline'}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} />
            {status === 'online' ? 'Sistema Online' : 'Sistema Offline'}
          </div>
        </div>
      </header>

      <div className="metrics-grid">
        <MetricCard 
          title="Temperatura" 
          value={latest?.temperatura} 
          unit="°C" 
          icon={<Thermometer color="#ef4444" />} 
          color="#ef4444"
        />
        <MetricCard 
          title="Umidade" 
          value={latest?.umidade} 
          unit="%" 
          icon={<Droplets color="#06b6d4" />} 
          color="#06b6d4"
        />
        <MetricCard 
          title="Partículas" 
          value={latest?.particulas} 
          unit="µg/m³" 
          icon={<Wind color="#f59e0b" />} 
          color="#f59e0b"
        />
        <MetricCard 
          title="Gases" 
          value={latest?.gas} 
          unit="ppm" 
          icon={<Zap color="#8b5cf6" />} 
          color="#8b5cf6"
        />
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h2>Tendência de Temperatura e Umidade</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="temperatura" name="Temp (°C)" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="umidade" name="Umid (%)" stroke="#06b6d4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card">
          <h2>Qualidade do Ar (Gases e Partículas)</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" hide />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="particulas" name="Partículas" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="gas" name="Gases" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, unit, icon, color }: any) {
  return (
    <div className="metric-card">
      <div className="metric-header">
        <span>{title}</span>
        {icon}
      </div>
      <div className="metric-value" style={{ color }}>
        {value !== undefined ? value.toFixed(1) : '--'}
        <span className="metric-unit">{unit}</span>
      </div>
    </div>
  );
}

export default App;
