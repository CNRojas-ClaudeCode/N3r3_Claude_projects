import { productsRepo, type User } from '../data';
import { conflict, notFound } from '../lib/http';
import { audit, AuditAction } from './audit.service';

export type ProductType = 'PRODUCTO' | 'SERVICIO';

export type ProductInput = {
  code: string;
  name: string;
  description?: string | null;
  type: ProductType;
  priceCents: number;
  stock?: number | null;
  active?: boolean;
};

/** Los servicios no manejan existencias. */
const normalizeStock = (type: ProductType, stock: number | null | undefined) =>
  type === 'SERVICIO' ? null : (stock ?? 0);

const ensureCodeAvailable = async (code: string, exceptId?: string) => {
  const existing = await productsRepo.findByCode(code);
  if (existing && existing.id !== exceptId) {
    throw conflict(
      existing.deletedAt ? 'El código pertenece a un producto eliminado' : 'Ya existe un producto con ese código',
    );
  }
};

export const createProduct = async (input: ProductInput) => {
  await ensureCodeAvailable(input.code);
  return productsRepo.create({
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    type: input.type,
    priceCents: input.priceCents,
    stock: normalizeStock(input.type, input.stock),
    active: input.active ?? true,
  });
};

export const updateProduct = async (id: string, input: Partial<ProductInput>) => {
  const current = await productsRepo.findById(id);
  if (!current) throw notFound('Producto no encontrado');
  if (input.code && input.code !== current.code) await ensureCodeAvailable(input.code, id);
  const type = (input.type ?? current.type) as ProductType;
  return productsRepo.update(id, {
    ...input,
    stock: normalizeStock(type, input.stock !== undefined ? input.stock : current.stock),
  });
};

/** Eliminación lógica: conserva el historial para facturas futuras. Se registra en bitácora. */
export const deleteProduct = async (id: string, ctx: { actor: User; ip: string }) => {
  const current = await productsRepo.findById(id);
  if (!current) throw notFound('Producto no encontrado');
  await productsRepo.softDelete(id, new Date());
  await audit(AuditAction.PRODUCT_DELETED, {
    actor: ctx.actor,
    ip: ctx.ip,
    targetType: 'Product',
    targetId: id,
    details: { code: current.code, name: current.name, type: current.type },
  });
};
