"use client";

import React, {useState, useEffect} from "react";
import Link from "next/link";
import {AlertCircle, Search, Copy, Truck, Package, FileText, CheckCircle, XCircle, Loader2, Eye} from "lucide-react";

export default function Home() {
    const [authToken, setAuthToken] = useState<string>('');
    const [tokenDetectionStatus, setTokenDetectionStatus] = useState<string>('');
    const [isDetectingToken, setIsDetectingToken] = useState<boolean>(false);
    const [isTokenValid, setIsTokenValid] = useState<boolean>(false);
    const [isValidatingToken, setIsValidatingToken] = useState<boolean>(false);
    const [storedToken, setStoredToken] = useState<string>('');

    // Check for stored token on component mount
    useEffect(() => {
        const checkStoredToken = () => {
            const token = localStorage.getItem('YL_TOKEN') || localStorage.getItem('authToken');
            if (token) {
                setStoredToken(token);
                setAuthToken(token);
                setIsTokenValid(true);
                setTokenDetectionStatus('✅ Token đã được lưu và sẵn sàng sử dụng');
            }
        };

        checkStoredToken();
    }, []);

    // Generate bookmarklet for easy token copying
    const generateBookmarklet = () => {
        const bookmarkletCode = `javascript:(function(){const token=localStorage.getItem('YL_TOKEN')||localStorage.getItem('authToken')||localStorage.getItem('token');if(token){navigator.clipboard.writeText(token);alert('Token đã copy: '+token.substring(0,20)+'...\\nPaste vào trang dashboard!');}else{alert('Không tìm thấy token.\\nHãy đăng nhập JMS trước.');}})();`;
        return bookmarkletCode;
    };

    // Copy bookmarklet to clipboard
    const copyBookmarklet = () => {
        const bookmarklet = generateBookmarklet();
        navigator.clipboard.writeText(bookmarklet).then(() => {
            setTokenDetectionStatus('✅ Bookmarklet đã copy! Tạo bookmark mới và paste vào URL');
        });
    };

    // Copy token to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setTokenDetectionStatus('✅ Token đã được copy vào clipboard');
        });
    };

    // Validate token with API
    const validateToken = async (token: string) => {
        setIsValidatingToken(true);
        setTokenDetectionStatus('🔄 Đang kiểm tra token...');

        try {
            // Replace with your actual API endpoint
            const response = await fetch('https://jmsgw.jtexpress.vn/servicequality/integration/getWaybillsByReverse?type=1&waybillId=859391669969', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'authToken': token
                }
            });

            if (response.ok) {
                // Token is valid
                localStorage.setItem('YL_TOKEN', token);
                setStoredToken(token);
                setIsTokenValid(true);
                setTokenDetectionStatus('✅ Token hợp lệ và đã được lưu');
            } else {
                // Token is invalid
                setIsTokenValid(false);
                setTokenDetectionStatus('❌ Token không hợp lệ. Vui lòng kiểm tra lại');
                // Clear invalid token from localStorage
                localStorage.removeItem('YL_TOKEN');
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('Error validating token:', error);
            setIsTokenValid(false);
            setTokenDetectionStatus('❌ Lỗi kết nối. Không thể kiểm tra token');
        } finally {
            setIsValidatingToken(false);
        }
    };

    // Handle token input change
    const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newToken = e.target.value;
        setAuthToken(newToken);

        // Reset validation state when token changes
        if (newToken !== storedToken) {
            setIsTokenValid(false);
            setTokenDetectionStatus('');
        }
    };

    // Handle token validation
    const handleValidateToken = () => {
        if (authToken.trim()) {
            validateToken(authToken.trim());
        } else {
            setTokenDetectionStatus('❌ Vui lòng nhập token trước khi kiểm tra');
        }
    };

    // Clear token
    const clearToken = () => {
        setAuthToken('');
        setStoredToken('');
        setIsTokenValid(false);
        setTokenDetectionStatus('');
        localStorage.removeItem('YL_TOKEN');
        localStorage.removeItem('authToken');
    };

    return (
        <div
            className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
            <div className="w-full max-w-2xl space-y-8 mt-200">
                {/* Auth Token Section */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    <label className="block text-sm font-semibold text-gray-700 mb-4">
                        Authentication Token
                    </label>

                    <div className="space-y-4">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={authToken}
                                onChange={handleTokenChange}
                                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                                placeholder="Paste token từ JMS vào đây..."
                                disabled={isValidatingToken}
                            />

                            {!isTokenValid && authToken && (
                                <button
                                    type="button"
                                    onClick={handleValidateToken}
                                    disabled={isValidatingToken}
                                    className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl transition-all duration-200 whitespace-nowrap flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50"
                                >
                                    {isValidatingToken ? (
                                        <Loader2 className="h-4 w-4 animate-spin"/>
                                    ) : (
                                        <CheckCircle className="h-4 w-4"/>
                                    )}
                                    Kiểm tra
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={copyBookmarklet}
                                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl transition-all duration-200 whitespace-nowrap flex items-center gap-2 shadow-lg hover:shadow-xl"
                                title="Tạo bookmarklet để copy token dễ dàng"
                            >
                                <Package className="h-4 w-4"/>
                                Bookmarklet
                            </button>
                        </div>

                        {/* Token Status */}
                        {tokenDetectionStatus && (
                            <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
                                tokenDetectionStatus.includes('✅')
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : tokenDetectionStatus.includes('❌')
                                        ? 'bg-red-50 text-red-700 border border-red-200'
                                        : tokenDetectionStatus.includes('🔄')
                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                            }`}>
                                {tokenDetectionStatus.includes('✅') && <CheckCircle className="h-4 w-4"/>}
                                {tokenDetectionStatus.includes('❌') && <XCircle className="h-4 w-4"/>}
                                {tokenDetectionStatus.includes('🔄') && <Loader2 className="h-4 w-4 animate-spin"/>}
                                {tokenDetectionStatus}
                            </div>
                        )}

                        {/* Token Validation Success */}
                        {isTokenValid && authToken && (
                            <div
                                className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                                <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm text-green-700 font-medium flex-1">
                                    Token hợp lệ và đã sẵn sàng ({authToken.substring(0, 20)}...)
                                </span>
                                <button
                                    onClick={() => copyToClipboard(authToken)}
                                    className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                                    title="Copy token"
                                >
                                    <Copy className="h-4 w-4 text-green-600"/>
                                </button>
                                <button
                                    onClick={clearToken}
                                    className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Clear token"
                                >
                                    <XCircle className="h-4 w-4 text-red-600"/>
                                </button>
                            </div>
                        )}

                        {/* Instructions */}
                        {!isTokenValid && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                                <h4 className="font-semibold text-blue-800 mb-4 uppercase">Cách lấy token:</h4>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {/* Method 1: Bookmarklet */}
                                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                                        <h5 className="font-medium text-blue-700 mb-3">Cách 1: Sử dụng Bookmarklet</h5>
                                        <ol className="text-sm text-blue-600 space-y-2 list-decimal list-inside">
                                            <li>Click nút "Bookmarklet" ở trên</li>
                                            <li>Tạo bookmark mới, paste code đã copy vào URL</li>
                                            <li>Vào <a href="https://jms.jtexpress.vn" target="_blank"
                                                       className="underline hover:text-blue-800 font-medium">JMS JT
                                                Express</a>, click bookmark
                                            </li>
                                            <li>Token sẽ tự động copy, quay lại paste và kiểm tra</li>
                                        </ol>
                                    </div>

                                    {/* Method 2: Manual */}
                                    <div className="bg-white rounded-lg p-4 border border-blue-100">
                                        <h5 className="font-medium text-blue-700 mb-3">Cách 2: Thủ công</h5>
                                        <ol className="text-sm text-blue-600 space-y-2 list-decimal list-inside">
                                            <li>Đăng nhập vào <a href="https://jms.jtexpress.vn" target="_blank"
                                                                 className="underline hover:text-blue-800 font-medium">JMS
                                                JT Express</a></li>
                                            <li>Nhấn F12 → Tab Application → Local Storage</li>
                                            <li>Tìm key "YL_TOKEN"</li>
                                            <li>Copy value, paste vào đây và kiểm tra</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Theo dõi đơn hàng nhận dừng hành trình */}
                    <Link
                        href={isTokenValid ? "/stalled-bills" : "#"}
                        className={`group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg transform ${
                            isTokenValid
                                ? 'hover:from-blue-700 hover:to-purple-700 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer'
                                : 'opacity-40 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                            if (!isTokenValid) {
                                e.preventDefault();
                            }
                        }}
                    >
                        <Truck className="h-5 w-5"/>
                        <span className="text-center">THEO DÕI ĐƠN HÀNG NHẬN</span>
                    </Link>

                    {/* Phát sót */}
                    <Link
                        href={isTokenValid ? "/missed-bills" : "#"}
                        className={`group relative overflow-hidden bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg transform ${
                            isTokenValid
                                ? 'hover:from-orange-600 hover:to-red-600 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer'
                                : 'opacity-40 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                            if (!isTokenValid) {
                                e.preventDefault();
                            }
                        }}
                    >
                        <Search className="h-5 w-5"/>
                        <span className="text-center">PHÁT SÓT</span>
                    </Link>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    {/* Theo dõi đơn */}
                    <Link
                        href={isTokenValid ? "/bill-tracking" : "#"}
                        className={`group relative overflow-hidden bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg transform ${
                            isTokenValid
                                ? 'hover:from-teal-600 hover:to-cyan-600 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer'
                                : 'opacity-40 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                            if (!isTokenValid) {
                                e.preventDefault();
                            }
                        }}
                    >
                        <Eye className="h-5 w-5"/>
                        <span className="text-center">THEO DÕI ĐƠN</span>
                    </Link>

                    {/* Xuất kho */}
                    <Link
                        href={isTokenValid ? "/bus-warehouse" : "#"}
                        className={`group relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-lg transform ${
                            isTokenValid
                                ? 'hover:from-green-600 hover:to-emerald-600 hover:shadow-xl hover:-translate-y-0.5 cursor-pointer'
                                : 'opacity-40 cursor-not-allowed'
                        }`}
                        onClick={(e) => {
                            if (!isTokenValid) {
                                e.preventDefault();
                            }
                        }}
                    >
                        <FileText className="h-5 w-5"/>
                        <span className="text-center">XUẤT KHO</span>
                    </Link>
                </div>

                {/* Token Required Notice */}
                {!isTokenValid && (
                    <div className="text-center py-4">
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                            <AlertCircle className="h-4 w-4"/>
                            <span className="text-sm font-medium">Vui lòng nhập và kiểm tra token để sử dụng các chức năng</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}