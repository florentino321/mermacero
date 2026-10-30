# MermaCero — comida con un nuevo destino

Prototipo académico para registrar comida preparada excedente de restaurantes, comedores y eventos, coordinar su recojo por organizaciones sociales y registrar su distribución a familias. Los residuos separados tienen una ruta distinta hacia gestores de compostaje o biodigestión.

Aplicación: https://mermacero.onrender.com · Código: https://github.com/florentino321/mermacero

## Propuesta y demostración

1. El donante registra alimento, kilos, porciones, preparación, ingredientes y alérgenos, conservación en frío o caliente y plazo de recojo. Declara aptitud y conservación adecuada.
2. El sistema recomienda organizaciones sociales compatibles por categoría, capacidad por lote, radio, conservación y margen de traslado.
3. El coordinador reserva; el receptor confirma recepción y revisión de conservación e información alimentaria.
4. La organización declara porciones distribuidas y familias atendidas en esa entrega.
5. Los residuos se ofrecen solo a gestores que admiten el método declarado. Un lote sin entregar puede derivarse explícitamente a orgánicos y no puede volver a donación.

Ejemplo de exposición: registra 12 kg y 40 porciones de arroz con pollo, reserva, confirma recepción y declara 40 porciones para 10 familias como prueba ficticia. Después muestra un lote para compostaje. Recarga y consulta los documentos en Atlas. Los ejemplos y las cifras no representan donaciones reales.

No toda comida sobrante es apta para donar. La aplicación **no determina inocuidad ni vida útil**: las declaraciones no sustituyen protocolos sanitarios, control de temperatura ni revisión por responsables capacitados. Las 24 horas máximas para programar recojo de comida preparada son un límite logístico, no una garantía sanitaria. La preparación puede registrarse hasta 7 días atrás como validación de formato; esto no implica aptitud.

El beneficio ambiental y social es una hipótesis de piloto. No se han medido emisiones evitadas, mejoras de salud ni impacto real. El diferencial propuesto combina dos destinos separados, compatibilidad explicable y trazabilidad; no se afirma originalidad mundial. No es una inscripción enviada ni una afiliación a MIT Solve.

## Ejecutar y configurar

Requiere Node.js 22 o 24. Ejecuta `npm ci` y `npm run demo`; abre http://localhost:3000 y usa `mermacero-demo`. **La demo usa memoria temporal, no MongoDB**. Reiniciar pierde cambios; está bloqueada en producción.

Para MongoDB real, copia `.env.example` a `.env`. Completa `MONGODB_URI`, `MONGODB_PASSWORD`, `MONGODB_DB=mermacero` y una `ADMIN_PASSWORD` de al menos 12 caracteres. Mantén `DEMO_MODE=false`. El URI de Drivers / Node.js puede conservar `<db_password>`; escribe la contraseña original en `MONGODB_PASSWORD` y el servidor la codifica. También admite un URI completo con contraseña ya codificada. No subas secretos a GitHub. Autoriza tu IP en Atlas y usa un usuario readWrite limitado a mermacero. Ejecuta `npm start`. Si MongoDB falla, el servidor no cambia silenciosamente a memoria.

Para ejemplos, ingresa como coordinador → Sobre el proyecto → cargar ejemplos. También admite `SEED_DEMO_DATA=true` y `npm run seed`. Solo inserta IDs faltantes; no borra, sobrescribe ni renueva fechas existentes. Los nuevos ejemplos son dos donantes, una organización social, un gestor y cuatro lotes de comida preparada/orgánicos. Los registros antiguos se conservan e identifican en la interfaz. Crea nuevos registros o edita plazos antes de exponer.

Render: Build `npm ci`, Start `npm start`, Health Check `/api/health`, Node 24, `NODE_ENV=production`, `DEMO_MODE=false`, `MONGODB_DB=mermacero`. Las variables privadas son `MONGODB_URI`, `MONGODB_PASSWORD` y `ADMIN_PASSWORD`. `render.yaml` permite recrear la configuración. Autoriza en Atlas los rangos de salida indicados por Render. La comprobación `/api/health` debe responder `{"ok":true,"storage":"mongodb"}`. El servicio gratuito puede necesitar tiempo para despertar.

La conexión real con MongoDB y reserva/recepción de la versión inicial se verificaron el 29/10/2026 con datos ficticios. Esa prueba histórica no demuestra resultados del nuevo enfoque ni donaciones reales. Las pruebas automáticas usan memoria; el despliegue se verifica aparte.

## Arquitectura y MongoDB

Navegador HTML/CSS/JavaScript → API Node.js/Express en Render → MongoDB Atlas. Consulta pública y escrituras con clave de coordinación. Es una sola coordinación, sin cuentas independientes por organización.

