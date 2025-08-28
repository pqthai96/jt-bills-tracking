import React, {useEffect, useState} from 'react';
import axios from "axios";

function OrderDetail({waybill, authToken}: { waybill: any, authToken: string }) {

    const [orderDetailData, setOrderDetailData] = useState<any>("");

    useEffect(() => {
        axios.post("https://jmsgw.jtexpress.vn/operatingplatform/order/getOrderDetail", {
                "waybillNo": waybill,
                "countryId": "1"
            },
            {
                headers: {
                    authToken: authToken,
                    lang: 'VN',
                    langType: 'VN',
                }
            }).then((resp: any) => setOrderDetailData(resp.data.data.details));
    }, [])

    return (
        <div className="flex-1 p-4 bg-gray-50 flex flex-col h-full">
            {/* Header với mã đơn - cố định */}
            <div className="bg-white border border-gray-200 p-6 mb-6 flex-shrink-0">
                <div className="border-l-4 border-red-500 pl-4">
                    <h2 className="text-2xl font-semibold text-slate-800 tracking-tight">
                        VẬN ĐƠN: <span className="text-amber-600 font-mono">{waybill}</span>
                    </h2>
                    <h2 className="text-xl font-medium text-slate-700 mt-2">
                        MÃ ĐOẠN: <span className="text-purple-600 font-mono">{orderDetailData.terminalDispatchCode}</span>
                    </h2>
                </div>
            </div>

            {/* Container cho các khung thông tin - có thể scroll */}
            <div className="flex-1 overflow-y-auto">
                <div className="space-y-4">
                    {/* Thông tin người gửi */}
                    <div className="bg-white border border-gray-200 p-5">
                        <div className="mb-4">
                            <h3 className="font-semibold text-lg text-slate-800 tracking-tight">
                                Thông tin người gửi
                            </h3>
                            <div className="w-12 h-1 bg-emerald-500 mt-2"></div>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[120px]">Người gửi:</span>
                                <span className="text-slate-800 font-medium">{orderDetailData.senderName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[120px]">Shop name:</span>
                                <span className="text-slate-800 font-medium">{orderDetailData.sellerName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[120px]">Điện thoại:</span>
                                <span className="text-slate-800 font-mono">{orderDetailData.senderMobilePhone}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[120px]">Địa chỉ:</span>
                                <span className="text-slate-800 leading-relaxed">
                                    {orderDetailData.senderDetailedAddress},{" "}
                                    {orderDetailData.senderAreaName},{" "}
                                    {orderDetailData.senderCityName},{" "}
                                    {orderDetailData.senderProvinceName},{" "}
                                    {orderDetailData.senderCountryName}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Thông tin người nhận */}
                    <div className="bg-white border border-gray-200 p-5">
                        <div className="mb-4">
                            <h3 className="font-semibold text-lg text-slate-800 tracking-tight">
                                Thông tin người nhận
                            </h3>
                            <div className="w-12 h-1 bg-blue-500 mt-2"></div>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[120px]">Người nhận:</span>
                                <span className="text-slate-800 font-medium">{orderDetailData.receiverName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[120px]">Điện thoại:</span>
                                <span className="text-slate-800 font-mono">{orderDetailData.receiverMobilePhone}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[120px]">Địa chỉ:</span>
                                <span className="text-slate-800 leading-relaxed">
                                    {orderDetailData.receiverDetailedAddress},{" "}
                                    {orderDetailData.receiverAreaName},{" "}
                                    {orderDetailData.receiverCityName},{" "}
                                    {orderDetailData.receiverProvinceName},{" "}
                                    {orderDetailData.receiverCountryName}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Thông tin cơ bản */}
                    <div className="bg-white border border-gray-200 p-5">
                        <div className="mb-4">
                            <h3 className="font-semibold text-lg text-slate-800 tracking-tight">
                                Thông tin cơ bản
                            </h3>
                            <div className="w-12 h-1 bg-purple-500 mt-2"></div>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Nguồn đơn đặt:</span>
                                <span className="text-slate-800">{orderDetailData.orderSourceName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Phân loại hàng hoá:</span>
                                <span className="text-slate-800">{orderDetailData.goodsTypeName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Thời gian lấy đơn đặt:</span>
                                <span className="text-slate-800 font-mono">{orderDetailData.pickTime}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Nội dung hàng hoá:</span>
                                <span className="text-slate-800">{orderDetailData.goodsName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Giá trị hàng hoá:</span>
                                <span className="text-slate-800 font-mono">{orderDetailData.insuredAmount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Chi tiết gửi hàng */}
                    <div className="bg-white border border-gray-200 p-5">
                        <div className="mb-4">
                            <h3 className="font-semibold text-lg text-slate-800 tracking-tight">
                                Chi tiết gửi hàng
                            </h3>
                            <div className="w-12 h-1 bg-orange-500 mt-2"></div>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[200px]">Bưu cục gửi:</span>
                                <span className="text-slate-800">{orderDetailData.pickNetworkName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[200px]">Người gửi:</span>
                                <span className="text-slate-800">{orderDetailData.customerName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[200px]">Mã KH:</span>
                                <span className="text-slate-800 font-mono">{orderDetailData.customerCode}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[200px]">Loại vận chuyển:</span>
                                <span className="text-slate-800">{orderDetailData.expressTypeName}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[200px]">Nhân viên lấy hàng:</span>
                                <span className="text-slate-800">
                                    <span className="font-mono">{orderDetailData.staffCode}</span> - {orderDetailData.staffName}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Thông tin thanh toán */}
                    <div className="bg-white border border-gray-200 p-5">
                        <div className="mb-4">
                            <h3 className="font-semibold text-lg text-slate-800 tracking-tight">
                                Thông tin thanh toán
                            </h3>
                            <div className="w-12 h-1 bg-teal-500 mt-2"></div>
                        </div>
                        <div className="space-y-3 text-sm">
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Trọng lượng tính phí:</span>
                                <span className="text-slate-800 font-mono">{orderDetailData.packageChargeWeight}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Dài rộng cao (cm):</span>
                                <span className="text-slate-800 font-mono">
                                    {orderDetailData.packageLength}×{orderDetailData.packageWide}×{orderDetailData.packageHigh}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Trọng lượng quy đổi:</span>
                                <span className="text-slate-800 font-mono">{orderDetailData.packageVolume}</span>
                            </div>
                            <div className="flex flex-wrap items-start">
                                <span className="text-slate-600 font-medium min-w-[180px]">Phương thức thanh toán:</span>
                                <span className="text-slate-800">{orderDetailData.paymentModeName}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default OrderDetail;