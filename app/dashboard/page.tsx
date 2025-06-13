'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Card from '../components/Card';
import PinGate from "../components/PinGate";

type Entry = {
  date: string;
  how_good: number;
  productivity: number;
  drinks: number;
  scount: number;
  rose: string;
  gratitude: string;
  thought_of_day: string;
};

export default function Dashboard() {
  const [stats, setStats] = useState<null | Record<string, any>>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: entries, error } = await supabase
        .from('journal_entries')
        .select('*');

      if (error) {
        console.error('Supabase error:', error);
        return;
      }

      const parsed = entries.map((e: any) => ({
        ...e,
        date: new Date(e.date),
      }));

      const today = new Date();
      const thisYear = today.getFullYear();
      const last7 = parsed.filter(e => dateDiff(e.date, today) <= 7);
      const last14 = parsed.filter(e => dateDiff(e.date, today) <= 14);
      const thisYearEntries = parsed.filter(e => e.date.getFullYear() === thisYear);

      const rand = (arr: any[], field: string) =>
        arr.filter(e => e[field]?.trim()).sort(() => 0.5 - Math.random())[0]?.[field] || '—';

      setStats({
        avgQuality7: avg(last7.map(e => e.how_good)),
        avgProductivity7: avg(last7.map(e => e.productivity)),
        totalDrinksYear: sum(thisYearEntries.map(e => e.drinks)),
        drinks14: sum(last14.map(e => e.drinks)),
        discreetCount: sum(parsed.map(e => e.scount)),
        rose: rand(parsed, 'rose'),
        gratitude: rand(parsed, 'gratitude'),
        thought: rand(parsed, 'thought_of_day'),
      });
    }

    fetchData();
  }, []);

  if (!stats) return <p className="p-6 text-white">Loading dashboard...</p>;

  return (
    <PinGate>
      {!stats ? (
        <p className="p-6 text-white">Loading dashboard...</p>
      ) : (
        <main className="p-6 space-y-6">
          <h1 className="text-3xl font-bold text-white mb-4">Dashboard</h1>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card title="Avg Quality (7 days)">
              <p className="text-3xl font-bold">{stats.avgQuality7.toFixed(2)}</p>
            </Card>
            <Card title="Avg Productivity (7 days)">
              <p className="text-3xl font-bold">{stats.avgProductivity7.toFixed(2)}</p>
            </Card>
            <Card title="Total Drinks (This Year)">
              <p className="text-3xl font-bold">{stats.totalDrinksYear}</p>
            </Card>
            <Card title="Drinks (Last 14 Days)">
              <p className="text-3xl font-bold">{stats.drinks14}</p>
            </Card>
            <Card title="🎯 Mystery Tracker">
              <p className="text-3xl font-bold">{stats.discreetCount}</p>
            </Card>
            <Card title="🌹 Highlight of a Random Day">
              <p>{stats.rose}</p>
            </Card>
            <Card title="🙏 Gratitude from a Random Day">
              <p>{stats.gratitude}</p>
            </Card>
            <Card title="💭 Thought of the Day (Random)">
              <p>{stats.thought}</p>
            </Card>
          </div>
        </main>
      )}
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

