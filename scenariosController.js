const { sql, poolPromise } = require('./db');
const crud = require('./crudController');

async function invocarCrud(metodoCrud, bodyData, paramsData = {}) {
    return new Promise((resolve, reject) => {
        const req = { body: bodyData, params: paramsData };
        const res = {
            json: (data) => resolve(data),
            status: (code) => ({
                json: (errData) => reject(new Error(errData.error || `Error HTTP ${code}`))
            })
        };
        metodoCrud(req, res).catch(reject);
    });
}

function getMesesActuales() {
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1; 
    const meses = [];
    const nombresMeses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    for (let m = 1; m <= mesActual; m++) {
        meses.push({ numero: m, nombre: nombresMeses[m - 1] });
    }
    return meses;
}

async function ejecutarEscenario1(req, res) {
    const pool = await poolPromise;
    const meses = getMesesActuales();
    const cantidadClientes = 25;
    const log = [];
    const resumen = { clientesInsertados: 0, productosInsertados: 0, transaccionesInsertadas: 0, clientes: [] };

    try {
        const padronResult = await pool.request().execute('dbo.sp_ObtenerPersonasRandomPadron');
        
        if (padronResult.recordset.length < cantidadClientes) {
            return res.status(400).json({ error: `T_Padron requiere al menos ${cantidadClientes} registros para ejecutar el escenario base.` });
        }

        const catProductosResult = await pool.request().execute('dbo.sp_ObtenerTiposProductos');
        const productosDB = catProductosResult.recordset;

        if (productosDB.length === 0) {
            throw new Error('El catalogo de productos en la base de datos esta vacio.');
        }

        const personasSeleccionadas = padronResult.recordset.slice(0, cantidadClientes);

        for (const persona of personasSeleccionadas) {
            const cedula = String(persona.D_Cedula).trim();
            const nombreCompleto = `${persona.D_PrimerNombre} ${persona.D_PrimerApellido}`;

            const existePersona = await pool.request()
                .input('C_IdPersona', sql.VarChar(20), cedula)
                .execute('dbo.sp_VerificarPersonaExiste');

            if (existePersona.recordset[0].existe === 0) {
                try {
                    await invocarCrud(crud.crearPersona, {
                        cedula: cedula,
                        nombre: persona.D_PrimerNombre,
                        apellido: persona.D_PrimerApellido,
                        tipoPersona: 1
                    });
                    log.push(`[PERSONA] Creada via CRUD: ${cedula}`);
                } catch (errorPersona) {
                    if (errorPersona.message.includes('UQ_Cliente_Persona') || errorPersona.message.includes('duplicate key') || errorPersona.message.includes('Violation of UNIQUE KEY constraint')) {
                        log.push(`[PERSONA] Registro existente omitido de forma segura: ${cedula}`);
                    } else {
                        throw errorPersona;
                    }
                }
            }

            resumen.clientesInsertados++;
            
            const clienteLog = { cedula, nombre: nombreCompleto, meses: [] };
            const productosBarajados = [...productosDB].sort(() => Math.random() - 0.5);

            for (let i = 0; i < meses.length; i++) {
                const mes = meses[i];
                const producto = productosBarajados[i % productosBarajados.length];
                const sufijo = Math.floor(Math.random() * 9000) + 1000;
                const numeroProducto = `PRD-${producto.IdProducto}-${cedula}-M${mes.numero}-${sufijo}`;
                const saldoInicial = parseFloat((Math.random() * 900000 + 100000).toFixed(2));

                try {
                    await invocarCrud(crud.crearProducto, {
                        numeroProducto: numeroProducto,
                        idCliente: cedula,
                        tipoProducto: producto.IdProducto,
                        saldoInicial: saldoInicial
                    });
                    resumen.productosInsertados++;
                    log.push(`  [MES ${mes.nombre}] Producto via CRUD: ${producto.Nombre} (${numeroProducto})`);
                } catch (errorProducto) {
                    log.push(`  [MES ${mes.nombre}] Registro de producto duplicado omitido: (${numeroProducto})`);
                    continue;
                }

                const transaccionesMes = [];
                for (let t = 1; t <= 5; t++) {
                    const tipoTx = t <= 3 ? 1 : 2; 
                    const montoTx = parseFloat((Math.random() * (saldoInicial * 0.2) + 1000).toFixed(2));

                    try {
                        await invocarCrud(crud.crearTransaccion, {
                            idProductoRef: numeroProducto,
                            monto: montoTx,
                            tipoTransaccion: tipoTx
                        });

                        resumen.transaccionesInsertadas++;
                        transaccionesMes.push({ tipo: tipoTx === 1 ? 'Ingreso' : 'Egreso', monto: montoTx, estado: 'Aprobada' });
                    } catch (txError) {
                        transaccionesMes.push({ tipo: tipoTx === 1 ? 'Ingreso' : 'Egreso', monto: montoTx, estado: 'Rechazada' });
                    }
                }
                
                clienteLog.meses.push({ mes: mes.nombre, producto: producto.Nombre, numeroProducto, saldoInicial, transacciones: transaccionesMes });
            }
            
            resumen.clientes.push(clienteLog);
        }

        res.json({ estado: 'completado', mensaje: `Escenario 1 procesado exitosamente.`, resumen, log });
    } catch (error) {
        res.status(500).json({ estado: 'error', error: error.message, log });
    }
}

