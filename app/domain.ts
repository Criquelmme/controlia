export type Client = { id: string; name: string; phone: string; notes: string };
export type Variant = { id: string; name: string; size: string; color: string; price: number; stock: number; purchasePrice?: number; profitPercent?: number };
export type Line = { variantId: string; name: string; size: string; color: string; price: number; quantity: number; reserved: number; delivered?: number };
export type Delivery = { id: string; at: string; lines: { variantId: string; quantity: number }[] };
export type Refund = { id: string; at: string; lines: { variantId: string; quantity: number; restock: boolean }[]; amount: number; method: 'cash' | 'transfer'; reference: string; reason: string };
export type Order = { id: string; number: number; clientId: string; lines: Line[]; total: number; notes: string; createdAt: string; status: 'pending' | 'delivered' | 'cancelled'; deliveredAt?: string; deliveries?: Delivery[]; cancelledAt?: string; paymentMode: 'now' | 'later'; method: 'cash' | 'transfer'; dueDate: string; paidAt?: string; paymentMethod?: 'cash' | 'transfer'; paymentReference?: string; dueHistory: { from: string; to: string; at: string }[]; refunds?: Refund[] };
export type Supply = { id: string; orderId: string; variantId: string; quantity: number; received: number; eta: string; createdAt: string; cancelled?: boolean };
export type Movement = { id: string; variantId: string; delta: number; reason: string; at: string; orderId?: string };
export type Shop = { clients: Client[]; variants: Variant[]; orders: Order[]; supplies: Supply[]; movements: Movement[]; operations: string[] };
export type Command = { id: string; kind: string; payload: Record<string, unknown> };
export const emptyShop = (): Shop => ({ clients: [], variants: [], orders: [], supplies: [], movements: [], operations: [] });
export class BusinessError extends Error {}
const fail = (message: string): never => { throw new BusinessError(message); };
function str(value: unknown, label: string, required = true, max = 500): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) return fail(`${label}: revisa el valor ingresado.`);
  return value.trim();
}
function num(value: unknown, label: string, min = 0, max = 1000000000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return fail(`${label}: ingresa un número entero entre ${min} y ${max}.`);
  return value;
}
function percent(value: unknown, label: string, min = 0, max = 1000): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || Math.abs(value * 10 - Math.round(value * 10)) > 1e-8) return fail(`${label}: ingresa un porcentaje entre ${min} y ${max}, con hasta un decimal.`);
  return value;
}
function date(value: unknown, required = true): string {
  const s = str(value ?? '', 'Fecha', required, 10);
  if (!s && !required) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) return fail('La fecha no es válida.');
  return s;
}
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function reserved(shop: Shop, id: string): number {
  return shop.orders.filter(o => o.status === 'pending').flatMap(o => o.lines).filter(l => l.variantId === id).reduce((sum, l) => sum + l.reserved, 0);
}
export function missing(order: Order): number {
  return order.status === 'pending' ? order.lines.reduce((sum, l) => sum + l.quantity - (l.delivered ?? 0) - l.reserved, 0) : 0;
}
export function refunded(order: Order): number {
  return (order.refunds ?? []).reduce((sum, item) => sum + item.amount, 0);
}
export function returned(order: Order, variantId: string): number {
  return (order.refunds ?? []).flatMap(item => item.lines).filter(line => line.variantId === variantId).reduce((sum, line) => sum + line.quantity, 0);
}
export function outstanding(shop: Shop, orderId: string, variantId: string): number {
  return shop.supplies.filter(s => s.orderId === orderId && s.variantId === variantId && !s.cancelled).reduce((sum, s) => sum + s.quantity - s.received, 0);
}
function allocate(shop: Shop) {
  for (const v of shop.variants) {
    let available = v.stock - reserved(shop, v.id);
    for (const o of shop.orders.filter(o => o.status === 'pending').sort((a, b) => a.number - b.number)) {
      for (const l of o.lines.filter(l => l.variantId === v.id)) {
        const take = Math.min(available, l.quantity - (l.delivered ?? 0) - l.reserved);
        l.reserved += take; available -= take;
      }
    }
  }
}
export function applyCommand(input: Shop, cmd: Command, at = new Date().toISOString()): Shop {
  str(cmd.id, 'Operación', true, 100);
  if (input.operations.includes(cmd.id)) return input;
  const shop: Shop = structuredClone(input);
  const p = cmd.payload;
  if (!p || typeof p !== 'object' || Array.isArray(p)) return fail('Solicitud inválida.');
  const findVariant = (id: unknown) => shop.variants.find(v => v.id === id) ?? fail('La prenda no existe.');
  const findOrder = () => shop.orders.find(o => o.id === p.orderId) ?? fail('El pedido no existe.');
  const addMove = (variantId: string, delta: number, reason: string, orderId?: string) => shop.movements.push({ id: crypto.randomUUID(), variantId, delta, reason, at, ...(orderId ? { orderId } : {}) });
  switch (cmd.kind) {
    case 'client.save': {
      const existing = p.clientId ? shop.clients.find(c => c.id === p.clientId) ?? fail('El cliente no existe.') : null;
      const data = { name: str(p.name, 'Nombre', true, 100), phone: str(p.phone ?? '', 'Teléfono', false, 50), notes: str(p.notes ?? '', 'Observaciones', false, 1000) };
      if (existing) Object.assign(existing, data); else shop.clients.push({ id: crypto.randomUUID(), ...data });
      break;
    }
    case 'variant.create': {
      const name = str(p.name, 'Nombre', true, 100), size = str(p.size, 'Talla', true, 30), color = str(p.color, 'Color', true, 50);
      if (shop.variants.some(v => v.name.toLocaleLowerCase() === name.toLocaleLowerCase() && v.size.toLocaleLowerCase() === size.toLocaleLowerCase() && v.color.toLocaleLowerCase() === color.toLocaleLowerCase())) return fail('Ya existe esta prenda, talla y color. Registra una entrada de stock.');
      const purchasePrice = num(p.purchasePrice, 'Precio de compra', 1);
      const profitPercent = percent(p.profitPercent, 'Porcentaje de ganancia');
      const price = num(Math.round(purchasePrice * (1 + profitPercent / 100)), 'Precio de venta', 1);
      const v = { id: crypto.randomUUID(), name, size, color, price, stock: num(p.stock, 'Stock', 0, 1000000), purchasePrice, profitPercent };
      shop.variants.push(v);
      if (v.stock) addMove(v.id, v.stock, 'Stock inicial');
      break;
    }
    case 'stock.adjust': {
      const v = findVariant(p.variantId), delta = num(p.delta, 'Cantidad', -1000000, 1000000);
      if (!delta) return fail('El ajuste debe ser distinto de cero.');
      if (v.stock + delta < reserved(shop, v.id)) return fail('El ajuste dejaría sin stock a prendas ya reservadas.');
      v.stock = num(v.stock + delta, 'Stock resultante', 0, 1000000);
      addMove(v.id, delta, str(p.reason, 'Motivo', true, 300)); allocate(shop);
      break;
    }
    case 'order.create': {
      const client = shop.clients.find(c => c.id === p.clientId) ?? fail('Selecciona un cliente.');
      if (!Array.isArray(p.lines) || !p.lines.length || p.lines.length > 100) return fail('Agrega entre 1 y 100 prendas.');
      const seen = new Set<string>();
      const lines: Line[] = p.lines.map((raw: unknown) => {
        if (!raw || typeof raw !== 'object') return fail('Prenda inválida.');
        const item = raw as Record<string, unknown>, v = findVariant(item.variantId);
        if (seen.has(v.id)) return fail('Agrupa las unidades de una misma prenda en una sola línea.');
        seen.add(v.id);
        return { variantId: v.id, name: v.name, size: v.size, color: v.color, price: v.price, quantity: num(item.quantity, 'Cantidad', 1, 10000), reserved: 0, delivered: 0 };
      });
      if (p.paymentMode !== 'now' && p.paymentMode !== 'later') return fail('Selecciona cuándo se pagará.');
      if (p.method !== 'cash' && p.method !== 'transfer') return fail('Selecciona efectivo o transferencia.');
      const dueDate = p.paymentMode === 'now' ? today(new Date(at)) : date(p.dueDate);
      if (p.paymentMode === 'later' && dueDate < today(new Date(at))) return fail('El compromiso inicial debe ser hoy o una fecha futura.');
      const order: Order = { id: crypto.randomUUID(), number: Math.max(0, ...shop.orders.map(o => o.number)) + 1, clientId: client.id, lines, total: num(lines.reduce((s, l) => s + l.price * l.quantity, 0), 'Total', 1), notes: str(p.notes ?? '', 'Notas', false, 1000), createdAt: at, status: 'pending', paymentMode: p.paymentMode, method: p.method, dueDate, dueHistory: [], deliveries: [], refunds: [] };
      shop.orders.push(order); allocate(shop); break;
    }
    case 'order.deliver': {
      const o = findOrder();
      if (o.status !== 'pending') return fail('Este pedido ya fue entregado o cancelado.');
      if (!Array.isArray(p.lines) || !p.lines.length || p.lines.length > 100) return fail('Selecciona al menos una prenda para entregar.');
      const seen = new Set<string>(), deliveryLines: Delivery['lines'] = [];
      for (const raw of p.lines) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Prenda inválida.');
        const item = raw as Record<string, unknown>, variantId = str(item.variantId, 'Prenda', true, 100);
        const l = o.lines.find(line => line.variantId === variantId) ?? fail('La prenda no pertenece al pedido.');
        if (seen.has(variantId)) return fail('No repitas prendas en la entrega.');
        seen.add(variantId);
        const quantity = num(item.quantity, 'Cantidad a entregar', 1, 10000);
        if (quantity > l.reserved) return fail('La cantidad supera las prendas disponibles para entregar.');
        const v = findVariant(variantId);
        v.stock -= quantity; l.reserved -= quantity; l.delivered = (l.delivered ?? 0) + quantity;
        addMove(v.id, -quantity, `Entrega pedido #${o.number}`, o.id);
        deliveryLines.push({ variantId, quantity });
      }
      o.deliveries ??= [];
      o.deliveries.push({ id: crypto.randomUUID(), at, lines: deliveryLines });
      if (o.lines.every(line => (line.delivered ?? 0) === line.quantity)) { o.status = 'delivered'; o.deliveredAt = at; }
      allocate(shop); break;
    }
    case 'order.cancel': {
      const o = findOrder();
      if (o.status !== 'pending') return fail('Solo puedes cancelar un pedido pendiente de entrega.');
      if (o.paidAt) return fail('Este pedido ya está pagado y no se puede cancelar.');
      o.status = 'cancelled'; o.cancelledAt = at; o.lines.forEach(l => l.reserved = 0);
      shop.supplies.filter(s => s.orderId === o.id && s.received < s.quantity).forEach(s => s.cancelled = true);
      allocate(shop); break;
    }
    case 'payment.record': {
      const o = findOrder();
      if (o.status === 'cancelled' || o.paidAt) return fail('El pedido está cancelado o ya tiene un pago registrado.');
      if (p.method !== 'cash' && p.method !== 'transfer') return fail('Selecciona el método de pago.');
      o.paidAt = at; o.paymentMethod = p.method; o.paymentReference = str(p.reference ?? '', 'Referencia', false, 150); break;
    }
    case 'refund.create': {
      const o = findOrder();
      if (!o.paidAt || o.status === 'cancelled') return fail('Solo puedes registrar devoluciones de un pedido pagado y no cancelado.');
      if (!Array.isArray(p.lines) || !p.lines.length || p.lines.length > 100) return fail('Selecciona al menos una prenda para devolver.');
      if (p.method !== 'cash' && p.method !== 'transfer') return fail('Selecciona el método del reembolso.');
      const seen = new Set<string>(), refundLines: Refund['lines'] = [];
      let amount = 0;
      for (const raw of p.lines) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Prenda inválida.');
        const item = raw as Record<string, unknown>, variantId = str(item.variantId, 'Prenda', true, 100);
        const l = o.lines.find(line => line.variantId === variantId) ?? fail('La prenda no pertenece al pedido.');
        if (seen.has(variantId)) return fail('No repitas prendas en la devolución.');
        seen.add(variantId);
        const quantity = num(item.quantity, 'Cantidad a devolver', 1, 10000);
        if (quantity > (l.delivered ?? 0) - returned(o, variantId)) return fail('La devolución supera las unidades entregadas que todavía no se han devuelto.');
        if (typeof item.restock !== 'boolean') return fail('Indica si cada prenda vuelve al inventario.');
        amount += l.price * quantity;
        refundLines.push({ variantId, quantity, restock: item.restock });
      }
      if (amount + refunded(o) > o.total) return fail('El reembolso supera el total pagado.');
      const reference = str(p.reference ?? '', 'Referencia', false, 150);
      const reason = str(p.reason, 'Motivo', true, 300);
      o.refunds ??= [];
      o.refunds.push({ id: crypto.randomUUID(), at, lines: refundLines, amount, method: p.method, reference, reason });
      for (const line of refundLines.filter(item => item.restock)) {
        const v = findVariant(line.variantId);
        v.stock = num(v.stock + line.quantity, 'Stock resultante', 0, 1000000);
        addMove(v.id, line.quantity, `Devolución pedido #${o.number}`, o.id);
      }
      allocate(shop); break;
    }
    case 'payment.reschedule': {
      const o = findOrder();
      if (o.paidAt || o.status === 'cancelled') return fail('Solo puedes cambiar la fecha de un pago pendiente.');
      const next = date(p.dueDate);
      if (next !== o.dueDate) { o.dueHistory.push({ from: o.dueDate, to: next, at }); o.dueDate = next; o.paymentMode = 'later'; }
      break;
    }
    case 'supply.create': {
      const o = findOrder(), l = o.lines.find(l => l.variantId === p.variantId) ?? fail('La prenda no pertenece al pedido.');
      if (o.status !== 'pending') return fail('El pedido no está pendiente.');
      const quantity = num(p.quantity, 'Cantidad', 1, 10000);
      if (quantity > l.quantity - (l.delivered ?? 0) - l.reserved - outstanding(shop, o.id, l.variantId)) return fail('La cantidad supera el faltante sin encargar.');
      shop.supplies.push({ id: crypto.randomUUID(), orderId: o.id, variantId: l.variantId, quantity, received: 0, eta: date(p.eta, false), createdAt: at }); break;
    }
    case 'supply.receive': {
      const s = shop.supplies.find(s => s.id === p.supplyId) ?? fail('El encargo no existe.');
      if (s.cancelled) return fail('El encargo está cancelado.');
      const qty = num(p.quantity, 'Cantidad recibida', 1, 10000);
      if (qty > s.quantity - s.received) return fail('La recepción supera lo pendiente del encargo.');
      const v = findVariant(s.variantId); v.stock = num(v.stock + qty, 'Stock resultante', 0, 1000000); s.received += qty;
      addMove(v.id, qty, 'Recepción de encargo', s.orderId);
      // Give the originating order first claim on its requested shipment.
      const o = shop.orders.find(o => o.id === s.orderId)!;
      if (o.status === 'pending') { const l = o.lines.find(l => l.variantId === v.id)!; l.reserved += Math.min(qty, l.quantity - (l.delivered ?? 0) - l.reserved); }
      allocate(shop); break;
    }
    case 'supply.cancel': {
      const s = shop.supplies.find(s => s.id === p.supplyId) ?? fail('El encargo no existe.');
      if (s.cancelled || s.received === s.quantity) return fail('El encargo ya está cerrado.');
      s.cancelled = true; break;
    }
    default: return fail('Operación desconocida.');
  }
  for (const v of shop.variants) if (v.stock < 0 || reserved(shop, v.id) > v.stock) return fail('No hay stock suficiente para esta operación.');
  shop.operations.push(cmd.id);
  return shop;
}
