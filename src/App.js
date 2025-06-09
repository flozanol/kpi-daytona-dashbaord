import React, { useState, useCallback } from 'react';
import { Upload, BarChart3, TrendingUp, Calendar, Building2, FileSpreadsheet, Download, Plus, X, AlertCircle, Link, RefreshCw } from 'lucide-react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ResponsiveContainer } from 'recharts';

const KPIAnalyzer = () => {
  const [agencies, setAgencies] = useState([]);
  const [selectedAgencies, setSelectedAgencies] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allKPIs, setAllKPIs] = useState([]);
  const [allMonths, setAllMonths] = useState([]);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('');

  const extractSpreadsheetId = (url) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const fetchGoogleSheet = async (spreadsheetId, sheetName) => {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
    
    try {
      const response = await fetch(csvUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/csv'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const csvText = await response.text();
      
      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('<html')) {
        throw new Error(`La hoja "${sheetName}" no existe o no es accesible`);
      }
      
      return csvText;
    } catch (error) {
      console.error(`Error cargando ${sheetName}:`, error);
      throw new Error(`No se pudo cargar la hoja "${sheetName}": ${error.message}`);
    }
  };

  const processParsedData = (data, agencyName) => {
    if (!data || data.length === 0) {
      throw new Error(`La hoja "${agencyName}" está vacía`);
    }

    const headers = Object.keys(data[0]);
    const kpiColumn = headers.find(h => 
      h.toLowerCase().includes('kpi') || 
      h.toLowerCase().includes('indicador') ||
      h.toLowerCase().includes('metrica') ||
      h.toLowerCase().includes('metric')
    );
    
    if (!kpiColumn) {
      throw new Error(`No se encontró una columna de KPIs en "${agencyName}". Columnas disponibles: ${headers.join(', ')}`);
    }

    const monthColumns = headers.filter(header => {
      const monthRegex = /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}\/\d{4}|\d{4}-\d{2})/i;
      return monthRegex.test(header) || /^(Q[1-4]|T[1-4])/.test(header);
    });

    if (monthColumns.length === 0) {
      throw new Error(`No se encontraron columnas de meses en "${agencyName}". Asegúrate de tener columnas con nombres de meses.`);
    }

    const monthlyData = {};
    const kpis = [];

    data.forEach(row => {
      const kpiName = row[kpiColumn];
      if (kpiName && kpiName.toString().trim() !== '' && kpiName.toString().trim() !== 'undefined') {
        kpis.push(kpiName.toString().trim());
        monthlyData[kpiName] = {};
        
        monthColumns.forEach(month => {
          const value = row[month];
          monthlyData[kpiName][month] = value ? parseFloat(value.toString().replace(/[,%$]/g, '')) || 0 : 0;
        });
      }
    });

    return {
      name: agencyName,
      kpis,
      months: monthColumns,
      monthlyData,
      fileName: agencyName
    };
  };

  const connectToGoogleSheets = async () => {
    if (!googleSheetsUrl.trim()) {
      alert('Por favor ingresa la URL del Google Sheets');
      return;
    }

    const spreadsheetId = extractSpreadsheetId(googleSheetsUrl);
    if (!spreadsheetId) {
      alert('❌ URL inválida. Asegúrate de usar una URL válida de Google Sheets\n\n✅ Ejemplo: https://docs.google.com/spreadsheets/d/TU_ID_AQUI/edit');
      return;
    }

    setLoading(true);
    setConnectionStatus('loading');
    
    try {
      const expectedAgencies = [
        'GWM Iztapalapa', 'GWM Morelos', 'Honda Cuajimalpa', 'Honda Interlomas', 
        'KIA Interlomas', 'KIA Iztapalapa', 'MG Cuajimalpa', 'MG Interlomas', 'MG Iztapalapa'
      ];

      const loadedAgencies = [];
      const allKPIsSet = new Set();
      const allMonthsSet = new Set();
      const errors = [];
      const successes = [];

      for (const agencyName of expectedAgencies) {
        try {
          console.log(`🔗 Intentando cargar: ${agencyName}`);
          const csvData = await fetchGoogleSheet(spreadsheetId, agencyName);
          
          if (csvData && csvData.trim().length > 0) {
            const parsedData = Papa.parse(csvData, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (header) => header.trim(),
              delimiter: ','
            });

            console.log(`📊 Datos parseados para ${agencyName}:`, parsedData.data?.length, 'filas');

            if (parsedData.data && parsedData.data.length > 0) {
              const processedData = processParsedData(parsedData.data, agencyName);
              loadedAgencies.push(processedData);
              
              processedData.kpis.forEach(kpi => allKPIsSet.add(kpi));
              processedData.months.forEach(month => allMonthsSet.add(month));
              
              successes.push(`✅ ${agencyName}: ${processedData.kpis.length} KPIs, ${processedData.months.length} meses`);
            } else {
              errors.push(`❌ ${agencyName}: Hoja vacía o sin datos válidos`);
            }
          } else {
            errors.push(`❌ ${agencyName}: No se obtuvieron datos`);
          }
        } catch (error) {
          console.error(`❌ Error con ${agencyName}:`, error);
          errors.push(`❌ ${agencyName}: ${error.message}`);
        }
      }

      if (loadedAgencies.length === 0) {
        throw new Error(`❌ No se pudo cargar ninguna hoja.\n\n⚠️ Errores encontrados:\n${errors.join('\n')}\n\n🔧 Verifica que:\n\n1️⃣ El documento sea PÚBLICO (Compartir → Cualquier persona con enlace → Visor)\n2️⃣ Las hojas tengan los nombres exactos de las agencias\n3️⃣ Cada hoja tenga datos con columnas KPI y meses\n\n💡 Nombres esperados: ${expectedAgencies.join(', ')}`);
      }

      setAgencies(loadedAgencies);
      const kpiArray = Array.from(allKPIsSet);
      const monthArray = Array.from(allMonthsSet);
      setAllKPIs(kpiArray);
      setAllMonths(monthArray);
      
      setSelectedAgencies(loadedAgencies.map(a => a.name));
      setSelectedMonths(monthArray.slice(0, 6));
      
      setConnectionStatus('success');
      
      const summary = `🎉 ¡CONEXIÓN EXITOSA!\n\n📊 Resumen:\n${successes.join('\n')}\n\n📈 Total: ${loadedAgencies.length} agencias cargadas\n📋 ${kpiArray.length} KPIs únicos encontrados\n📅 ${monthArray.length} períodos detectados`;
      
      if (errors.length > 0) {
        alert(`${summary}\n\n⚠️ Advertencias:\n${errors.join('\n')}`);
      } else {
        alert(summary);
      }

    } catch (error) {
      console.error('💥 Error conectando a Google Sheets:', error);
      setConnectionStatus('error');
      alert(`❌ Error al conectar con Google Sheets:\n\n${error.message}\n\n🔧 Solución rápida:\n\n1️⃣ Ve a tu Google Sheets\n2️⃣ Clic en "Compartir" (botón azul arriba a la derecha)\n3️⃣ Cambiar a "Cualquier persona con el enlace"\n4️⃣ Permisos: "Visor"\n5️⃣ Copiar enlace y pegarlo aquí\n\n💡 El enlace debe verse así:\nhttps://docs.google.com/spreadsheets/d/TU_ID/edit`);
    }
    
    setLoading(false);
  };

  const connectToAppsScript = async () => {
    if (!googleSheetsUrl.trim()) {
      alert('Por favor ingresa la URL de Apps Script');
      return;
    }

    setLoading(true);
    setConnectionStatus('loading');
    
    try {
      const response = await fetch(googleSheetsUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const jsonData = await response.json();
      
      const loadedAgencies = [];
      const allKPIsSet = new Set();
      const allMonthsSet = new Set();
      const errors = [];
      const successes = [];

      Object.entries(jsonData).forEach(([sheetName, sheetData]) => {
        try {
          if (sheetData && Array.isArray(sheetData) && sheetData.length > 0 && 
              !sheetName.toLowerCase().includes('template') && 
              !sheetName.toLowerCase().includes('instruction') &&
              !sheetName.toLowerCase().includes('ejemplo') &&
              sheetName !== 'Sheet1' && sheetName !== 'Hoja1') {
            
            const processedData = processParsedData(sheetData, sheetName);
            loadedAgencies.push(processedData);
            
            processedData.kpis.forEach(kpi => allKPIsSet.add(kpi));
            processedData.months.forEach(month => allMonthsSet.add(month));
            
            successes.push(`✓ ${sheetName}: ${processedData.kpis.length} KPIs, ${processedData.months.length} meses`);
          }
        } catch (error) {
          errors.push(`${sheetName}: ${error.message}`);
        }
      });

      if (loadedAgencies.length === 0) {
        const allSheets = Object.keys(jsonData);
        throw new Error(`No se encontraron datos válidos en las hojas.\n\nHojas encontradas: ${allSheets.join(', ')}\n\nErrores: ${errors.join('; ')}\n\nVerifica que cada hoja tenga:\n- Una columna con "KPI" o "Indicador"\n- Columnas con nombres de meses\n- Datos en las filas`);
      }

      setAgencies(loadedAgencies);
      setAllKPIs(Array.from(allKPIsSet));
      setAllMonths(Array.from(allMonthsSet));
      setSelectedAgencies(loadedAgencies.map(a => a.name));
      setSelectedMonths(Array.from(allMonthsSet).slice(0, 6));
      
      setConnectionStatus('success');
      
      let message = `✅ ¡Conexión exitosa!\n\n📊 Agencias cargadas:\n${successes.join('\n')}`;
      
      if (errors.length > 0) {
        message += `\n\n⚠️ Hojas no procesadas:\n${errors.join('\n')}`;
      }
      
      alert(message);

    } catch (error) {
      console.error('Error:', error);
      setConnectionStatus('error');
      alert(`❌ Error: ${error.message}\n\nVerifica que:\n1. La URL de Apps Script sea correcta\n2. Esté desplegada como aplicación web\n3. Tenga permisos para "Cualquier persona"`);
    }
    
    setLoading(false);
  };

  const handlePasteData = (pastedData) => {
    if (pastedData.trim().length > 100) {
      console.log('Datos detectados, listos para procesar');
    }
  };

  const processPastedData = (agencyName) => {
    const textarea = document.querySelector('textarea');
    const pastedData = textarea.value;
    
    if (!pastedData.trim() || !agencyName.trim()) {
      alert('Por favor ingresa tanto los datos como el nombre de la agencia');
      return;
    }

    try {
      const lines = pastedData.trim().split('\n');
      const csvData = lines.map(line => line.split('\t')).map(row => row.join(','));
      const csvString = csvData.join('\n');
      
      const parsedData = Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });

      if (parsedData.data && parsedData.data.length > 0) {
        const processedData = processParsedData(parsedData.data, agencyName);
        
        setAgencies(prev => {
          const updated = [...prev.filter(a => a.name !== agencyName), processedData];
          return updated;
        });
        
        const allKPIsSet = new Set(allKPIs);
        const allMonthsSet = new Set(allMonths);
        processedData.kpis.forEach(kpi => allKPIsSet.add(kpi));
        processedData.months.forEach(month => allMonthsSet.add(month));
        setAllKPIs(Array.from(allKPIsSet));
        setAllMonths(Array.from(allMonthsSet));
        
        textarea.value = '';
        document.querySelector('input[placeholder="Nombre de la agencia"]').value = '';
        
        alert(`✅ Agencia "${agencyName}" agregada exitosamente!\n${processedData.kpis.length} KPIs detectados`);
      } else {
        throw new Error('No se pudieron procesar los datos pegados');
      }
    } catch (error) {
      alert(`❌ Error procesando datos: ${error.message}\n\nAsegúrate de copiar los datos con encabezados desde Google Sheets`);
    }
  };

  const handleFileUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return;

    setLoading(true);
    const newAgencies = [];
    const allKPIsSet = new Set();
    const allMonthsSet = new Set();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const agencyName = file.name.split('.')[0];
        
        try {
          let csvData;
          if (fileExtension === 'csv') {
            csvData = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target.result);
              reader.readAsText(file);
            });
          }
          
          const parsedData = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim()
          });

          if (parsedData.data && parsedData.data.length > 0) {
            const processedData = processParsedData(parsedData.data, agencyName);
            newAgencies.push(processedData);
            
            processedData.kpis.forEach(kpi => allKPIsSet.add(kpi));
            processedData.months.forEach(month => allMonthsSet.add(month));
          }
        } catch (error) {
          console.error(`Error procesando ${file.name}:`, error);
          alert(`Error procesando ${file.name}: ${error.message}`);
        }
      }

      if (newAgencies.length > 0) {
        setAgencies(newAgencies);
        const kpiArray = Array.from(allKPIsSet);
        const monthArray = Array.from(allMonthsSet);
        setAllKPIs(kpiArray);
        setAllMonths(monthArray);
        
        setSelectedAgencies(newAgencies.slice(0, 9).map(a => a.name));
        setSelectedMonths(monthArray.slice(0, 6));
      }
    } catch (error) {
      console.error('Error general:', error);
      alert('Error procesando archivos');
    }
    setLoading(false);
  }, []);

  const removeAgency = (agencyName) => {
    const updatedAgencies = agencies.filter(a => a.name !== agencyName);
    setAgencies(updatedAgencies);
    setSelectedAgencies(selectedAgencies.filter(name => name !== agencyName));
    
    const allKPIsSet = new Set();
    const allMonthsSet = new Set();
    updatedAgencies.forEach(agency => {
      agency.kpis.forEach(kpi => allKPIsSet.add(kpi));
      agency.months.forEach(month => allMonthsSet.add(month));
    });
    setAllKPIs(Array.from(allKPIsSet));
    setAllMonths(Array.from(allMonthsSet));
  };

  const generateAllKPIsData = () => {
    if (agencies.length === 0) return [];
    
    const allData = [];
    selectedAgencies.forEach(agencyName => {
      const agency = agencies.find(a => a.name === agencyName);
      selectedMonths.forEach(month => {
        allKPIs.forEach(kpi => {
          const value = agency?.monthlyData[kpi]?.[month] || 0;
          allData.push({
            agency: agencyName,
            month,
            kpi,
            value
          });
        });
      });
    });
    return allData;
  };

  const allKPIsData = generateAllKPIsData();

  const colors = [
    '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D', 
    '#059669', '#0891B2', '#2563EB', '#7C3AED'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-gray-50 via-amber-50 to-gray-50 rounded-2xl shadow-2xl border border-gray-200 p-8 mb-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-3">
              <BarChart3 className="text-red-500" size={40} />
              KPIs Seminuevos - Grupo Daytona
            </h1>
            <p className="text-gray-700 text-lg">Conecta tu Google Sheets y genera comparativas automáticas de tus agencias automotrices</p>
          </div>

          {/* Google Apps Script Connection */}
          <div className="mb-8">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Link className="text-red-600" size={20} />
                <h3 className="font-semibold text-gray-800">Opción 1: Conectar via Google Apps Script (Recomendada)</h3>
              </div>
              <div className="text-sm text-gray-700 space-y-2 mb-4">
                <p><strong>Paso 1:</strong> Ve a tu Google Sheets → Extensiones → Apps Script</p>
                <p><strong>Paso 2:</strong> Pega el siguiente código:</p>
                <div className="bg-gray-100 p-3 rounded text-xs font-mono overflow-x-auto">
{`function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var data = {};
  
  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = sheet.getName();
    var values = sheet.getDataRange().getValues();
    
    if (values.length > 0) {
      var headers = values[0];
      var rows = values.slice(1);
      
      data[sheetName] = [];
      
      for (var j = 0; j < rows.length; j++) {
        var obj = {};
        for (var k = 0; k < headers.length; k++) {
          obj[headers[k]] = rows[j][k];
        }
        data[sheetName].push(obj);
      }
    }
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`}
                </div>
                <p><strong>Paso 3:</strong> Guardar → Implementar → Nueva implementación → Tipo: Aplicación web</p>
                <p><strong>Paso 4:</strong> Ejecutar como: Yo, Acceso: Cualquier persona</p>
                <p><strong>Paso 5:</strong> ⚠️ IMPORTANTE: Después de implementar, debes AUTORIZAR permisos</p>
                <p><strong>Paso 6:</strong> Copia la URL generada y pégala aquí:</p>
                <p><strong>📋 Tus agencias:</strong> GWM Iztapalapa, GWM Morelos, Honda Cuajimalpa, Honda Interlomas, KIA Interlomas, KIA Iztapalapa, MG Cuajimalpa, MG Interlomas, MG Iztapalapa</p>
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://script.google.com/macros/s/TU_SCRIPT_ID/exec"
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <button
                  onClick={connectToAppsScript}
                  disabled={loading}
                  className="px-6 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg hover:from-red-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Link size={16} />
                      Conectar Apps Script
                    </>
                  )}
                </button>
              </div>

              {connectionStatus === 'success' && (
                <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-green-800 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Conectado exitosamente - {agencies.length} agencias cargadas
                </div>
              )}

              {connectionStatus === 'error' && (
                <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-red-800 text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  Error de conexión - Verifica la URL y permisos del documento
                </div>
              )}
            </div>

            <div className="bg-gradient-to-r from-gray-50 to-amber-50 border border-gray-300 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="text-red-500" size={20} />
                <h3 className="font-semibold text-gray-800">Opción 3: Exportar y Subir CSV</h3>
              </div>
              <div className="text-sm text-gray-700 space-y-1 mb-4">
                <p>• Ve a tu Google Sheets</p>
                <p>• Archivo → Descargar → Valores separados por comas (.csv)</p>
                <p>• Repite para cada hoja/agencia</p>
                <p>• Sube los archivos CSV aquí</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="text-red-500" size={20} />
                <h3 className="font-semibold text-gray-800">Opción 4: Copia y Pega Datos</h3>
              </div>
              <p className="text-sm text-gray-700 mb-3">Copia los datos directamente desde Google Sheets y pégalos aquí:</p>
              <div className="space-y-2">
                <textarea
                  placeholder="Pega aquí los datos de una agencia (incluye encabezados)..."
                  className="w-full h-32 px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                  onChange={(e) => handlePasteData(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Nombre de la agencia"
                  className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      processPastedData(e.target.value);
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Alternative Upload Section */}
          <div className="mb-8">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-red-300 border-dashed rounded-xl cursor-pointer bg-gradient-to-r from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 mb-3 text-red-500" />
                <p className="mb-2 text-sm text-red-600">
                  <span className="font-semibold">Clic para subir</span> archivos CSV de agencias
                </p>
                <p className="text-xs text-red-500">CSV - Múltiples archivos permitidos</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".csv"
                multiple
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </label>
          </div>

          {/* Loaded Agencies */}
          {agencies.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="text-red-500" size={20} />
                Agencias Cargadas ({agencies.length}/9)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agencies.map((agency) => (
                  <div key={agency.name} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 relative border-l-4 shadow-md" style={{borderLeftColor: colors[agencies.indexOf(agency) % colors.length]}}>
                    <button
                      onClick={() => removeAgency(agency.name)}
                      className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-full p-1"
                      title="Eliminar agencia"
                    >
                      <X size={16} />
                    </button>
                    <div className="flex items-center mb-2">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: colors[agencies.indexOf(agency) % colors.length] }}
                      ></div>
                      <h4 className="font-semibold text-gray-800 pr-6">{agency.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600">{agency.kpis.length} KPIs</p>
                    <p className="text-sm text-gray-600">{agency.months.length} meses</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Procesando datos...</p>
            </div>
          )}

          {agencies.length > 0 && (
            <div className="space-y-8">
              {/* Controls */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 border border-gray-200">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="text-red-500" size={24} />
                  Configuración de Análisis
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Building2 size={16} className="inline mr-1" />
                      Agencias ({selectedAgencies.length}/9)
                    </label>
                    <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-white">
                      <div className="mb-2 pb-2 border-b border-gray-200">
                        <button
                          onClick={() => setSelectedAgencies(agencies.map(a => a.name))}
                          className="text-xs text-blue-600 hover:text-blue-800 mr-2"
                        >
                          Seleccionar todas
                        </button>
                        <button
                          onClick={() => setSelectedAgencies([])}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Deseleccionar todas
                        </button>
                      </div>
                      {agencies.map((agency, index) => (
                        <label key={agency.name} className="flex items-center space-x-2 text-sm mb-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedAgencies.includes(agency.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (selectedAgencies.length < 9) {
                                  setSelectedAgencies([...selectedAgencies, agency.name]);
                                } else {
                                  alert('Máximo 9 agencias pueden ser seleccionadas para comparación');
                                }
                              } else {
                                setSelectedAgencies(selectedAgencies.filter(a => a !== agency.name));
                              }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: colors[index % colors.length] }}
                          ></div>
                          <span className="flex-1">{agency.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar size={16} className="inline mr-1" />
                      Meses ({selectedMonths.length})
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-white">
                      {allMonths.map(month => (
                        <label key={month} className="flex items-center space-x-2 text-sm mb-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={selectedMonths.includes(month)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMonths([...selectedMonths, month]);
                              } else {
                                setSelectedMonths(selectedMonths.filter(m => m !== month));
                              }
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="flex-1">{month}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Table - All KPIs */}
              {allKPIsData.length > 0 && (
                <div className="bg-gradient-to-r from-gray-50 via-amber-50 to-gray-50 rounded-xl shadow-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="text-red-500" size={24} />
                      Comparativa de KPIs por Agencia
                    </h3>
                    <div className="text-sm text-gray-600">
                      {selectedAgencies.length} de {agencies.length} agencias | {selectedMonths.length} meses | {allKPIs.length} KPIs
                    </div>
                  </div>
                  <div className="overflow-auto max-h-screen">
                    <style jsx>{`
                      .shadow-r {
                        box-shadow: 2px 0 4px rgba(0,0,0,0.1);
                      }
                    `}</style>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 top-0 bg-gray-50 z-20 shadow-r">KPI</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-32 top-0 bg-gray-50 z-20 shadow-r">Mes</th>
                          {selectedAgencies.map((agency, index) => (
                            <th key={agency} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky top-0 bg-gray-50 z-10" style={{backgroundColor: colors[index % colors.length] + '20'}}>
                              {agency}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {allKPIs.map(kpi => 
                          selectedMonths.map((month, monthIndex) => (
                            <tr key={`${kpi}-${month}`} className={monthIndex % 2 === 0 ? 'bg-white' : 'bg-amber-50'}>
                              <td className="px-4 py-4 text-sm font-medium text-red-600 sticky left-0 bg-inherit z-10 min-w-32 shadow-r">
                                {kpi}
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-800 font-medium sticky left-32 bg-inherit z-10 min-w-24 shadow-r">
                                {month}
                              </td>
                              {selectedAgencies.map((agencyName, agencyIndex) => {
                                const agency = agencies.find(a => a.name === agencyName);
                                const value = agency?.monthlyData[kpi]?.[month] || 0;
                                const isHighest = selectedAgencies.length > 1 && value > 0 && 
                                  value === Math.max(...selectedAgencies.map(an => {
                                    const ag = agencies.find(a => a.name === an);
                                    return ag?.monthlyData[kpi]?.[month] || 0;
                                  }));
                                
                                return (
                                  <td key={agencyName} className={`px-4 py-4 text-center text-sm font-semibold ${isHighest ? 'bg-green-100 text-green-800' : 'text-gray-900'}`}>
                                    {value.toLocaleString()}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-lg border border-red-200">
                      <h4 className="font-medium text-red-800 mb-2">Total de KPIs</h4>
                      <p className="text-2xl font-bold text-red-600">{allKPIs.length}</p>
                    </div>
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-lg border border-amber-200">
                      <h4 className="font-medium text-amber-800 mb-2">Agencias Analizadas</h4>
                      <p className="text-2xl font-bold text-amber-600">{selectedAgencies.length}</p>
                    </div>
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-lg border border-orange-200">
                      <h4 className="font-medium text-orange-800 mb-2">Períodos Analizados</h4>
                      <p className="text-2xl font-bold text-orange-600">{selectedMonths.length}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts Section */}
              {allKPIsData.length > 0 && (
                <div className="space-y-8">
                  {/* KPI Comparison by Agency */}
                  <div className="bg-gradient-to-r from-gray-50 via-amber-50 to-gray-50 rounded-xl shadow-lg p-6 border border-gray-200">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                      <TrendingUp className="text-red-500" size={24} />
                      Comparativa de KPIs por Agencia
                    </h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={(() => {
                            const chartData = [];
                            allKPIs.slice(0, 6).forEach(kpi => {
                              const kpiData = { kpi: kpi.substring(0, 25) + (kpi.length > 25 ? '...' : '') };
                              selectedAgencies.forEach(agencyName => {
                                const agency = agencies.find(a => a.name === agencyName);
                                const totalValue = selectedMonths.reduce((sum, month) => {
                                  return sum + (agency?.monthlyData[kpi]?.[month] || 0);
                                }, 0);
                                kpiData[agencyName] = totalValue;
                              });
                              chartData.push(kpiData);
                            });
                            return chartData;
                          })()}
                          margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="kpi" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {selectedAgencies.map((agency, index) => (
                            <Bar 
                              key={agency} 
                              dataKey={agency}
                              name={agency}
                              fill={colors[index % colors.length]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Monthly Trends */}
                  <div className="bg-gradient-to-r from-gray-50 via-amber-50 to-gray-50 rounded-xl shadow-lg p-6 border border-gray-200">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                      <TrendingUp className="text-red-500" size={24} />
                      Tendencias Mensuales por Agencia
                    </h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(() => {
                          const chartData = [];
                          selectedMonths.forEach(month => {
                            const monthData = { month };
                            selectedAgencies.forEach(agencyName => {
                              const agency = agencies.find(a => a.name === agencyName);
                              const monthTotal = allKPIs.reduce((sum, kpi) => {
                                return sum + (agency?.monthlyData[kpi]?.[month] || 0);
                              }, 0);
                              monthData[agencyName] = monthTotal;
                            });
                            chartData.push(monthData);
                          });
                          return chartData;
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {selectedAgencies.map((agency, index) => (
                            <Line 
                              key={agency}
                              type="monotone" 
                              dataKey={agency} 
                              stroke={colors[index % colors.length]}
                              strokeWidth={3}
                              dot={{ r: 6 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KPIAnalyzer;
