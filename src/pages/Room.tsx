import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ChatBox from "@/components/ChatBox";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowLeft, Circle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RoomData {
  id: string;
  title: string;
  is_active: boolean;
  viewer_count: number;
  creator_id: string;
  profiles: {
    username: string;
    avatar_url?: string;
  };
}

const Room = () => {
  const { creatorId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Acesso negado",
          description: "Você precisa estar logado para entrar em uma sala.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }
      setUser(session.user);
    };
    checkAuth();
  }, [navigate, toast]);

  useEffect(() => {
    if (!user || !creatorId) return;

    const fetchRoom = async () => {
      // First, get the creator profile
      const { data: creatorData, error: creatorError } = await supabase
        .from("creator_profiles")
        .select("*, profiles(username, avatar_url)")
        .eq("id", creatorId)
        .single();

      if (creatorError || !creatorData) {
        toast({
          title: "Criador não encontrado",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Get or create active room
      let { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("creator_id", creatorId)
        .eq("is_active", true)
        .single();

      if (roomError && roomError.code !== "PGRST116") {
        console.error("Error fetching room:", roomError);
      }

      if (!roomData) {
        // Create room if doesn't exist
        const { data: newRoom, error: createError } = await supabase
          .from("rooms")
          .insert({
            creator_id: creatorId,
            title: `Live de ${creatorData.profiles.username}`,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating room:", createError);
          setLoading(false);
          return;
        }
        roomData = newRoom;
      }

      setRoom({
        ...roomData,
        profiles: creatorData.profiles,
      });

      // Join room
      await supabase.from("room_participants").insert({
        room_id: roomData.id,
        user_id: user.id,
      });

      setLoading(false);
    };

    fetchRoom();

    return () => {
      if (room?.id && user?.id) {
        supabase
          .from("room_participants")
          .delete()
          .eq("room_id", room.id)
          .eq("user_id", user.id)
          .then();
      }
    };
  }, [user, creatorId, navigate, toast]);

  useEffect(() => {
    if (!room?.id) return;

    const fetchParticipants = async () => {
      const { count } = await supabase
        .from("room_participants")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);

      setParticipants(count || 0);
    };

    fetchParticipants();

    const channel = supabase
      .channel(`room_participants:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Carregando sala...
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Sala não encontrada</h2>
          <Button onClick={() => navigate("/")}>Voltar ao início</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar user={user} />

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Video Section */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            <div className="flex items-center gap-2">
              <Badge className="bg-destructive text-white animate-pulse">
                <Circle className="h-2 w-2 mr-1 fill-white" />
                AO VIVO
              </Badge>
              <div className="flex items-center gap-1 text-sm">
                <Users className="h-4 w-4" />
                <span className="font-semibold">{participants}</span>
              </div>
            </div>
          </div>

          {/* Video Player Placeholder */}
          <div className="flex-1 bg-secondary flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                {room.profiles.avatar_url ? (
                  <img
                    src={room.profiles.avatar_url}
                    alt={room.profiles.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <Users className="h-12 w-12 text-primary" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">{room.title}</h2>
                <p className="text-muted-foreground">
                  @{room.profiles.username}
                </p>
              </div>
              <div className="text-sm text-muted-foreground max-w-md">
                <p>
                  Espaço reservado para player de vídeo WebRTC.
                  <br />
                  Integre com serviços como Agora, Twilio ou Daily.co
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <h3 className="font-semibold mb-1">{room.title}</h3>
            <p className="text-sm text-muted-foreground">
              Por @{room.profiles.username}
            </p>
          </div>
        </div>

        {/* Chat Section */}
        <div className="w-full lg:w-96 h-[400px] lg:h-auto">
          <ChatBox roomId={room.id} currentUserId={user.id} />
        </div>
      </div>
    </div>
  );
};

export default Room;
