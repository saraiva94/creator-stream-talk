import { useState } from "react";
import { Settings, UserMinus, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";

interface FollowSettingsMenuProps {
  userId: string; // The user being followed
  currentUserId: string; // The logged-in user
  isFollowing: boolean;
  onUnfollow?: () => void;
  onBlock?: () => void;
}

export const FollowSettingsMenu = ({
  userId,
  currentUserId,
  isFollowing,
  onUnfollow,
  onBlock,
}: FollowSettingsMenuProps) => {
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleUnfollow = async () => {
    if (!isFollowing) return;
    
    setLoading(true);
    try {
      // Also remove from user_follows if exists
      await supabase
        .from("user_follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", userId);

      // Update subscription status
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("user_id", currentUserId)
        .eq("creator_id", userId)
        .eq("status", "active");

      toast({
        title: t.userProfile?.unfollow || "Deixou de seguir",
        description: "Você deixou de seguir este usuário",
      });

      onUnfollow?.();
    } catch (error) {
      console.error("Unfollow error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível deixar de seguir",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    setLoading(true);
    try {
      // Insert block record
      const { error } = await supabase
        .from("user_blocks")
        .insert({
          blocker_id: currentUserId,
          blocked_id: userId,
        });

      if (error) throw error;

      // Also unfollow if following
      if (isFollowing) {
        await supabase
          .from("user_follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", userId);

        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("user_id", currentUserId)
          .eq("creator_id", userId)
          .eq("status", "active");
      }

      toast({
        title: t.userProfile?.block || "Usuário bloqueado",
        description: "Este usuário foi bloqueado",
      });

      setShowBlockConfirm(false);
      onBlock?.();
    } catch (error) {
      console.error("Block error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível bloquear o usuário",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Don't show for own profile
  if (currentUserId === userId) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isFollowing && (
            <DropdownMenuItem
              onClick={handleUnfollow}
              disabled={loading}
              className="gap-2 cursor-pointer"
            >
              <UserMinus className="h-4 w-4" />
              {t.userProfile?.unfollow || "Deixar de seguir"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setShowBlockConfirm(true)}
            disabled={loading}
            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          >
            <Ban className="h-4 w-4" />
            {t.userProfile?.block || "Bloquear usuário"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.userProfile?.block || "Bloquear usuário"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja bloquear este usuário? Ele não poderá mais interagir com você.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              {t.common?.cancel || "Cancelar"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              disabled={loading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {loading ? "..." : (t.userProfile?.block || "Bloquear")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default FollowSettingsMenu;