async function ejecutarEscenario2(req, res) {
    const pool = await poolPromise;
    const log = [];
    const resumen = { transaccionesInsertadas: 0, clientes: [] };

    try {
        const clientesResult = await pool.request().execute('dbo.sp_ObtenerClientesRandomConProductos');
        if (clientesResult.recordset.length === 0) {
            return res.status(400).json({ estado: 'error', error: 'Requiere Escenario 1 previo.' });
        }

        const catCategoriasResult = await pool.request().execute('dbo.sp_ObtenerCategoriasTransaccion');
        const categoriasDB = catCategoriasResult.recordset;

        if (categoriasDB.length === 0) {
            throw new Error('El catalogo de categorias de transaccion en la base de datos esta vacio.');
        }

        const clientes = clientesResult.recordset;
        const distribucion = [6, 6, 5, 5, 5];

        for (let ci = 0; ci < clientes.length; ci++) {
            const cliente = clientes[ci];
            const idCliente = String(cliente.Id_Cliente).trim();
            const nombreCliente = `${cliente.D_Nombre || ''} ${cliente.D_PrimerApellido || ''}`.trim();
            const cantidadTx = distribucion[ci] || 5;

            const productosResult = await pool.request()
                .input('Id_Cliente', sql.VarChar(20), idCliente)
                .execute('dbo.sp_ObtenerProductosPorCliente');

            const productos = productosResult.recordset;
            if (productos.length === 0) continue;

            const txCliente = [];
            for (let t = 0; t < cantidadTx; t++) {
                const producto = productos[Math.floor(Math.random() * productos.length)];
                const categoria = categoriasDB[Math.floor(Math.random() * categoriasDB.length)];
                const monto = parseFloat((Math.random() * 45000 + 1000).toFixed(2));
                
                const tipoTx = categoria.IdCategoria <= 10 ? 2 : 1; 

                try {
                    await invocarCrud(crud.crearTransaccion, {
                        idProductoRef: producto.D_NumeroProducto,
                        monto: monto,
                        tipoTransaccion: tipoTx
                    });

                    resumen.transaccionesInsertadas++;
                    txCliente.push({ 
                        categoria: categoria.Nombre, 
                        tipo: tipoTx === 1 ? 'Ingreso' : 'Egreso', 
                        monto, 
                        producto: producto.D_NumeroProducto,
                        estado: 'Aprobada'
                    });
                    log.push(`  [${nombreCliente}] ${categoria.Nombre} (Monto: ${monto}) -> APROBADA.`);
                    
                } catch (txError) {
                    txCliente.push({ 
                        categoria: categoria.Nombre, 
                        tipo: tipoTx === 1 ? 'Ingreso' : 'Egreso', 
                        monto, 
                        producto: producto.D_NumeroProducto,
                        estado: 'Rechazada'
                    });
                    log.push(`  [${nombreCliente}] ${categoria.Nombre} (Monto: ${monto}) -> DENEGADA: ${txError.message}`);
                }
            }
            resumen.clientes.push({ cedula: idCliente, nombre: nombreCliente, transacciones: txCliente });
        }

        res.json({ estado: 'completado', mensaje: `Escenario 2 procesado con manejo de validaciones.`, resumen, log });
    } catch (error) {
        res.status(500).json({ estado: 'error', error: error.message, log });
    }
}

