import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NicknameValidation {
  isValid: boolean;
  isAvailable: boolean | null;
  isChecking: boolean;
  error: string | null;
}

const NICKNAME_MIN_LENGTH = 3;
const NICKNAME_MAX_LENGTH = 20;
const NICKNAME_REGEX = /^[a-zA-Z0-9_]+$/;

export const validateNicknameFormat = (nickname: string): { valid: boolean; error: string | null } => {
  if (!nickname || nickname.length < NICKNAME_MIN_LENGTH) {
    return { valid: false, error: `Mínimo ${NICKNAME_MIN_LENGTH} caracteres` };
  }
  
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return { valid: false, error: `Máximo ${NICKNAME_MAX_LENGTH} caracteres` };
  }
  
  if (!NICKNAME_REGEX.test(nickname)) {
    return { valid: false, error: "Use apenas letras, números e _" };
  }
  
  return { valid: true, error: null };
};

export const useNicknameValidator = (debounceMs = 500) => {
  const [nickname, setNickname] = useState("");
  const [validation, setValidation] = useState<NicknameValidation>({
    isValid: false,
    isAvailable: null,
    isChecking: false,
    error: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkAvailability = useCallback(async (value: string) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const formatCheck = validateNicknameFormat(value);
    if (!formatCheck.valid) {
      setValidation({
        isValid: false,
        isAvailable: null,
        isChecking: false,
        error: formatCheck.error,
      });
      return;
    }

    setValidation(prev => ({ ...prev, isChecking: true, error: null }));
    
    abortControllerRef.current = new AbortController();
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", value)
        .maybeSingle();

      if (error) {
        console.error("Error checking nickname availability:", error);
        setValidation({
          isValid: false,
          isAvailable: null,
          isChecking: false,
          error: "Erro ao verificar disponibilidade",
        });
        return;
      }

      const isAvailable = !data;
      setValidation({
        isValid: isAvailable,
        isAvailable,
        isChecking: false,
        error: null,
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setValidation({
          isValid: false,
          isAvailable: null,
          isChecking: false,
          error: "Erro ao verificar disponibilidade",
        });
      }
    }
  }, []);

  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!nickname) {
      setValidation({
        isValid: false,
        isAvailable: null,
        isChecking: false,
        error: null,
      });
      return;
    }

    // Debounce the availability check
    timeoutRef.current = setTimeout(() => {
      checkAvailability(nickname);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [nickname, debounceMs, checkAvailability]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    nickname,
    setNickname,
    validation,
    isReady: validation.isValid && validation.isAvailable === true,
  };
};
