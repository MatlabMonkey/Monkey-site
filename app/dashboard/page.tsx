'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PinGate from '../components/PinGate';
import Card from '../components/Card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function gaussianSmooth(data: number[], sigma: number = 2): number[] {
  const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
  const kernel: number[] = [];
  const mid = Math.floor(kernelSize / 2);
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - mid;
    const g = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(g);
    sum += g;
  }
  const normalized = kernel.map(v => v / sum);
  return data.map((_, i) => {
    let acc = 0;
    for (let j = 0; j < kernelSize; j++) {
      const idx = i + j - mid;
      if (idx >= 0 && idx < data.length) {
        acc += data[idx] * normalized[j];
      }
    }
    return acc;
  });
}

function formatTick(dateStr: string, index: number, showAllDays: boolean) {
  const [y, m, d] = dateStr.split('-');
  const day = parseInt(d, 10);
  if (showAllDays) return `${parseInt(m, 10)}/${d}`;
  return day === 1 ? new Date(dateStr).toLocaleString('default', { month: 'short' }) : '';
}

function formatTooltipLabel(value: string) {
  return new Date(value).toISOString().split('T')[0];
}

function formatTooltipValue(value: number, name: string, props: any) {
  const raw = props?.payload?.[0]?.payload;
  if (!raw) return [`${value.toFixed(1)}`, name];
  const lookup: Record<string, any> = {
    'How Good': raw.actual_how_good,
    'Productivity': raw.actual_productivity,
    'Drinks': raw.actual_drinks
  };
  const val = lookup[name] ?? value;
  return [`${val.toFixed(1)}`, name];
}

type Entry = {
  date: string;
  how_good: number;
  productivity: number;
  drinks: number;
  scount: number;
  rose: string;
  gratitude: string;
  thought_of_day: string;
  booleans: string[];
};