**organizations:** id, name, district, lat, lng, type, createdAt, isSample. Por compatibilidad, `market` = donante, `kitchen` = organización social y `recycler` = gestor. Donantes añaden donorKind; receptores categories, capacityKg y maxDistanceKm. Organizaciones sociales declaran refrigeration y hotHolding; gestores recoveryMethods.

**lots:** id, title, category, kg, marketId (donante), route (donation/organic), pickupBy, status, notes, createdAt, isSample, modelVersion, history. Donaciones añaden foodSafetyConfirmed y allergens; comida preparada preparedAt, preservation y portions. Orgánicos recoveryMethod. Reserva guarda kitchenId (receptor de cualquier tipo) y reservation; recepción deliveredAt e inspectionConfirmed; distribución `{families,portions,at}`.

Estados: `available → reserved → delivered → distributed` (último solo en donación). Liberar: `reserved → available`. `expired` se deriva cuando pasó el plazo y el lote sigue pendiente; impide reservar o recibir. No convierte automáticamente en residuos ni determina seguridad alimentaria.

Índices: id único en ambas colecciones y `{status:1,pickupBy:1}` en lots. Referencias lógicas validadas por API. Reserva con findOneAndUpdate condicional por ID, estado y plazo: dos solicitudes concurrentes no reservan el mismo lote. Estado e historial se guardan juntos. La distribución cambia de estado condicionalmente y se registra una sola vez.

## Recomendaciones e indicadores

Primero filtra categoría, capacidad para el lote completo, radio, plazo y conservación. Donación va a organizaciones sociales; orgánicos a gestores compatibles.

`P = 100 × (0.50 × U + 0.30 × C + 0.20 × A)`

- U = max(0, 1 - horasRestantes / 24).
- C = max(0, 1 - distanciaKm / radioKm).
- A = kgDelLote / capacidadKg.
- Haversine en línea recta; tiempo ilustrativo ceil(distancia / 15 × 60 + 30) minutos.

Heurística didáctica sin IA, sensores ni tráfico real. No es probabilidad de éxito ni evaluación sanitaria. La capacidad es por lote, no cuota diaria; no fracciona lotes. Pesos y tiempos requieren piloto.

Indicadores: kilos pendientes, recibidos para donar, recibidos por gestores y distribución declarada. Recibir residuos **no demuestra tratamiento final**. Atenciones a familias se suman por entrega: pueden repetirse familias. No almacena sus identidades. Kilos recibidos se cuentan una sola vez aunque el lote pase a distribuido.

## API y pruebas

GET /api/health y /api/data son públicos. POST /api/login recibe `{password}` y devuelve token; escrituras usan Authorization: Bearer TOKEN. Sesiones en memoria por 8 horas; reiniciar invalida sesión, pero conserva MongoDB. Tokens en sessionStorage; sin JavaScript externo.

- POST /api/organizations: registrar participante.
- POST /api/lots; PUT o DELETE /api/lots/:id: crear, editar o eliminar lote sin reserva.
- POST /api/lots/:id/reserve: `{kitchenId}` compatible.
- POST /api/lots/:id/release: liberar.
- POST /api/lots/:id/deliver: `{receiptConfirmed:true,inspectionConfirmed:true}` en donación; orgánicos solo requiere recepción.
- POST /api/lots/:id/distribute: `{portions,families}` tras recibir donación.
- POST /api/lots/:id/divert: `{recoveryMethod,pickupBy}` deriva a orgánicos sin vuelta.
- POST /api/seed: insertar ejemplos faltantes; POST /api/logout: invalidar token.

`npm test`: ocho pruebas cubren validación, separación de rutas, conservación, filtros, vencimiento, acceso, CRUD, reservas concurrentes, distribución única y métricas. Flujo en navegador local: ingreso, publicación de comida preparada, reserva y recepción. Revisión visual a 1440, 768 y 390 px; inspector: 0 fallos y 0 advertencias.

Un piloto necesitaría organizaciones verificadas, protocolos sanitarios y de transporte, gestores habilitados, seguimiento de tratamiento final y evaluación de costos e impacto. El registro no certifica permisos. Nombres y coordenadas son públicos: usa datos ficticios o autorizados.

Referencias: [OMS](https://www.who.int/activities/promoting-safe-food-handling/five-key-to-safer-food), [FAO](https://www.fao.org/platform-food-loss-waste/food-waste/food-waste-reduction/en), [reto MIT Solve indicado](https://solve.mit.edu/challenges/2027-global-climate-challenge). Orientan la propuesta; no avalan el prototipo.
