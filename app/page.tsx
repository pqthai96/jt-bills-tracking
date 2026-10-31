"use client";

import React, {useState, useEffect, useCallback} from "react";
import {useRouter} from "next/navigation";
import {
    AlertCircle, Search, Copy, Truck, Package, FileText,
    CheckCircle, XCircle, Loader2, Eye, Key, Printer,
    Shield, Zap, Warehouse, BarChart2, RotateCcw, Network
} from "lucide-react";
import {NETWORK_CODES, NETWORK_CODE_STORAGE_KEY} from "@/lib/networkCode";

// ─── Mã BC ────────────────────────────────────────────────────────────────────
const DEFAULT_NETWORK_CODE = "028M08";
const NETWORK_CODE_REGEX = /^[A-Z0-9]{6}$/;

const sanitizeNetworkCode = (v: string) =>
    v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

const buildNetwork = (code: string): any => {
    const found = NETWORK_CODES.find(n => n.code === code);
    if (found) return found;
    const agentCode = code.startsWith("028")
        ? NETWORK_CODES[0].agentCode
        : NETWORK_CODES[1].agentCode;
    return {code, label: code, agentCode};
};

// ─── Google Font (Nunito — hỗ trợ tiếng Việt) ────────────────────────────────
const FontLoader = () => (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Nunito', 'Segoe UI', Arial, sans-serif; }
    `}</style>
);

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
    {
        href: "/stalled-bills",
        label: "Theo dõi đơn hàng nhận",
        icon: Truck,
        bg: "bg-blue-50",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        border: "border-blue-100",
        hoverBorder: "hover:border-blue-300",
        hoverBg: "hover:bg-blue-50/80",
    },
    {
        href: "/stalled-bills-with-keys",
        label: "Hàng nhận + mã đoạn",
        icon: Key,
        bg: "bg-violet-50",
        iconBg: "bg-violet-100",
        iconColor: "text-violet-600",
        border: "border-violet-100",
        hoverBorder: "hover:border-violet-300",
        hoverBg: "hover:bg-violet-50/80",
    },
    {
        href: "/missed-bills",
        label: "Phát sót",
        icon: Search,
        bg: "bg-orange-50",
        iconBg: "bg-orange-100",
        iconColor: "text-orange-600",
        border: "border-orange-100",
        hoverBorder: "hover:border-orange-300",
        hoverBg: "hover:bg-orange-50/80",
    },
    {
        href: "/bill-tracking",
        label: "Theo dõi đơn",
        icon: Eye,
        bg: "bg-cyan-50",
        iconBg: "bg-cyan-100",
        iconColor: "text-cyan-600",
        border: "border-cyan-100",
        hoverBorder: "hover:border-cyan-300",
        hoverBg: "hover:bg-cyan-50/80",
    },
    {
        href: "/bus-warehouse",
        label: "Xuất kho tổng hợp",
        icon: FileText,
        bg: "bg-emerald-50",
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        border: "border-emerald-100",
        hoverBorder: "hover:border-emerald-300",
        hoverBg: "hover:bg-emerald-50/80",
    },
    {
        href: "/reverse-bills",
        label: "Xuất kho đơn tồn",
        icon: Package,
        bg: "bg-amber-50",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-600",
        border: "border-amber-100",
        hoverBorder: "hover:border-amber-300",
        hoverBg: "hover:bg-amber-50/80",
    },
    {
        href: "/bill-reprint",
        label: "In lại vận đơn",
        icon: Printer,
        bg: "bg-rose-50",
        iconBg: "bg-rose-100",
        iconColor: "text-rose-600",
        border: "border-rose-100",
        hoverBorder: "hover:border-rose-300",
        hoverBg: "hover:bg-rose-50/80",
    },
    {
        href: "/operation-stocktaking",
        label: "Kiểm kho",
        icon: Warehouse,
        bg: "bg-indigo-50",
        iconBg: "bg-indigo-100",
        iconColor: "text-indigo-600",
        border: "border-indigo-100",
        hoverBorder: "hover:border-indigo-300",
        hoverBg: "hover:bg-indigo-50/80",
    },
    {
        href: "/daily-report",
        label: "Báo cáo hằng ngày",
        icon: BarChart2,
        bg: "bg-teal-50",
        iconBg: "bg-teal-100",
        iconColor: "text-teal-600",
        border: "border-teal-100",
        hoverBorder: "hover:border-teal-300",
        hoverBg: "hover:bg-teal-50/80",
    },
    {
        href: "/reback-transfer",
        label: "Đăng ký chuyển hoàn",
        icon: RotateCcw,
        bg: "bg-pink-50",
        iconBg: "bg-pink-100",
        iconColor: "text-pink-600",
        border: "border-pink-100",
        hoverBorder: "hover:border-pink-300",
        hoverBg: "hover:bg-pink-50/80",
    },
];

// ─── Navigation overlay ───────────────────────────────────────────────────────
function NavigatingOverlay({label}: { label: string }) {
    return (
        <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center">
            <div
                className="flex flex-col items-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-xl px-8 py-6">
                <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-200"/>
                    <div className="absolute inset-0 rounded-full border-t-2 border-orange-500 animate-spin"/>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-orange-500"/>
                    </div>
                </div>
                <p className="text-sm font-semibold text-slate-700">Đang mở...</p>
                <p className="text-xs text-slate-400">{label}</p>
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
    const router = useRouter();
    const [authToken, setAuthToken] = useState("");
    const [tokenStatus, setTokenStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
    const [statusMsg, setStatusMsg] = useState("");
    const [storedToken, setStoredToken] = useState("");
    const [initialCheckDone, setInitialCheckDone] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

    // Mã BC: ô nhập (string) + object đã xác thực (dùng cho pill và localStorage)
    const [networkInput, setNetworkInput] = useState(DEFAULT_NETWORK_CODE);
    const [networkCode, setNetworkCode] = useState<any>(buildNetwork(DEFAULT_NETWORK_CODE));

    const isValid = tokenStatus === "valid";
    const isReady = isValid;
    const networkInvalid = networkInput.length > 0 && !NETWORK_CODE_REGEX.test(networkInput);

    const validateToken = async (token: string, network: any, isInit = false) => {
        setTokenStatus("checking");
        setStatusMsg(isInit ? "Đang xác thực token đã lưu..." : "Đang kiểm tra...");
        try {
            const res = await fetch(
                "https://jmsgw.jtexpress.vn/servicequality/integration/getWaybillsByReverse?type=1&waybillId=859391669969",
                {method: "GET", headers: {"Content-Type": "application/json", authToken: token}}
            );
            if (res.ok) {
                localStorage.setItem("YL_TOKEN", token);
                localStorage.setItem(NETWORK_CODE_STORAGE_KEY, JSON.stringify(network));
                setStoredToken(token);
                setAuthToken(token);
                setNetworkCode(network);
                setNetworkInput(network.code);
                setTokenStatus("valid");
                setStatusMsg("Token hợp lệ — sẵn sàng sử dụng");
            } else {
                setTokenStatus("invalid");
                clearStored();
                if (isInit) setAuthToken("");
                setStatusMsg("Token không hợp lệ hoặc đã hết hạn");
            }
        } catch {
            setTokenStatus("invalid");
            if (isInit) {
                clearStored();
                setAuthToken("");
            }
            setStatusMsg("Lỗi kết nối — không thể xác thực");
        } finally {
            if (isInit) setInitialCheckDone(true);
        }
    };

    const clearStored = () => {
        localStorage.removeItem("YL_TOKEN");
        localStorage.removeItem("authToken");
        localStorage.removeItem(NETWORK_CODE_STORAGE_KEY);
        setStoredToken("");
    };

    useEffect(() => {
        const saved = localStorage.getItem("YL_TOKEN") || localStorage.getItem("authToken");

        // Đọc Mã BC đã lưu (JSON object hoặc chuỗi thuần), sai định dạng thì dùng mặc định
        let savedCode = DEFAULT_NETWORK_CODE;
        const raw = localStorage.getItem(NETWORK_CODE_STORAGE_KEY);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                const c = sanitizeNetworkCode(String(parsed?.code ?? parsed ?? ""));
                if (NETWORK_CODE_REGEX.test(c)) savedCode = c;
            } catch {
                const c = sanitizeNetworkCode(raw);
                if (NETWORK_CODE_REGEX.test(c)) savedCode = c;
            }
        }
        const savedNetwork = buildNetwork(savedCode);
        setNetworkInput(savedCode);
        setNetworkCode(savedNetwork);

        if (saved?.trim()) {
            validateToken(saved.trim(), savedNetwork, true);
        } else {
            setInitialCheckDone(true);
            setStatusMsg("");
        }
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setAuthToken(v);
        if (v !== storedToken) {
            setTokenStatus("idle");
            setStatusMsg("");
        }
    };

    const handleNetworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNetworkInput(sanitizeNetworkCode(e.target.value));
        if (tokenStatus === "valid") {
            setTokenStatus("idle");
            setStatusMsg("");
        }
    };

    const handleValidate = () => {
        if (!authToken.trim()) {
            setStatusMsg("Vui lòng nhập token trước");
            return;
        }
        if (!NETWORK_CODE_REGEX.test(networkInput)) {
            setTokenStatus("idle");
            setStatusMsg("Mã BC phải đủ 6 ký tự (chữ và số)");
            return;
        }
        validateToken(authToken.trim(), buildNetwork(networkInput), false);
    };

    const clearToken = () => {
        setAuthToken("");
        setStoredToken("");
        setNetworkInput(DEFAULT_NETWORK_CODE);
        setNetworkCode(buildNetwork(DEFAULT_NETWORK_CODE));
        setTokenStatus("idle");
        setStatusMsg("");
        clearStored();
    };

    const copyBookmarklet = async () => {
        const code = `javascript:(function(){const t=localStorage.getItem('YL_TOKEN')||localStorage.getItem('authToken')||localStorage.getItem('token');if(t){navigator.clipboard.writeText(t).then(()=>{alert('Token copied!');}).catch(()=>{prompt('Copy:',t);});}else{alert('Không tìm thấy token.');}})();`;
        try {
            await navigator.clipboard.writeText(code);
            setStatusMsg("Bookmarklet đã copy — tạo bookmark mới và paste vào URL");
        } catch {
            setStatusMsg("Không thể copy tự động");
        }
    };

    // Navigate with instant visual feedback
    const handleNavigate = useCallback((href: string, label: string) => {
        setNavigatingTo(label);
        router.push(href);
    }, [router]);

    // Loading
    if (!initialCheckDone) {
        return (
            <>
                <FontLoader/>
                <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative w-12 h-12">
                            <div className="absolute inset-0 rounded-full border-2 border-slate-200"/>
                            <div className="absolute inset-0 rounded-full border-t-2 border-orange-500 animate-spin"/>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Truck className="w-4 h-4 text-orange-500"/>
                            </div>
                        </div>
                        <p className="text-sm text-slate-400 font-medium">Đang khởi tạo...</p>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <FontLoader/>

            {/* ── Navigation overlay — shows instantly on click ── */}
            {navigatingTo && <NavigatingOverlay label={navigatingTo}/>}

            <div className="min-h-screen bg-slate-50">

                {/* ── Top bar ── */}
                <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                    <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                <Zap className="w-4 h-4 text-white"/>
                            </div>
                            <div>
                                <span className="font-bold text-slate-800 text-sm">JT Express</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Network code pill (only once token is valid) */}
                            {isValid && networkCode && (
                                <div
                                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                    <Network className="w-3 h-3"/>
                                    {networkCode.label}
                                </div>
                            )}

                            {/* Status pill */}
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                                isReady
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                            }`}>
                                <div
                                    className={`w-1.5 h-1.5 rounded-full ${isReady ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}/>
                                {isReady ? "Đã kết nối" : "Chưa xác thực"}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">

                    {/* ── Auth Card ── */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Card header */}
                        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-slate-400"/>
                            <span className="font-semibold text-slate-700 text-sm">Xác thực</span>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Input row */}
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <input
                                        type={showToken ? "text" : "password"}
                                        value={authToken}
                                        onChange={handleChange}
                                        disabled={tokenStatus === "checking"}
                                        placeholder="Paste authToken từ JMS vào đây..."
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-all pr-16 disabled:opacity-60"
                                    />
                                    <button
                                        onClick={() => setShowToken(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 transition-colors font-semibold"
                                    >
                                        {showToken ? "Ẩn" : "Hiện"}
                                    </button>
                                </div>

                                {/* Mã BC — nhập tay, 6 ký tự */}
                                <input
                                    type="text"
                                    value={networkInput}
                                    onChange={handleNetworkChange}
                                    onKeyDown={e => {
                                        if (e.key === "Enter" && tokenStatus !== "valid") handleValidate();
                                    }}
                                    disabled={tokenStatus === "checking"}
                                    maxLength={6}
                                    placeholder={DEFAULT_NETWORK_CODE}
                                    title="Mã BC (6 ký tự)"
                                    autoComplete="off"
                                    spellCheck={false}
                                    className={`w-28 shrink-0 border rounded-xl px-3 py-2.5 text-sm font-semibold text-center tracking-wider text-slate-700 placeholder-slate-300 bg-slate-50 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 ${
                                        networkInvalid
                                            ? "border-red-300 focus:ring-red-400/40 focus:border-red-400"
                                            : "border-slate-200 focus:ring-orange-400/40 focus:border-orange-400"
                                    }`}
                                />

                                {tokenStatus !== "valid" && (
                                    <button
                                        onClick={handleValidate}
                                        disabled={tokenStatus === "checking"}
                                        className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 shadow-sm"
                                    >
                                        {tokenStatus === "checking"
                                            ? <Loader2 className="w-4 h-4 animate-spin"/>
                                            : <CheckCircle className="w-4 h-4"/>
                                        }
                                        Xác thực
                                    </button>
                                )}

                                <button
                                    onClick={copyBookmarklet}
                                    title="Copy bookmarklet lấy token tự động"
                                    className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
                                >
                                    Bookmarklet
                                </button>
                            </div>

                            {/* Network code hint */}
                            {networkInvalid && (
                                <p className="text-xs text-red-500 font-medium px-1 -mt-2">
                                    Mã BC phải đủ 6 ký tự (hiện có {networkInput.length}/6)
                                </p>
                            )}

                            {/* Status message */}
                            {statusMsg && (
                                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${
                                    isValid
                                        ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                        : tokenStatus === "invalid"
                                            ? "bg-red-50 border border-red-200 text-red-600"
                                            : tokenStatus === "checking"
                                                ? "bg-blue-50 border border-blue-200 text-blue-600"
                                                : "bg-slate-50 border border-slate-200 text-slate-600"
                                }`}>
                                    {isValid && <CheckCircle className="w-4 h-4 shrink-0"/>}
                                    {tokenStatus === "invalid" && <XCircle className="w-4 h-4 shrink-0"/>}
                                    {tokenStatus === "checking" && <Loader2 className="w-4 h-4 shrink-0 animate-spin"/>}
                                    {tokenStatus === "idle" && statusMsg && <AlertCircle className="w-4 h-4 shrink-0"/>}
                                    <span className="flex-1">{statusMsg}</span>
                                    {isValid && (
                                        <div className="flex items-center gap-1 ml-auto">
                                            <button onClick={() => navigator.clipboard.writeText(authToken)}
                                                    className="p-1 hover:bg-emerald-100 rounded-lg transition-colors"
                                                    title="Copy token">
                                                <Copy className="w-3.5 h-3.5"/>
                                            </button>
                                            <button onClick={clearToken}
                                                    className="p-1 hover:bg-red-50 rounded-lg transition-colors text-red-400"
                                                    title="Xóa token">
                                                <XCircle className="w-3.5 h-3.5"/>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Guide — only when not valid */}
                            {!isValid && tokenStatus !== "checking" && (
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Dùng
                                            Bookmarklet</p>
                                        <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                                            <li>Click nút Bookmarklet để copy code</li>
                                            <li>Tạo bookmark mới, paste vào URL</li>
                                            <li>Vào <a href="https://jms.jtexpress.vn" target="_blank"
                                                       className="text-orange-500 hover:underline font-semibold">JMS JT
                                                Express</a>, click bookmark
                                            </li>
                                            <li>Paste token vào đây rồi xác thực</li>
                                        </ol>
                                    </div>
                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Thủ
                                            công (F12)</p>
                                        <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside leading-relaxed">
                                            <li>Đăng nhập <a href="https://jms.jtexpress.vn" target="_blank"
                                                             className="text-orange-500 hover:underline font-semibold">JMS
                                                JT Express</a></li>
                                            <li>Nhấn F12 → Application → Local Storage</li>
                                            <li>Tìm key <code
                                                className="bg-slate-200 px-1 rounded text-slate-600">YL_TOKEN</code>
                                            </li>
                                            <li>Copy value, paste vào đây</li>
                                        </ol>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Nav section ── */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Chức năng</p>

                        {/* Hàng 1: 2 nút */}
                        <div className="grid grid-cols-2 gap-3">
                            {NAV_ITEMS.slice(0, 2).map(item => (
                                <NavCard key={item.href} item={item} enabled={isReady} onNavigate={handleNavigate}/>
                            ))}
                        </div>

                        {/* Hàng 2: 3 nút */}
                        <div className="grid grid-cols-3 gap-3">
                            {NAV_ITEMS.slice(2, 5).map(item => (
                                <NavCard key={item.href} item={item} enabled={isReady} onNavigate={handleNavigate}/>
                            ))}
                        </div>

                        {/* Hàng 3: 3 nút */}
                        <div className="grid grid-cols-3 gap-3">
                            {NAV_ITEMS.slice(5, 8).map(item => (
                                <NavCard key={item.href} item={item} enabled={isReady} onNavigate={handleNavigate}/>
                            ))}
                        </div>

                        {/* Hàng 4: 2 nút */}
                        <div className="grid grid-cols-2 gap-3">
                            {NAV_ITEMS.slice(8, 10).map(item => (
                                <NavCard key={item.href} item={item} enabled={isReady} onNavigate={handleNavigate}/>
                            ))}
                        </div>
                    </div>

                    {/* Lock notice */}
                    {!isReady && (
                        <div className="flex items-center justify-center gap-3 py-2">
                            <div className="h-px flex-1 bg-slate-200"/>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <AlertCircle className="w-3.5 h-3.5"/>
                                Xác thực token và nhập Mã BC để mở khóa các chức năng
                            </div>
                            <div className="h-px flex-1 bg-slate-200"/>
                        </div>
                    )}

                    <p className="text-center text-xs text-slate-300 pb-2">
                        JT Express Internal Tool · {new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </>
    );
}

// ─── NavCard ──────────────────────────────────────────────────────────────────
function NavCard({
                     item,
                     enabled,
                     onNavigate,
                 }: {
    item: typeof NAV_ITEMS[0];
    enabled: boolean;
    onNavigate: (href: string, label: string) => void;
}) {
    const Icon = item.icon;

    const inner = (
        <div
            className={`group h-full bg-white rounded-xl border p-4 flex flex-col items-center justify-center gap-3 text-center transition-all duration-150 ${
                enabled
                    ? `${item.border} ${item.hoverBorder} hover:shadow-md cursor-pointer active:scale-95`
                    : "border-slate-100 opacity-40 cursor-not-allowed"
            }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.iconBg}`}>
                <Icon className={`w-5 h-5 ${item.iconColor}`}/>
            </div>

            <p className="text-xs font-bold text-slate-700 leading-snug group-hover:text-slate-900 transition-colors">
                {item.label.toUpperCase()}
            </p>
        </div>
    );

    if (!enabled) return <div className="h-full">{inner}</div>;

    return (
        <div
            className="h-full"
            onClick={() => onNavigate(item.href, item.label)}
        >
            {inner}
        </div>
    );
}