async function ejecutarEscenario4(req, res) {
    const pool = await poolPromise;
    const log = [];
    const resumen = {
        remesasInsertadas: 0,
        divisasInsertadas: 0,
        comisionesInsertadas: 0,
        clientes: []
    };

    try {
        // 1. Obtener clientes random con productos (mismos que escenario 2)
        const clientesResult = await pool.request().execute('dbo.sp_ObtenerClientesRandomConProductos');
        if (clientesResult.recordset.length === 0) {
            return res.status(400).json({ estado: 'error', error: 'Requiere Escenario 1 previo para tener clientes con productos.' });
        }

        // 2. Obtener tipos de producto para identificar remesas (14) y divisas (15)
        const tiposResult = await pool.request().execute('dbo.sp_ObtenerTiposProductos');
        const tiposProducto = tiposResult.recordset;

        const tipoRemesas  = tiposProducto.find(t => t.IdProducto === 14);
        const tipoDivisas  = tiposProducto.find(t => t.IdProducto === 15);

        if (!tipoRemesas || !tipoDivisas) {
            return res.status(400).json({ estado: 'error', error: 'El catálogo de productos no contiene Remesas (14) o Divisas (15). Verifique T_Cat_TipoProducto.' });
        }

        const clientes = clientesResult.recordset;

        for (const cliente of clientes) {
            const idCliente = String(cliente.Id_Cliente).trim();
            const nombreCliente = `${cliente.D_Nombre || ''} ${cliente.D_PrimerApellido || ''}`.trim();
            const txCliente = [];

            // Obtener productos del cliente
            const productosResult = await pool.request()
                .input('Id_Cliente', sql.VarChar(20), idCliente)
                .execute('dbo.sp_ObtenerProductosPorCliente');
            const productos = productosResult.recordset;
            if (productos.length === 0) {
                log.push(`[${nombreCliente}] Sin productos — omitido.`);
                continue;
            }

            const productoBase = productos[Math.floor(Math.random() * productos.length)];

            // ── A) REMESA DE DINERO ──────────────────────────────────────
            const sufRemesa = Math.floor(Math.random() * 9000) + 1000;
            const numRemesa = `REM-${idCliente}-${sufRemesa}`;
            const montoRemesa = parseFloat((Math.random() * 450000 + 50000).toFixed(2));

            try {
                await invocarCrud(crud.crearProducto, {
                    numeroProducto: numRemesa,
                    idCliente: idCliente,
                    tipoProducto: tipoRemesas.IdProducto,
                    saldoInicial: montoRemesa
                });

                await invocarCrud(crud.crearTransaccion, {
                    idProductoRef: numRemesa,
                    monto: montoRemesa,
                    tipoTransaccion: 1  // Ingreso a la entidad
                });

                resumen.remesasInsertadas++;
                txCliente.push({ tipo: 'Remesa de dinero', producto: numRemesa, monto: montoRemesa, estado: 'Aprobada' });
                log.push(`  [${nombreCliente}] Remesa registrada: ${numRemesa} — ₡${montoRemesa.toLocaleString()}`);
            } catch (e) {
                txCliente.push({ tipo: 'Remesa de dinero', producto: numRemesa, monto: montoRemesa, estado: 'Rechazada' });
                log.push(`  [${nombreCliente}] Remesa fallida: ${e.message}`);
            }

            // ── B) COMPRA Y VENTA DE DIVISAS ─────────────────────────────
            const tasaCambio = parseFloat((600 + Math.random() * 20).toFixed(2)); // tipo de cambio CRC/USD
            const montoDolares = parseFloat((Math.random() * 5000 + 500).toFixed(2));
            const montoColones = parseFloat((montoDolares * tasaCambio).toFixed(2));
            const sufDivisa = Math.floor(Math.random() * 9000) + 1000;
            const numDivisa = `DIV-${idCliente}-${sufDivisa}`;
            const esCompra = Math.random() > 0.5;

            try {
                await invocarCrud(crud.crearProducto, {
                    numeroProducto: numDivisa,
                    idCliente: idCliente,
                    tipoProducto: tipoDivisas.IdProducto,
                    saldoInicial: montoColones
                });

                // La entidad gana en el spread; se registra como ingreso
                await invocarCrud(crud.crearTransaccion, {
                    idProductoRef: numDivisa,
                    monto: montoColones,
                    tipoTransaccion: 1
                });

                resumen.divisasInsertadas++;
                const desc = `${esCompra ? 'Compra' : 'Venta'} divisas USD ${montoDolares} @ ₡${tasaCambio}`;
                txCliente.push({ tipo: desc, producto: numDivisa, monto: montoColones, estado: 'Aprobada' });
                log.push(`  [${nombreCliente}] ${desc} → ${numDivisa} — ₡${montoColones.toLocaleString()}`);
            } catch (e) {
                txCliente.push({ tipo: 'Compra/Venta divisas', producto: numDivisa, monto: montoColones, estado: 'Rechazada' });
                log.push(`  [${nombreCliente}] Divisa fallida: ${e.message}`);
            }

            // ── C) COMISIONES (cajero, SINPE, SWIFT) ─────────────────────
            const comisiones = [
                { nombre: 'Comisión cajero automático', monto: parseFloat((Math.random() * 800 + 200).toFixed(2)) },
                { nombre: 'Comisión SINPE Móvil',       monto: parseFloat((Math.random() * 500 + 100).toFixed(2)) },
                { nombre: 'Comisión SWIFT internacional', monto: parseFloat((Math.random() * 8000 + 2000).toFixed(2)) }
            ];

            for (const comision of comisiones) {
                try {
                    // Las comisiones se registran como transacción de ingreso
                    // sobre el producto base del cliente (la entidad cobra)
                    await invocarCrud(crud.crearTransaccion, {
                        idProductoRef: productoBase.D_NumeroProducto,
                        monto: comision.monto,
                        tipoTransaccion: 1
                    });

                    resumen.comisionesInsertadas++;
                    txCliente.push({ tipo: comision.nombre, producto: productoBase.D_NumeroProducto, monto: comision.monto, estado: 'Aprobada' });
                    log.push(`  [${nombreCliente}] ${comision.nombre}: ₡${comision.monto.toLocaleString()} → ASENTADA`);
                } catch (e) {
                    txCliente.push({ tipo: comision.nombre, producto: productoBase.D_NumeroProducto, monto: comision.monto, estado: 'Rechazada' });
                    log.push(`  [${nombreCliente}] ${comision.nombre} fallida: ${e.message}`);
                }
            }

            resumen.clientes.push({ cedula: idCliente, nombre: nombreCliente, transacciones: txCliente });
        }

        res.json({
            estado: 'completado',
            mensaje: `Escenario 4 procesado: ${resumen.remesasInsertadas} remesas, ${resumen.divisasInsertadas} operaciones de divisas, ${resumen.comisionesInsertadas} comisiones registradas.`,
            resumen,
            log
        });

    } catch (error) {
        res.status(500).json({ estado: 'error', error: error.message, log });
    }
}

module.exports = { ejecutarEscenario1, ejecutarEscenario2, ejecutarEscenario4 };