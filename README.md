# MermaCero

Prototipo académico de una red de rescate alimentario para mercados y comedores comunitarios. Alineado con la línea de sistemas agroalimentarios resilientes del [MIT Solve Global Climate Challenge 2027](https://solve.mit.edu/challenges/2027-global-climate-challenge). No es una inscripción enviada ni un proyecto afiliado al MIT.

## Idea para presentar

**Problema:** coordinar el destino de excedentes perecibles antes del plazo de recojo declarado, considerando las limitaciones del receptor.

**Solución:** publicar un lote y recomendar comedores que puedan recogerlo por categoría, capacidad, distancia, refrigeración y plazo. El coordinador ve por qué se recomienda cada destino, reserva el lote y registra la entrega.

**Diferencial propuesto:** unir compatibilidad logística con prioridad explicable en una red local. No se afirma originalidad mundial: la novedad debe contrastarse con soluciones existentes y entrevistas. No usa IA, sensores ni predicciones de inocuidad.

**Beneficiarios propuestos:** mercados, comedores comunitarios y equipos municipales. Hipótesis: reducir coordinación manual y aumentar entregas oportunas. Hace falta un piloto para demostrarlo.

## Inicio rápido: demostración local

Requiere Node.js 22 o 24 y npm.

```powershell
npm ci
npm run demo
```

Abre [http://localhost:3000](http://localhost:3000). Clave de coordinación de esta demo: `mermacero-demo`.

**Este modo usa memoria temporal, NO MongoDB.** Incluye datos ficticios y los cambios se pierden al reiniciar. Está bloqueado en producción para evitar confundirlo con la entrega requerida.

## Ejecutar con MongoDB real

1. Crea un clúster en MongoDB Atlas y un usuario de base de datos con permisos de lectura/escritura solo en la base `mermacero`.
2. En Network Access, autoriza tu IP para trabajar desde tu computadora.
3. Copia `.env.example` a `.env` y completa `MONGODB_URI`, `MONGODB_PASSWORD` y `ADMIN_PASSWORD`. Usa una contraseña del proyecto de al menos 12 caracteres.
4. El URI debe ser el de **Drivers / Node.js**. Reemplaza usuario y host, conserva `<db_password>` y escribe la contraseña original en `MONGODB_PASSWORD`: el servidor la codifica automáticamente. También se admite un URI completo con la contraseña ya codificada, sin usar la variable separada. No compartas secretos ni los subas a GitHub.
5. Mantén `DEMO_MODE=false`. Ejecuta:

```powershell
npm ci
npm start
```

La aplicación crea los índices y las colecciones al conectar. Si MongoDB no conecta, el servidor no arranca; no cambia silenciosamente a memoria.

Para agregar ejemplos, ingresa como coordinador → Sobre el proyecto → Cargar registros ficticios de ejemplo. La carga inserta solo IDs inexistentes; no borra ni sobrescribe. También puedes poner `SEED_DEMO_DATA=true` en tu `.env` y ejecutar `npm run seed`. Los plazos se generan al insertar por primera vez; recargar no renueva fechas de ejemplos existentes. Para una entrega limpia, crea tus propios registros en una base nueva.

## Publicar en Render

Este repositorio ya incluye `render.yaml`. Se debe conectar una cuenta real de Render y un repositorio GitHub/GitLab accesible; este archivo no publica por sí solo.

1. Sube los archivos del proyecto a un repositorio. Excluye `.env`, `node_modules` y cualquier credencial. Incluye `package-lock.json`.
2. En Render: **New → Web Service**, conecta el repositorio y elige Node.
3. Configura:

| Campo | Valor |
|---|---|
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `DEMO_MODE` | `false` |
| `MONGODB_DB` | `mermacero` |
| `MONGODB_URI` | Tu URI privado de MongoDB Atlas |
| `MONGODB_PASSWORD` | Contraseña de MongoDB sin codificar, si el URI contiene `<db_password>` |
| `ADMIN_PASSWORD` | Tu clave privada de coordinación, mínimo 12 caracteres |

4. En Render consulta los rangos de IP de salida de tu servicio (Connect / Outbound, según el panel) y agrégalos en la lista de acceso de Atlas. Autoriza todos los rangos indicados para que el despliegue siga funcionando si cambia la IP dentro de ellos.
5. Despliega. Como alternativa, crea un Blueprint desde este repositorio para usar `render.yaml`; introduce la conexión y las contraseñas cuando Render las solicite.
6. Abre `https://TU-SERVICIO.onrender.com/api/health`. Debe responder `{"ok":true,"storage":"mongodb"}`.
7. Ingresa al sitio, registra un lote, recarga y comprueba que persiste. Reinicia el servicio y verifica de nuevo. En Atlas consulta `mermacero.organizations` y `mermacero.lots` para demostrar la persistencia.

Consulta disponibilidad y condiciones del plan en tu cuenta antes de crear el servicio. Si el servicio entra en reposo, ábrelo antes de la exposición y espera a que termine de iniciar.

Referencias oficiales: [Node en Render](https://render.com/docs/deploy-node-express-app), [variables y secretos](https://render.com/docs/configure-environment-variables), [lista de acceso de Atlas](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

## Modelo de datos

### `organizations`

`id` (UUID/string único), `name`, `type` (`market` o `kitchen`), `district`, `lat`, `lng`, `createdAt`, `isSample`.

Un comedor añade `categories`, `capacityKg` (por recojo), `maxDistanceKm`, `refrigeration`.

### `lots`

`id`, `title`, `category`, `kg`, `marketId` (referencia lógica a una organización), `pickupBy` (fecha ISO UTC), `refrigerated`, `notes`, `status`, `createdAt`, `isSample`, `history` (arreglo embebido).

Al reservar: `kitchenId` y `reservation` (instantánea explicable de la recomendación). Al entregar: `deliveredAt`.

Estados persistidos: `available → reserved → delivered`; `reserved → available` permite liberar. La API deriva `expired` si pasó el plazo y el lote aún está disponible o reservado. Los lotes entregados conservan su estado y su peso.

Índices: `id` único en ambas colecciones y `{status:1,pickupBy:1}` en lotes. La referencia lógica entre colecciones se valida en la API; MongoDB no impone una clave foránea.

Reserva atómica: `findOneAndUpdate({id,status:'available',pickupBy:{$gt:ahora}}, ...)`. Si otra solicitud ya lo reservó, se devuelve HTTP 409. El historial se agrega en la misma escritura que cambia el estado. No requiere transacciones entre colecciones.

La capacidad se interpreta **por lote**, no como cuota diaria. No se fraccionan lotes ni se descuentan capacidades de otros rescates. Esta simplificación debe explicarse en clase.

## Algoritmo

Filtros: categoría aceptada, lote completo dentro de capacidad, distancia dentro del radio, refrigeración compatible y margen de tiempo suficiente.

`P = 100 × (0.50 × U + 0.30 × C + 0.20 × A)`

- `U = max(0, 1 - horasRestantes / 24)`.
- `C = max(0, 1 - distanciaKm / radioKm)`.
- `A = kgDelLote / capacidadKg` (los filtros garantizan A ≤ 1).
- Distancia Haversine en línea recta. Tiempo ilustrativo: `ceil(distancia / 15 × 60 + 30)` minutos.
- Orden descendente por puntaje, después distancia y después ID.

Para el mismo lote, la urgencia es igual en todos los destinos; cercanía y ajuste diferencian a los comedores. Se muestra el puntaje redondeado como índice de prioridad, no porcentaje de éxito. Los pesos y la velocidad son supuestos didácticos; requieren calibración en un piloto.

El plazo lo declara el mercado; el sistema no calcula deterioro ni certifica inocuidad. El transporte refrigerado y las condiciones reales de manipulación requieren verificación fuera de este prototipo.

## API

Lectura pública: `GET /api/health`, `GET /api/data`.

`POST /api/login` recibe `{password}` y devuelve un token temporal. Las escrituras siguientes usan `Authorization: Bearer TOKEN`. Los tokens caducan a las 8 horas, se guardan en memoria del servidor y se invalidan al reiniciar; los datos de MongoDB permanecen.

| Método | Ruta | Operación |
|---|---|---|
| POST | `/api/organizations` | Registrar mercado o comedor |
| POST | `/api/lots` | Crear lote |
| PUT | `/api/lots/:id` | Editar lote sin reserva |
| DELETE | `/api/lots/:id` | Eliminar lote sin reserva e historial |
| POST | `/api/lots/:id/reserve` | Reservar con `{kitchenId}` compatible |
| POST | `/api/lots/:id/release` | Liberar reserva |
| POST | `/api/lots/:id/deliver` | Confirmar recepción con `{receiptConfirmed:true}` |
| POST | `/api/seed` | Insertar ejemplos faltantes |
| POST | `/api/logout` | Invalidar token |

Prototipo de una sola coordinación, no un sistema con usuarios y roles por organización. La consulta expone nombres y coordenadas: usa datos ficticios o autorizados, sin información personal. No publiques la clave de coordinación en el código. Los tokens se guardan en `sessionStorage` del navegador y el proyecto no carga JavaScript externo.

## Guion de demostración (5 minutos)

1. **Problema (40 s):** «Un lote de tomates puede perderse aunque exista un comedor cercano. Falta saber quién puede recibirlo a tiempo».
2. **Propuesta (40 s):** «MermaCero recomienda destinos compatibles y explica plazo, cercanía y capacidad».
3. **Demostración (2 min):** ingresar, crear mercado/comedor o usar ejemplos, publicar 10 kg con plazo futuro, ver recomendaciones, reservar, confirmar recepción y comprobar el aumento del indicador entregado.
4. **Base de datos (1 min):** mostrar en Atlas el lote con `marketId`, `kitchenId`, estado e historial. Recargar el sitio y demostrar persistencia.
5. **Alcance (40 s):** «Es un prototipo. Un piloto evaluaría entregas oportunas, kilos recibidos y utilidad de las recomendaciones. La reducción neta de emisiones aún no está medida».

Indicadores de piloto propuestos: kilos recibidos confirmados, porcentaje de reservas que terminan en entrega, tiempo entre publicación y recepción y motivos de rescates no completados. No inventes resultados ni beneficiarios reales.

## Pruebas

```powershell
npm test
```

Se prueban filtros logísticos, vencimiento, validación, conteo de kilos, protección de escrituras, CRUD y competencia de dos reservas por HTTP usando el adaptador de memoria. Estas pruebas **no certifican conexión a MongoDB Atlas ni despliegue en Render**. La verificación real se hace con el procedimiento de persistencia descrito arriba.

Archivos clave: `src/domain.js` (algoritmo), `src/store.js` (MongoDB y demo explícita), `src/app.js` (API), `public/` (interfaz), `render.yaml` (despliegue). El proyecto usa Node/Express y JavaScript sin compilación del frontend para facilitar su explicación.

Verificación local realizada: 6 pruebas automáticas aprobadas; flujo de navegador de ingreso, publicación, recomendación, reserva y recepción aprobado; comprobación visual a 1440, 768 y 390 px, sin desbordamiento horizontal de la página. El inspector de diseño terminó con 0 fallos y 0 advertencias. MongoDB Atlas y Render aún requieren conexión y verificación en las cuentas del propietario.

## Diseño

Dirección Framed sheet, semilla 309955881. Marco verde grisáceo y tipografía IBM Plex Sans. La pregunta principal es «¿qué lote necesita rescate primero?»; las listas priorizadas y los destinos explicados son el elemento propio de la aplicación. No hubo redibujos. Datos ficticios iniciales: Mercado Huerta Sur, Mercado La Cosecha, comedores Semilla, Buen Mañana y Raíces, y cuatro lotes definidos en `src/sample.js`. Reemplázalos si haces un piloto real.
