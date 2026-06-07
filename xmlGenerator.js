const { create } = require('xmlbuilder2');
const fs = require('fs');
const { poolPromise } = require('./db');

const TIPO_OP   = { 1: 'Activas', 2: 'Pasivas', 3: 'Fuera de Balance', 4: 'Todos' };
const ESTADO_CL = { 1: 'Nuevo', 2: 'Cerrado', 3: 'Inactivo' };
const PERSONA   = { 1: 'Física', 2: 'Jurídica' };
const RESIDENCIA = { 1: 'Residente', 2: 'No Residente' };

function fmt(v) { return parseFloat(v || 0).toFixed(2); }
function num(v) { return (v || 0).toString(); }

async function generarXMLSicveca() {
    const pool   = await poolPromise;
    const result = await pool.request().execute('dbo.sp_GenerarDatosXML_Sicveca');

    const cab  = result.recordsets[0][0];
    const A    = result.recordsets[1]  || [];
    const B    = result.recordsets[2]  || [];
    const C1   = result.recordsets[3]  || [];
    const C2   = result.recordsets[4]  || [];
    const D    = result.recordsets[5]  || [];
    const E    = result.recordsets[6]  || [];
    const F    = result.recordsets[7]  || [];
    const G    = result.recordsets[8]  || [];
    const H    = result.recordsets[9]  || [];
    const I    = result.recordsets[10] || [];
    const J    = result.recordsets[11] || [];
    const K    = result.recordsets[12] || [];
    const L    = result.recordsets[13] || [];

    const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('Registro', { id: num(cab.IdRegistro), accion: 'insertar' });

    root.ele('Anio').txt(num(cab.Anio));

    /* ── CUADRO A ─────────────────────────────────────────────── */
    const listaA = root.ele('ListaTotalClientesPorRiesgo');
    for (const r of A) {
        const e = listaA.ele('ElementoTotalClientesPorRiesgo');
        e.ele('Mes_ClientesPorRiesgo').txt(num(r.Mes));
        e.ele('TipoRiesgo_ClientesPorRiesgo').txt(r.TipoRiesgo);
        e.ele('Total_ClientesPorRiesgo').txt(num(r.TotalClientes));
    }

    /* ── CUADRO B ─────────────────────────────────────────────── */
    const listaB = root.ele('ListaClientesNuevosCerradosEInactivos');
    for (const r of B) {
        const e = listaB.ele('ElementoClientesNuevosCerradosEInactivos');
        e.ele('Mes_ClientesNuevosCerradosEInactivos').txt(num(r.Mes));
        e.ele('TipoOperacion_ClientesNuevosCerradosEInactivos').txt(TIPO_OP[r.TipoOperacion] || 'Activas');
        e.ele('TipoEstadoCliente_ClientesNuevosCerradosEInactivos').txt(ESTADO_CL[r.TipoEstadoCliente] || 'Nuevo');
        e.ele('NumeroClientes_ClientesNuevosCerradosEInactivos').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesNuevosCerradosEInactivos').txt(fmt(r.PorcentajeClientes));
    }

    /* ── CUADRO C1 ─ Tipo Persona ────────────────────────────── */
    const listaC1 = root.ele('ListaClientesPorTipoPersona');
    for (const r of C1) {
        const e = listaC1.ele('ElementoClientesPorTipoPersona');
        e.ele('Mes_ClientesPorTipoPersona').txt(num(r.Mes));
        e.ele('TipoPersonaCliente_ClientesPorTipoPersona').txt(PERSONA[r.TipoPersona] || 'Física');
        e.ele('NumeroClientes_ClientesPorTipoPersona').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesPorTipoPersona').txt(fmt(r.PorcentajeClientes));
        e.ele('SaldoOperaciones_ClientesPorTipoPersona').txt(fmt(r.SaldoOperaciones));
        e.ele('PorcentajeSobreTotalOperaciones_ClientesPorTipoPersona').txt(fmt(r.PorcentajeSobreTotal));
    }

    /* ── CUADRO C2 ─ Naturaleza ──────────────────────────────── */
    const listaC2 = root.ele('ListaClientesPorNaturaleza');
    for (const r of C2) {
        const e = listaC2.ele('ElementoClientesPorNaturaleza');
        e.ele('Mes_ClientesPorNaturaleza').txt(num(r.Mes));
        e.ele('TipoNaturalezaActividadEconomicaCliente').txt(PERSONA[r.TipoNaturaleza] || 'Física');
        e.ele('NumeroClientes_ClientesPorNaturaleza').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesPorNaturaleza').txt(fmt(r.PorcentajeClientes));
        e.ele('SaldoOperaciones_ClientesPorNaturaleza').txt(fmt(r.SaldoOperaciones));
        e.ele('PorcentajeSobreTotalOperaciones_ClientesPorNaturaleza').txt(fmt(r.PorcentajeSobreTotal));
    }

    /* ── CUADROS D, E, F ─ misma estructura ─────────────────── */
    const cuadrosDEF = [
        { lista: 'ListaClientesConOperacionesActivas',      elem: 'ElementoClientesConOperacionesActivas',      sufijo: 'ClientesConOperacionesActivas',      datos: D },
        { lista: 'ListaClientesConOperacionesPasivas',      elem: 'ElementoClientesConOperacionesPasivas',      sufijo: 'ClientesConOperacionesPasivas',      datos: E },
        { lista: 'ListaClientesConOperacionesFueraBalance', elem: 'ElementoClientesConOperacionesFueraBalance', sufijo: 'ClientesConOperacionesFueraBalance', datos: F },
    ];
    for (const { lista, elem, sufijo, datos } of cuadrosDEF) {
        const lst = root.ele(lista);
        for (const r of datos) {
            const e = lst.ele(elem);
            e.ele(`Mes_${sufijo}`).txt(num(r.Mes));
            e.ele(`TipoRiesgo_${sufijo}`).txt(r.TipoRiesgo);
            e.ele(`NumeroClientes_${sufijo}`).txt(num(r.NumeroClientes));
            e.ele(`PorcentajeClientes_${sufijo}`).txt(fmt(r.PorcentajeClientes));
            e.ele(`SaldoOperaciones_${sufijo}`).txt(fmt(r.SaldoOperaciones));
            e.ele(`PorcentajeSobreTotalOperaciones_${sufijo}`).txt(fmt(r.PorcentajeSobreTotal));
        }
    }

    /* ── CUADRO G ─────────────────────────────────────────────── */
    const listaG = root.ele('ListaClientesConOperacionesActivasPasivas');
    for (const r of G) {
        const e = listaG.ele('ElementoClientesConOperacionesActivasPasivas');
        e.ele('Mes_ClientesConOperacionesActivasPasivas').txt(num(r.Mes));
        e.ele('TipoRiesgo_ClientesConOperacionesActivasPasivas').txt(r.TipoRiesgo);
        e.ele('NumeroClientes_ClientesConOperacionesActivasPasivas').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesConOperacionesActivasPasivas').txt(fmt(r.PorcentajeClientes));
    }

    /* ── CUADRO H ─────────────────────────────────────────────── */
    const listaH = root.ele('ListaClientesReclasificadosMes');
    for (const r of H) {
        const e = listaH.ele('ElementoClientesReclasificadosMes');
        e.ele('Mes_ClientesReclasificadosMes').txt(num(r.Mes));
        e.ele('TipoOperacion_ClientesReclasificadosMes').txt(TIPO_OP[r.TipoOperacion] || 'Activas');
        e.ele('TipoRiesgo_ClientesReclasificadosMes').txt(r.TipoRiesgo);
        e.ele('NumeroClientesReclasificados_ClientesReclasificadosMes').txt(num(r.NumeroClientesReclasificados));
    }

    /* ── CUADRO I ─────────────────────────────────────────────── */
    const listaI = root.ele('ListaClientesJurisdiccionResidencia');
    for (const r of I) {
        const e = listaI.ele('ElementoClientesJurisdiccionResidencia');
        e.ele('Mes_ClientesJurisdiccionResidencia').txt(num(r.Mes));
        e.ele('TipoResidencia_ClientesJurisdiccionResidencia').txt(RESIDENCIA[r.TipoResidencia] || 'Residente');
        e.ele('TipoRiesgo_ClientesJurisdiccionResidencia').txt(r.TipoRiesgo);
        e.ele('NumeroClientes_ClientesJurisdiccionResidencia').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_ClientesJurisdiccionResidencia').txt(fmt(r.PorcentajeClientes));
        e.ele('SaldosActivos_ClientesJurisdiccionResidencia').txt(fmt(r.SaldosActivos));
        e.ele('SaldosPasivos_ClientesJurisdiccionResidencia').txt(fmt(r.SaldosPasivos));
        e.ele('SaldosFueraBalance_ClientesJurisdiccionResidencia').txt(fmt(r.SaldosFueraBalance));
    }

    /* ── CUADRO J ─────────────────────────────────────────────── */
    const listaJ = root.ele('ListaSujetosObligadosArticulo15Ley8204');
    for (const r of J) {
        const e = listaJ.ele('ElementoSujetosObligadosArticulo15Ley8204');
        e.ele('Mes_SujetosObligadosArticulo15Ley8204').txt(num(r.Mes));
        e.ele('TipoRiesgo_SujetosObligadosArticulo15Ley8204').txt(r.TipoRiesgo);
        e.ele('NumeroClientes_SujetosObligadosArticulo15Ley8204').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_SujetosObligadosArticulo15Ley8204').txt(fmt(r.PorcentajeClientes));
    }

    /* ── CUADRO K ─────────────────────────────────────────────── */
    const listaK = root.ele('ListaPersonasExpuestasPoliticamente');
    for (const r of K) {
        const e = listaK.ele('ElementoPersonasExpuestasPoliticamente');
        e.ele('Mes_PersonasExpuestasPoliticamente').txt(num(r.Mes));
        e.ele('TipoRiesgo_PersonasExpuestasPoliticamente').txt(r.TipoRiesgo);
        e.ele('NumeroClientes_PersonasExpuestasPoliticamente').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_PersonasExpuestasPoliticamente').txt(fmt(r.PorcentajeClientes));
        e.ele('SaldosActivos_PersonasExpuestasPoliticamente').txt(fmt(r.SaldosActivos));
        e.ele('SaldosPasivos_PersonasExpuestasPoliticamente').txt(fmt(r.SaldosPasivos));
        e.ele('SaldosFueraBalance_PersonasExpuestasPoliticamente').txt(fmt(r.SaldosFueraBalance));
    }

    /* ── CUADRO L ─────────────────────────────────────────────── */
    const listaL = root.ele('ListaClientesOperacionesMayores100');
    for (const r of L) {
        const e = listaL.ele('ElementoClientesOperacionesMayores100');
        e.ele('Mes_OperacionesMayores100').txt(num(r.Mes));
        e.ele('TipoRiesgo_OperacionesMayores100').txt(r.TipoRiesgo);
        e.ele('NumeroClientes_OperacionesMayores100').txt(num(r.NumeroClientes));
        e.ele('PorcentajeClientes_OperacionesMayores100').txt(fmt(r.PorcentajeClientes));
        e.ele('TotalIngresos_OperacionesMayores100').txt(fmt(r.TotalIngresos));
    }

    const xmlString = root.end({ prettyPrint: true });
    fs.writeFileSync('Sicveca_Reporte.xml', xmlString, 'utf-8');
    console.log('[XML] Sicveca_Reporte.xml generado con los 12 cuadros (A-L).');
    return xmlString;
}

module.exports = { generarXMLSicveca };
