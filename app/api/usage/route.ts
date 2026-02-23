import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30', 10);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('usage_daily')
      .select('*')
      .gte('date', startStr)
      .order('date', { ascending: false });

    if (error) throw error;

    // Aggregate by model for summary
    const modelSummary = data?.reduce((acc, row) => {
      const key = `${row.provider}/${row.model}`;
      if (!acc[key]) {
        acc[key] = {
          provider: row.provider,
          model: row.model,
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: 0,
        };
      }
      acc[key].tokens_in += row.tokens_in;
      acc[key].tokens_out += row.tokens_out;
      acc[key].cost_usd += parseFloat(row.cost_usd);
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      daily: data,
      summary: Object.values(modelSummary || {}),
      total_tokens_in: data?.reduce((sum, r) => sum + r.tokens_in, 0) || 0,
      total_tokens_out: data?.reduce((sum, r) => sum + r.tokens_out, 0) || 0,
      total_cost: data?.reduce((sum, r) => sum + parseFloat(r.cost_usd), 0) || 0,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
