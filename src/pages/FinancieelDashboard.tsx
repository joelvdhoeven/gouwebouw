import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Calendar, Filter } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type TimeRange = '1day' | '7days' | '1month' | 'quarter' | '1year';
type ViewMode = 'total' | 'project' | 'employee';

interface FinancialData {
  totalRevenue: number;
  totalCosts: number;
  profit: number;
  profitMargin: number;
  hoursWorked: number;
  projectCount: number;
  revenueByMonth: Array<{ month: string; revenue: number; costs: number; profit: number }>;
  revenueByItem: Array<{ name: string; revenue: number; costs: number; profit: number }>;
  costBreakdown: Array<{ name: string; value: number }>;
}

interface Project {
  id: string;
  naam: string;
}

interface Employee {
  id: string;
  naam: string;
}

const FinancieelDashboard: React.FC = () => {
  const { hasPermission } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('1month');
  const [viewMode, setViewMode] = useState<ViewMode>('total');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalRevenue: 0,
    totalCosts: 0,
    profit: 0,
    profitMargin: 0,
    hoursWorked: 0,
    projectCount: 0,
    revenueByMonth: [],
    revenueByItem: [],
    costBreakdown: [],
  });

  useEffect(() => {
    loadProjectsAndEmployees();
  }, []);

  useEffect(() => {
    if (hasPermission('manage_settings')) {
      loadFinancialData();
    }
  }, [timeRange, viewMode, selectedProjectId, selectedEmployeeId, hasPermission]);

  const loadProjectsAndEmployees = async () => {
    try {
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, naam')
        .order('naam');

      const { data: employeesData } = await supabase
        .from('profiles')
        .select('id, naam')
        .order('naam');

      setProjects(projectsData || []);
      setEmployees(employeesData || []);
    } catch (error) {
      console.error('Error loading projects and employees:', error);
    }
  };

  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case '1day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '1year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    return { startDate, endDate };
  };

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Haal time registrations op
      let timeRegsQuery = supabase
        .from('time_registrations')
        .select('*')
        .gte('datum', startDateStr)
        .lte('datum', endDateStr);

      if (viewMode === 'project' && selectedProjectId) {
        timeRegsQuery = timeRegsQuery.eq('project_id', selectedProjectId);
      }

      if (viewMode === 'employee' && selectedEmployeeId) {
        timeRegsQuery = timeRegsQuery.eq('user_id', selectedEmployeeId);
      }

      const { data: timeRegs, error: timeRegsError } = await timeRegsQuery;

      // Haal inventory transactions op
      let inventoryTransQuery = supabase
        .from('inventory_transactions')
        .select('*')
        .eq('transaction_type', 'project_usage')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (viewMode === 'project' && selectedProjectId) {
        inventoryTransQuery = inventoryTransQuery.eq('project_id', selectedProjectId);
      }

      const { data: inventoryTrans, error: inventoryError } = await inventoryTransQuery;

      // Haal alle profiles op
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, naam, hourly_rate_purchase, hourly_rate_sale');

      // Haal alle projecten op
      const { data: allProjects } = await supabase
        .from('projects')
        .select('*');

      // Haal alle producten op
      const { data: allProducts } = await supabase
        .from('inventory_products')
        .select('id, name, purchase_price, sale_price');

      // Maak lookup maps
      const profilesMap = new Map(allProfiles?.map(p => [p.id, p]) || []);
      const projectsMap = new Map(allProjects?.map(p => [p.id, p]) || []);
      const productsMap = new Map(allProducts?.map(p => [p.id, p]) || []);

      console.log('=== FINANCIAL DASHBOARD DEBUG ===');
      console.log('Date range:', startDateStr, 'to', endDateStr);
      console.log('Time registrations:', timeRegs);
      console.log('Time regs error:', timeRegsError);
      console.log('Profiles:', allProfiles);
      console.log('Inventory transactions:', inventoryTrans);
      console.log('Inventory error:', inventoryError);
      console.log('Products:', allProducts);

      let totalRevenue = 0;
      let totalCosts = 0;
      let totalHours = 0;

      timeRegs?.forEach((reg: any) => {
        const profile = profilesMap.get(reg.user_id);
        const saleRate = parseFloat(profile?.hourly_rate_sale || 0);
        const purchaseRate = parseFloat(profile?.hourly_rate_purchase || 0);
        const hours = parseFloat(reg.aantal_uren || 0);
        totalRevenue += hours * saleRate;
        totalCosts += hours * purchaseRate;
        totalHours += hours;
      });

      let materialRevenue = 0;
      let materialCost = 0;

      inventoryTrans?.forEach((trans: any) => {
        const product = productsMap.get(trans.product_id);
        const salePricePerUnit = parseFloat(product?.sale_price || 0);
        const purchasePricePerUnit = parseFloat(product?.purchase_price || 0);
        const quantity = parseFloat(trans.quantity || 0);

        materialRevenue += salePricePerUnit * quantity;
        materialCost += purchasePricePerUnit * quantity;
      });

      console.log('Total hours:', totalHours);
      console.log('Total revenue from hours:', totalRevenue);
      console.log('Total revenue from materials:', materialRevenue);
      console.log('Total revenue:', totalRevenue + materialRevenue);
      console.log('Total costs:', totalCosts + materialCost);

      totalRevenue += materialRevenue;
      totalCosts += materialCost;

      const profit = totalRevenue - totalCosts;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      const revenueByMonth = calculateRevenueByMonth(timeRegs || [], inventoryTrans || [], profilesMap, productsMap, startDate, endDate);

      let revenueByItem: Array<{ name: string; revenue: number; costs: number; profit: number }> = [];

      if (viewMode === 'total') {
        if (selectedProjectId) {
          revenueByItem = [];
        } else {
          revenueByItem = calculateRevenueByProject(timeRegs || [], inventoryTrans || [], profilesMap, productsMap, allProjects || []);
        }
      } else if (viewMode === 'project') {
        revenueByItem = calculateRevenueByProject(timeRegs || [], inventoryTrans || [], profilesMap, productsMap, allProjects || []);
      } else if (viewMode === 'employee') {
        revenueByItem = calculateRevenueByEmployee(timeRegs || [], profilesMap);
      }

      const laborCost = timeRegs?.reduce((sum: number, reg: any) => {
        const profile = profilesMap.get(reg.user_id);
        const hours = parseFloat(reg.aantal_uren || 0);
        const purchaseRate = parseFloat(profile?.hourly_rate_purchase || 0);
        return sum + (hours * purchaseRate);
      }, 0) || 0;

      const costBreakdown = [
        { name: 'Personeel', value: laborCost },
        { name: 'Materiaal', value: materialCost },
      ].filter(item => item.value > 0);

      setFinancialData({
        totalRevenue,
        totalCosts,
        profit,
        profitMargin,
        hoursWorked: totalHours,
        projectCount: allProjects?.length || 0,
        revenueByMonth,
        revenueByItem: revenueByItem.slice(0, 10),
        costBreakdown,
      });
    } catch (error) {
      console.error('Error loading financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRevenueByMonth = (timeRegs: any[], inventoryTrans: any[], profilesMap: Map<string, any>, productsMap: Map<string, any>, startDate: Date, endDate: Date) => {
    const monthsMap = new Map<string, { revenue: number; costs: number }>();

    timeRegs.forEach((reg: any) => {
      const date = new Date(reg.datum);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const profile = profilesMap.get(reg.user_id);
      const saleRate = parseFloat(profile?.hourly_rate_sale || 0);
      const purchaseRate = parseFloat(profile?.hourly_rate_purchase || 0);
      const hours = parseFloat(reg.aantal_uren || 0);
      const revenue = hours * saleRate;
      const costs = hours * purchaseRate;

      if (monthsMap.has(monthKey)) {
        const existing = monthsMap.get(monthKey)!;
        monthsMap.set(monthKey, {
          revenue: existing.revenue + revenue,
          costs: existing.costs + costs,
        });
      } else {
        monthsMap.set(monthKey, { revenue, costs });
      }
    });

    inventoryTrans.forEach((trans: any) => {
      const date = new Date(trans.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const product = productsMap.get(trans.product_id);
      const salePrice = parseFloat(product?.sale_price || 0) * parseFloat(trans.quantity || 0);
      const purchasePrice = parseFloat(product?.purchase_price || 0) * parseFloat(trans.quantity || 0);

      if (monthsMap.has(monthKey)) {
        const existing = monthsMap.get(monthKey)!;
        monthsMap.set(monthKey, {
          revenue: existing.revenue + salePrice,
          costs: existing.costs + purchasePrice,
        });
      } else {
        monthsMap.set(monthKey, { revenue: salePrice, costs: purchasePrice });
      }
    });

    const monthNames = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

    return Array.from(monthsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [year, month] = key.split('-');
        return {
          month: `${monthNames[parseInt(month) - 1]} '${year.slice(2)}`,
          revenue: Math.round(data.revenue),
          costs: Math.round(data.costs),
          profit: Math.round(data.revenue - data.costs),
        };
      });
  };

  const calculateRevenueByProject = (timeRegs: any[], inventoryTrans: any[], profilesMap: Map<string, any>, productsMap: Map<string, any>, projects: any[]) => {
    const projectMap = new Map<string, { revenue: number; costs: number }>();

    timeRegs.forEach((reg: any) => {
      const profile = profilesMap.get(reg.user_id);
      const saleRate = parseFloat(profile?.hourly_rate_sale || 0);
      const purchaseRate = parseFloat(profile?.hourly_rate_purchase || 0);
      const hours = parseFloat(reg.aantal_uren || 0);
      const revenue = hours * saleRate;
      const costs = hours * purchaseRate;

      if (projectMap.has(reg.project_id)) {
        const existing = projectMap.get(reg.project_id)!;
        projectMap.set(reg.project_id, {
          revenue: existing.revenue + revenue,
          costs: existing.costs + costs,
        });
      } else {
        projectMap.set(reg.project_id, { revenue, costs });
      }
    });

    inventoryTrans.forEach((trans: any) => {
      if (!trans.project_id) return;

      const product = productsMap.get(trans.product_id);
      const salePrice = parseFloat(product?.sale_price || 0) * parseFloat(trans.quantity || 0);
      const purchasePrice = parseFloat(product?.purchase_price || 0) * parseFloat(trans.quantity || 0);

      if (projectMap.has(trans.project_id)) {
        const existing = projectMap.get(trans.project_id)!;
        projectMap.set(trans.project_id, {
          revenue: existing.revenue + salePrice,
          costs: existing.costs + purchasePrice,
        });
      } else {
        projectMap.set(trans.project_id, { revenue: salePrice, costs: purchasePrice });
      }
    });

    return Array.from(projectMap.entries())
      .map(([projectId, data]) => {
        const project = projects.find(p => p.id === projectId);
        return {
          name: project?.naam || 'Onbekend',
          revenue: Math.round(data.revenue),
          costs: Math.round(data.costs),
          profit: Math.round(data.revenue - data.costs),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  };

  const calculateRevenueByEmployee = (timeRegs: any[], profilesMap: Map<string, any>) => {
    const employeeMap = new Map<string, { revenue: number; costs: number }>();

    timeRegs.forEach((reg: any) => {
      const profile = profilesMap.get(reg.user_id);
      const saleRate = parseFloat(profile?.hourly_rate_sale || 0);
      const purchaseRate = parseFloat(profile?.hourly_rate_purchase || 0);
      const hours = parseFloat(reg.aantal_uren || 0);
      const revenue = hours * saleRate;
      const costs = hours * purchaseRate;

      if (employeeMap.has(reg.user_id)) {
        const existing = employeeMap.get(reg.user_id)!;
        employeeMap.set(reg.user_id, {
          revenue: existing.revenue + revenue,
          costs: existing.costs + costs,
        });
      } else {
        employeeMap.set(reg.user_id, { revenue, costs });
      }
    });

    return Array.from(employeeMap.entries())
      .map(([userId, data]) => {
        const profile = profilesMap.get(userId);
        return {
          name: profile?.naam || 'Onbekend',
          revenue: Math.round(data.revenue),
          costs: Math.round(data.costs),
          profit: Math.round(data.revenue - data.costs),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const timeRangeOptions = [
    { value: '1day', label: '1 Dag' },
    { value: '7days', label: '7 Dagen' },
    { value: '1month', label: '1 Maand' },
    { value: 'quarter', label: 'Kwartaal' },
    { value: '1year', label: '1 Jaar' },
  ];

  const COLORS = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FEE2E2', '#7F1D1D', '#991B1B', '#B91C1C'];

  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode);
    setSelectedProjectId('');
    setSelectedEmployeeId('');
  };

  if (!hasPermission('manage_settings')) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Geen toegang tot financieel dashboard</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financieel Dashboard</h1>
          <p className="text-gray-600">Inzicht in omzet, kosten en winst</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-red-600" />
            <select
              value={viewMode}
              onChange={(e) => handleViewModeChange(e.target.value as ViewMode)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="total">Totale Omzet</option>
              <option value="project">Per Project</option>
              <option value="employee">Per Medewerker</option>
            </select>
          </div>

          {viewMode === 'project' && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Alle Projecten</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.naam}
                </option>
              ))}
            </select>
          )}

          {viewMode === 'employee' && (
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Alle Medewerkers</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.naam}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-red-600" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Omzet</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(financialData.totalRevenue)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingUp size={24} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Totale Kosten</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(financialData.totalCosts)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingUp size={24} className="text-red-600" style={{ transform: 'rotate(180deg)' }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Winst</p>
              <p className={`text-2xl font-bold mt-1 ${financialData.profit >= 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {formatCurrency(financialData.profit)}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${financialData.profit >= 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <DollarSign size={24} className={financialData.profit >= 0 ? 'text-red-600' : 'text-gray-600'} />
            </div>
          </div>
          <div className="mt-2">
            <span className={`text-sm font-medium ${financialData.profitMargin >= 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {financialData.profitMargin.toFixed(1)}% marge
            </span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Gewerkte Uren</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {financialData.hoursWorked.toFixed(1)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingUp size={24} className="text-red-600" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-sm text-gray-600">
              {financialData.projectCount} projecten
            </span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 - Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Total Costs vs Profit Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Totale Kosten vs Winst</h3>
          {financialData.totalCosts > 0 || financialData.profit > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Totale Kosten', value: Math.max(0, financialData.totalCosts) },
                    { name: 'Winst', value: Math.max(0, financialData.profit) }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }) => `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#F87171" />
                  <Cell fill="#7F1D1D" />
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Geen data beschikbaar
            </div>
          )}
        </div>

        {/* Worked Hours by Employee Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gewerkte Uren per Medewerker</h3>
          {financialData.revenueByItem.length > 0 && viewMode === 'employee' ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={financialData.revenueByItem.slice(0, 8).map(item => ({
                    name: item.name,
                    value: item.revenue / (financialData.totalRevenue / financialData.hoursWorked || 1)
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}u`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {financialData.revenueByItem.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)} uur`} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              {viewMode === 'employee' ? 'Geen data beschikbaar' : 'Selecteer "Per Medewerker" om gewerkte uren te zien'}
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue/Cost Line Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Omzet vs Kosten per Maand</h3>
          {financialData.revenueByMonth.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={financialData.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#DC2626" strokeWidth={2} name="Omzet" />
                <Line type="monotone" dataKey="costs" stroke="#F87171" strokeWidth={2} name="Kosten" />
                <Line type="monotone" dataKey="profit" stroke="#7F1D1D" strokeWidth={2} name="Winst" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Geen data beschikbaar
            </div>
          )}
        </div>

        {/* Cost Breakdown Pie Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Kosten Verdeling (Personeel/Materiaal)</h3>
          {financialData.costBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={financialData.costBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent, value }) => `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {financialData.costBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-gray-500">
              Geen data beschikbaar
            </div>
          )}
        </div>
      </div>

      {/* Revenue by Project/Employee */}
      {viewMode !== 'total' && financialData.revenueByItem.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {viewMode === 'project'
              ? (selectedProjectId ? 'Project Details' : 'Omzet per Project (Top 10)')
              : (selectedEmployeeId ? 'Medewerker Details' : 'Omzet per Medewerker (Top 10)')
            }
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={financialData.revenueByItem}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="revenue" fill="#DC2626" name="Omzet" />
              <Bar dataKey="costs" fill="#F87171" name="Kosten" />
              <Bar dataKey="profit" fill="#7F1D1D" name="Winst" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default FinancieelDashboard;
