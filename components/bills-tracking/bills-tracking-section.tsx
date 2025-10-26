"use client";

import {useEffect, useState} from "react";
import OrderDetail from "@/components/bills-tracking/order-detail";
import PodHistory from "@/components/bills-tracking/pod-history";
import IssueHistory from "@/components/bills-tracking/issue-history";
import axios from "axios";

interface BillsTrackingSectionProps {
    bills: string[];
    authToken: string;
    isBillTracking: boolean;
}

// Interface cho dữ liệu đơn hàng
interface OrderData {
    waybill: string;
    terminalDispatchCode: string;
    scanTypeName: string;
    scanNetworkCode: string; // THÊM MỚI
}

// Interface cho nhóm đơn hàng
interface GroupedOrder {
    waybill: string;
    terminalDispatchCode: string;
    scanTypeName: string;
    groupLevel1: string;
    groupLevel2: string;
    groupColor: string;
}

export default function BillsTrackingSection({bills, authToken, isBillTracking}: BillsTrackingSectionProps) {

    const [selectedCode, setSelectedCode] = useState<string | null>(null);
    const [inputCode, setInputCode] = useState<string>("");
    const [parsedCodes, setParsedCodes] = useState<string[]>([]);
    const [billsList, setBillsList] = useState<string[]>(bills);
    const [isSearchExpanded, setIsSearchExpanded] = useState<boolean>(true);

    // State cho filter và data
    const [ordersData, setOrdersData] = useState<OrderData[]>([]);
    const [groupedOrders, setGroupedOrders] = useState<GroupedOrder[]>([]);
    const [filteredBills, setFilteredBills] = useState<string[]>([]);
    const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(false);

    // Filter states
    const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

    // THÊM MỚI: Filter cho scanNetworkCode
    const [show028M08, setShow028M08] = useState<boolean>(true);
    const [showNon028M08, setShowNon028M08] = useState<boolean>(true);

    // Màu sắc cho các nhóm
    const groupColors = [
        'bg-blue-50 border-blue-200',
        'bg-emerald-50 border-emerald-200',
        'bg-amber-50 border-amber-200',
        'bg-purple-50 border-purple-200',
        'bg-pink-50 border-pink-200',
        'bg-indigo-50 border-indigo-200',
        'bg-slate-50 border-slate-200',
        'bg-rose-50 border-rose-200',
        'bg-orange-50 border-orange-200',
        'bg-teal-50 border-teal-200'
    ];

    const shouldShowLoading = !isBillTracking && (!bills || bills.length === 0);

    useEffect(() => {
        setBillsList(bills);
        setFilteredBills(bills);
    }, [bills]);

    useEffect(() => {
        if (!isBillTracking && bills.length > 0) {
            loadOrdersData();
        }
    }, [bills, isBillTracking]);

    // THÊM show028M08 và showNon028M08 vào dependencies
    useEffect(() => {
        if (!isBillTracking) {
            applyStatusFilter();
        }
    }, [selectedStatuses, groupedOrders, show028M08, showNon028M08]);

    const parseTerminalCode = (code: string) => {
        const parts = code.split('-');
        if (parts.length >= 3) {
            return {
                level1: parts[1],
                level2: parts[2]
            };
        }
        return { level1: '', level2: '' };
    };

    const createGroupedOrders = (orders: OrderData[]): GroupedOrder[] => {
        const grouped: GroupedOrder[] = [];
        const groupColorMap = new Map<string, string>();
        let colorIndex = 0;

        const level1Groups = new Map<string, OrderData[]>();

        orders.forEach(order => {
            const parsed = parseTerminalCode(order.terminalDispatchCode);
            const level1Key = parsed.level1;

            if (!level1Groups.has(level1Key)) {
                level1Groups.set(level1Key, []);
            }
            level1Groups.get(level1Key)!.push(order);
        });

        level1Groups.forEach((level1Orders, level1Key) => {
            const level2Groups = new Map<string, OrderData[]>();

            level1Orders.forEach(order => {
                const parsed = parseTerminalCode(order.terminalDispatchCode);
                const level2Key = `${level1Key}-${parsed.level2}`;

                if (!level2Groups.has(level2Key)) {
                    level2Groups.set(level2Key, []);
                }
                level2Groups.get(level2Key)!.push(order);
            });

            level2Groups.forEach((level2Orders, level2Key) => {
                if (!groupColorMap.has(level2Key)) {
                    groupColorMap.set(level2Key, groupColors[colorIndex % groupColors.length]);
                    colorIndex++;
                }

                const groupColor = groupColorMap.get(level2Key)!;

                level2Orders.forEach(order => {
                    const parsed = parseTerminalCode(order.terminalDispatchCode);
                    grouped.push({
                        waybill: order.waybill,
                        terminalDispatchCode: order.terminalDispatchCode,
                        scanTypeName: order.scanTypeName,
                        groupLevel1: parsed.level1,
                        groupLevel2: parsed.level2,
                        groupColor: groupColor
                    });
                });
            });
        });

        return grouped;
    };

    const loadOrdersData = async () => {
        setIsLoadingOrders(true);
        try {
            const mockData: OrderData[] = [];
            const promises = bills.map(async (bill) => {
                try {
                    const orderResp: any = await axios.post("https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail", {
                        "waybillNo": bill,
                        "countryId": "1"
                    }, {
                        headers: {
                            authToken: authToken,
                            lang: 'VN',
                            langType: 'VN',
                        }
                    });

                    const trackingResp: any = await axios.post("https://jmsgw.jtexpress.vn/operatingplatform/podTracking/inner/query/keywordList", {
                        "keywordList": [bill],
                        "trackingTypeEnum": "WAYBILL",
                        "countryId": "1"
                    }, {
                        headers: {
                            authToken: authToken,
                            lang: 'VN',
                            langType: 'VN',
                        }
                    });

                    const orderData: OrderData = {
                        waybill: bill,
                        terminalDispatchCode: orderResp.data.data.details.terminalDispatchCode || '',
                        scanTypeName: trackingResp.data.data[0]?.details[0]?.scanTypeName || 'Không có trạng thái',
                        scanNetworkCode: trackingResp.data.data[0]?.details[0]?.scanNetworkCode || '' // THÊM MỚI
                    };

                    mockData.push(orderData);
                } catch (error) {
                    console.error(`Error loading data for bill ${bill}:`, error);
                    mockData.push({
                        waybill: bill,
                        terminalDispatchCode: '',
                        scanTypeName: 'Lỗi tải dữ liệu',
                        scanNetworkCode: '' // THÊM MỚI
                    });
                }
            });

            await Promise.all(promises);

            const statuses = Array.from(new Set(mockData.map(order => order.scanTypeName).filter(status => status)));
            setAvailableStatuses(statuses);
            setSelectedStatuses(statuses);

            const grouped = createGroupedOrders(mockData);
            setGroupedOrders(grouped);
            setOrdersData(mockData);
            setIsLoadingOrders(false);

        } catch (error) {
            console.error('Error loading orders data:', error);
            setIsLoadingOrders(false);
        }
    };

    // CẬP NHẬT: Thêm logic filter theo scanNetworkCode
    const applyStatusFilter = () => {
        let filtered = groupedOrders;

        // Filter theo trạng thái
        if (selectedStatuses.length > 0 && selectedStatuses.length < availableStatuses.length) {
            filtered = filtered.filter(order => selectedStatuses.includes(order.scanTypeName));
        }

        // Filter theo scanNetworkCode
        filtered = filtered.filter(order => {
            const orderData = ordersData.find(o => o.waybill === order.waybill);
            if (!orderData) return true;

            const is028M08 = orderData.scanNetworkCode === '028M08';

            // Nếu là 028M08 nhưng không show028M08 thì loại bỏ
            if (is028M08 && !show028M08) return false;
            // Nếu không phải 028M08 nhưng không showNon028M08 thì loại bỏ
            if (!is028M08 && !showNon028M08) return false;

            return true;
        });

        const filteredWaybills = filtered.map(order => order.waybill);
        setFilteredBills(filteredWaybills);
        setBillsList(filteredWaybills);

        if (selectedCode && !filteredWaybills.includes(selectedCode)) {
            setSelectedCode(null);
        }
    };

    const handleStatusChange = (status: string, checked: boolean) => {
        if (checked) {
            setSelectedStatuses(prev => [...prev, status]);
        } else {
            setSelectedStatuses(prev => prev.filter(s => s !== status));
        }
    };

    const handleSelectAllStatuses = (selectAll: boolean) => {
        if (selectAll) {
            setSelectedStatuses([...availableStatuses]);
        } else {
            setSelectedStatuses([]);
        }
    };

    const isNumericCode = (code: string) => {
        return /^\d{12}$/.test(code.trim());
    };

    const handleInputChange = (value: string) => {
        setInputCode(value);

        const codes = value.split(/[\s\n,]+/).filter(code => code.trim().length > 0);
        const validCodes: string[] = [];
        let remainingText = "";

        codes.forEach((code, index) => {
            const trimmedCode = code.trim();

            if (isNumericCode(trimmedCode)) {
                validCodes.push(trimmedCode);
            } else if (trimmedCode.length > 0) {
                if (trimmedCode.length >= 12 && /^\d+$/.test(trimmedCode)) {
                    for (let i = 0; i < trimmedCode.length; i += 12) {
                        const chunk = trimmedCode.substr(i, 12);
                        if (chunk.length === 12) {
                            validCodes.push(chunk);
                        } else if (chunk.length > 0) {
                            remainingText += (remainingText ? " " : "") + chunk;
                        }
                    }
                } else {
                    remainingText += (remainingText ? " " : "") + trimmedCode;
                }
            }
        });

        setParsedCodes(validCodes);

        if (remainingText !== value.replace(/[\s\n,]+/g, ' ').trim()) {
            setInputCode(remainingText);
        }
    };

    const removeParsedCode = (codeToRemove: string) => {
        setParsedCodes(prev => prev.filter(code => code !== codeToRemove));
    };

    const handleSearch = () => {
        if (parsedCodes.length > 0) {
            setBillsList([...parsedCodes]);
            setSelectedCode(parsedCodes[0]);
        }
    };

    const handleSearchClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSearchExpanded(true);
    };

    const handleBillsListClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSearchExpanded(false);
    };

    const handleBillClick = (code: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedCode(code);
        setIsSearchExpanded(false);
    };

    const LoadingSpinner = () => (
        <div className="flex h-screen bg-gray-50">
            <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
                <div className="p-6 border-b border-gray-200 bg-red-500 flex-shrink-0">
                    <h1 className="text-white font-semibold text-xl tracking-tight">Tra cứu vận đơn</h1>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="relative">
                            <div className="w-12 h-12 border-3 border-red-200 border-t-red-500 rounded-full animate-spin mx-auto mb-4"></div>
                        </div>

                        <p className="text-slate-700 font-medium mb-2">Đang tải dữ liệu...</p>
                        <p className="text-slate-500 text-sm">Vui lòng đợi trong giây lát</p>

                        <div className="flex justify-center mt-4 space-x-1">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-slate-300 text-5xl mb-4">📦</div>
                    <p className="text-slate-500 text-lg">Đang chuẩn bị dữ liệu vận đơn...</p>
                </div>
            </div>
        </div>
    );

    // CẬP NHẬT FilterBar: Thêm filter cho scanNetworkCode
    const FilterBar = () => (
        <div className="bg-white border-b border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">Lọc theo trạng thái:</span>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={selectedStatuses.length === availableStatuses.length}
                            onChange={(e) => handleSelectAllStatuses(e.target.checked)}
                            className="rounded border-gray-300 text-red-500 focus:ring-red-500 focus:ring-1"
                        />
                        <span className="font-medium text-slate-700">Tất cả</span>
                    </label>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {availableStatuses.map(status => (
                        <label key={status} className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={selectedStatuses.includes(status)}
                                onChange={(e) => handleStatusChange(status, e.target.checked)}
                                className="rounded border-gray-300 text-red-500 focus:ring-red-500 focus:ring-1"
                            />
                            <span className="text-slate-700">{status}</span>
                        </label>
                    ))}
                </div>

                {/* THÊM MỚI: Filter theo scanNetworkCode */}
                <div className="h-6 w-px bg-gray-300"></div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">Mã mạng lưới:</span>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={show028M08}
                            onChange={(e) => setShow028M08(e.target.checked)}
                            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="text-slate-700 font-medium">028M08</span>
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={showNon028M08}
                            onChange={(e) => setShowNon028M08(e.target.checked)}
                            className="rounded border-gray-300 text-blue-500 focus:ring-blue-500 focus:ring-1"
                        />
                        <span className="text-slate-700">Khác</span>
                    </label>
                </div>

                <div className="ml-auto text-sm text-slate-600 font-medium">
                    {isLoadingOrders ? "Đang tải..." : `${filteredBills.length}/${bills.length} đơn`}
                </div>
            </div>
        </div>
    );

    if (shouldShowLoading) {
        return <LoadingSpinner/>;
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {!isBillTracking && (
                <div className="absolute top-0 left-0 right-0 z-10">
                    <FilterBar/>
                </div>
            )}

            <div className={`flex flex-1 w-full ${!isBillTracking ? 'pt-16' : ''}`}>
                <div className={`border-r border-gray-200 bg-white flex flex-col transition-all duration-300 ease-in-out ${
                    isSearchExpanded ? 'w-80' : 'w-56'
                }`}>
                    <div className="p-6 border-b border-gray-200 bg-red-500 flex-shrink-0">
                        <h1 className="text-white font-semibold text-xl tracking-tight">
                            {isBillTracking ? "Tra cứu vận đơn" : "MÃ VẬN ĐƠN"}
                        </h1>
                    </div>

                    {isBillTracking && (
                        <div
                            className={`border-b border-gray-200 transition-all duration-300 ease-in-out cursor-pointer ${
                                isSearchExpanded ? 'p-4' : 'p-3'
                            }`}
                            onClick={handleSearchClick}
                        >
                            <label className={`font-medium text-slate-700 ${
                                isSearchExpanded ? 'text-sm' : 'text-xs'
                            }`}>
                                Theo vận đơn
                            </label>
                            <textarea
                                value={inputCode}
                                onChange={(e) => handleInputChange(e.target.value)}
                                placeholder="Nhập mã vận đơn..."
                                className={`border border-gray-300 rounded-lg mt-2 w-full resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-300 ${
                                    isSearchExpanded
                                        ? 'p-3 h-20 text-sm'
                                        : 'p-2 h-12 text-xs'
                                }`}
                                rows={isSearchExpanded ? 4 : 2}
                                onClick={(e) => e.stopPropagation()}
                            />

                            {isSearchExpanded && parsedCodes.length > 0 && (
                                <div className="mt-3 max-h-32 overflow-y-auto space-y-2 pr-1">
                                    {parsedCodes.map((code, index) => (
                                        <div key={index}
                                             className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex-shrink-0">
                                            <span className="text-sm font-mono text-blue-800">{code}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeParsedCode(code);
                                                }}
                                                className="text-red-500 hover:text-red-600 ml-2 font-medium text-sm flex-shrink-0"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!isSearchExpanded && parsedCodes.length > 0 && (
                                <div className="mt-2 text-xs text-blue-600 font-medium">
                                    {parsedCodes.length} mã đã nhập
                                </div>
                            )}

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSearch();
                                }}
                                disabled={parsedCodes.length === 0}
                                className={`rounded-lg mt-3 w-full transition-all duration-200 font-medium ${
                                    isSearchExpanded ? 'px-4 py-3' : 'px-3 py-2 text-sm'
                                } ${
                                    parsedCodes.length > 0
                                        ? "bg-red-500 text-white hover:bg-red-600"
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                }`}
                            >
                                Tra cứu ({parsedCodes.length})
                            </button>
                        </div>
                    )}

                    <div
                        className="flex-1 overflow-hidden flex flex-col cursor-pointer"
                        onClick={handleBillsListClick}
                    >
                        <div className={`pt-4 flex-shrink-0 transition-all duration-300 ${
                            isSearchExpanded ? 'px-3' : 'px-4'
                        }`}>
                            <h2 className={`font-medium mb-3 text-slate-700 ${
                                isSearchExpanded ? 'text-sm' : 'text-base'
                            }`}>
                                Danh sách đơn ({billsList.length})
                                {!isBillTracking && isLoadingOrders && (
                                    <span className="ml-2 text-blue-500">
                                        <div className="inline-block w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    </span>
                                )}
                            </h2>
                        </div>

                        <div className={`flex-1 pb-4 overflow-y-auto transition-all duration-300 ${
                            isSearchExpanded ? 'px-3' : 'px-4'
                        }`}>
                            {billsList.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className={`text-slate-300 mb-3 ${
                                        isSearchExpanded ? 'text-3xl' : 'text-4xl'
                                    }`}>📦</div>
                                    <p className={`text-slate-500 ${
                                        isSearchExpanded ? 'text-xs' : 'text-sm'
                                    }`}>
                                        {!isBillTracking && isLoadingOrders
                                            ? "Đang tải dữ liệu..."
                                            : "Tạm thời chưa có dữ liệu"}
                                    </p>
                                </div>
                            ) : (
                                billsList.map((code) => {
                                    const groupedOrder = groupedOrders.find(order => order.waybill === code);
                                    const isSelected = selectedCode === code;

                                    return (
                                        <div
                                            key={code}
                                            onClick={(e) => handleBillClick(code, e)}
                                            className={`rounded-lg cursor-pointer transition-all duration-200 mb-3 relative ${
                                                isSearchExpanded
                                                    ? 'p-3 text-xs'
                                                    : 'p-4 text-sm'
                                            } ${
                                                isSelected
                                                    ? "bg-red-50 border-2 border-red-500 outline outline-2 outline-red-500 outline-offset-2 shadow-lg"
                                                    : `border hover:shadow-sm ${groupedOrder?.groupColor || 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`
                                            }`}
                                        >
                                            <div className="text-center font-mono font-semibold">{code}</div>
                                            {!isBillTracking && groupedOrder && !isSearchExpanded && (
                                                <div className="mt-2 text-xs text-slate-600 text-center">
                                                    {groupedOrder.groupLevel1 && (
                                                        <div className="text-xs text-blue-600 font-medium mt-1 font-mono">
                                                            {groupedOrder.terminalDispatchCode}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex">
                    {!selectedCode ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-slate-300 text-5xl mb-4">🔍</div>
                                <p className="text-slate-500 text-lg">Chọn một mã vận đơn để xem chi tiết</p>
                                {billsList.length > 0 && (
                                    <p className="text-slate-400 text-sm mt-2">
                                        Có {billsList.length} vận đơn trong danh sách
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="max-w-1/4">
                                <OrderDetail key={selectedCode} waybill={selectedCode} authToken={authToken}/>
                            </div>

                            <div className="w-full p-4 flex flex-col gap-3">
                                <div className="h-2/3">
                                    <PodHistory key={`pod-${selectedCode}`} waybill={selectedCode} authToken={authToken}/>
                                </div>

                                <div className="h-1/3">
                                    <IssueHistory key={`issue-${selectedCode}`} waybill={selectedCode} authToken={authToken}/>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}