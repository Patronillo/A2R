export interface User {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  pin: string;
}

export interface Article {
  id: number;
  code: string;
  description: string;
  initial_stock: number;
  available_stock: number;
  height: number;
  width: number;
  length: number;
  photo: string | null;
}

export interface Movement {
  id: number;
  article_id: number;
  user_id: number;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  observations: string;
  destination: string | null;
  related_movement_id: number | null;
  article_description?: string;
  article_code?: string;
  user_name?: string;
}

export type OutputType = 'ALUGUER' | 'SERVIÇO' | 'EMPRÉSTIMO' | 'REPARAÇÃO' | 'ESTRAGADO';

export interface Location {
  id: number;
  name: string;
}

export interface Employee {
  id: number;
  name: string;
}

export interface Output {
  id: number;
  type: OutputType;
  client_name: string;
  client_contact: string;
  delivery_date: string;
  assembly_date: string;
  collection_date: string;
  with_assembly: boolean;
  location_id: number;
  location_name?: string;
  space_at_location: string;
  observations: string;
  delivery_employee: string;
  collection_employee: string;
  user_id: number;
  created_at: string;
  items?: OutputItem[];
}

export interface OutputItem {
  id: number;
  output_id: number;
  article_id: number;
  quantity_out: number;
  quantity_in: number;
  article_description?: string;
  article_code?: string;
}
