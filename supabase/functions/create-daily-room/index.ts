import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { roomTitle } = await req.json();
    const dailyApiKey = Deno.env.get('DAILY_API_KEY')!;

    // Create Daily.co room
    const roomName = `room-${user.id}-${Date.now()}`;
    const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dailyApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          enable_screenshare: true,
          enable_chat: false,
          start_video_off: false,
          start_audio_off: false,
          owner_only_broadcast: true
        }
      })
    });

    const dailyRoom = await dailyResponse.json();
    console.log('Daily.co room created:', dailyRoom);

    // Create room in database
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        creator_id: user.id,
        title: roomTitle || 'Live Stream',
        is_active: true,
        daily_room_name: dailyRoom.name
      })
      .select()
      .single();

    if (error) throw error;

    // Update creator profile
    await supabase
      .from('creator_profiles')
      .update({
        is_streaming: true,
        daily_room_name: dailyRoom.name,
        daily_room_url: dailyRoom.url
      })
      .eq('id', user.id);

    return new Response(JSON.stringify({
      room,
      dailyUrl: dailyRoom.url,
      dailyRoomName: dailyRoom.name
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error creating Daily room:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
