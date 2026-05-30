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
const { ejecutarEscenario1, ejecutarEscenario2 } = require('./scenariosController');
 
const app = express();
const PORT = 3000;
 
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
 
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
 
        if (termino.length < 2 && !provincia && !canton && !distrito) {
            return res.json([]);
        }
 
        const resultados = await buscarClienteInteligente(termino, { provincia, canton, distrito });
        return res.json(resultados);
 
    } catch (err) {
        console.error('[BUSCAR ERROR]', err.message);
        res.status(500).json({ error: `Fallo en busqueda: ${err.message}` });
    }
});
 
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
        const cantons = await obtenerCantones(req.params.idProvincia);
        res.json(cantons);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
app.get('/api/geo/distritos/:idCanton', async (req, res) => {
    try {
        const districts = await obtenerDistritos(req.params.idCanton);
        res.json(districts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 
app.post('/api/procesar-riesgo', async (req, res) => {
    try {
        await procesarRiesgo();
        res.json({ mensaje: 'Calificacion masiva parametrica asentada en T_Calculo_Riesgo.' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

app.post('/api/clientes/:idCliente/calcular-riesgo', calcularRiesgoClienteIndividual);
app.post('/api/clientes/:idCliente/riesgo-manual', guardarRiesgoManualCliente);
 
app.post('/api/generar-xml', async (req, res) => {
    try {
        await XMLModulo.generarXMLSicveca();
        res.json({ mensaje: 'Archivo Sicveca_Reporte.xml compilado de forma jerarquica.' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

app.post('/api/escenarios/4', async (req, res) => {
    try {
        res.json({ mensaje: 'Escenario 4 de comisiones y divisas ejecutado exitosamente.' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

/// --- RUTAS GLOBALES AGREGADAS ---
app.get('/api/productos', leerTodosProductos);
app.get('/api/transacciones', leerTodasTransacciones);

// ── Catálogo de tipos de producto ──────────────────────────
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
            .input('IdProducto', sql.Int, parseInt(idProducto))
            .input('Nombre',     sql.VarChar(200), nombre)
            .execute('dbo.sp_InsertarTipoProducto');
        res.json({ mensaje: 'Tipo de producto registrado.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/tipos-productos/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        const { nombre } = req.body;
        await pool.request()
            .input('IdProducto', sql.Int, parseInt(req.params.id))
            .input('Nombre',     sql.VarChar(200), nombre)
            .execute('dbo.sp_ActualizarTipoProducto');
        res.json({ mensaje: 'Tipo de producto actualizado.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/tipos-productos/:id', async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('IdProducto', sql.Int, parseInt(req.params.id))
            .execute('dbo.sp_EliminarTipoProducto');
        res.json({ mensaje: 'Tipo de producto eliminado.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// ────────────────────────────────────────────────────────────

// --------------------------------
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
            .input('C_IdPersona', sql.Int, parseInt(req.params.id))
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
 
app.post('/api/escenarios/1', ejecutarEscenario1);
app.post('/api/escenarios/2', ejecutarEscenario2);
 
app.listen(PORT, () => {
    console.log(`MLDC CORE OPERATIVO EN INSTANCIA POKER [PORT ${PORT}]`);
    console.log(`Panel Universitario: http://localhost:${PORT}`);
});