import { supabase } from "@/integrations/supabase/client";

export const createPayment = async (
  creatorId: string,
  userId: string,
  type: 'subscription' | 'superchat',
  amount?: number,
  description?: string
) => {
  try {
    const { data, error } = await supabase.functions.invoke('create-payment', {
      body: {
        creatorId,
        userId,
        type,
        amount,
        description
      }
    });

    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error creating payment:', error);
    throw error;
  }
};
