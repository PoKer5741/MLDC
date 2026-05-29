const { sql, poolPromise } = require('./db');
 
const PRODUCTOS = [
    { tipo: 1,  nombre: 'Cuenta a la vista',                   prefijo: 'CAV' },
    { tipo: 2,  nombre: 'Depósito a plazo',                    prefijo: 'DAP' },
    { tipo: 3,  nombre: 'Cuenta expediente simplificado',      prefijo: 'CES' },
    { tipo: 4,  nombre: 'Cuenta pago de planillas',            prefijo: 'CPP' },
    { tipo: 5,  nombre: 'Depósito judicial',                   prefijo: 'DJU' },
    { tipo: 6,  nombre: 'Crédito directo',                     prefijo: 'CDI' },
    { tipo: 7,  nombre: 'Crédito hipotecario',                 prefijo: 'CHI' },
    { tipo: 8,  nombre: 'Tarjeta de crédito',                  prefijo: 'TDC' },
    { tipo: 9,  nombre: 'Línea de crédito',                    prefijo: 'LDC' },
    { tipo: 10, nombre: 'Descuento de facturas',               prefijo: 'DFA' },
    { tipo: 11, nombre: 'Arrendamiento financiero',            prefijo: 'ARF' },
    { tipo: 12, nombre: 'Aval y garantía emitida',             prefijo: 'AVG' },
    { tipo: 13, nombre: 'Transferencia de fondos',             prefijo: 'TRF' },
    { tipo: 14, nombre: 'Remesa de dinero',                    prefijo: 'REM' },
    { tipo: 15, nombre: 'Compra y venta de divisas',           prefijo: 'CVD' },
    { tipo: 16, nombre: 'Fideicomiso',                         prefijo: 'FID' },
    { tipo: 17, nombre: 'Cajero automático',                   prefijo: 'CAJ' },
    { tipo: 18, nombre: 'Banca en línea / app móvil',          prefijo: 'BAN' },
    { tipo: 19, nombre: 'Caja de seguridad',                   prefijo: 'CAS' },
];
 
function getMesesActuales() {
    const ahora = new Date();
    const mesActual = ahora.getMonth() + 1; 
    const meses = [];
    for (let m = 1; m <= mesActual; m++) {
        meses.push({
            numero: m,
            nombre: ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m - 1]
        });
    }
    return meses;
}
 
function montoSegunProducto(tipoProducto) {
    const rangos = {
        1:  [50000,   500000],   
        2:  [100000, 2000000],   
        3:  [10000,  150000],    
        4:  [200000, 800000],    
        5:  [50000,  300000],    
        6:  [500000, 5000000],   
        7:  [1000000,15000000],  
        8:  [50000,  500000],    
        9:  [100000, 1000000],   
        10: [200000, 3000000],   
        11: [500000, 8000000],   
        12: [100000, 2000000],   
        13: [10000,  200000],    
        14: [50000,  500000],    
        15: [100,    10000],     
        16: [1000000,20000000],  
        17: [5000,   50000],     
        18: [1000,   100000],    
        19: [10000,  50000],     
    };
    const [min, max] = rangos[tipoProducto] || [5000, 100000];
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}
 
