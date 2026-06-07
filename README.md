# MLDC Core Bancario — Grupo 3

Sistema bancario universitario desarrollado para el curso IF5100. Simula un core bancario con gestión de clientes, productos, transacciones, cálculo de riesgo de legitimación de capitales y generación de reportes regulatorios para la SUGEF de Costa Rica.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| Servidor | Node.js + Express 5 |
| Base de datos | SQL Server (ODBC Driver 17) |
| Driver BD | `mssql` con `msnodesqlv8` |
| Generación XML | `xmlbuilder2` |
| Frontend | HTML + CSS + JS vanilla (Single Page App) |

---

## Requisitos previos

1. **SQL Server** corriendo localmente con autenticación de Windows
2. **ODBC Driver 17 for SQL Server** instalado
3. **Node.js** v18 o superior
4. La base de datos `Grupo3_IF51002026_MiRespaldo` creada y poblada con el schema del proyecto
5. Los scripts SQL ejecutados en SSMS (ver sección Scripts SQL)

---

## Instalación y arranque

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor
node index.js
```

El servidor queda disponible en `http://localhost:3000`.

Si hay problemas de conexión, ejecutar el diagnóstico:
```bash
node diagnostico.js
```

---

## Configuración de la base de datos

El archivo **`db.js`** centraliza la conexión. Si necesitas cambiar el servidor o la base de datos, edita la `connectionString`:

```js
// db.js
connectionString: 'Driver={ODBC Driver 17 for SQL Server};Server=TU_SERVIDOR;Database=TU_BASE_DE_DATOS;Trusted_Connection=yes;'
```

Usa autenticación de Windows (`Trusted_Connection=yes`), por lo que no requiere usuario ni contraseña.

---

## Scripts SQL que debes ejecutar en SSMS

Antes de usar la aplicación, ejecuta estos scripts en el orden indicado:

| Archivo | Qué hace | Cuándo ejecutar |
|---|---|---|
| Schema del proyecto | Crea todas las tablas y SPs base | Una sola vez al inicio |
| `historial_comisiones.sql` | Crea `T_Historial_Comisiones` y los SPs de historial | Una sola vez |
| `sp_generarxml.sql` | Crea `sp_GenerarDatosXML_Sicveca` para el Escenario 3 | Una sola vez |

Para ejecutar: abre el archivo en SSMS → selecciona todo → F5.

---

## Estructura de archivos

```
Proyect/
├── index.js                  ← Servidor Express, define todas las rutas API
├── db.js                     ← Conexión al pool de SQL Server
├── crudController.js         ← Operaciones CRUD (personas, productos, transacciones)
├── scenariosController.js    ← Lógica de los Escenarios 1, 2 y 4
├── riesgo.js                 ← Cálculo de riesgo masivo e individual
├── buscador.js               ← Búsqueda inteligente en padrón y clientes activos
├── xmlGenerator.js           ← Generación del XML SICVECA (Escenario 3)
├── diagnostico.js            ← Herramienta de diagnóstico de conexión BD
├── historial_comisiones.sql  ← Script SQL: tabla + SPs de historial de comisiones
├── sp_generarxml.sql         ← Script SQL: SP de generación del XML SICVECA
└── public/
    └── index.html            ← Frontend SPA (toda la UI en un solo archivo)
```

---

## Descripción de cada archivo

### `index.js` — Servidor principal

Punto de entrada de la aplicación. Levanta Express en el puerto 3000 y define todas las rutas de la API REST. También sirve el frontend estático desde la carpeta `public/`.

Importa y conecta todos los módulos: `crudController`, `scenariosController`, `riesgo`, `buscador` y `xmlGenerator`.

Rutas que define directamente (sin delegar a otro módulo):
- Historial y resumen de comisiones (`/api/comisiones/*`)
- Tipos de productos (`/api/tipos-productos`)
- Perfil simulado de cliente (`/api/perfil-simulado/:id`)

---

### `db.js` — Conexión a la base de datos

Crea un pool de conexiones a SQL Server usando `mssql/msnodesqlv8` (variante con ODBC nativo de Windows, no TCP). El pool se conecta una sola vez al arrancar el servidor y se reutiliza en todas las peticiones. Exporta `{ sql, poolPromise }` para que los demás módulos lo importen.

---

### `crudController.js` — Operaciones de datos

Contiene las funciones que ejecutan los stored procedures de CRUD:

