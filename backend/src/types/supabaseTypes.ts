export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// Minimal placeholders to keep backend build self-contained.
export type Database = any;

export type Tables<
  TableName extends string = string,
  RowType = any,
> = RowType;
