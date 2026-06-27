const express = require('express');
const path = require('path');
const { sql, poolPromise } = require('./db');
 
const { procesarRiesgo, calcularRiesgoClienteIndividual, guardarRiesgoManualCliente } = require('./riesgo');
const XMLModulo = require('./xmlGenerator');
const {
    buscarClienteInteligente,
    obtenerProvincias,
    obtenerCantones,
    obtenerDistritos
} = require('./buscador');
 
const {
    leerProductosCliente, leerProducto, crearProducto, actualizarProducto, eliminarProducto,
    leerTransaccion, crearTransaccion, actualizarTransaccion, eliminarTransaccion,
    leerPersona, crearPersona, actualizarPersona, eliminarPersona, registrarVisita,
    leerTodosProductos, leerTodasTransacciones,
    eliminarClienteSeguro 
} = require('./crudController');
const { ejecutarEscenario1, ejecutarEscenario2, ejecutarEscenario4 } = require('./scenariosController');
 
const app = express();
const PORT = 3000;
 
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
 
// BÚSQUEDA INTELIGENTE DE CLIENTES / PADRÓN
app.get('/api/buscar', async (req, res) => {
    const termino   = String(req.query.termino  || '').trim();
    const origen    = String(req.query.origen   || 'padron').trim();
    const provincia = req.query.provincia || null;
    const canton    = req.query.canton    || null;
    const distrito  = req.query.distrito  || null;
 
    try {
        if (origen === 'clientes') {
            const pool = await poolPromise;
            const request = pool.request();
            
            if (termino.length > 0) {
                request.input('Termino', sql.VarChar(100), termino);
            }
            
            const result = await request.execute('dbo.sp_BuscarClientesActivos');
            return res.json(result.recordset);
        }
 
        if (termino.length < 1 && !provincia && !canton && !distrito) {
            return res.json([]);
        }
 
        const resultados = await buscarClienteInteligente(termino, { provincia, canton, distrito });
        return res.json(resultados);
 
    } catch (err) {
        console.error('[BUSCAR ERROR]', err.message);
        res.status(500).json({ error: `Fallo en búsqueda: ${err.message}` });
    }
});
 