| Función | SP que llama | Descripción |
|---|---|---|
| `crearPersona` | `sp_RegistrarClienteCompleto` | Registra persona + cliente en una sola operación |
| `actualizarPersona` | `sp_ActualizarPersona` | Modifica nombre, apellido y tipo |
| `eliminarPersona` | `sp_EliminarPersona` | Baja lógica de persona |
| `eliminarClienteSeguro` | `sp_EliminarClienteSeguro` | Baja con motivo registrado |
| `leerPersona` | `sp_LeerPersona` | Lee datos de una persona por ID |
| `crearProducto` | `sp_InsertarProducto` | Crea producto financiero para un cliente |
| `actualizarProducto` | `sp_ActualizarProducto` | Modifica saldo y tipo de producto |
| `eliminarProducto` | `sp_EliminarProducto` | Elimina un producto |
| `leerProducto` | `sp_LeerProducto` | Lee un producto por número |
| `leerProductosCliente` | `sp_LeerProductosCliente` | Lista todos los productos de un cliente |
| `leerTodosProductos` | `sp_ObtenerTodosProductos` | Lista todos los productos (con filtro opcional) |
| `crearTransaccion` | `sp_InsertarTransaccion` | Registra transacción y actualiza saldo del producto |
| `actualizarTransaccion` | `sp_ActualizarTransaccion` | Modifica una transacción existente |
| `eliminarTransaccion` | `sp_EliminarTransaccion` | Elimina una transacción |
| `leerTransaccion` | `sp_LeerTransaccion` | Lee una transacción por ID |
| `leerTodasTransacciones` | `sp_ObtenerTodasTransacciones` | Lista todas las transacciones |
| `registrarVisita` | `sp_RegistrarVisitaCliente` | Incrementa contador de visitas del cliente |

---

### `scenariosController.js` — Escenarios de negocio

Contiene la lógica de los escenarios de simulación bancaria. Usa un helper interno `invocarCrud()` que adapta las funciones del `crudController` para que puedan ser llamadas programáticamente (sin req/res de Express).

#### Escenario 1 — Carga anual de padrón y productos
- Toma 25 personas aleatorias del padrón electoral (`T_Padron`)
- Para cada persona, crea un cliente en el sistema
- Para cada mes transcurrido del año actual, asigna un producto diferente al cliente
- Por cada producto, genera 5 transacciones (3 ingresos + 2 egresos)
- Los saldos y montos son aleatorios dentro de rangos realistas

#### Escenario 2 — Procesamiento masivo de consumos
- Requiere que el Escenario 1 haya corrido primero
- Toma 5 clientes que ya tienen productos
- Para cada cliente, genera entre 5 y 6 transacciones adicionales usando categorías reales de la BD
- Las categorías con `IdCategoria <= 10` se tratan como egresos; el resto como ingresos

#### Escenario 4 — Comisiones y divisas
- Ejecuta el stored procedure `sp_EjecutarEscenario4_Completo` directamente en SQL Server
- El SP procesa operaciones SINPE, retiros ATM y transferencias internacionales SWIFT
- Calcula y registra comisiones por cada tipo de operación
- Devuelve dos result sets: log por cliente y resumen de comisiones (SINPE/ATM/SWIFT + total)

---

### `riesgo.js` — Cálculo de riesgo de legitimación

Tres funciones para calcular el riesgo de legitimación de capitales (LA/FT) de los clientes:

| Función | Descripción |
|---|---|
| `procesarRiesgo()` | Llama `sp_ProcesarRiesgoMasivo` — calcula riesgo para todos los clientes a la vez |
| `calcularRiesgoClienteIndividual()` | Llama `sp_CalcularRiesgoIndividualParametrico` con datos como provincia, profesión, ingresos, edad. Usa transacción SQL para garantizar consistencia |
| `guardarRiesgoManualCliente()` | Llama `sp_GuardarRiesgoManual` con 8 parámetros de ponderación (P1-P8) ingresados manualmente |

El resultado se almacena en `T_Calculo_Riesgo` y asigna el cliente a una categoría de `T_Tipo_Riesgo_Legitimacion` (Alto / Moderado / Bajo).

---

### `buscador.js` — Búsqueda inteligente

Permite buscar personas ya sea en el **padrón electoral** o entre los **clientes activos** del sistema.

