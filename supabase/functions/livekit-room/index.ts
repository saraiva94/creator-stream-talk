import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// JWT helper for LiveKit token generation
function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  roomName: string,
  participantIdentity: string,
  participantName: string,
  grants: {
    roomJoin: boolean;
    room: string;
    canPublish: boolean;
    canSubscribe: boolean;
    canPublishData?: boolean;
  }
): Promise<string> {
  const encoder = new TextEncoder();
  
  // JWT Header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  // JWT Payload with LiveKit claims
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: participantIdentity,
    name: participantName,
    iat: now,
    nbf: now,
    exp: now + 3600, // 1 hour expiry
    video: {
      roomJoin: grants.roomJoin,
      room: grants.room,
      canPublish: grants.canPublish,
      canSubscribe: grants.canSubscribe,
      canPublishData: grants.canPublishData ?? true,
    }
  };
  
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const message = `${headerB64}.${payloadB64}`;
  
  // Sign with HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  
  return `${message}.${signatureB64}`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LIVEKIT_URL_RAW = Deno.env.get('LIVEKIT_URL');
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY');
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // === LIVEKIT_URL SANITIZER ===
    const sanitizeLivekitUrl = (raw: string | undefined): { sanitized: string; error?: string } => {
      console.log('[livekit-room] rawLivekitUrl:', JSON.stringify(raw));
      
      if (!raw || typeof raw !== 'string') {
        return { sanitized: '', error: 'LIVEKIT_URL não configurada' };
      }
      
      let sanitized = raw.trim();
      
      // Check for invalid characters BEFORE any processing
      const hasInternalSpace = sanitized.includes(' ');
      const hasEquals = sanitized.includes('=');
      const protocolMatches = sanitized.match(/:\/\//g) || [];
      const hasMultipleProtocols = protocolMatches.length > 1;
      
      if (hasInternalSpace || hasEquals || hasMultipleProtocols) {
        const displayValue = sanitized.substring(0, 60).replace(/./g, (c) => c === ' ' ? '␣' : c);
        return { 
          sanitized: '', 
          error: `LIVEKIT_URL inválida (chars: space=${hasInternalSpace}, equals=${hasEquals}, multiProto=${hasMultipleProtocols}): ${displayValue}` 
        };
      }
      
      // Remove duplicate protocol prefixes (wss://wss://, etc)
      sanitized = sanitized
        .replace(/^(wss:\/\/)+/g, 'wss://')
        .replace(/^(ws:\/\/)+/g, 'ws://')
        .replace(/^(https:\/\/)+/g, 'https://')
        .replace(/^(http:\/\/)+/g, 'http://');
      
      // Normalize to wss://
      if (sanitized.startsWith('https://')) {
        sanitized = sanitized.replace('https://', 'wss://');
      } else if (sanitized.startsWith('http://')) {
        sanitized = sanitized.replace('http://', 'ws://');
      } else if (!sanitized.startsWith('wss://') && !sanitized.startsWith('ws://')) {
        sanitized = `wss://${sanitized}`;
      }
      
      console.log('[livekit-room] sanitizedLivekitUrl:', sanitized);
      return { sanitized };
    };

    // Validate configuration
    if (!LIVEKIT_URL_RAW || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error('[livekit-room] Missing LiveKit configuration');
      return new Response(
        JSON.stringify({ error: 'LiveKit not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize URL
    const urlResult = sanitizeLivekitUrl(LIVEKIT_URL_RAW);
    if (urlResult.error) {
      console.error('[livekit-room] URL validation failed:', urlResult.error);
      return new Response(
        JSON.stringify({ error: urlResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const LIVEKIT_URL = urlResult.sanitized;

    // Parse request body with validation
    let body: { action?: string; liveId?: string } = {};
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('[livekit-room] JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON body', 
          reason: 'Could not parse request body as JSON',
          receivedContentType: req.headers.get('content-type')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, liveId } = body;
    console.log(`[livekit-room] Action: ${action}, LiveId: ${liveId}`);

    // Debug action - returns URL info and reachability test
    if (action === 'debug') {
      console.log('[livekit-room] Running debug diagnostics...');
      
      // Re-run sanitizer to get full details for debug
      const debugUrlResult = sanitizeLivekitUrl(LIVEKIT_URL_RAW);
      
      // Convert to HTTP for reachability test
      let normalizedHttpUrl = '';
      if (debugUrlResult.sanitized) {
        normalizedHttpUrl = debugUrlResult.sanitized
          .replace('wss://', 'https://')
          .replace('ws://', 'http://');
      }
      
      let reachabilityResult: { ok: boolean; status?: number; errorMessage?: string } = { ok: false };
      
      if (normalizedHttpUrl) {
        try {
          console.log('[livekit-room] Testing reachability:', normalizedHttpUrl);
          const testResponse = await fetch(normalizedHttpUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });
          reachabilityResult = { 
            ok: testResponse.ok, 
            status: testResponse.status 
          };
          console.log('[livekit-room] Reachability result:', reachabilityResult);
        } catch (fetchError: any) {
          reachabilityResult = { 
            ok: false, 
            errorMessage: fetchError.message || String(fetchError)
          };
          console.error('[livekit-room] Reachability error:', fetchError);
        }
      }
      
      const debugInfo = {
        rawLivekitUrl: LIVEKIT_URL_RAW || '(not set)',
        sanitizedLivekitUrl: debugUrlResult.sanitized || '(failed)',
        sanitizeError: debugUrlResult.error || null,
        normalizedHttpUrl: normalizedHttpUrl || '(n/a)',
        reachability: reachabilityResult,
        apiKeyPresent: !!LIVEKIT_API_KEY,
        apiSecretPresent: !!LIVEKIT_API_SECRET,
        timestamp: new Date().toISOString()
      };
      
      console.log('[livekit-room] Debug info:', JSON.stringify(debugInfo, null, 2));
      
      return new Response(
        JSON.stringify(debugInfo),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!action || !liveId) {
      console.error('[livekit-room] Missing required fields:', { action, liveId });
      return new Response(
        JSON.stringify({ 
          error: 'Missing action or liveId',
          reason: 'Both action and liveId are required fields',
          receivedAction: action || '(empty)',
          receivedLiveId: liveId || '(empty)'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with auth from request
    const authHeader = req.headers.get('Authorization');
    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Service role client for updates
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get current user (may be null for anonymous viewers)
    const { data: { user } } = await supabaseClient.auth.getUser();

    // Fetch the live
    const { data: live, error: liveError } = await supabaseAdmin
      .from('lives')
      .select('id, creator_id, status, is_active, webrtc_room_name, title')
      .eq('id', liveId)
      .single();

    if (liveError || !live) {
      console.error('[livekit-room] Live not found:', liveError);
      return new Response(
        JSON.stringify({ error: 'Live not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate room name if not exists
    const roomName = live.webrtc_room_name || `live-${liveId}`;

    if (action === 'host-token') {
      // Host token: must be authenticated and be the creator
      if (!user) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (user.id !== live.creator_id) {
        console.warn(`[livekit-room] Unauthorized host attempt: ${user.id} vs ${live.creator_id}`);
        return new Response(
          JSON.stringify({ error: 'Not authorized as host' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch creator profile for display name
      const { data: profile } = await supabaseAdmin
        .from('creator_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const participantName = profile?.display_name || 'Host';

      // Generate host token with publish permissions
      const token = await createLiveKitToken(
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET,
        roomName,
        user.id,
        participantName,
        {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        }
      );

      // Update live lifecycle when host joins (authoritative: host presence == LIVE)
      const nowIso = new Date().toISOString();

      await supabaseAdmin
        .from('lives')
        .update({
          webrtc_room_name: roomName,
          host_joined_at: nowIso,
          host_last_heartbeat: nowIso,
          status: 'live',
          is_active: true,
          ended_at: null,
        })
        .eq('id', liveId);

      // Keep creator streaming flag in sync
      await supabaseAdmin
        .from('creator_profiles')
        .update({ is_streaming: true })
        .eq('id', user.id);

      console.log(`[livekit-room] Host token generated for ${user.id} in room ${roomName}`);

      return new Response(
        JSON.stringify({
          token,
          roomName,
          livekitUrl: LIVEKIT_URL,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'viewer-token') {
      // Viewer token: live must be active
      if (live.status !== 'live' || !live.is_active) {
        console.warn(`[livekit-room] Live not active: status=${live.status}, is_active=${live.is_active}`);
        return new Response(
          JSON.stringify({ error: 'Live is not active', status: live.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate participant identity (user id or anonymous)
      const participantIdentity = user?.id || `anon-${crypto.randomUUID().slice(0, 8)}`;
      
      // Get viewer name (use maybeSingle to handle missing profiles gracefully)
      let participantName = 'Viewer';
      if (user) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle();
        participantName = profile?.username || 'Viewer';
      }

      // Generate viewer token (subscribe only)
      const token = await createLiveKitToken(
        LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET,
        roomName,
        participantIdentity,
        participantName,
        {
          roomJoin: true,
          room: roomName,
          canPublish: false,
          canSubscribe: true,
          canPublishData: false,
        }
      );

      console.log(`[livekit-room] Viewer token generated for ${participantIdentity} in room ${roomName}`);

      return new Response(
        JSON.stringify({
          token,
          roomName,
          livekitUrl: LIVEKIT_URL,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'heartbeat') {
      // Host heartbeat to keep session alive
      if (!user || user.id !== live.creator_id) {
        return new Response(
          JSON.stringify({ error: 'Not authorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const nowIso = new Date().toISOString();

      await supabaseAdmin
        .from('lives')
        .update({
          host_last_heartbeat: nowIso,
          // Ensure the live doesn't get stuck as ended while host is actively connected
          status: 'live',
          is_active: true,
          ended_at: null,
        })
        .eq('id', liveId);

      console.log(`[livekit-room] Heartbeat updated for live ${liveId}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[livekit-room] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
