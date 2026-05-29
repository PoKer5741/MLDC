const { sql, poolPromise } = require('./db');

// ── CRUD: PRODUCTOS ──
async function leerProductosCliente(req, res) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(req.params.idCliente))
            .execute('dbo.sp_ObtenerProductosCliente');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function leerProducto(req, res) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('D_NumeroProducto', sql.VarChar(50), req.params.numeroProducto)
            .execute('dbo.sp_LeerProducto');
        res.json(result.recordset[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function crearProducto(req, res) {
    try {
        const pool = await poolPromise;
        const { numeroProducto, idCliente, tipoProducto, saldoInicial } = req.body;
        await pool.request()
            .input('D_NumeroProducto', sql.VarChar(50), numeroProducto)
            .input('Id_Cliente', sql.Int, parseInt(idCliente))
            .input('C_TipoProducto', sql.Int, tipoProducto)
            .input('M_Saldo', sql.Decimal(18, 2), saldoInicial)
            .execute('dbo.sp_InsertarProducto');
        res.json({ mensaje: 'Producto creado.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function actualizarProducto(req, res) {
    try {
        const pool = await poolPromise;
        const { saldo, estado } = req.body;
        await pool.request()
            .input('D_NumeroProducto', sql.VarChar(50), req.params.numeroProducto)
            .input('M_Saldo', sql.Decimal(18, 2), saldo)
            .input('N_Estado', sql.Int, estado)
            .execute('dbo.sp_ActualizarProducto');
        res.json({ mensaje: 'Producto actualizado.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function eliminarProducto(req, res) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('D_NumeroProducto', sql.VarChar(50), req.params.numeroProducto)
            .execute('dbo.sp_EliminarProducto');
        res.json({ mensaje: 'Producto eliminado.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// ── CRUD: TRANSACCIONES ──
async function leerTransaccion(req, res) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('Id_Transaccion', sql.Int, parseInt(req.params.idTransaccion))
            .execute('dbo.sp_LeerTransaccion');
        res.json(result.recordset[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function crearTransaccion(req, res) {
    try {
        const pool = await poolPromise;
        const { numeroProducto, monto, tipoTransaccion } = req.body;
        await pool.request()
            .input('Id_Producto_Ref', sql.VarChar(50), numeroProducto)
            .input('M_Monto', sql.Decimal(18, 2), monto)
            .input('C_IdTipoTransaccion', sql.Int, tipoTransaccion)
            .execute('dbo.sp_InsertarTransaccion');
        res.json({ mensaje: 'Transacción procesada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function actualizarTransaccion(req, res) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('Id_Transaccion', sql.Int, parseInt(req.params.idTransaccion))
            .input('M_Monto', sql.Decimal(18, 2), req.body.monto)
            .execute('dbo.sp_ActualizarTransaccion');
        res.json({ mensaje: 'Transacción actualizada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function eliminarTransaccion(req, res) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('Id_Transaccion', sql.Int, parseInt(req.params.idTransaccion))
            .execute('dbo.sp_EliminarTransaccion');
        res.json({ mensaje: 'Transacción eliminada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// ── CRUD: PERSONAS ──
async function leerPersona(req, res) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(req.params.id))
            .execute('dbo.sp_LeerPersona');
        res.json(result.recordset[0] || {});
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function crearPersona(req, res) {
    try {
        const pool = await poolPromise;
        const { id, nombre, apellido, tipoPersona } = req.body;
        await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(id))
            .input('D_Nombre', sql.VarChar(200), nombre)
            .input('D_PrimerApellido', sql.VarChar(50), apellido)
            .input('C_IdTipoPersona', sql.Int, tipoPersona)
            .execute('dbo.sp_CrearPersona');
        res.json({ mensaje: 'Persona creada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function actualizarPersona(req, res) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(req.params.id))
            .input('D_Nombre', sql.VarChar(200), req.body.nombre)
            .input('D_PrimerApellido', sql.VarChar(50), req.body.apellido)
            .input('C_IdTipoPersona', sql.Int, req.body.tipoPersona)
            .execute('dbo.sp_ActualizarPersona');
        res.json({ mensaje: 'Persona actualizada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function eliminarPersona(req, res) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(req.params.id))
            .execute('dbo.sp_EliminarPersona');
        res.json({ mensaje: 'Persona eliminada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function registrarVisita(req, res) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(req.params.id))
            .execute('dbo.sp_RegistrarVisitaCliente');
        res.json({ mensaje: 'Visita registrada.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    leerProductosCliente, leerProducto, crearProducto, actualizarProducto, eliminarProducto,
    leerTransaccion, crearTransaccion, actualizarTransaccion, eliminarTransaccion,
    leerPersona, crearPersona, actualizarPersona, eliminarPersona, registrarVisita
};