"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Play,
  Square,
  Waves,
  Radio,
  Smartphone,
  Shield,
  MapPin,
  TrendingUp,
  Clock,
  Database,
  Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Types
interface SensorNode {
  id: number;
  name: string;
  flow: number;
  location: 'upstream' | 'midstream' | 'downstream';
}

interface PredictionData {
  river: string;
  predicted_discharge_m3s: number;
  risk_level: string;
  input_received: number[];
  timestamp: string;
}

interface ChartDataPoint {
  time: string;
  discharge: number;
  threshold: number;
}

// Demo simulation steps
const DEMO_STEPS = [
  {
    name: 'Normal Conditions',
    flows: [150.0, 160.5, 155.2, 170.1, 165.9, 150.2, 180.9]
  },
  {
    name: 'Rising Levels',
    flows: [250.9, 280.8, 260.2, 290.6, 270.9, 260.2, 298.9]
  },
  {
    name: 'Warning State',
    flows: [350.9, 380.8, 360.2, 390.6, 370.9, 360.2, 400.9]
  },
  {
    name: 'EMERGENCY - EVACUATE',
    flows: [450.9, 567.8, 567.2, 456.6, 765.9, 567.2, 888.9]
  }
];

// Critical evacuation threshold
const CRITICAL_THRESHOLD = 1200;

// SMS Message in Swahili
const SWAHILI_SMS = "ONYO: Mto Tana unajaa kwa kasi. Maji yatafika kijijini kwako chini ya masaa mawili. Tafadhali hamia maeneo ya juu mara moja!";