async function ejecutarEscenario1(req, res) {
    const pool = await poolPromise;
    const meses = getMesesActuales();
    const log = [];
    const resumen = {
        clientesInsertados: 0,
        productosInsertados: 0,
        transaccionesInsertadas: 0,
        mesesProcesados: meses.length,
        clientes: []
    };
 
    try {
        const padronResult = await pool.request().execute('dbo.sp_ObtenerPersonasRandomPadron');
 
        if (padronResult.recordset.length < 5) {
            return res.status(400).json({ error: 'T_Padron necesita al menos 5 registros.' });
        }
 
        for (const persona of padronResult.recordset) {
            const cedula = String(persona.D_Cedula).trim();
            const nombreCompleto = `${persona.D_PrimerNombre} ${persona.D_PrimerApellido} ${persona.D_SegundoApellido || ''}`.trim();
 
            const existePersona = await pool.request()
                .input('C_IdPersona', sql.VarChar(20), cedula)
                .execute('dbo.sp_VerificarPersonaExiste');
 
            if (existePersona.recordset[0].existe === 0) {
                await pool.request()
                    .input('C_IdPersona', sql.Int, parseInt(cedula))
                    .input('D_Nombre', sql.VarChar(200), persona.D_PrimerNombre)
                    .input('D_PrimerApellido', sql.VarChar(50), persona.D_PrimerApellido)
                    .input('C_IdTipoPersona', sql.Int, 1)
                    .execute('dbo.sp_CrearPersona');
                log.push(`[PERSONA] Creada: ${cedula} - ${nombreCompleto}`);
            } else {
                log.push(`[PERSONA] Ya existe: ${cedula} - ${nombreCompleto}`);
            }
 
            resumen.clientesInsertados++;
 
            const clienteLog = {
                cedula,
                nombre: nombreCompleto,
                meses: []
            };
 
            const productosBarajados = [...PRODUCTOS].sort(() => Math.random() - 0.5);
 
            for (let i = 0; i < meses.length; i++) {
                const mes = meses[i];
                const producto = productosBarajados[i % productosBarajados.length];
                const sufijo = Math.floor(Math.random() * 9000) + 1000;
                const numeroProducto = `${producto.prefijo}-${cedula}-M${String(mes.numero).padStart(2,'0')}-${sufijo}`;
                const saldoInicial = montoSegunProducto(producto.tipo);
 
                await pool.request()
                    .input('D_NumeroProducto', sql.VarChar(50), numeroProducto)
                    .input('Id_Cliente', sql.Int, parseInt(cedula))
                    .input('C_TipoProducto', sql.Int, producto.tipo)
                    .input('M_Saldo', sql.Decimal(18, 2), saldoInicial)
                    .execute('dbo.sp_InsertarProducto');
 
                resumen.productosInsertados++;
                log.push(`  [MES ${mes.nombre}] Producto: ${producto.nombre} (${numeroProducto}) | Saldo: ₡${saldoInicial.toLocaleString()}`);
 
                const transaccionesMes = [];
 
                for (let t = 1; t <= 5; t++) {
                    const tipoTx = t <= 3 ? 1 : 2;
                    const montoTx = parseFloat((Math.random() * (saldoInicial * 0.3) + saldoInicial * 0.05).toFixed(2));
 
                    await pool.request()
                        .input('Id_Producto_Ref', sql.VarChar(50), numeroProducto)
                        .input('M_Monto', sql.Decimal(18, 2), montoTx)
                        .input('C_IdTipoTransaccion', sql.Int, tipoTx)
                        .execute('dbo.sp_InsertarTransaccion');
 
                    resumen.transaccionesInsertadas++;
                    transaccionesMes.push({
                        tipo: tipoTx === 1 ? 'Ingreso' : 'Egreso',
                        monto: montoTx
                    });
                    log.push(`    [TX ${t}/5] ${tipoTx === 1 ? 'Ingreso' : 'Egreso'}: ₡${montoTx.toLocaleString()}`);
                }
 
                clienteLog.meses.push({
                    mes: mes.nombre,
                    producto: producto.nombre,
                    numeroProducto,
                    saldoInicial,
                    transacciones: transaccionesMes
                });
            }
 
            resumen.clientes.push(clienteLog);
        }
 
        res.json({
            estado: 'completado',
            mensaje: `Escenario 1 ejecutado. ${resumen.clientesInsertados} clientes procesados.`,
            resumen,
            log
        });
 
    } catch (error) {
        console.error('[ERROR ESCENARIO 1]', error.message);
        res.status(500).json({
            estado: 'error',
            error: error.message,
            log
        });
    }
}
 
