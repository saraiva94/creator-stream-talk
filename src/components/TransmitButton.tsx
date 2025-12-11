import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import type { User } from "@supabase/supabase-js";

interface TransmitButtonProps {
  user: User | null;
}

export const TransmitButton = ({ user }: TransmitButtonProps) => {
  const { t } = useLanguage();
  const [isApprovedCreator, setIsApprovedCreator] = useState<boolean | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsApprovedCreator(false);
      setIsStreaming(false);
      return;
    }

    const checkCreatorStatus = async () => {
      const { data } = await supabase
        .from("creator_profiles")
        .select("approved_for_live, is_streaming")
        .eq("id", user.id)
        .single();

      if (data) {
        setIsApprovedCreator(data.approved_for_live || false);
        setIsStreaming(data.is_streaming || false);
      } else {
        setIsApprovedCreator(false);
      }
    };

    checkCreatorStatus();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`creator-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "creator_profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.new) {
            setIsApprovedCreator(payload.new.approved_for_live || false);
            setIsStreaming(payload.new.is_streaming || false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Show nothing if not approved (after loading)
  if (isApprovedCreator === false) {
    return null;
  }

  // Show placeholder while loading to prevent layout shift
  if (isApprovedCreator === null) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border min-w-[100px] h-[34px]">
        <span className="w-2.5 h-2.5 bg-muted rounded-full animate-pulse" />
        <span className="w-16 h-3 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <Link
      to="/live-management"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary/50 transition-all duration-300 group"
    >
      {isStreaming ? (
        <>
          <span className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full" />
            <span className="absolute w-2.5 h-2.5 bg-green-500 rounded-full animate-ping opacity-75" />
          </span>
          <span className="text-sm font-medium text-green-500">{t.nav.online}</span>
        </>
      ) : (
        <>
          <span className="relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />
            <span className="absolute w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          </span>
          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {t.nav.transmit}
          </span>
        </>
      )}
    </Link>
  );
};