| Función | SP | Descripción |
|---|---|---|
| `buscarClienteInteligente()` | `sp_BuscarPadronInteligente` | Busca por nombre/apellido con filtros opcionales de provincia, cantón y distrito |
| `obtenerProvincias()` | `sp_ObtenerProvincias` | Lista todas las provincias de CR |
| `obtenerCantones(id)` | `sp_ObtenerCantones` | Lista los cantones de una provincia |
| `obtenerDistritos(id)` | `sp_ObtenerDistritos` | Lista los distritos de un cantón |

---

### `xmlGenerator.js` — Generación del XML SICVECA (Escenario 3)

Genera el archivo regulatorio `Sicveca_Reporte.xml` requerido por la SUGEF de Costa Rica para el reporte trimestral de clientes por categoría de riesgo de legitimación de capitales.

Llama al stored procedure `sp_GenerarDatosXML_Sicveca` que devuelve 14 result sets. Luego construye el XML usando `xmlbuilder2` con los 12 cuadros requeridos:

| Cuadro | Lista XML | Contenido |
|---|---|---|
| A | `ListaTotalClientesPorRiesgo` | Total de clientes por nivel de riesgo por mes |
| B | `ListaClientesNuevosCerradosEInactivos` | Clientes nuevos, cerrados e inactivos por mes |
| C1 | `ListaClientesPorTipoPersona` | Clientes por tipo (Física / Jurídica) con saldos |
| C2 | `ListaClientesPorNaturaleza` | Clientes por naturaleza de actividad económica |
| D | `ListaClientesConOperacionesActivas` | Clientes con productos activos (créditos) por riesgo |
| E | `ListaClientesConOperacionesPasivas` | Clientes con productos pasivos (depósitos) por riesgo |
| F | `ListaClientesConOperacionesFueraBalance` | Clientes con operaciones fuera de balance (remesas) |
| G | `ListaClientesConOperacionesActivasPasivas` | Clientes con ambos tipos de operaciones |
| H | `ListaClientesReclasificadosMes` | Clientes que cambiaron de categoría de riesgo |
| I | `ListaClientesJurisdiccionResidencia` | Clientes por residencia (Residente / No Residente) |
| J | `ListaSujetosObligadosArticulo15Ley8204` | Entidades sujetas al Art. 15 de la Ley 8204 |
| K | `ListaPersonasExpuestasPoliticamente` | PEPs — personas con exposición política |
| L | `ListaClientesOperacionesMayores100` | Operaciones que superan 100 salarios mínimos |

El XML generado se guarda como `Sicveca_Reporte.xml` en la raíz del proyecto y también se retorna al frontend para mostrarlo en pantalla.

---

### `diagnostico.js` — Herramienta de diagnóstico

Script independiente (no forma parte del servidor) que verifica paso a paso:
1. Que la conexión a SQL Server funciona
2. Que la base de datos existe y el usuario tiene acceso
3. Que la tabla `T_Persona` existe y tiene datos
4. Que las búsquedas con `LIKE` funcionan correctamente

Se ejecuta con `node diagnostico.js` cuando hay problemas de conexión.

---

## API REST — Referencia de endpoints

### Búsqueda y geografía
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/buscar?termino=&origen=padron` | Busca en padrón o clientes activos |
| GET | `/api/geo/provincias` | Lista provincias |
| GET | `/api/geo/cantones/:idProvincia` | Lista cantones de una provincia |
| GET | `/api/geo/distritos/:idCanton` | Lista distritos de un cantón |

### Personas y clientes
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/personas/:id` | Lee datos de una persona |
| POST | `/api/personas` | Registra persona + cliente |
| PUT | `/api/personas/:id` | Actualiza datos de persona |
| DELETE | `/api/personas/:id` | Elimina persona |
| POST | `/api/clientes/baja` | Da de baja un cliente con motivo |
| POST | `/api/clientes/:id/visita` | Registra visita del cliente |
| GET | `/api/perfil-simulado/:id` | Perfil completo del cliente |

### Productos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/productos` | Lista todos los productos |
| GET | `/api/clientes/:idCliente/productos` | Productos de un cliente |
| GET | `/api/productos/:numeroProducto` | Lee un producto específico |
| POST | `/api/productos` | Crea un producto |
| PUT | `/api/productos/:numeroProducto` | Actualiza un producto |
| DELETE | `/api/productos/:numeroProducto` | Elimina un producto |
| GET | `/api/tipos-productos` | Lista el catálogo de tipos de producto |
| POST | `/api/tipos-productos` | Agrega un tipo de producto |
| PUT | `/api/tipos-productos/:id` | Actualiza un tipo de producto |
| DELETE | `/api/tipos-productos/:id` | Elimina un tipo de producto |