export default function App() {
  // State
  const [sensorData, setSensorData] = useState<SensorNode[]>([
    { id: 1, name: 'UP-01', flow: 150.0, location: 'upstream' },
    { id: 2, name: 'UP-02', flow: 160.5, location: 'upstream' },
    { id: 3, name: 'MID-01', flow: 155.2, location: 'midstream' },
    { id: 4, name: 'MID-02', flow: 170.1, location: 'midstream' },
    { id: 5, name: 'MID-03', flow: 165.9, location: 'midstream' },
    { id: 6, name: 'DOWN-01', flow: 150.2, location: 'downstream' },
    { id: 7, name: 'DOWN-02', flow: 180.9, location: 'downstream' },
  ]);

  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [smsTyped, setSmsTyped] = useState('');
  const [showSms, setShowSms] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('--:--:--');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const smsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch prediction from API
  const fetchPrediction = useCallback(async (flows: number[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('https://duthu-angawatch.hf.space/update_and_predict?river_name=Tana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          river_name: 'Tana',
          flows: flows
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const predictionData: PredictionData = {
        ...data,
        timestamp: new Date().toISOString()
      };

      setPrediction(predictionData);
      setLastUpdated(new Date().toLocaleTimeString());

      // Update chart data
      setChartData(prev => {
        const newPoint: ChartDataPoint = {
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          discharge: data.predicted_discharge_m3s,
          threshold: CRITICAL_THRESHOLD
        };
        const newData = [...prev, newPoint];
        // Keep only last 20 points
        return newData.slice(-20);
      });

      // Update sensor data
      setSensorData(prev => prev.map((sensor, idx) => ({
        ...sensor,
        flow: flows[idx] || sensor.flow
      })));

      // Trigger SMS animation if RED status
      if (data.risk_level.includes('RED')) {
        setShowSms(true);
        startSmsTyping();
      } else {
        setShowSms(false);
        setSmsTyped('');
      }

    } catch (error) {
      console.error('Error fetching prediction:', error);
      // Fallback mock data for demo
      const mockPrediction: PredictionData = {
        river: 'Tana',
        predicted_discharge_m3s: flows.reduce((a, b) => a + b, 0) * 0.8,
        risk_level: flows[6] > 800 ? 'RED (EMERGENCY)' : flows[6] > 400 ? 'YELLOW (WARNING)' : 'GREEN (NORMAL)',
        input_received: flows,
        timestamp: new Date().toISOString()
      };
      setPrediction(mockPrediction);
      setLastUpdated(new Date().toLocaleTimeString());
      
      setChartData(prev => {
        const newPoint: ChartDataPoint = {
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          discharge: mockPrediction.predicted_discharge_m3s,
          threshold: CRITICAL_THRESHOLD
        };
        const newData = [...prev, newPoint];
        return newData.slice(-20);
      });

      setSensorData(prev => prev.map((sensor, idx) => ({
        ...sensor,
        flow: flows[idx] || sensor.flow
      })));

      if (mockPrediction.risk_level.includes('RED')) {
        setShowSms(true);
        startSmsTyping();
      } else {
        setShowSms(false);
        setSmsTyped('');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // SMS typing animation
  const startSmsTyping = () => {
    if (smsIntervalRef.current) {
      clearInterval(smsIntervalRef.current);
    }
    setSmsTyped('');
    let index = 0;
    smsIntervalRef.current = setInterval(() => {
      if (index <= SWAHILI_SMS.length) {
        setSmsTyped(SWAHILI_SMS.slice(0, index));
        index++;
      } else {
        if (smsIntervalRef.current) {
          clearInterval(smsIntervalRef.current);
        }
      }
    }, 50);
  };

  // Start demo simulation
  const startSimulation = () => {
    if (isSimulating) return;
    
    setIsSimulating(true);
    setCurrentStep(0);
    setChartData([]);
    
    // Run first step immediately
    fetchPrediction(DEMO_STEPS[0].flows);

    // Set up interval for subsequent steps
    let stepIndex = 1;
    intervalRef.current = setInterval(() => {
      if (stepIndex < DEMO_STEPS.length) {
        setCurrentStep(stepIndex);
        fetchPrediction(DEMO_STEPS[stepIndex].flows);
        stepIndex++;
      } else {
        // Stop simulation after all steps
        stopSimulation();
      }
    }, 4000);
  };

  // Stop demo simulation
  const stopSimulation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsSimulating(false);
    setCurrentStep(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (smsIntervalRef.current) {
        clearInterval(smsIntervalRef.current);
      }
    };
  }, []);

  // Get status config
  const getStatusConfig = (riskLevel: string) => {
    if (riskLevel?.includes('RED')) {
      return {
        bg: 'bg-red-900/40',
        border: 'border-red-500/60',
        text: 'text-red-400',
        glow: 'shadow-glow-red',
        icon: AlertTriangle,
        label: 'RED (EMERGENCY)',
        pulse: true
      };
    }
    if (riskLevel?.includes('YELLOW')) {
      return {
        bg: 'bg-yellow-900/30',
        border: 'border-yellow-500/50',
        text: 'text-yellow-400',
        glow: 'shadow-glow-yellow',
        icon: AlertTriangle,
        label: 'YELLOW (WARNING)',
        pulse: false
      };
    }
    return {
      bg: 'bg-green-900/30',
      border: 'border-green-500/50',
      text: 'text-green-400',
      glow: 'shadow-glow-green',
      icon: CheckCircle,
      label: 'GREEN (NORMAL)',
      pulse: false
    };
  };

  const statusConfig = prediction ? getStatusConfig(prediction.risk_level) : getStatusConfig('GREEN');
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-industrial-900 text-foreground bg-grid-pattern">
      {/* Header */}
      <header className="border-b border-industrial-700/50 bg-industrial-800/80 backdrop-blur-md sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-glow">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  ANGA WATCH
                </h1>
                <p className="text-sm text-industrial-400">
                  Hyper-local Neuro-Symbolic Flood Defense System
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm text-industrial-400">
                <Database className="w-4 h-4" />
                <span>River: <span className="text-blue-400 font-medium">Tana</span></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-industrial-400">
                <Clock className="w-4 h-4" />
                <span>Last Update: <span className="text-industrial-200">{lastUpdated}</span></span>
              </div>
              <Separator orientation="vertical" className="h-8 bg-industrial-700" />
              <Button
                onClick={isSimulating ? stopSimulation : startSimulation}
                disabled={isLoading}
                className={`${
                  isSimulating 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white px-6 transition-all duration-300`}
              >
                {isSimulating ? (
                  <>
                    <Square className="w-4 h-4 mr-2" />
                    Stop Simulation
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Demo Simulation
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Simulation Progress */}
        {isSimulating && (
          <div className="px-6 pb-4 animate-fade-in">
            <div className="flex items-center gap-4">
              <span className="text-sm text-industrial-400">Simulation Progress:</span>
              <div className="flex gap-2">
                {DEMO_STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all duration-300 ${
                      idx === currentStep
                        ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                        : idx < currentStep
                        ? 'bg-green-600/20 border border-green-500/30 text-green-400'
                        : 'bg-industrial-700/30 border border-industrial-600/30 text-industrial-500'
                    }`}
                  >
                    {idx < currentStep && <CheckCircle className="w-3 h-3" />}
                    <span className="text-xs">{step.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Dashboard */}
      <main className="p-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          
          {/* ZONE 1: Sensor Network (Left Panel) */}
          <div className="col-span-3">
            <Card className="h-full glass-panel border-industrial-700/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">Live Telemetry Network</CardTitle>
                    <p className="text-xs text-industrial-400">Tana River Basin</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upstream Sensors */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-industrial-300">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <span className="font-medium">Upstream (2 nodes)</span>
                  </div>
                  <div className="space-y-2">
                    {sensorData.filter(s => s.location === 'upstream').map((sensor) => (
                      <div
                        key={sensor.id}
                        className="sensor-node flex items-center justify-between p-3 rounded-lg bg-industrial-800/60 border border-industrial-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            sensor.flow > 400 ? 'bg-red-500 animate-node-pulse' : 
                            sensor.flow > 250 ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          <span className="text-sm font-mono text-industrial-300">{sensor.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Waves className="w-3 h-3 text-blue-400" />
                          <span className="text-sm font-mono font-semibold text-white">
                            {sensor.flow.toFixed(1)}
                          </span>
                          <span className="text-xs text-industrial-500">m³/s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-industrial-700/50" />

                {/* Midstream Sensors */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-industrial-300">
                    <Activity className="w-4 h-4 text-blue-400" />
                    <span className="font-medium">Midstream (3 nodes)</span>
                  </div>
                  <div className="space-y-2">
                    {sensorData.filter(s => s.location === 'midstream').map((sensor) => (
                      <div
                        key={sensor.id}
                        className="sensor-node flex items-center justify-between p-3 rounded-lg bg-industrial-800/60 border border-industrial-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            sensor.flow > 400 ? 'bg-red-500 animate-node-pulse' : 
                            sensor.flow > 250 ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          <span className="text-sm font-mono text-industrial-300">{sensor.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Waves className="w-3 h-3 text-blue-400" />
                          <span className="text-sm font-mono font-semibold text-white">
                            {sensor.flow.toFixed(1)}
                          </span>
                          <span className="text-xs text-industrial-500">m³/s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-industrial-700/50" />

                {/* Downstream Sensors */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-industrial-300">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span className="font-medium">Downstream (2 nodes)</span>
                  </div>
                  <div className="space-y-2">
                    {sensorData.filter(s => s.location === 'downstream').map((sensor) => (
                      <div
                        key={sensor.id}
                        className="sensor-node flex items-center justify-between p-3 rounded-lg bg-industrial-800/60 border border-industrial-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            sensor.flow > 400 ? 'bg-red-500 animate-node-pulse' : 
                            sensor.flow > 250 ? 'bg-yellow-500' : 'bg-green-500'
                          }`} />
                          <span className="text-sm font-mono text-industrial-300">{sensor.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Waves className="w-3 h-3 text-blue-400" />
                          <span className="text-sm font-mono font-semibold text-white">
                            {sensor.flow.toFixed(1)}
                          </span>
                          <span className="text-xs text-industrial-500">m³/s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Network Stats */}
                <div className="mt-6 p-4 rounded-lg bg-industrial-800/40 border border-industrial-700/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-industrial-400">Network Status</span>
                    <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-900/20">
                      ONLINE
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-industrial-400">Active Nodes</span>
                    <span className="text-white font-mono">7/7</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-industrial-400">Data Latency</span>
                    <span className="text-green-400 font-mono">~45ms</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ZONE 2: Discharge Curve (Center Panel) */}
          <div className="col-span-6">
            <Card className="h-full glass-panel border-industrial-700/50">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">Hydrological Prediction Model</CardTitle>
                      <p className="text-xs text-industrial-400">Neural Network Discharge Forecasting</p>
                    </div>
                  </div>
                  {prediction && (
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-industrial-400">Predicted Discharge</p>
                        <p className={`text-2xl font-mono font-bold ${
                          prediction.predicted_discharge_m3s > CRITICAL_THRESHOLD 
                            ? 'text-red-400' 
                            : 'text-blue-400'
                        }`}>
                          {prediction.predicted_discharge_m3s.toFixed(1)}
                          <span className="text-sm text-industrial-500 ml-1">m³/s</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[calc(100%-80px)] min-h-[400px] chart-container rounded-lg p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <defs>
                        <linearGradient id="dischargeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.2)" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickLine={{ stroke: '#64748b' }}
                      />
                      <YAxis 
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickLine={{ stroke: '#64748b' }}
                        label={{ 
                          value: 'Discharge (m³/s)', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fill: '#64748b', fontSize: 12 }
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.95)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <ReferenceLine 
                        y={CRITICAL_THRESHOLD} 
                        stroke="#ef4444" 
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        label={{
                          value: 'Critical Evacuation Threshold (1200 m³/s)',
                          fill: '#ef4444',
                          fontSize: 12,
                          position: 'right'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="discharge"
                        stroke="none"
                        fill="url(#dischargeGradient)"
                      />
                      <Line
                        type="monotone"
                        dataKey="discharge"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: '#60a5fa', stroke: '#fff', strokeWidth: 2 }}
                        animationDuration={500}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Chart Legend */}
                <div className="mt-4 flex items-center justify-center gap-8">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-1 bg-blue-500 rounded" />
                    <span className="text-sm text-industrial-400">Predicted Discharge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 border-t-2 border-dashed border-red-500" />
                    <span className="text-sm text-industrial-400">Critical Threshold (1200 m³/s)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ZONE 3: AI Response (Right Panel) */}
          <div className="col-span-3">
            <Card className="h-full glass-panel border-industrial-700/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white">Neuro-Symbolic Agent</CardTitle>
                    <p className="text-xs text-industrial-400">AI Response System</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Indicator */}
                <div
                  className={`relative p-6 rounded-xl border-2 ${statusConfig.bg} ${statusConfig.border} ${
                    statusConfig.pulse ? 'animate-pulse-red animate-flash-border' : ''
                  } ${statusConfig.glow}`}
                >
                  <div className="flex flex-col items-center text-center">
                    <StatusIcon className={`w-12 h-12 ${statusConfig.text} mb-3`} />
                    <p className="text-sm text-industrial-400 mb-1">SYSTEM STATUS</p>
                    <p className={`text-xl font-bold ${statusConfig.text}`}>
                      {prediction ? statusConfig.label : 'AWAITING DATA'}
                    </p>
                    {prediction?.risk_level.includes('RED') && (
                      <div className="mt-3 px-4 py-2 bg-red-600/30 border border-red-500/50 rounded-lg">
                        <p className="text-sm text-red-300 font-semibold">EVACUATION REQUIRED</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Model Info */}
                {prediction && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-industrial-400">Input Nodes</span>
                      <span className="text-white font-mono">7</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-industrial-400">Model Type</span>
                      <span className="text-blue-400">LSTM-Attention</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-industrial-400">Confidence</span>
                      <span className="text-green-400 font-mono">94.2%</span>
                    </div>
                  </div>
                )}

                <Separator className="bg-industrial-700/50" />

                {/* Mobile Phone Frame with SMS */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-industrial-300">
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span className="font-medium">Last-Mile Alert (GenAI)</span>
                  </div>
                  
                  <div className="phone-frame p-4 mx-auto max-w-[240px]">
                    {/* Phone Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-1 bg-industrial-600 rounded-full mx-auto" />
                    </div>
                    
                    {/* Phone Screen */}
                    <div className="bg-black rounded-lg p-3 min-h-[180px]">
                      {showSms ? (
                        <div className="animate-scale-in">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                              <AlertTriangle className="w-3 h-3 text-white" />
                            </div>
                            <span className="text-xs text-industrial-400">Anga Watch Alert</span>
                          </div>
                          <div className="bg-green-900/40 border border-green-600/30 rounded-lg p-3">
                            <p className="text-sm text-green-300 leading-relaxed font-mono">
                              {smsTyped}
                              <span className="inline-block w-0.5 h-4 bg-green-400 ml-0.5 animate-pulse" />
                            </p>
                          </div>
                          <p className="text-xs text-industrial-500 mt-2 text-right">Just now</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-industrial-600">
                          <Smartphone className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-xs text-center">Waiting for alert...</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Phone Button */}
                    <div className="flex justify-center mt-4">
                      <div className="w-10 h-10 rounded-full border-2 border-industrial-600" />
                    </div>
                  </div>

                  {/* SMS Translation */}
                  {showSms && smsTyped.length === SWAHILI_SMS.length && (
                    <div className="p-3 rounded-lg bg-industrial-800/40 border border-industrial-700/30 animate-fade-in">
                      <p className="text-xs text-industrial-400 mb-1">Translation:</p>
                      <p className="text-sm text-industrial-300 italic">
                        "WARNING: The Tana River is rising rapidly. Water will reach your village within two hours. Please evacuate to higher ground immediately!"
                      </p>
                    </div>
                  )}
                </div>

                {/* Alert Stats */}
                <div className="mt-auto p-4 rounded-lg bg-industrial-800/40 border border-industrial-700/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-industrial-400">Alerts Sent (24h)</span>
                    <span className="text-white font-mono">1,247</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-industrial-400">Coverage Area</span>
                    <span className="text-white font-mono">12 villages</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-industrial-400">Response Rate</span>
                    <span className="text-green-400 font-mono">87%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto p-4 border-t border-slate-800 bg-slate-950/50 backdrop-blur-md">
    <div className="flex justify-between items-center text-xs text-slate-500">
      <p>Anga Watch v1.0 | B2G Flood Defense System</p>
      <p>BeOrchid Africa Hackathon 2026</p>
    </div>
  </footer>
    </div>
  );
}
