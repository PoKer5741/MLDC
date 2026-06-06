const { sql, poolPromise } = require('./db');

// ==========================================
// 1. OPERACIONES DE LECTURA (GET)
// ==========================================

async function leerProductosCliente(req, res) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(req.params.idCliente))
            .execute('dbo.sp_LeerProductosCliente');
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

async function leerTodosProductos(req, res) {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const termino = req.query.termino || null;
        
        if (termino) {
            request.input('Termino', sql.VarChar(100), termino);
        }
        
        const result = await request.execute('dbo.sp_ObtenerTodosProductos');
        res.json(result.recordset);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}

async function leerTodasTransacciones(req, res) {
    try {
        const pool = await poolPromise;
        const request = pool.request();
        const termino = req.query.termino || null;
        
        if (termino) {
            request.input('Termino', sql.VarChar(100), termino);
        }
        
        const result = await request.execute('dbo.sp_ObtenerTodasTransacciones');
        res.json(result.recordset);
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}

// ==========================================
// 2. OPERACIONES DE MUTACIÓN (POST, PUT, DELETE)
// ==========================================

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
        res.json({ mensaje: 'Producto creado exitosamente.' });
    } catch (error) {
        if (error.message.includes('UNIQUE KEY') || error.message.includes('duplicate key')) {
            return res.json({ mensaje: 'Operacion omitida: El producto ya existe.' });
        }
        res.status(500).json({ error: error.message }); 
    }
}

async function actualizarProducto(req, res) {
    try {
        const pool = await poolPromise;
        const { idCliente, tipoProducto, saldo } = req.body;
        await pool.request()
            .input('D_NumeroProducto', sql.VarChar(50), req.params.numeroProducto)
            .input('Id_Cliente', sql.Int, parseInt(idCliente))
            .input('C_TipoProducto', sql.Int, tipoProducto)
            .input('M_Saldo', sql.Decimal(18, 2), saldo)
            .execute('dbo.sp_ActualizarProducto');
        res.json({ mensaje: 'Producto actualizado exitosamente.' });
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
        res.json({ mensaje: 'Producto eliminado exitosamente.' });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}

async function crearTransaccion(req, res) {
    try {
        const pool = await poolPromise;
        const { idProductoRef, monto, tipoTransaccion } = req.body;
        await pool.request()
            .input('Id_Producto_Ref', sql.VarChar(50), idProductoRef)
            .input('M_Monto', sql.Decimal(18, 2), monto)
            .input('C_IdTipoTransaccion', sql.Int, tipoTransaccion)
            .execute('dbo.sp_InsertarTransaccion');
        res.json({ mensaje: 'Transacción asentada y balance actualizado.' });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}

async function actualizarTransaccion(req, res) {
    try {
        const pool = await poolPromise;
        const { idProductoRef, monto, tipoTransaccion } = req.body;
        await pool.request()
            .input('Id_Transaccion', sql.Int, parseInt(req.params.idTransaccion))
            .input('Id_Producto_Ref', sql.VarChar(50), idProductoRef)
            .input('M_Monto', sql.Decimal(18, 2), monto)
            .input('C_IdTipoTransaccion', sql.Int, tipoTransaccion)
            .execute('dbo.sp_ActualizarTransaccion');
        res.json({ mensaje: 'Transacción modificada.' });
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

async function crearPersona(req, res) {
    try {
        const pool = await poolPromise;
        const { cedula, nombre, apellido, tipoPersona } = req.body;
        await pool.request()
            .input('C_IdPersona', sql.VarChar(20), cedula.toString())
            .input('D_Nombre', sql.VarChar(200), nombre)
            .input('D_PrimerApellido', sql.VarChar(50), apellido)
            .input('C_IdTipoPersona', sql.Int, tipoPersona)
            .execute('dbo.sp_RegistrarClienteCompleto');    
        res.json({ mensaje: 'Cliente registrado íntegramente.' });
    } catch (error) {
        if (error.message.includes('UNIQUE KEY') || error.message.includes('UQ_Cliente_Persona') || error.message.includes('duplicate key')) {
            return res.json({ mensaje: 'Operacion omitida: El cliente ya existia en el Core.' });
        }
        res.status(500).json({ error: error.message });
    }
}

async function eliminarClienteSeguro(req, res) {
    try {
        const pool = await poolPromise;
        const { cedula, motivo } = req.body;
        await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(cedula))
            .input('Motivo', sql.VarChar(255), motivo)
            .execute('dbo.sp_EliminarClienteSeguro');
        res.json({ mensaje: 'Cliente dado de baja del Core.' });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}

async function actualizarPersona(req, res) {
    try {
        const pool = await poolPromise;
        const { nombre, apellido, tipoPersona } = req.body;
        await pool.request()
            .input('C_IdPersona', sql.Int, parseInt(req.params.id))
            .input('D_Nombre', sql.VarChar(200), nombre)
            .input('D_PrimerApellido', sql.VarChar(50), apellido)
            .input('C_IdTipoPersona', sql.Int, tipoPersona)
            .execute('dbo.sp_ActualizarPersona');
        res.json({ mensaje: 'Persona modificada con éxito.' });
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
        res.json({ mensaje: 'Persona dada de baja.' });
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
        res.json({ mensaje: 'Frecuencia incrementada.' });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}

// ==========================================
// 3. ENLACES OPERATIVOS PARA ESCENARIO 4
// ==========================================

async function crearComisionEntidad(req, res) {
    try {
        const pool = await poolPromise;
        const { idProductoRef, idCliente, idTipoComision, idMoneda, monto, descripcion } = req.body;
        
        await pool.request()
            .input('Id_Producto_Ref', sql.VarChar(50), idProductoRef)
            .input('Id_Cliente', sql.Int, parseInt(idCliente))
            .input('C_IdTipoComision', sql.Int, parseInt(idTipoComision))
            .input('C_IdMoneda', sql.Int, parseInt(idMoneda))
            .input('M_Monto', sql.Decimal(22, 2), monto)
            .input('D_Descripcion', sql.VarChar(255), descripcion)
            .execute('dbo.sp_RegistrarComision');
            
        res.json({ mensaje: 'Comisión registrada como ganancia de la entidad.' });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}

async function crearOperacionDivisa(req, res) {
    try {
        const pool = await poolPromise;
        const { idCliente, idTipoCambio, tipoOperacion, montoOrigen, montoDestino } = req.body;
        
        await pool.request()
            .input('Id_Cliente', sql.Int, parseInt(idCliente))
            .input('Id_TipoCambio', sql.Int, parseInt(idTipoCambio))
            .input('T_TipoOperacion', sql.VarChar(10), tipoOperacion)
            .input('M_MontoOrigen', sql.Decimal(22, 2), montoOrigen)
            .input('M_MontoDestino', sql.Decimal(22, 2), montoDestino)
            .execute('dbo.sp_RegistrarOperacionCambio');
            
        res.json({ mensaje: 'Operación de cambio registrada correctamente.' });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
}

module.exports = {
    leerProductosCliente,
    leerProducto,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    leerTransaccion,
    crearTransaccion,
    actualizarTransaccion,
    eliminarTransaccion,
    leerPersona,
    crearPersona,
    actualizarPersona,
    eliminarPersona,
    registrarVisita,
    leerTodosProductos,
    leerTodasTransacciones,
    eliminarClienteSeguro,
    crearComisionEntidad,
    crearOperacionDivisa
};