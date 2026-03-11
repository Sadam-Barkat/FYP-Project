"use client";

import { useEffect, useState } from "react";
import {
  Pill,
  AlertCircle,
  CheckCircle2,
  PackageX,
} from "lucide-react";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface StockLevelByCategory {
  category: string;
  stock_value: number;
  percentage: number;
}

interface ExpiryTrendPoint {
  month: string;
  expiring_count: number;
}

interface LowStockMedicine {
  medicine_name: string;
  category: string;
  current_stock: number;
  expiry_date: string | null;
}

interface PharmacyOverview {
  total_medicines: number;
  low_stock_items: number;
  expiring_soon: number;
  total_stock_value: number;
  stock_level_by_category: StockLevelByCategory[];
  expiry_trend: ExpiryTrendPoint[];
  low_stock_medicines: LowStockMedicine[];
  selected_date: string;
}

export default function PharmacyPage() {
  const [overview, setOverview] = useState<PharmacyOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchOverview = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/pharmacy-overview`);
        if (!res.ok) {
          throw new Error("Failed to load pharmacy overview");
        }
        const data: PharmacyOverview = await res.json();
        if (isMounted) {
          setOverview(data);
        }
      } catch {
        if (isMounted) {
          setError("Failed to load data");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 30000); // refresh every 30s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const totalMedications = overview?.total_medicines ?? 0;
  const lowStockItems = overview?.low_stock_items ?? 0;
  const expiringSoon = overview?.expiring_soon ?? 0;
  const totalStockValue = overview?.total_stock_value ?? 0;

  const lowStockList: LowStockMedicine[] = overview?.low_stock_medicines ?? [];

  // Derive "healthy stock" percentage: portion of meds not in low_stock_items
  const healthyPercentage =
    totalMedications > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((totalMedications - lowStockItems) / totalMedications) * 100
          )
        )
      : 0;

  // Derive "critical" items: very low current_stock (<= 3)
  const criticalItems = lowStockList.filter(
    (m) => m.current_stock <= 3
  ).length;

  const stockData = lowStockList.map((m, index) => {
    const status =
      m.current_stock <= 3
        ? "Critical"
        : m.current_stock <= 10
        ? "Low"
        : "Good";
    return {
      id: `MED-${String(index + 1).padStart(2, "0")}`,
      name: m.medicine_name,
      quantity: m.current_stock,
      unit: "Boxes",
      status,
    };
  });

  const trendData =
    overview?.expiry_trend.map((p) => ({
      month: p.month,
      dispensed: p.expiring_count,
      received: 0, // no separate "received" metric in backend; keep design
    })) ?? [];

  return (
    <div id="dashboard-content" className="w-full max-w-7xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-semibold text-[#0066cc]">
          Pharmacy Overview
        </h2>
        {isLoading && (
          <p className="mt-2 text-sm text-gray-500">
            Loading pharmacy data...
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-500">
            {error}
          </p>
        )}
      </div>

      {/* Top Row Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#3b82f6] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <Pill className="absolute top-4 left-4 text-[#3b82f6]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Total Medications</p>
            <h3 className="text-4xl font-bold text-[#3b82f6] mt-3">
              {totalMedications.toLocaleString()}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">In inventory</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#22c55e] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <CheckCircle2 className="absolute top-4 left-4 text-[#22c55e]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Healthy Stock</p>
            <h3 className="text-4xl font-bold text-[#22c55e] mt-3">
              {Math.round(healthyPercentage)}%
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4">Above reorder level</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#f97316] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <PackageX className="absolute top-4 left-4 text-[#f97316]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Low Stock Items</p>
            <h3 className="text-4xl font-bold text-[#f97316] mt-3">
              {lowStockItems}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-4 text-[#f97316] font-medium">
            Needs reorder
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-[#ef4444] p-6 relative flex flex-col items-center justify-between min-h-[160px]">
          <AlertCircle className="absolute top-4 left-4 text-[#ef4444]" size={24} />
          <div className="mt-4 text-center">
            <p className="text-gray-800 font-medium text-sm">Critical Shortage</p>
            <h3 className="text-4xl font-bold text-[#ef4444] mt-3">
              {criticalItems}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mt-1 text-red-500 font-medium">
            Action required immediately
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Expiring soon: {expiringSoon}, Stock value: PKR{" "}
            {Math.round(totalStockValue).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* Table Area */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 overflow-hidden flex flex-col">
          <h3 className="font-semibold text-gray-800 mb-4">
            Critical & Low Stock Inventory
          </h3>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium px-2">Medication ID</th>
                  <th className="pb-3 font-medium px-2">Name</th>
                  <th className="pb-3 font-medium px-2 text-right">Quantity</th>
                  <th className="pb-3 font-medium px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {stockData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-sm text-gray-400"
                    >
                      {isLoading ? "Loading inventory..." : "No low stock items"}
                    </td>
                  </tr>
                ) : (
                  stockData.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-2 text-sm text-gray-700">
                        {item.id}
                      </td>
                      <td className="py-3 px-2 text-sm font-medium text-gray-900">
                        {item.name}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-700 text-right">
                        {item.quantity}{" "}
                        <span className="text-xs text-gray-500">
                          {item.unit}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium inline-block min-w-[70px] ${
                            item.status === "Good"
                              ? "bg-green-100 text-green-700"
                              : item.status === "Low"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700 animate-pulse"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Area */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
          <h3 className="font-semibold text-gray-800 mb-4">
            Dispensed vs Received (Monthly)
          </h3>
          <div className="flex-1 w-full">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                {isLoading ? "Loading chart..." : "No data available"}
              </div>
            ) : (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={0}
              >
                <AreaChart
                  data={trendData}
                  margin={{ top: 10, right: 10, bottom: 0, left: -20 }}
                >
                  <defs>
                    <linearGradient
                      id="colorDispensed"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#f97316"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor="#f97316"
                        stopOpacity={0}
                      />
                    </linearGradient>
                    <linearGradient
                      id="colorReceived"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#3b82f6"
                        stopOpacity={0.8}
                      />
                      <stop
                        offset="95%"
                        stopColor="#3b82f6"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e5e7eb"
                  />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow:
                        "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px" }} />
                  <Area
                    type="monotone"
                    dataKey="dispensed"
                    name="Dispensed"
                    stroke="#f97316"
                    fillOpacity={1}
                    fill="url(#colorDispensed)"
                  />
                  <Area
                    type="monotone"
                    dataKey="received"
                    name="Received"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorReceived)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}