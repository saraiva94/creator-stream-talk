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

export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  type: string,
  userId?: string
) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        to,
        subject,
        html,
        type,
        userId
      }
    });

    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};
