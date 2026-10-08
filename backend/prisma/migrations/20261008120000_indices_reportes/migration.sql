-- Índices para las consultas de reportes (ventas y movimientos por empresa y fecha)
-- y para el JOIN de top de productos (venta_items por producto).
CREATE INDEX "ventas_empresaId_createdAt_idx" ON "ventas"("empresaId", "createdAt");
CREATE INDEX "movimientos_stock_empresaId_createdAt_idx" ON "movimientos_stock"("empresaId", "createdAt");
CREATE INDEX "venta_items_productoId_idx" ON "venta_items"("productoId");
