"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Copy,
    Search,
    Filter,
    RotateCcw,
    Package,
    Clock,
    CheckCircle,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Square,
    CheckSquare
} from 'lucide-react';

// Import our custom modules
import {
    SCAN_TYPE_OPTIONS,
    ITEMS_PER_PAGE_OPTIONS,
    DEFAULT_ITEMS_PER_PAGE,
    DEFAULT_PAGE,
    PAGINATION_SHOW_PAGES,
    getStatusColor
} from "@/lib/constants";
import {
    calculateStoppedDays,
    translateScanType,
    getScanTypeColor,
    copyToClipboard,
    validateDates,
    getPageNumbers,
    detectStoredToken
} from "@/utils/utils";
import {
    createApiService,
    type BillData,
    type BillWithStatus,
    type BillWithTerminalCode
} from "@/api-client/apiService";

function Page(props: any) {
    const router = useRouter();

    // Core state
    const [authToken, setAuthToken] = useState<string>('');
    const [startTime, setStartTime] = useState<string>((new Date()).toISOString().split('T')[0]);
    const [endTime, setEndTime] = useState<string>((new Date()).toISOString().split('T')[0]);
    const [dateError, setDateError] = useState<string>('');

    // Data state
    const [allBills, setAllBills] = useState<BillData[]>([]);
    const [allBillsWithStatus, setAllBillsWithStatus] = useState<BillWithStatus[]>([]);
    const [billsWithTerminalCode, setBillsWithTerminalCode] = useState<BillWithTerminalCode[]>([]);
    const [filteredBills, setFilteredBills] = useState<BillWithTerminalCode[]>([]);

    // Loading states
    const [loading, setLoading] = useState<boolean>(false);
    const [loadingTerminalCodes, setLoadingTerminalCodes] = useState<boolean>(false);
    const [filterLoading, setFilterLoading] = useState<boolean>(false);

    // UI states
    const [copiedBill, setCopiedBill] = useState<string>('');

    // Filter states
    const [selectedScanTypes, setSelectedScanTypes] = useState<string[]>([]);
    const [stoppedDays, setStoppedDays] = useState<number>(0);
    const [availableTerminalPrefixes, setAvailableTerminalPrefixes] = useState<string[]>([]);
    const [selectedTerminalPrefixes, setSelectedTerminalPrefixes] = useState<string[]>([]);

    // Pagination states
    const [currentPage, setCurrentPage] = useState<number>(DEFAULT_PAGE);
    const [itemsPerPage, setItemsPerPage] = useState<number>(DEFAULT_ITEMS_PER_PAGE);

    // Pagination calculations
    const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentBills = filteredBills.slice(startIndex, endIndex);

    // Token validation effect
    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');
        if (!ylToken || ylToken === "" || ylToken === null) {
            router.push('/');
            return;
        }
        setAuthToken(ylToken);
    }, [router]);

    // Auto-detect token from storage
    useEffect(() => {
        const token = detectStoredToken();
        if (token) {
            setAuthToken(token);
        }

        // Listen for storage changes
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key && e.newValue && e.key.toLowerCase().includes('token')) {
                console.log(`Token updated in storage: ${e.key}`);
                setAuthToken(e.newValue);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(DEFAULT_PAGE);
    }, [filteredBills, itemsPerPage]);

    // Date handlers
    const handleStartDateChange = (value: string) => {
        setStartTime(value);
        const validation = validateDates(value, endTime);
        setDateError(validation.error);
    };

    const handleEndDateChange = (value: string) => {
        setEndTime(value);
        const validation = validateDates(startTime, value);
        setDateError(validation.error);
    };

    // Main data fetching function - optimized
    const getSumData = async () => {
        const validation = validateDates(startTime, endTime);
        if (!validation.isValid) {
            setDateError(validation.error);
            return;
        }

        setLoading(true);
        setLoadingTerminalCodes(true);

        try {
            const apiService = createApiService(authToken);
            const data = await apiService.getAllBillsData(startTime, endTime);

            // Set all data
            setAllBills(data.allBills);
            setAllBillsWithStatus(data.billsWithStatus);
            setBillsWithTerminalCode(data.billsWithTerminalCodes);

            // Extract unique terminal prefixes
            const prefixes = Array.from(new Set(
                data.billsWithTerminalCodes
                    .map(bill => bill.terminalPrefix)
                    .filter(prefix => prefix && prefix.length > 0)
            )).sort();

            setAvailableTerminalPrefixes(prefixes);
            setSelectedTerminalPrefixes(prefixes);

        } catch (error) {
            console.error('Error fetching data:', error);
            // Reset states on error
            setAllBills([]);
            setAllBillsWithStatus([]);
            setBillsWithTerminalCode([]);
            setAvailableTerminalPrefixes([]);
            setSelectedTerminalPrefixes([]);
        } finally {
            setLoading(false);
            setLoadingTerminalCodes(false);
        }
    };

    // Copy function
    const handleCopyToClipboard = async (text: string) => {
        const success = await copyToClipboard(text);
        if (success) {
            setCopiedBill(text);
            setTimeout(() => setCopiedBill(''), 2000);
        }
    };

    // Filter handlers
    const handleScanTypeChange = (scanType: string, checked: boolean) => {
        if (checked) {
            setSelectedScanTypes(prev => [...prev, scanType]);
        } else {
            setSelectedScanTypes(prev => prev.filter(type => type !== scanType));
        }
    };

    const handleTerminalPrefixChange = (prefix: string, checked: boolean) => {
        if (checked) {
            setSelectedTerminalPrefixes(prev => [...prev, prefix]);
        } else {
            setSelectedTerminalPrefixes(prev => prev.filter(p => p !== prefix));
        }
    };

    // Select/Deselect all functions
    const selectAllScanTypes = () => setSelectedScanTypes([...SCAN_TYPE_OPTIONS]);
    const deselectAllScanTypes = () => setSelectedScanTypes([]);
    const selectAllTerminalPrefixes = () => setSelectedTerminalPrefixes([...availableTerminalPrefixes]);
    const deselectAllTerminalPrefixes = () => setSelectedTerminalPrefixes([]);

    const clearFilters = () => {
        setSelectedScanTypes([...SCAN_TYPE_OPTIONS]);
        setSelectedTerminalPrefixes([...availableTerminalPrefixes]);
        setStoppedDays(0);
    };

    // Filter logic - optimized
    useEffect(() => {
        const applyFilters = async () => {
            setFilterLoading(true);
            await new Promise(resolve => setTimeout(resolve, 100));

            let filtered = [...billsWithTerminalCode];

            // Filter by scan type
            if (selectedScanTypes.length > 0) {
                filtered = filtered.filter(item => {
                    const translatedType = translateScanType(item.scanTypeName);
                    return selectedScanTypes.includes(translatedType);
                });
            } else {
                filtered = [];
            }

            // Filter by terminal prefix
            if (selectedTerminalPrefixes.length > 0 && selectedTerminalPrefixes.length < availableTerminalPrefixes.length) {
                filtered = filtered.filter(item => {
                    return selectedTerminalPrefixes.includes(item.terminalPrefix);
                });
            }

            // Filter by stopped days
            if (stoppedDays > 0) {
                filtered = filtered.filter(item => {
                    const daysStopped = calculateStoppedDays(item.scanTime);
                    return daysStopped >= stoppedDays;
                });
            }

            setFilteredBills(filtered);
            setFilterLoading(false);
        };

        applyFilters();
    }, [billsWithTerminalCode, selectedScanTypes, selectedTerminalPrefixes, stoppedDays]);

    // Auto-select all scan types when data is loaded
    useEffect(() => {
        if (billsWithTerminalCode.length > 0 && selectedScanTypes.length === 0) {
            setSelectedScanTypes([...SCAN_TYPE_OPTIONS]);
        }
    }, [billsWithTerminalCode]);

    // Pagination functions
    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    const goToPrevPage = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            <div className="max-w-[90%] mx-auto px-6 py-4">

                {/* Input Section */}
                <div className="bg-white rounded-2xl shadow-xl p-8 mb-4 backdrop-blur-sm border border-white/20">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Ngày bắt đầu
                            </label>
                            <input
                                type="date"
                                value={startTime}
                                onChange={(e) => handleStartDateChange(e.target.value)}
                                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                                    dateError ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                }`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Ngày kết thúc
                            </label>
                            <input
                                type="date"
                                value={endTime}
                                onChange={(e) => handleEndDateChange(e.target.value)}
                                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                                    dateError ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                }`}
                            />
                            {dateError && (
                                <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-4 w-4"/>
                                    {dateError}
                                </p>
                            )}
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={getSumData}
                                disabled={loading || !!dateError}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        Đang tải...
                                    </>
                                ) : (
                                    <>
                                        <Search className="h-5 w-5"/>
                                        Lấy dữ liệu
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="bg-white rounded-2xl shadow-xl p-12 mb-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">Đang tải dữ liệu...</h3>
                        <p className="text-gray-500">Vui lòng đợi trong giây lát</p>
                        {loadingTerminalCodes && (
                            <p className="text-blue-500 text-sm mt-2">Đang tải thông tin mã đoạn...</p>
                        )}
                    </div>
                )}

                {/* Filters */}
                {billsWithTerminalCode.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-4 backdrop-blur-sm border border-white/20">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div className="flex items-center gap-2">
                                <Filter className="h-6 w-6 text-blue-600"/>
                                <h3 className="text-xl font-bold text-gray-800">Bộ lọc dữ liệu</h3>
                                {filterLoading && (
                                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                )}
                            </div>
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                            >
                                <RotateCcw className="h-4 w-4"/>
                                Reset bộ lọc
                            </button>
                        </div>

                        {/* Terminal Dispatch Code Filter */}
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-200 mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-emerald-600"/>
                                    <label className="block text-sm font-semibold text-gray-700">
                                        Lọc theo mã đoạn:
                                    </label>
                                    {loadingTerminalCodes && (
                                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllTerminalPrefixes}
                                        className="flex items-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-colors"
                                    >
                                        <CheckSquare className="h-4 w-4"/>
                                        Chọn tất cả
                                    </button>
                                    <button
                                        onClick={deselectAllTerminalPrefixes}
                                        className="flex items-center gap-1 px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                                    >
                                        <Square className="h-4 w-4"/>
                                        Bỏ chọn tất cả
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                {availableTerminalPrefixes.map((prefix) => (
                                    <label key={prefix} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedTerminalPrefixes.includes(prefix)}
                                            onChange={(e) => handleTerminalPrefixChange(prefix, e.target.checked)}
                                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                        />
                                        <span className="text-sm text-gray-700 select-none font-mono font-medium">{prefix}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="mt-4 px-4 py-2 bg-white rounded-lg">
                                <span className="text-sm text-emerald-600 font-medium">
                                    Hiển thị: {selectedTerminalPrefixes.length}/{availableTerminalPrefixes.length} mã đoạn
                                </span>
                            </div>
                        </div>

                        {/* Journey Filter */}
                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl border border-yellow-200 mb-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Clock className="h-5 w-5 text-yellow-600"/>
                                Theo dõi đơn hàng dừng hành trình:
                            </label>
                            <select
                                value={stoppedDays}
                                onChange={(e) => setStoppedDays(parseInt(e.target.value))}
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                            >
                                <option value={0}>Tất cả đơn hàng</option>
                                <option value={1}>Dừng hành trình ≥ 1 ngày</option>
                                <option value={2}>Dừng hành trình ≥ 2 ngày</option>
                                <option value={3}>Dừng hành trình ≥ 3 ngày</option>
                                <option value={5}>Dừng hành trình ≥ 5 ngày</option>
                                <option value={7}>Dừng hành trình ≥ 7 ngày</option>
                                <option value={10}>Dừng hành trình ≥ 10 ngày</option>
                            </select>
                        </div>

                        {/* Scan Type Filter */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Package className="h-5 w-5 text-blue-600"/>
                                    <label className="block text-sm font-semibold text-gray-700">
                                        Lọc theo loại quét kiện cuối cùng:
                                    </label>
                                    {filterLoading && (
                                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={selectAllScanTypes}
                                        className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                                    >
                                        <CheckSquare className="h-4 w-4"/>
                                        Chọn tất cả
                                    </button>
                                    <button
                                        onClick={deselectAllScanTypes}
                                        className="flex items-center gap-1 px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                                    >
                                        <Square className="h-4 w-4"/>
                                        Bỏ chọn tất cả
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                {SCAN_TYPE_OPTIONS.map((scanType) => (
                                    <label key={scanType} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedScanTypes.includes(scanType)}
                                            onChange={(e) => handleScanTypeChange(scanType, e.target.checked)}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm text-gray-700 select-none">{scanType}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="mt-4 px-4 py-2 bg-white rounded-lg">
                                <span className="text-sm text-blue-600 font-medium">
                                    Hiển thị: {selectedScanTypes.length}/{SCAN_TYPE_OPTIONS.length} loại quét
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Statistics */}
                {allBills.length > 0 && billsWithTerminalCode.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-4">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm uppercase">Tổng số đơn hàng</p>
                                    <p className="text-3xl font-bold">{allBills.length}</p>
                                </div>
                                <Package className="h-12 w-12 text-blue-200"/>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-100 text-sm uppercase">Sau lọc</p>
                                    <p className="text-3xl font-bold">{filteredBills.length}</p>
                                </div>
                                <CheckCircle className="h-12 w-12 text-green-200"/>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-emerald-100 text-sm uppercase">Mã đoạn khác nhau</p>
                                    <p className="text-3xl font-bold">{availableTerminalPrefixes.length}</p>
                                </div>
                                <Filter className="h-12 w-12 text-emerald-200"/>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-purple-100 text-sm uppercase">Trang hiện tại</p>
                                    <p className="text-3xl font-bold">{currentPage}/{totalPages}</p>
                                </div>
                                <Filter className="h-12 w-12 text-purple-200"/>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-orange-100 text-sm uppercase">Dừng hành trình</p>
                                    <p className="text-3xl font-bold">
                                        {stoppedDays > 0 ? filteredBills.filter((item) => calculateStoppedDays(item.scanTime) >= stoppedDays).length : 0}
                                    </p>
                                </div>
                                <AlertCircle className="h-12 w-12 text-orange-200"/>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pagination Controls */}
                {filteredBills.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-4">
                        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-gray-700">Hiển thị:</label>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    {ITEMS_PER_PAGE_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option} đơn/trang</option>
                                    ))}
                                </select>
                            </div>

                            <div className="text-sm text-gray-600">
                                Hiển thị {startIndex + 1} - {Math.min(endIndex, filteredBills.length)} của {filteredBills.length} đơn hàng
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Table */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-white/20">
                    <div className="overflow-x-auto">
                        <div className="max-h-[800px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 uppercase text-left font-semibold text-gray-700">Mã vận đơn</th>
                                    <th className="px-6 py-4 uppercase text-left font-semibold text-gray-700 min-w-[8rem]">Trạng thái hiện tại</th>
                                    <th className="px-6 py-4 uppercase text-center font-semibold text-gray-700 max-w-[10rem]">Thời gian thao tác</th>
                                    <th className="px-6 py-4 uppercase text-center font-semibold text-gray-700 max-w-[8rem]">BC thao tác</th>
                                    <th className="px-6 py-4 uppercase text-center font-semibold text-gray-700">Người thao tác</th>
                                    <th className="px-6 py-4 uppercase text-center font-semibold text-gray-700 max-w-[10rem]">Loại quét cuối cùng</th>
                                    <th className="px-6 py-4 uppercase text-center font-semibold text-gray-700 max-w-[8rem]">Mã đoạn</th>
                                    <th className="px-6 py-4 uppercase text-center font-semibold text-gray-700 max-w-[8rem]">Số ngày dừng</th>
                                </tr>
                                </thead>
                                <tbody>
                                {currentBills.map((item, index) => {
                                    const daysStopped = calculateStoppedDays(item.scanTime);
                                    const statusColor = getStatusColor(daysStopped);
                                    const globalIndex = startIndex + index;
                                    const isEvenRow = globalIndex % 2 === 0;
                                    const translatedScanType = translateScanType(item.scanTypeName);
                                    const scanTypeColor = getScanTypeColor(translatedScanType);

                                    return (
                                        <tr key={index} className={`border-b border-gray-100 hover:bg-blue-50 transition-colors ${isEvenRow ? 'bg-white' : 'bg-gray-50/50'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                        <span className="font-mono font-medium text-gray-900 text-md">
                                                            {item.billCode}
                                                        </span>
                                                    <button
                                                        onClick={() => handleCopyToClipboard(item.billCode)}
                                                        className="p-1 hover:bg-blue-100 rounded transition-colors group"
                                                        title="Copy mã vận đơn"
                                                    >
                                                        <Copy className={`h-3 w-3 transition-colors ${copiedBill === item.billCode ? 'text-green-500' : 'text-gray-400 group-hover:text-blue-500'}`}/>
                                                    </button>
                                                    {copiedBill === item.billCode && (
                                                        <span className="text-md text-green-500 font-medium animate-fade-in">
                                                                Copied!
                                                            </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 text-md min-w-[8rem] max-w-[40rem]">
                                                <div>{item.waybillTrackingContent}</div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 text-center font-mono text-md max-w-[10rem]">
                                                {item.scanTime}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 font-mono text-md text-center max-w-[8rem]">
                                                {item.scanNetworkCode}
                                            </td>
                                            <td className="px-6 py-4 text-gray-700 text-md text-center items-center max-w-28">
                                                <div className="truncate" title={item.scanByName === "机器人" ? "Đang chuyển hoàn" : item.scanByName}>
                                                    {item.scanByName === "机器人" ? "Đang chuyển hoàn" : item.scanByName}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-[10rem]">
                                                    <span className={`px-2 py-1 rounded-md text-xs text-center block w-full truncate font-medium ${scanTypeColor}`} title={translatedScanType}>
                                                        {translatedScanType}
                                                    </span>
                                            </td>
                                            <td className="px-6 py-4 text-center max-w-[8rem]">
                                                {loadingTerminalCodes ? (
                                                    <div className="flex justify-center">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-500"></div>
                                                    </div>
                                                ) : (
                                                    <div className="text-center">
                                                        {item.terminalPrefix && (
                                                            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-mono font-medium block mb-1">
                                                                    {item.terminalPrefix}
                                                                </span>
                                                        )}
                                                        {item.terminalRemaining && (
                                                            <span className="text-xs text-gray-500 font-mono">
                                                                    {item.terminalRemaining}
                                                                </span>
                                                        )}
                                                        {!item.terminalDispatchCode && (
                                                            <span className="text-xs text-gray-400">--</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center max-w-[8rem]">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                                                        {daysStopped} ngày
                                                    </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>

                            {filteredBills.length === 0 && billsWithTerminalCode.length > 0 && (
                                <div className="text-center p-12 text-gray-500">
                                    <Package className="h-16 w-16 text-gray-300 mx-auto mb-4"/>
                                    <h3 className="text-xl font-semibold mb-2">Không tìm thấy dữ liệu</h3>
                                    <p>Không có dữ liệu phù hợp với bộ lọc hiện tại</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Pagination */}
                {filteredBills.length > 0 && totalPages > 1 && (
                    <div className="bg-white rounded-2xl shadow-xl p-6 mt-4">
                        <div className="flex justify-center items-center gap-4">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => goToPage(1)}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Đầu
                                </button>

                                <button
                                    onClick={goToPrevPage}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="h-5 w-5"/>
                                </button>

                                <div className="flex items-center gap-1">
                                    {getPageNumbers(currentPage, totalPages, PAGINATION_SHOW_PAGES).map((pageNum) => (
                                        <button
                                            key={pageNum}
                                            onClick={() => goToPage(pageNum)}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:cursor-pointer ${
                                                pageNum === currentPage
                                                    ? 'bg-blue-500 text-white'
                                                    : 'border border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={goToNextPage}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="h-5 w-5"/>
                                </button>

                                <button
                                    onClick={() => goToPage(totalPages)}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Cuối
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom styles for animations */}
            <style jsx>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .animate-fade-in {
                    animation: fade-in 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}

export default Page;