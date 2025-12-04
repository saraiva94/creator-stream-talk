import { supabase } from "@/integrations/supabase/client";

export type CreatorProfileSettings = {
  displayName: string;
  bio: string;
  tags: string[];
  language: string;
  notifications: boolean;
};

type CreatorProfileRow = {
  display_name: string | null;
  bio: string | null;
  tags: string[] | null;
};

export const creatorSettingsService = async (profileId: string) => {
  const { data, error } = await supabase
    .from("creator_profiles")
    .select("display_name, bio, tags")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const row = data as CreatorProfileRow | null;
  
  const profile: CreatorProfileSettings = {
    displayName: row?.display_name ?? "",
    bio: row?.bio ?? "",
    tags: row?.tags ?? [],
    language: "pt-BR",
    notifications: true,
  };

  return { profile };
};

export const saveCreatorSettings = async (profileId: string, profile: CreatorProfileSettings) => {
  const { error } = await supabase
    .from("creator_profiles")
    .update({
      display_name: profile.displayName,
      bio: profile.bio,
      tags: profile.tags,
    })
    .eq("id", profileId);

  if (error) {
    throw new Error(error.message);
  }

  return profile;
};