const CATEGORIAS_TRANSACCION = [
    { descripcion: 'Gasolina',              tipo: 2 },
    { descripcion: 'Uber / taxi',           tipo: 2 },
    { descripcion: 'Bus / transporte',      tipo: 2 },
    { descripcion: 'Comida fuera',          tipo: 2 },
    { descripcion: 'Supermercado',          tipo: 2 },
    { descripcion: 'Gym',                   tipo: 2 },
    { descripcion: 'Entrenador personal',   tipo: 2 },
    { descripcion: 'Nutricionista',         tipo: 2 },
    { descripcion: 'Psicologo',             tipo: 2 },
    { descripcion: 'Agua',                  tipo: 2 },
    { descripcion: 'Luz electrica',         tipo: 2 },
    { descripcion: 'Internet',              tipo: 2 },
    { descripcion: 'Celular',               tipo: 2 },
    { descripcion: 'Netflix / streaming',   tipo: 2 },
    { descripcion: 'Ropa',                  tipo: 2 },
    { descripcion: 'Zapatos',               tipo: 2 },
    { descripcion: 'Hobby',                 tipo: 2 },
    { descripcion: 'Juego en linea',        tipo: 2 },
    { descripcion: 'SINPE Movil',           tipo: 2 },
    { descripcion: 'Deposito',              tipo: 1 },
    { descripcion: 'Deposito a plazo',      tipo: 1 },
    { descripcion: 'Pago de planilla',      tipo: 1 },
    { descripcion: 'Deposito de pension',   tipo: 1 },
    { descripcion: 'Comida de mascota',     tipo: 2 },
    { descripcion: 'Pago tarjeta credito',  tipo: 2 },
    { descripcion: 'Debito automatico',     tipo: 2 },
    { descripcion: 'Pago leasing',          tipo: 2 },
];
 
async function ejecutarEscenario2(req, res) {
    const pool = await poolPromise;
    const log = [];
    const resumen = {
        transaccionesInsertadas: 0,
        clientes: []
    };
 
    try {
        const clientesResult = await pool.request().execute('dbo.sp_ObtenerClientesRandomConProductos');
 
        if (clientesResult.recordset.length === 0) {
            return res.status(400).json({
                estado: 'error',
                error: 'Debe ejecutar el Escenario 1 para inicializar clientes con productos.'
            });
        }
 
        const clientes = clientesResult.recordset;
        const distribucion = [6, 6, 5, 5, 5];
 
        for (let ci = 0; ci < clientes.length; ci++) {
            const cliente = clientes[ci];
            const idCliente = String(cliente.Id_Cliente).trim();
            const nombreCliente = `${cliente.D_Nombre || ''} ${cliente.D_PrimerApellido || ''}`.trim() || idCliente;
            const cantidadTx = distribucion[ci];
 
            const productosResult = await pool.request()
                .input('Id_Cliente', sql.VarChar(20), idCliente)
                .execute('dbo.sp_ObtenerProductosPorCliente');
 
            const productos = productosResult.recordset;
            if (productos.length === 0) continue;
 
            const txCliente = [];
 
            for (let t = 0; t < cantidadTx; t++) {
                const producto = productos[Math.floor(Math.random() * productos.length)];
                const category = CATEGORIAS_TRANSACCION[Math.floor(Math.random() * CATEGORIAS_TRANSACCION.length)];
                const monto = parseFloat((Math.random() * 45000 + 1000).toFixed(2));
 
                await pool.request()
                    .input('Id_Producto_Ref', sql.VarChar(50), producto.D_NumeroProducto)
                    .input('M_Monto', sql.Decimal(18, 2), monto)
                    .input('C_IdTipoTransaccion', sql.Int, category.tipo)
                    .execute('dbo.sp_InsertarTransaccion');
 
                resumen.transaccionesInsertadas++;
                txCliente.push({
                    categoria: category.descripcion,
                    tipo: category.tipo === 1 ? 'Ingreso' : 'Egreso',
                    monto,
                    producto: producto.D_NumeroProducto
                });
 
                log.push(`  [${nombreCliente}] ${category.descripcion}: ₡${monto.toLocaleString()} (${category.tipo === 1 ? 'Ingreso' : 'Egreso'})`);
            }
 
            resumen.clientes.push({
                cedula: idCliente,
                nombre: nombreCliente,
                transacciones: txCliente
            });
        }
 
        res.json({
            estado: 'completado',
            mensaje: `Escenario 2 ejecutado. ${resumen.transaccionesInsertadas} transacciones procesadas.`,
            resumen,
            log
        });
 
    } catch (error) {
        console.error('[ERROR ESCENARIO 2]', error.message);
        res.status(500).json({
            estado: 'error',
            error: error.message,
            log
        });
    }
}
 
module.exports = { ejecutarEscenario1, ejecutarEscenario2 };