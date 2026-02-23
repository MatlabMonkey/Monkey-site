import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  try {
    // Get current week's meal prep (or most recent)
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('meal_prep_weekly')
      .select('*')
      .lte('week_starting', today)
      .order('week_starting', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }

    // If no data, return null (frontend will show "coming soon")
    return NextResponse.json({ 
      recipe: data,
      hasRecipe: !!data 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
