"use client";

import {useEffect, useState, useRef} from "react";
import {
    ArrowLeft, RefreshCw, CalendarDays,
    ChevronLeft, ChevronRight, PackageOpen,
    Users, Search, Loader2, CheckCircle2,
} from "lucide-react";
import {useRouter} from "next/navigation";
import axios from "axios";

const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
        * { font-family: 'DM Sans', 'Segoe UI', sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes pulse-ring {
            0%   { transform: scale(1);    opacity: .6; }
            50%  { transform: scale(1.12); opacity: .2; }
            100% { transform: scale(1);    opacity: .6; }
        }
        .card-appear { animation: fadeInUp .45s ease both; }
        .card-appear:nth-child(2) { animation-delay: .08s; }
        .card-appear:nth-child(3) { animation-delay: .16s; }
        .loader-ring  { animation: pulse-ring 1.4s ease-in-out infinite; }
    `}</style>
);

function toDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
}

// ── Loading overlay ────────────────────────────────────────────────────────
function LoadingOverlay({steps}: {steps: {label: string; done: boolean}[]}) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12">
            {/* Spinner */}
            <div className="relative w-20 h-20">
                <div className="loader-ring absolute inset-0 rounded-full bg-indigo-200"/>
                <div className="absolute inset-2 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin"/>
                </div>
            </div>

            <div className="text-center">
                <p className="font-bold text-slate-700 text-base mb-1">Đang tải dữ liệu…</p>
                <p className="text-slate-400 text-xs">Vui lòng chờ trong giây lát</p>
            </div>

            {/* Step checklist */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-6 py-4 flex flex-col gap-3 w-72">
                {steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                        {s.done
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0"/>
                            : <Loader2 className="w-4 h-4 text-indigo-400 animate-spin flex-shrink-0"/>
                        }
                        <span className={`text-sm ${s.done ? "text-slate-500 line-through" : "text-slate-700 font-medium"}`}>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function DailyReportSection() {

    const router = useRouter();
    const [authToken, setAuthToken] = useState<string>("");

    // ── Raw API state ──────────────────────────────────────────────────────
    const [busOpArrival, setBusOpArrival] = useState<any[]>([]);
    const [arrivalNum, setArrivalNum]     = useState(0);
    const [sendCount, setSendCount]       = useState(0);
    const [signCount, setSignCount]       = useState(0);
    const [signRate, setSignRate]         = useState<string>("");
    const [reserveNum, setReserveNum]     = useState(0);
    const [scanReserveRate, setScanReserveRate] = useState<string>("");
    const [receiveNum, setReceiveNum]     = useState(0);
    const [receiveBills, setReceiveBills] = useState<any[]>([]); // lưu full object {waybillNo, customerCode, ...}
    const [rebackNum, setRebackNum]       = useState(0);
    const [rebackBills, setRebackBills]   = useState<any[]>([]);

    // ── Tỷ lệ nhận kiện thành công ──────────────────────────────────────
    const [receiveSuccessRate, setReceiveSuccessRate] = useState<string | number>("—");
    const [stepBoardDone, setStepBoardDone]           = useState(false);

    // ── Refs để track completion — tránh closure stale ───────────────────
    const refDetailDone = useRef(false);
    const refBoardDone  = useRef(false);

    const checkAllDone = () => {
        if (refDetailDone.current && refBoardDone.current) {
            setStepDetailDone(true);
            setIsFetching(false);
            setDataReady(true);
        }
    };

    // ── UI state ───────────────────────────────────────────────────────────
    const today = toDateStr(new Date());
    // ✅ Ngày mặc định là hôm nay
    const [selectedDate, setSelectedDate] = useState(today);
    const [staffCount, setStaffCount]     = useState<string>("");
    const [fetchTrigger, setFetchTrigger] = useState(0);

    // Loading sub-steps
    const [stepSummaryDone,  setStepSummaryDone]  = useState(false);
    const [stepReceiveDone,  setStepReceiveDone]  = useState(false);
    const [stepRebackDone,   setStepRebackDone]   = useState(false);
    const [stepDetailDone,   setStepDetailDone]   = useState(false);
    const [isFetching, setIsFetching]             = useState(false);
    const [dataReady, setDataReady]               = useState(false);

    // ── Derived values ────────────────────────────────────────────────────
    const tiktokOrders      = busOpArrival.filter((b:any) => b?.startsWith("85") || b?.startsWith("86") || b?.startsWith("87"));
    // ✅ Filter đơn truyền thống theo customerCode bắt đầu bằng "028"
    const traditionalBills  = receiveBills.filter((b:any) => b?.customerCode?.startsWith("028"));
    const allRebackBills    = rebackBills.filter((b:any) => !b?.endsWith("-001"));
    const allTiktokRebacks  = allRebackBills.filter((b:any) => b?.startsWith("85") || b?.startsWith("86") || b?.startsWith("87"));

    const staffNum = parseInt(staffCount) || 0;
    const hieuSuatBQ = staffNum > 0
        ? `${(signCount / staffNum).toFixed(1)} đơn/người`
        : "— (chưa nhập nhân viên)";

    // ── Auth check ────────────────────────────────────────────────────────
    useEffect(() => {
        const ylToken = localStorage.getItem('YL_TOKEN');
        if (!ylToken) { router.push('/'); return; }
        setAuthToken(ylToken);
    }, [router]);

    // ── Helpers ───────────────────────────────────────────────────────────
    const getDateRange = (dateStr: string) => ({
        startTime: `${dateStr} 00:00:00`,
        endTime:   `${dateStr} 23:59:59`,
    });

    const resetState = () => {
        setBusOpArrival([]); setArrivalNum(0);
        setSendCount(0); setSignCount(0); setSignRate("");
        setReserveNum(0); setScanReserveRate("");
        setReceiveNum(0); setReceiveBills([]);
        setRebackNum(0); setRebackBills([]);
        setReceiveSuccessRate("—");
        setStepSummaryDone(false); setStepReceiveDone(false);
        setStepRebackDone(false);  setStepDetailDone(false);
        setStepBoardDone(false);
        refDetailDone.current = false;
        refBoardDone.current  = false;
        setDataReady(false);
    };

    // ── Phase 1: summary + counts ─────────────────────────────────────────
    useEffect(() => {
        if (!authToken || fetchTrigger === 0) return;
        resetState();
        setIsFetching(true);

        const {startTime, endTime} = getDateRange(selectedDate);

        // arrival summary
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/bus_op_arrival_monitor_total",
            {current:1, size:20, startTime, endTime, typeType:"day", dimensionType:336, countryId:"1"},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        );
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/bus_op_arrival_monitor_sum",
            {current:1, size:20, startTime, endTime, typeType:"day", dimensionType:336, countryId:"1"},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        ).then((r:any) => setArrivalNum(r.data.data.records[0].arrivalNum));
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/bus_op_arrival_monitor_update",
            {current:1, size:20, startTime, endTime, typeType:"day", dimensionType:336, countryId:"1"},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        );

        // dispatch summary
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/day_dispatch_monitor_total",
            {current:1, size:20, startTime, endTime, dimensionType:336, countryId:"1", inputsiteCode:["028M08"]},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        );
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/day_dispatch_monitor_sum",
            {current:1, size:20, startTime, endTime, dimensionType:336, countryId:"1", inputsiteCode:["028M08"]},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        ).then((r:any) => {
            setSendCount(r.data.data.records[0].sendCount);
            setSignCount(r.data.data.records[0].signCount);
            setSignRate(r.data.data.records[0].signRate);
        });
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/day_dispatch_monitor_datatime",
            {current:1, size:20, startTime, endTime, dimensionType:336, countryId:"1", inputsiteCode:["028M08"]},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        );

        // stocktaking summary
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_stocktaking_total",
            {current:1,size:20, startDate:startTime, endDate:endTime, startTime, endTime, dimension:"Network", countryId:"1"},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        );
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_stocktaking_sum",
            {current:1,size:20, startDate:startTime, endDate:endTime, startTime, endTime, dimension:"Network", countryId:"1"},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        ).then((r:any) => {
            setReserveNum(r.data.data.records[0].reserveNum);
            setScanReserveRate(r.data.data.records[0].scanReserveRate);
            setStepSummaryDone(true);
        });

        // stock count
        axios.post(
            "https://jmsgw.jtexpress.vn/networkmanagement/omsWaybill/shippingWaybillListCount",
            new URLSearchParams({current:"1",size:"20",pickFinanceCode:"028001",timeStart:startTime,timeEnd:endTime,inputTimeStart:startTime,inputTimeEnd:endTime}),
            {headers:{"Content-Type":"application/x-www-form-urlencoded",authToken,lang:"VN",langType:"VN"}}
        ).then((r:any) => { setReceiveNum(r.data.data); setStepReceiveDone(true); });

        // reback count
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_reback_query_detail",
            {current:1,size:20,startTime,endTime,networkCodes:"028M08",countryId:"1",waybillNoType:0,queryType:"1"},
            {headers:{authToken, lang:'VN', langType:'VN'}}
        ).then((r:any) => { setRebackNum(r.data.data.total); setStepRebackDone(true); });

        // ✅ API mới: Tỷ lệ nhận kiện thành công — punctuality_platform_pick_total
        // Lấy field ageingPickWinRate từ records[0]
        axios.post(
            "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/punctuality_platform_pick_total",
            {
                current:           1,
                size:              20,
                SourcesType:       0,
                bestPickTimeEnd:   endTime,
                bestPickTimeStart: startTime,
                countryId:         "1",
                networkCodeNew:    "028M08",
                staffType:         0,
                timeType:          "A",
            },
            {headers:{authToken, lang:'VN', langType:'VN'}}
        ).then((r:any) => {
            try {
                const record = r.data?.data?.records?.[0];
                if (record && record.ageingPickWinRate !== undefined && record.ageingPickWinRate !== null) {
                    setReceiveSuccessRate(record.ageingPickWinRate);
                } else {
                    setReceiveSuccessRate("—");
                }
            } catch {
                setReceiveSuccessRate("—");
            }
            setStepBoardDone(true);
            refBoardDone.current = true;
            checkAllDone();
        }).catch(() => {
            setReceiveSuccessRate("—");
            setStepBoardDone(true);
            refBoardDone.current = true;
            checkAllDone();
        });

    }, [authToken, fetchTrigger]);

    // ── Phase 2: detail lists (depends on counts) ─────────────────────────
    useEffect(() => {
        if (!authToken || arrivalNum === 0 || receiveNum === 0 || rebackNum === 0) return;
        const {startTime, endTime} = getDateRange(selectedDate);

        Promise.all([
            axios.post(
                "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/bus_op_arrival_monitor_detail",
                {current:1,size:arrivalNum,startTime,endTime,JumpType:"arrivalNum",arrivalSationCode:"028M08",countryId:"1",dateType:2},
                {headers:{authToken, lang:'VN', langType:'VN'}}
            ).then((r:any) => setBusOpArrival(r.data.data.records.map((x:any) => x.billCode))),

            // ✅ Pagination: API giới hạn 100 records/trang, gọi song song tất cả các trang
            (async () => {
                const PAGE_SIZE = 100;
                const totalPages = Math.ceil(receiveNum / PAGE_SIZE);
                const pages = Array.from({length: totalPages}, (_, i) => i + 1);
                const results = await Promise.all(
                    pages.map(page =>
                        axios.post(
                            "https://jmsgw.jtexpress.vn/networkmanagement/omsWaybill/shippingWaybillList",
                            new URLSearchParams({
                                current: String(page),
                                size:    String(PAGE_SIZE),
                                pickFinanceCode: "028001",
                                timeStart:      startTime,
                                timeEnd:        endTime,
                                inputTimeStart: startTime,
                                inputTimeEnd:   endTime,
                            }),
                            {headers: {"Content-Type": "application/x-www-form-urlencoded", authToken, lang: "VN", langType: "VN"}}
                        ).then((r: any) => r.data.data ?? [])
                    )
                );
                setReceiveBills(results.flat()); // lưu full object để filter customerCode
            })(),

            axios.post(
                "https://jmsgw.jtexpress.vn/businessindicator/bigdataReport/detail/opt_reback_query_detail",
                {current:1,size:rebackNum,startTime,endTime,networkCodes:"028M08",countryId:"1",waybillNoType:0,queryType:"1"},
                {headers:{authToken, lang:'VN', langType:'VN'}}
            ).then((r:any) => setRebackBills(r.data.data.records.map((x:any) => x.waybillNo))),
        ]).then(() => {
            setStepDetailDone(true);
            refDetailDone.current = true;
            checkAllDone();
        });
    }, [arrivalNum, receiveNum, rebackNum]);

    // ── Date nav ──────────────────────────────────────────────────────────
    const shiftDay = (delta: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + delta);
        const s = toDateStr(d);
        if (s > today) return;
        setSelectedDate(s);
    };

    const handleFetch = () => {
        if (!authToken) return;
        setFetchTrigger(t => t + 1);
    };

    // ── Loading steps config ──────────────────────────────────────────────
    const loadingSteps = [
        {label: "Tải tóm tắt vận hành",           done: stepSummaryDone},
        {label: "Tải số lượng đơn nhận",           done: stepReceiveDone},
        {label: "Tải số lượng chuyển hoàn",        done: stepRebackDone},
        {label: "Tải tỷ lệ nhận kiện thành công",  done: stepBoardDone},
        {label: "Tải danh sách chi tiết",          done: stepDetailDone},
    ];

    return (
        <>
            <FontLoader/>
            <div className="min-h-screen bg-[#f5f6fa] flex flex-col text-[13px]">

                {/* ── Header ─────────────────────────────────────────────── */}
                <header className="bg-white border-b border-slate-200 flex-shrink-0 px-5 h-14 flex items-center justify-between gap-4 shadow-sm sticky top-0 z-10">
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={() => window.history.back()}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors font-semibold text-xs"
                        >
                            <ArrowLeft className="w-4 h-4"/>
                            Quay lại
                        </button>
                        <div className="w-px h-5 bg-slate-200"/>

                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
                                <PackageOpen className="w-3.5 h-3.5 text-indigo-600"/>
                            </div>
                            <span className="font-bold text-slate-800">Tình hình vận hành</span>
                        </div>

                        <span className="mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg">
                            028M08
                        </span>

                        <div className="w-px h-5 bg-slate-200"/>

                        {/* ── Date nav ───────────────────────────────────── */}
                        <div className="flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"/>
                            <button
                                onClick={() => shiftDay(-1)}
                                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all"
                            >
                                <ChevronLeft className="w-3 h-3"/>
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                max={today}
                                onChange={e => { if (e.target.value) setSelectedDate(e.target.value); }}
                                className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-400 text-slate-700 cursor-pointer transition-all"
                            />
                            <button
                                onClick={() => shiftDay(1)}
                                disabled={selectedDate >= today}
                                className="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-3 h-3"/>
                            </button>
                            {selectedDate !== today && (
                                <button
                                    onClick={() => setSelectedDate(today)}
                                    className="px-2 py-1 text-[11px] font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-all"
                                >
                                    Hôm nay
                                </button>
                            )}
                        </div>

                        {/* ── Staff input ────────────────────────────────── */}
                        <div className="w-px h-5 bg-slate-200"/>
                        <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0"/>
                            <span className="text-xs font-semibold text-slate-500">NV đi làm:</span>
                            <input
                                type="number"
                                min="1"
                                value={staffCount}
                                placeholder="0"
                                onChange={e => setStaffCount(e.target.value)}
                                className="w-16 px-2 py-1 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 focus:border-indigo-400 text-slate-700 transition-all text-center"
                            />
                            <span className="text-xs text-slate-400">người</span>
                        </div>

                        {/* ── Fetch button ───────────────────────────────── */}
                        <div className="w-px h-5 bg-slate-200"/>
                        <button
                            onClick={handleFetch}
                            disabled={isFetching}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all disabled:opacity-50 shadow-sm shadow-indigo-200"
                        >
                            <Search className="w-3.5 h-3.5"/>
                            Xem báo cáo
                        </button>
                    </div>

                    <button
                        onClick={handleFetch}
                        disabled={isFetching}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold text-xs transition-all disabled:opacity-40"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}/>
                        Làm mới
                    </button>
                </header>

                {/* ── Body ───────────────────────────────────────────────── */}
                {/* Idle state */}
                {!isFetching && !dataReady && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 p-12">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                            <Search className="w-7 h-7 text-indigo-300"/>
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-slate-500 text-sm mb-1">Chọn ngày và bấm "Xem báo cáo"</p>
                            <p className="text-xs text-slate-400">Dữ liệu sẽ hiển thị sau khi tải xong</p>
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {isFetching && <LoadingOverlay steps={loadingSteps}/>}

                {/* Data ready */}
                {dataReady && !isFetching && (
                    <main className="flex-1 flex items-start justify-center p-8 gap-5 flex-wrap">

                        {/* Card 1 — BÁO CÁO ẤP 4 (1) */}
                        <div className="card-appear bg-white border border-slate-200 rounded-2xl shadow-sm w-full max-w-lg flex flex-col">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                                <p className="font-bold text-slate-800 text-[15px]">BÁO CÁO ẤP 4 (1)</p>
                                <span className="text-[11px] font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{formatDisplayDate(selectedDate)}</span>
                            </div>
                            <div className="px-6 py-5 text-slate-700 text-[15px] leading-8 flex-1">
                                Tình hình vận hành <span className="font-semibold text-slate-900">028M08</span> ngày <span className="font-semibold text-slate-900">{formatDisplayDate(selectedDate)}</span><br/>
                                - Tổng lượng hàng đến: <span className="font-semibold text-slate-900">{busOpArrival.length} đơn</span><br/>
                                - Số phiếu phát hàng: <span className="font-semibold text-slate-900">{sendCount} đơn</span><br/>
                                - Số phiếu ký nhận: <span className="font-semibold text-slate-900">{signCount} đơn</span><br/>
                                - Số phiếu tồn kho: <span className="font-semibold text-slate-900">{reserveNum} đơn</span><br/>
                                - Tỉ lệ ký nhận: <span className="font-semibold text-slate-900">{signRate}</span><br/>
                                - Tỉ lệ tồn ứ: <span className="font-semibold text-slate-900">{signCount > 0 ? (reserveNum / signCount * 100).toFixed(2) + "%" : "—"}</span><br/>
                                - Hiệu suất ký nhận bình quân: <span className={`font-semibold ${staffNum > 0 ? "text-indigo-600" : "text-slate-400"}`}>{hieuSuatBQ}</span><br/>
                                - Tỉ lệ kiểm kho thực tế: <span className="font-semibold text-slate-900">{scanReserveRate}</span><br/>
                                - Lượng đơn truyền thống: <span className="font-semibold text-slate-900">{traditionalBills.length} đơn</span><br/>
                                <span className="invisible">- placeholder<br/></span>
                                <span className="invisible">- placeholder<br/></span>
                            </div>
                        </div>

                        {/* Card 2 — BÁO CÁO ẤP 4 (2) */}
                        <div className="card-appear bg-white border border-slate-200 rounded-2xl shadow-sm w-full max-w-lg flex flex-col">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                                <p className="font-bold text-slate-800 text-[15px]">BÁO CÁO ẤP 4 (2)</p>
                                <span className="text-[11px] font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{formatDisplayDate(selectedDate)}</span>
                            </div>
                            <div className="px-6 py-5 text-slate-700 text-[15px] leading-8 flex-1">
                                - SỐ PHIẾU HÀNG ĐẾN: <span className="font-semibold text-slate-900">{busOpArrival.length} đơn</span><br/>
                                - HÀNG TỒN HIỆN TẠI: <span className="font-semibold text-slate-900">{reserveNum} đơn</span><br/>
                                - SỐ ĐƠN CHUYỂN HOÀN: <span className="font-semibold text-slate-900">{allRebackBills.length} đơn</span><br/>
                                - LƯỢNG HÀNG NHẬN TRONG NGÀY: <span className="font-semibold text-slate-900">{receiveNum} đơn</span><br/>
                                - TỶ LỆ NHẬN KIỆN THÀNH CÔNG: <span className="font-semibold text-indigo-600">{receiveSuccessRate}</span><br/>
                                - SẢN LƯỢNG ĐƠN TRUYỀN THỐNG TRONG NGÀY: <span className="font-semibold text-slate-900">{traditionalBills.length}</span><br/>
                                <span className="invisible">- placeholder<br/></span>
                                <span className="invisible">- placeholder<br/></span>
                                <span className="invisible">- placeholder<br/></span>
                                <span className="invisible">- placeholder<br/></span>
                                <span className="invisible">- placeholder<br/></span>
                                <span className="invisible">- placeholder<br/></span>
                            </div>
                        </div>

                        {/* Card 3 — BÁO CÁO VẬN HÀNH */}
                        <div className="card-appear bg-white border border-slate-200 rounded-2xl shadow-sm w-full max-w-lg flex flex-col">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                                <p className="font-bold text-slate-800 text-[15px]">BÁO CÁO VẬN HÀNH</p>
                                <span className="text-[11px] font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{formatDisplayDate(selectedDate)}</span>
                            </div>
                            <div className="px-6 py-5 text-slate-700 text-[15px] leading-8 flex-1">
                                - SỐ PHIẾU HÀNG ĐẾN: <span className="font-semibold text-slate-900">{busOpArrival.length} đơn</span><br/>
                                - SỐ PHIẾU PHÁT HÀNG: <span className="font-semibold text-slate-900">{sendCount} đơn</span><br/>
                                - SỐ PHIẾU KÝ NHẬN: <span className="font-semibold text-slate-900">{signCount} đơn</span><br/>
                                - LƯỢNG HÀNG TỒN HÔM NAY: <span className="font-semibold text-slate-900">{reserveNum} đơn</span><br/>
                                - LƯỢNG NHẬN HÀNG THÀNH CÔNG: <span className="font-semibold text-slate-900">{receiveNum} đơn</span><br/>
                                - LƯỢNG NHẬN HÀNG TRUYỀN THỐNG: <span className="font-semibold text-slate-900">{traditionalBills.length}</span><br/>
                                - TỶ LỆ NHẬN KIỆN THÀNH CÔNG: <span className="font-semibold text-indigo-600">{receiveSuccessRate}</span><br/>
                                - SỐ ĐƠN CHUYỂN HOÀN TRONG NGÀY: <span className="font-semibold text-slate-900">{allRebackBills.length}</span><br/>
                                - HÀNG ĐẾN TIKTOK: <span className="font-semibold text-slate-900">{tiktokOrders.length}</span><br/>
                                - SỐ ĐƠN CHUYỂN HOÀN TIKTOK: <span className="font-semibold text-slate-900">{allTiktokRebacks.length} đơn</span><br/>
                                <span className="invisible">- placeholder<br/></span>
                                <span className="invisible">- placeholder<br/></span>
                            </div>
                        </div>

                    </main>
                )}

                <footer className="text-center text-xs text-slate-300 py-2 border-t border-slate-100 bg-white flex-shrink-0">
                    JT Express Internal Tool · {new Date().getFullYear()}
                </footer>
            </div>
        </>
    );
}