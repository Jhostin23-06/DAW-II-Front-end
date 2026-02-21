# Flujo Transportista -> Transporte -> Envio

## Relacion de IDs

```text
Usuario (transportista)
  userId = U1
        |
        | (asignacion)
        v
Transporte
  transportId = T1
  transportUserId = U1
        |
        | (envio creado con ese transporte)
        v
Envio
  shipmentId = S1
  transportId = T1
```

## Regla de negocio

Un envio aparece en la vista del transportista logueado cuando:

1. El transporte del envio (`shipment.transportId`) esta asignado a ese usuario.
2. Es decir, existe un transporte con:
   - `transport.transportId == shipment.transportId`
   - `transport.transportUserId == userId del logueado`

## Confirmacion de tu idea

Si primero asignas un transportista a un transporte, y luego creas un envio usando ese transporte, entonces ese envio debe aparecer en la vista del transportista logueado.

## Consulta recomendada

Para evitar mezclar datos en frontend:

- `GET /api/shipments?userId=<userIdLogueado>`

Ese endpoint ya resuelve los envios del usuario transportista.
