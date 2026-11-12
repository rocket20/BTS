# BTS Studio — Plan del control comercial NFC

**Estado:** diseño preparatorio, no desplegado ni aprobado como política de negocio.

## Modelo
- **Cliente:** vincular una empresa NFC a cliente del ERP BTS.
- **Pedido:** producto (corporativo, fidelización o VIP), cantidad, precio, moneda, fecha y responsable.
- **Lote:** vínculo entre pedido aprobado y códigos emitidos. Múltiples lotes por empresa.
- **Producción:** generada, grabada, verificada, entregada con responsable e historial.
- **Suscripción:** precio acordado, fecha de inicio, vencimiento y periodicidad; alerta antes de renovar.
- **Finanzas:** cobro, pago, saldo y costos, visibles exclusivamente a BTS; USD y NIO por separado.
- **Inventario:** total emitido, grabado, verificado, entregado, disponible, asignado y suspendido.

## Permisos
- **BTS:** pedidos, precios, finanzas, emisión NFC, descarga privada, grabación, entrega y soporte.
- **Propietario/encargado del negocio:** asigna cupos entregados; ve clientes y progreso.
- **Personal:** acredita compras o canjes según autorizaciones; sin emisión ni acceso comercial.
- **Consulta:** solo lectura de los módulos contratados.

## Implementar después de validar QA
1. Estados de fabricación NFC (rama ya preparada).
2. Asociar pedido comercial al lote sin crear inventarios duplicados.
3. Elegir precios, política de reposiciones y cuotas anuales.
4. Alertas de renovación, sin suspender por impago hasta definir política.
5. Reportes por negocio (tarjetas, puntos, premios, compras y acceso).
6. Facturación y conciliación dentro del ERP BTS.

## Decisiones a confirmar con socios
- Qué incluye el precio por tarjeta: diseño, PVC, chip, grabación, soporte y envío.
- Reposición de tarjetas perdidas o dañadas.
- Cobro antes de emitir vs. después de entregar.
- Período de gracia, anulaciones, renovaciones, suspensión y reactivación.
- Quién puede cambiar beneficios ya asignados y con qué autorización.