### Transacciones
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/transacciones` | Lista todas las transacciones |
| GET | `/api/transacciones/:id` | Lee una transacción |
| POST | `/api/transacciones` | Crea una transacción |
| PUT | `/api/transacciones/:id` | Actualiza una transacción |
| DELETE | `/api/transacciones/:id` | Elimina una transacción |

### Riesgo
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/procesar-riesgo` | Calcula riesgo masivo para todos los clientes |
| POST | `/api/clientes/:id/calcular-riesgo` | Calcula riesgo individual con parámetros |
| POST | `/api/clientes/:id/riesgo-manual` | Guarda puntaje manual (8 parámetros P1-P8) |

### Comisiones
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/comisiones/resumen` | Totales históricos por tipo de comisión |
| GET | `/api/comisiones/historial` | Detalle y resumen diario del historial |
| POST | `/api/comisiones/historial` | Registra una entrada en el historial |

### Escenarios
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/escenarios/1` | Ejecuta Escenario 1 (carga anual) |
| POST | `/api/escenarios/2` | Ejecuta Escenario 2 (consumos masivos) |
| POST | `/api/escenarios/4` | Ejecuta Escenario 4 (comisiones y divisas) |
| POST | `/api/generar-xml` | Ejecuta Escenario 3 (genera XML SICVECA) |

---

## Stored Procedures principales en la BD

| SP | Lo usa | Descripción |
|---|---|---|
| `sp_RegistrarClienteCompleto` | crudController | Inserta persona + cliente en una sola transacción |
| `sp_ObtenerPersonasRandomPadron` | Escenario 1 | Selecciona personas aleatorias del padrón |
| `sp_ObtenerTiposProductos` | Escenario 1 | Lista el catálogo de productos disponibles |
| `sp_ObtenerClientesRandomConProductos` | Escenario 2 | Selecciona clientes que ya tienen productos |
| `sp_ObtenerCategoriasTransaccion` | Escenario 2 | Lista categorías de transacciones |
| `sp_ProcesarRiesgoMasivo` | riesgo.js | Calcula riesgo para todos los clientes |
| `sp_CalcularRiesgoIndividualParametrico` | riesgo.js | Calcula riesgo de un cliente con parámetros |
| `sp_EjecutarEscenario4_Completo` | Escenario 4 | Procesa todas las comisiones y divisas |
| `sp_RegistrarHistorialComision` | index.js | Guarda una entrada en el historial de comisiones |
| `sp_ObtenerHistorialComisiones` | index.js | Devuelve detalle y resumen diario del historial |
| `sp_GenerarDatosXML_Sicveca` | xmlGenerator.js | Genera los 14 result sets para el XML regulatorio |
| `sp_BuscarPadronInteligente` | buscador.js | Búsqueda con filtros en el padrón electoral |
| `sp_BuscarClientesActivos` | index.js | Búsqueda entre clientes activos del sistema |

---

## Tablas principales de la base de datos

| Tabla | Descripción |
|---|---|
| `T_Padron` | Padrón electoral costarricense (fuente de datos para nuevos clientes) |
| `T_Persona` | Personas registradas en el sistema |
| `T_Cliente` | Clientes del banco (vinculados a T_Persona) |
| `T_Producto` | Productos financieros por cliente |
| `T_Cat_TipoProducto` | Catálogo de tipos de producto (cuentas, créditos, etc.) |
| `T_Transaccion` | Transacciones sobre productos |
| `T_Calculo_Riesgo` | Resultados del cálculo de riesgo por cliente |
| `T_Tipo_Riesgo_Legitimacion` | Catálogo de niveles de riesgo (Alto/Moderado/Bajo) |
| `T_Comision` | Comisiones generadas por el banco |
| `T_Historial_Comisiones` | Historial persistente de comisiones por fecha |
| `T_Registro` | Registro de generaciones de reportes XML |

---

## Flujo recomendado para una demostración

```
1. Ejecutar scripts SQL en SSMS (sp_generarxml.sql, historial_comisiones.sql)
2. node index.js
3. Abrir http://localhost:3000
4. Escenario 1 → carga clientes y productos del padrón
5. Escenario 2 → genera transacciones de consumo
6. Análisis → calcula riesgo de legitimación (botón "Procesar Riesgo")
7. Escenario 4 → procesa comisiones y divisas
8. Historial Comisiones → ver lo acumulado por tipo y fecha
9. Escenario 3 → genera el XML SICVECA y lo muestra en pantalla
```
