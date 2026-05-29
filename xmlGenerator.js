const { create } = require('xmlbuilder2');
const fs = require('fs');
const { sql, poolPromise } = require('./db');

function validarDatosXML(datosValidar) {
    const errores = [];

    if (!datosValidar.anio || datosValidar.anio < 2014) {
        errores.push(`Anio invalido: ${datosValidar.anio}. Debe ser mayor a 2013.`);
    }

    if (!datosValidar.mesActual || datosValidar.mesActual < 1 || datosValidar.mesActual > 12) {
        errores.push(`Mes invalido: ${datosValidar.mesActual}. Debe estar entre 1 y 12.`);
    }

    if (datosValidar.totalClientes < 0) {
        errores.push(`Cantidad de clientes invalida: ${datosValidar.totalClientes}. No puede ser un valor negativo.`);
    }

    datosValidar.transferencias.forEach((movimiento) => {
        if (movimiento.MontoTotal < 0) {
            errores.push(`Monto invalido en producto tipo ${movimiento.C_TipoProducto}: ${movimiento.MontoTotal}. Los montos no pueden ser negativos.`);
        }
    });

    return errores;
}

async function generarXMLSicveca() {
    const pool = await poolPromise;

    try {
        console.log('[XML] Consultando datos mediante procedimientos almacenados...');
        
        const fechaActual = new Date();
        const anio = fechaActual.getFullYear();
        const mesActual = fechaActual.getMonth() + 1;

        const resultZonas = await pool.request().execute('dbo.sp_ObtenerTotalClientesXML');
        const totalClientes = resultZonas.recordset[0].CantidadClientes || 0;

        const resultTransferencias = await pool.request().execute('dbo.sp_ObtenerTotalesTransferenciasRemesasXML');

        const datosExtraidos = {
            anio: anio,
            mesActual: mesActual,
            totalClientes: totalClientes,
            transferencias: resultTransferencias.recordset
        };

        const erroresValidacion = validarDatosXML(datosExtraidos);

        if (erroresValidacion.length > 0) {
            console.error('[ERROR DE VALIDACION] Los datos no cumplen con los requisitos estructurales:');
            erroresValidacion.forEach(err => console.error(`- ${err}`));
            throw new Error(`Validacion fallida. No es posible generar el documento XML.`);
        }

        const root = create({ version: '1.0', encoding: 'UTF-8' })
            .ele('Registro', { id: '', accion: '' });

        root.ele('Anio').txt(anio.toString());

        const listaZonas = root.ele('ListaZonaGeografica');
        const elementoZona = listaZonas.ele('ElementoZonaGeografica');
        
        elementoZona.ele('MesActual').txt(mesActual.toString());
        elementoZona.ele('TipoDependencia').txt('Oficinas Centrales'); 
        elementoZona.ele('NombreDependencia').txt('Sede Principal'); 
        elementoZona.ele('TipoRiesgoCliente').txt('Moderado'); 
        elementoZona.ele('CantidadClientes').txt(totalClientes.toString());
        elementoZona.ele('TipoRiesgoDependencia').txt('Bajo');

        const listaTransferencias = root.ele('ListaTransferenciasRemesas');

        if (resultTransferencias.recordset.length > 0) {
            for (const row of resultTransferencias.recordset) {
                const tipoMovimiento = row.C_TipoProducto === 13 ? '1' : '2'; 
                
                const elementoTransferencia = listaTransferencias.ele('ElementoTransferenciasRemesas');
                elementoTransferencia.ele('Mes').txt(mesActual.toString());
                elementoTransferencia.ele('TipoMovimiento').txt(tipoMovimiento);
                elementoTransferencia.ele('TipoEntradaSalidaFondos').txt('1'); 
                elementoTransferencia.ele('MontoTotal').txt(row.MontoTotal ? row.MontoTotal.toFixed(2) : '0.00');
                elementoTransferencia.ele('CodigoPaisISO').txt('CRI'); 
            }
        } else {
            const elementoTransferencia = listaTransferencias.ele('ElementoTransferenciasRemesas');
            elementoTransferencia.ele('Mes').txt(mesActual.toString());
            elementoTransferencia.ele('TipoMovimiento').txt('1');
            elementoTransferencia.ele('TipoEntradaSalidaFondos').txt('1');
            elementoTransferencia.ele('MontoTotal').txt('0.00');
            elementoTransferencia.ele('CodigoPaisISO').txt('CRI');
        }

        const xmlString = root.end({ prettyPrint: true });
        fs.writeFileSync('Sicveca_Reporte.xml', xmlString, 'utf-8');
        console.log('[XML] Documento "Sicveca_Reporte.xml" exportado exitosamente.');

    } catch (err) {
        console.error('[ERROR PROCESO XML]', err.message);
        throw err;
    }
}

module.exports = { generarXMLSicveca };