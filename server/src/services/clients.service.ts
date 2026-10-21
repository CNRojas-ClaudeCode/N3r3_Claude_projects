import { clientsRepo } from '../data';
import { conflict, notFound } from '../lib/http';

export type ClientInput = {
  name: string;
  taxId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  creditDays?: number;
  active?: boolean;
};

const ensureTaxIdAvailable = async (taxId: string | null | undefined, exceptId?: string) => {
  if (!taxId) return;
  const existing = await clientsRepo.findByTaxId(taxId);
  if (existing && existing.id !== exceptId) throw conflict('Ya existe un cliente con ese RFC');
};

export const createClient = async (input: ClientInput) => {
  await ensureTaxIdAvailable(input.taxId);
  return clientsRepo.create({
    name: input.name,
    taxId: input.taxId ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    creditDays: input.creditDays ?? 30,
    active: input.active ?? true,
  });
};

export const updateClient = async (id: string, input: Partial<ClientInput>) => {
  const current = await clientsRepo.findById(id);
  if (!current) throw notFound('Cliente no encontrado');
  if (input.taxId && input.taxId !== current.taxId) await ensureTaxIdAvailable(input.taxId, id);
  return clientsRepo.update(id, input);
};