// RUTAS GEOGRÁFICAS  
app.get('/api/geo/provincias', async (req, res) => {
    try {
        const provinces = await obtenerProvincias();
        res.json(provinces);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
app.get('/api/geo/cantones/:idProvincia', async (req, res) => {
    try {
        if (!req.params.idProvincia) return res.status(400).json({ error: "Falta ID de Provincia" });
        const cantons = await obtenerCantones(req.params.idProvincia);
        res.json(cantons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
app.get('/api/geo/distritos/:idCanton', async (req, res) => {
    try {
        if (!req.params.idCanton) return res.status(400).json({ error: "Falta ID de Cantón" });
        const districts = await obtenerDistritos(req.params.idCanton);
        res.json(districts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
// MOTOR DE EVALUACIÓN DE RIESGOS NORMADOS
app.post('/api/procesar-riesgo', async (req, res) => {
    try {
        await procesarRiesgo();
        res.json({ mensaje: 'Calificación masiva paramétrica asentada en T_Calculo_Riesgo.' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

app.post('/api/clientes/:idCliente/calcular-riesgo', calcularRiesgoClienteIndividual);
app.post('/api/clientes/:idCliente/riesgo-manual', guardarRiesgoManualCliente);
 
// COMPILADOR COMPLIANCE XML - SUGEF / SICVECA
app.post('/api/generar-xml', async (req, res) => {
    try {
        const xmlData = await XMLModulo.generarXMLSicveca();
        res.json({ mensaje: 'Archivo Sicveca_Reporte.xml compilado de forma jerárquica.', xml: xmlData });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

// HISTORIAL Y RESUMEN DE COMISIONES (SOLUCIÓN AL QUERY QUEMADO)
app.post('/api/comisiones/historial', async (req, res) => {
    try {
        const pool = await poolPromise;
        const { tipoId, tipoNombre, cantidad, monto } = req.body;
        
        const idTipoComisionParsed = parseInt(tipoId) || 0;
        const cantidadParsed = parseInt(cantidad) || 0;
        const montoParsed = parseFloat(monto) || 0.0;

        await pool.request()
            .input('C_IdTipoComision', sql.Int,          idTipoComisionParsed)
            .input('D_TipoComision',   sql.VarChar(100),  tipoNombre || 'Otro')
            .input('N_Cantidad',       sql.Int,          cantidadParsed)
            .input('M_Monto',          sql.Decimal(22,2), montoParsed)
            .execute('dbo.sp_RegistrarHistorialComision');
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/comisiones/historial', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('dbo.sp_ObtenerHistorialComisiones');
        res.json({
            detalle: result.recordsets[0] || [],
            resumenDiario: result.recordsets[1] || []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Arreglado: Eliminado el SQL crudo (Query quemado) y unificado al Stored Procedure lógico de control histórico
app.get('/api/comisiones/resumen', async (req, res) => {
    try {
        const pool = await poolPromise;
        //  el SP oficial que ya agrupa y totaliza de forma segura en la BD
        const result = await pool.request().execute('dbo.sp_ObtenerHistorialComisiones');
        
         
        const desgloseComisiones = result.recordsets[0] || [];
        
        
        const mapeoNombres = { 1: 'Comisión Retiro ATM', 2: 'Comisión SINPE', 3: 'Tarifa Red SWIFT' };
        
         
        const agrupado = {};
        let totalGeneral = 0;

        desgloseComisiones.forEach(row => {
            const id = row.C_IdTipoComision || 0;
            const m = parseFloat(row.M_Monto || 0);
            const q = parseInt(row.N_Cantidad || row.CantidadTransacciones || 1);
            
            if (!agrupado[id]) {
                agrupado[id] = {
                    C_IdTipoComision: id,
                    TipoComision: mapeoNombres[id] || row.D_TipoComision || 'Otro',
                    CantidadTransacciones: 0,
                    TotalRecaudado: 0
                };
            }
            agrupado[id].CantidadTransacciones += q;
            agrupado[id].TotalRecaudado += m;
            totalGeneral += m;
        });

        res.json({ 
            detalle: Object.values(agrupado), 
            totalGeneral: totalGeneral 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ENDPOINTS DEL CORE BANCARIO PRODUCTOS, PERSONAS Y TRANSACCIONES - CRUD
app.get('/api/productos', leerTodosProductos);
app.get('/api/transacciones', leerTodasTransacciones);

app.get('/api/tipos-productos', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().execute('dbo.sp_ObtenerTiposProductos');
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tipos-productos', async (req, res) => {
    try {
        const pool = await poolPromise;
        const { idProducto, nombre } = req.body;
        await pool.request()
            .input('IdProducto', sql.Int, parseInt(idProducto) || 0)
            .input('Nombre',     sql.VarChar(200), nombre || '')
            .execute('dbo.sp_InsertarTipoProducto');
        res.json({ mensaje: 'Tipo de producto registrado.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tipos-productos/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const { nombre } = req.body;
        await pool.request()
            .input('IdProducto', sql.Int, parseInt(req.params.id) || 0)
            .input('Nombre',     sql.VarChar(200), nombre || '')
            .execute('dbo.sp_ActualizarTipoProducto');
        res.json({ mensaje: 'Tipo de producto actualizado.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tipos-productos/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('IdProducto', sql.Int, parseInt(req.params.id) || 0)
            .execute('dbo.sp_EliminarTipoProducto');
        res.json({ mensaje: 'Tipo de producto eliminado.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clientes/baja', eliminarClienteSeguro);
app.get('/api/clientes/:idCliente/productos', leerProductosCliente);
app.get('/api/productos/:numeroProducto', leerProducto);
app.post('/api/productos', crearProducto);
app.put('/api/productos/:numeroProducto', actualizarProducto);
app.delete('/api/productos/:numeroProducto', eliminarProducto);
 
app.get('/api/transacciones/:idTransaccion', leerTransaccion);
app.post('/api/transacciones', crearTransaccion);
app.put('/api/transacciones/:idTransaccion', actualizarTransaccion);
app.delete('/api/transacciones/:idTransaccion', eliminarTransaccion);
 
app.get('/api/personas/:id', leerPersona);         

app.get('/api/perfil-simulado/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(req.params.id) || 0)
            .execute('dbo.sp_ObtenerPerfilClienteSimulado');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/personas', crearPersona);           
app.put('/api/personas/:id', actualizarPersona);   
app.delete('/api/personas/:id', eliminarPersona);  
app.post('/api/clientes/:id/visita', registrarVisita);
 
// CAPA DE SIMULACIÓN Y ESCENARIOS DINÁMICOS
app.post('/api/escenarios/1', ejecutarEscenario1);
app.post('/api/escenarios/2', ejecutarEscenario2);
app.post('/api/escenarios/4', ejecutarEscenario4);
 
// INICIALIZACIÓN DEL SERVIDOR
app.listen(PORT, () => {
    console.log(`MLDC CORE OPERATIVO EN INSTANCIA POKER [PORT ${PORT}]`);
    console.log(`Panel Universitario: http://localhost:${PORT}`);
});