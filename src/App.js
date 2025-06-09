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
  const [connectionStatus, setConnectionStatus] = useState(''); // 'success', 'error', 'loading'

  const extractSpreadsheetId = (url) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  const fetchGoogleSheet = async (spreadsheetId, sheetName) => {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gid=0/export?format=csv&gid=${sheetName}`;
    
    try {
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Error al cargar ${sheetName}: ${response.status}`);
      }
      const csvText = await response.text();
      return csvText;
    } catch (error) {
      // Intentar con URL alternativa
      const alternativeUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&sheet=${encodeURIComponent(sheetName)}`;
      try {
        const response = await fetch(alternativeUrl);
        if (!response.ok) {
          throw new Error(`Error al cargar ${sheetName}: ${response.status}`);
        }
        const csvText = await response.text();
        return csvText;
      } catch (secondError) {
        throw new Error(`No se pudo cargar la hoja "${sheetName}". Verifica que el documento sea público.`);
      }
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

    // Identificar columnas de meses (más flexible)
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
      alert('URL inválida. Asegúrate de usar una URL válida de Google Sheets');
      return;
    }

    setLoading(true);
    setConnectionStatus('loading');
    
    try {
      // Primero, intentamos obtener información sobre las hojas
      const metadataUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`;
      
      // Lista de nombres de agencias esperados (puedes personalizar esto)
      const expectedAgencies = [
        'Mazatlán', 'Culiacán', 'Los Mochis', 'Hermosillo', 
        'Tijuana', 'Mexicali', 'La Paz', 'Los Cabos', 'Ensenada'
      ];

      const loadedAgencies = [];
      const allKPIsSet = new Set();
      const allMonthsSet = new Set();
      const errors = [];

      // Intentar cargar cada hoja
      for (const agencyName of expectedAgencies) {
        try {
          const csvData = await fetchGoogleSheet(spreadsheetId, agencyName);
          
          const parsedData = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim()
          });

          if (parsedData.data && parsedData.data.length > 0) {
            const processedData = processParsedData(parsedData.data, agencyName);
            loadedAgencies.push(processedData);
            
            processedData.kpis.forEach(kpi => allKPIsSet.add(kpi));
            processedData.months.forEach(month => allMonthsSet.add(month));
          }
        } catch (error) {
          errors.push(`${agencyName}: ${error.message}`);
        }
      }

      if (loadedAgencies.length === 0) {
        throw new Error('No se pudo cargar ninguna hoja. Errores:\n' + errors.join('\n'));
      }

      setAgencies(loadedAgencies);
      const kpiArray = Array.from(allKPIsSet);
      const monthArray = Array.from(allMonthsSet);
      setAllKPIs(kpiArray);
      setAllMonths(monthArray);
      
      // Seleccionar valores por defecto
      setSelectedAgencies(loadedAgencies.map(a => a.name));
      setSelectedMonths(monthArray.slice(0, 6));
      
      setConnectionStatus('success');
      
      if (errors.length > 0) {
        alert(`Se cargaron ${loadedAgencies.length} agencias exitosamente.\n\nAdvertencias:\n${errors.join('\n')}`);
      }

    } catch (error) {
      console.error('Error conectando a Google Sheets:', error);
      setConnectionStatus('error');
      alert(`Error al conectar con Google Sheets: ${error.message}\n\nAsegúrate de que:\n1. El documento sea público (Anyone with the link can view)\n2. La URL sea correcta\n3. Las hojas tengan los nombres de las agencias`);
    }
    
    setLoading(false);
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
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#e74c3c', 
    '#9b59b6', '#1abc9c', '#f39c12', '#34495e'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="text-center mb-8">
            {/* Logo Section */}
            <div className="mb-6">
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-8 mb-4 hover:border-blue-400 transition-colors">
                <div className="flex flex-col items-center">
                  <img 
                    id="company-logo" 
                    src="" 
                    alt="Logo de la empresa" 
                    className="max-h-16 mb-2 hidden"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  <div id="logo-placeholder" className="flex flex-col items-center">
                    <Building2 className="text-gray-400 mb-2" size={32} />
                    <p className="text-sm text-gray-500 mb-2">Haz clic para subir el logo de tu empresa</p>
                    <input
                      type="file"
                      accept="image/*"
                      className="text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const logo = document.getElementById('company-logo');
                            const placeholder = document.getElementById('logo-placeholder');
                            logo.src = event.target.result;
                            logo.classList.remove('hidden');
                            logo.style.display = 'block';
                            placeholder.style.display = 'none';
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <h1 className="text-4xl font-bold text-gray-800 mb-4 flex items-center justify-center gap-3">
              <BarChart3 className="text-blue-600" size={40} />
              KPIs Seminuevos - Grupo Daytona
            </h1>
            <p className="text-gray-600 text-lg">Conecta tu Google Sheets y genera comparativas automáticas de las 9 agencias</p>
          </div>

          {/* Google Sheets Connection */}
          <div className="mb-8">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Link className="text-green-600" size={20} />
                <h3 className="font-semibold text-green-800">Conectar con Google Sheets</h3>
              </div>
              <ul className="text-sm text-green-700 space-y-1 mb-4">
                <li>• Asegúrate de que tu Google Sheets sea público (Anyone with the link can view)</li>
                <li>• Cada hoja debe tener el nombre de la agencia (Mazatlán, Culiacán, Los Mochis, etc.)</li>
                <li>• Cada hoja debe tener una columna con "KPI" y columnas para cada mes</li>
                <li>• Copia y pega la URL completa de tu Google Sheets</li>
              </ul>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/tu-documento-id/edit..."
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={connectToGoogleSheets}
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Link size={16} />
                      Conectar
                    </>
                  )}
                </button>
              </div>

              {connectionStatus === 'success' && (
                <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-green-800 text-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
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
          </div>

          {/* Alternative Upload Section */}
          <div className="mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="text-blue-600" size={20} />
                <h3 className="font-semibold text-blue-800">Alternativa: Subir Archivos CSV</h3>
              </div>
              <p className="text-sm text-blue-700 mb-4">
                Si prefieres, puedes exportar cada hoja como CSV y subirlas manualmente
              </p>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 mb-3 text-blue-500" />
                <p className="mb-2 text-sm text-blue-600">
                  <span className="font-semibold">Clic para subir</span> archivos CSV de agencias
                </p>
                <p className="text-xs text-blue-500">CSV - Múltiples archivos permitidos</p>
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
                <Building2 className="text-blue-600" size={20} />
                Agencias Cargadas ({agencies.length}/9)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agencies.map((agency) => (
                  <div key={agency.name} className="bg-gray-50 rounded-lg p-4 relative border-l-4" style={{borderLeftColor: colors[agencies.indexOf(agency) % colors.length]}}>
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
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileSpreadsheet className="text-blue-600" size={24} />
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
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <FileSpreadsheet className="text-blue-600" size={24} />
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
                            <tr key={`${kpi}-${month}`} className={monthIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-4 text-sm font-medium text-blue-600 sticky left-0 bg-inherit z-10 min-w-32 shadow-r">
                                {kpi}
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-700 font-medium sticky left-32 bg-inherit z-10 min-w-24 shadow-r">
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
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">Total de KPIs</h4>
                      <p className="text-2xl font-bold text-blue-600">{allKPIs.length}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-800 mb-2">Agencias Analizadas</h4>
                      <p className="text-2xl font-bold text-green-600">{selectedAgencies.length}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h4 className="font-medium text-purple-800 mb-2">Períodos Analizados</h4>
                      <p className="text-2xl font-bold text-purple-600">{selectedMonths.length}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Charts Section */}
              {allKPIsData.length > 0 && (
                <div className="space-y-8">
                  {/* KPI Comparison by Agency */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                      <TrendingUp className="text-blue-600" size={24} />
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
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                      <TrendingUp className="text-green-600" size={24} />
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

                  {/* Top Performing KPIs */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                      <BarChart3 className="text-purple-600" size={24} />
                      KPIs con Mejor Rendimiento
                    </h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                          const kpiTotals = {};
                          allKPIs.forEach(kpi => {
                            kpiTotals[kpi] = 0;
                            selectedAgencies.forEach(agencyName => {
                              const agency = agencies.find(a => a.name === agencyName);
                              selectedMonths.forEach(month => {
                                kpiTotals[kpi] += agency?.monthlyData[kpi]?.[month] || 0;
                              });
                            });
                          });
                          
                          return Object.entries(kpiTotals)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map(([kpi, total]) => ({
                              kpi: kpi.substring(0, 25) + (kpi.length > 25 ? '...' : ''),
                              total: total
                            }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="kpi" angle={-45} textAnchor="end" height={100} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="total" fill="#8b5cf6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Performance Metrics Summary */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                    <h3 className="text-xl font-semibold mb-6 text-gray-800">Resumen de Rendimiento - {selectedAgencies.length} Agencias</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedAgencies.map((agencyName, index) => {
                        const agency = agencies.find(a => a.name === agencyName);
                        const totalPerformance = allKPIs.reduce((sum, kpi) => {
                          return sum + selectedMonths.reduce((monthSum, month) => {
                            return monthSum + (agency?.monthlyData[kpi]?.[month] || 0);
                          }, 0);
                        }, 0);
                        
                        const allTotals = selectedAgencies.map(an => {
                          const ag = agencies.find(a => a.name === an);
                          return allKPIs.reduce((sum, kpi) => {
                            return sum + selectedMonths.reduce((monthSum, month) => {
                              return monthSum + (ag?.monthlyData[kpi]?.[month] || 0);
                            }, 0);
                          }, 0);
                        });
                        const sortedTotals = [...allTotals].sort((a, b) => b - a);
                        const ranking = sortedTotals.indexOf(totalPerformance) + 1;
                        
                        return (
                          <div key={agencyName} className="bg-white rounded-lg p-4 shadow-md relative">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <div 
                                  className="w-4 h-4 rounded-full mr-2" 
                                  style={{ backgroundColor: colors[index % colors.length] }}
                                ></div>
                                <h4 className="font-semibold text-gray-800 text-sm">{agencyName}</h4>
                              </div>
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                #{ranking}
                              </span>
                            </div>
                            <p className="text-xl font-bold text-gray-700 mb-1">
                              {totalPerformance.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">Total acumulado</p>
                          </div>
                        );
                      })}
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