export default function Dashboard() {
  const [stats, setStats] = useState<null | Record<string, any>>(null);
  const [timeRange, setTimeRange] = useState<'year' | '30days'>('year');
  const [showSmoothed, setShowSmoothed] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: entries, error } = await supabase.from('journal_entries').select('*');

      if (error) {
        console.error('Supabase error:', error);
        return;
      }

      const parsed = entries.map((e: any) => ({
        ...e,
        date: new Date(e.date),
      })).sort((a, b) => a.date.getTime() - b.date.getTime());

      const today = new Date();
      const thisYear = today.getFullYear();
      const last7 = parsed.filter(e => dateDiff(e.date, today) <= 7);
      const last14 = parsed.filter(e => dateDiff(e.date, today) <= 14);
      const thisYearEntries = parsed.filter(e => e.date.getFullYear() === thisYear);

      const rand = (arr: any[], field: string) => arr.filter(e => e[field]?.trim()).sort(() => 0.5 - Math.random())[0]?.[field] || '—';

      const workouts = ['Push', 'Pull', 'Legs', 'Surfing', 'Full body', 'Core', 'Cardio'];
      const workoutCounts = Object.fromEntries(workouts.map(type => [type, 0]));
      let other = 0;
      last14.forEach(e => {
        e.booleans?.forEach((val: string) => {
          if (workouts.includes(val)) workoutCounts[val]++;
        });
        other += e.scount || 0;
      });

      const dates = thisYearEntries.map(e => e.date.toISOString().split('T')[0]);
      const sigma = timeRange === '30days' ? 1.5 : 2;
      const qualitySeries = gaussianSmooth(thisYearEntries.map(e => e.how_good), sigma);
      const productivitySeries = gaussianSmooth(thisYearEntries.map(e => e.productivity), sigma);
      const drinksSeries = gaussianSmooth(thisYearEntries.map(e => e.drinks), sigma);

      setStats({
        avgQuality7: avg(last7.map(e => e.how_good)),
        avgProductivity7: avg(last7.map(e => e.productivity)),
        totalDrinksYear: sum(thisYearEntries.map(e => e.drinks)),
        drinks14: sum(last14.map(e => e.drinks)),
        discreetCount: other,
        rose: rand(parsed, 'rose'),
        gratitude: rand(parsed, 'gratitude'),
        thought: rand(parsed, 'thought_of_day'),
        workoutCounts,
        chartData: thisYearEntries.map((e, i) => ({
          date: e.date.toISOString().split('T')[0],
          how_good: qualitySeries[i],
          productivity: productivitySeries[i],
          drinks: drinksSeries[i],
          actual_how_good: e.how_good,
          actual_productivity: e.productivity,
          actual_drinks: e.drinks,
        })),
        rawChartData: thisYearEntries.map((e) => ({
          date: e.date.toISOString().split('T')[0],
          how_good: e.how_good,
          productivity: e.productivity,
          drinks: e.drinks,
          actual_how_good: e.how_good,
          actual_productivity: e.productivity,
          actual_drinks: e.drinks,
        }))
      });
    }

    fetchData();
  }, [timeRange, showSmoothed]);

  if (!stats) return <p className="p-6 text-gray-800">Loading dashboard...</p>;

  const chartData = showSmoothed ? stats.chartData : stats.rawChartData;
  const filteredData = chartData.slice(timeRange === 'year' ? 0 : -30);

  return (
    <PinGate>
      <main className="p-6 space-y-6 bg-gray-50 min-h-screen">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Dashboard</h1>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card title="Daily Averages (Last 7 Days)">
            <p className="text-lg">Quality of Life: <span className="font-bold text-xl">{stats.avgQuality7.toFixed(2)}</span></p>
            <p className="text-lg">Productivity: <span className="font-bold text-xl">{stats.avgProductivity7.toFixed(2)}</span></p>
          </Card>

          <Card title="Drink Summary">
            <p className="text-lg">Total This Year: <span className="font-bold text-xl">{stats.totalDrinksYear}</span></p>
            <p className="text-lg">Last 14 Days: <span className="font-bold text-xl">{stats.drinks14}</span></p>
          </Card>

          <Card title="Workout Tracker (Last 14 Days)">
            {Object.entries(stats.workoutCounts as Record<string, number>).map(([key, value]) => (
              <p key={key} className="text-md">
                {key}: <span className="font-semibold">{value}</span>
              </p>
            ))}
            <p className="text-md">Other: <span className="font-semibold">{stats.discreetCount}</span></p>
          </Card>

          <Card title="Random Highlights">
            <p><strong>🌹 Highlight:</strong> {stats.rose}</p>
            <p><strong>🙏 Gratitude:</strong> {stats.gratitude}</p>
            <p><strong>💭 Thought:</strong> {stats.thought}</p>
          </Card>
        </div>

        <div className="w-full bg-white rounded-xl p-4 shadow">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-gray-800">Yearly Trends</h2>
            <div className="space-x-4">
              <button
                onClick={() => setShowSmoothed(!showSmoothed)}
                className="text-blue-600 underline"
              >
                {showSmoothed ? 'Show Raw' : 'Show Smoothed'}
              </button>
              <button
                onClick={() => setTimeRange(timeRange === 'year' ? '30days' : 'year')}
                className="text-blue-600 underline"
              >
                View: {timeRange === 'year' ? 'Last 30 Days' : 'Full Year'}
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={filteredData}>
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatTick(d, 0, timeRange !== 'year')}
              />
              <YAxis domain={[0, 10]} ticks={[0, 2.5, 5, 7.5, 10]} />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                formatter={formatTooltipValue}
                contentStyle={{ color: '#111', fontWeight: 500 }}
                labelStyle={{ color: '#111', fontWeight: 700 }}
              />
              <Legend wrapperStyle={{ fontSize: '1rem' }} iconType="plainline" />
              <Line type="monotone" dataKey="how_good" stroke="#facc15" name="How Good" dot={false} />
              <Line type="monotone" dataKey="productivity" stroke="#3b82f6" name="Productivity" dot={false} />
              <Line type="monotone" dataKey="drinks" stroke="#ef4444" name="Drinks" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </main>
    </PinGate>
  );
}

function avg(arr: number[]) {
  const valid = arr.filter(n => typeof n === 'number' && !isNaN(n));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
}

function dateDiff(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
